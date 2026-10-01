# HeightNet workspace UI

This is the React workspace taken from the UI branch and connected to the
Python HeightNet pipeline.

The workspace is the control room. The Python server still does the real work:

```text
image upload
  -> Depth Anything V2 / GAMUS model
  -> relative depth
  -> SURE-Cal calibration and coarse DEM fusion
  -> AGL + DSM + confidence + uncertainty
  -> textured OBJ terrain
```

Before a job is run, the 3D screen shows a visual fallback so the controls do
not look empty. It is not real geographic output. After a job finishes, the
workspace opens the generated OBJ/MTL/texture in the repository's standalone
Three.js viewer.

## Start it

From the repository root:

```powershell
cd portal/workspace-src
npm install
npm run build
cd ../..
python scripts/serve_portal.py
```

Then open the main app:

```text
http://127.0.0.1:8000/
```

Choose a PNG, JPG, or GeoTIFF and click **Run model**. The same API is also
used by the classic portal at `/classic/` and the Cesium globe at `/globe/`.

## Important boundary

The browser does not decide model weights, calibration rules, CRS handling, or
DSM math. Those stay in `backend/` and `scripts/`. This prevents the UI from
silently inventing height values.

The output is still a research prototype. It needs independent LiDAR,
reference DSM, or GCP checks before accuracy claims are made.

More detail is in [`INTEGRATION.md`](INTEGRATION.md).
