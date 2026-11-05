import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'schedule-core.js'), 'utf8');

const sandbox = {
  window: {},
  self: {},
  console,
  fetch() { throw new Error('network disabled in test'); },
};
sandbox.globalThis = sandbox;
const context = vm.createContext(sandbox);
vm.runInContext(src + '\n;globalThis.Sched = Sched;', context, { filename: 'schedule-core.js' });
const Sched = context.Sched;

const base = {
  term: 'Test term',
  week1: '2026-07-27',
  classes: [{ id: 'a', day: 'Mon', start: '07:00', end: '10:00', subject: 'botany' }],
  weeks: {
    1: { topics: { a: 'Week 1 topic' }, notes: ['one'], extra: [] },
    2: { topics: { a: 'Week 2 topic' }, times: { a: { start: '08:00', end: '11:00' } } },
  },
  holidays: { '2026-11-01': 'All Saints Day', '2026-11-02': 'All Souls Day' },
  subjects: { botany: { name: 'General Botany', hue: 145 } },
};
const snapshot = JSON.stringify(base);
const json = v => JSON.parse(JSON.stringify(v));

assert.equal(typeof Sched.merge, 'function', 'Sched.merge is a function');

{
  const ov = { weeks: { 1: { topics: { a: 'Changed topic' }, notes: ['changed'], cancel: ['a'] } } };
  const ovSnap = JSON.stringify(ov);
  const merged = Sched.merge(base, ov);
  assert.deepEqual(json(merged.weeks[1]), ov.weeks[1], 'existing week is replaced');
  assert.deepEqual(json(merged.weeks[2]), base.weeks[2], 'other weeks are untouched');
  assert.equal(JSON.stringify(ov), ovSnap, 'override is not mutated');
}

{
  const ov = { weeks: { 9: { topics: { a: 'New week' }, notes: [] } } };
  const merged = Sched.merge(base, ov);
  assert.deepEqual(json(merged.weeks[9]), ov.weeks[9], 'new week is added');
  assert.deepEqual(json(merged.weeks[1]), base.weeks[1], 'existing weeks stay when a new one is added');
}

{
  const ov = { weeks: {}, holidays: { '2026-12-25': 'Christmas' } };
  const merged = Sched.merge(base, ov);
  assert.deepEqual(json(merged.holidays), ov.holidays, 'holidays replace base entirely when present');
  assert.deepEqual(base.holidays, JSON.parse(snapshot).holidays, 'base holidays stay untouched');
}

{
  const ov = { weeks: { 1: { topics: { a: 'No holiday override' } } } };
  const merged = Sched.merge(base, ov);
  assert.deepEqual(json(merged.holidays), base.holidays, 'holidays are kept when the override has none');
}

for (const ov of [null, undefined, {}]) {
  const merged = Sched.merge(base, ov);
  assert.deepEqual(json(merged), base, 'empty override equals base');
  assert.notEqual(merged, base, 'empty override returns a copy');
}

{
  const merged = Sched.merge(base, { weeks: { 1: { topics: { a: 'Mutate check' } } } });
  merged.weeks[1].topics.a = 'edited after merge';
  merged.weeks[2].topics.a = 'edited after merge';
  merged.holidays['2026-11-01'] = 'edited after merge';
  assert.equal(JSON.stringify(base), snapshot, 'base is never mutated');
}

console.log('OK');
