import { useEffect, useState } from 'react';
import { api } from './api.js';

export function AssistantOperations({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    api.getAssistantOperations(token).then(result => { if (active) setData(result); })
      .catch(problem => { if (active) setError(problem.status === 404 ? 'Diagnostics need the current backend version. Restart the backend and refresh this page.' : problem.message || 'Diagnostics are unavailable.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [token, refresh]);
  const triage = async (id, status) => {
    setBusy(true); setError('');
    try { await api.reviewAssistantEvent(token, id, status); setRefresh(value => value + 1); }
    catch (problem) { setError(problem.message); setBusy(false); }
  };
  const refreshDiagnostics = () => {
    setBusy(true);
    setError('');
    setRefresh(value => value + 1);
  };
  return <section id="assistant-quality-monitor" className="panelBlock assistantOperations" aria-label="AI quality monitor" aria-busy={busy}>
    <div className="assistantOperationsHead"><div><span className="eyebrow">Operational diagnostics</span><h2>AI Quality Monitor</h2><p>Answer outcomes and source health from the current process. These figures do not measure factual accuracy.</p></div><button type="button" disabled={busy} onClick={refreshDiagnostics}>{busy ? 'Loading…' : 'Refresh diagnostics'}</button></div>
    {!data && !error && <p role="status">Loading assistant diagnostics.</p>}
    {error && <p role="alert">{error}</p>}
    {data && <>
      <div className="adminMetricGrid">
        <article><span>Unreachable sources</span><strong>{data.sourceHealth.unreachable || 0}</strong><small>{data.sourceHealth.unknown || 0} have unknown health</small></article>
        <article><span>Diagnostic items to triage</span><strong>{data.diagnostics.unresolved}</strong><small>Clarifications and refusals may be correct behavior</small></article>
      </div>
      <p>{data.diagnostics.retention}</p>
      <div id="assistant-query-analytics" className="operationsAnalytics">
      <h3>Query analytics</h3>
      <dl className="operationsOutcomes">{Object.entries(data.diagnostics.byOutcome).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value}</dd></div>)}</dl>
      <h3>Recent outcome trend (rolling 24 hours)</h3>
      <div className="operationsTable" role="region" tabIndex={0} aria-label="Assistant outcome trend in six-hour windows">
        <table><thead><tr><th>Six-hour window</th><th>Events</th><th>Plain answers</th><th>Outside a plain answer</th></tr></thead><tbody>
          {data.diagnostics.trends.points.map(point => <tr key={point.from}>
            <td>{new Date(point.from).toLocaleString()} – {new Date(point.to).toLocaleString()}</td>
            <td>{point.total}</td><td>{point.answered}</td><td>{point.triageCandidates}</td>
          </tr>)}
        </tbody></table>
      </div>
      </div>
      <div id="assistant-unanswered-review" className="operationsTriage">
      <h3>Evidence gaps and triage</h3>
      {data.diagnostics.evidenceGaps && (data.diagnostics.evidenceGaps.length
        ? <div className="operationsTable" role="region" tabIndex={0} aria-label="Recent evidence gaps">
          <table><thead><tr><th scope="col">Question type</th><th scope="col">Reason</th><th scope="col">Evidence IDs</th><th scope="col">Count</th><th scope="col">Last seen</th></tr></thead>
            <tbody>{data.diagnostics.evidenceGaps.map(gap => <tr key={`${gap.questionType}:${gap.reason}`}>
              <td>{gap.questionType}</td><td>{gap.reason}</td><td>{gap.evidenceIds.join(', ') || 'None'}</td><td>{gap.count}</td>
              <td>{new Date(gap.lastSeen).toLocaleString()}</td>
            </tr>)}</tbody>
          </table>
        </div>
        : <p>No evidence gaps recorded in this process window.</p>)}
      {data.diagnostics.events && <details>
      <summary>Individual diagnostic events</summary>
      {data.diagnostics.events ? data.diagnostics.events.length ? <div className="operationsTable" tabIndex={0} aria-label="Redacted diagnostic events"><table><thead><tr><th>Time</th><th>Outcome / language</th><th>Evidence IDs</th><th>Status</th></tr></thead><tbody>{data.diagnostics.events.map(event => <tr key={event.id}>
        <td>{new Date(event.at).toLocaleString()}</td><td>{event.outcome}<br />{event.language} · {event.localization} · {event.elapsedMs ?? '—'} ms</td><td>{event.evidenceIds.join(', ') || 'None'}</td>
        <td><label>Status<select aria-label={`Status for ${event.id}`} value={event.status} disabled={busy} onChange={e => triage(event.id, e.target.value)}>{['Open', 'Investigating', 'Resolved', 'Dismissed'].map(status => <option key={status}>{status}</option>)}</select></label></td>
      </tr>)}</tbody></table></div> : <p>No diagnostic items in this process window.</p> : null}
      </details>}
      {!data.diagnostics.events && <p>Evidence gap details and triage are available to administrators.</p>}
      </div>
      <p>No visitor question text, answers or personal identifiers are collected by these diagnostics.</p>
    </>}
  </section>;
}
