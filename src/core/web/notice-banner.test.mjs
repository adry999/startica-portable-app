import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_HIDE_MS, createNoticeBanner } from './notice-banner.mjs';

function createFakeElement() {
  return /** @type {any} */ ({ className: '', textContent: '' });
}

test('show() scrie textul și clasa de eroare, hide() curăță ambele', () => {
  const element = createFakeElement();
  const banner = createNoticeBanner(element);

  banner.show('Salvat.');
  assert.equal(element.textContent, 'Salvat.');
  assert.equal(element.className, 'notice');

  banner.show('A eșuat.', true);
  assert.equal(element.className, 'notice error');

  banner.hide();
  assert.equal(element.textContent, '');
  assert.equal(element.className, '');
});

test('mesajul dispare singur după AUTO_HIDE_MS', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const element = createFakeElement();
  const banner = createNoticeBanner(element);

  banner.show('Salvat.');
  t.mock.timers.tick(AUTO_HIDE_MS);

  assert.equal(element.textContent, '');
  assert.equal(element.className, '');
});

test('un mesaj nou reia numărătoarea, nu moștenește timerul celui vechi', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const element = createFakeElement();
  const banner = createNoticeBanner(element);

  banner.show('Primul.');
  t.mock.timers.tick(AUTO_HIDE_MS - 1000);
  banner.show('Al doilea.');
  t.mock.timers.tick(AUTO_HIDE_MS - 1000);

  assert.equal(element.textContent, 'Al doilea.');

  t.mock.timers.tick(1000);
  assert.equal(element.textContent, '');
});
