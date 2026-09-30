/* Small, dependency-light map behaviour for the HeightNet portal. */
(function () {
  const map = L.map('map', { zoomControl: true }).setView([22.5, 79.0], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  let selectionMode = false;
  let firstCorner = null;
  let rectangle = null;
  let marker = null;
  let callback = function () {};

  const coordinateControl = L.control({ position: 'bottomright' });
  coordinateControl.onAdd = function () {
    const element = L.DomUtil.create('div', 'map-coordinates');
    element.textContent = 'Move over the map for coordinates';
    return element;
  };
  coordinateControl.addTo(map);
  map.on('mousemove', function (event) {
    const element = document.querySelector('.map-coordinates');
    if (element) element.textContent = `${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`;
  });

  function boundsToBbox(bounds) {
    return [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ];
  }

  map.on('click', function (event) {
    if (!selectionMode) return;
    if (!firstCorner) {
      firstCorner = event.latlng;
      if (rectangle) map.removeLayer(rectangle);
      rectangle = L.rectangle([firstCorner, firstCorner], {
        color: '#21c7a8',
        weight: 2,
        fillOpacity: 0.15
      }).addTo(map);
      callback(null, 'First corner selected. Click the opposite corner.');
      return;
    }
    const secondCorner = event.latlng;
    const bounds = L.latLngBounds(firstCorner, secondCorner);
    if (rectangle) map.removeLayer(rectangle);
    rectangle = L.rectangle(bounds, {
      color: '#21c7a8',
      weight: 2,
      fillOpacity: 0.15
    }).addTo(map);
    selectionMode = false;
    firstCorner = null;
    callback(boundsToBbox(bounds), 'Area selected.');
  });

  window.HeightNetMap = {
    startSelection: function () {
      selectionMode = true;
      firstCorner = null;
      callback(null, 'Click the first corner on the map.');
    },
    onAreaSelected: function (fn) {
      callback = fn;
    },
    focus: function (lat, lon, zoom) {
      map.setView([lat, lon], zoom || 12);
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lon]).addTo(map);
    },
    setArea: function (bbox) {
      const bounds = L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]]);
      if (rectangle) map.removeLayer(rectangle);
      rectangle = L.rectangle(bounds, { color: '#21c7a8', weight: 2, fillOpacity: 0.15 }).addTo(map);
      map.fitBounds(bounds.pad(0.25));
      callback(bbox, 'Area selected from search result.');
    }
  };
}());
