import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const { runPipeline } = await import('../coach/core/pipeline.js');

test('equipment audit creates only a confirmed removal proposal and does not invoke the model', async () => {
  const payload = {
    equipmentAudit: true,
    equipmentSpecified: true,
    equipment: ['dumbbell'],
    equipmentMismatches: [{
      routineId: 'r1', routineName: '周一拉日', exId: '0007', name: 'alternate lateral pulldown',
      requiredEquipment: 'cable', weekdays: [1]
    }],
    plan: {
      routines: [{ id: 'r1', name: '周一拉日', ex: [{ id: '0007', sets: 3, reps: 10 }] }],
      week: { 1: ['r1'] }
    },
    library: []
  };
  const result = await runPipeline({
    kind: 'review', payload,
    adapter: { invoke: async () => { throw new Error('equipment audits must not call the model'); } }
  });
  assert.equal(result.ok, true);
  assert.equal(result.result.changes.length, 1);
  assert.equal(result.result.changes[0].type, 'remove-exercise');
  assert.deepEqual(result.result.changes[0].target, { routineId: 'r1', exId: '0007' });
  assert.match(result.result.summary, /1 个无法使用的动作/);
  assert.doesNotMatch(result.result.summary, /体重|训练时长|历史|训练记录/);
  assert.match(result.result.changes[0].why, /周一拉日.*建议从计划中删除/);
});

test('equipment audit with no unavailable exercises answers directly without a proposal', async () => {
  const result = await runPipeline({
    kind: 'review',
    payload: { equipmentAudit: true, equipmentSpecified: true, equipmentMismatches: [], plan: { routines: [], week: {} } },
    adapter: { invoke: async () => { throw new Error('no mismatches should not call the model'); } }
  });
  assert.equal(result.ok, true);
  assert.equal(result.nochange, true);
  assert.match(result.reading, /现有动作都能使用/);
});

test('equipment audit without a configured inventory asks for one instead of claiming everything fits', async () => {
  const result = await runPipeline({
    kind: 'review',
    payload: { equipmentAudit: true, equipmentSpecified: false, equipmentMismatches: [], plan: { routines: [], week: {} } },
    adapter: { invoke: async () => { throw new Error('an unknown inventory must not be guessed by the model'); } }
  });
  assert.equal(result.ok, true);
  assert.equal(result.nochange, true);
  assert.match(result.reading, /没有可用的器材清单/);
  assert.match(result.reading, /不会.*假定器材齐全/);
});

test('ordinary review keeps its requested change focused when the plan has an equipment mismatch', async () => {
  const result = await runPipeline({
    kind: 'review',
    payload: {
      equipmentAudit: false,
      equipmentSpecified: true,
      equipment: ['dumbbell'],
      equipmentMismatches: [{ routineId: 'r1', exId: '0007', name: 'cable pulldown' }],
      userNote: '请评估训练强度',
      plan: { routines: [{ id: 'r1', name: '拉日', ex: [{ id: '0007', sets: 3, reps: 10 }] }], week: { 1: ['r1'] } },
      library: []
    },
    adapter: { spawns: false, invoke: async () => ({ code: 0, text: JSON.stringify({
      coach_contract: 1,
      summary: '当前训练强度偏高，建议减少一组。',
      changes: [{ id: 'c1', type: 'sets', target: { routineId: 'r1', exId: '0007' }, before: 3, after: 2, why: '近期多组达到 RPE 10。' }]
    }) }) }
  });
  assert.equal(result.ok, true);
  assert.equal(result.result.changes[0].type, 'sets');
});

test('equipment audit batches more than the normal 25-change review contract', async () => {
  const mismatches = Array.from({ length: 26 }, (_, i) => ({ routineId: 'r1', routineName: '拉日', exId: String(i).padStart(4, '0'), name: `动作${i}` }));
  const result = await runPipeline({
    kind: 'review',
    payload: {
      equipmentAudit: true,
      equipmentSpecified: true,
      equipment: ['dumbbell'],
      equipmentMismatches: mismatches,
      plan: { routines: [{ id: 'r1', name: '拉日', ex: mismatches.map(m => ({ id: m.exId, sets: 3, reps: 10 })) }], week: { 1: ['r1'] } },
      library: []
    },
    adapter: { invoke: async () => { throw new Error('deterministic audit must not call the model'); } }
  });
  assert.equal(result.ok, true);
  assert.equal(result.result.changes.length, 25);
  assert.match(result.result.summary, /仍有 1 项待下一次核对/);
});
