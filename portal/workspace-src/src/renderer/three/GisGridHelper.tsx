import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useViewportStore } from '../../state/viewportStore';
import { useLayerStore } from '../../state/layerStore';

export const GisGridHelper: React.FC = () => {
  const gridVisible = useViewportStore((state) => state.viewport3D.gridVisible);
  const layers = useLayerStore((state) => state.layers);
  const extentsLayer = layers.find((l) => l.id === 'layer-gis-bounding');

  const boxEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(200, 48, 200);
    return new THREE.EdgesGeometry(box);
  }, []);

  if (!gridVisible && (extentsLayer && !extentsLayer.visible)) {
    return null;
  }

  return (
    <group position={[0, -0.05, 0]}>
      {/* Base GIS Reference Grid */}
      {gridVisible && (
        <gridHelper
          args={[200, 20, '#0284c7', '#334155']}
          position={[0, 0, 0]}
        />
      )}

      {/* Spatial Extents Bounding Box Outline */}
      {extentsLayer?.visible && (
        <lineSegments position={[0, 24, 0]} geometry={boxEdges}>
          <lineBasicMaterial color="#38bdf8" transparent opacity={0.35} />
        </lineSegments>
      )}
    </group>
  );
};
