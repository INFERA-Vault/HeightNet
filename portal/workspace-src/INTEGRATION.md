# Workspace integration

This folder came from the UI branch and is now the main HeightNet control room.
It does not invent project data or show a fake terrain when no job has run.

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
workspace is the browser control room. Map acquisition, upload, 2D inspection,
and 3D terrain all use this same shell and the same backend job store.

## Sentinel timeline

Sentinel-2 is satellite imagery, not a live video feed. The map searches the
Microsoft Planetary Computer STAC catalog and sorts matching Sentinel-2 L2A
scenes by acquisition time. A recent scene is not guaranteed to exist every
day, and a strict cloud limit can make the newest usable scene older.

After an area is selected, the map can search:

```text
area + cloud limit + date range
  -> GET /api/scenes
  -> choose a dated capture
  -> POST /api/imagery with that selected scene
  -> run the HeightNet pipeline only when Build selected terrain is clicked
```

The timeline presets are only shortcuts for the date filter: Latest, Past 7
days, and Past 30 days. This makes before/after disaster work reproducible
because the scene date is visible before it is downloaded.

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

- Before a job runs, the UI shows an empty state instead of fake geographic
  output.
- GeoTIFF values are produced by the Python pipeline and are not parsed in the
  browser. The output links and the standalone viewer are the trusted path.
- The validation screen is ready, but meaningful accuracy numbers still need
  independent LiDAR, reference DSM, or GCP data from the user.
