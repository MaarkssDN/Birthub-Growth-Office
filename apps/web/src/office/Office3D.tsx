import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { AgentAvatar, type AgentColors } from "./characters";
import type { AgentVisual } from "./useOfficeEvents";
import type { VisualState } from "@bgo/contracts";

/**
 * Escritório 3D isométrico (Onda 03) — 7 zonas: 6 estações de agentes +
 * núcleo central de resultados. Câmera com órbita/zoom, labels DOM (Html),
 * estados dirigidos por eventos reais via props. Sem texto 3D externo.
 */

interface Station {
  id: string;
  name: string;
  agentId?: string;
  pos: [number, number, number];
  facing: number;
  color: string;
}

const R = 6.2;
const STATIONS: Station[] = [
  { id: "aegis", name: "Sala do Supervisor", agentId: "aegis", pos: [0, 0, -R], facing: 0, color: "#ffc107" },
  { id: "relay", name: "Coordenação", agentId: "relay", pos: [R * 0.87, 0, -R * 0.5], facing: -Math.PI / 2.6, color: "#00d4ff" },
  { id: "scout", name: "Central de Inteligência", agentId: "scout", pos: [R * 0.87, 0, R * 0.5], facing: Math.PI / 2.6, color: "#38bdf8" },
  { id: "meridian", name: "Qualificação SDR", agentId: "meridian", pos: [0, 0, R], facing: Math.PI, color: "#a78bfa" },
  { id: "beacon", name: "Prospecção", agentId: "beacon", pos: [-R * 0.87, 0, R * 0.5], facing: -Math.PI / 2.6 + Math.PI, color: "#ff2d9b" },
  { id: "pledge", name: "Follow-up", agentId: "pledge", pos: [-R * 0.87, 0, -R * 0.5], facing: Math.PI / 2.6 + Math.PI, color: "#34d399" },
];

function Zone({ station, agentVisual, colors, selected, onSelect }: {
  station: Station;
  agentVisual: AgentVisual | undefined;
  colors: AgentColors | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const state: VisualState = agentVisual?.state ?? "idle";
  return (
    <group>
      {/* pad da zona */}
      <mesh position={[station.pos[0], 0.03, station.pos[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.9, 40]} />
        <meshStandardMaterial color={station.color} transparent opacity={selected ? 0.28 : 0.14} roughness={0.9} />
      </mesh>
      <mesh position={[station.pos[0], 0.05, station.pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.85, 1.95, 48]} />
        <meshBasicMaterial color={station.color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* mesa */}
      <group position={[station.pos[0], 0, station.pos[2] + 0.9]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[1.6, 0.08, 0.8]} />
          <meshStandardMaterial color="#23262f" roughness={0.6} />
        </mesh>
        {[-0.65, 0.65].map((x) => (
          <mesh key={x} position={[x, 0.27, 0]}>
            <boxGeometry args={[0.08, 0.54, 0.7]} />
            <meshStandardMaterial color="#16181f" roughness={0.7} />
          </mesh>
        ))}
        {/* monitor */}
        <mesh position={[0, 0.95, -0.1]} rotation={[-0.15, 0, 0]}>
          <boxGeometry args={[0.7, 0.45, 0.05]} />
          <meshStandardMaterial color="#0c0e14" emissive={station.color} emissiveIntensity={state === "idle" ? 0.15 : 0.6} roughness={0.4} />
        </mesh>
      </group>
      {/* nome da estação (DOM, sem fonte externa) */}
      <Html position={[station.pos[0], 2.6, station.pos[2]]} center distanceFactor={12} zIndexRange={[10, 0]}>
        <div className={`office-label ${selected ? "sel" : ""}`} style={{ borderColor: station.color }}>
          {station.name}
          {agentVisual && <span className={`st st-${state}`}>{state}</span>}
        </div>
      </Html>
      {station.agentId && colors && (
        <AgentAvatar
          agentId={station.agentId}
          colors={colors}
          state={state}
          selected={selected}
          onSelect={onSelect}
          position={[station.pos[0], 0, station.pos[2] - 0.4]}
          facing={station.facing}
        />
      )}
    </group>
  );
}

function Core({ selectedMission }: { selectedMission: string | undefined }) {
  const holo = useRefSpin();
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.6, 48]} />
        <meshStandardMaterial color="#12141b" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.55, 2.7, 64]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* holograma central de resultados */}
      <group ref={holo} position={[0, 1.6, 0]}>
        <mesh>
          <octahedronGeometry args={[0.55]} />
          <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={0.7} wireframe transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, -0.9, 0]}>
          <cylinderGeometry args={[0.9, 1.1, 0.06, 32, 1, true]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <Html position={[0, 3.1, 0]} center distanceFactor={12} zIndexRange={[10, 0]}>
        <div className={`office-label ${selectedMission ? "sel" : ""}`} style={{ borderColor: "#00d4ff" }}>
          Resultados{selectedMission ? ` · ${selectedMission}` : ""}
        </div>
      </Html>
    </group>
  );
}

function useRefSpin() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.6;
      ref.current.position.y = 1.6 + Math.sin(clock.getElapsedTime() * 1.4) * 0.12;
    }
  });
  return ref;
}

export function OfficeScene({
  colorsByAgent, agentVisuals, selectedAgent, onSelectAgent, selectedMission,
}: {
  colorsByAgent: Record<string, AgentColors>;
  agentVisuals: Record<string, AgentVisual>;
  selectedAgent: string | undefined;
  onSelectAgent: (id: string | null) => void;
  selectedMission: string | undefined;
}) {
  const visualFor = (agentId?: string) => (agentId ? agentVisuals[agentId] : undefined);
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [11, 11, 11], fov: 40, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
      onPointerMissed={() => onSelectAgent(null)}
    >
      <color attach="background" args={["#0a0c12"]} />
      <fog attach="fog" args={["#0a0c12", 22, 42]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[8, 14, 6]} intensity={1.1} castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-far={40} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14}
      />
      <pointLight position={[-6, 6, -6]} intensity={0.5} color="#7c5cff" />
      <pointLight position={[6, 5, 6]} intensity={0.4} color="#00d4ff" />
      {/* piso */}
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0d1017" roughness={0.95} />
      </mesh>
      <gridHelper args={[40, 40, "#1d2333", "#141926"]} position={[0, 0.001, 0]} />
      <Core selectedMission={selectedMission} />
      {STATIONS.map((st) => (
        <Zone
          key={st.id}
          station={st}
          agentVisual={visualFor(st.agentId)}
          colors={st.agentId ? colorsByAgent[st.agentId] : undefined}
          selected={selectedAgent === st.agentId}
          onSelect={() => st.agentId && onSelectAgent(st.agentId)}
        />
      ))}
      <OrbitControls
        enablePan enableZoom enableRotate
        minDistance={7} maxDistance={26}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 0.8, 0]}
        makeDefault
      />
      <Suspense fallback={null} />
    </Canvas>
  );
}
