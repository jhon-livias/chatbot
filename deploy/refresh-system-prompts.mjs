/**
 * refresh-system-prompts.mjs
 * Updates systemPrompt on all active conversations using live program data from MongoDB.
 * Run once after deploying the SystemPromptBuilderService feature.
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'chatbot_uprit';

const BASE = `Eres el asistente virtual oficial de UPRIT. Responde de manera concisa, amable y profesional en el mismo idioma que el usuario. Usa SOLO texto plano sin markdown (sin **, *, #, ni bloques de codigo) porque el canal es WhatsApp. Si no tienes informacion suficiente para responder, indica amablemente que el equipo de admisiones puede ayudar.`;

function formatProgram(p) {
  const lines = [`PROGRAMA: ${p.name}`];
  if (p.iaInformation) lines.push(`Info IA: ${p.iaInformation}`);
  if (p.summary) lines.push(`Resumen: ${p.summary}`);
  if (p.duration) lines.push(`Duracion: ${p.duration}`);
  if (p.academicDegree) lines.push(`Grado academico: ${p.academicDegree}`);
  if (p.professionalTitle) lines.push(`Titulo profesional: ${p.professionalTitle}`);
  if (p.scheduleDescription) lines.push(`Horarios: ${p.scheduleDescription}`);
  if (p.objective) lines.push(`Objetivo: ${p.objective}`);
  if (p.graduateProfile) lines.push(`Perfil del egresado: ${p.graduateProfile}`);
  if ((p.sellingPoints || []).length) lines.push(`Ventajas: ${p.sellingPoints.join('. ')}`);
  if ((p.jobOpportunities || []).length) lines.push(`Campo laboral: ${p.jobOpportunities.join(', ')}`);
  if ((p.admissionRequirements || []).length) lines.push(`Requisitos de admision: ${p.admissionRequirements.join(' | ')}`);
  const costs = (p.costs || []).filter(c => c.bachelorFolderFee > 0 || c.thesisFolderFee > 0);
  if (costs.length) {
    const s = costs.map(c => `${c.currency}: carpeta bachiller ${c.bachelorFolderFee}, carpeta tesis ${c.thesisFolderFee}`).join(' | ');
    lines.push(`Costos: ${s}`);
  }
  if (p.applicationFormUrl) lines.push(`Formulario de inscripcion: ${p.applicationFormUrl}`);
  if (p.whatsappContact) lines.push(`WhatsApp admisiones: ${p.whatsappContact}`);
  if ((p.faq || []).length) {
    lines.push('Preguntas frecuentes:');
    for (const qa of p.faq) {
      lines.push(`  P: ${qa.question}`);
      lines.push(`  R: ${qa.answer}`);
    }
  }
  return lines.join('\n');
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);

  const programs = await db.collection('programs').find({ status: 'active' }).toArray();
  console.log(`Loaded ${programs.length} active programs`);

  let systemPrompt;
  if (programs.length === 0) {
    console.warn('No active programs — using base prompt only');
    systemPrompt = BASE;
  } else {
    const blocks = programs.map(formatProgram).join('\n\n---\n\n');
    systemPrompt = `${BASE}\n\n== PROGRAMAS ACADEMICOS DE UPRIT ==\n\n${blocks}`;
  }

  console.log(`Built system prompt: ${systemPrompt.length} chars`);

  const result = await db.collection('conversations').updateMany(
    { status: 'active' },
    { $set: { systemPrompt, updatedAt: new Date() } }
  );
  console.log(`Updated ${result.modifiedCount} active conversation(s)`);

} finally {
  await client.close();
}
