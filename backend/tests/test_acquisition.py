from __future__ import annotations

import pytest

from backend.acquisition.stac import AcquisitionError, validate_bbox


def test_validate_bbox_accepts_wgs84_order() -> None:
    assert validate_bbox((77.1, 30.1, 77.2, 30.2)) == (77.1, 30.1, 77.2, 30.2)


@pytest.mark.parametrize(
    "bbox",
    [
        (77.2, 30.1, 77.1, 30.2),
        (77.1, 30.2, 77.2, 30.1),
        (181, 30.1, 182, 30.2),
        (77.1, 91, 77.2, 92),
    ],
)
def test_validate_bbox_rejects_bad_order_or_range(bbox: tuple[float, ...]) -> None:
    with pytest.raises(AcquisitionError):
        validate_bbox(bbox)
