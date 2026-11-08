import { useState } from 'react';

const feeFields = [['open', 'Open / OMS'], ['concessionBoy', 'EBC / EWS / OBC / SEBC boys'], ['concessionGirl', 'EBC / EWS / OBC / SEBC girls'], ['vjnt', 'VJNT / SBC / TFWS'], ['scst', 'SC / ST']];
const emptyFees = () => Object.fromEntries(feeFields.map(([key]) => [key, '']));
const newFacts = (kind) => kind === 'academicFees'
  ? { kind, academicYear: '', firstYear: emptyFees(), directSecondYear: emptyFees() }
  : kind === 'accommodationFees' ? { kind, academicYear: '', hostel: '', refundableDeposit: '', messAnnual: '' }
    : { kind, academicYear: '', programs: [{ name: '', intake: '', choiceCode: '' }] };
const numeric = (value) => value === '' ? '' : Number(value);

export function KnowledgeRecordEditor({ record, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ title: record.title, category: record.category, source: record.source,
    sourceUrl: record.sourceUrl || '', text: record.text, status: record.status, tags: (record.tags || []).join(', '),
    facts: record.facts ? structuredClone(record.facts) : null, provenance: structuredClone(record.provenance || {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [translations, setTranslations] = useState(() => ({ mr: record.translations?.mr?.text || '', hi: record.translations?.hi?.text || '' }));
  const [translationsReviewed, setTranslationsReviewed] = useState(false);
  const [sourceReviewed, setSourceReviewed] = useState(false);
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSourceReviewed(false);
    if (key === 'text') setTranslationsReviewed(false);
  };
  const updateFacts = (change) => { setSourceReviewed(false); setForm((current) => ({ ...current, facts: change(current.facts) })); };
  const updateProgram = (index, field, value) => updateFacts((facts) => ({ ...facts, programs: facts.programs.map((item, i) => i === index ? { ...item, [field]: value } : item) }));
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { tags, text, ...fields } = form;
      const translationsChanged = ['mr', 'hi'].some((locale) => translations[locale] !== (record.translations?.[locale]?.text || ''));
      if (!form.facts && translationsChanged && !translationsReviewed) throw new Error('Review the translations against the current source text and confirm the review before saving.');
      const saved = await onSave(record.id, { ...fields, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        ...(!form.facts ? { text } : {}), ...(sourceReviewed ? { verifySource: true } : {}),
        ...(!form.facts && translationsReviewed ? { translations: { mr: translations.mr.trim() || null, hi: translations.hi.trim() || null } } : {}), expectedRevision: record.revision ?? 0 });
      if (!saved) throw new Error('The record was not saved. Your edits remain available.');
      onCancel();
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  };
  return <section className="formBlock" aria-label="Edit knowledge record">
    <h3>Edit {record.title}</h3>
    <form onSubmit={save} aria-busy={busy}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, display: 'contents' }}>
        <label>Title<input required maxLength={180} value={form.title} onChange={(event) => update('title', event.target.value)} /></label>
        <label>Category<input required maxLength={80} value={form.category} onChange={(event) => update('category', event.target.value)} /></label>
        <label>Source authority<input required maxLength={180} value={form.source} onChange={(event) => update('source', event.target.value)} /></label>
        <label>Official source URL<input type="url" maxLength={2000} value={form.sourceUrl} onChange={(event) => update('sourceUrl', event.target.value)} /></label>
        <label>Publication status<select value={form.status} onChange={(event) => update('status', event.target.value)}>{['Published', 'Review', 'Draft', 'Archived', 'Retired'].map((status) => <option key={status}>{status}</option>)}</select></label>
        <label>Search tags, separated by commas<input value={form.tags} onChange={(event) => update('tags', event.target.value)} /></label>
        <details className="wide"><summary>Source dates and document references</summary>
          <p>Leave unknown details blank. Academic year identifies scope; validity dates explicitly control when this record can answer questions.</p>
          {[['academicYear', 'Source academic year'], ['documentVersion', 'Document version'], ['section', 'Source section'], ['capturedAt', 'Source captured date'], ['pageStart', 'Start page'], ['pageEnd', 'End page'], ['validFrom', 'Valid from (UTC date)'], ['validUntil', 'Valid until (UTC date)'], ['supersededBy', 'Superseded by knowledge ID']].map(([key, label]) => <label key={key}>{label}<input type={key.startsWith('page') ? 'number' : key === 'capturedAt' || key.startsWith('valid') ? 'date' : 'text'} min={key.startsWith('page') ? '1' : undefined} maxLength={180} value={form.provenance[key] ?? ''} onChange={event => update('provenance', { ...form.provenance, [key]: key.startsWith('page') ? event.target.value === '' ? null : Number(event.target.value) : event.target.value })} /></label>)}
          <label><input type="checkbox" checked={sourceReviewed} onChange={event => setSourceReviewed(event.target.checked)} /> I verified this content and its document references against the source.</label>
        </details>
        {!record.facts && <label>Record format<select value={form.facts?.kind || ''} onChange={(event) => update('facts', event.target.value ? newFacts(event.target.value) : null)}><option value="">Reviewed text</option><option value="academicFees">Academic fee table</option><option value="accommodationFees">Hostel and mess fee table</option><option value="programIntake">Programme intake table</option></select></label>}
        {!form.facts ? <label className="wide">Verified text<textarea required rows={6} maxLength={100000} value={form.text} onChange={(event) => update('text', event.target.value)} /></label> : <>
          <p className="wide">Published text will be generated from these fields. Confirm every amount and academic year against the official source before publishing.</p>
          <label>Academic year<input required pattern="[0-9]{4}-[0-9]{2}" placeholder="2026-27" value={form.facts.academicYear} onChange={(event) => updateFacts((facts) => ({ ...facts, academicYear: event.target.value }))} /></label>
          {form.facts.kind === 'academicFees' && ['firstYear', 'directSecondYear'].map((route) => <div className="wide" key={route}><h4>{route === 'firstYear' ? 'First Year' : 'Direct Second Year'} annual fees (INR)</h4>{feeFields.map(([key, label]) => <label key={key}>{label}<input required type="number" min="0" max="1000000000" step="1" value={form.facts[route][key]} onChange={(event) => updateFacts((facts) => ({ ...facts, [route]: { ...facts[route], [key]: numeric(event.target.value) } }))} /></label>)}</div>)}
          {form.facts.kind === 'accommodationFees' && [['hostel', 'Annual hostel fee (INR)'], ['refundableDeposit', 'Refundable hostel deposit (INR)'], ['messAnnual', 'Annual mess fee (INR)']].map(([key, label]) => <label key={key}>{label}<input required type="number" min="0" max="1000000000" step="1" value={form.facts[key]} onChange={(event) => updateFacts((facts) => ({ ...facts, [key]: numeric(event.target.value) }))} /></label>)}
          {form.facts.kind === 'programIntake' && <div className="wide">{form.facts.programs.map((program, index) => <div key={index}>
            <label>Programme name<input required maxLength={180} value={program.name} onChange={(event) => updateProgram(index, 'name', event.target.value)} /></label>
            <label>Sanctioned intake<input required type="number" min="0" max="100000" step="1" value={program.intake} onChange={(event) => updateProgram(index, 'intake', numeric(event.target.value))} /></label>
            <label>Choice code<input required pattern="[0-9]+" maxLength={20} value={program.choiceCode} onChange={(event) => updateProgram(index, 'choiceCode', event.target.value)} /></label>
            <button type="button" disabled={form.facts.programs.length === 1} onClick={() => updateFacts((facts) => ({ ...facts, programs: facts.programs.filter((_, i) => i !== index) }))}>Remove programme</button>
          </div>)}<button type="button" disabled={form.facts.programs.length >= 30} onClick={() => updateFacts((facts) => ({ ...facts, programs: [...facts.programs, { name: '', intake: '', choiceCode: '' }] }))}>Add programme</button></div>}
        </>}
        {!form.facts && <div className="wide">
          <p>Translations must preserve the source numbers, dates, eligibility conditions and uncertainty. When the source text changes, its existing translations stop being used until reviewed again.</p>
          <label>Reviewed Marathi translation<textarea rows={4} maxLength={100000} value={translations.mr} onChange={(event) => { setTranslations((current) => ({ ...current, mr: event.target.value })); setTranslationsReviewed(false); }} /></label>
          <label>Reviewed Hindi translation<textarea rows={4} maxLength={100000} value={translations.hi} onChange={(event) => { setTranslations((current) => ({ ...current, hi: event.target.value })); setTranslationsReviewed(false); }} /></label>
          <label><input type="checkbox" checked={translationsReviewed} onChange={(event) => setTranslationsReviewed(event.target.checked)} /> I reviewed these translations against the current source text.</label>
        </div>}
        <button type="submit">{busy ? 'Saving…' : 'Save record'}</button><button type="button" onClick={onCancel}>Cancel</button>
      </fieldset>
      {error && <p className="wide" role="alert">{error} Your edits remain in this form. For a revision conflict, copy them before refreshing to load the latest record.</p>}
    </form>
  </section>;
}
