import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventHub } from './events.mjs';

/** Un fals `ServerResponse`, doar cu ce folosește events.mjs. */
function fakeResponse() {
  return /** @type {any} */ ({
    writableNeedDrain: false,
    writes: /** @type {string[]} */ ([]),
    ended: false,
    write(chunk) {
      this.writes.push(chunk);
    },
    end() {
      this.ended = true;
    },
  });
}

test('un al doilea flux al aceluiași dispozitiv închide fluxul vechi — un flux per dispozitiv (D-9)', () => {
  const hub = createEventHub();
  const primul = fakeResponse();
  const alDoilea = fakeResponse();
  hub.subscribe('branch-1', 'dev-a', primul);
  hub.subscribe('branch-1', 'dev-a', alDoilea);
  assert.equal(primul.ended, true);

  hub.publish('branch-1', 5);
  assert.equal(primul.writes.length, 0);
  assert.equal(alDoilea.writes.length, 1);
});

test('un abonat cu bufferul plin (writableNeedDrain) e sărit la publish, fără să blocheze pe ceilalți (D-9)', () => {
  const hub = createEventHub();
  const lent = fakeResponse();
  lent.writableNeedDrain = true;
  const rapid = fakeResponse();
  hub.subscribe('branch-1', 'dev-a', lent);
  hub.subscribe('branch-1', 'dev-b', rapid);

  hub.publish('branch-1', 7);
  assert.equal(lent.writes.length, 0);
  assert.equal(rapid.writes.length, 1);
});

test('dezabonarea întârziată nu șterge fluxul nou, dacă dispozitivul s-a reconectat între timp', () => {
  const hub = createEventHub();
  const primul = fakeResponse();
  const unsubscribe = hub.subscribe('branch-1', 'dev-a', primul);
  const alDoilea = fakeResponse();
  hub.subscribe('branch-1', 'dev-a', alDoilea);
  unsubscribe(); // evenimentul 'close' al fluxului vechi, ajuns cu întârziere

  hub.publish('branch-1', 9);
  assert.equal(alDoilea.writes.length, 1); // fluxul nou e încă abonat
});

test('closeAll închide fiecare flux abonat, pe toate filialele', () => {
  const hub = createEventHub();
  const branch1 = fakeResponse();
  const branch2 = fakeResponse();
  hub.subscribe('branch-1', 'dev-a', branch1);
  hub.subscribe('branch-2', 'dev-b', branch2);
  hub.closeAll();
  assert.equal(branch1.ended, true);
  assert.equal(branch2.ended, true);
});
