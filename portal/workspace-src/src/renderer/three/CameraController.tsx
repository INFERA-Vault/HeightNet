import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useViewportStore } from '../../state/viewportStore';
import { getTerrainHeight } from '../noise/terrainNoise';

export const CameraController: React.FC = () => {
  const { camera, gl } = useThree();
  const orbitRef = useRef<OrbitControlsImpl>(null);

  const {
    cameraMode,
    cameraFov,
    cameraSpeed,
    verticalExaggeration,
    autoOrbit,
  } = useViewportStore((state) => state.viewport3D);

  const resetTrigger = useViewportStore((state) => state.resetTrigger3D);
  const setCamera3DReadout = useViewportStore((state) => state.setCamera3DReadout);
  const setCameraFov3D = useViewportStore((state) => state.setCameraFov3D);
  const setAutoOrbitPaused3D = useViewportStore((state) => state.setAutoOrbitPaused3D);

  // Keyboard keys state for Flythrough and Walkthrough
  const keys = useRef<{
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    boost: boolean;
  }>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
  });

  // Mouse drag state for Fly / Walk look around
  const mouseLook = useRef<{
    isMouseDown: boolean;
    lastX: number;
    lastY: number;
    pitch: number;
    yaw: number;
  }>({
    isMouseDown: false,
    lastX: 0,
    lastY: 0,
    pitch: -0.35,
    yaw: 0.75,
  });

  // FPS calculation variables
  const fpsStats = useRef<{ frames: number; prevTime: number; fps: number }>({
    frames: 0,
    prevTime: performance.now(),
    fps: 60,
  });

  // Update FOV when store changes
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = cameraFov;
      camera.updateProjectionMatrix();
    }
  }, [camera, cameraFov]);

  // Handle Camera Reset
  useEffect(() => {
    if (resetTrigger > 0) {
      camera.position.set(130, 95, 150);
      camera.lookAt(0, 15, 0);
      mouseLook.current.pitch = -0.32;
      mouseLook.current.yaw = 0.72;
      if (orbitRef.current) {
        orbitRef.current.target.set(0, 15, 0);
        orbitRef.current.update();
      }
    }
  }, [resetTrigger, camera]);

  // Key event listeners for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = true;
          break;
        case 'Space':
          keys.current.up = true;
          e.preventDefault();
          break;
        case 'KeyC':
        case 'ControlLeft':
        case 'ControlRight':
          keys.current.down = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.boost = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = false;
          break;
        case 'Space':
          keys.current.up = false;
          break;
        case 'KeyC':
        case 'ControlLeft':
        case 'ControlRight':
          keys.current.down = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.boost = false;
          break;
      }
    };

    const handleBlur = () => {
      keys.current.forward = false;
      keys.current.backward = false;
      keys.current.left = false;
      keys.current.right = false;
      keys.current.up = false;
      keys.current.down = false;
      keys.current.boost = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Mouse look around for Flythrough & Walkthrough
  useEffect(() => {
    const dom = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      if (cameraMode === 'orbit' || cameraMode === 'auto-orbit') return;
      mouseLook.current.isMouseDown = true;
      mouseLook.current.lastX = e.clientX;
      mouseLook.current.lastY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseLook.current.isMouseDown || cameraMode === 'orbit' || cameraMode === 'auto-orbit') return;
      const dx = e.clientX - mouseLook.current.lastX;
      const dy = e.clientY - mouseLook.current.lastY;
      mouseLook.current.lastX = e.clientX;
      mouseLook.current.lastY = e.clientY;

      const sensitivity = 0.003;
      mouseLook.current.yaw -= dx * sensitivity;
      mouseLook.current.pitch -= dy * sensitivity;

      // Limit pitch to avoid flipping over
      mouseLook.current.pitch = Math.max(
        -Math.PI / 2.05,
        Math.min(Math.PI / 2.05, mouseLook.current.pitch)
      );
    };

    const onMouseUp = () => {
      mouseLook.current.isMouseDown = false;
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [gl, cameraMode]);

  // Auto Orbit: Gracefully suspend auto-rotation when user manually clicks & drags the camera
  useEffect(() => {
    const controls = orbitRef.current;
    if (!controls) return;

    const onStart = () => {
      if (cameraMode === 'auto-orbit' && !autoOrbit.paused) {
        setAutoOrbitPaused3D(true);
      }
    };

    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [cameraMode, autoOrbit.paused, setAutoOrbitPaused3D]);

  // Auto Orbit: Target sync
  useEffect(() => {
    if ((cameraMode === 'orbit' || cameraMode === 'auto-orbit') && orbitRef.current) {
      orbitRef.current.target.set(
        autoOrbit.targetPos[0],
        autoOrbit.targetPos[1],
        autoOrbit.targetPos[2]
      );
      orbitRef.current.update();
    }
  }, [cameraMode, autoOrbit.targetPos]);

  // Auto Orbit: Elevation sync without snapping
  const prevElevation = useRef(autoOrbit.elevation);
  useEffect(() => {
    if (cameraMode === 'auto-orbit' && prevElevation.current !== autoOrbit.elevation) {
      const deltaY = autoOrbit.elevation - prevElevation.current;
      camera.position.y += deltaY;
      prevElevation.current = autoOrbit.elevation;
      if (orbitRef.current) {
        orbitRef.current.update();
      }
    } else {
      prevElevation.current = autoOrbit.elevation;
    }
  }, [cameraMode, autoOrbit.elevation, camera]);

  // Mouse wheel listener for 3D navigation (Dolly zoom in fly/walk, optical FOV zoom with Ctrl)
  useEffect(() => {
    const dom = gl.domElement;

    const onWheel = (e: WheelEvent) => {
      // In orbit or auto-orbit mode without Ctrl, OrbitControls handles wheel zooming
      if ((cameraMode === 'orbit' || cameraMode === 'auto-orbit') && !e.ctrlKey) {
        return;
      }

      e.preventDefault();

      // Ctrl + Wheel: Optical FOV zoom across all modes
      if (e.ctrlKey) {
        const delta = e.deltaY < 0 ? -2.5 : 2.5;
        const currentFov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;
        const newFov = Math.max(15, Math.min(105, currentFov + delta));
        setCameraFov3D(newFov);
        return;
      }

      // Flythrough: 6-DOF dolly forward/backward along camera look vector
      if (cameraMode === 'flythrough') {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const dollySpeed = (keys.current.boost ? 14 : 6) * cameraSpeed;
        const dollyDir = e.deltaY < 0 ? 1 : -1;
        camera.position.addScaledVector(forward, dollyDir * dollySpeed);

        // Clamp to avoid subterranean clipping
        const size = 200;
        const u = (camera.position.x + size / 2) / size;
        const v = (camera.position.z + size / 2) / size;
        const clampedU = Math.max(0, Math.min(1, u));
        const clampedV = Math.max(0, Math.min(1, v));
        const terrainHeight = getTerrainHeight(clampedU, clampedV) * 45 * verticalExaggeration;
        if (camera.position.y < terrainHeight + 1.0) {
          camera.position.y = terrainHeight + 1.0;
        }
      } else if (cameraMode === 'walkthrough') {
        // Walkthrough: Ground-level step forward / backward
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();
        const stepSpeed = (keys.current.boost ? 9 : 4) * cameraSpeed;
        const stepDir = e.deltaY < 0 ? 1 : -1;
        camera.position.addScaledVector(forward, stepDir * stepSpeed);

        // Maintain eye-level elevation
        const size = 200;
        const u = (camera.position.x + size / 2) / size;
        const v = (camera.position.z + size / 2) / size;
        const clampedU = Math.max(0, Math.min(1, u));
        const clampedV = Math.max(0, Math.min(1, v));
        const terrainHeight = getTerrainHeight(clampedU, clampedV) * 45 * verticalExaggeration;
        camera.position.y = terrainHeight + 3.2;
      }
    };

    dom.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      dom.removeEventListener('wheel', onWheel);
    };
  }, [gl, camera, cameraMode, cameraSpeed, verticalExaggeration, setCameraFov3D]);

  // Frame update loop
  useFrame((_, delta) => {
    // 1. Calculate FPS
    fpsStats.current.frames++;
    const now = performance.now();
    if (now >= fpsStats.current.prevTime + 500) {
      fpsStats.current.fps = Math.round(
        (fpsStats.current.frames * 1000) / (now - fpsStats.current.prevTime)
      );
      fpsStats.current.frames = 0;
      fpsStats.current.prevTime = now;
    }

    // 2. Navigation Movement (Orbit, Auto-Orbit, Flythrough & Walkthrough)
    if (cameraMode === 'orbit' || cameraMode === 'auto-orbit') {
      const { forward, backward, left, right, boost } = keys.current;
      if (forward || backward || left || right) {
        const speedMultiplier = (boost ? 2.5 : 1.0) * cameraSpeed;
        const moveSpeed = 55 * delta * speedMultiplier;
        const target = orbitRef.current ? orbitRef.current.target : new THREE.Vector3(0, 15, 0);
        const dir = new THREE.Vector3().subVectors(target, camera.position);
        const dist = dir.length();
        dir.normalize();

        // Forward (W) / Backward (S) = dolly zoom in/out towards target
        if (forward && dist > 10) {
          camera.position.addScaledVector(dir, moveSpeed);
        }
        if (backward && dist < 480) {
          camera.position.addScaledVector(dir, -moveSpeed);
        }

        // Left (A) / Right (D) = pan camera and target horizontally
        const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        rightVec.y = 0;
        rightVec.normalize();
        if (right) {
          const pan = rightVec.clone().multiplyScalar(moveSpeed * 0.7);
          camera.position.add(pan);
          if (orbitRef.current) orbitRef.current.target.add(pan);
        }
        if (left) {
          const pan = rightVec.clone().multiplyScalar(-moveSpeed * 0.7);
          camera.position.add(pan);
          if (orbitRef.current) orbitRef.current.target.add(pan);
        }

        if (orbitRef.current) {
          orbitRef.current.update();
        }
      }
    } else if (cameraMode === 'flythrough' || cameraMode === 'walkthrough') {
      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.y = mouseLook.current.yaw;
      euler.x = mouseLook.current.pitch;
      camera.quaternion.setFromEuler(euler);

      const speedMultiplier = (keys.current.boost ? 2.5 : 1.0) * cameraSpeed;
      const moveSpeed = (cameraMode === 'flythrough' ? 45 : 25) * delta * speedMultiplier;

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

      if (cameraMode === 'walkthrough') {
        // Flat movement on ground plane
        forward.y = 0;
        forward.normalize();
        right.y = 0;
        right.normalize();
      }

      const moveDelta = new THREE.Vector3(0, 0, 0);
      if (keys.current.forward) moveDelta.add(forward.multiplyScalar(moveSpeed));
      if (keys.current.backward) moveDelta.add(forward.multiplyScalar(-moveSpeed));
      if (keys.current.right) moveDelta.add(right.multiplyScalar(moveSpeed));
      if (keys.current.left) moveDelta.add(right.multiplyScalar(-moveSpeed));

      if (cameraMode === 'flythrough') {
        if (keys.current.up) moveDelta.y += moveSpeed;
        if (keys.current.down) moveDelta.y -= moveSpeed;
      }

      camera.position.add(moveDelta);

      // Walkthrough ground collision clamping
      const size = 200;
      const u = (camera.position.x + size / 2) / size;
      const v = (camera.position.z + size / 2) / size;
      const clampedU = Math.max(0, Math.min(1, u));
      const clampedV = Math.max(0, Math.min(1, v));
      const terrainHeight = getTerrainHeight(clampedU, clampedV) * 45 * verticalExaggeration;

      if (cameraMode === 'walkthrough') {
        // Keep camera at ground height + 3.0 units eye level
        const targetY = terrainHeight + 3.2;
        camera.position.y += (targetY - camera.position.y) * 0.15;
      } else {
        // Prevent flythrough from sinking into subterranean abyss
        if (camera.position.y < terrainHeight + 1.0) {
          camera.position.y = terrainHeight + 1.0;
        }
      }
    }

    // 3. Update telemetry readout
    const pos = camera.position;
    setCamera3DReadout({
      posX: Math.round(pos.x),
      posY: Math.round(pos.y),
      posZ: Math.round(pos.z),
      pitch: Math.round((camera.rotation.x * 180) / Math.PI),
      yaw: Math.round((camera.rotation.y * 180) / Math.PI),
      fps: fpsStats.current.fps || 60,
    });
  });

  if (cameraMode === 'orbit' || cameraMode === 'auto-orbit') {
    const isAutoRotating = cameraMode === 'auto-orbit' && !autoOrbit.paused;
    const dirSign = autoOrbit.direction === 'clockwise' ? -1 : 1;
    const rotateSpeed = 2.2 * autoOrbit.speed * dirSign;

    return (
      <OrbitControls
        ref={orbitRef}
        makeDefault
        enableDamping
        dampingFactor={0.06}
        enableZoom={true}
        zoomSpeed={1.2}
        autoRotate={isAutoRotating}
        autoRotateSpeed={rotateSpeed}
        maxDistance={480}
        minDistance={8}
        maxPolarAngle={Math.PI / 2.05} // don't go below ground
      />
    );
  }

  return null;
};
