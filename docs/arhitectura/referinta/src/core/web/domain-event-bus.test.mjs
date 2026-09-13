import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomainEventBus } from './domain-event-bus.mjs';

const EVENT_NAMES = ['payments.assigned', 'records.reloaded'];

function createHarness() {
  const listenerErrors = [];
  const eventBus = createDomainEventBus({
    eventNames: EVENT_NAMES,
    onListenerError: (error, eventName) => listenerErrors.push({ error: String(error), eventName }),
  });
  return { eventBus, listenerErrors };
}

test('livrează payload-ul doar abonaților evenimentului publicat', () => {
  const { eventBus } = createHarness();
  const assigned = [];
  const reloaded = [];
  eventBus.subscribe('payments.assigned', payload => assigned.push(payload));
  eventBus.subscribe('records.reloaded', payload => reloaded.push(payload));

  eventBus.publish('payments.assigned', { paymentIds: ['PAY-1'], childIds: ['CHILD-1'] });

  assert.deepEqual(assigned, [{ paymentIds: ['PAY-1'], childIds: ['CHILD-1'] }]);
  assert.deepEqual(reloaded, []);
});

test('dezabonarea oprește livrarea, inclusiv în timpul publicării', () => {
  const { eventBus } = createHarness();
  const received = [];
  const unsubscribeFirst = eventBus.subscribe('records.reloaded', () => {
    received.push('first');
    unsubscribeSecond();
  });
  const unsubscribeSecond = eventBus.subscribe('records.reloaded', () => received.push('second'));

  eventBus.publish('records.reloaded', { revision: 1 });
  unsubscribeFirst();
  eventBus.publish('records.reloaded', { revision: 2 });

  assert.deepEqual(received, ['first', 'second']);
});

test('un abonat care aruncă nu blochează ceilalți abonați', () => {
  const { eventBus, listenerErrors } = createHarness();
  const received = [];
  eventBus.subscribe('records.reloaded', () => {
    throw new Error('randare eșuată');
  });
  eventBus.subscribe('records.reloaded', payload => received.push(payload.revision));

  eventBus.publish('records.reloaded', { revision: 3 });

  assert.deepEqual(received, [3]);
  assert.deepEqual(listenerErrors, [{ error: 'Error: randare eșuată', eventName: 'records.reloaded' }]);
});

test('respingerea unui abonat asincron este raportată', async () => {
  const { eventBus, listenerErrors } = createHarness();
  eventBus.subscribe('records.reloaded', async () => {
    throw new Error('încărcare eșuată');
  });

  eventBus.publish('records.reloaded', { revision: 4 });
  await new Promise(resolve => setImmediate(resolve));

  assert.deepEqual(listenerErrors, [{ error: 'Error: încărcare eșuată', eventName: 'records.reloaded' }]);
});

test('un nume de eveniment necunoscut eșuează imediat', () => {
  const { eventBus } = createHarness();
  assert.throws(() => eventBus.publish('payment.assigned', {}), TypeError);
  assert.throws(() => eventBus.subscribe('records.reload', () => {}), TypeError);
});
