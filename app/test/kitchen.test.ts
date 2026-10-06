import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ageState, baseUrl, formatAge, newTicketIds, parseSeconds, primaryAction } from '../src/lib/kitchen.ts';

const t0 = Date.parse('2026-10-06T17:00:00Z');
const at = (min: number) => t0 + min * 60000;
const ticket = { createdAt: '2026-10-06T17:00:00Z', readyAt: null };

test('header colour follows the age, ready and completed override it', () => {
  assert.equal(ageState(ticket, at(1), 300, 600), 'fresh');
  assert.equal(ageState(ticket, at(5), 300, 600), 'warn');
  assert.equal(ageState(ticket, at(10), 300, 600), 'late');
  assert.equal(ageState({ ...ticket, readyAt: '2026-10-06T17:03:00Z' }, at(30), 300, 600), 'ready');
  assert.equal(ageState(ticket, at(30), 300, 600, true), 'done');
});

test('the yellow and red times are set in seconds', () => {
  assert.equal(ageState(ticket, t0 + 89000, 90, 120), 'fresh');
  assert.equal(ageState(ticket, t0 + 90000, 90, 120), 'warn');
  assert.equal(ageState(ticket, t0 + 120000, 90, 120), 'late');
});

test('seconds entries are whole numbers in range', () => {
  assert.equal(parseSeconds(' 90 '), 90);
  assert.equal(parseSeconds('0'), null);
  assert.equal(parseSeconds('1.5'), null);
  assert.equal(parseSeconds('abc'), null);
  assert.equal(parseSeconds('90000'), null);
});

test('age text is m:ss and never negative', () => {
  assert.equal(formatAge(125000), '2:05');
  assert.equal(formatAge(-5000), '0:00');
});

test('the main button is Ready, then Complete; Recall in the Completed view', () => {
  const line = (done: boolean) => ({ uid: 'x', name: 'a', qty: 1, note: null, mods: [], done });
  assert.equal(primaryAction({ readyAt: null, lines: [line(false)] }, false), 'ready');
  assert.equal(primaryAction({ readyAt: null, lines: [line(true)] }, false), 'bump');
  assert.equal(primaryAction({ readyAt: '2026-10-06T17:03:00Z', lines: [line(false)] }, false), 'bump');
  assert.equal(primaryAction({ readyAt: null, lines: [line(false)] }, true), 'recall');
});

test('the PC address is tidied or refused', () => {
  assert.equal(baseUrl('CYMENUDISPLAY:8790'), 'http://CYMENUDISPLAY:8790');
  assert.equal(baseUrl(' http://192.168.1.5:8790/ '), 'http://192.168.1.5:8790');
  assert.equal(baseUrl(''), null);
  assert.equal(baseUrl('not a url'), null);
});

test('a chime is wanted only for tickets that appear after the first load', () => {
  assert.equal(newTicketIds(null, [{ id: 'a' }]), false);
  assert.equal(newTicketIds(new Set(['a']), [{ id: 'a' }]), false);
  assert.equal(newTicketIds(new Set(['a']), [{ id: 'a' }, { id: 'b' }]), true);
});
