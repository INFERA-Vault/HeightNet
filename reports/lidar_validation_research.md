# LiDAR and reference DSM validation plan

## Why this matters

The current Dehradun output is a working demo, not proof that the heights are
correct. A LiDAR DSM or trusted reference DSM gives us an independent surface
to compare against.

## What we need

- A reference elevation raster or point cloud for the same area as the RGB input.
- Its CRS, resolution, vertical datum, and units.
- A licence that allows student or research use.
- Enough overlap with the predicted DSM to make a fair comparison.

Useful formats include GeoTIFF for a raster DSM and LAS/LAZ for a LiDAR point
cloud. A point cloud would need to be converted into a DSM before comparison.

## Safe comparison process

1. Confirm that prediction and reference cover the same location.
2. Reproject the reference onto the prediction grid.
3. Confirm that both surfaces use the same height meaning and units.
4. Remove nodata and non-finite pixels.
5. Compare only the overlapping valid area.
6. Report sample count, MAE, RMSE, correlation, and mean bias.
7. Keep the source, CRS, resolution, and resampling method in the report.

## Scene breakdown

If a land-cover map is available, report results separately for urban areas,
open ground, vegetation, and hilly areas. If it is not available, say that the
breakdown was not performed.

## Important limitation

Do not call a new location LiDAR validated until an independent reference has
actually been aligned and compared. The Dehradun demo currently has no such
local validation.

## Future report fields

- Location
- Prediction file
- Reference file
- Reference source and licence
- CRS and resolution
- Height datum
- Valid sample count
- MAE
- RMSE
- Correlation
- Bias
- Scene or land-cover notes
