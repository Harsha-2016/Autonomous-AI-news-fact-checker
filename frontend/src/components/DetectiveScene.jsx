import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import { Detective } from "./three/Detective";
import { NoirEnvironment } from "./three/NoirEnvironment";
import { FloatingParticles } from "./three/FloatingParticles";
import { ScanBeam } from "./three/ScanBeam";
import { TruthBadge } from "./three/TruthBadge";

/**
 * @typedef {'idle' | 'scanning' | 'results'} DetectiveState
 */

/**
 * @param {{ state: DetectiveState; truthScore?: number; progress?: number }} props
 */
const DetectiveScene = ({ state, truthScore = 0, progress = 0 }) => {
  return (
    <div className="w-full h-full absolute inset-0 min-h-[100svh]">
      <Canvas
        shadows
        camera={{ position: [4, 2.5, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.15} />
          <directionalLight
            position={[5, 8, 5]}
            intensity={0.8}
            castShadow
            shadow-mapSize={[1024, 1024]}
            color="#8ecae6"
          />
          <spotLight
            position={[0, 6, 2]}
            angle={0.4}
            penumbra={0.8}
            intensity={1.5}
            castShadow
            color="#4cc9f0"
          />
          <spotLight
            position={[-3, 4, -2]}
            angle={0.6}
            penumbra={1}
            intensity={0.5}
            color="#c9a84c"
          />
          <pointLight position={[0, 1, 3]} intensity={0.3} color="#4cc9f0" />

          <Detective state={state} truthScore={truthScore} />
          <NoirEnvironment state={state} />
          <FloatingParticles state={state} />
          {state === "scanning" && <ScanBeam progress={progress} />}
          {state === "results" && (
            <TruthBadge score={Math.round(Number(truthScore) || 0)} />
          )}

          <fog attach="fog" args={["#0a0e1a", 5, 18]} />
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            maxPolarAngle={Math.PI / 2.1}
            minPolarAngle={Math.PI / 4}
            autoRotate={state === "idle"}
            autoRotateSpeed={0.3}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default DetectiveScene;
