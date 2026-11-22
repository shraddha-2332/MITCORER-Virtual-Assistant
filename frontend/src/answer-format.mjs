// Recognise complete maintained tables; unfamiliar prose remains untouched.
export function formatPublicAnswer(text, next = '') {
  const body = String(text || '').trim();
  const documents = body.match(/^Admission reporting commonly requires ([\s\S]+)\.$/);
  if (documents) return [{ type: 'paragraph', text: 'Common admission reporting documents:' }, { type: 'list', items: documents[1].split(/,\s*(?:and\s+)?/).map(item => item.trim()) }];
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs.flatMap(paragraph => formatPublicAnswer(paragraph, next));
  const lines = body.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines[0].endsWith(':') && lines.slice(1).every(line => /[\u0900-\u097f]/.test(line) && /[:\u2014]/.test(line) && /\d/.test(line))) {
    return [{ type: 'cards', intro: lines[0], items: lines.slice(1).map(line => {
      const separator = line.includes(' — ') ? ' — ' : ': ';
      const index = line.indexOf(separator);
      return { name: line.slice(0, index), detail: line.slice(index + separator.length) };
    }) }];
  }
  const polytechnic = body.match(/^(The official Polytechnic page lists) (.+), each with intake (\d+)\.(?=\s|$)/);
  if (polytechnic) {
    const names = polytechnic[2].split(', ').map(name => name.replace(/^and /, ''));
    if (names.length > 1) return [{ type: 'cards', intro: `${polytechnic[1]}:`, items: names.map(name => ({ name, detail: `Intake: ${polytechnic[3]}` })) }, ...formatPublicAnswer(body.slice(polytechnic[0].length).trim(), next)];
  }
  const dse = body.match(/^(The official Direct Second Year B\.Tech page lists) (.+?)\.(?=\s|$)/);
  if (dse) {
    const rows = dse[2].split(', ').map(row => row.replace(/^and /, '').match(/^(.+?) (?:choice code )?(\d+)$/));
    if (rows.length > 1 && rows.every(Boolean)) return [{ type: 'cards', intro: `${dse[1]}:`, items: rows.map(row => ({ name: row[1], detail: `Choice code: ${row[2]}` })) }, ...formatPublicAnswer(body.slice(dse[0].length).trim(), next)];
  }
  const stay = body.match(/^(For AY \d{4}-\d{2}), (?:the hostel fee is INR ([\d,]+) plus a refundable hostel deposit of INR ([\d,]+), for a hostel total of INR ([\d,]+)\. )?(?:Mess fees are INR ([\d,]+) per year\. )?/);
  if (stay && (stay[2] || stay[5])) {
    const items = [];
    if (stay[2]) items.push(...['Hostel fee', 'Refundable deposit', 'Hostel total'].map((name, index) => ({ name, amount: stay[index + 2] })));
    if (stay[5]) items.push({ name: 'Mess fee per year', amount: stay[5] });
    return [{ type: 'fees', intro: stay[1], items }, ...formatPublicAnswer(body.slice(stay[0].length).trim(), next)];
  }
  const hostel = body.match(/^(Hostel fee structure for AY \d{4}-\d{2}) includes hostel fees INR ([\d,]+) and refundable hostel deposit INR ([\d,]+), total INR ([\d,]+)\. Mess fees per year are INR ([\d,]+)\.(?=\s|$)/);
  if (hostel) return [{ type: 'fees', intro: hostel[1], items: ['Hostel fee', 'Refundable deposit', 'Hostel total', 'Mess fee per year'].map((name, index) => ({ name, amount: hostel[index + 2] })) }, ...formatPublicAnswer(body.slice(hostel[0].length).trim(), next)];
  const feePattern = /^(First Year Engineering fees|Direct Second Year fees)(?: for AY (\d{4}-\d{2}))? include Open or OMS(?: total)? INR ([\d,]+), Open EBC EWS OBC SEBC boys INR ([\d,]+), girls INR ([\d,]+), VJNT SBC TFWS INR ([\d,]+), and SC ST INR ([\d,]+)\.(?=\s|$)/;
  let remainder = body;
  let academicYear;
  const feeBlocks = [];
  let fee;
  while ((fee = remainder.match(feePattern))) {
    academicYear = fee[2] || academicYear;
    const labels = ['Open / OMS', 'Open EBC / EWS / OBC / SEBC boys', 'Open EBC / EWS / OBC / SEBC girls', 'VJNT / SBC / TFWS', 'SC / ST'];
    feeBlocks.push({ type: 'fees', intro: `${fee[1]}${academicYear ? ` for AY ${academicYear}` : ''}`, items: labels.map((name, index) => ({ name, amount: fee[index + 3] })) });
    remainder = remainder.slice(fee[0].length).trim();
  }
  if (feeBlocks.length) return [...feeBlocks, ...formatPublicAnswer(remainder, next)];
  return formatAnswer(text, next).flatMap((block) => {
    if (block.type !== 'paragraph') return [block];
    const match = block.text.match(/^(For AY \d{4}-\d{2}, the official First Year B\.Tech page lists:)\s+([\s\S]+)\.$/);
    if (!match) return [block];
    const rows = match[2].split('; ').map((row) => row.replace(/^and /, '').match(/^(.+?),\s*(?:(?:sanctioned )?intake\s+)?(\d+),\s*(?:choice code\s+)?(\d+)$/));
    if (rows.length < 2 || rows.some((row) => !row)) return [block];
    return [{ type: 'programmes', intro: match[1], items: rows.map((row) => ({ name: row[1], intake: row[2], choiceCode: row[3] })) }];
  });
}

export function formatAnswer(text, next = '') {
  let body = String(text || '').trim();
  const followUp = String(next || '').trim();
  // Remove only an exact duplicated suffix, never an arbitrary occurrence in evidence.
  if (followUp && body.endsWith(`Next: ${followUp}`)) {
    body = body.slice(0, -(`Next: ${followUp}`.length)).trim();
  }
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
  return paragraphs.flatMap((paragraph) => {
    const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
    const cells = line => line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
    if (lines.length >= 3 && lines[0].includes('|') && cells(lines[1]).every(cell => /^:?-{3,}:?$/.test(cell))) {
      const headers = cells(lines[0]);
      const rows = lines.slice(2).map(cells);
      if (headers.length <= 8 && rows.length <= 30 && rows.every(row => row.length === headers.length)) return [{ type: 'table', headers, rows }];
    }
    if (lines.some(line => /^#{1,6}\s+/.test(line))) return lines.flatMap(line => /^#{1,6}\s+/.test(line)
      ? [{ type: 'heading', text: line.replace(/^#{1,6}\s+/, '') }] : formatAnswer(line));
    const isList = line => /^(?:[-*\u2022]|\d+[.)])\s+/.test(line);
    if (lines.some(isList) && !lines.every(isList)) {
      const groups = [];
      for (const line of lines) {
        const last = groups.at(-1);
        if (last && isList(last[0]) === isList(line)) last.push(line); else groups.push([line]);
      }
      return groups.flatMap(group => formatAnswer(group.join('\n')));
    }
    if (lines.every((line) => /^(?:[-*\u2022]|\d+[.)])\s+/.test(line))) {
      const ordered = lines.every(line => /^\d+[.)]\s+/.test(line));
      return { type: 'list', ...(ordered ? { ordered: true, start: Number(lines[0].match(/^\d+/)[0]) } : {}), items: lines.map((line) => line.replace(/^(?:[-*\u2022]|\d+[.)])\s+/, '')) };
    }
    if (paragraph.length >= 360) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+(?:[”’"')\]]*)?(?:\s+|$)/g);
      if (sentences?.length >= 3 && sentences.join('').trim() === paragraph.trim()) {
        const readable = [];
        let group = '';
        for (const sentence of sentences.map((part) => part.trim())) {
          if (group && group.length >= 240) {
            readable.push(group);
            group = '';
          }
          group = group ? `${group} ${sentence}` : sentence;
        }
        if (group) readable.push(group);
        if (readable.length > 1) return readable.map((text) => ({ type: 'paragraph', text }));
      }
    }
    return { type: 'paragraph', text: paragraph };
  });
}

export function formatPublicResponse(message) {
  if (!message.sections?.length) return formatPublicAnswer(message.text, message.next);
  return message.sections.flatMap(section => [{ type: 'heading', text: section.title }, ...formatPublicAnswer(section.answer)]);
}
