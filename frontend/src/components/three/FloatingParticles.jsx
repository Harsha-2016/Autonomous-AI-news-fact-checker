import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * @param {{ state: 'idle' | 'scanning' | 'results' }} props
 */
export const FloatingParticles = ({ state }) => {
  const pointsRef = useRef(null);
  const count = 200;

  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = Math.random() * 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      spd[i] = 0.2 + Math.random() * 0.5;
    }
    return [pos, spd];
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position;
    const speedMult = state === "scanning" ? 3 : state === "results" ? 1.5 : 1;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      posAttr.array[idx + 1] += speeds[i] * 0.003 * speedMult;
      posAttr.array[idx] += Math.sin(t + i) * 0.001;

      if (posAttr.array[idx + 1] > 5) {
        posAttr.array[idx + 1] = 0;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color={state === "scanning" ? "#4cc9f0" : "#c9a84c"}
        size={0.03}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
};
