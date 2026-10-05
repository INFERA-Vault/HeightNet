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

The workspace does not invent a mountain or raster when no data is loaded. It
shows a clear empty state until the user uploads an image or runs a map job.
After a job finishes, the workspace loads the generated OBJ/MTL/texture as
real output in its 3D view.

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

Use **Map Acquisition** to search for a place, select a small area, download a
Sentinel-2 RGB GeoTIFF, and run the pipeline. You can also choose **Upload**
to run the pipeline directly on a PNG, JPG, or GeoTIFF.

The old `/globe/` URL is kept only as a compatibility redirect into Map
Acquisition. The old `/classic/` portal remains available as a fallback, but
it is not a second main product.

## Important boundary

The browser does not decide model weights, calibration rules, CRS handling, or
DSM math. Those stay in `backend/` and `scripts/`. This prevents the UI from
silently inventing height values.

The output is still a research prototype. It needs independent LiDAR,
reference DSM, or GCP checks before accuracy claims are made.

More detail is in [`INTEGRATION.md`](INTEGRATION.md).
