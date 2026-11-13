/**
 * Exporta os seis bonequinhos para GLB com clips de animação reais.
 * Uso: pnpm --filter @bgo/web exec tsx scripts/build-glbs.ts
 * Saída: apps/web/public/assets/characters/glb/<agentId>.glb
 *
 * Animação por NÓS rígidos (Head/ArmL/ArmR/Body/Acc) — NÃO é rig
 * esquelético/deformação. Clips nomeados = VISUAL_STATES:
 * idle|listening|processing|speaking|success|error (loop de 2s).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { Document, NodeIO, type Node as GltfNode, type Material as GltfMaterial, type Primitive as GltfPrimitive, type Animation as GltfAnimation } from "@gltf-transform/core";
import { buildAgentCharacter, AGENT_COLORS } from "../src/office/characterModel";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, "..", "public", "assets", "characters", "glb");
const AGENTS = ["aegis", "relay", "scout", "meridian", "beacon", "pledge"] as const;
const CLIP_LEN = 2.0;

function colorToLinear(hex: string): [number, number, number] {
  const c = new THREE.Color(hex.startsWith("#") ? hex : `#${hex}`);
  return [c.r, c.g, c.b];
}

function stdToMaterial(doc: Document, mat: THREE.MeshStandardMaterial): GltfMaterial {
  const m = doc
    .createMaterial(mat.name || "bgo-mat")
    .setBaseColorFactor([...colorToLinear(mat.color.getHexString()), mat.opacity])
    .setMetallicFactor(mat.metalness)
    .setRoughnessFactor(mat.roughness);
  if (mat.emissive && mat.emissiveIntensity > 0) {
    const e = mat.emissive;
    const k = Math.min(mat.emissiveIntensity, 1);
    m.setEmissiveFactor([Math.min(e.r * k, 1), Math.min(e.g * k, 1), Math.min(e.b * k, 1)]);
  }
  return m;
}

function toMaterial(doc: Document, mat: THREE.Material): GltfMaterial {
  const sm = mat as THREE.MeshStandardMaterial;
  if (sm.isMeshStandardMaterial) return stdToMaterial(doc, sm);
  const hex = (mat as THREE.MeshBasicMaterial).color?.getHexString?.();
  const c = new THREE.Color(hex ? `#${hex}` : "#888888");
  return doc.createMaterial(mat.name || "bgo-mat").setBaseColorFactor([c.r, c.g, c.b, 1]).setMetallicFactor(0).setRoughnessFactor(0.9);
}

interface Ctx {
  doc: Document;
  buffer: ReturnType<Document["createBuffer"]>;
  nodeByName: Map<string, GltfNode>;
}

function exportObject(ctx: Ctx, obj: THREE.Object3D, parent: GltfNode): GltfNode {
  const { doc } = ctx;
  const node = doc.createNode(obj.name || obj.type);
  node.setTranslation([obj.position.x, obj.position.y, obj.position.z]);
  const q = obj.quaternion;
  node.setRotation([q.x, q.y, q.z, q.w]);
  node.setScale([obj.scale.x, obj.scale.y, obj.scale.z]);
  parent.addChild(node);
  if (obj.name) ctx.nodeByName.set(obj.name, node);

  const mesh = obj as THREE.Mesh;
  if (mesh.isMesh) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute("position");
    const norm = geo.getAttribute("normal");
    const index = geo.getIndex();
    if (pos) {
      const prim = doc.createPrimitive().setAttribute(
        "POSITION",
        doc.createAccessor().setType("VEC3").setArray(pos.array as Float32Array).setBuffer(ctx.buffer),
      );
      if (norm) prim.setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(norm.array as Float32Array).setBuffer(ctx.buffer));
      if (index) prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(index.array as Uint16Array | Uint32Array).setBuffer(ctx.buffer));
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      prim.setMaterial(toMaterial(doc, mats[0]));
      const meshName = `${obj.name || "mesh"}-${Math.random().toString(36).slice(2, 6)}`;
      node.setMesh(doc.createMesh(meshName).addPrimitive(prim as GltfPrimitive));
    }
  }
  for (const child of obj.children) exportObject(ctx, child, node);
  return node;
}

/* ---------- animações (keyframes → canais glTF) ---------- */

type Path = "translation" | "rotation" | "scale";
interface Track { node: string; path: Path; times: number[]; values: number[][] }

function eulerKeys(times: number[], eulers: [number, number, number][]): number[][] {
  return eulers.map(([x, y, z]) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
    return [q.x, q.y, q.z, q.w];
  });
}

const T = (a: number, b: number, n = 5) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const sine = (times: number[], amp: number, phase = 0) => times.map((t) => Math.sin((t / CLIP_LEN) * Math.PI * 2 + phase) * amp);

function tracksFor(state: string): Track[] {
  const tt = T(0, CLIP_LEN);
  switch (state) {
    case "idle":
      return [
        { node: "Head", path: "rotation", times: tt, values: eulerKeys(tt, tt.map((t, i) => [0, 0, Math.sin(i * 1.7) * 0.04])) },
        { node: "Body", path: "translation", times: tt, values: tt.map((t) => [0, Math.sin((t / CLIP_LEN) * Math.PI * 2) * 0.02, 0]) },
        { node: "ArmL", path: "rotation", times: tt, values: eulerKeys(tt, tt.map((t, i) => [0, 0, 0.45 + Math.sin((i / 4) * Math.PI * 2) * 0.05])) },
      ];
    case "listening":
      return [
        { node: "Head", path: "rotation", times: tt, values: eulerKeys(tt, tt.map((t) => [-0.06, Math.sin((t / CLIP_LEN) * Math.PI * 2) * 0.18, 0])) },
        { node: "ArmL", path: "rotation", times: tt, values: eulerKeys(tt, tt.map(() => [0.15, 0, 0.45])) },
        { node: "ArmR", path: "rotation", times: tt, values: eulerKeys(tt, tt.map(() => [0.15, 0, -0.45])) },
      ];
    case "processing":
      return [
        { node: "Head", path: "rotation", times: tt, values: eulerKeys(tt, tt.map((t) => [0.05, Math.sin((t / CLIP_LEN) * Math.PI * 4) * 0.5, 0])) },
        { node: "ArmL", path: "rotation", times: tt, values: eulerKeys(tt, tt.map(() => [-0.9, 0, 0.45])) },
        { node: "ArmR", path: "rotation", times: tt, values: eulerKeys(tt, tt.map(() => [-0.9, 0, -0.45])) },
        { node: "Body", path: "rotation", times: tt, values: eulerKeys(tt, tt.map((t) => [0, 0, Math.sin((t / CLIP_LEN) * Math.PI * 6) * 0.03])) },
      ];
    case "speaking":
      return [
        { node: "Head", path: "rotation", times: tt, values: eulerKeys(tt, tt.map((t) => [Math.sin((t / CLIP_LEN) * Math.PI * 2) * 0.08, 0, 0])) },
        { node: "ArmL", path: "rotation", times: tt, values: eulerKeys(tt, tt.map((t, i) => [Math.sin(i * 1.57) * 0.4, 0, 0.45])) },
        { node: "ArmR", path: "rotation", times: tt, values: eulerKeys(tt, tt.map((t, i) => [Math.sin(i * 1.57 + Math.PI) * 0.4, 0, -0.45])) },
      ];
    case "success":
      return [
        { node: "bgo-char-root", path: "translation", times: [0, 0.5, 1.0, 1.5, 2.0], values: [[0, 0, 0], [0, 0.28, 0], [0, 0, 0], [0, 0.28, 0], [0, 0, 0]] },
        { node: "ArmL", path: "rotation", times: tt, values: eulerKeys(tt, tt.map(() => [0, 0, 2.5])) },
        { node: "ArmR", path: "rotation", times: tt, values: eulerKeys(tt, tt.map(() => [0, 0, -2.5])) },
        { node: "Head", path: "rotation", times: tt, values: eulerKeys(tt, tt.map(() => [-0.15, 0, 0])) },
      ];
    case "error":
      return [
        { node: "Body", path: "rotation", times: tt, values: eulerKeys(tt, tt.map((t) => [0, 0, Math.sin((t / CLIP_LEN) * Math.PI * 8) * 0.08])) },
        { node: "Head", path: "rotation", times: tt, values: eulerKeys(tt, tt.map(() => [0, 0, 0.3])) },
      ];
    default:
      return [];
  }
}

function addClip(ctx: Ctx, anim: GltfAnimation, track: Track) {
  const target = ctx.nodeByName.get(track.node);
  if (!target) return;
  const times = new Float32Array(track.times);
  const flat = track.values.flat();
  const outArr = track.path === "rotation" ? new Float32Array(flat) : new Float32Array(flat);
  const input = ctx.doc.createAccessor().setType("SCALAR").setArray(times).setBuffer(ctx.buffer);
  const output = ctx.doc.createAccessor()
    .setType(track.path === "rotation" ? "VEC4" : "VEC3")
    .setArray(outArr)
    .setBuffer(ctx.buffer);
  const sampler = ctx.doc.createAnimationSampler().setInterpolation("LINEAR").setInput(input).setOutput(output);
  const channel = ctx.doc.createAnimationChannel().setTargetNode(target).setTargetPath(track.path).setSampler(sampler);
  anim.addSampler(sampler).addChannel(channel);
}

async function exportAgent(agentId: string) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("scene");
  doc.getRoot().setDefaultScene(scene);
  const rootNode = doc.createNode("bgo-char-root");
  scene.addChild(rootNode);

  const ctx: Ctx = { doc, buffer, nodeByName: new Map([["bgo-char-root", rootNode]]) };
  const group = buildAgentCharacter(agentId, AGENT_COLORS[agentId]);
  // root do personagem vira "bgo-char-root"; filhos exportados sob ele
  for (const child of group.children) exportObject(ctx, child, rootNode);

  // clips de animação — um por VISUAL_STATE
  for (const state of ["idle", "listening", "processing", "speaking", "success", "error"]) {
    const anim = doc.createAnimation(state); // createAnimation já registra no Root
    for (const tr of tracksFor(state)) addClip(ctx, anim, tr);
  }

  const out = await new NodeIO().writeBinary(doc);
  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, `${agentId}.glb`);
  writeFileSync(file, Buffer.from(out));
  let meshCount = 0;
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshCount++; });
  console.log(`${agentId}: ${meshCount} meshes, 6 clips -> ${file} (${Math.round(out.byteLength / 1024)} KB)`);
}

for (const id of AGENTS) await exportAgent(id);
console.log("GLBs animados gerados em", OUT_DIR);
