import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReset, initialState, parseState, readStorage, writeStorage, resetTimestamp, updateAccount, STORAGE_KEY, addWin, completeQuest, spendDraft, DRAFT_COSTS, WIN_GOLD } from '../tracker.js';
const time = value => Date.parse(value);
const start = time('2026-10-24T12:00:00Z');
function fixture() {
  const state = initialState(start);
  state.accounts.push({ id: 'alpha', name: 'Synthetic Alpha', wins: 3, quests: 1, gold: 1000, gems: 200 }, { id: 'beta', name: 'Synthetic Beta', wins: 15, quests: 3, gold: 0, gems: 0 });
  return state;
}
test('reset boundary is exactly 09:00 UTC independent of local timezone', () => {
  assert.equal(resetTimestamp(time('2026-10-25T08:59:59.999Z')), time('2026-10-24T09:00:00Z'));
  assert.equal(resetTimestamp(time('2026-10-25T09:00:00Z')), time('2026-10-25T09:00:00Z'));
});
test('invalid changes are atomic and accounts stay independent', () => {
  const state = fixture();
  const before = structuredClone(state);
  for (const changes of [{wins:99}, {quests:-1}, {name:'Valid',gold:-1}, {gold:1.5}, {gems:Number.MAX_SAFE_INTEGER+1}, {wins:2,quests:4}]) {
    assert.throws(() => updateAccount(state, 'alpha', changes));
    assert.deepEqual(state,before);
  }
  updateAccount(state,'alpha',{wins:15,quests:0,gold:0,gems:100});
  assert.deepEqual(state.accounts[1],before.accounts[1]);
});
test('corrections and rename retain account order', () => {
  const state = fixture();
  updateAccount(state, 'alpha', { name: '  Renamed  ', wins: 7, quests: 2 });
  assert.deepEqual(state.accounts.map(a => a.id), ['alpha', 'beta']);
  assert.deepEqual(state.accounts[0], { id: 'alpha', name: 'Renamed', wins: 7, quests: 2, gold: 1000, gems: 200 });
  assert.throws(() => updateAccount(state, 'alpha', { name: ' ' }));
  assert.throws(() => updateAccount(state, 'alpha', { wins: 1.5 }));
});
test('single reset adds a quest, clears wins, caps quests and is idempotent', () => {
  const state = fixture();
  assert.equal(applyReset(state, time('2026-10-25T08:59:59Z')), false);
  assert.equal(applyReset(state, time('2026-10-25T09:00:00Z')), true);
  assert.deepEqual(state.accounts.map(a => [a.wins, a.quests]), [[0, 2], [0, 3]]);
  updateAccount(state, 'alpha', { wins: 1 });
  assert.equal(applyReset(state, time('2026-10-25T20:00:00Z')), false);
  assert.equal(state.accounts[0].wins, 1);
});
test('multiple closed days catch up and clock rollback never reverses resets', () => {
  const state = fixture();
  applyReset(state, time('2026-10-30T10:00:00Z'));
  assert.deepEqual(state.accounts.map(a => [a.wins, a.quests]), [[0, 3], [0, 3]]);
  assert.equal(applyReset(state, start), false);
  assert.equal(state.lastReset, time('2026-10-30T09:00:00Z'));
});
test('new accounts receive no retroactive quest', () => {
  const state = initialState(start);
  applyReset(state, time('2026-10-30T10:00:00Z'));
  state.accounts.push({ id: 'new', name: 'Synthetic New', wins: 0, quests: 0 });
  assert.equal(applyReset(state, time('2026-10-30T11:00:00Z')), false);
  assert.equal(state.accounts[0].quests, 0);
});
test('storage round trip and absent storage', () => {
  const map = new Map();
  const storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  assert.deepEqual(readStorage(storage, start), initialState(start));
  writeStorage(storage, fixture());
  assert.deepEqual(readStorage(storage), fixture());
});
test('unreadable or incompatible saved data is not overwritten', () => {
  for (const raw of ['broken', '{}', JSON.stringify({ ...fixture(), version: 3 }), JSON.stringify({ ...fixture(), accounts: [{ id: 'x' }] })]) {
    let writes = 0;
    const storage = { getItem: () => raw, setItem: () => writes++ };
    assert.throws(() => readStorage(storage));
    assert.equal(writes, 0);
  }
  assert.throws(() => readStorage({ getItem() { throw new Error('denied'); } }));
  assert.throws(() => writeStorage({ setItem() { throw new Error('quota'); } }, fixture()));
});
test('invalid numeric values and duplicate IDs are rejected', () => {
  const state = fixture();
  state.accounts[1].id = 'alpha';
  assert.throws(() => parseState(JSON.stringify(state)));
  assert.equal(STORAGE_KEY, 'mtga-account-tracker.v1');
});

test('legacy accounts migrate with balances and preferences without losing progress', () => {
  const legacy = fixture(); legacy.version = 1; delete legacy.draftType;
  legacy.accounts.forEach(a => { delete a.gold; delete a.gems; });
  const migrated = parseState(JSON.stringify(legacy));
  assert.equal(migrated.version,2); assert.equal(migrated.draftType,'quick');
  assert.equal(migrated.lastReset,legacy.lastReset);
  assert.deepEqual(migrated.accounts.map(a=>[a.id,a.wins,a.quests,a.gold,a.gems]),[['alpha',3,1,0,0],['beta',15,3,0,0]]);
});
test('full daily gold schedule and cap; edits do not credit rewards', () => {
  const s=fixture();updateAccount(s,'alpha',{wins:0,gold:0});
  let total=0;
  for(const reward of WIN_GOLD){assert.equal(addWin(s,'alpha'),true);total+=reward;assert.equal(s.accounts[0].gold,total);}
  assert.equal(total,750);assert.equal(addWin(s,'alpha'),false);
  updateAccount(s,'alpha',{wins:0});assert.equal(s.accounts[0].gold,750);
});
test('quest rewards debit one quest and credit gold atomically', () => {
  const s=fixture();updateAccount(s,'alpha',{quests:2,gold:0});
  assert.equal(completeQuest(s,'alpha',500),true);assert.equal(completeQuest(s,'alpha',750),true);
  assert.equal(s.accounts[0].gold,1250);assert.equal(s.accounts[0].quests,0);
  assert.equal(completeQuest(s,'alpha',500),false);assert.equal(completeQuest(s,'alpha',999),false);
  updateAccount(s,'alpha',{quests:1,gold:Number.MAX_SAFE_INTEGER});
  const before=structuredClone(s);assert.throws(()=>completeQuest(s,'alpha',500));assert.deepEqual(s,before);
});
test('draft costs guard every format, currency and affordability boundary', () => {
  for(const type of ['quick','premier'])for(const currency of ['gold','gems'])for(const delta of [-1,0,123]){
    const s=fixture();s.draftType=type;const cost=DRAFT_COSTS[type][currency];
    updateAccount(s,'alpha',{[currency]:cost+delta});const before=structuredClone(s);
    assert.equal(spendDraft(s,'alpha',currency),delta>=0);
    if(delta>=0)before.accounts[0][currency]=delta;
    assert.deepEqual(s,before);
  }
});
test('resets preserve balances and selected draft; v2 round trip', () => {
  const s=fixture();s.draftType='premier';applyReset(s,time('2026-11-01T10:00:00Z'));
  assert.equal(s.accounts[0].gold,1000);assert.equal(s.accounts[0].gems,200);assert.equal(s.draftType,'premier');
  assert.deepEqual(parseState(JSON.stringify(s)),s);
});
