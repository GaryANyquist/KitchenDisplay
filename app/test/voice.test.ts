import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Ticket } from '../src/lib/kitchen.ts';
import { parseVoiceCommand, tokenize } from '../src/lib/voice.ts';

const mk = (id: string, number: number, pager: string | null): Ticket => ({
  id, number, name: null, pager, createdAt: '2026-10-06T17:00:00Z', readyAt: null, completedAt: null, lines: [],
});
const tickets = [mk('a', 41, '12'), mk('b', 42, null), mk('c', 12, '7')];

const cmd = (s: string) => {
  const r = parseVoiceCommand(s, tickets);
  return r && (r.kind === 'command' ? [r.action, r.ticket.id] : [r.kind, r.action, r.label]);
};

test('number words become digits', () => {
  assert.deepEqual(tokenize('Complete pager twenty-one'), ['complete', 'pager', '21']);
  assert.deepEqual(tokenize('done twenty one'), ['done', '21']);
  assert.deepEqual(tokenize('bump ninety'), ['bump', '90']);
  assert.deepEqual(tokenize('order #5'), ['order', 'number', '5']);
});

test('complete by pager, in either word order', () => {
  assert.deepEqual(cmd('complete pager 12'), ['bump', 'a']);
  assert.deepEqual(cmd('Pager twelve complete.'), ['bump', 'a']);
  assert.deepEqual(cmd('pager 7 done'), ['bump', 'c']);
});

test('by order number, and a bare number prefers the pager the heading shows', () => {
  assert.deepEqual(cmd('finished order 41'), ['bump', 'a']);
  assert.deepEqual(cmd('order 12 complete'), ['bump', 'c']);
  assert.deepEqual(cmd('12 done'), ['bump', 'a']); // pager 12, not order 12
  assert.deepEqual(cmd('bump 42'), ['bump', 'b']); // no pager 42, so the order
});

test('ready is a separate command', () => {
  assert.deepEqual(cmd('pager 12 ready'), ['ready', 'a']);
});

test('an unknown number is reported, not guessed', () => {
  assert.deepEqual(cmd('complete pager 99'), ['nomatch', 'bump', 'pager 99']);
});

test('chatter that is not a command is ignored', () => {
  assert.equal(cmd('we need more burgers'), null);
  assert.equal(cmd('complete'), null);
  assert.equal(cmd('pager 12'), null);
});
