import test from 'node:test';
import assert from 'node:assert/strict';
import { exerciseName, libraryNameFor } from '../coach/core/exercise-names.js';
import { build } from '../coach/core/payload.js';
import { sampleState } from './helpers.mjs';

test('Chinese Coach names use the catalogue translation while keeping the id stable', () => {
  assert.equal(exerciseName('0001', 'zh'), '3/4仰卧起坐');
  assert.equal(exerciseName('0001', 'zh-CN'), '3/4仰卧起坐');
  assert.equal(exerciseName('0001', 'en'), '3/4 sit-up');
  assert.equal(libraryNameFor('0001', 'en'), '3/4 sit-up');
  assert.equal(exerciseName('does-not-exist', 'zh'), null);
});

test('Chinese payload localizes plan and library names without changing exercise ids', () => {
  const payload = build(sampleState(), { handle: 'h'.repeat(16), kind: 'review', lang: 'zh-CN' });
  const planExercise = payload.plan.routines[0].ex[0];
  const libraryExercise = payload.library.find(ex => ex.id === '0001');
  assert.equal(planExercise.id, '0001');
  assert.equal(planExercise.name, '3/4仰卧起坐');
  assert.equal(libraryExercise.n, '3/4仰卧起坐');
});

test('English payload keeps the original catalogue names', () => {
  const payload = build(sampleState(), { handle: 'h'.repeat(16), kind: 'review', lang: 'en' });
  assert.equal(payload.plan.routines[0].ex[0].name, '3/4 sit-up');
  assert.equal(payload.library.find(ex => ex.id === '0001').n, '3/4 sit-up');
});
