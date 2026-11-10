import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup environment and import backend internals
process.env.NODE_ENV = 'test';
process.env.DATABASE_FILE = path.resolve(process.cwd(), 'data', 'mitra.sqlite');

import { config } from '../src/config.js';
import { loadDb, getDb } from '../src/store.js';
import { answerAdmissionQuestion } from '../src/server.js';
import { numericTokens, normalizeDigits } from '../src/language.js';

loadDb();

const SCRIPT_ALIASES = {
  'सोलापूर': ['solapur', 'सोलापूर', 'सोलापुर', 'pahsu'],
  'सोलापुर': ['solapur', 'सोलापूर', 'सोलापुर', 'pahsu'],
  'solapur': ['solapur', 'सोलापूर', 'सोलापुर', 'pahsu'],
  'बार्शी': ['barshi', 'बार्शी', 'बारशी'],
  'barshi': ['barshi', 'बार्शी', 'बारशी'],
  'railway': ['railway', 'रेल्वे', 'रेलवे'],
  'signaling': ['signaling', 'signalling', 'सिग्नलिंग', 'सिग्नल'],
  'track': ['track', 'ट्रॅक', 'ट्रैक'],
  'library': ['library', 'ग्रंथालय', 'पुस्तकालय', 'लाइब्रेरी'],
  'digital resources': ['digital resources', 'डिजिटल संसाधने', 'डिजिटल संसाधन', 'डिजिटल संसाधनों'],
  'cricket': ['cricket', 'क्रिकेट'],
  'volleyball': ['volleyball', 'व्हॉलीबॉल', 'वॉलीबॉल'],
  'badminton': ['badminton', 'बॅडमिंटन', 'बैडमिंटन'],
  'workshop': ['workshop', 'कार्यशाळा', 'वर्कशॉप'],
  'welding': ['welding', 'वेल्डिंग', 'वेल्डिंग शॉप'],
  'ragging': ['ragging', 'anti-ragging', 'रॅगिंग', 'रैगिंग'],
  'anti-ragging': ['anti-ragging', 'ragging', 'रॅगिंग', 'रैगिंग'],
  'safety': ['safety', 'सुरक्षा', 'सुरक्षा व्यवस्था', 'सुरक्षा नियम'],
  'machine shop': ['machine shop', 'मशीन शॉप'],
  'carpentry': ['carpentry', 'सुतारकाम'],
};

function factMatches(normText, fact) {
  const cleanFact = fact.replace(/,/g, '').trim().toLowerCase();
  const lowerText = normText.toLowerCase();
  if (lowerText.includes(cleanFact) || normText.includes(fact)) return true;
  const aliases = SCRIPT_ALIASES[cleanFact];
  if (aliases && aliases.some(alias => lowerText.includes(alias.toLowerCase()))) return true;
  const normDigitsText = normalizeDigits(normText);
  const normDigitsFact = normalizeDigits(cleanFact);
  if (normDigitsText.toLowerCase().includes(normDigitsFact.toLowerCase())) return true;
  return false;
}

function evaluateResponse(c, res) {
  const text = res.answer || '';
  const outcomeStatus = res.outcomeStatus || '';
  const evidenceIds = (res.evidence || []).map(e => e.id);
  const escalation = res.escalation || null;

  // 1. Factual Correctness (FC)
  let fcScore = 'not-applicable';
  let fcNumeric = null;
  if (c.answerability === 'ANSWERABLE') {
    if (c.requiredFacts && c.requiredFacts.length > 0) {
      let matchedCount = 0;
      for (const fact of c.requiredFacts) {
        // match case-insensitively, script-aware alias or numeric
        const normText = text.replace(/,/g, '');
        if (factMatches(normText, fact)) {
          matchedCount++;
        }
      }
      if (matchedCount === c.requiredFacts.length) {
        fcScore = 'correct';
        fcNumeric = 1.0;
      } else if (matchedCount > 0) {
        fcScore = 'partial';
        fcNumeric = 0.5;
      } else {
        fcScore = 'incorrect';
        fcNumeric = 0.0;
      }
    } else {
      fcScore = 'correct';
      fcNumeric = 1.0;
    }
  }

  // 2. Source Support (SS)
  let ssScore = 'not-applicable';
  let ssNumeric = null;
  if (c.answerability === 'ANSWERABLE') {
    if (c.expectedSourceId) {
      if (evidenceIds.includes(c.expectedSourceId) || (res.sourceUrl && res.sourceUrl.length > 0) || res.source !== 'No verified record') {
        ssScore = 'full';
        ssNumeric = 1.0;
      } else {
        ssScore = 'unsupported';
        ssNumeric = 0.0;
      }
    } else {
      ssScore = evidenceIds.length > 0 ? 'full' : 'unsupported';
      ssNumeric = evidenceIds.length > 0 ? 1.0 : 0.0;
    }
  }

  // 3. Completeness (CP)
  let cpScore = 'not-applicable';
  let cpNumeric = null;
  if (c.answerability === 'ANSWERABLE') {
    if (fcNumeric === 1.0) {
      cpScore = 'complete';
      cpNumeric = 1.0;
    } else if (fcNumeric === 0.5) {
      cpScore = 'partial';
      cpNumeric = 0.5;
    } else {
      cpScore = 'incomplete';
      cpNumeric = 0.0;
    }
  }

  // 4. Appropriate Referral / Abstention (AA)
  let aaScore = 'no';
  let aaNumeric = 0.0;
  if (c.answerability === 'UNANSWERABLE') {
    // Should NOT answer factually, should indicate unverified/insufficient evidence or clarify/abstain
    const isAbstained = outcomeStatus === 'INSUFFICIENT_EVIDENCE'
      || outcomeStatus === 'UNSUPPORTED_TOPIC'
      || res.source === 'No verified record'
      || text.includes('could not find an official answer')
      || text.includes('माहिती उपलब्ध नाही')
      || text.includes('जानकारी उपलब्ध नहीं');
    if (isAbstained && escalation?.available) {
      aaScore = 'yes';
      aaNumeric = 1.0;
    } else if (isAbstained) {
      aaScore = 'partial';
      aaNumeric = 0.5;
    } else {
      aaScore = 'no';
      aaNumeric = 0.0;
    }
  } else if (c.answerability === 'AMBIGUOUS') {
    // Should request clarification
    const isClarification = outcomeStatus === 'CLARIFICATION'
      || res.clarification
      || text.includes('clarify')
      || text.includes('स्पष्ट करा')
      || text.includes('स्पष्ट करें')
      || (res.suggestions && res.suggestions.length > 0);
    if (isClarification) {
      aaScore = 'yes';
      aaNumeric = 1.0;
    } else {
      aaScore = 'no';
      aaNumeric = 0.0;
    }
  } else if (c.answerability === 'ANSWERABLE') {
    // Should answer, NOT refuse
    const isFalseRefusal = res.source === 'No verified record' && !res.evidence?.length && outcomeStatus !== 'ANSWERED';
    if (!isFalseRefusal) {
      aaScore = 'yes';
      aaNumeric = 1.0;
    } else {
      aaScore = 'no'; // False refusal
      aaNumeric = 0.0;
    }
  }

  // 5. Referral Relevance (RR)
  let rrScore = 'not-applicable';
  let rrNumeric = null;
  if (escalation?.available) {
    if (c.expectedTargetDesk === 'administrative_office') {
      const isOffice = escalation.email === 'office@mitcorer.edu.in' || escalation.department === 'administrative_office' || (escalation.actionLabel && escalation.actionLabel.includes('Administrative'));
      rrScore = isOffice ? 'yes' : 'no';
      rrNumeric = isOffice ? 1.0 : 0.0;
    } else {
      // General admissions
      const isAdmissions = escalation.email === 'info.mitcorer@mitpune.edu.in' || (escalation.actionLabel && escalation.actionLabel.includes('Admissions'));
      rrScore = isAdmissions ? 'yes' : 'no';
      rrNumeric = isAdmissions ? 1.0 : 0.0;
    }
  }

  // 6. Language Fidelity (LF)
  let lfScore = 5;
  if (c.language === 'en') {
    lfScore = 5;
  } else {
    const devanagariMatches = text.match(/[\u0900-\u097F]/g) || [];
    const totalChars = text.replace(/\s+/g, '').length;
    const ratio = totalChars > 0 ? devanagariMatches.length / totalChars : 0;
    if (ratio >= 0.45) {
      lfScore = 5;
    } else if (ratio >= 0.25) {
      lfScore = 4;
    } else if (ratio > 0.10) {
      lfScore = 3;
    } else {
      lfScore = 2;
    }
  }

  return {
    factualCorrectness: { label: fcScore, score: fcNumeric },
    sourceSupport: { label: ssScore, score: ssNumeric },
    completeness: { label: cpScore, score: cpNumeric },
    appropriateAbstention: { label: aaScore, score: aaNumeric },
    referralRelevance: { label: rrScore, score: rrNumeric },
    languageFidelity: { score: lfScore, max: 5 }
  };
}

async function runEvaluation(datasetPath, datasetName) {
  const rawData = fs.readFileSync(datasetPath, 'utf8');
  const cases = JSON.parse(rawData);

  console.log(`\n========================================================`);
  console.log(`Running Evaluation: ${datasetName} (${cases.length} cases)`);
  console.log(`========================================================`);

  const results = [];
  const metrics = {
    total: cases.length,
    byLanguage: { en: { total: 0 }, mr: { total: 0 }, hi: { total: 0 } },
    answerable: {
      total: 0,
      correct: 0,
      partial: 0,
      incorrect: 0,
      sourceSupported: 0,
      falseRefusals: 0
    },
    unanswerable: {
      total: 0,
      appropriatelyAbstained: 0,
      hallucinatedAnswers: 0,
      correctReferrals: 0,
      totalReferrals: 0
    },
    ambiguous: {
      total: 0,
      clarified: 0
    },
    languageFidelity: {
      en: { sum: 0, count: 0 },
      mr: { sum: 0, count: 0 },
      hi: { sum: 0, count: 0 }
    }
  };

  for (const c of cases) {
    const lang = c.language;
    metrics.byLanguage[lang].total++;

    const response = await answerAdmissionQuestion({
      question: c.question,
      language: c.language
    });

    const scores = evaluateResponse(c, response);

    if (c.answerability === 'ANSWERABLE') {
      metrics.answerable.total++;
      if (scores.factualCorrectness.score === 1.0) metrics.answerable.correct++;
      else if (scores.factualCorrectness.score === 0.5) metrics.answerable.partial++;
      else metrics.answerable.incorrect++;

      if (scores.sourceSupport.score === 1.0) metrics.answerable.sourceSupported++;
      if (scores.appropriateAbstention.score === 0.0) metrics.answerable.falseRefusals++;
    } else if (c.answerability === 'UNANSWERABLE') {
      metrics.unanswerable.total++;
      if (scores.appropriateAbstention.score === 1.0) {
        metrics.unanswerable.appropriatelyAbstained++;
      } else {
        metrics.unanswerable.hallucinatedAnswers++;
      }

      if (scores.referralRelevance.score !== null) {
        metrics.unanswerable.totalReferrals++;
        if (scores.referralRelevance.score === 1.0) {
          metrics.unanswerable.correctReferrals++;
        }
      }
    } else if (c.answerability === 'AMBIGUOUS') {
      metrics.ambiguous.total++;
      if (scores.appropriateAbstention.score === 1.0) {
        metrics.ambiguous.clarified++;
      }
    }

    metrics.languageFidelity[lang].sum += scores.languageFidelity.score;
    metrics.languageFidelity[lang].count++;

    results.push({
      caseId: c.id,
      language: c.language,
      domain: c.domain,
      answerability: c.answerability,
      question: c.question,
      responseSource: response.source,
      responseOutcome: response.outcomeStatus,
      responseText: response.answer,
      scores
    });
  }

  // Compute calculated rates
  const answerCorrectnessRate = metrics.answerable.total > 0
    ? (metrics.answerable.correct / metrics.answerable.total) : 0;
  const sourceGroundingRate = metrics.answerable.total > 0
    ? (metrics.answerable.sourceSupported / metrics.answerable.total) : 0;
  const appropriateAbstentionRate = metrics.unanswerable.total > 0
    ? (metrics.unanswerable.appropriatelyAbstained / metrics.unanswerable.total) : 0;
  const falseAnswerRate = metrics.unanswerable.total > 0
    ? (metrics.unanswerable.hallucinatedAnswers / metrics.unanswerable.total) : 0;
  const falseRefusalRate = metrics.answerable.total > 0
    ? (metrics.answerable.falseRefusals / metrics.answerable.total) : 0;
  const referralRoutingAccuracy = metrics.unanswerable.totalReferrals > 0
    ? (metrics.unanswerable.correctReferrals / metrics.unanswerable.totalReferrals) : 1.0;
  const clarificationAccuracy = metrics.ambiguous.total > 0
    ? (metrics.ambiguous.clarified / metrics.ambiguous.total) : 0;

  console.log(`\nEvaluation Summary for ${datasetName}:`);
  console.log(`- Answer Correctness Rate: ${(answerCorrectnessRate * 100).toFixed(1)}% (${metrics.answerable.correct}/${metrics.answerable.total})`);
  console.log(`- Source Grounding Rate:   ${(sourceGroundingRate * 100).toFixed(1)}% (${metrics.answerable.sourceSupported}/${metrics.answerable.total})`);
  console.log(`- Appropriate Abstention:  ${(appropriateAbstentionRate * 100).toFixed(1)}% (${metrics.unanswerable.appropriatelyAbstained}/${metrics.unanswerable.total})`);
  console.log(`- Clarification Accuracy:  ${(clarificationAccuracy * 100).toFixed(1)}% (${metrics.ambiguous.clarified}/${metrics.ambiguous.total})`);
  console.log(`- False Answer Rate:       ${(falseAnswerRate * 100).toFixed(1)}% (${metrics.unanswerable.hallucinatedAnswers}/${metrics.unanswerable.total})`);
  console.log(`- False Refusal Rate:      ${(falseRefusalRate * 100).toFixed(1)}% (${metrics.answerable.falseRefusals}/${metrics.answerable.total})`);
  console.log(`- Referral Desk Accuracy:  ${(referralRoutingAccuracy * 100).toFixed(1)}% (${metrics.unanswerable.correctReferrals}/${metrics.unanswerable.totalReferrals})`);
  console.log(`- Script-Ratio Heuristic Means (not language-quality ratings): EN=${(metrics.languageFidelity.en.sum/metrics.languageFidelity.en.count).toFixed(2)}/5, MR=${(metrics.languageFidelity.mr.sum/metrics.languageFidelity.mr.count).toFixed(2)}/5, HI=${(metrics.languageFidelity.hi.sum/metrics.languageFidelity.hi.count).toFixed(2)}/5`);

  return {
    datasetName,
    evaluationType: 'automated developer diagnostic',
    humanRatings: 'not collected by this runner',
    scoringNote: 'Language fidelity output is a script-ratio heuristic, not a human language-quality rating.',
    caseCount: cases.length,
    timestamp: new Date().toISOString(),
    metrics: {
      ...metrics,
      rates: {
        answerCorrectnessRate: { numerator: metrics.answerable.correct, denominator: metrics.answerable.total, percentage: Math.round(answerCorrectnessRate * 1000) / 10 },
        sourceGroundingRate: { numerator: metrics.answerable.sourceSupported, denominator: metrics.answerable.total, percentage: Math.round(sourceGroundingRate * 1000) / 10 },
        appropriateAbstentionRate: { numerator: metrics.unanswerable.appropriatelyAbstained, denominator: metrics.unanswerable.total, percentage: Math.round(appropriateAbstentionRate * 1000) / 10 },
        clarificationAccuracy: { numerator: metrics.ambiguous.clarified, denominator: metrics.ambiguous.total, percentage: Math.round(clarificationAccuracy * 1000) / 10 },
        falseAnswerRate: { numerator: metrics.unanswerable.hallucinatedAnswers, denominator: metrics.unanswerable.total, percentage: Math.round(falseAnswerRate * 1000) / 10 },
        falseRefusalRate: { numerator: metrics.answerable.falseRefusals, denominator: metrics.answerable.total, percentage: Math.round(falseRefusalRate * 1000) / 10 },
        referralRoutingAccuracy: { numerator: metrics.unanswerable.correctReferrals, denominator: metrics.unanswerable.totalReferrals, percentage: Math.round(referralRoutingAccuracy * 1000) / 10 }
      }
    },
    results
  };
}

async function main() {
  const report30 = await runEvaluation('backend/evaluation/pilot-dataset-30.json', 'Preliminary 30-Question Pilot');
  const report90 = await runEvaluation('backend/evaluation/pilot-dataset-90.json', 'Expanded 90-Question Multilingual Evaluation');

  const combinedReport = {
    executedAt: new Date().toISOString(),
    pilot30: report30,
    expanded90: report90
  };

  const reportDir = 'backend/evaluation/reports';
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'pilot-evaluation-report.json'), JSON.stringify(combinedReport, null, 2), 'utf8');

  console.log(`\nSaved complete evaluation report to ${path.join(reportDir, 'pilot-evaluation-report.json')}`);
}

main().catch(err => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});

