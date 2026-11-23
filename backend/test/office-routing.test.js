import assert from 'node:assert/strict';
import test from 'node:test';
import { availableOfficeCategories, offices, routeEscalation, routeUnassignedEscalations, sharedQueue, staffRoutingDirectory } from '../src/office-routing.js';

test('routes single-office escalations to provisioned staff and preserves shared triage for other cases', () => {
  const users = offices.map((office, index) => ({
    id: `owner-${index}`, email: office.email, name: office.owner, role: 'staff', passwordHash: 'fixture',
  }));
  const questions = [
    'How do I apply for admission?',
    'Can I pay my fees in installments?',
    'How do I get a bonafide certificate?',
    'Where is the semester exam timetable?',
    'How do I borrow books from the library?',
    'Is hostel accommodation available?',
  ];
  for (const [index, question] of questions.entries()) {
    assert.deepEqual(routeEscalation(question, users), { queue: offices[index].name, owner: offices[index].owner, assignee: users[index] });
  }
  const fallback = { queue: sharedQueue, owner: '', assignee: null };
  assert.equal(routeEscalation('What are the library fees?', users).queue, 'Accounts Section');
  assert.equal(routeEscalation('What are the admission fees?', users).queue, 'Accounts Section');
  assert.equal(routeEscalation('Does MITCORER offer MBBS or BDS medical degrees?', users).queue, 'Admissions Cell');
  assert.equal(routeEscalation('When is semester 3 exam?', users).queue, 'Examination Cell');
  assert.equal(routeEscalation('What student facilities are available?', users).queue, 'Student Facilitation Desk');
  assert.deepEqual(routeEscalation('Can I check the exam timetable and pay the fees?', users), fallback);
  assert.deepEqual(routeEscalation('I need help', users), fallback);
  assert.deepEqual(routeEscalation('I need a field trip waiver', users, [{
    name: 'Field Trip Office', owner: users[0].name, email: users[0].email, keywords: ['field trip waiver'],
  }]), fallback);
  const admissions = { queue: offices[0].name, owner: offices[0].owner, assignee: null };
  assert.deepEqual(routeEscalation(questions[0], [{ ...users[0], role: 'applicant' }]), admissions);
  assert.deepEqual(routeEscalation(questions[0], [{ ...users[0], disabled: true }]), admissions);
  assert.deepEqual(routeEscalation(questions[0], []), admissions);
  const earlier = { leadConsent: true, status: 'Needs reply', routingQueue: sharedQueue, question: 'Does MITCORER offer MBBS or BDS medical degrees?' };
  const db = { inquiries: [earlier], users: [], additionalOffices: [] };
  assert.equal(routeUnassignedEscalations(db), true);
  assert.equal(earlier.routingQueue, offices[0].name);
  assert.equal(routeUnassignedEscalations(db), false);
  db.users = users;
  assert.equal(routeUnassignedEscalations(db), true);
  assert.equal(earlier.assigneeId, users[0].id);
  const directory = staffRoutingDirectory({ users: [users[0]], inquiries: [
    { routingQueue: offices[0].name, status: 'Needs reply' },
    { routingQueue: offices[0].name, status: 'Resolved' },
  ] });
  assert.equal(directory.offices[0].ready, true);
  assert.equal(directory.offices[0].openRequests, 1);
  assert.equal(directory.offices[1].ready, false);
  assert.equal(Object.hasOwn(directory.staff[0], 'passwordHash'), false);
});

test('an added office takes its category while other topics retain their default destination', () => {
  const owner = { id: 'owner-transport', name: 'Transport Owner', email: 'transport@example.test', role: 'staff', passwordHash: 'fixture' };
  const added = [{ id: 'OFF-TRANSPORT', name: 'Transport Desk', owner: owner.name, email: owner.email, handles: 'transport' }];
  const question = 'Is there a bus from Barshi station?';
  assert.equal(routeEscalation(question, [owner]).queue, 'Student Facilitation Desk');
  assert.deepEqual(routeEscalation(question, [owner], added), { queue: 'Transport Desk', owner: owner.name, assignee: owner });
  assert.equal(routeEscalation('Where is the exam timetable?', [owner], added).queue, 'Examination Cell');
  assert.ok(!availableOfficeCategories(added).some(category => category.id === 'transport'));
});
