import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VisualState } from "@bgo/contracts";

/**
 * Bonequinhos procedurais do escritório (Onda 03) — PROTÓTIPOS visuais.
 * Não são os assets finais homologados (GLB/rig ficam para arte aprovada);
 * são modelos originais em primitivas Three.js com silhueta, cores da marca
 * e acessórios identificáveis por agente. Sem fotos, sem recortes.
 */

export interface AgentColors { primary: string; secondary: string; accent: string }

const STATE_TUNE: Record<VisualState, { bob: number; speed: number; emissive: number; shake: number }> = {
  idle:       { bob: 0.03, speed: 2.0,  emissive: 0.15, shake: 0 },
  listening:  { bob: 0.05, speed: 3.0,  emissive: 0.35, shake: 0 },
  processing: { bob: 0.09, speed: 7.0,  emissive: 0.55, shake: 0 },
  speaking:   { bob: 0.07, speed: 5.0,  emissive: 0.45, shake: 0 },
  success:    { bob: 0.12, speed: 6.0,  emissive: 0.7,  shake: 0 },
  error:      { bob: 0.02, speed: 9.0,  emissive: 0.8,  shake: 1 },
};

function useReducedMotion(): boolean {
  return useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
    [],
  );
}

function mat(color: string, emissive = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.15,
    ...(emissive > 0 ? { emissive: new THREE.Color(color), emissiveIntensity: emissive } : {}),
  });
}

/** Corpo base do bonequinho: corpo cápsula, cabeça, olhos grandes, pés. */
function Body({ colors, state }: { colors: AgentColors; state: VisualState }) {
  const g = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  const tune = STATE_TUNE[state];
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!g.current) return;
    const amp = reduced ? 0 : tune.bob;
    const speed = reduced ? 0.5 : tune.speed;
    g.current.position.y = Math.abs(Math.sin(t * speed)) * amp;
    g.current.rotation.z = tune.shake ? Math.sin(t * 30) * 0.06 * tune.shake : 0;
    if (head.current) {
      const talking = state === "speaking" && !reduced;
      head.current.scale.y = talking ? 1 + Math.sin(t * 8) * 0.08 : 1;
      head.current.rotation.y = state === "processing" && !reduced ? Math.sin(t * 2.4) * 0.5 : 0;
    }
  });
  return (
    <group ref={g}>
      {/* corpo */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.34, 0.5, 6, 14]} />
        <primitive object={useMemo(() => mat(colors.primary), [colors.primary])} attach="material" />
      </mesh>
      {/* faixa secundária */}
      <mesh position={[0, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.345, 0.045, 8, 24]} />
        <primitive object={useMemo(() => mat(colors.secondary), [colors.secondary])} attach="material" />
      </mesh>
      {/* cabeça */}
      <group ref={head} position={[0, 1.18, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.42, 24, 20]} />
          <primitive object={useMemo(() => mat("#f5f0e8"), [])} attach="material" />
        </mesh>
        {/* olhos grandes */}
        {[-0.16, 0.16].map((x) => (
          <group key={x} position={[x, 0.05, 0.36]}>
            <mesh>
              <sphereGeometry args={[0.11, 16, 12]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.075]}>
              <sphereGeometry args={[0.05, 12, 10]} />
              <meshStandardMaterial color="#14161c" roughness={0.3} />
            </mesh>
          </group>
        ))}
        {/* blush */}
        {[-0.26, 0.26].map((x) => (
          <mesh key={`b${x}`} position={[x, -0.06, 0.34]}>
            <sphereGeometry args={[0.05, 10, 8]} />
            <meshStandardMaterial color={colors.accent} roughness={0.8} transparent opacity={0.55} />
          </mesh>
        ))}
      </group>
      {/* pés */}
      {[-0.16, 0.16].map((x) => (
        <mesh key={`f${x}`} position={[x, 0.06, 0.05]} castShadow>
          <boxGeometry args={[0.2, 0.12, 0.3]} />
          <primitive object={useMemo(() => mat(colors.secondary), [colors.secondary])} attach="material" />
        </mesh>
      ))}
      {/* braços */}
      {[-0.44, 0.44].map((x) => (
        <mesh key={`a${x}`} position={[x, 0.72, 0]} rotation={[0, 0, x > 0 ? -0.5 : 0.5]}>
          <capsuleGeometry args={[0.09, 0.3, 4, 10]} />
          <primitive object={useMemo(() => mat(colors.secondary), [colors.secondary])} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Acessórios identificáveis por agente — silhueta única. */
function Accessory({ agentId, colors }: { agentId: string; colors: AgentColors }) {
  const accent = useMemo(() => mat(colors.accent), [colors.accent]);
  const dark = useMemo(() => mat("#1b1e26"), []);
  switch (agentId) {
    case "aegis": // supervisor: coroa de comando + ombreiras
      return (
        <group position={[0, 1.62, 0]}>
          <mesh rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.34, 0.12, 6]} />
            <primitive object={accent} attach="material" />
          </mesh>
          {[-0.38, 0.38].map((x) => (
            <mesh key={x} position={[x, 0.85, 0]}>
              <sphereGeometry args={[0.14, 12, 10]} />
              <primitive object={accent} attach="material" />
            </mesh>
          ))}
        </group>
      );
    case "relay": // headset
      return (
        <group position={[0, 1.35, 0]}>
          <mesh rotation={[Math.PI / 2.4, 0, 0]}>
            <torusGeometry args={[0.4, 0.045, 8, 20, Math.PI]} />
            <primitive object={dark} attach="material" />
          </mesh>
          {[-0.4, 0.4].map((x) => (
            <mesh key={x} position={[x, -0.08, 0.05]}>
              <cylinderGeometry args={[0.09, 0.09, 0.08, 12]} />
              <primitive object={accent} attach="material" />
            </mesh>
          ))}
        </group>
      );
    case "scout": // chapéu de detetive + lupa
      return (
        <group>
          <mesh position={[0, 1.62, 0]} scale={[1, 0.55, 1]}>
            <sphereGeometry args={[0.4, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <primitive object={mat(colors.secondary)} attach="material" />
          </mesh>
          <mesh position={[0.5, 0.75, 0.25]} rotation={[0.6, 0, -0.4]}>
            <torusGeometry args={[0.14, 0.035, 8, 18]} />
            <primitive object={accent} attach="material" />
          </mesh>
          <mesh position={[0.56, 0.6, 0.3]} rotation={[0.6, 0, -0.4]}>
            <cylinderGeometry args={[0.03, 0.03, 0.22, 8]} />
            <primitive object={dark} attach="material" />
          </mesh>
        </group>
      );
    case "meridian": // óculos + prancheta
      return (
        <group>
          <group position={[0, 1.22, 0.36]}>
            {[-0.15, 0.15].map((x) => (
              <mesh key={x} position={[x, 0, 0]}>
                <torusGeometry args={[0.1, 0.018, 8, 16]} />
                <primitive object={dark} attach="material" />
              </mesh>
            ))}
            <mesh position={[0, 0, 0.01]}>
              <boxGeometry args={[0.12, 0.02, 0.02]} />
              <primitive object={dark} attach="material" />
            </mesh>
          </group>
          <mesh position={[0.42, 0.62, 0.28]} rotation={[-0.4, 0.3, 0]}>
            <boxGeometry args={[0.3, 0.02, 0.22]} />
            <primitive object={useMemo(() => mat("#f0ead8"), [])} attach="material" />
          </mesh>
        </group>
      );
    case "beacon": // antena + megafone
      return (
        <group>
          <mesh position={[0.3, 1.95, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
            <primitive object={dark} attach="material" />
          </mesh>
          <mesh position={[0.3, 2.22, 0]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <primitive object={accent} attach="material" />
          </mesh>
          <mesh position={[-0.45, 0.85, 0.2]} rotation={[0, 0, 0.7]}>
            <coneGeometry args={[0.16, 0.34, 14, 1, true]} />
            <primitive object={accent} attach="material" />
          </mesh>
        </group>
      );
    case "pledge": // relógio de pulso + crachá
      return (
        <group>
          <mesh position={[0.46, 0.85, 0.1]} rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.13, 0.13, 0.05, 16]} />
            <primitive object={useMemo(() => mat("#f0ead8"), [])} attach="material" />
          </mesh>
          <mesh position={[0, 1.0, 0.36]}>
            <boxGeometry args={[0.22, 0.16, 0.03]} />
            <primitive object={accent} attach="material" />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

export function AgentAvatar({
  agentId, colors, state, selected, onSelect, position, facing = 0,
}: {
  agentId: string;
  colors: AgentColors;
  state: VisualState;
  selected?: boolean;
  onSelect?: () => void;
  position: [number, number, number];
  facing?: number;
}) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) {
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.45 + Math.sin(clock.getElapsedTime() * 3) * 0.2;
    }
  });
  return (
    <group position={position} rotation={[0, facing, 0]}>
      {/* anel de seleção/estado no chão */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} onClick={(e) => { e.stopPropagation(); onSelect?.(); }}>
        <ringGeometry args={[0.62, 0.72, 32]} />
        <meshBasicMaterial color={selected ? "#ffffff" : colors.accent} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <group
        onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        <Body colors={colors} state={state} />
        <Accessory agentId={agentId} colors={colors} />
        {/* indicador de estado: pequena esfera flutuante */}
        <StateOrb state={state} />
      </group>
    </group>
  );
}

const STATE_COLOR: Record<VisualState, string> = {
  idle: "#8b93a7", listening: "#00d4ff", processing: "#ffc107",
  speaking: "#ff2d9b", success: "#34d399", error: "#f87171",
};

function StateOrb({ state }: { state: VisualState }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 2.15 + Math.sin(clock.getElapsedTime() * 2) * 0.05;
      const s = state === "idle" ? 0.8 : 1;
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <mesh ref={ref} position={[0, 2.15, 0]}>
      <sphereGeometry args={[0.09, 12, 10]} />
      <meshStandardMaterial color={STATE_COLOR[state]} emissive={STATE_COLOR[state]} emissiveIntensity={0.9} />
    </mesh>
  );
}
