import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useViewportStore } from '../../state/viewportStore';
import { useLayerStore } from '../../state/layerStore';
import { useProjectStore } from '../../state/projectStore';
import { inspectRaster } from '../../integration/api';
import {
  generateSatelliteCanvas,
  generateDepthMapCanvas,
  generateHypsometricCanvas,
  getElevationMeters,
  getGeoCoordinates,
} from '../noise/terrainNoise';

interface RasterRendererProps {
  width?: number;
  height?: number;
}

export const RasterRenderer: React.FC<RasterRendererProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenSatelliteRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenDepthRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenHypsometricRef = useRef<HTMLCanvasElement | null>(null);
  const liveRasterRef = useRef<HTMLImageElement | null>(null);
  const [liveRasterReady, setLiveRasterReady] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const {
    viewport2D,
    setZoom2D,
    setPan2D,
    zoomAtPoint2D,
    setCursorReadout,
    addMeasurePoint2D,
  } = useViewportStore();

  const layers = useLayerStore((state) => state.layers);
  const liveRasterUrl = useProjectStore((state) => state.project.sourceRasterUrl);
  const project = useProjectStore((state) => state.project);
  const originalLayer = layers.find((l) => l.id === 'layer-raster-original');
  const depthLayer = layers.find((l) => l.id === 'layer-depth-map');
  const contoursLayer = layers.find((l) => l.id === 'layer-contours');
  const gridLayer = layers.find((l) => l.id === 'layer-grid-2d');

  useEffect(() => {
    liveRasterRef.current = null;
    setLiveRasterReady(false);
    if (!liveRasterUrl) return;
    const image = new Image();
    image.onload = () => {
      liveRasterRef.current = image;
      setLiveRasterReady(true);
    };
    image.onerror = () => setLiveRasterReady(false);
    image.src = liveRasterUrl;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [liveRasterUrl]);

  // Pre-generate the procedural raster layers once
  useEffect(() => {
    if (!offscreenSatelliteRef.current) {
      offscreenSatelliteRef.current = generateSatelliteCanvas(1024, 1024);
    }
    if (!offscreenDepthRef.current) {
      offscreenDepthRef.current = generateDepthMapCanvas(1024, 1024);
    }
    if (!offscreenHypsometricRef.current) {
      offscreenHypsometricRef.current = generateHypsometricCanvas(1024, 1024, 'viridis');
    }
  }, []);

  // Update colormap if preset changes
  useEffect(() => {
    if (viewport2D.colormap !== 'natural') {
      offscreenHypsometricRef.current = generateHypsometricCanvas(
        1024,
        1024,
        viewport2D.colormap
      );
    }
  }, [viewport2D.colormap]);

  // Main 2D Render pass onto the visible canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // Pan & Zoom transformations centered in viewport
    ctx.translate(w / 2 + viewport2D.panX, h / 2 + viewport2D.panY);
    ctx.scale(viewport2D.zoom, viewport2D.zoom);
    ctx.translate(-w / 2, -h / 2);

    // Apply brightness, contrast & opacity filters
    ctx.filter = `brightness(${viewport2D.brightness * 100}%) contrast(${
      viewport2D.contrast * 100
    }%)`;
    ctx.globalAlpha = viewport2D.opacity;

    // Draw active raster layer
    const isShowingColormap = viewport2D.colormap !== 'natural';
    const isShowingDepth = depthLayer?.visible;

    if (isShowingColormap && offscreenHypsometricRef.current) {
      ctx.drawImage(offscreenHypsometricRef.current, 0, 0, w, h);
    } else if (isShowingDepth && offscreenDepthRef.current) {
      ctx.drawImage(offscreenDepthRef.current, 0, 0, w, h);
    } else if (originalLayer?.visible ?? true) {
      if (liveRasterReady && liveRasterRef.current) {
        ctx.drawImage(liveRasterRef.current, 0, 0, w, h);
      } else if (offscreenSatelliteRef.current) {
        ctx.drawImage(offscreenSatelliteRef.current, 0, 0, w, h);
      }
    }

    // Blend depth layer over satellite if both are enabled
    if (
      isShowingDepth &&
      originalLayer?.visible &&
      !isShowingColormap &&
      offscreenDepthRef.current
    ) {
      ctx.globalAlpha = depthLayer.opacity;
      ctx.drawImage(offscreenDepthRef.current, 0, 0, w, h);
    }

    // Contour lines overlay
    if (contoursLayer?.visible) {
      ctx.save();
      ctx.globalAlpha = contoursLayer.opacity;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1;
      const step = 48;
      for (let i = 0; i <= w; i += step) {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, i, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Coordinate Grid Overlay
    if (viewport2D.gridVisible && (gridLayer?.visible ?? true)) {
      ctx.save();
      ctx.globalAlpha = gridLayer ? gridLayer.opacity * 0.7 : 0.4;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      const gridSize = 128;
      for (let x = 0; x <= w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Active Measurement Polyline
    if (viewport2D.measurePoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.fillStyle = '#ffffff';

      ctx.beginPath();
      viewport2D.measurePoints.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      viewport2D.measurePoints.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    }

    ctx.restore();
  }, [
    viewport2D,
    originalLayer?.visible,
    depthLayer?.visible,
    depthLayer?.opacity,
    contoursLayer?.visible,
    contoursLayer?.opacity,
    gridLayer?.visible,
    gridLayer?.opacity,
    liveRasterReady,
    liveRasterUrl,
  ]);

  // Keep canvas rendered
  useEffect(() => {
    let animId: number;
    function loop() {
      renderCanvas();
      animId = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height) * 0.92;
      canvas.width = size;
      canvas.height = size;
      canvas.style.left = `${(rect.width - size) / 2}px`;
      canvas.style.top = `${(rect.height - size) / 2}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Professional Cursor-Centric Mouse Wheel Zoom
  const viewport2DRef = useRef(viewport2D);
  viewport2DRef.current = viewport2D;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const vp = viewport2DRef.current;
      const currentZoom = vp.zoom;

      // Continuous geometric zoom factor (supports smooth mousewheel, notched wheels, and touchpads)
      const zoomFactor = Math.exp(-e.deltaY * 0.0018);
      const newZoom = Math.max(0.1, Math.min(12.0, currentZoom * zoomFactor));
      const effectiveFactor = newZoom / currentZoom;

      // Mathematically pivot pan coordinates around the exact cursor location
      const newPanX = vp.panX * effectiveFactor + (screenX - centerX) * (1 - effectiveFactor);
      const newPanY = vp.panY * effectiveFactor + (screenY - centerY) * (1 - effectiveFactor);

      zoomAtPoint2D(newZoom, newPanX, newPanY);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [zoomAtPoint2D]);

  // Keyboard WSAD & Arrow Keys for 2D Panning (+ / - for Zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      const vp = viewport2DRef.current;
      const panStep = 60;
      const maxPan = 1600;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          setPan2D(vp.panX, Math.min(maxPan, vp.panY + panStep));
          break;
        case 'KeyS':
        case 'ArrowDown':
          setPan2D(vp.panX, Math.max(-maxPan, vp.panY - panStep));
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setPan2D(Math.min(maxPan, vp.panX + panStep), vp.panY);
          break;
        case 'KeyD':
        case 'ArrowRight':
          setPan2D(Math.max(-maxPan, vp.panX - panStep), vp.panY);
          break;
        case 'Equal':
        case 'NumpadAdd':
          setZoom2D((z) => Math.min(12, (typeof z === 'number' ? z : 1) * 1.15));
          break;
        case 'Minus':
        case 'NumpadSubtract':
          setZoom2D((z) => Math.max(0.1, (typeof z === 'number' ? z : 1) * 0.85));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setPan2D, setZoom2D]);

  // Mouse down: drag pan or measure point
  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewport2D.measureMode) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / viewport2D.zoom;
      const y = (e.clientY - rect.top) / viewport2D.zoom;
      addMeasurePoint2D({ x, y });
      return;
    }

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: viewport2D.panX,
      panY: viewport2D.panY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const v = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const elev = getElevationMeters(u, v);
      const { lat, lon } = getGeoCoordinates(u, v);
      const pixelX = Math.round(u * 4096);
      const pixelY = Math.round(v * 4096);

      setCursorReadout({
        pixelX,
        pixelY,
        lat,
        lon,
        elevation: elev,
        slopeDegrees: Math.round(15 + (elev / 4810) * 35),
      });
    }

    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan2D(dragStartRef.current.panX + dx, dragStartRef.current.panY + dy);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = async (e: React.MouseEvent) => {
    const dsmPath = project.rawOutputPaths.dsm;
    const canvas = canvasRef.current;
    if (!dsmPath || !canvas || viewport2D.measureMode) return;
    const rect = canvas.getBoundingClientRect();
    const viewX = e.clientX - rect.left;
    const viewY = e.clientY - rect.top;
    const imageX = (viewX - canvas.width / 2 - viewport2D.panX) / viewport2D.zoom + canvas.width / 2;
    const imageY = (viewY - canvas.height / 2 - viewport2D.panY) / viewport2D.zoom + canvas.height / 2;
    const u = Math.max(0, Math.min(1, imageX / canvas.width));
    const v = Math.max(0, Math.min(1, imageY / canvas.height));
    const col = Math.round(u * Math.max(0, project.metadata.dimensions.width - 1));
    const row = Math.round(v * Math.max(0, project.metadata.dimensions.height - 1));
    try {
      const point = await inspectRaster(dsmPath, col, row);
      setCursorReadout({
        pixelX: point.column,
        pixelY: point.row,
        elevation: point.value_m,
        slopeDegrees: point.slope_degrees ?? undefined,
        mapX: point.map_x,
        mapY: point.map_y,
        readoutSource: 'live-raster',
      });
    } catch {
      // A click outside the valid raster is not an application error.
    }
  };

  // Calculate measured distance if points exist
  let measuredDistanceMeters = 0;
  if (viewport2D.measurePoints.length >= 2) {
    let totalPx = 0;
    for (let i = 1; i < viewport2D.measurePoints.length; i++) {
      const p1 = viewport2D.measurePoints[i - 1];
      const p2 = viewport2D.measurePoints[i];
      const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      totalPx += dist;
    }
    // 0.50m per full-res pixel (4096 vs current canvas size)
    const currentScale = 4096 / (canvasRef.current?.width || 1024);
    measuredDistanceMeters = Math.round(totalPx * currentScale * 0.5);
  }

  return (
    <div
      ref={containerRef}
      className={`raster-stage ${isDragging ? 'dragging' : ''} ${
        viewport2D.measureMode ? 'measuring' : ''
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    >
      <canvas ref={canvasRef} className="raster-canvas" />

      {/* Crosshair indicator */}
      {viewport2D.crosshairVisible && <div className="viewport-reticle" />}

      {/* Measurement readout badge */}
      {viewport2D.measurePoints.length >= 2 && (
        <div
          className="measurement-badge"
          style={{ top: '16px', left: '16px' }}
        >
          Distance: {measuredDistanceMeters.toLocaleString()} m (
          {(measuredDistanceMeters / 1000).toFixed(2)} km)
        </div>
      )}

      {/* Dynamic USGS / GIS Segmented Scale Bar */}
      <div
        className="gis-scale-bar"
        style={{ width: `${Math.max(100, Math.round(100 * (viewport2D.zoom || 1)))}px` }}
      >
        <div className="scale-ticks-row">
          <span>0</span>
          <span>{Math.round(250 / (viewport2D.zoom || 1))}</span>
          <span>{Math.round(500 / (viewport2D.zoom || 1))} m</span>
        </div>
        <div className="scale-blocks-row">
          <div className="scale-block-black" />
          <div className="scale-block-white" />
          <div className="scale-block-black" />
          <div className="scale-block-white" />
        </div>
      </div>
    </div>
  );
};
