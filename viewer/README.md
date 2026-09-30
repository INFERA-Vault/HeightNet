# HeightNet viewer

Run this from the repository root so the browser can load the bundled mesh:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/viewer/`. Open it from a generated portal job, or
choose the matching OBJ, MTL, texture PNG, and metadata JSON files.

For another mesh, choose the matching `.obj`, `.mtl`, texture `.png`, and
metadata `.json` files together. The viewer uses Three.js OBJ/MTL loaders and
OrbitControls; the companion files must remain together.
