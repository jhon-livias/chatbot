#!/usr/bin/env node
/**
 * Reassigns conversations away from a test agent (default: zero.dev).
 *
 * Usage (from repo root):
 *   node --env-file=.env deploy/reassign-test-agent-chats.mjs
 *
 * Optional env vars:
 *   TEST_AGENT_USERNAME   default: zero.dev
 *   MONGODB_URI
 *   MONGODB_DB_NAME
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/chatbot_uprit';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? 'chatbot_uprit';
const TEST_USERNAME = (process.env.TEST_AGENT_USERNAME ?? 'zero.dev').toLowerCase().trim();

await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
console.log(`✅ Connected to MongoDB (${MONGODB_DB_NAME})\n`);

const db = mongoose.connection.db;
const agentsCol = db.collection('agents');
const convCol = db.collection('conversations');
const funnelCol = db.collection('funnel_users');

const testAgent = await agentsCol.findOne({ username: TEST_USERNAME });
if (!testAgent) {
  console.error(`❌ Agente de prueba "${TEST_USERNAME}" no encontrado.`);
  process.exit(1);
}

const testAgentId = testAgent.id;
console.log(`Test agent: ${testAgent.name} (${TEST_USERNAME}) → ${testAgentId}\n`);

const otherAgents = await agentsCol
  .find({ status: 'Active', username: { $ne: TEST_USERNAME }, role: { $ne: 'admin' } })
  .project({ id: 1, name: 1, username: 1 })
  .toArray();

if (otherAgents.length === 0) {
  console.error('❌ No hay otros agentes activos para reasignar.');
  process.exit(1);
}

console.log('Agentes destino:');
for (const a of otherAgents) console.log(`  - ${a.name} (${a.username ?? 'sin username'})`);

const convs = await convCol
  .find({ assignedAgentId: testAgentId, status: 'active' })
  .project({ id: 1, phoneNumber: 1, contactName: 1 })
  .toArray();

if (convs.length === 0) {
  console.log('\n✅ No hay conversaciones asignadas a este agente de prueba.');
  await mongoose.disconnect();
  process.exit(0);
}

console.log(`\nReasignando ${convs.length} conversación(es)...\n`);

let idx = 0;
for (const conv of convs) {
  const target = otherAgents[idx % otherAgents.length];
  idx++;

  await convCol.updateOne(
    { id: conv.id },
    {
      $set: {
        assignedAgentId: target.id,
        updatedAt: new Date(),
      },
    },
  );

  if (conv.phoneNumber) {
    await funnelCol.updateMany(
      { senderId: conv.phoneNumber },
      { $set: { assignedAgent: target.id } },
    );
  }

  const label = conv.contactName ?? conv.phoneNumber ?? conv.id;
  console.log(`  ✓ ${label} → ${target.name}`);
}

console.log(`\n✅ ${convs.length} chat(s) reasignados. "${TEST_USERNAME}" ya no tiene conversaciones.`);

await mongoose.disconnect();
console.log('Done.');
