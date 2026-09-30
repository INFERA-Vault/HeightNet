import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useViewportStore } from '../../state/viewportStore';
import { useLayerStore } from '../../state/layerStore';
import {
  getTerrainHeight,
  generateSatelliteCanvas,
  generateHypsometricCanvas,
} from '../noise/terrainNoise';

export const TerrainMesh: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireframeMeshRef = useRef<THREE.Mesh>(null);

  const {
    verticalExaggeration,
    materialMode,
    wireframeVisible,
    wireframeColor,
    meshResolution,
  } = useViewportStore((state) => state.viewport3D);

  const layers = useLayerStore((state) => state.layers);
  const terrainLayer = layers.find((l) => l.id === 'layer-terrain-mesh');
  const textureLayer = layers.find((l) => l.id === 'layer-surface-texture');

  // Segments based on resolution setting
  const segments = useMemo(() => {
    switch (meshResolution) {
      case 'low': return 64;
      case 'medium': return 128;
      case 'high': return 256;
      case 'ultra': return 384;
      default: return 256;
    }
  }, [meshResolution]);

  // Create or reuse CanvasTextures for satellite and colormap
  const textures = useMemo(() => {
    const satCanvas = generateSatelliteCanvas(1024, 1024);
    const satTex = new THREE.CanvasTexture(satCanvas);
    satTex.wrapS = THREE.ClampToEdgeWrapping;
    satTex.wrapT = THREE.ClampToEdgeWrapping;
    satTex.anisotropy = 8;

    const hypCanvas = generateHypsometricCanvas(512, 512, 'viridis');
    const hypTex = new THREE.CanvasTexture(hypCanvas);
    hypTex.wrapS = THREE.ClampToEdgeWrapping;
    hypTex.wrapT = THREE.ClampToEdgeWrapping;

    return { satTex, hypTex };
  }, []);

  // Generate displaced terrain geometry
  const geometry = useMemo(() => {
    const size = 200; // 200 units wide
    const geom = new THREE.PlaneGeometry(size, size, segments, segments);
    geom.rotateX(-Math.PI / 2); // Lay flat on XZ plane

    const pos = geom.attributes.position;
    const heightScale = 45 * verticalExaggeration;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Normalized coordinates u, v in [0, 1]
      const u = (x + size / 2) / size;
      const v = (z + size / 2) / size;

      const normHeight = getTerrainHeight(u, v);
      pos.setY(i, normHeight * heightScale);
    }

    geom.computeVertexNormals();
    return geom;
  }, [segments, verticalExaggeration]);

  // Clean disposal on unmount or geometry change
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (terrainLayer && !terrainLayer.visible) {
    return null;
  }

  // Active texture based on material mode
  let activeMap: THREE.Texture | null = null;
  let activeColor = '#ffffff';

  if (materialMode === 'satellite' && (textureLayer?.visible ?? true)) {
    activeMap = textures.satTex;
  } else if (materialMode === 'hypsometric') {
    activeMap = textures.hypTex;
  } else if (materialMode === 'shaded-relief') {
    activeColor = '#cbd5e1';
  } else if (materialMode === 'surface') {
    activeColor = '#94a3b8';
  }

  return (
    <group>
      {/* Primary Terrain Surface */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          map={activeMap}
          color={activeColor}
          roughness={0.75}
          metalness={0.08}
          flatShading={materialMode === 'surface'}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wireframe Topology Overlay */}
      {wireframeVisible && (
        <mesh
          ref={wireframeMeshRef}
          geometry={geometry}
          position={[0, 0.05, 0]}
        >
          <meshBasicMaterial
            wireframe
            color={wireframeColor || '#38bdf8'}
            transparent
            opacity={0.35}
          />
        </mesh>
      )}
    </group>
  );
};
