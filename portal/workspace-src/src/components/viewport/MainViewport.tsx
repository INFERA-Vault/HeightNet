import React from 'react';
import { ViewportToolbar } from './ViewportToolbar';
import { ViewportStatusBar } from './ViewportStatusBar';
import { ViewportOverlay } from './ViewportOverlay';
import { RasterRenderer } from '../../renderer/raster/RasterRenderer';
import { TerrainScene } from '../../renderer/three/TerrainScene';
import { useAppStore } from '../../state/appStore';
import { useProjectStore } from '../../state/projectStore';

export const MainViewport: React.FC = () => {
  const activeView = useAppStore((state) => state.activeView);
  const liveViewerUrl = useProjectStore((state) => state.project.liveViewerUrl);

  return (
    <main className="main-viewport-container" role="region" aria-label="Main Viewport">
      <ViewportToolbar />

      <div className="viewport-stage">
        {/* Render 2D Raster View */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: activeView === '2D' ? 'block' : 'none',
          }}
        >
          <RasterRenderer />
        </div>

        {/* Render 3D Three.js Terrain View (Pre-warmed, no second generation) */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: activeView === '3D' ? 'block' : 'none',
          }}
        >
          {liveViewerUrl ? (
            <iframe
              title="Generated HeightNet terrain"
              src={liveViewerUrl}
              style={{ width: '100%', height: '100%', border: 0, background: '#101418' }}
            />
          ) : <TerrainScene />}
        </div>

        <ViewportOverlay />
      </div>

      <ViewportStatusBar />
    </main>
  );
};
