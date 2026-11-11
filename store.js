// ============================================================================
// FailUp — persistent store
// Everything the user creates lives in `db` and is saved to localStorage after
// every change (photos go to IndexedDB, they're too big for localStorage).
// Goals and overload achievements are never stored directly: they're replayed
// from the saved workout history (plus any manual goal edits), so editing or
// deleting a past workout always leaves goals consistent.
// ============================================================================
import { EXERCISES as LIBRARY } from './exercises.js';
import { COLOR_MIGRATION } from './data.js';

const KEY = 'failup.v1';
export const SCHEMA = 1;

export const GENERIC = ['Barbell', 'Dumbbell', 'Bodyweight', 'Cable Machine', 'Smith Machine', 'Specialized Machine'];
const LIB_EQUIP = { Bar: 'Barbell' };                     // library facet key → display name
export const genericOf = k => LIB_EQUIP[k] || k;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* -------------------------------- library -------------------------------- */
// Library movements get stable ids (name + muscle; a few names exist twice).
const BASE = new Map();
for (const e of LIBRARY) {
  const id = `lib:${slug(e.name)}-${slug(e.muscle)}`;
  BASE.set(id, { ...e, id });
}
const EX_FIELDS = ['name', 'muscle', 'abbr', 'equipment', 'secondary', 'photo', 'mechanic', 'force', 'level'];

// Exercises from the Figma workouts that aren't in the library yet.
const SEED_CUSTOM = [
  { id: 'seed:tricep-pulldown', name: 'Tricep Pulldown', muscle: 'Triceps', abbr: 'TR', equipment: ['Cable Machine'], secondary: [], custom: true },
  { id: 'seed:chest-fly', name: 'Chest Fly', muscle: 'Chest', abbr: 'CH', equipment: ['Cable Machine', 'Dumbbell'], secondary: ['shoulders'], custom: true },
  { id: 'seed:bajan-cable-curl', name: 'Bajan Cable Curl', muscle: 'Biceps', abbr: 'BI', equipment: ['Cable Machine'], secondary: ['forearms'], custom: true },
];

// Library photos + steps for the seeded exercises (borrowed from the closest library movement).
const SEED_MEDIA = {
  'seed:tricep-pulldown': 'Triceps Pushdown|Triceps',
  'seed:chest-fly': null,
  'seed:bajan-cable-curl': null,
};
const SEED_IMGS = { 'seed:chest-fly': { 'Cable Machine': 'Cable_Crossover', Dumbbell: 'Dumbbell_Flyes' }, 'seed:bajan-cable-curl': { 'Cable Machine': 'Standing_Biceps_Cable_Curl' } };
function seedMedia(id) {
  const key = SEED_MEDIA[id], out = {};
  if (key) { const [n, m] = key.split('|'); const b = LIBRARY.find(x => x.name === n && x.muscle === m); if (b) { out.imgs = b.imgs; out.steps = b.steps; } }
  if (SEED_IMGS[id]) out.imgs = SEED_IMGS[id];
  return out;
}

// The live exercise list (library + custom, minus deleted, with edits applied).
export const EXERCISES = [];
export const exById = id => EXERCISES.find(e => e.id === id);
export function exByName(name, muscle) {
  return EXERCISES.find(e => e.name === name && (!muscle || e.muscle === muscle)) || EXERCISES.find(e => e.name === name);
}

/* --------------------------------- seeds --------------------------------- */
function seedWorkouts() {
  const libId = (name, muscle) => {
    const seeded = SEED_CUSTOM.find(e => e.name === name);
    if (seeded) return seeded.id;
    const e = [...BASE.values()].find(x => x.name === name && x.muscle === muscle) || [...BASE.values()].find(x => x.name === name);
    return e ? e.id : null;
  };
  const w = (name, color, icon, list) => ({
    id: uid('w'), name, color, icon,
    exercises: list.map(([n, m, equip]) => ({ exId: libId(n, m), name: n, muscle: m, sets: 3, reps: m === 'Abs' || m === 'Calves' ? 15 : 8, equip })).filter(x => x.exId),
  });
  return [
    w('Chest & Arms', '#FF7A1A', 'kick', [
      ['Bench Press', 'Chest', 'Barbell'], ['Bicep Curl', 'Biceps', 'Dumbbell'], ['Tricep Pulldown', 'Triceps', 'Cable Machine'],
      ['Chest Fly', 'Chest', 'Cable Machine'], ['Preacher Curl', 'Biceps', 'Barbell'], ['Tricep Kickback', 'Triceps', 'Dumbbell'],
      ['Bajan Cable Curl', 'Biceps', 'Cable Machine']]),
    w('Back & Shoulders', '#2B8CFF', 'dumbbell', [
      ['Deadlift', 'Back', 'Barbell'], ['Bent Over Row', 'Back', 'Barbell'], ['Close-Grip Front Lat Pulldown', 'Back', 'Cable Machine'],
      ['Shoulder Press', 'Shoulders', 'Dumbbell'], ['Face Pull', 'Shoulders', 'Cable Machine'], ['Rear Delt Row', 'Shoulders', 'Barbell'],
      ['One-Arm Upright Row', 'Shoulders', 'Dumbbell']]),
    w('Legs & Abs', '#1FC79A', 'kick', [
      ['Squat', 'Quads', 'Barbell'], ['Leg Press', 'Quads', 'Specialized Machine'], ['Romanian Deadlift', 'Hamstrings', 'Barbell'],
      ['Hip Thrust', 'Glutes', 'Barbell'], ['Calf Raise', 'Calves', 'Smith Machine'], ['Crunches', 'Abs', 'Bodyweight'],
      ['Plank', 'Abs', 'Bodyweight']]),
  ];
}
function freshDb() {
  return {
    v: SCHEMA,
    workouts: seedWorkouts(),
    equipment: [],                 // saved equipment { id, name, location, units, photo }
    locations: ['Home', 'Wash Park', "Dad's Gym"],
    sessions: [],                  // finished workouts, oldest first
    goalEdits: [],                 // manual goal changes { key, weight, at }
    active: null,                  // the workout in progress (or paused)
    plan: null,                    // { name, splitDays, days, start, end }
    settings: { units: 'lbs', location: 'Home' },
    exCustom: SEED_CUSTOM.map(e => ({ ...e })),
    exOverrides: {},
    exDeleted: [],
  };
}

/* ------------------------------ load / save ------------------------------ */
export const db = {};
let storageOk = true;

function buildExercises() {
  EXERCISES.length = 0;
  const del = new Set(db.exDeleted);
  for (const c of db.exCustom) EXERCISES.push({ ...seedMedia(c.id), ...c });
  for (const [id, base] of BASE) {
    if (del.has(id)) continue;
    const x = { ...base, ...(db.exOverrides[id] || {}) };
    x.equipment = [...(x.equipment || [])];   // own copy, so edits show up as changes from the library
    EXERCISES.push(x);
  }
}

export function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { storageOk = false; }
  replaceDb(saved && saved.v ? { ...freshDb(), ...saved } : freshDb());
}
// Move workouts, history and a paused workout onto the current color palette.
function migrateColors() {
  const m = c => (c && COLOR_MIGRATION[String(c).toUpperCase()]) || c;
  for (const w of db.workouts || []) w.color = m(w.color);
  for (const s of db.sessions || []) s.color = m(s.color);
  if (db.active) db.active.color = m(db.active.color);
}
function replaceDb(next) {
  for (const k of Object.keys(db)) delete db[k];
  Object.assign(db, next);
  db.settings = { units: 'lbs', location: 'Home', ...(db.settings || {}) };
  if (!Array.isArray(db.suggestions)) db.suggestions = [];   // goal suggestions waiting on a yes/no
  migrateColors();
  buildExercises();
  invalidate();
}

// Diff the live exercise list against the library so library updates still
// reach people who have edited a few exercises.
function snapshotExercises() {
  const live = new Set();
  db.exCustom = [];
  db.exOverrides = {};
  for (const e of EXERCISES) {
    live.add(e.id);
    if (!BASE.has(e.id)) { db.exCustom.push({ ...e, custom: true }); continue; }
    const base = BASE.get(e.id), diff = {};
    for (const f of EX_FIELDS) if (JSON.stringify(e[f] ?? null) !== JSON.stringify(base[f] ?? null)) diff[f] = e[f];
    if (Object.keys(diff).length) db.exOverrides[e.id] = diff;
  }
  db.exDeleted = [...BASE.keys()].filter(id => !live.has(id));
}

let lastJson = '';
export function save() {
  snapshotExercises();
  invalidate();
  const json = JSON.stringify(db);
  if (json === lastJson) return true;
  try { localStorage.setItem(KEY, json); lastJson = json; storageOk = true; }
  catch { storageOk = false; }
  return storageOk;
}
export const storageWorks = () => storageOk;

export function exportData() {
  snapshotExercises();
  const json = JSON.stringify(db), photos = {};
  for (const id of Object.keys(photoCache)) if (json.includes(id)) photos[id] = photoCache[id];
  return JSON.stringify({ app: 'FailUp', exported: new Date().toISOString(), ...db, photos });
}
export function importData(text) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.workouts) || !Array.isArray(d.sessions)) throw new Error('That file isn’t a FailUp backup.');
  const photos = d.photos || {};
  delete d.app; delete d.exported; delete d.photos;
  for (const [id, url] of Object.entries(photos)) {
    photoCache[id] = url;
    try { idb && idb.transaction('p', 'readwrite').objectStore('p').put(url, id); } catch {}
  }
  replaceDb({ ...freshDb(), ...d });
  save();
}
export function resetAll() { replaceDb(freshDb()); save(); }
export function clearExerciseData() { db.sessions = []; db.goalEdits = []; db.suggestions = []; db.active = null; save(); }

/* --------------------------------- photos -------------------------------- */
// Photos are data URLs kept in IndexedDB; records hold an "idb:" reference.
const photoCache = {};
let idb = null;
function openIdb() {
  return new Promise(res => {
    try {
      const r = indexedDB.open('failup-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('p');
      r.onsuccess = () => { idb = r.result; res(); };
      r.onerror = () => res();
    } catch { res(); }
  });
}
export async function loadPhotos() {
  await openIdb();
  if (!idb) return;
  await new Promise(res => {
    const tx = idb.transaction('p', 'readonly'), st = tx.objectStore('p');
    const req = st.openCursor();
    req.onsuccess = () => { const c = req.result; if (c) { photoCache[c.key] = c.value; c.continue(); } else res(); };
    req.onerror = () => res();
  });
}
export function putPhoto(dataUrl) {
  if (!idb) return dataUrl;            // no IndexedDB: keep it inline
  const id = uid('idb:');
  photoCache[id] = dataUrl;
  try { idb.transaction('p', 'readwrite').objectStore('p').put(dataUrl, id); } catch {}
  return id;
}
export const photoSrc = ref => !ref ? null : ref.startsWith('idb:') ? (photoCache[ref] || null) : ref;

/* ------------------------------- equipment ------------------------------- */
// An equipment ref is either "eq:<id>" (saved) or a generic type name.
export const eqById = ref => ref && ref.startsWith('eq:') ? db.equipment.find(e => 'eq:' + e.id === ref) : null;
export function eqLabel(ref) { const sv = eqById(ref); return sv ? sv.name : (ref && ref.startsWith('eq:') ? 'Removed equipment' : genericOf(ref || 'Bodyweight')); }
// a saved machine can live at more than one location (same model at home and at the rec center)
export const eqLocs = sv => (sv.locations && sv.locations.length ? sv.locations : [sv.location]).filter(Boolean);
export const eqAt = (sv, loc) => eqLocs(sv).includes(loc);
export const eqLocText = sv => eqLocs(sv).join(', ');
export const eqLocation = ref => (eqById(ref) || {}).location || null;
export const eqUnits = ref => (eqById(ref) || {}).units || db.settings.units;
export const unitLabel = u => u === 'kg' ? 'kg' : u === 'simple' ? '' : 'lbs';
export const unitWord = u => u === 'kg' ? 'Kilograms' : u === 'simple' ? 'Level' : 'Pounds';
export const increment = u => u === 'kg' ? 2.5 : u === 'simple' ? 1 : 5;
export const steps = u => u === 'kg' ? [2.5, 1] : u === 'simple' ? [2, 1] : [5, 2.5];
// The kind of machine a saved piece is: "Cable Machine 1" → "Cable Machine".
export const eqType = sv => (sv.types && sv.types[0]) || sv.type || sv.name.replace(/\s+\d+$/, '');
// every kind a saved machine counts as (an Inspire FT2 can be a Smith Machine and a Cable Machine)
export const eqTypes = sv => (sv.types && sv.types.length ? sv.types : [eqType(sv)]).map(genericOf);
// how many sets have been logged on a saved machine (for picking the usual one)
export const eqUse = id => db.sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.filter(x => (x.equip || e.equip) === 'eq:' + id).length, 0), 0);
// order for picking an equipment kind: machines first, they're the usual case
export const TYPE_ORDER = ['Specialized Machine', 'Cable Machine', 'Smith Machine', 'Barbell', 'Dumbbell', 'Bodyweight'];

/* ------------------------------ goals replay ----------------------------- */
export const goalKey = (exId, ref, sets, reps) => `${exId}|${ref}|${sets}x${reps}`;
export const isFail = st => st.feel >= 0.9;

// The weight you managed for all required sets at the goal reps (or null).
export function volumeWeight(e) {
  const q = e.sets.filter(st => st.type === 'working' && st.reps >= e.goal.reps).map(st => st.weight).sort((a, b) => b - a);
  return q.length >= e.goal.sets ? q[e.goal.sets - 1] : null;
}

let cache = null;
export function invalidate() { cache = null; }
export function derived() {
  if (cache) return cache;
  const evs = [];
  db.sessions.forEach(s => evs.push({ at: s.finishedAt, s }));
  db.goalEdits.forEach(g => evs.push({ at: g.at, g }));
  evs.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  // Goals only change when the user sets one (the goal prompts or the goal sheet).
  // A workout "hits" its goal when every required set reached the goal reps at the
  // goal weight it had while you were lifting (the session's own snapshot).
  const goals = {}, ach = {}, outcomes = {}, starts = {};
  for (const ev of evs) {
    if (ev.g) {
      goals[ev.g.key] = ev.g.weight;
      if (ev.g.weight != null && !starts[ev.g.key]) starts[ev.g.key] = { at: ev.g.at, weight: ev.g.weight, start: true };   // where this goal's line begins
      continue;
    }
    ev.s.exercises.forEach((e, i) => {
      if (!e.exId || !e.sets.length) return;
      const key = goalKey(e.exId, e.equip, e.goal.sets, e.goal.reps);
      const g = e.goal.weight, w = volumeWeight(e);
      const o = { key, before: g ?? null, newGoal: e.newGoal ?? null };
      if (g != null && w != null && w >= g) {
        (ach[key] = ach[key] || []).push({ at: ev.s.finishedAt, weight: g, sid: ev.s.id });
        o.type = 'hit';
      } else o.type = e.newGoal != null ? 'set' : 'miss';
      outcomes[`${ev.s.id}:${i}`] = o;
    });
  }
  cache = { goals, ach, outcomes, starts };
  return cache;
}
export const goalFor = (exId, ref, sets, reps) => derived().goals[goalKey(exId, ref, sets, reps)] ?? null;
export function setGoal(exId, ref, sets, reps, weight) {
  const key = goalKey(exId, ref, sets, reps);
  db.suggestions = (db.suggestions || []).filter(x => x.key !== key);   // a goal settles any waiting suggestion
  db.goalEdits.push({ key, weight, at: new Date().toISOString() });
  invalidate();
}
// every goal for an exercise: [{ ref, sets, reps, weight }]
export function goalsOf(filter) {
  const out = [];
  for (const [k, weight] of Object.entries(derived().goals)) {
    const [exId, ref, v] = k.split('|');
    const [sets, reps] = v.split('x').map(Number);
    const g = { exId, ref, sets, reps, weight };
    if (filter(g)) out.push(g);
  }
  return out;
}

/* --------------------------------- stats --------------------------------- */
export function exerciseLog(exId) {
  const out = [];
  for (const s of db.sessions) s.exercises.forEach(e => { if (e.exId === exId && e.sets.length) out.push({ s, e }); });
  return out.reverse();     // newest first
}
export function exerciseStats(exId) {
  const log = exerciseLog(exId);
  const working = log.flatMap(x => x.e.sets.filter(st => st.type === 'working'));
  const rpes = working.filter(st => st.rated !== false).map(st => Math.min(10, Math.floor(st.feel * 10) + 1));
  return {
    logged: log.length,
    setups: new Set(log.map(x => x.e.equip)).size,
    totalSets: working.length,
    fails: working.filter(isFail).length,
    rpe: rpes.length ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length) : null,
  };
}
// last time this exercise was done (optionally on this equipment)
export function lastDone(exId, ref) {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    const e = db.sessions[i].exercises.find(x => x.exId === exId && x.sets.length && (!ref || x.equip === ref));
    if (e) return { s: db.sessions[i], e };
  }
  return null;
}
export const timesCompleted = wid => db.sessions.filter(s => s.workoutId === wid).length;

/* --------------------------------- dates --------------------------------- */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
export const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };

// Today's place in the plan: { index, day, dayNum, total } or a status.
export function planToday(plan = db.plan, today = dayKey()) {
  if (!plan) return null;
  const total = daysBetween(plan.start, plan.end) + 1;
  const n = daysBetween(plan.start, today);
  if (n < 0) return { status: 'upcoming', total, startsIn: -n };
  if (n >= total) return { status: 'ended', total };
  const index = n % plan.splitDays;
  return { status: 'active', index, day: plan.days[index], dayNum: n + 1, total };
}

/* ---- library photos (free-exercise-db) ---- */
const FEDB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
// The library photo for an exercise, matched to the equipment in use (a saved machine counts as its type).
export function libPhoto(ex, ref) {
  const ids = ex && ex.imgs, keys = ids ? Object.keys(ids) : [];
  if (!keys.length) return '';
  let want = null;
  if (ref) { const sv = eqById(ref); want = genericOf(sv ? eqType(sv) : ref); }
  const k = keys.find(x => genericOf(x) === want) || keys[0];
  return FEDB + ids[k] + '/0.jpg';
}
// The user's own photo wins; otherwise the library photo.
export const exPhoto = (ex, ref) => (ex && photoSrc(ex.photo)) || libPhoto(ex, ref);

// Bodyweight exercises can log added weight (+) or assistance (−).
export const isBodyweight = ref => { const sv = eqById(ref); return genericOf(sv ? eqType(sv) : ref) === 'Bodyweight'; };

// the generic kind of any equipment ref (a saved machine counts as its type)
export const eqKind = ref => { if (!ref) return null; const sv = eqById(ref); return genericOf(sv ? eqType(sv) : ref); };

/* ------------------------------ overload graph data ------------------------------ */
// A dot is a workout that completed S x R on this equipment at one weight: the first S working
// sets (on that equipment) all at the same weight, each reaching R reps. Warmups and extra sets don't count.
export function volumeDots(exId, ref, sets, reps) {
  const out = [];
  for (const s of db.sessions) for (const e of s.exercises) {
    if (e.exId !== exId || !e.goal || e.goal.sets !== sets || e.goal.reps !== reps) continue;
    const w = e.sets.filter(x => x.type === 'working' && (x.equip || e.equip) === ref).slice(0, sets);
    if (w.length < sets || !w.every(x => x.reps >= reps && x.weight === w[0].weight)) continue;
    out.push({ at: s.finishedAt, weight: w[0].weight, sid: s.id });
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : 1));
}
// Every goal at this volume as a segment: from the day it was set until the next one replaced it (open = current).
export function goalSegments(exId, ref, sets, reps) {
  const key = goalKey(exId, ref, sets, reps);
  const ev = db.goalEdits.filter(g => g.key === key).sort((a, b) => (a.at < b.at ? -1 : 1));
  return ev.map((g, i) => ({ from: g.at, to: ev[i + 1] ? ev[i + 1].at : null, weight: g.weight }))
    .filter(g => g.weight != null)
    .map(g => ({ ...g, current: g.to == null }));
}
