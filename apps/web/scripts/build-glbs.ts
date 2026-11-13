/**
 * Exporta os seis bonequinhos procedurais para GLB estáticos.
 * Uso: pnpm --filter @bgo/web exec tsx scripts/build-glbs.ts
 * Saída: apps/web/public/assets/characters/glb/<agentId>.glb
 *
 * STATUS: GLBs de geometria+materiais (ETAPA 1 do pipeline). Sem rig,
 * sem clips de animação — ver docs/onda-04/03-CATALOGO-MODELOS.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { Document, NodeIO } from "@gltf-transform/core";
import { buildAgentCharacter, AGENT_COLORS } from "../src/office/characterModel";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, "..", "public", "assets", "characters", "glb");
const AGENTS = ["aegis", "relay", "scout", "meridian", "beacon", "pledge"] as const;

function colorToLinear(hex: string): [number, number, number] {
  const c = new THREE.Color(hex.startsWith("#") ? hex : `#${hex}`);
  return [c.r, c.g, c.b];
}

function stdToMaterial(doc: Document, mat: THREE.MeshStandardMaterial) {
  const m = doc
    .createMaterial(mat.name || "bgo-mat")
    .setBaseColorFactor([...colorToLinear(mat.color.getHexString()), mat.opacity])
    .setMetallicFactor(mat.metalness)
    .setRoughnessFactor(mat.roughness);
  if (mat.emissive && mat.emissiveIntensity > 0) {
    const e = mat.emissive;
    // KHR_materials_emissive_strength não é core — intensidades >1 são
    // aproximadas saturando o fator (registrado no catálogo de modelos)
    const k = Math.min(mat.emissiveIntensity, 1);
    m.setEmissiveFactor([Math.min(e.r * k, 1), Math.min(e.g * k, 1), Math.min(e.b * k, 1)]);
  }
  return m;
}

function otherToMaterial(doc: Document, mat: THREE.Material) {
  const anyMat = mat as THREE.MeshStandardMaterial;
  if (anyMat.isMeshStandardMaterial) return stdToMaterial(doc, anyMat);
  const hex = (mat as THREE.MeshBasicMaterial).color?.getHexString?.();
  const c = new THREE.Color(hex ? `#${hex}` : "#888888");
  return doc
    .createMaterial(mat.name || "bgo-mat")
    .setBaseColorFactor([c.r, c.g, c.b, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.9);
}

async function exportAgent(agentId: string) {
  const root = buildAgentCharacter(agentId, AGENT_COLORS[agentId]);
  root.updateMatrixWorld(true);

  const doc = new Document();
  const buffer = doc.createBuffer();
  const io = new NodeIO();
  const scene = doc.createScene("scene");
  const glbRoot = doc.createNode(`bgo-char-${agentId}`);
  scene.addChild(glbRoot);
  doc.getRoot().setDefaultScene(scene);

  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) meshes.push(mesh);
  });

  const gltfMeshes: { name: string; prims: unknown[] }[] = [];
  for (const m of meshes) {
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    const pos = geo.getAttribute("position");
    const norm = geo.getAttribute("normal");
    const index = geo.getIndex();
    if (!pos) continue;

    const posAcc = doc.createAccessor().setType("VEC3").setArray(pos.array as Float32Array).setBuffer(buffer);
    const normAcc = norm
      ? doc.createAccessor().setType("VEC3").setArray(norm.array as Float32Array).setBuffer(buffer)
      : undefined;
    const idxAcc = index
      ? doc.createAccessor().setType("SCALAR").setArray(index.array as Uint16Array | Uint32Array).setBuffer(buffer)
      : undefined;

    const prim = doc.createPrimitive().setAttribute("POSITION", posAcc);
    if (normAcc) prim.setAttribute("NORMAL", normAcc);
    if (idxAcc) prim.setIndices(idxAcc);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    prim.setMaterial(otherToMaterial(doc, mats[0]));

    const name = `${agentId}-${meshes.indexOf(m)}`;
    const meshNode = doc.createMesh(name).addPrimitive(prim);
    const node = doc.createNode(name).setMesh(meshNode);
    glbRoot.addChild(node);
    gltfMeshes.push({ name, prims: [prim] });
  }

  const out = await io.writeBinary(doc);
  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, `${agentId}.glb`);
  writeFileSync(file, Buffer.from(out));
  console.log(`${agentId}: ${meshes.length} meshes -> ${file} (${Math.round(out.byteLength / 1024)} KB)`);
}

for (const id of AGENTS) await exportAgent(id);
console.log("GLBs gerados em", OUT_DIR);
