# HeightNet portal

This is the first working local HeightNet portal.

The portal lets a user search for a place, select an area, download a Sentinel-2
RGB image, and send it through the existing model and terrain pipeline.

It provides a map, place search, area selection, Sentinel-2 scene search, local
image upload, background job status, output links, and a direct 3D viewer link.

Run it from the repository root:

```powershell
python scripts/serve_portal.py
```

Open `http://127.0.0.1:8000/` in a browser. Keep the terminal open while using
the portal.

The portal needs internet access for OpenStreetMap tiles, place search, and the
Planetary Computer STAC search. A real model run also needs the local model
checkpoint and the optional calibration files described in the main README.

- Map behaviour is in `portal/map/`.
- Screen styling and controls are in `portal/ui/`.
- Sentinel-2 lookup is in `backend/acquisition/`.
- The local API is in `backend/api/`.
- The existing standalone terrain viewer remains in `viewer/`.

The API has two acquisition paths: `/api/scenes` plus `/api/download` is the
main two-step flow, while `/api/imagery` is a compatibility route for the
standalone globe's one-click imagery button. Both paths use the same real
Planetary Computer Sentinel-2 downloader.

The imported React workspace lives in `portal/workspace-src/`. Build it with
`npm install` and `npm run build` from that directory, then open
`http://127.0.0.1:8000/workspace/`. It calls the same Python API as this
portal. Its procedural terrain is only a pre-run preview; after a successful
job it opens the real OBJ/MTL/texture output from the Python pipeline.

The model does not make accuracy claims without independent LiDAR, reference
DSM, or GCP validation.
