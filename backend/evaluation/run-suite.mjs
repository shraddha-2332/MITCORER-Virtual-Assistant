import fs from 'fs';
import { createPublicSession } from '../src/public-session.js';
import { askPublicWithHistory } from '../src/conversations.js';
import { answerAdmissionQuestion } from '../src/server.js';

async function main() {
  const testBank = JSON.parse(fs.readFileSync('backend/evaluation/test-bank-200.json', 'utf8'));
  const results = [];
  const convSessions = {
    convA: { session: createPublicSession(), conversationId: null },
    convB: { session: createPublicSession(), conversationId: null },
    convC: { session: createPublicSession(), conversationId: null },
  };

  console.log('Starting execution of ' + testBank.length + ' questions...');
  const startTime = Date.now();

  for (let i = 0; i < testBank.length; i++) {
    const item = testBank[i];
    let res;
    try {
      if (item.conversation) {
        const cs = convSessions[item.conversation];
        res = await askPublicWithHistory({
          question: item.q,
          conversationId: cs.conversationId
        }, answerAdmissionQuestion, cs.session);
        cs.conversationId = res.conversationId;
      } else {
        res = await answerAdmissionQuestion({ question: item.q }, null);
      }
      results.push({
        id: item.id,
        section: item.section,
        question: item.q,
        answer: res.answer,
        source: res.source,
        outcomeStatus: res.outcomeStatus || (res.clarification ? 'CLARIFICATION_REQUIRED' : 'SUCCESS'),
        model: res.model
      });
    } catch (err) {
      results.push({
        id: item.id,
        section: item.section,
        question: item.q,
        answer: 'ERROR: ' + err.message,
        source: 'Error',
        outcomeStatus: 'ERROR'
      });
    }
    if ((i + 1) % 50 === 0 || i === testBank.length - 1) {
      console.log('Executed ' + (i + 1) + '/' + testBank.length + ' questions...');
    }
  }

  fs.writeFileSync('backend/evaluation/test-results-200.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('Finished in ' + ((Date.now() - startTime) / 1000).toFixed(1) + 's');
}

main().catch(console.error);

