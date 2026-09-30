"""Small Planetary Computer helpers for map-driven Sentinel-2 acquisition."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import tempfile
from typing import Any, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from backend.data.sentinel2 import download_sentinel2_rgb, download_sentinel2_visual


STAC_API = "https://planetarycomputer.microsoft.com/api/stac/v1"
GEOCODER_API = "https://nominatim.openstreetmap.org/search"


class AcquisitionError(RuntimeError):
    """Raised when a remote search or download cannot be completed."""


def validate_bbox(values: Sequence[float]) -> tuple[float, float, float, float]:
    """Validate a WGS84 bbox in min-lon, min-lat, max-lon, max-lat order."""

    if len(values) != 4:
        raise AcquisitionError("A bbox needs four values: min_lon,min_lat,max_lon,max_lat.")
    min_lon, min_lat, max_lon, max_lat = map(float, values)
    if not (-180 <= min_lon < max_lon <= 180):
        raise AcquisitionError("Longitude values must be ordered and within -180 to 180.")
    if not (-90 <= min_lat < max_lat <= 90):
        raise AcquisitionError("Latitude values must be ordered and within -90 to 90.")
    return min_lon, min_lat, max_lon, max_lat


def _request_json(
    url: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body = None
    headers = {"User-Agent": "HeightNet/0.1 local student project"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise AcquisitionError(f"Remote request failed: {exc}") from exc


def geocode_place(query: str, *, limit: int = 5) -> list[dict[str, Any]]:
    """Find places through the public OpenStreetMap Nominatim service."""

    cleaned = query.strip()
    if not cleaned:
        raise AcquisitionError("Enter a place name before searching.")
    params = urlencode({"q": cleaned, "format": "jsonv2", "limit": limit})
    response = _request_json(f"{GEOCODER_API}?{params}")
    if not isinstance(response, list):
        raise AcquisitionError("The place search returned an unexpected response.")
    return [
        {
            "display_name": item.get("display_name", "Unknown place"),
            "lat": float(item["lat"]),
            "lon": float(item["lon"]),
            "type": item.get("type"),
        }
        for item in response
        if "lat" in item and "lon" in item
    ]


def _scene_url(feature: dict[str, Any]) -> str:
    for link in feature.get("links", []):
        if link.get("rel") == "self" and link.get("href"):
            return str(link["href"])
    collection = feature.get("collection", "sentinel-2-l2a")
    return f"{STAC_API}/collections/{collection}/items/{feature['id']}"


def _scene_summary(feature: dict[str, Any]) -> dict[str, Any]:
    properties = feature.get("properties", {})
    assets = feature.get("assets", {})
    asset_keys = [key for key in ("B04", "B03", "B02") if key in assets]
    return {
        "scene_id": feature.get("id"),
        "capture_date": properties.get("datetime") or properties.get("start_datetime"),
        "cloud_cover": properties.get("eo:cloud_cover"),
        "bbox": feature.get("bbox"),
        "item_url": _scene_url(feature),
        "rgb_assets": asset_keys,
        "feature": feature,
    }


def search_sentinel2_scenes(
    bbox: Sequence[float],
    *,
    max_cloud: float = 30.0,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Search Sentinel-2 L2A scenes intersecting a WGS84 bbox."""

    validated = validate_bbox(bbox)
    if not 0 <= float(max_cloud) <= 100:
        raise AcquisitionError("Cloud cover must be between 0 and 100.")
    payload = {
        "collections": ["sentinel-2-l2a"],
        "bbox": list(validated),
        "limit": max(1, min(int(limit), 50)),
        "query": {"eo:cloud_cover": {"lte": float(max_cloud)}},
        "sortby": [{"field": "properties.datetime", "direction": "desc"}],
    }
    response = _request_json(f"{STAC_API}/search", method="POST", payload=payload)
    features = response.get("features", [])
    scenes = []
    for feature in features:
        summary = _scene_summary(feature)
        if len(summary["rgb_assets"]) == 3:
            scenes.append(summary)
    return scenes


def download_scene_rgb(
    scene: dict[str, Any],
    output_path: str | Path,
    *,
    bbox: Sequence[float] | None = None,
) -> Path:
    """Download B04/B03/B02 for a searched scene into one RGB GeoTIFF."""

    feature = scene.get("feature")
    if not isinstance(feature, dict):
        raise AcquisitionError("The selected scene does not contain STAC feature data.")
    bbox_value = validate_bbox(bbox) if bbox is not None else None
    with tempfile.TemporaryDirectory(prefix="heightnet-stac-") as temporary:
        item_path = Path(temporary) / "item.json"
        item_path.write_text(json.dumps(feature), encoding="utf-8")
        try:
            return download_sentinel2_rgb(
                item_path,
                output_path,
                bbox_wgs84=bbox_value,
            )
        except Exception as exc:
            raise AcquisitionError(f"RGB download failed: {exc}") from exc


def download_scene_visual(
    scene: dict[str, Any],
    output_path: str | Path,
    *,
    bbox: Sequence[float] | None = None,
) -> Path:
    """Download the STAC rendered visual asset for terrain texturing."""

    feature = scene.get("feature")
    if not isinstance(feature, dict):
        raise AcquisitionError("The selected scene does not contain STAC feature data.")
    bbox_value = validate_bbox(bbox) if bbox is not None else None
    with tempfile.TemporaryDirectory(prefix="heightnet-stac-visual-") as temporary:
        item_path = Path(temporary) / "item.json"
        item_path.write_text(json.dumps(feature), encoding="utf-8")
        try:
            return download_sentinel2_visual(
                item_path,
                output_path,
                bbox_wgs84=bbox_value,
            )
        except Exception as exc:
            raise AcquisitionError(f"Visual texture download failed: {exc}") from exc


@dataclass(frozen=True)
class SceneRequest:
    """Serializable description of a map-selected satellite request."""

    bbox: tuple[float, float, float, float]
    max_cloud: float = 30.0
    limit: int = 10
