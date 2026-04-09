import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * @param {{ progress: number }} props — 0–100 while analyzing
 */
export const ScanBeam = ({ progress }) => {
  const beamRef = useRef(null);
  const ringRef = useRef(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beamRef.current) {
      const mat = beamRef.current.material;
      mat.opacity = 0.15 + Math.sin(t * 4) * 0.1;
      beamRef.current.scale.x = 1 + Math.sin(t * 3) * 0.1;
      beamRef.current.scale.z = 1 + Math.sin(t * 3) * 0.1;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 2;
      const scale = 0.8 + Math.sin(t * 3) * 0.2;
      ringRef.current.scale.set(scale, scale, scale);
    }
  });

  const p = Math.min(100, Math.max(0, Number(progress) || 0)) / 100;

  return (
    <group position={[0.45, 0.75, 0.45]}>
      <mesh ref={beamRef} rotation={[-0.3, 0, 0]} position={[0, -0.3, 0.5]}>
        <coneGeometry args={[1.5, 3, 16, 1, true]} />
        <meshStandardMaterial
          color="#4cc9f0"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          emissive="#4cc9f0"
          emissiveIntensity={0.25 + p * 0.35}
        />
      </mesh>

      <mesh ref={ringRef} position={[0, -0.5, 1]}>
        <torusGeometry args={[0.8, 0.02, 8, 32]} />
        <meshStandardMaterial
          color="#4cc9f0"
          emissive="#4cc9f0"
          emissiveIntensity={1 + p * 0.8}
          transparent
          opacity={0.6}
        />
      </mesh>

      <pointLight color="#4cc9f0" intensity={2 + p * 4} distance={8} />
    </group>
  );
};
