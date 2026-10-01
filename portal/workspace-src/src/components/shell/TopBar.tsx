import React from 'react';
import { MountainSnow, Command, FileUp, Globe2 } from 'lucide-react';
import { HomeMenu } from '../menus/HomeMenu';
import { LayersMenu } from '../menus/LayersMenu';
import { ToolsMenu } from '../menus/ToolsMenu';
import { HelpMenu } from '../menus/HelpMenu';
import { useProjectStore } from '../../state/projectStore';
import { useAppStore } from '../../state/appStore';

export const TopBar: React.FC = () => {
  const project = useProjectStore((state) => state.project);
  const { setCommandPaletteOpen } = useAppStore();

  return (
    <header className="top-bar" role="banner">
      <div className="top-bar-left">
        <div className="app-branding">
          <MountainSnow className="app-logo-icon" />
          <span>HeightNet</span>
        </div>

        <nav className="app-menu-bar" aria-label="Main Application Menu">
          <HomeMenu />
          <LayersMenu />
          <ToolsMenu />
          <HelpMenu />
        </nav>
      </div>

      <div className="top-bar-center" title="Active Project & Spatial Reference System">
        <span className="top-bar-project-name">{project.metadata.name}</span>
        <span>—</span>
        <span>{project.metadata.dimensions.width}×{project.metadata.dimensions.height}</span>
        <span>•</span>
        <span>{project.metadata.crs}</span>
      </div>

      <div className="top-bar-right">
        <a className="map-trigger" href="/globe/" title="Open the Sentinel map and area selector">
          <Globe2 size={11} />
          <span>Map</span>
        </a>
        <button
          className="upload-trigger"
          onClick={() => window.dispatchEvent(new CustomEvent('heightnet:open-upload'))}
          title="Upload a PNG, JPG, or GeoTIFF"
        >
          <FileUp size={11} />
          <span>Upload</span>
        </button>
        <button
          className="cmd-k-trigger"
          onClick={() => setCommandPaletteOpen(true)}
          title="Open Command Palette (Ctrl+K)"
          aria-label="Open Command Palette"
        >
          <Command size={11} />
          <span>Quick Actions</span>
          <span className="kbd-badge">Ctrl+K</span>
        </button>
      </div>
    </header>
  );
};
