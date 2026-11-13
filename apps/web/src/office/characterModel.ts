import * as THREE from "three";

/**
 * Construtor puro (sem React) dos bonequinhos do escritório — Onda 04/G35.
 * Usado por characters.tsx (runtime React) e por scripts/build-glbs.mjs
 * (exportação GLB). Geometria em primitivas Three.js → triângulos GLB.
 * STATUS: protótipo procedural v2 — expressivo, porém SEM rig/animações
 * esqueléticas; clips `idle|listening|processing|speaking|success|error`
 * ficam reservados para modelos finais (pipeline Onda 05).
 */

export interface AgentColors { primary: string; secondary: string; accent: string }

export const AGENT_COLORS: Record<string, AgentColors> = {
  aegis:    { primary: "#7c3aed", secondary: "#ffc107", accent: "#ffd54f" },
  relay:    { primary: "#2563eb", secondary: "#00d4ff", accent: "#00d4ff" },
  scout:    { primary: "#0d9488", secondary: "#38bdf8", accent: "#fbbf24" },
  meridian: { primary: "#0891b2", secondary: "#a78bfa", accent: "#e0e7ff" },
  beacon:   { primary: "#ea580c", secondary: "#ff2d9b", accent: "#ff8fb8" },
  pledge:   { primary: "#16a34a", secondary: "#34d399", accent: "#fde68a" },
};

const SKIN = "#f5f0e8";
const INK = "#14161c";
const DARK = "#1b1e26";

function std(color: string, opts: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number; opacity?: number } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.15,
    ...(opts.emissive ? { emissive: new THREE.Color(opts.emissive), emissiveIntensity: opts.emissiveIntensity ?? 0.4 } : {}),
    ...(opts.opacity !== undefined ? { transparent: true, opacity: opts.opacity } : {}),
  });
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material, pos: [number, number, number], rot?: [number, number, number], scale?: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  return m;
}

/** Cabeça expressiva: olhos grandes c/ íris colorida + brilho, sobrancelhas, boca. */
function head(colors: AgentColors): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, 1.18, 0);
  const skin = std(SKIN, { roughness: 0.5 });
  g.add(mesh(new THREE.SphereGeometry(0.42, 28, 22), skin, [0, 0, 0]));

  // olhos: branco + íris accent + pupila + brilho especular
  for (const x of [-0.16, 0.16]) {
    const eye = new THREE.Group();
    eye.position.set(x, 0.05, 0.355);
    eye.add(mesh(new THREE.SphereGeometry(0.11, 18, 14), std("#ffffff", { roughness: 0.15 }), [0, 0, 0], undefined, [1, 1.15, 0.55]));
    eye.add(mesh(new THREE.SphereGeometry(0.055, 14, 10), std(colors.accent, { emissive: colors.accent, emissiveIntensity: 0.35, roughness: 0.2 }), [0, 0, 0.055], undefined, [1, 1.2, 0.5]));
    eye.add(mesh(new THREE.SphereGeometry(0.026, 10, 8), std(INK, { roughness: 0.25 }), [0, 0, 0.085], undefined, [1, 1.2, 0.5]));
    eye.add(mesh(new THREE.SphereGeometry(0.011, 8, 6), std("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.9, roughness: 0.1 }), [0.018, 0.025, 0.095], undefined, [1, 1, 0.4]));
    g.add(eye);
    // sobrancelha expressiva
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.025, 0.03), std(INK, { roughness: 0.6 }), [x, 0.2, 0.37], [0.15, 0, x > 0 ? -0.18 : 0.18]));
  }
  // boca (sorriso sutil)
  g.add(mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 16, Math.PI * 0.8), std("#8a4a44", { roughness: 0.7 }), [0, -0.13, 0.37], [0.25, 0, Math.PI * 1.1]));
  // blush
  for (const x of [-0.27, 0.27]) {
    g.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), std(colors.accent, { roughness: 0.85, opacity: 0.5 }), [x, -0.07, 0.33], undefined, [1, 0.7, 0.4]));
  }
  return g;
}

function torso(colors: AgentColors): THREE.Group {
  const g = new THREE.Group();
  const body = std(colors.primary, { roughness: 0.5 });
  const accent = std(colors.secondary, { roughness: 0.45, metalness: 0.2 });
  g.add(mesh(new THREE.CapsuleGeometry(0.34, 0.5, 6, 16), body, [0, 0.55, 0]));
  g.add(mesh(new THREE.TorusGeometry(0.345, 0.05, 10, 28), accent, [0, 0.62, 0], [Math.PI / 2, 0, 0]));
  // gola/colarinho
  g.add(mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 20), std(colors.accent, { emissive: colors.accent, emissiveIntensity: 0.15 }), [0, 0.98, 0], [Math.PI / 2, 0, 0]));
  // braços articulados simples
  for (const x of [-0.46, 0.46]) {
    const arm = new THREE.Group();
    arm.position.set(x, 0.88, 0);
    arm.rotation.z = x > 0 ? -0.45 : 0.45;
    arm.add(mesh(new THREE.CapsuleGeometry(0.09, 0.34, 4, 12), accent, [0, -0.2, 0]));
    arm.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), std(SKIN, { roughness: 0.5 }), [0, -0.42, 0]));
    g.add(arm);
  }
  // pés
  for (const x of [-0.17, 0.17]) {
    g.add(mesh(new THREE.BoxGeometry(0.22, 0.13, 0.34), accent, [x, 0.065, 0.06]));
  }
  return g;
}

/** Acessórios por agente — silhueta e função identificáveis. */
function accessory(agentId: string, colors: AgentColors): THREE.Group {
  const g = new THREE.Group();
  const accent = std(colors.accent, { emissive: colors.accent, emissiveIntensity: 0.25, roughness: 0.35 });
  const dark = std(DARK, { roughness: 0.4, metalness: 0.4 });
  const gold = std("#ffc107", { emissive: "#ffc107", emissiveIntensity: 0.3, metalness: 0.6, roughness: 0.3 });
  const paper = std("#f0ead8", { roughness: 0.8 });
  switch (agentId) {
    case "aegis": { // manto de liderança + coroa de comando
      g.add(mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.5, 6), std(colors.secondary, { roughness: 0.6 }), [0, 0.42, -0.06], undefined, [1, 1, 0.7]));
      g.add(mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 6), gold, [0, 1.66, 0]));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(mesh(new THREE.ConeGeometry(0.045, 0.16, 6), gold, [Math.cos(a) * 0.24, 1.8, Math.sin(a) * 0.24]));
      }
      g.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), std("#8b7dff", { emissive: "#8b7dff", emissiveIntensity: 0.6 }), [0, 1.66, 0.26]));
      break;
    }
    case "relay": { // headset de coordenação + crachá de líder
      g.add(mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24, Math.PI), dark, [0, 1.34, 0], [Math.PI / 2.3, 0, 0]));
      for (const x of [-0.42, 0.42]) {
        g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 14), accent, [x, 1.22, 0.02], [0, 0, Math.PI / 2]));
        g.add(mesh(new THREE.SphereGeometry(0.035, 8, 8), std("#00d4ff", { emissive: "#00d4ff", emissiveIntensity: 0.8 }), [x + (x > 0 ? 0.05 : -0.05), 1.22, 0.07]));
      }
      g.add(mesh(new THREE.BoxGeometry(0.16, 0.2, 0.03), accent, [0.3, 0.95, 0.37]));
      break;
    }
    case "scout": { // chapéu fedora + lupa
      g.add(mesh(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(colors.secondary, { roughness: 0.6 }), [0, 1.6, 0], undefined, [1.05, 0.6, 1.05]));
      g.add(mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.05, 20), dark, [0, 1.62, 0]));
      g.add(mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 20), gold, [0.52, 0.72, 0.28], [0.7, 0, -0.5]));
      g.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.26, 8), dark, [0.57, 0.58, 0.33], [0.7, 0, -0.5]));
      g.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), accent, [0.6, 0.5, 0.36]));
      break;
    }
    case "meridian": { // óculos redondos + prancheta com gráfico
      for (const x of [-0.15, 0.15]) {
        g.add(mesh(new THREE.TorusGeometry(0.105, 0.02, 8, 20), dark, [x, 1.22, 0.37]));
        g.add(mesh(new THREE.CircleGeometry(0.095, 20), std("#bfe9ff", { roughness: 0.1, opacity: 0.35 }), [x, 1.22, 0.375]));
      }
      g.add(mesh(new THREE.BoxGeometry(0.14, 0.02, 0.02), dark, [0, 1.22, 0.375]));
      const board = new THREE.Group();
      board.position.set(0.45, 0.68, 0.3);
      board.rotation.set(-0.5, 0.35, 0);
      board.add(mesh(new THREE.BoxGeometry(0.32, 0.24, 0.03), paper, [0, 0, 0]));
      board.add(mesh(new THREE.BoxGeometry(0.24, 0.02, 0.005), accent, [0, 0.05, 0.02]));
      board.add(mesh(new THREE.BoxGeometry(0.02, 0.16, 0.005), accent, [-0.08, -0.02, 0.02]));
      board.add(mesh(new THREE.BoxGeometry(0.02, 0.11, 0.005), std("#34d399"), [0.04, -0.045, 0.02]));
      g.add(board);
      break;
    }
    case "beacon": { // headset de energia + megafone + raio no peito
      g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8), dark, [0.28, 1.98, 0]));
      g.add(mesh(new THREE.SphereGeometry(0.09, 14, 12), std("#ff2d9b", { emissive: "#ff2d9b", emissiveIntensity: 0.7 }), [0.28, 2.28, 0]));
      g.add(mesh(new THREE.ConeGeometry(0.18, 0.4, 16, 1, true), accent, [-0.48, 0.9, 0.22], [0, 0, 0.8]));
      g.add(mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 18), dark, [-0.48, 0.9, 0.22], [0, 0, 0.8 + Math.PI / 2]));
      g.add(mesh(new THREE.ConeGeometry(0.09, 0.2, 5), gold, [0, 0.72, 0.36], [Math.PI, 0, 0]));
      break;
    }
    case "pledge": { // relógio + agenda/crachá + corrente
      g.add(mesh(new THREE.TorusGeometry(0.14, 0.025, 8, 20), gold, [0.48, 0.9, 0.12], [0, 0, -0.5]));
      g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 18), paper, [0.5, 0.86, 0.14], [Math.PI / 2, 0, -0.5]));
      g.add(mesh(new THREE.BoxGeometry(0.012, 0.09, 0.01), dark, [0.52, 0.9, 0.18], [0, 0, -0.5]));
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.26, 0.04), paper, [0, 0.85, 0.37], [-0.12, 0, 0]));
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.045), accent, [0, 0.97, 0.365], [-0.12, 0, 0]));
      g.add(mesh(new THREE.SphereGeometry(0.025, 8, 8), accent, [0, 1.0, 0.37], undefined, undefined));
      break;
    }
    default:
      break;
  }
  return g;
}

/** Altura total do bonequinho (para normalização GLB ~2.3 unidades). */
export const CHARACTER_HEIGHT = 2.35;

/** Monta o bonequinho completo: corpo + cabeça + acessórios. */
export function buildAgentCharacter(agentId: string, colors: AgentColors): THREE.Group {
  const root = new THREE.Group();
  root.name = `bgo-char-${agentId}`;
  root.add(torso(colors));
  root.add(head(colors));
  root.add(accessory(agentId, colors));
  return root;
}
