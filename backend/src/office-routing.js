import { normalizeQuery } from './query-understanding.js';

export const sharedQueue = 'MITCORER Staff Triage';

export const offices = [
  { name: 'Admissions Cell', owner: 'Mr. Shashikant Vhanmane', email: 'shashikant.vhanmane@mitcorer.edu.in', matches: /\b(?:admissions?|apply to (?:the college|mitcorer)|eligibility|cet|jee|acap|lateral entry|direct second year|seat allotment|mbbs|bds|medical degrees?|programmes? offered|courses? offered)\b/ },
  { name: 'Accounts Section', owner: 'Mr. Niraj Adhye', email: 'niraj.adhye@mitcorer.edu.in', matches: /\b(?:fees?|tuition|payments?|refunds?|instal+l?ments?|receipts?)\b/ },
  { name: 'Student Facilitation Desk', owner: 'Mr. Mahadev Waghmare', email: 'mahadev.waghmare@mitcorer.edu.in', matches: /\b(?:bonafide|student id cards?|student facilitation|student facilit(?:y|ies)|campus facilit(?:y|ies)|student grievance|leaving certificate|canteen|student services|sports facilit(?:y|ies))\b/ },
  { name: 'Examination Cell', owner: 'Mr. Mrugendra Andhare', email: 'mrugendra.andhare@mitcorer.edu.in', matches: /\b(?:academic exams?|semester (?:\d+ )?exams?|examinations?|exam(?:ination)? (?:time[ -]?tables?|schedules?|results?|forms?|dates?)|revaluation|hall tickets?|backlogs?)\b/ },
  { name: 'Central Library', owner: 'Mr. Ganesh Umbarkar', email: 'ganesh.umbarkar@mitcorer.edu.in', matches: /\b(?:library|borrow(?:ing)? books?|library cards?)\b/ },
  { name: 'Hostel Office', owner: 'Mr. Vinayak Mandave', email: 'vinayak.mandave@mitcorer.edu.in', matches: /\b(?:hostels?|mess|accommodation|room allotment)\b/ },
];

const categories = [
  { id: 'admissions', label: 'Admissions', defaultOffice: 'Admissions Cell' },
  { id: 'fees', label: 'Fees and payments', defaultOffice: 'Accounts Section' },
  { id: 'student-services', label: 'Student facilities and services', defaultOffice: 'Student Facilitation Desk' },
  { id: 'exams', label: 'Examinations', defaultOffice: 'Examination Cell' },
  { id: 'library', label: 'Library', defaultOffice: 'Central Library' },
  { id: 'hostel', label: 'Hostel', defaultOffice: 'Hostel Office' },
  { id: 'transport', label: 'Transport', defaultOffice: 'Student Facilitation Desk', matches: /\b(?:bus(?:es)?|transport(?:ation)?|shuttle|bus stops?|bus routes?)\b/ },
].map(category => ({ ...category, matches: category.matches || offices.find(office => office.name === category.defaultOffice).matches }));

export function availableOfficeCategories(additionalOffices = []) {
  const configured = configuredOffices(additionalOffices);
  return categories.filter(category => !configured.some(office => office.handles === category.id))
    .map(({ id, label, defaultOffice }) => ({
      id, label, currentOffice: configured.find(office => office.id === defaultOffice)?.name || null,
    }));
}

export function assignableStaff(users) {
  return users.filter(user => ['staff', 'admin'].includes(user.role) && user.disabled !== true && user.passwordHash);
}

function configuredOffices(additionalOffices) {
  const defaults = offices.map(office => {
    const override = additionalOffices.find(item => item.originalName === office.name);
    return { ...office, ...override, id: office.name };
  });
  return [...defaults, ...additionalOffices.filter(office => !office.originalName)
    .map(office => ({ ...office, id: office.id || office.name }))].filter(office => !office.deleted);
}

export function routeEscalation(question, users, additionalOffices = []) {
  const normalized = normalizeQuery(question);
  const configured = configuredOffices(additionalOffices);
  const feeContext = /\b(?:admission|exam(?:ination)?|hostel|library|transport|bus) fees?\b/g;
  const otherConcerns = normalized.replace(feeContext, '');
  const destinations = new Set(categories
    .filter(category => category.matches.test(category.id === 'fees' ? normalized : otherConcerns))
    .map(category => configured.find(office => office.handles === category.id)
      || configured.find(office => office.id === category.defaultOffice)));
  const [destination] = destinations;
  if (destinations.size !== 1 || !destination) return { queue: sharedQueue, owner: '', assignee: null };
  return officeAssignment(destination, users);
}

function officeAssignment(office, users) {
  const assignee = assignableStaff(users).find(user => user.email.toLowerCase() === office.email);
  return { queue: office.name, owner: office.owner, assignee: assignee || null };
}

export function applyEscalationRouting(record, users, additionalOffices) {
  const { queue, owner, assignee } = routeEscalation(record.question, users, additionalOffices);
  record.routingQueue = queue;
  record.routingOwner = owner;
  record.assignedTo = assignee?.name || '';
  record.assigneeId = assignee?.id || null;
  return { queue, assigned: Boolean(assignee) };
}

export function routeUnassignedEscalations(db) {
  let changed = false;
  for (const record of db.inquiries) {
    if (!record.leadConsent || !record.routingQueue || record.status === 'Resolved' || record.assigneeId || record.assignedTo) continue;
    const { queue, owner, assignee } = routeEscalation(record.question, db.users, db.additionalOffices);
    if (record.routingQueue === queue && (record.routingOwner || '') === owner && !assignee) continue;
    record.routingQueue = queue;
    record.routingOwner = owner;
    record.assigneeId = assignee?.id || null;
    record.assignedTo = assignee?.name || '';
    changed = true;
  }
  return changed;
}

export function staffRoutingDirectory({ users, inquiries, additionalOffices = [] }) {
  const staff = assignableStaff(users).map(({ id, name, email }) => ({ id, name, email }));
  return {
    staff,
    availableCategories: availableOfficeCategories(additionalOffices),
    offices: configuredOffices(additionalOffices).map(({ id, name, owner, email }) => ({
      id, name, owner, email,
      ready: staff.some(account => account.email.toLowerCase() === email),
      openRequests: inquiries.filter(item => item.routingQueue === name && item.status !== 'Resolved').length,
    })),
  };
}
