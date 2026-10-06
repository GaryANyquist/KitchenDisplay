import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTickets, itemTotals } from '../src/tickets.js';

const orders = [
  { id: 'o1', number: 7, created_at: new Date('2026-10-06T17:00:00Z'), customer_name: 'Sam', pager_number: '12', order_up_at: null, completed_at: null },
  { id: 'o2', number: 8, created_at: new Date('2026-10-06T17:01:00Z'), customer_name: null, pager_number: null, order_up_at: new Date('2026-10-06T17:05:00Z'), completed_at: null },
];
const lines = [
  { uid: 'b', order_id: 'o1', name: 'Soup', qty: 1, note: null, line_index: 1, category_id: 'soups', done_at: null },
  { uid: 'a', order_id: 'o1', name: 'Burger', qty: 2, note: 'no onion', line_index: 0, category_id: 'burgers', done_at: new Date() },
  { uid: 'c', order_id: 'o2', name: 'Soup', qty: 3, note: null, line_index: 0, category_id: 'soups', done_at: null },
];
const mods = [{ line_uid: 'a', group_name: 'Toppings', option_name: 'Mayo' }];

test('lines are ordered, with modifiers, notes and done state', () => {
  const [t1] = buildTickets(orders, lines, mods);
  assert.equal(t1.number, 7);
  assert.equal(t1.name, 'Sam');
  assert.equal(t1.pager, '12');
  assert.deepEqual(t1.lines.map((l) => l.uid), ['a', 'b']);
  assert.deepEqual(t1.lines[0].mods, ['Mayo']);
  assert.equal(t1.lines[0].note, 'no onion');
  assert.equal(t1.lines[0].done, true);
  assert.equal(t1.lines[1].done, false);
});

test('ready time is carried through', () => {
  const t = buildTickets(orders, lines, mods);
  assert.equal(t[0].readyAt, null);
  assert.equal(t[1].readyAt, '2026-10-06T17:05:00.000Z');
});

test('a station only sees its own categories and drops empty tickets', () => {
  const t = buildTickets(orders, lines, mods, ['burgers']);
  assert.equal(t.length, 1);
  assert.deepEqual(t[0].lines.map((l) => l.uid), ['a']);
});

test('item totals count only what is not done, biggest first', () => {
  const t = buildTickets(orders, lines, mods);
  assert.deepEqual(itemTotals(t), [{ name: 'Soup', qty: 4 }]);
});
