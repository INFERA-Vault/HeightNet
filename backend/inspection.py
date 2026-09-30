"""Small raster inspection helpers used by the local portal."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np


class RasterInspectionError(ValueError):
    """Raised when a raster cannot be inspected safely."""


def _open_raster(path: str | Path):
    try:
        import rasterio
    except ImportError as exc:  # pragma: no cover - dependency is in project installs
        raise RasterInspectionError("Raster inspection requires Rasterio.") from exc
    try:
        return rasterio.open(path)
    except Exception as exc:
        raise RasterInspectionError(f"Could not open raster: {exc}") from exc


def raster_stats(path: str | Path) -> dict[str, Any]:
    """Return compact, JSON-safe statistics for the first raster band."""

    with _open_raster(path) as dataset:
        values = dataset.read(1, masked=True).filled(np.nan).astype(np.float64)
        valid = values[np.isfinite(values)]
        if valid.size == 0:
            raise RasterInspectionError("Raster has no finite values.")
        percentiles = np.percentile(valid, [1, 50, 99])
        return {
            "path": str(path),
            "shape": [dataset.height, dataset.width],
            "count": dataset.count,
            "dtype": str(dataset.dtypes[0]),
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "transform": [float(value) for value in dataset.transform],
            "nodata": dataset.nodata,
            "valid_fraction": float(valid.size / values.size),
            "min": float(np.min(valid)),
            "p01": float(percentiles[0]),
            "median": float(percentiles[1]),
            "p99": float(percentiles[2]),
            "max": float(np.max(valid)),
            "mean": float(np.mean(valid)),
            "std": float(np.std(valid)),
        }


def inspect_raster(
    path: str | Path,
    x: float,
    y: float,
    *,
    coordinate_mode: str = "pixel",
) -> dict[str, Any]:
    """Read one height value and a local slope estimate.

    Pixel mode expects ``x=column`` and ``y=row``. Map mode expects coordinates
    in the raster CRS. Slope is calculated from a small local window in degrees.
    """

    if coordinate_mode not in {"pixel", "map"}:
        raise RasterInspectionError("coordinate_mode must be 'pixel' or 'map'.")
    try:
        import rasterio
    except ImportError as exc:  # pragma: no cover
        raise RasterInspectionError("Raster inspection requires Rasterio.") from exc

    with _open_raster(path) as dataset:
        if coordinate_mode == "pixel":
            col, row = int(round(float(x))), int(round(float(y)))
        else:
            row, col = dataset.index(float(x), float(y))
        if not (0 <= row < dataset.height and 0 <= col < dataset.width):
            raise RasterInspectionError("Inspection point is outside the raster.")

        value = float(dataset.read(1, window=((row, row + 1), (col, col + 1)))[0, 0])
        if not np.isfinite(value) or (
            dataset.nodata is not None and np.isclose(value, dataset.nodata)
        ):
            raise RasterInspectionError("Inspection point contains NoData.")

        row_start, row_stop = max(0, row - 1), min(dataset.height, row + 2)
        col_start, col_stop = max(0, col - 1), min(dataset.width, col + 2)
        window = dataset.read(
            1,
            window=((row_start, row_stop), (col_start, col_stop)),
            masked=True,
        ).filled(np.nan).astype(np.float64)
        local_slope = None
        if np.isfinite(window).all() and window.shape[0] >= 2 and window.shape[1] >= 2:
            y_spacing = abs(float(dataset.transform.e)) or 1.0
            x_spacing = abs(float(dataset.transform.a)) or 1.0
            gradient_y, gradient_x = np.gradient(window, y_spacing, x_spacing)
            local_row = row - row_start
            local_col = col - col_start
            if 0 <= local_row < gradient_y.shape[0] and 0 <= local_col < gradient_y.shape[1]:
                slope_ratio = float(
                    np.hypot(gradient_x[local_row, local_col], gradient_y[local_row, local_col])
                )
                local_slope = float(np.degrees(np.arctan(slope_ratio)))

        map_x, map_y = dataset.transform @ (col + 0.5, row + 0.5)
        return {
            "path": str(path),
            "row": row,
            "column": col,
            "value_m": value,
            "slope_degrees": local_slope,
            "map_x": float(map_x),
            "map_y": float(map_y),
            "crs": dataset.crs.to_string() if dataset.crs else None,
        }
