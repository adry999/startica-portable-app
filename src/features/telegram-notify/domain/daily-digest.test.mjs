import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftDays } from '#shared/domain/calendar-month.mjs';
import { buildDailyDigest, splitDigest, pruneSentKeys } from './daily-digest.mjs';

const fullBirthdays = [
  { child: { name: 'Popescu Ana' }, daysUntil: 0, turningAge: 4 },
  { child: { name: 'Ionescu Mihai' }, daysUntil: 2, turningAge: 3 },
];

const fullVisits = [
  { name: 'Georgescu Maria', date: '2026-09-15', time: '10:00', phone: '0722 123 456', parent: 'Elena Georgescu' },
  { name: 'Dobre Vlad', date: '2026-09-15', time: '12:30', phone: '0733 111 222', parent: 'Andrei Dobre' },
  { name: 'Marin Sofia', date: '2026-09-16', time: '09:30', phone: '0744 555 666', parent: 'Ioana Marin' },
];

const fullOverdue = [
  { child: { id: 'c-stan', name: 'Stan Tudor' }, obligation: { rest: 1200, due: '2026-09-05' } },
  { child: { id: 'c-2', name: 'Copil Doi' }, obligation: { rest: 500, due: '2026-09-10' } },
  { child: { id: 'c-3', name: 'Copil Trei' }, obligation: { rest: 450, due: '2026-09-12' } },
];

// Stan Tudor a intrat azi în „De notificat”; ceilalți doi au fost deja
// anunțați în zilele trecute (au cheia lunii curente în registru).
const sentKeysWithTwoAlreadyNotified = {
  'plata:c-2:2026-09': '2026-09-08',
  'plata:c-3:2026-09': '2026-09-08',
};

test('rezumatul complet reproduce exemplul din §5 caracter cu caracter', () => {
  const { text, keys } = buildDailyDigest({
    todayStr: '2026-09-15',
    birthdays: fullBirthdays,
    visits: fullVisits,
    overdue: fullOverdue,
    sentKeys: sentKeysWithTwoAlreadyNotified,
  });

  assert.equal(
    text,
    [
      '<b>Startica · marți, 15 septembrie 2026</b>',
      '',
      '<b>Zile de naștere</b>',
      '• Azi: Popescu Ana (împlinește 4 ani)',
      '• Poimâine, 17.09: Ionescu Mihai (împlinește 3 ani)',
      '',
      '<b>Vizite azi</b>',
      '• 10:00 · Georgescu Maria · 0722 123 456 · Elena Georgescu',
      '• 12:30 · Dobre Vlad · 0733 111 222 · Andrei Dobre',
      '<b>Vizite mâine</b>',
      '• 09:30 · Marin Sofia · 0744 555 666 · Ioana Marin',
      '',
      '<b>De notificat · septembrie 2026</b>',
      '• Stan Tudor · rest 1.200,00 lei · scadent 05.09.2026',
      '3 copii cu rest de plată (2.150,00 lei în total).',
    ].join('\n'),
  );
  assert.deepEqual(keys, ['zi:2026-09-15', 'plata:c-stan:2026-09']);
});

test('ziua fără nimic de semnalat reproduce al doilea exemplu din §5', () => {
  const { text, keys } = buildDailyDigest({
    todayStr: '2026-09-16',
    birthdays: [],
    visits: [],
    overdue: [],
    sentKeys: {},
  });

  assert.equal(
    text,
    [
      '<b>Startica · miercuri, 16 septembrie 2026</b>',
      '',
      'Nimic de semnalat azi: nicio zi de naștere în următoarele 3 zile, nicio vizită azi sau mâine, niciun copil de notificat.',
    ].join('\n'),
  );
  assert.deepEqual(keys, ['zi:2026-09-16']);
});

test('luni, toți copiii cu rest de plată apar cu detalii, indiferent de registru', () => {
  const { text, keys } = buildDailyDigest({
    todayStr: '2026-09-21',
    birthdays: [],
    visits: [],
    overdue: fullOverdue,
    sentKeys: sentKeysWithTwoAlreadyNotified,
  });

  assert.equal(
    text,
    [
      '<b>Startica · luni, 21 septembrie 2026</b>',
      '',
      '<b>De notificat · septembrie 2026</b>',
      '• Stan Tudor · rest 1.200,00 lei · scadent 05.09.2026',
      '• Copil Doi · rest 500,00 lei · scadent 10.09.2026',
      '• Copil Trei · rest 450,00 lei · scadent 12.09.2026',
      '3 copii cu rest de plată (2.150,00 lei în total).',
    ].join('\n'),
  );
  assert.deepEqual(keys, ['zi:2026-09-21', 'plata:c-stan:2026-09', 'plata:c-2:2026-09', 'plata:c-3:2026-09']);
});

test('marți, doar copiii fără cheia lunii apar cu detalii; restul rămân doar în total', () => {
  const { keys, text } = buildDailyDigest({
    todayStr: '2026-09-15',
    birthdays: [],
    visits: [],
    overdue: fullOverdue,
    sentKeys: sentKeysWithTwoAlreadyNotified,
  });

  assert.match(text, /• Stan Tudor/);
  assert.doesNotMatch(text, /• Copil Doi/);
  assert.doesNotMatch(text, /• Copil Trei/);
  assert.match(text, /^3 copii cu rest de plată \(2\.150,00 lei în total\)\.$/m);
  assert.doesNotMatch(text, /Lista completă vine luni/);
  assert.deepEqual(keys, ['zi:2026-09-15', 'plata:c-stan:2026-09']);
});

test('marți, dacă niciun copil nu are detalii, totalul e urmat de „Lista completă vine luni”', () => {
  const sentKeysAllAlreadyNotified = {
    'plata:c-stan:2026-09': '2026-09-14',
    'plata:c-2:2026-09': '2026-09-08',
    'plata:c-3:2026-09': '2026-09-08',
  };
  const { text, keys } = buildDailyDigest({
    todayStr: '2026-09-15',
    birthdays: [],
    visits: [],
    overdue: fullOverdue,
    sentKeys: sentKeysAllAlreadyNotified,
  });

  assert.equal(
    text,
    [
      '<b>Startica · marți, 15 septembrie 2026</b>',
      '',
      '<b>De notificat · septembrie 2026</b>',
      '3 copii cu rest de plată (2.150,00 lei în total). Lista completă vine luni; între timp, Startica › De notificat.',
    ].join('\n'),
  );
  assert.deepEqual(keys, ['zi:2026-09-15']);
});

test('un singur copil cu rest de plată foloseste forma de singular', () => {
  const { text } = buildDailyDigest({
    todayStr: '2026-09-15',
    birthdays: [],
    visits: [],
    overdue: [{ child: { id: 'c-solo', name: 'Solo Copil' }, obligation: { rest: 100, due: '2026-09-10' } }],
    sentKeys: {},
  });
  assert.match(text, /^1 copil cu rest de plată \(100,00 lei în total\)\.$/m);
});

test('copilul care împlinește 1 an foloseste forma de singular', () => {
  const { text } = buildDailyDigest({
    todayStr: '2026-09-15',
    birthdays: [{ child: { name: 'Bebe Nou' }, daysUntil: 0, turningAge: 1 }],
    visits: [],
    overdue: [],
    sentKeys: {},
  });
  assert.match(text, /Bebe Nou \(împlinește 1 an\)/);
});

test('o vizită fără părinte nu lasă un separator agățat', () => {
  const { text } = buildDailyDigest({
    todayStr: '2026-09-15',
    birthdays: [],
    visits: [{ name: 'Copil Fără Părinte', date: '2026-09-15', time: '11:00', phone: '0711 222 333', parent: '' }],
    overdue: [],
    sentKeys: {},
  });
  assert.match(text, /^• 11:00 · Copil Fără Părinte · 0711 222 333$/m);
});

test('numele cu < și & ies scăpate din rezumat', () => {
  const { text } = buildDailyDigest({
    todayStr: '2026-09-15',
    birthdays: [{ child: { name: 'Popa <Mic> & Fiu' }, daysUntil: 0, turningAge: 2 }],
    visits: [{ name: 'Vizită <Test> & Co', date: '2026-09-15', time: '08:00', phone: '', parent: '<Rău>' }],
    overdue: [{ child: { id: 'c-x', name: 'Rest <Copil> & Sold' }, obligation: { rest: 10, due: '2026-09-10' } }],
    sentKeys: {},
  });

  assert.match(text, /Popa &lt;Mic&gt; &amp; Fiu/);
  assert.match(text, /Vizită &lt;Test&gt; &amp; Co/);
  assert.match(text, /&lt;Rău&gt;/);
  assert.match(text, /Rest &lt;Copil&gt; &amp; Sold/);
  assert.doesNotMatch(text, /<Mic>|<Test>|<Rău>|<Copil>/);
});

test('splitDigest taie un text de ~5000 de caractere la limită de linie, fără bucată goală', () => {
  const line = 'x'.repeat(80);
  const text = Array.from({ length: 63 }, () => line).join('\n'); // ~5040 caractere
  const chunks = splitDigest(text);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length > 0);
    assert.ok(chunk.length <= 4096);
    assert.ok(!chunk.startsWith('\n') && !chunk.endsWith('\n'));
  }
  assert.equal(chunks.join('\n'), text);
});

test('splitDigest întoarce o singură bucată pentru un text scurt', () => {
  const text = 'linia unu\nlinia doi';
  assert.deepEqual(splitDigest(text), [text]);
});

test('pruneSentKeys păstrează exact 59 de zile și șterge de la 60 în sus', () => {
  const todayStr = '2026-09-15';
  const sentKeys = {
    'zi:kept-59': shiftDays(todayStr, -59),
    'zi:removed-60': shiftDays(todayStr, -60),
    'zi:removed-61': shiftDays(todayStr, -61),
    'zi:kept-today': todayStr,
  };

  const pruned = pruneSentKeys(sentKeys, todayStr);

  assert.deepEqual(Object.keys(pruned).sort(), ['zi:kept-59', 'zi:kept-today']);
});

test('secțiunea zile de naștere dispare când e dezactivată în preferințe', () => {
  const { text } = buildDailyDigest({
    todayStr: '2026-09-15',
    birthdays: fullBirthdays,
    visits: [],
    overdue: [],
    sentKeys: {},
    preferences: {
      birthdaysEnabled: false,
      visitsEnabled: true,
      overdueEnabled: true,
      overdueCadence: 'monday',
      nothingToReportEnabled: true,
    },
  });
  assert.doesNotMatch(text, /Zile de naștere/);
});

test('cadența „daily” arată toți copiii cu detalii, oricare ar fi ziua sau registrul', () => {
  const { text } = buildDailyDigest({
    todayStr: '2026-09-15', // marți, nu luni
    birthdays: [],
    visits: [],
    overdue: fullOverdue,
    sentKeys: sentKeysWithTwoAlreadyNotified,
    preferences: {
      birthdaysEnabled: true,
      visitsEnabled: true,
      overdueEnabled: true,
      overdueCadence: 'daily',
      nothingToReportEnabled: true,
    },
  });
  assert.match(text, /• Stan Tudor/);
  assert.match(text, /• Copil Doi/);
  assert.match(text, /• Copil Trei/);
});

test('cadența „never” nu arată niciodată detalii și nu promite luni', () => {
  const { text, keys } = buildDailyDigest({
    todayStr: '2026-09-21', // luni
    birthdays: [],
    visits: [],
    overdue: fullOverdue,
    sentKeys: {},
    preferences: {
      birthdaysEnabled: true,
      visitsEnabled: true,
      overdueEnabled: true,
      overdueCadence: 'never',
      nothingToReportEnabled: true,
    },
  });
  assert.doesNotMatch(text, /• Stan Tudor/);
  assert.match(text, /Detaliile sunt în Startica/);
  assert.deepEqual(keys, ['zi:2026-09-21']);
});

test('cu „nimic de semnalat” dezactivat, o zi goală nu produce mesaj de trimis', () => {
  const { text, keys } = buildDailyDigest({
    todayStr: '2026-09-16',
    birthdays: [],
    visits: [],
    overdue: [],
    sentKeys: {},
    preferences: {
      birthdaysEnabled: true,
      visitsEnabled: true,
      overdueEnabled: true,
      overdueCadence: 'monday',
      nothingToReportEnabled: false,
    },
  });
  assert.equal(text, '');
  assert.deepEqual(keys, []);
});

test('vizitele mai departe de mâine intră într-o secțiune separată, cu dată', () => {
  const { text } = buildDailyDigest({
    todayStr: '2026-09-15',
    birthdays: [],
    visits: [{ name: 'Copil Peste Trei Zile', date: '2026-09-18', time: '09:00', phone: '', parent: '' }],
    overdue: [],
    sentKeys: {},
  });
  assert.match(text, /Vizite în zilele următoare/);
  assert.match(text, /18\.09 09:00 · Copil Peste Trei Zile/);
});
