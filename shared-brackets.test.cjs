const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const properties = new Map([['TOURNAMENT_ADMIN_PASSWORD', 'test-password']]);
const sheets = new Map();
function makeSheet() {
  const rows = [];
  return {
    appendRow(row) { rows.push(row); }, setFrozenRows() {},
    getLastRow() { return rows.length; },
    getDataRange() { return { getValues: () => rows.map(row => [...row]) }; },
    getRange(r, c, h, w) { return {
      getValues: () => rows.slice(r - 1, r - 1 + h).map(row => row.slice(c - 1, c - 1 + w)),
      setValues(values) { values.forEach((row, i) => { rows[r - 1 + i] = [...row]; }); }
    }; }
  };
}
const context = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({
    getProperty: key => properties.get(key) || null,
    setProperty: (key, value) => properties.set(key, value),
    setProperties: values => Object.entries(values).forEach(([key, value]) => properties.set(key, value))
  }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({
    getSheetByName: name => sheets.get(name),
    insertSheet: name => { const sheet = makeSheet(); sheets.set(name, sheet); return sheet; }
  }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, hasLock: () => true, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) }
});
vm.runInContext(fs.readFileSync('Code.gs', 'utf8'), context);
vm.runInContext('getRegistrationSheet_ = () => ({}); getTeamsByCategory_ = () => ({}); getCategoryAvailability_ = () => [];', context);
const category = "Novice Low Men's Doubles";
const post = parameter => context.doPost({ parameter });
const controls = (control, value, password = 'test-password') => post({
  action: 'updateTournamentControls', control, value: String(value),
  revision: String(context.getTournamentControls_().revision), adminPassword: password
});
assert.equal(context.doGet().bracketState.revisions[category], undefined);
for (const [control, value] of [['registrationOpen', false], ['registrationOpen', true], ['matchingLocked', true], ['matchingLocked', false]]) {
  const revision = context.getTournamentControls_().revision;
  assert.equal(controls(control, value, '').ok, false);
  assert.equal(controls(control, value, 'wrong').ok, false);
  assert.equal(context.getTournamentControls_().revision, revision);
  assert.equal(controls(control, value).ok, true);
}
const data = { action: 'saveBracketResults', category, revision: '0', controlsRevision: '4',
  adminPassword: '', results: JSON.stringify({ initial: {1: 'seed-1-TEAM'}, H: {}, L: {} }) };
assert.equal(post({...data, results: '{bad'}).ok, false);
assert.equal(post(data).ok, true, 'declaring winner must not require password');
assert.equal(context.doGet().bracketState.results[category].initial['1'], 'seed-1-TEAM');
assert.equal(post(data).ok, false, 'second device must not overwrite saved revision');
assert.equal(post({...data, revision: '1', controlsRevision: '3'}).ok, false);
assert.equal(controls('registrationOpen', false).ok, true);
assert.equal(post({...data, revision: '1', controlsRevision: '5', results: JSON.stringify({initial: {}, H: {'QF-1': 'seed-1-TEAM'}, L: {}})}).ok, true, 'results writable while registration closed');
assert.equal(post({...data, revision: '2', controlsRevision: '5', results: JSON.stringify({initial: {}, H: {}, L: {}})}).ok, true);
assert.equal(Object.keys(context.doGet().bracketState.results[category].H).length, 0);
assert.equal(context.doGet().bracketState.revisions[category], 3, 'reset retains revision against stale imports');

const frontend = fs.readFileSync('bracketing.js', 'utf8');
const functionSource = frontend.slice(frontend.indexOf('async function updateTournamentControl('), frontend.indexOf('\nregistrationControlButton.addEventListener'));
let prompts = 0;
const ui = vm.createContext({
  tournamentControls: {registrationOpen: true, matchingLocked: false, revision: 0},
  isSavingControls: false, isFetching: false, isEditingResults: false,
  tournamentAdminPassword: 'previous-password', GOOGLE_SCRIPT_URL: 'test', URLSearchParams,
  renderTournamentControls() {}, renderCategory() {}, getCurrentCategory() {return category;},
  deduplicateTeams: x => x, showToast() {}, loadBracketData: async () => {},
  requestAdminAccess: async fresh => { assert.equal(fresh, true); prompts++; ui.tournamentAdminPassword = 'test-password'; return true; },
  fetch: async (url, options) => {
    assert.equal(options.body.get('adminPassword'), 'test-password');
    const controls = {...ui.tournamentControls, [options.body.get('control')]: options.body.get('value') === 'true'};
    return {ok: true, json: async () => ({ok: true, tournamentControls: controls})};
  }
});
vm.runInContext(functionSource, ui);
(async () => {
  for (const control of ['registrationOpen', 'registrationOpen', 'matchingLocked', 'matchingLocked']) {
    await ui.updateTournamentControl(control);
    assert.equal(ui.tournamentAdminPassword, '');
  }
  assert.equal(prompts, 4, 'each toggle must prompt even with prior access');
  ui.requestAdminAccess = async () => false;
  ui.fetch = () => { throw new Error('cancel must not submit'); };
  await ui.updateTournamentControl('registrationOpen');
  assert.equal(ui.isSavingControls, false);
  console.log('PASS: shared save/read/reset, stale revisions, closed registration, password enforcement for all four controls, fresh prompts, cancellation.');
})().catch(error => {console.error(error); process.exitCode = 1;});
