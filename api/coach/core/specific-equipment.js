/* Shared concrete-equipment catalogue and capability matching.
 *
 * Profiles still keep the original `equipment` category list for backwards compatibility.
 * `equipmentItems` adds concrete pieces such as a smith machine or cable station. A concrete
 * item contributes the legacy categories it belongs to plus a small capability set used by the
 * Coach matcher. This file is deliberately browser-safe: the PWA/BYOK imports the same module.
 */

export const SPECIFIC_EQUIPMENT = Object.freeze([
  { id: 'barbell', labelKey: 'Barbell', category: 'barbell', provides: ['barbell'] },
  { id: 'squat-rack', labelKey: 'Squat rack', category: 'barbell', provides: ['barbell', 'rack'] },
  { id: 'power-rack', labelKey: 'Power rack', category: 'barbell', provides: ['barbell', 'rack'] },
  { id: 'smith-machine', labelKey: 'Smith machine', category: 'smith machine', provides: ['smith-machine', 'rack'] },
  { id: 'dumbbell', labelKey: 'Dumbbells', category: 'dumbbell', provides: ['dumbbell'] },
  { id: 'adjustable-dumbbell', labelKey: 'Adjustable dumbbells', category: 'dumbbell', provides: ['dumbbell'] },
  { id: 'kettlebell', labelKey: 'Kettlebell', category: 'kettlebell', provides: ['kettlebell'] },
  { id: 'flat-bench', labelKey: 'Flat bench', category: 'bench', provides: ['bench'] },
  { id: 'adjustable-bench', labelKey: 'Adjustable bench', category: 'bench', provides: ['bench', 'adjustable-bench'] },
  { id: 'cable-station', labelKey: 'Cable station', category: 'cable', provides: ['cable', 'high-pulley', 'low-pulley'] },
  { id: 'lat-pulldown', labelKey: 'Lat pulldown machine', category: 'cable', provides: ['cable', 'high-pulley', 'lat-pulldown'] },
  { id: 'seated-row', labelKey: 'Seated row machine', category: 'cable', provides: ['cable', 'low-pulley', 'seated-row'] },
  { id: 'pull-up-bar', labelKey: 'Pull-up bar', category: 'pull-up bar', provides: ['pull-up bar'] },
  { id: 'parallel-bars', labelKey: 'Parallel bars', category: 'body weight', provides: ['parallel bars'] },
  { id: 'resistance-band', labelKey: 'Resistance bands', category: 'band', provides: ['band'] },
  { id: 'medicine-ball', labelKey: 'Medicine ball', category: 'medicine ball', provides: ['medicine ball'] },
  { id: 'stability-ball', labelKey: 'Stability ball', category: 'stability ball', provides: ['stability ball'] },
  { id: 'wheel-roller', labelKey: 'Ab wheel', category: 'wheel roller', provides: ['wheel roller'] }
]);

export const SPECIFIC_EQUIPMENT_BY_ID = new Map(SPECIFIC_EQUIPMENT.map(x => [x.id, x]));
export const SPECIFIC_EQUIPMENT_IDS = new Set(SPECIFIC_EQUIPMENT.map(x => x.id));

export function specificEquipmentItems(profile) {
  const ids = Array.isArray(profile?.equipmentItems) ? profile.equipmentItems : [];
  return ids.map(value => SPECIFIC_EQUIPMENT_BY_ID.get(typeof value === 'object' ? value?.id : value)).filter(Boolean);
}

export function categoriesForSpecificEquipment(ids) {
  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    const item = SPECIFIC_EQUIPMENT_BY_ID.get(typeof id === 'object' ? id?.id : id);
    if (item && item.category && !out.includes(item.category)) out.push(item.category);
  }
  return out;
}

export function profileEquipmentCategories(profile) {
  const out = Array.isArray(profile?.equipment) ? [...profile.equipment] : [];
  for (const category of categoriesForSpecificEquipment(profile?.equipmentItems)) {
    if (!out.includes(category)) out.push(category);
  }
  return out;
}

export function profileHasSpecificEquipment(profile) {
  return specificEquipmentItems(profile).length > 0;
}

export function specificCategories(ids) {
  return new Set(categoriesForSpecificEquipment(ids));
}

export function capabilitiesForSpecificEquipment(ids) {
  const out = new Set();
  for (const item of specificEquipmentItems({ equipmentItems: ids })) {
    for (const capability of item.provides || []) out.add(capability);
  }
  return out;
}

const name = ex => String(ex?.n || '').toLowerCase();

/** Concrete requirements. `any` is an OR group; every group must have one satisfied member. */
export function specificRequirements(ex) {
  if (!ex || ex.eq === 'custom') return [];
  const n = name(ex);
  const groups = [];
  const add = (...values) => groups.push(values);

  if (ex.eq === 'body weight') {
    if (/pull-up|pull up|chin-up|\bchin\b|hanging|muscle-up|muscle up/.test(n)) add('pull-up bar');
    if (/dip|parallel bar/.test(n)) add('parallel bars');
  } else if ((ex.eq === 'barbell' || ex.eq === 'olympic barbell')) {
    add('barbell');
    if (/bench press|bench front squat|bench squat|incline|decline/.test(n)) add('bench');
    else if (/squat|overhead press|military press|jerk|snatch|clean/.test(n)) add('rack');
  } else if (ex.eq === 'dumbbell') {
    add('dumbbell');
    if (/bench|incline|decline/.test(n)) add('bench');
  } else if (ex.eq === 'cable') {
    add('cable');
    if (/lat pulldown|pulldown|overhead triceps|face pull/.test(n)) add('high-pulley');
    else if (/row|seated/.test(n)) add('low-pulley');
  } else if (ex.eq === 'smith machine' || (ex.eq === 'leverage machine' && /smith/.test(n))) {
    add('smith-machine');
  } else if (ex.eq && ex.eq !== 'body weight') {
    add(ex.eq);
  }
  return groups;
}

export function specificEquipmentAllows(ids, ex, fallbackCategories = null) {
  const capabilities = capabilitiesForSpecificEquipment(ids);
  const detailed = specificCategories(ids);
  const fallback = new Set(Array.isArray(fallbackCategories) ? fallbackCategories : []);
  if (!Array.isArray(ids) || ids.length === 0) return false;
  return specificRequirements(ex).every(group => {
    const category = groupCategory(group);
    return !category || detailed.has(category) ? group.some(capability => capabilities.has(capability)) : fallback.has(category);
  });
}

export function missingSpecificEquipment(ids, ex, fallbackCategories = null) {
  const capabilities = capabilitiesForSpecificEquipment(ids);
  const detailed = specificCategories(ids);
  const fallback = new Set(Array.isArray(fallbackCategories) ? fallbackCategories : []);
  return specificRequirements(ex).filter(group => {
    const category = groupCategory(group);
    return (!category || detailed.has(category) || !fallback.has(category)) && !group.some(capability => capabilities.has(capability));
  }).map(group => group.join(' or '));
}

function groupCategory(group) {
  if (group.includes('dumbbell')) return 'dumbbell';
  if (group.includes('barbell') || group.includes('rack')) return 'barbell';
  if (group.includes('smith-machine')) return 'smith machine';
  if (group.includes('cable') || group.includes('high-pulley') || group.includes('low-pulley')) return 'cable';
  if (group.includes('bench')) return 'bench';
  if (group.includes('pull-up bar')) return 'pull-up bar';
  if (group.includes('parallel bars')) return 'body weight';
  return group[0] || null;
}
