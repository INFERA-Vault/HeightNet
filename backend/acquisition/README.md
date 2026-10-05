# Data acquisition and source discovery

This folder handles data that comes from outside the model.

The live portal does four things:

- searches Sentinel-2 L2A scenes for the selected map rectangle
- downloads the RGB GeoTIFF chosen by the user
- finds a coarse ground baseline for a georeferenced run
- checks whether an independent LiDAR, reference DSM, or surveyed GCP source is known for the same area

The source check is available at:

```text
GET /api/reference-availability?bbox=min_lon,min_lat,max_lon,max_lat
```

Every result is assigned a role:

- `optical_input`: the RGB image sent into HeightNet
- `coarse_ground`: NASADEM, SRTM, CartoDEM, or another low-resolution ground baseline used to compose a metric DSM
- `validation_reference`: independent LiDAR, DSM, or equivalent data used only for scoring
- `calibration_reference`: surveyed GCPs that can be used for calibration and held-out testing

This separation matters. A global DEM can help create the first metric estimate,
but it is not independent proof that the estimate is accurate. Each pipeline
job writes a `*_source_manifest.json` file with the selected source, AOI,
available reference candidates, and the rules used for the run.

The public OpenTopography catalog is queried by AOI rather than downloading
its whole catalog. Indian project sources that need registration or a data
request are shown honestly as `request_required` instead of being presented as
automatic downloads. Global products found in that catalog are shown as
`catalog_match` coarse options; the live automatic fallback remains NASADEM
through Planetary Computer.
