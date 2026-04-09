import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

/**
 * @param {{ score: number }} props
 */
export const TruthBadge = ({ score }) => {
  const groupRef = useRef(null);
  const glowRef = useRef(null);

  const isHigh = score >= 70;
  const color = isHigh ? "#22c55e" : "#ef4444";

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = 3.2 + Math.sin(t * 1.5) * 0.15;
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;
    }
    if (glowRef.current) {
      const boost = Math.min(100, Math.max(0, score)) / 100;
      glowRef.current.intensity = 2 + boost * 2.5 + Math.sin(t * 2) * 0.5;
    }
  });

  return (
    <group ref={groupRef} position={[0, 3.2, 0]}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.5, 0.08, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      <mesh>
        <torusGeometry args={[0.52, 0.03, 8, 32]} />
        <meshStandardMaterial color="#c9a84c" metalness={0.8} roughness={0.2} />
      </mesh>

      <Text
        position={[0, 0, 0.05]}
        fontSize={0.22}
        color="#ffffff"
        font="https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhdHeFaxOedc.woff2"
        anchorX="center"
        anchorY="middle"
      >
        {`${score}%`}
      </Text>
      <Text
        position={[0, -0.18, 0.05]}
        fontSize={0.08}
        color="#ffffff"
        font="https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhdHeFaxOedc.woff2"
        anchorX="center"
        anchorY="middle"
      >
        TRUTH SCORE
      </Text>

      <pointLight ref={glowRef} color={color} intensity={2} distance={5} />
    </group>
  );
};
