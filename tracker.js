export const STORAGE_KEY = 'mtga-account-tracker.v1';
export const RESET_HOUR_UTC = 9;
export const DRAFT_COSTS = { quick: { gold: 5000, gems: 750 }, premier: { gold: 10000, gems: 1500 } };
export const WIN_GOLD = [250, 100, 100, 100, 0, 50, 0, 50, 0, 50, 0, 25, 0, 25, 0];
const DAY = 86400000;
export function resetTimestamp(now = Date.now()) {
  const d = new Date(now);
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), RESET_HOUR_UTC);
  return now >= today ? today : today - DAY;
}
export function initialState(now = Date.now()) {
  return { version: 2, lastReset: resetTimestamp(now), draftType: 'quick', accounts: [] };
}
function validateChanges(changes) {
  const result = {};
  if (changes.name !== undefined) {
    const name = String(changes.name).trim();
    if (!name || name.length > 80) throw new Error('Enter a name between 1 and 80 characters.');
    result.name = name;
  }
  for (const [field, max] of [['wins', 15], ['quests', 3], ['gold', Number.MAX_SAFE_INTEGER], ['gems', Number.MAX_SAFE_INTEGER]]) {
    if (changes[field] === undefined) continue;
    const value = changes[field];
    if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`Enter a whole number from 0 to ${max.toLocaleString()} for ${field}.`);
    result[field] = value;
  }
  return result;
}
export function parseState(raw) {
  const state = JSON.parse(raw);
  if (!state || ![1, 2].includes(state.version) || !Number.isSafeInteger(state.lastReset) || state.lastReset < 0 || resetTimestamp(state.lastReset) !== state.lastReset || !Array.isArray(state.accounts)) throw new Error('Invalid saved tracker data');
  if (state.version === 1) {
    state.accounts = state.accounts.map(account => ({ ...account, gold: 0, gems: 0 }));
    state.draftType = 'quick';
    state.version = 2;
  }
  if (!Object.hasOwn(DRAFT_COSTS, state.draftType)) throw new Error('Invalid draft type');
  const ids = new Set();
  for (const a of state.accounts) {
    if (!a || typeof a.id !== 'string' || !a.id || ids.has(a.id) || typeof a.name !== 'string' || !['name','wins','quests','gold','gems'].every(key => Object.hasOwn(a,key))) throw new Error('Invalid saved account');
    validateChanges(a);
    ids.add(a.id);
  }
  return state;
}
export function applyReset(state, now = Date.now()) {
  const threshold = resetTimestamp(now);
  if (threshold <= state.lastReset) return false;
  const days = Math.floor((threshold - state.lastReset) / DAY);
  state.accounts.forEach(a => { a.wins = 0; a.quests = Math.min(3, a.quests + days); });
  state.lastReset = threshold;
  return true;
}
export function updateAccount(state, id, changes) {
  const account = state.accounts.find(a => a.id === id);
  if (account) Object.assign(account, validateChanges(changes));
}
export function addWin(state, id) {
  const a = state.accounts.find(a => a.id === id);
  if (!a || a.wins >= 15) return false;
  updateAccount(state, id, { wins: a.wins + 1, gold: a.gold + WIN_GOLD[a.wins] });
  return true;
}
export function completeQuest(state, id, reward) {
  const a = state.accounts.find(a => a.id === id);
  if (!a || a.quests === 0 || ![500, 750].includes(reward)) return false;
  updateAccount(state, id, { quests: a.quests - 1, gold: a.gold + reward });
  return true;
}
export function spendDraft(state, id, currency) {
  const a = state.accounts.find(a => a.id === id);
  if (!a || !['gold','gems'].includes(currency)) return false;
  const cost = DRAFT_COSTS[state.draftType][currency];
  if (a[currency] < cost) return false;
  updateAccount(state, id, { [currency]: a[currency] - cost });
  return true;
}
export function readStorage(storage, now = Date.now()) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw === null ? initialState(now) : parseState(raw);
}
export function writeStorage(storage, state) { storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
