import { PrismaClient } from "@prisma/client";
const pc = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL! } } });
for (let i=0;i<3;i++){
  const r = await pc.$queryRawUnsafe("select current_database() d");
  console.log(i, r[0].d);
}
await pc.$disconnect();
process.exit(0);
