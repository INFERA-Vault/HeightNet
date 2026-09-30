import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { TerrainMesh } from './TerrainMesh';
import { WaterPlane } from './WaterPlane';
import { SunLight } from './SunLight';
import { GisGridHelper } from './GisGridHelper';
import { CameraController } from './CameraController';

export const TerrainScene: React.FC = () => {
  return (
    <div className="three-canvas-container" tabIndex={0}>
      <Canvas
        camera={{ position: [130, 95, 150], fov: 45, near: 0.5, far: 1200 }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor('#0d1015');
          scene.fog = new THREE.FogExp2('#0d1015', 0.0016);
        }}
      >
        <Suspense fallback={null}>
          <SunLight />
          <TerrainMesh />
          <WaterPlane />
          <GisGridHelper />
          <CameraController />

          {/* Orientation Gizmo in bottom right */}
          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport
              axisColors={['#ef4444', '#10b981', '#3b82f6']}
              labelColor="#ffffff"
            />
          </GizmoHelper>
        </Suspense>
      </Canvas>
    </div>
  );
};
