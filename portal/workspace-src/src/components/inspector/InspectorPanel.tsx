import React from 'react';
import { Sliders } from 'lucide-react';
import { TwoDInspector } from './TwoDInspector';
import { ThreeDInspector } from './ThreeDInspector';
import { useAppStore } from '../../state/appStore';

export const InspectorPanel: React.FC = () => {
  const { activeView, rightPanelWidth } = useAppStore();

  return (
    <aside
      className="inspector-panel"
      style={{ width: `${rightPanelWidth}px`, minWidth: '240px', maxWidth: '480px' }}
      aria-label="Inspector Panel"
    >
      <div className="inspector-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sliders size={13} style={{ color: 'var(--accent-light)' }} />
          <span>INSPECTOR</span>
        </div>
        <span className="inspector-header-badge">{activeView} ACTIVE</span>
      </div>

      {activeView === '2D' ? <TwoDInspector /> : <ThreeDInspector />}
    </aside>
  );
};
