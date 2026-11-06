// ============================================================================
// FailUp — persistent store
// Everything the user creates lives in `db` and is saved to localStorage after
// every change (photos go to IndexedDB, they're too big for localStorage).
// Goals and overload achievements are never stored directly: they're replayed
// from the saved workout history (plus any manual goal edits), so editing or
// deleting a past workout always leaves goals consistent.
// ============================================================================
import { EXERCISES as LIBRARY } from './exercises.js';

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
    w('Chest & Arms', '#CF2A0F', 'kick', [
      ['Bench Press', 'Chest', 'Barbell'], ['Bicep Curl', 'Biceps', 'Dumbbell'], ['Tricep Pulldown', 'Triceps', 'Cable Machine'],
      ['Chest Fly', 'Chest', 'Cable Machine'], ['Preacher Curl', 'Biceps', 'Barbell'], ['Tricep Kickback', 'Triceps', 'Dumbbell'],
      ['Bajan Cable Curl', 'Biceps', 'Cable Machine']]),
    w('Back & Shoulders', '#426E8F', 'dumbbell', [
      ['Deadlift', 'Back', 'Barbell'], ['Bent Over Row', 'Back', 'Barbell'], ['Close-Grip Front Lat Pulldown', 'Back', 'Cable Machine'],
      ['Shoulder Press', 'Shoulders', 'Dumbbell'], ['Face Pull', 'Shoulders', 'Cable Machine'], ['Rear Delt Row', 'Shoulders', 'Barbell'],
      ['One-Arm Upright Row', 'Shoulders', 'Dumbbell']]),
    w('Legs & Abs', '#6C5CE7', 'kick', [
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
  for (const c of db.exCustom) EXERCISES.push({ ...c });
  for (const [id, base] of BASE) {
    if (del.has(id)) continue;
    EXERCISES.push({ ...base, ...(db.exOverrides[id] || {}) });
  }
}

export function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { storageOk = false; }
  replaceDb(saved && saved.v ? { ...freshDb(), ...saved } : freshDb());
}
function replaceDb(next) {
  for (const k of Object.keys(db)) delete db[k];
  Object.assign(db, next);
  db.settings = { units: 'lbs', location: 'Home', ...(db.settings || {}) };
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
export function clearExerciseData() { db.sessions = []; db.goalEdits = []; db.active = null; save(); }

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
export const eqLocation = ref => (eqById(ref) || {}).location || null;
export const eqUnits = ref => (eqById(ref) || {}).units || db.settings.units;
export const unitLabel = u => u === 'kg' ? 'kg' : u === 'simple' ? '' : 'lbs';
export const unitWord = u => u === 'kg' ? 'Kilograms' : u === 'simple' ? 'Level' : 'Pounds';
export const increment = u => u === 'kg' ? 2.5 : u === 'simple' ? 1 : 5;
export const steps = u => u === 'kg' ? [2.5, 1] : u === 'simple' ? [2, 1] : [5, 2.5];
// The kind of machine a saved piece is: "Cable Machine 1" → "Cable Machine".
export const eqType = sv => sv.type || sv.name.replace(/\s+\d+$/, '');

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
  const goals = {}, ach = {}, outcomes = {};
  for (const ev of evs) {
    if (ev.g) { goals[ev.g.key] = ev.g.weight; continue; }
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
  cache = { goals, ach, outcomes };
  return cache;
}
export const goalFor = (exId, ref, sets, reps) => derived().goals[goalKey(exId, ref, sets, reps)] ?? null;
export function setGoal(exId, ref, sets, reps, weight) {
  db.goalEdits.push({ key: goalKey(exId, ref, sets, reps), weight, at: new Date().toISOString() });
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
  const rpes = working.map(st => Math.min(10, Math.floor(st.feel * 10) + 1));
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
