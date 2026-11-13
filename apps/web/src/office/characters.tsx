import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { VisualState } from "@bgo/contracts";
import { buildAgentCharacter, type AgentColors } from "./characterModel";

export type { AgentColors } from "./characterModel";

/**
 * Bonequinhos do escritório (Onda 04/G35).
 * Ordem de renderização: GLB oficial (`/assets/characters/glb/<id>.glb`)
 * quando presente e válido → fallback procedural (`characterModel.ts`).
 * Animações de estado (bob/shake/tilt) são aplicadas no grupo inteiro —
 * clips esqueléticos `idle|listening|processing|speaking|success|error`
 * ficam reservados para os GLBs rigados finais (pipeline Onda 05).
 */

const STATE_TUNE: Record<VisualState, { bob: number; speed: number; pulse: number; shake: number; spin: number }> = {
  idle:       { bob: 0.03, speed: 2.0,  pulse: 1.0,  shake: 0, spin: 0 },
  listening:  { bob: 0.05, speed: 3.0,  pulse: 1.0,  shake: 0, spin: 0 },
  processing: { bob: 0.09, speed: 7.0,  pulse: 1.0,  shake: 0, spin: 1 },
  speaking:   { bob: 0.07, speed: 5.0,  pulse: 1.06, shake: 0, spin: 0 },
  success:    { bob: 0.12, speed: 6.0,  pulse: 1.12, shake: 0, spin: 0 },
  error:      { bob: 0.02, speed: 9.0,  pulse: 1.0,  shake: 1, spin: 0 },
};

function useReducedMotion(): boolean {
  return useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
    [],
  );
}

/** Aplica o movimento do estado visual ao grupo da figura (GLB ou procedural). */
function AnimatedFigure({ state, children }: { state: VisualState; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  const tune = STATE_TUNE[state];
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!g.current) return;
    const amp = reduced ? 0 : tune.bob;
    const speed = reduced ? 0.5 : tune.speed;
    g.current.position.y = Math.abs(Math.sin(t * speed)) * amp;
    g.current.rotation.z = tune.shake && !reduced ? Math.sin(t * 30) * 0.06 : 0;
    g.current.rotation.y = tune.spin && !reduced ? Math.sin(t * 3) * 0.4 : 0;
    const s = tune.pulse;
    g.current.scale.setScalar(s === 1 ? 1 : 1 + (s - 1) * (0.5 + Math.sin(t * 6) * 0.5));
  });
  return <group ref={g}>{children}</group>;
}

/** GLB oficial do agente — só renderiza se o arquivo carregar. */
function GlbFigure({ agentId }: { agentId: string }) {
  const { scene } = useGLTF(`/assets/characters/glb/${agentId}.glb`);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => { x.side = THREE.FrontSide; });
        else if (m) m.side = THREE.FrontSide;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={cloned} />;
}

class GlbBoundary extends Component<{ fallback: ReactNode; onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Figure({ agentId, colors, state }: { agentId: string; colors: AgentColors; state: VisualState }) {
  const [glbFailed, setGlbFailed] = useState(false);
  const procedural = useMemo(() => buildAgentCharacter(agentId, colors), [agentId, colors]);
  return (
    <AnimatedFigure state={state}>
      {glbFailed ? (
        <primitive object={procedural} />
      ) : (
        <GlbBoundary fallback={<primitive object={procedural} />} onError={() => setGlbFailed(true)}>
          <Suspense fallback={<primitive object={procedural} />}>
            <GlbFigure agentId={agentId} />
          </Suspense>
        </GlbBoundary>
      )}
    </AnimatedFigure>
  );
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
        <Figure agentId={agentId} colors={colors} state={state} />
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
      ref.current.position.y = 2.35 + Math.sin(clock.getElapsedTime() * 2) * 0.05;
      const s = state === "idle" ? 0.8 : 1;
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <mesh ref={ref} position={[0, 2.35, 0]}>
      <sphereGeometry args={[0.09, 12, 10]} />
      <meshStandardMaterial color={STATE_COLOR[state]} emissive={STATE_COLOR[state]} emissiveIntensity={0.9} />
    </mesh>
  );
}
