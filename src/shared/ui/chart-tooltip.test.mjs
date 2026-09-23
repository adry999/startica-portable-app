import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBarTooltip } from './chart-tooltip.mjs';

test('formatBarTooltip arată numele lunii, anul și suma formatată', () => {
  assert.equal(formatBarTooltip('2026-09', 45230), 'Septembrie 2026 · 45.230,00 lei');
  assert.equal(formatBarTooltip('2026-01', 0), 'Ianuarie 2026 · 0,00 lei');
});

test('formatBarTooltip cade pe textul brut al lunii dacă indexul e în afara intervalului', () => {
  assert.equal(formatBarTooltip('2026-13', 100), '2026-13 · 100,00 lei');
});
