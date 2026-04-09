import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * @param {{ state: 'idle' | 'scanning' | 'results' }} props
 */
export const NoirEnvironment = ({ state }) => {
  const gridRef = useRef(null);
  const fogPlaneRef = useRef(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (gridRef.current) {
      const mat = gridRef.current.material;
      if (state === "scanning") {
        mat.emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.2;
      } else if (state === "results") {
        mat.emissiveIntensity = 0.15 + Math.sin(t * 1.2) * 0.06;
      } else {
        mat.emissiveIntensity = 0.05;
      }
    }
    if (fogPlaneRef.current) {
      const mat = fogPlaneRef.current.material;
      mat.opacity = 0.15 + Math.sin(t * 0.5) * 0.05;
    }
  });

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.44, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0a0e1a" roughness={0.9} />
      </mesh>

      <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.43, 0]}>
        <planeGeometry args={[20, 20, 20, 20]} />
        <meshStandardMaterial
          color="#0a1628"
          emissive="#4cc9f0"
          emissiveIntensity={0.05}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>

      <mesh ref={fogPlaneRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
        <planeGeometry args={[15, 15]} />
        <meshStandardMaterial color="#1a2a4a" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 3, -5]}>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#060a14" />
      </mesh>
    </>
  );
};
