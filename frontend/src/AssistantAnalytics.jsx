import { useEffect, useState } from 'react';
import { api } from './api.js';

const topicByQuestion = {
  admissions: 'Admissions',
  lateralEntry: 'Admissions',
  deadlines: 'Admissions',
  admissionQuota: 'Admissions',
  seatMatrix: 'Admissions',
  academicFees: 'Fees',
  accommodationFees: 'Fees',
  programmes: 'Programmes',
  examinations: 'Examinations',
  scholarships: 'Scholarships',
  placements: 'Placements',
  institutionStatus: 'Campus',
  hostel: 'Campus',
  transport: 'Campus',
  library: 'Campus',
};

function summarizeTopics(questions) {
  const topics = new Map();
  for (const question of questions) {
    const name = topicByQuestion[question.id] || 'Unclassified';
    const topic = topics.get(name) || { name, total: 0, answered: 0, evidenceGap: 0, other: 0 };
    topic.total += question.total;
    topic.answered += question.answered;
    topic.evidenceGap += question.evidenceGap;
    topic.other += question.other;
    topics.set(name, topic);
  }
  return [...topics.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function ChartBar({ count, scale, variant = 'answered' }) {
  return <div className="analyticsBar" aria-hidden="true">
    <span className={`analyticsFill analyticsFill--${variant}`} style={{ width: `${100 * count / scale}%` }} />
  </div>;
}

export function AssistantAnalytics({ token }) {
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const current = result?.token === token && result.refresh === refresh ? result : null;
  const data = current?.data;

  useEffect(() => {
    let active = true;
    api.getAssistantAnalytics(token)
      .then(data => { if (active) setResult({ token, refresh, data }); })
      .catch(error => { if (active) setResult({ token, refresh, error: error.message || 'Could not load analytics.' }); });
    return () => { active = false; };
  }, [token, refresh]);

  const questions = data?.questions.filter(question => question.id !== 'other') || [];
  const unclassified = data?.questions.find(question => question.id === 'other')?.total ?? 0;
  const topics = summarizeTopics(data?.questions || []);

  return <div className="pageStack analyticsPage" aria-busy={!current}>
    <header className="adminPageHeader">
      <div><h2>Analytics</h2><p>Assistant usage over the last 30 calendar days (UTC).</p></div>
      <button className="inlineAction" type="button" disabled={!current} onClick={() => setRefresh(value => value + 1)}>Refresh analytics</button>
    </header>
    {!current && <p role="status">Loading analytics…</p>}
    {current?.error && <p className="errorBanner" role="alert">{current.error}</p>}
    {data && <>
      <section className="adminMetricGrid" aria-label="Assistant usage summary">
        <article><span>Questions processed</span><strong>{data.totals.total}</strong></article>
        <article><span>Fully answered</span><strong>{data.totals.answered}</strong></article>
        <article><span>Evidence gaps</span><strong>{data.totals.evidenceGap}</strong></article>
        <article><span>Other outcomes</span><strong>{data.totals.other}</strong><small>Includes clarifications and partial answers</small></article>
      </section>
      <div className="assistantAnalyticsGrid">
        <section className="panelBlock assistantAnalytics">
          <h3>Most asked question types</h3>
          <p className="analyticsChartSubtitle">Grouped by question type</p>
          {questions.length > 0 ? <ol className="analyticsQuestionList">
            {questions.map(question => <li className="analyticsChartRow" key={question.id}>
              <div className="analyticsChartLabel">
                <strong>{question.label}</strong>
                {question.evidenceGap > 0 && <small>{question.evidenceGap} fallback</small>}
              </div>
              <ChartBar count={question.total} scale={questions[0].total} />
              <span className="analyticsChartValue">{question.total} asked</span>
            </li>)}
          </ol> : <p>{data.totals.total ? 'No questions matched a ranked type in this period.' : 'Questions will appear here as people use MITRA.'}</p>}
          {unclassified > 0 && <p className="analyticsChartNote">{unclassified} questions fell outside the ranked types.</p>}
        </section>
        <section className="panelBlock assistantAnalytics">
          <h3>Answered vs fallback by topic</h3>
          {topics.length > 0 && <div className="analyticsChartLegend">
            <span><i className="analyticsFill analyticsFill--answered" aria-hidden="true" />Answered</span>
            <span><i className="analyticsFill analyticsFill--fallback" aria-hidden="true" />Fallback</span>
          </div>}
          {topics.length > 0 ? <ul className="analyticsQuestionList" aria-label="Topic outcomes">
            {topics.map(topic => <li className="analyticsChartRow analyticsChartRow--topic" key={topic.name}>
              <strong>{topic.name}</strong>
              <div className="analyticsBarPair">
                <ChartBar count={topic.answered} scale={topic.total} />
                <ChartBar count={topic.evidenceGap} scale={topic.total} variant="fallback" />
              </div>
              <span className="analyticsChartValue">{Math.round(100 * topic.evidenceGap / topic.total)}% fallback</span>
              <small className="analyticsChartDetail">{topic.answered} answered · {topic.evidenceGap} fallback · {topic.other} other</small>
            </li>)}
          </ul> : <p>Topic outcomes will appear as people use MITRA.</p>}
          {topics.length > 0 && <p className="analyticsChartNote">Fallback covers missing, conflicting, or outdated evidence.</p>}
        </section>
      </div>
    </>}
  </div>;
}
