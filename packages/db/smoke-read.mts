import { PrismaStore } from "./src/store";
const store = new PrismaStore();
await store.init();
const leads = await store.listLeads();
const missions = await store.listMissions();
const approvals = await store.listApprovals();
const audit = await store.listAudit({ limit: 500 });
console.log(JSON.stringify({
  leads: leads.length,
  leadEmails: leads.map(l=>l.email),
  missions: missions.map(m=>m.status),
  approvals: approvals.map(a=>a.status),
  audit: audit.length,
}, null, 1));
process.exit(0);
