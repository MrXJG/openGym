/* Display names for Coach text. Exercise ids and catalogue names remain stable internally. */
import { EXERCISES } from './library-data.js';
import ZH_NAMES from './exercise-names-zh.js';

const EN_NAMES = new Map(EXERCISES.map(ex => [ex.id, ex.n]));
const normalLang = lang => String(lang || '').trim().toLowerCase().replace('_', '-');

export function exerciseName(id, lang = 'en', fallback = null) {
  const key = String(id ?? '');
  if (normalLang(lang).startsWith('zh')) return ZH_NAMES[key] || EN_NAMES.get(key) || fallback || null;
  return EN_NAMES.get(key) || fallback || null;
}

export const libraryNameFor = exerciseName;
