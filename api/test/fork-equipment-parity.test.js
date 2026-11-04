import test from 'node:test';
import assert from 'node:assert/strict';
import { LIB_BY_ID, equipmentAllows, specificEquipmentAllows } from '../coach/core/library.js';
import { build } from '../coach/core/payload.js';
import { routeCoachMessage } from '../coach/core/router.js';
import { validateAdapt } from '../coach/core/validate.js';
import { SPECIFIC_EQUIPMENT } from '../coach/core/specific-equipment.js';
import { EXDB } from '../../frontend/src/lib/exercises-data.js';
import { exAvailable } from '../../frontend/src/lib/equipment.js';

const stateFor = (exId, profile) => ({
  lang: 'zh',
  coach: {},
  routines: [{ id: 'r1', name: '训练日', ex: [{ id: exId, sets: 3, reps: 10 }] }],
  week: { 1: ['r1'] },
  workouts: [],
  equipFilterOn: true,
  activeEquipId: profile.id,
  equipProfiles: [profile]
});

test('the real 0770 Smith squat fits the same concrete inventory in API and frontend', () => {
  const state = stateFor('0770', { id: 'gym', equipment: [], equipmentItems: ['smith-machine'], accV: 2 });
  const payload = build(state, { handle: 'test', kind: 'review', note: '根据现有器材核对训练计划' });
  const exercise = LIB_BY_ID.get('0770');
  assert.equal(exercise.eq, 'smith machine');
  assert.equal(equipmentAllows(payload.equipment, exercise.id, { specified: payload.equipmentSpecified }), true);
  assert.equal(specificEquipmentAllows(payload.equipmentItems, exercise), true);
  assert.equal(exAvailable(state, EXDB.find(ex => ex.id === exercise.id)), true);
  assert.deepEqual(payload.equipmentMismatches, []);
});

test('the generated API catalogue keeps nd accessory requirements in sync with the frontend', () => {
  const state = stateFor('0499', { id: 'home', equipment: ['body weight'], equipmentItems: [], accV: 2 });
  const payload = build(state, { handle: 'test', kind: 'review', note: '根据现有器材核对训练计划' });
  assert.equal(exAvailable(state, EXDB.find(ex => ex.id === '0499')), false);
  assert.equal(payload.equipmentMismatches.some(m => m.exId === '0499'), true);
});

test('every concrete inventory keeps user-defined custom equipment available', () => {
  const custom = { id: 'my-exercise', n: 'My own exercise', bp: 'chest', eq: 'custom', custom: true };
  for (const item of SPECIFIC_EQUIPMENT) {
    const state = stateFor(custom.id, { id: 'gym', equipment: [], equipmentItems: [item.id], accV: 2 });
    assert.equal(specificEquipmentAllows([item.id], custom), true, item.id);
    assert.equal(exAvailable(state, custom), true, item.id);
  }
});

test('an explicitly empty accV2 inventory rejects real 1326 chin-ups on both sides and audits them', () => {
  const state = stateFor('1326', { id: 'home', equipment: [], equipmentItems: [], accV: 2 });
  const payload = build(state, { handle: 'test', kind: 'review', note: '根据现有器材核对训练计划' });
  assert.equal(LIB_BY_ID.get('1326').n, 'chin-up');
  assert.equal(payload.equipmentSpecified, true);
  assert.equal(equipmentAllows(payload.equipment, '1326', { specified: payload.equipmentSpecified }), false);
  assert.equal(exAvailable(state, EXDB.find(ex => ex.id === '1326')), false);
  assert.equal(payload.equipmentAudit, true);
  assert.deepEqual(payload.equipmentMismatches.map(ex => [ex.routineId, ex.exId]), [['r1', '1326']]);
});

test('the no-dumbbells switch wins over a saved dumbbell inventory when auditing real 0294', () => {
  const state = stateFor('0294', { id: 'home', equipment: ['dumbbell'], equipmentItems: [], accV: 2 });
  state.coach.profile = { equipment: ['dumbbell'] };
  state.dumbbells = { none: { on: true } };
  const payload = build(state, { handle: 'test', kind: 'review', note: '根据现有器材核对训练计划' });
  assert.equal(LIB_BY_ID.get('0294').eq, 'dumbbell');
  assert.equal(payload.noDumbbells, true);
  assert.deepEqual(payload.equipment, []);
  assert.deepEqual(payload.coachProfile.equipment, []);
  assert.equal(exAvailable(state, EXDB.find(ex => ex.id === '0294')), false);
  assert.deepEqual(payload.equipmentMismatches.map(ex => ex.exId), ['0294']);
});

test('ordinary breathing, nutrition and training-mechanism questions stay in chat', () => {
  for (const message of [
    '怎么调整深蹲时的呼吸？',
    'Can I add more protein after a workout?',
    'How does progressive overload change my body?'
  ]) assert.equal(routeCoachMessage(message, { hasPlan: true }), 'chat', message);
});

test('explicit plan edits and exercise replacements still request a review', () => {
  for (const message of [
    '请调整我的训练计划',
    '把计划里的深蹲动作替换成腿举',
    'Change my plan to three days per week',
    'Replace this exercise in my routine'
  ]) assert.equal(routeCoachMessage(message, { hasPlan: true }), 'review', message);
});

test('the Chinese adapt validator writes Chinese names for a real replacement exercise', () => {
  const checked = validateAdapt({
    summary: '今天改用哑铃飞鸟。',
    changes: [{ type: 'swap', entry: 0, to: '0308', why: '按你的要求替换动作。' }]
  }, {
    entries: [{ id: '0294', sets: [{ w: 5, r: 10, done: false }] }]
  }, { lang: 'zh-CN' });
  assert.equal(checked.ok, true, checked.errors?.join('\n'));
  assert.equal(checked.proposal.changes[0].exId, '0294');
  assert.equal(checked.proposal.changes[0].to, '0308');
  assert.equal(checked.proposal.changes[0].name, '哑铃二头弯举');
  assert.equal(checked.proposal.changes[0].toName, '哑铃飞鸟');
});

test('the Chinese adapt validator also localizes a real exercise added to the session', () => {
  const checked = validateAdapt({
    summary: '今天增加哑铃飞鸟。',
    changes: [{ type: 'add', to: '0308', sets: 3, reps: 10, why: '按你的要求增加动作。' }]
  }, {
    entries: [{ id: '0294', sets: [{ w: 5, r: 10, done: false }] }]
  }, { lang: 'zh-CN' });
  assert.equal(checked.ok, true, checked.errors?.join('\n'));
  assert.equal(checked.proposal.changes[0].to, '0308');
  assert.equal(checked.proposal.changes[0].toName, '哑铃飞鸟');
});
