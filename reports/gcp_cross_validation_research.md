# GCP cross-validation plan

## What a GCP is

A Ground Control Point is a location where a trusted survey or reference source
already gives us the real height. We sample our predicted raster at that same
location and compare the two values.

## Suggested fields

The current CSV should use at least:

- `id`
- `x`
- `y`
- `reference_m`
- `crs`
- `height_type`
- `surface_class`
- `notes`

The existing evaluator expects `x`, `y`, and `reference_m` in the prediction
raster CRS. Latitude and longitude should only be used after a clear conversion
to that CRS.

## Calibration versus testing

Calibration points are allowed to influence a correction. Testing points must
remain separate and untouched until the final comparison.

Using the same points for both jobs makes the result look better than it really
is and is not a fair validation.

## Suggested process

1. Check that the points and raster use compatible coordinates.
2. Remove incomplete or invalid points.
3. Split the points into calibration and holdout groups.
4. Fit any correction using only calibration points.
5. Sample the prediction at holdout points.
6. Compare holdout prediction and reference heights.
7. Report MAE, RMSE, correlation, bias, and point count.
8. Record the split seed and the height type.

If enough points exist, repeat with different splits and report the spread of
the results.

## Important limitation

This document is a plan. It does not prove that the current output has been
validated. Real surveyed points must be supplied before making that claim.
