import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categoriesForSpecificEquipment,
  capabilitiesForSpecificEquipment,
  missingSpecificEquipment,
  specificEquipmentAllows,
  specificRequirements
} from '../coach/core/specific-equipment.js';

const ex = (n, eq) => ({ n, eq });

test('concrete items contribute their legacy categories and capabilities', () => {
  assert.deepEqual(categoriesForSpecificEquipment(['smith-machine', 'adjustable-bench']), ['smith machine', 'bench']);
  assert.ok(capabilitiesForSpecificEquipment([{ id: 'cable-station' }]).has('high-pulley'));
  assert.ok(capabilitiesForSpecificEquipment([{ id: 'cable-station' }]).has('low-pulley'));
});

test('a barbell squat needs a rack as well as the barbell', () => {
  const squat = ex('barbell squat', 'barbell');
  assert.deepEqual(specificRequirements(squat), [['barbell'], ['rack']]);
  assert.equal(specificEquipmentAllows(['barbell'], squat), false);
  assert.equal(specificEquipmentAllows(['squat-rack'], squat), true);
  assert.deepEqual(missingSpecificEquipment(['barbell'], squat), ['rack']);
});

test('a plain deadlift needs only a barbell', () => {
  const deadlift = ex('barbell deadlift', 'barbell');
  assert.equal(specificEquipmentAllows(['barbell'], deadlift), true);
  assert.equal(specificEquipmentAllows([], deadlift), false);
});

test('Smith machine is distinct from a free barbell', () => {
  const smith = ex('smith machine squat', 'leverage machine');
  assert.equal(specificEquipmentAllows(['smith-machine'], smith), true);
  assert.equal(specificEquipmentAllows(['barbell', 'squat-rack'], smith), false);
});

test('dumbbell pressing requires both dumbbells and a bench', () => {
  const press = ex('dumbbell bench press', 'dumbbell');
  assert.equal(specificEquipmentAllows(['dumbbell'], press), false);
  assert.equal(specificEquipmentAllows(['dumbbell', 'flat-bench'], press), true);
});

test('a cable station covers both high and low pulley movements', () => {
  assert.equal(specificEquipmentAllows(['cable-station'], ex('lat pulldown', 'cable')), true);
  assert.equal(specificEquipmentAllows(['cable-station'], ex('seated cable row', 'cable')), true);
  assert.equal(specificEquipmentAllows(['lat-pulldown'], ex('seated cable row', 'cable')), false);
});

test('object-shaped equipment entries remain compatible with synced profiles', () => {
  const pull = ex('chin-up', 'body weight');
  assert.equal(specificEquipmentAllows([{ id: 'pull-up-bar', name: 'Pull-up bar' }], pull), true);
  assert.deepEqual(categoriesForSpecificEquipment([{ id: 'pull-up-bar' }]), ['pull-up bar']);
});

test('a concrete pull-up bar does not erase an explicitly selected dumbbell category', () => {
  const dumbbell = ex('dumbbell curl', 'dumbbell');
  assert.equal(specificEquipmentAllows(['pull-up-bar'], dumbbell, ['dumbbell']), true);
});

import { LIB_BY_ID, equipmentAllows } from '../coach/core/library.js';
test('a concrete Smith machine fits real catalogue exercises in API and inventory categories', () => {
  const exercise = LIB_BY_ID.get('0770');
  assert.equal(exercise.eq, 'smith machine');
  assert.equal(specificEquipmentAllows(['smith-machine'], exercise), true);
  assert.equal(equipmentAllows(categoriesForSpecificEquipment(['smith-machine']), '0770'), true);
});
