// Exercise search: MiniSearch (MIT, vendor/minisearch.js) for typo tolerance, partial words and ranking,
// plus gym rules on top: spellings (pull up = pull-up = pullup), plurals, shorthand (db, rdl, ohp)
// and an order that puts exact and basic names first, then the ones you've logged.
import MiniSearch from './vendor/minisearch.js';

// words people write apart, together or hyphenated: all become one word
const COMPOUNDS = ['pull up', 'push up', 'pull down', 'chin up', 'sit up', 'step up', 'skull crusher', 'push down', 'pull over', 'pec deck', 'ez bar', 't bar', 'leg up'];
const JOIN = COMPOUNDS.map(c => { const [a, b] = c.split(' '); return [new RegExp(`\\b${a}[\\s-]*${b}(s?)\\b`, 'g'), a + b + '$1']; });
// shorthand → what it means (each maps to one or more search words)
const SHORT = {
  db: ['dumbbell'], dbs: ['dumbbell'], bb: ['barbell'], kb: ['kettlebell'], ez: ['ezbar'],
  rdl: ['romanian', 'deadlift'], sldl: ['stiff', 'legged', 'deadlift'], ohp: ['overhead', 'press'], bp: ['bench', 'press'],
  tri: ['tricep'], tris: ['tricep'], bi: ['bicep'], bis: ['bicep'], delt: ['delt'], delts: ['delt'], lat: ['lat'], lats: ['lat'],
  quad: ['quad'], quads: ['quad'], ham: ['hamstring'], hams: ['hamstring'], glute: ['glute'], glutes: ['glute'], abs: ['ab'],
  ab: ['ab'], pec: ['pecdeck'], pecs: ['chest'], rope: ['rope'], smith: ['smith'], cable: ['cable'], machine: ['machine'],
  bar: ['barbell'], barbell: ['barbell'], dumbell: ['dumbbell'], dumbbel: ['dumbbell'],
};
// plurals and spellings → one stem
const STEM = { flyes: 'fly', flye: 'fly', flies: 'fly', triceps: 'tricep', biceps: 'bicep', presses: 'press', crunches: 'crunch', lunges: 'lunge', calves: 'calf', delts: 'delt', glutes: 'glute', quads: 'quad', hamstrings: 'hamstring', abs: 'ab', pecs: 'pec' };
export const norm = s => { let t = String(s).toLowerCase().replace(/[’'`]/g, ''); for (const [re, to] of JOIN) t = t.replace(re, to); return t.replace(/[^a-z0-9]+/g, ' ').trim(); };
const stem = w => STEM[w] || (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const terms = s => norm(s).split(' ').filter(Boolean).map(stem);

let ms = null, key = '';
function index(list) {
  const k = list.length + ':' + list.reduce((h, e) => (h * 31 + e.name.length + e.id.length) | 0, 7);
  if (ms && k === key) return ms;
  key = k;
  ms = new MiniSearch({
    idField: 'id',
    fields: ['name', 'muscle', 'equip'],
    storeFields: [],
    tokenize: s => terms(s),
    processTerm: t => t,
    searchOptions: { tokenize: s => s.split(' '), processTerm: t => t },
  });
  ms.addAll(list.map(e => ({ id: e.id, name: e.name, muscle: e.muscle, equip: (e.equipment || []).map(x => x === 'Bar' ? 'barbell bar' : x).join(' ') })));
  return ms;
}

// ranked matches for a query; `used(id)` = sets logged, to lift your exercises up
export function searchExercises(list, query, used = () => 0) {
  const qt = terms(query).flatMap(t => SHORT[t] || [t]);
  if (!qt.length) return list;
  const byId = new Map(list.map(e => [e.id, e]));
  // strict first (one typo on longer words); only if that finds nothing, allow two (swapped letters)
  const run = loose => index(list).search(qt.join(' '), {
    boost: { name: 3, muscle: 1, equip: 1 },
    prefix: true,
    fuzzy: t => (loose ? (t.length >= 5 ? 2 : t.length >= 4 ? 1 : 0) : (t.length >= 8 ? 2 : t.length >= 5 ? 1 : 0)),
    combineWith: 'AND',
    tokenize: s => s.split(' '),
    processTerm: t => t,
  });
  let res = run(false);
  if (!res.length) res = run(true);
  const q = norm(query);
  return res.map(r => {
    const e = byId.get(r.id); if (!e) return null;
    const n = norm(e.name);
    let score = r.score;
    if (n === q) score *= 6;                         // exact name
    else if (n.startsWith(q + ' ')) score *= 3.5;    // starts with the words you typed
    else if (COMPOUNDS.some(c => c.startsWith(q + ' ') && n.startsWith(c.replace(" ", "")))) score *= 6;   // "chin" → Chin-Up
    else if (n.startsWith(q)) score *= 2;            // starts with what you typed
    else if (n.split(" ").some(w => w === q || COMPOUNDS.some(c => c.replace(" ", "") === w && c.startsWith(q + " ")))) score *= 2.2;   // a whole word in the name ("chin" counts for chin-up)
    if (e.basic || e.name.split(' ').length <= 2) score *= 1.4;   // short, basic names before long variations
    if (used(e.id)) score *= 1.5;                    // things you actually do
    return { e, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name)).map(x => x.e);
}
