import React from 'react';
import * as THREE from 'three';
import { useViewportStore } from '../../state/viewportStore';
import { useLayerStore } from '../../state/layerStore';

export const WaterPlane: React.FC = () => {
  const { waterVisible, waterElevation, verticalExaggeration } = useViewportStore(
    (state) => state.viewport3D
  );
  const layers = useLayerStore((state) => state.layers);
  const waterLayer = layers.find((l) => l.id === 'layer-water-plane');

  if (!waterVisible || (waterLayer && !waterLayer.visible)) {
    return null;
  }

  const height = waterElevation * 45 * verticalExaggeration;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, height, 0]}
      receiveShadow
    >
      <planeGeometry args={[200, 200, 32, 32]} />
      <meshStandardMaterial
        color="#0369a1"
        roughness={0.15}
        metalness={0.4}
        transparent
        opacity={waterLayer ? waterLayer.opacity * 0.82 : 0.8}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};
