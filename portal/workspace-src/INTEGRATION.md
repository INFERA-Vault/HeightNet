# Workspace integration

This folder came from the UI branch, but the original branch used made-up
project data and a procedural mountain. That is not the real HeightNet result.

The live panel now uses the repository API:

```text
choose image
  -> POST /api/upload
  -> POST /api/process
  -> poll GET /api/jobs/<id>
  -> open /viewer/?obj=... with the real OBJ, MTL, texture, and metadata
```

After a run, the panel can also:

```text
generated DSM
  -> click the 2D raster for height + local slope
  -> upload a reference DSM or GCP CSV
  -> POST /api/evaluate
  -> show MAE, RMSE, bias, correlation, and the saved JSON report
```

The Python API remains the only place that decides how the model runs. The
workspace is just the browser control room. This keeps one pipeline for the
simple portal, the Cesium globe, and the React workspace.

## Run it

From the repository root:

```powershell
cd portal/workspace-src
npm install
npm run build
cd ../..
python scripts/serve_portal.py
```

Open `http://127.0.0.1:8000/workspace/`.

## Honest limitations

- The old procedural mountain remains only as a visual fallback before a job
  has been run.
- GeoTIFF values are produced by the Python pipeline and are not parsed in the
  browser. The output links and the standalone viewer are the trusted path.
- The validation screen is ready, but meaningful accuracy numbers still need
  independent LiDAR, reference DSM, or GCP data from the user.
