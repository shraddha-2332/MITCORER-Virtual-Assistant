import fs from 'node:fs';

let s = fs.readFileSync('backend/src/server.js', 'utf8');

const target = '  const question = body.question.trim();\r\n';
const replacement = `  const question = body.question.trim();
  const safetyCheck = inspectPromptSafety(question);
  if (!safetyCheck.safe && safetyCheck.response) {
    audit('assistant.asked', 'assistant', generateId('ASK'), user, safetyCheck.response.source);
    return safetyCheck.response;
  }\r\n`;

const idx = s.indexOf(target, s.indexOf('export async function answerAdmissionQuestion'));
if (idx !== -1) {
  s = s.slice(0, idx) + replacement + s.slice(idx + target.length);
  fs.writeFileSync('backend/src/server.js', s, 'utf8');
  console.log('Safety check placed at top of answerAdmissionQuestion');
} else {
  console.log('Could not find target');
}
