import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextAttendanceStatus,
  isChildEnrolledOn,
  summarizeDay,
  changesToMarkUnmarkedPresent,
  normalizeAttendanceChange,
  attendanceKey,
} from './attendance-rules.mjs';

test('ciclul stării: prezent → absent → motivat → nemarcat → prezent', () => {
  assert.equal(nextAttendanceStatus(null), 'present');
  assert.equal(nextAttendanceStatus('present'), 'absent');
  assert.equal(nextAttendanceStatus('absent'), 'excused');
  assert.equal(nextAttendanceStatus('excused'), null);
});

test('copiii arhivați, înscriși după zi sau retrași înaintea ei nu sunt înscriși în ziua respectivă', () => {
  const archived = { archived: true, attendanceDate: '2026-01-01' };
  const enrolledLater = { attendanceDate: '2026-10-01' };
  const withdrawnBefore = { attendanceDate: '2026-01-01', withdrawalDate: '2026-09-01' };
  assert.equal(isChildEnrolledOn(archived, '2026-09-27'), false);
  assert.equal(isChildEnrolledOn(enrolledLater, '2026-09-27'), false);
  assert.equal(isChildEnrolledOn(withdrawnBefore, '2026-09-27'), false);
});

test('un copil fără dată de frecventare și fără contract e considerat înscris', () => {
  assert.equal(isChildEnrolledOn({}, '2026-09-27'), true);
});

test('attendanceDate gol (formular necompletat) nu ascunde contractDate', () => {
  const child = { attendanceDate: '', contractDate: '2026-09-15' };
  assert.equal(isChildEnrolledOn(child, '2026-09-01'), false);
  assert.equal(isChildEnrolledOn(child, '2026-09-20'), true);
});

test('summarizeDay numără nemarcații ca diferența față de lista copiilor', () => {
  /** @type {[string, import('../attendance.types.d.mts').AttendanceEntry][]} */
  const pairs = [
    ['c1', { childId: 'c1', date: '2026-09-27', status: 'present', reason: '', updatedAt: '' }],
    ['c2', { childId: 'c2', date: '2026-09-27', status: 'absent', reason: '', updatedAt: '' }],
  ];
  const summary = summarizeDay(['c1', 'c2', 'c3'], new Map(pairs));
  assert.deepEqual(summary, { present: 1, absent: 1, excused: 0, unmarked: 1 });
});

test('„toți nemarcații → prezenți” nu produce schimbări pentru absenți și motivați', () => {
  /** @type {[string, import('../attendance.types.d.mts').AttendanceEntry][]} */
  const pairs = [
    ['c1', { childId: 'c1', date: '2026-09-27', status: 'absent', reason: '', updatedAt: '' }],
    ['c2', { childId: 'c2', date: '2026-09-27', status: 'excused', reason: 'Boală', updatedAt: '' }],
  ];
  const changes = changesToMarkUnmarkedPresent(['c1', 'c2', 'c3'], new Map(pairs), '2026-09-27');
  assert.deepEqual(changes, [{ childId: 'c3', date: '2026-09-27', status: 'present' }]);
});

test('motivul se golește pentru orice stare în afară de motivat și se taie la 200 de caractere', () => {
  const present = normalizeAttendanceChange({ childId: 'c1', date: '2026-09-27', status: 'present', reason: 'x' });
  assert.equal(present.reason, '');

  const longReason = 'a'.repeat(250);
  const excused = normalizeAttendanceChange({
    childId: 'c1',
    date: '2026-09-27',
    status: 'excused',
    reason: `  ${longReason}  `,
  });
  assert.equal(excused.reason.length, 200);
});

test('attendanceKey combină copilul și ziua cu un separator', () => {
  assert.equal(attendanceKey('c1', '2026-09-27'), 'c1|2026-09-27');
});
