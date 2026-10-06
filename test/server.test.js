import assert from 'node:assert/strict';
import { test } from 'node:test';

import { authorized } from '../src/server.js';

test('no key configured leaves the API open', () => {
  assert.equal(authorized(undefined, null, ''), true);
});

test('a key must match, in the header or the query string', () => {
  assert.equal(authorized('Bearer abc', null, 'abc'), true);
  assert.equal(authorized(undefined, 'abc', 'abc'), true);
  assert.equal(authorized('Bearer nope', null, 'abc'), false);
  assert.equal(authorized(undefined, null, 'abc'), false);
});
