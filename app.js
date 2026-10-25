import { applyReset, initialState, readStorage, writeStorage, resetTimestamp, updateAccount, STORAGE_KEY, DRAFT_COSTS, addWin, completeQuest, spendDraft } from './tracker.js';
const $ = s => document.querySelector(s);
const edits = new Map();
let state, storageBlocked = false, removingId = null, removeFocus = null;
const node = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
function button(text, cls, action, label = text) { const el = node('button', cls, text); el.type = 'button'; el.setAttribute('aria-label', label); el.onclick = action; return el; }
function announce(text) { $('#announcement').textContent = text; }
function storageError(text) { $('#storage-error').textContent = text; $('#storage-error').hidden = false; $('#save-status').textContent = 'Changes are not saved'; }
try { state = readStorage(localStorage); } catch { state = initialState(); storageBlocked = true; storageError('Saved data could not be read. It has been left untouched. Reload to retry; changes in this session cannot be saved.'); }
function save() {
  if (storageBlocked) return;
  try { writeStorage(localStorage, state); $('#storage-error').hidden = true; $('#save-status').textContent = 'Saved in this browser'; }
  catch { storageError('Your browser could not save changes. Keep this window open and allow browser storage, then make another change to retry.'); }
}
function reconcile() {
  if (applyReset(state)) { save(); render(); announce('New Arena day. Daily wins and quests updated.'); }
  const minutes = Math.ceil(Math.max(0, resetTimestamp() + 86400000 - Date.now()) / 60000);
  $('#reset-clock').textContent = `Reset in ${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
function account(id) { return state.accounts.find(a => a.id === id); }
function focusCard(id, action = 'edit') { const card = Array.from($('#accounts').children).find(el => el.dataset.id === id); const target = card?.querySelector(`[data-action="${action}"]`); if (target && !target.disabled) target.focus(); else card?.querySelector('.edit-button')?.focus(); }
function commitField(id, field) {
  const draft = edits.get(id); const a = account(id);
  if (!draft || !a || !Object.hasOwn(draft.values, field)) return true;
  const raw = draft.values[field];
  try {
    if (!raw.trim()) throw new Error(`Enter ${field === 'name' ? 'an account name' : `a whole number for ${field}`}.`);
    updateAccount(state, id, { [field]: field === 'name' ? raw : Number(raw) });
    delete draft.values[field]; delete draft.errors[field]; save();
    return true;
  } catch (error) { draft.errors[field] = error.message; return false; }
}
function showErrors(id, card) {
  const draft = edits.get(id); if (!draft) return;
  const error = card.querySelector('.inline-error');
  error.textContent = Object.values(draft.errors).join(' '); error.hidden = !error.textContent;
  card.querySelectorAll('input[data-field]').forEach(input => input.setAttribute('aria-invalid', String(Boolean(draft.errors[input.dataset.field]))));
}
function inlineInput(a, field) {
  const draft = edits.get(a.id);
  const input = node('input', `inline-input ${field}`);
  input.type = field === 'name' ? 'text' : 'number'; input.dataset.field = field;
  input.setAttribute('aria-label', `${field === 'name' ? 'Account name' : field} for ${a.name}`);
  input.setAttribute('aria-describedby', `error-${a.id}`);
  if (field === 'name') input.maxLength = 80; else { input.min = '0'; input.max = String(Number.MAX_SAFE_INTEGER); input.step = '1'; }
  input.value = draft.values[field] ?? a[field];
  input.oninput = () => { draft.values[field] = input.value; delete draft.errors[field]; showErrors(a.id, input.closest('.card')); };
  input.onblur = () => { commitField(a.id, field); showErrors(a.id, input.closest('.card')); };
  input.onkeydown = event => {
    if (event.key === 'Enter') { event.preventDefault(); commitField(a.id, field); showErrors(a.id, input.closest('.card')); }
    if (event.key === 'Escape') { event.preventDefault(); delete draft.values[field]; delete draft.errors[field]; input.value = account(a.id)[field]; showErrors(a.id, input.closest('.card')); }
  };
  return input;
}
function toggleEdit(id) {
  reconcile();
  if (edits.has(id)) {
    const draft = edits.get(id);
    const valid = Object.keys(draft.values).map(field => commitField(id, field)).every(Boolean);
    if (!valid) { const card = Array.from($('#accounts').children).find(el => el.dataset.id === id); showErrors(id, card); card.querySelector('[aria-invalid="true"]')?.focus(); return; }
    edits.delete(id);
  } else edits.set(id, { values: {}, errors: {} });
  render(); focusCard(id);
}
function act(id, action, execute) {
  reconcile();
  try { execute(); save(); render(); focusCard(id, action); announce(`${account(id)?.name}: progress saved.`); }
  catch (error) { announce(error.message); storageError(`Action could not be applied: ${error.message}`); }
}
function counter(a, field, max, title) {
  const editing = edits.has(a.id); const row = node('div', `counter-row ${field}`);
  row.append(node('span', 'section-label', title));
  const track = node('div', `progress${field === 'quests' && a.quests === 3 ? ' full' : ''}`);
  track.setAttribute('aria-label', `${a[field]} ${title.toLowerCase()}`);
  for (let i = 0; i < (field === 'wins' ? 4 : 3); i++) track.append(node('span', i < a[field] ? 'filled' : ''));
  row.append(track, node('span', 'counter-count', `${a[field]}/${max}`));
  const actions = node('div', 'counter-actions');
  if (editing) {
    for (const [text, delta] of [['−', -1], ['+', 1]]) {
      const action = `correct-${field}-${delta}`;
      const control = button(text, 'step-button', () => act(a.id, action, () => { const current = account(a.id); updateAccount(state, a.id, { [field]: Math.min(max, Math.max(0, current[field] + delta)) }); }), `${delta < 0 ? 'Decrease' : 'Increase'} ${title.toLowerCase()} for ${a.name}`);
      control.dataset.action = action; control.disabled = delta < 0 ? a[field] === 0 : a[field] === max; actions.append(control);
    }
  } else if (field === 'wins') {
    const win = button('+ Win', 'win-button', () => act(a.id, 'win', () => addWin(state, a.id)), `Add a win for ${a.name}`);
    win.dataset.action = 'win'; win.disabled = a.wins === 15; actions.append(win);
  } else for (const reward of [500, 750]) {
    const complete = button(`+${reward} gold`, 'quest-button', () => act(a.id, `quest-${reward}`, () => completeQuest(state, a.id, reward)), `Complete a ${reward} gold quest for ${a.name}`);
    complete.dataset.action = `quest-${reward}`; complete.disabled = a.quests === 0; actions.append(complete);
  }
  row.append(actions); return row;
}
function makeCard(a) {
  const editing = edits.has(a.id); const card = node('article', 'card'); card.dataset.id = a.id;
  const head = node('div', 'card-head'); const symbol = node('span', 'account-symbol', Array.from(a.name)[0].toUpperCase()); symbol.setAttribute('aria-hidden', 'true');
  const edit = button(editing ? 'Done' : 'Edit', 'edit-button', () => toggleEdit(a.id), `${editing ? 'Done editing' : 'Edit'} ${a.name}`); edit.dataset.action = 'edit';
  head.append(symbol, editing ? inlineInput(a, 'name') : node('h2', 'account-name', a.name), edit);
  const balances = node('div', 'balances');
  for (const currency of ['gold', 'gems']) { const balance = node('div', `balance ${currency}`); balance.append(editing ? inlineInput(a, currency) : node('strong', '', a[currency].toLocaleString()), node('span', 'currency-suffix', currency)); balances.append(balance); }
  card.append(head, balances, counter(a, 'wins', 15, 'Wins'), counter(a, 'quests', 3, 'Quests'));
  if (editing) {
    const error = node('p', 'error inline-error'); error.id = `error-${a.id}`; error.setAttribute('role','alert'); error.hidden = true; card.append(error);
    card.append(button('Remove account', 'remove-edit', () => requestRemoval(a.id)));
    showErrors(a.id, card);
  } else if (['gold','gems'].some(currency => a[currency] >= DRAFT_COSTS[state.draftType][currency])) {
    const row = node('div', 'draft-row'); row.append(node('span', 'section-label', 'Enter draft')); const actions = node('div', 'draft-actions');
    for (const currency of ['gold','gems']) { const cost = DRAFT_COSTS[state.draftType][currency]; const spend = button(`${cost.toLocaleString()} ${currency}`, 'draft-button', () => act(a.id, `draft-${currency}`, () => spendDraft(state, a.id, currency)), `Spend ${cost.toLocaleString()} ${currency} on a ${state.draftType} draft for ${a.name}`); spend.dataset.action = `draft-${currency}`; spend.disabled = a[currency] < cost; actions.append(spend); }
    row.append(actions); card.append(row);
  }
  return card;
}
function render() {
  $('#draft-type').value = state.draftType;
  const list = $('#accounts');
  // Keep edited cards mounted: unrelated updates must not blur inputs or lose drafts.
  const existing = new Map(Array.from(list.children, el => [el.dataset.id, el]));
  for (const a of state.accounts) {
    const previous = existing.get(a.id);
    if (previous && edits.has(a.id) && previous.querySelector('input')) {
      for (const field of ['wins','quests']) previous.querySelector(`.counter-row.${field}`).replaceWith(counter(a, field, field === 'wins' ? 15 : 3, field === 'wins' ? 'Wins' : 'Quests'));
      for (const field of ['name','gold','gems']) { const input = previous.querySelector(`[data-field="${field}"]`); if (!Object.hasOwn(edits.get(a.id).values, field) && input !== document.activeElement) input.value = a[field]; }
      showErrors(a.id, previous);
    } else { const card = makeCard(a); if (previous) previous.replaceWith(card); else list.append(card); }
    existing.delete(a.id);
  }
  for (const [id, el] of existing) { edits.delete(id); el.remove(); }
  $('#empty').hidden = state.accounts.length > 0;
}
function requestRemoval(id) { removingId = id; removeFocus = document.activeElement; $('#remove-description').textContent = `Remove “${account(id).name}” and its progress from this browser?`; $('#remove-dialog').returnValue = ''; $('#remove-dialog').showModal(); }
$('#remove-dialog').onclose = () => { if ($('#remove-dialog').returnValue === 'remove') { state.accounts = state.accounts.filter(a => a.id !== removingId); edits.delete(removingId); save(); render(); $('#add-account').focus(); announce('Account removed.'); } else removeFocus?.focus(); removingId = null; };
function openAccount() { reconcile(); $('#account-form').reset(); $('#form-error').hidden = true; $('#account-dialog').showModal(); $('#account-name').focus(); }
$('#add-account').onclick = openAccount; $('#empty-add').onclick = openAccount;
$('#close-dialog').onclick = () => $('#account-dialog').close();
$('#account-form').onsubmit = event => {
  event.preventDefault(); reconcile();
  const changes = { name: $('#account-name').value.trim() };
  for (const field of ['gold','gems','wins','quests']) changes[field] = Number($(`#account-${field}`).value);
  const id = crypto.randomUUID(); const candidate = { ...state, accounts: [{ id }] };
  try { updateAccount(candidate, id, changes); state.accounts.push(candidate.accounts[0]); save(); $('#account-dialog').close(); render(); focusCard(id); }
  catch (error) { $('#form-error').textContent = error.message; $('#form-error').hidden = false; }
};
$('#draft-type').onchange = () => { const selected = $('#draft-type').value; reconcile(); state.draftType = selected; save(); render(); };
window.addEventListener('focus', reconcile);
document.addEventListener('visibilitychange', () => { if (!document.hidden) reconcile(); });
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try { state = readStorage(localStorage); storageBlocked = false; $('#storage-error').hidden = true; $('#save-status').textContent = 'Saved in this browser'; reconcile(); render(); }
  catch { storageBlocked = true; storageError('Saved data changed in another window and could not be read. It has been left untouched. Reload to retry.'); }
});
render(); reconcile(); if (!storageBlocked) save(); setInterval(reconcile, 15000);
