import React from 'react';
import { useAppStore } from '../../state/appStore';
import type { ActiveView } from '../../types/viewport';

export const ViewSelector: React.FC = () => {
  const { activeView, setActiveView } = useAppStore();

  const handleSelectView = (view: ActiveView) => {
    setActiveView(view);
  };

  return (
    <div className="views-section" aria-label="Workspace Views">
      <div className="sidebar-section-header">
        <span>Views</span>
      </div>

      <div className="views-container">
        <button
          id="view-btn-2d"
          className={`view-btn ${activeView === '2D' ? 'active' : ''}`}
          onClick={() => handleSelectView('2D')}
          title="2D Raster GIS Viewport (Hot-key: 1)"
          aria-pressed={activeView === '2D'}
        >
          <span className="view-radio-dot" />
          <span>2D Raster</span>
          <span className="view-badge-meta">SOURCE</span>
        </button>

        <button
          id="view-btn-3d"
          className={`view-btn ${activeView === '3D' ? 'active' : ''}`}
          onClick={() => handleSelectView('3D')}
          title="3D Terrain Perspective Viewport (Hot-key: 2)"
          aria-pressed={activeView === '3D'}
        >
          <span className="view-radio-dot" />
          <span>3D Terrain</span>
          <span className="view-badge-meta">MESH</span>
        </button>
      </div>
    </div>
  );
};
