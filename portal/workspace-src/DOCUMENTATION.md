# Workspace notes

## What this frontend does

The workspace gives us a clean browser surface for:

- switching between a flat view and a 3D view
- showing the available output layers
- uploading one input image
- starting the real HeightNet job
- opening the generated terrain

## What the backend does

The Python service owns the important decisions. The frontend does not train a
model and does not calculate heights itself.

1. `POST /api/upload` stores and checks the input image.
2. `POST /api/process` starts `scripts/run_pipeline.py`.
3. `GET /api/jobs/<id>` reports progress until the job ends.
4. The result contains the relative depth, AGL, DSM, confidence,
   uncertainty, metadata, and mesh files.
5. The standalone viewer loads the real OBJ, MTL, texture, and metadata.

## Why there is a fallback mountain

The original UI branch was built before the model connection. Its empty-state
3D scene uses procedural noise so the controls can be tested without a file.
It is deliberately kept as a preview only. It must not be used in a demo as if
it were a prediction.

## Run

```powershell
cd portal/workspace-src
npm install
npm run build
cd ../..
python scripts/serve_portal.py
```

Open `http://127.0.0.1:8000/workspace/`.

For the actual data and model setup, read the repository root files:
`GETTING_STARTED.md`, `DATA_AND_MODELS.md`, and `FEATURE_STATUS.md`.
