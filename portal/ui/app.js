(function () {
  const $ = (id) => document.getElementById(id);
  let bbox = null;
  let selectedScene = null;
  let inputPath = null;
  let texturePath = null;

  function setText(id, value) {
    $(id).textContent = value;
  }

  async function api(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || 'Request failed.');
    return payload;
  }

  function formatBbox(values) {
    return values.map((value) => Number(value).toFixed(5)).join(', ');
  }

  function showError(target, error) {
    target.textContent = `Error: ${error.message || error}`;
  }

  function showSelection(message) {
    setText('selection', message || (bbox ? `Bounding box: ${formatBbox(bbox)}` : 'No area selected yet.'));
  }

  async function searchPlaces() {
    const query = $('place-query').value.trim();
    const target = $('place-results');
    target.textContent = 'Searching...';
    try {
      const data = await api(`/api/geocode?q=${encodeURIComponent(query)}`);
      target.textContent = '';
      if (!data.results.length) { target.textContent = 'No places found.'; return; }
      data.results.forEach((place) => {
        const card = document.createElement('div');
        card.className = 'result-card';
        const title = document.createElement('strong');
        title.textContent = place.display_name;
        const button = document.createElement('button');
        button.textContent = 'Show on map';
        button.onclick = () => HeightNetMap.focus(place.lat, place.lon, 12);
        card.append(title, button);
        target.appendChild(card);
      });
    } catch (error) { showError(target, error); }
  }

  async function findScenes() {
    if (!bbox) { setText('scene-results', 'Select an area first.'); return; }
    const target = $('scene-results');
    target.textContent = 'Searching Planetary Computer...';
    try {
      const cloud = Number($('cloud-cover').value || 30);
      const data = await api(`/api/scenes?bbox=${encodeURIComponent(bbox.join(','))}&cloud=${cloud}&limit=8`);
      target.textContent = '';
      if (!data.scenes.length) { target.textContent = 'No scenes found. Try a larger area or a higher cloud limit.'; return; }
      data.scenes.forEach((scene) => {
        const card = document.createElement('div');
        card.className = 'result-card';
        const title = document.createElement('strong');
        title.textContent = scene.scene_id || 'Sentinel-2 scene';
        const details = document.createElement('div');
        const cloudText = scene.cloud_cover == null ? 'unknown' : `${Number(scene.cloud_cover).toFixed(1)}%`;
        details.className = 'muted';
        details.textContent = `Date: ${scene.capture_date || 'unknown'} | Cloud: ${cloudText}`;
        const button = document.createElement('button');
        button.textContent = 'Use this scene';
        button.onclick = () => {
          selectedScene = scene;
          inputPath = null;
          texturePath = null;
          $('download-scene').disabled = false;
          $('run-pipeline').disabled = true;
          setText('input-status', `Selected scene: ${scene.scene_id}. Click Download selected scene.`);
        };
        card.append(title, details, button);
        target.appendChild(card);
      });
    } catch (error) { showError(target, error); }
  }

  async function uploadFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    setText('input-status', `Uploading ${file.name}...`);
    try {
      const data = await api('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': file.name },
        body: file
      });
      selectedScene = null;
      inputPath = data.path;
      texturePath = null;
      setText('input-status', `${file.name}\nType: ${data.input.kind}\nCRS: ${data.input.crs || 'none'}`);
      $('run-pipeline').disabled = false;
    } catch (error) { showError($('input-status'), error); }
  }

  async function downloadScene() {
    if (!selectedScene || !bbox) return;
    setText('job-status', 'Starting RGB download...');
    try {
      const job = await api('/api/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scene: selectedScene, bbox }) });
      await pollJob(job.id, (result) => {
        inputPath = result.input_path;
        texturePath = result.texture_path || null;
        setText('input-status', `Downloaded ${selectedScene.scene_id}\nRGB GeoTIFF is ready.`);
        $('run-pipeline').disabled = false;
      });
    } catch (error) { setText('job-status', `Error: ${error.message}`); }
  }

  async function runPipeline() {
    if (!inputPath) return;
    setText('job-status', 'Starting the height pipeline...');
    $('run-pipeline').disabled = true;
    try {
      const job = await api('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_path: inputPath, texture_path: texturePath }),
      });
      await pollJob(job.id, renderOutputs);
    } catch (error) {
      setText('job-status', `Error: ${error.message}`);
      $('run-pipeline').disabled = false;
    }
  }

  async function loadEvaluation() {
    const target = $('evaluation-results');
    target.textContent = 'Loading reports...';
    try {
      const data = await api('/api/evaluation');
      target.textContent = '';
      if (!data.rows.length) { target.textContent = 'No evaluation reports found.'; return; }
      const header = document.createElement('div');
      header.className = 'evaluation-row';
      header.innerHTML = '<strong>Report</strong><strong>Scope</strong><strong>MAE</strong><strong>RMSE</strong><strong>R2</strong>';
      target.appendChild(header);
      data.rows.slice(0, 30).forEach((row) => {
        const line = document.createElement('div');
        line.className = 'evaluation-row';
        [row.report, row.scope, row.mae, row.rmse, row.r2].forEach((value) => {
          const cell = document.createElement('span');
          cell.textContent = value || 'Not available';
          line.appendChild(cell);
        });
        target.appendChild(line);
      });
    } catch (error) { showError(target, error); }
  }

  async function pollJob(jobId, onComplete) {
    for (;;) {
      const job = await api(`/api/jobs/${jobId}`);
      setText('job-status', `${job.kind}: ${job.status}\n${job.message}`);
      if (job.status === 'complete') { onComplete(job.result); return; }
      if (job.status === 'failed') throw new Error(job.message);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  function renderOutputs(result) {
    setText('job-status', 'Terrain generation complete.');
    const target = $('outputs');
    target.textContent = '';
    Object.entries(result).forEach(([key, value]) => {
      if (!value || key.endsWith('_log') || key === 'log') return;
      const row = document.createElement('div');
      row.className = 'result-card';
      const label = document.createElement('strong');
      label.textContent = key.toUpperCase();
      const link = document.createElement('a');
      link.href = `/api/file?path=${encodeURIComponent(value)}`;
      link.textContent = value;
      link.target = '_blank';
      row.append(label, link);
      target.appendChild(row);
    });

    if (result.mesh) {
      const viewer = document.createElement('div');
      viewer.className = 'result-card viewer-action';
      const title = document.createElement('strong');
      title.textContent = '3D VIEWER';
      const link = document.createElement('a');
      const query = new URLSearchParams({
        obj: `/api/file?path=${result.mesh}`,
        mtl: result.material ? `/api/file?path=${result.material}` : '',
        texture: result.texture ? `/api/file?path=${result.texture}` : '',
        metadata: result.mesh_metadata ? `/api/file?path=${result.mesh_metadata}` : ''
      });
      link.href = `/viewer/?${query.toString()}`;
      link.textContent = 'Open generated terrain in the 3D viewer';
      link.target = '_blank';
      viewer.append(title, link);
      target.appendChild(viewer);
    }
  }

  HeightNetMap.onAreaSelected((newBbox, message) => {
    if (newBbox) bbox = newBbox;
    showSelection(message ? `${message}\n${bbox ? formatBbox(bbox) : ''}` : null);
  });
  $('search-place').onclick = searchPlaces;
  $('place-query').onkeydown = (event) => { if (event.key === 'Enter') searchPlaces(); };
  $('select-area').onclick = () => HeightNetMap.startSelection();
  $('find-scenes').onclick = findScenes;
  $('upload-input').onchange = uploadFile;
  $('download-scene').onclick = downloadScene;
  $('run-pipeline').onclick = runPipeline;
  $('load-evaluation').onclick = loadEvaluation;

  api('/api/health').then(() => setText('health', 'Local server ready')).catch(() => setText('health', 'Start the local server first'));
}());
