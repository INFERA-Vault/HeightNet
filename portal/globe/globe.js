(function () {
  const $ = (id) => document.getElementById(id);
  let viewer;
  let selectionMode = false;
  let corners = [];
  let rectangleEntity = null;
  let selectedBbox = null;
  let inputPath = null;
  let texturePath = null;

  function setText(id, value) { $(id).textContent = value; }

  async function api(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || 'Request failed.');
    return payload;
  }

  function pointFromClick(position) {
    const cartesian = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
    if (!cartesian) return null;
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    return {
      lon: Cesium.Math.toDegrees(cartographic.longitude),
      lat: Cesium.Math.toDegrees(cartographic.latitude),
    };
  }

  function formatBbox(bbox) { return bbox.map((value) => Number(value).toFixed(5)).join(', '); }

  function showBbox(bbox) {
    selectedBbox = bbox;
    setText('selection', `Area selected:\n[${formatBbox(bbox)}]`);
    $('clear-area').disabled = false;
    $('download-imagery').disabled = false;
  }

  function clearArea() {
    corners = [];
    selectedBbox = null;
    selectionMode = false;
    if (rectangleEntity) viewer.entities.remove(rectangleEntity);
    rectangleEntity = null;
    $('clear-area').disabled = true;
    $('download-imagery').disabled = true;
    $('run-pipeline').disabled = true;
    setText('selection', 'No area selected.');
    setText('imagery-status', 'Waiting for an area.');
  }

  function finishArea() {
    const west = Math.min(corners[0].lon, corners[1].lon);
    const east = Math.max(corners[0].lon, corners[1].lon);
    const south = Math.min(corners[0].lat, corners[1].lat);
    const north = Math.max(corners[0].lat, corners[1].lat);
    if (east - west < 0.001 || north - south < 0.001) {
      setText('selection', 'Area is too small. Click farther apart.');
      corners = [];
      return;
    }
    const bbox = [west, south, east, north];
    rectangleEntity = viewer.entities.add({
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(west, south, east, north),
        material: Cesium.Color.CYAN.withAlpha(.25),
        outline: true,
        outlineColor: Cesium.Color.CYAN,
        height: 0,
      },
    });
    showBbox(bbox);
    selectionMode = false;
    corners = [];
  }

  async function searchPlaces() {
    const query = $('place-query').value.trim();
    const target = $('place-results');
    if (!query) return;
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
        button.textContent = 'Go there';
        button.onclick = () => viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(Number(place.lon), Number(place.lat), 45000),
        });
        card.append(title, button);
        target.appendChild(card);
      });
    } catch (error) { target.textContent = `Error: ${error.message}`; }
  }

  async function downloadImagery() {
    if (!selectedBbox) return;
    $('download-imagery').disabled = true;
    setText('imagery-status', 'Searching and downloading Sentinel-2 RGB...');
    try {
      const data = await api('/api/imagery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bbox: selectedBbox,
          format: 'geotiff',
          max_cloud_cover: Number($('cloud-cover').value || 30),
        }),
      });
      inputPath = data.file;
      texturePath = data.visual_file || null;
      $('run-pipeline').disabled = false;
      setText('imagery-status', `RGB GeoTIFF ready.\nScene: ${data.source.scene_id}\nCRS: ${data.crs}`);
      const link = document.createElement('a');
      link.href = data.download_url;
      link.target = '_blank';
      link.textContent = 'Open downloaded GeoTIFF';
      $('imagery-status').appendChild(document.createElement('br'));
      $('imagery-status').appendChild(link);
    } catch (error) {
      setText('imagery-status', `Error: ${error.message}`);
      $('download-imagery').disabled = false;
    }
  }

  function fileLink(path) {
    const link = document.createElement('a');
    link.href = `/api/file?path=${encodeURIComponent(path)}`;
    link.target = '_blank';
    link.textContent = path;
    return link;
  }

  function renderOutputs(result) {
    const target = $('outputs');
    target.textContent = '';
    ['relative', 'agl', 'dsm', 'confidence', 'uncertainty'].forEach((key) => {
      if (!result[key]) return;
      const row = document.createElement('div');
      row.className = 'result-card';
      const label = document.createElement('strong');
      label.textContent = key.toUpperCase();
      row.append(label, fileLink(result[key]));
      target.appendChild(row);
    });
    if (result.mesh) {
      const query = new URLSearchParams({
        obj: `/api/file?path=${result.mesh}`,
        mtl: result.material ? `/api/file?path=${result.material}` : '',
        texture: result.texture ? `/api/file?path=${result.texture}` : '',
        metadata: result.mesh_metadata ? `/api/file?path=${result.mesh_metadata}` : '',
      });
      const link = document.createElement('a');
      link.href = `/viewer/?${query.toString()}`;
      link.target = '_blank';
      link.textContent = 'Open generated terrain in 3D viewer';
      const row = document.createElement('div');
      row.className = 'result-card';
      row.append(link);
      target.appendChild(row);
    }
  }

  async function runPipeline() {
    if (!inputPath) return;
    $('run-pipeline').disabled = true;
    setText('job-status', 'Starting the model pipeline...');
    try {
      const started = await api('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_path: inputPath, texture_path: texturePath }),
      });
      for (;;) {
        const job = await api(`/api/jobs/${started.id}`);
        setText('job-status', `${job.status}\n${job.message}`);
        if (job.status === 'complete') { renderOutputs(job.result); return; }
        if (job.status === 'failed') throw new Error(job.message);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (error) {
      setText('job-status', `Error: ${error.message}`);
      $('run-pipeline').disabled = false;
    }
  }

  function init() {
    viewer = new Cesium.Viewer('globe', {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      timeline: false,
      navigationHelpButton: false,
      baseLayer: false,
    });
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 19,
      credit: 'Esri World Imagery',
    }));
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 18000000),
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      if (!selectionMode) return;
      const point = pointFromClick(click.position);
      if (!point) return;
      corners.push(point);
      if (corners.length === 1) setText('selection', `First corner: ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}\nNow click the opposite corner.`);
      if (corners.length === 2) finishArea();
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    $('select-area').onclick = () => {
      selectionMode = true;
      corners = [];
      setText('selection', 'Selection mode on. Click the first corner on the globe.');
    };
    $('clear-area').onclick = clearArea;
    $('search-place').onclick = searchPlaces;
    $('place-query').onkeydown = (event) => { if (event.key === 'Enter') searchPlaces(); };
    $('download-imagery').onclick = downloadImagery;
    $('run-pipeline').onclick = runPipeline;
  }

  init();
}());
