from __future__ import annotations

import json
from pathlib import Path
import shutil
import threading
import time
from urllib.request import Request, urlopen
from urllib.parse import quote

import numpy as np
import rasterio
from rasterio.transform import from_origin

import backend.api.server as server_module
from backend.api.server import create_server


def _write_test_raster(path: Path, values: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=values.shape[0],
        width=values.shape[1],
        count=1,
        dtype="float32",
        crs="EPSG:32643",
        transform=from_origin(500000, 4000000, 10, 10),
        nodata=-9999,
    ) as dataset:
        dataset.write(values.astype("float32"), 1)


def _write_test_rgb_raster(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    base = np.arange(16, dtype="uint16").reshape(4, 4) + 100
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=4,
        width=4,
        count=3,
        dtype="uint16",
        crs="EPSG:32643",
        transform=from_origin(500000, 4000000, 10, 10),
        nodata=0,
    ) as dataset:
        dataset.write(base, 1)
        dataset.write(base + 20, 2)
        dataset.write(base + 40, 3)


def test_portal_serves_health_and_viewer() -> None:
    server = create_server(port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"

        with urlopen(f"{base_url}/api/health", timeout=5) as response:
            health = json.loads(response.read().decode("utf-8"))
        assert health["status"] == "ok"

        with urlopen(f"{base_url}/viewer/", timeout=5) as response:
            viewer_html = response.read().decode("utf-8")
        assert response.status == 200
        assert "Terrain Viewer" in viewer_html

        with urlopen(f"{base_url}/globe/", timeout=5) as response:
            globe_html = response.read().decode("utf-8")
        assert response.status == 200
        assert "Choose a place and build its terrain" in globe_html
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_imagery_compatibility_route_returns_downloadable_artifact(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(server_module, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(server_module, "JOBS_ROOT", tmp_path / "jobs")
    source = tmp_path / "source_rgb.tif"
    _write_test_rgb_raster(source)

    monkeypatch.setattr(
        server_module,
        "search_sentinel2_scenes",
        lambda bbox, max_cloud, limit: [
            {
                "scene_id": "demo-scene",
                "feature": {"properties": {"datetime": "2026-01-01T00:00:00Z", "eo:cloud_cover": 1.0}},
            }
        ],
    )

    def fake_download(scene, output_path, bbox):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, output_path)
        return output_path

    monkeypatch.setattr(server_module, "download_scene_rgb", fake_download)

    server = create_server(port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"
        request = Request(
            f"{base_url}/api/imagery",
            data=json.dumps({"bbox": [77.0, 28.0, 77.1, 28.1], "format": "geotiff"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
        assert payload["success"] is True
        assert payload["source"]["scene_id"] == "demo-scene"
        assert payload["download_url"].startswith("/api/file?path=jobs/")
        artifact = tmp_path / "jobs" / payload["artifact_id"] / "sentinel2_rgb.tif"
        assert artifact.is_file()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_upload_route_stores_and_inspects_raster(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(server_module, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(server_module, "JOBS_ROOT", tmp_path / "jobs")
    source_path = tmp_path / "source_rgb.tif"
    _write_test_rgb_raster(source_path)
    source = source_path.read_bytes()

    server = create_server(port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"
        request = Request(
            f"{base_url}/api/upload",
            data=source,
            headers={
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(source)),
                "X-Filename": "uploaded_demo.tif",
            },
            method="POST",
        )
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
        assert payload["filename"] == "uploaded_demo.tif"
        assert payload["input"]["kind"] == "georeferenced"
        assert payload["input"]["crs"]
        assert (tmp_path / payload["path"]).is_file()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_raster_inspection_and_reference_evaluation_routes(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(server_module, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(server_module, "JOBS_ROOT", tmp_path / "jobs")
    prediction = tmp_path / "data" / "prediction.tif"
    reference = tmp_path / "data" / "reference.tif"
    _write_test_raster(prediction, np.array([[10, 12, 14], [20, 22, 24], [30, 32, 34]], dtype=float))
    _write_test_raster(reference, np.array([[11, 13, 15], [21, 23, 25], [31, 33, 35]], dtype=float))

    server = create_server(port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base_url = f"http://127.0.0.1:{server.server_address[1]}"
        prediction_path = "data/prediction.tif"
        stats_url = f"{base_url}/api/raster-stats?path={quote(prediction_path)}"
        with urlopen(stats_url, timeout=5) as response:
            stats = json.loads(response.read().decode("utf-8"))
        assert stats["shape"] == [3, 3]
        assert stats["median"] == 22.0

        inspect_url = f"{base_url}/api/inspect?path={quote(prediction_path)}&x=1&y=1"
        with urlopen(inspect_url, timeout=5) as response:
            point = json.loads(response.read().decode("utf-8"))
        assert point["value_m"] == 22.0
        assert point["slope_degrees"] is not None
        assert point["crs"] == "EPSG:32643"

        request = Request(
            f"{base_url}/api/evaluate",
            data=json.dumps(
                {
                    "prediction_path": prediction_path,
                    "reference_path": "data/reference.tif",
                }
            ).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=5) as response:
            started = json.loads(response.read().decode("utf-8"))
        assert started["status"] in {"queued", "running", "complete"}

        for _ in range(20):
            with urlopen(f"{base_url}/api/jobs/{started['id']}", timeout=5) as response:
                job = json.loads(response.read().decode("utf-8"))
            if job["status"] in {"complete", "failed"}:
                break
            time.sleep(0.05)
        assert job["status"] == "complete"
        assert job["result"]["raster_metrics"]["mae_m"] == 1.0
        assert (tmp_path / job["result"]["report_path"]).is_file()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
