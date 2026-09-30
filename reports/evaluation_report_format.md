# Evaluation report format

This is the format the future portal can show after the map, satellite search,
and basic UI are connected.

## Summary

- Location
- Input image
- Prediction product
- Reference source
- Validation type: GAMUS, LiDAR, reference DSM, or GCP
- Validation status

## Numbers

- MAE in metres
- RMSE in metres
- Correlation
- Mean height bias
- Number of compared pixels or points

## Context

- CRS
- Resolution
- Height datum
- Scene or land-cover category
- Notes about missing or invalid data

Missing values must be shown as `Not available`, never as zero.
