import { PrismaStore } from "./src/store";
import { runDemoFlow, decideApproval, captureLead } from "@bgo/commercial";

const store = new PrismaStore();
await store.init();
console.log("workspace:", store.workspace.slug);

// captura real
const cap = await captureLead(store, {
  name: "Teste Persistência", company: "ACME", email: "teste@acme.com",
  interest: "interesse comercial", source: "website_form",
  privacy: { noticeVersion: "lgpd-notice-v1", marketingOptIn: false, channels: ["email"] },
}, "smoke");
console.log("capture:", JSON.stringify(cap));

// dedup
const cap2 = await captureLead(store, {
  name: "Teste Persistência", company: "ACME", email: "TESTE@acme.com",
  interest: "interesse comercial", source: "website_form",
  privacy: { noticeVersion: "lgpd-notice-v1", marketingOptIn: false, channels: ["email"] },
}, "smoke");
console.log("dedup duplicate:", cap2.duplicate, cap2.leadId === cap.leadId);

// demo flow
const r = await runDemoFlow(store);
console.log("demo:", r.mission.status, r.lead.status, "approval:", r.approvalId.slice(0,8));
const d = await decideApproval(store, r.approvalId, "approved", "user:smoke");
console.log("decided:", d.missionStatus);

const counts = {
  leads: (await store.listLeads()).length,
  missions: (await store.listMissions()).length,
  runs: (await store.listRuns()).length,
  steps: (await store.listSteps()).length,
  approvals: (await store.listApprovals()).length,
  audit: (await store.listAudit({ limit: 500 })).length,
};
console.log("counts:", JSON.stringify(counts));
process.exit(0);
