// ============================================================================
// FailMore — persistent store
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

// Basic names. A library movement's id comes from its ORIGINAL name, so renaming here only changes
// what's shown: logged sets, goals and workouts all point at the id and stay put.
const LIB_RENAMES = {
  'Pullups|Back': 'Pull-Up', 'Pushups|Chest': 'Push-Up', 'Hammer Curls|Biceps': 'Hammer Curl',
  'Triceps Pushdown|Triceps': 'Tricep Pushdown', 'Skullcrusher|Triceps': 'Skull Crusher', 'Leg Extensions|Quads': 'Leg Extension',
  'Lying Leg Curls|Hamstrings': 'Lying Leg Curl', 'Butterfly|Chest': 'Pec Deck', 'Thigh Abductor|Glutes': 'Hip Abduction',
  'Bent Over Row|Back': 'Barbell Row', 'Ab Rollout|Abs': 'Ab Wheel Rollout', 'Step Ups|Quads': 'Step-Up',
  // words the import dropped
  'External Rotation With|Shoulders': 'External Rotation With Cable', 'Front Two- Raise|Shoulders': 'Front Two-Dumbbell Raise',
  'Bent Over Two- Row|Back': 'Bent Over Two-Dumbbell Row', 'Bent Over Two- Row With Palms In|Back': 'Bent Over Two-Dumbbell Row With Palms In',
  'Calf- Shoulder Shrug|Back': 'Calf-Machine Shoulder Shrug', 'Deadlift With|Back': 'Deadlift With Bands', 'Rack Pull With|Back': 'Rack Pull With Bands',
  'Close-Grip Curl With|Biceps': 'Close-Grip EZ-Bar Curl With Band', 'Close-Grip Push-Up Off Of A|Triceps': 'Close-Grip Push-Up Off Of A Dumbbell',
  'Box Squat With|Quads': 'Box Squat With Bands', 'Squat With|Quads': 'Squat With Bands', 'Sumo Deadlift With|Hamstrings': 'Sumo Deadlift With Bands',
  'Calf Raise On A|Calves': 'Calf Raise On A Dumbbell',
};
// New basic listings, with fixed ids. Photos and steps borrowed from the closest library movement where one fits.
// [name, muscle, equipment, borrow "Name|Muscle" or null]
const BASIC = [
  ['Lat Pulldown', 'Back', ['Cable Machine', 'Specialized Machine'], 'Wide-Grip Lat Pulldown|Back'],
  ['Seated Cable Row', 'Back', ['Cable Machine'], 'Seated Rows|Back'],
  ['Dumbbell Row', 'Back', ['Dumbbell'], 'One-Arm Row|Back'],
  ['Cable Crossover', 'Chest', ['Cable Machine'], 'Crossover|Chest'],
  ['Overhead Press', 'Shoulders', ['Bar', 'Dumbbell', 'Smith Machine'], 'Standing Military Press|Shoulders', 'Shoulder Press|Shoulders'],
  ['Lateral Raise', 'Shoulders', ['Dumbbell', 'Cable Machine'], 'Side Lateral Raise|Shoulders'],
  ['Cable Curl', 'Biceps', ['Cable Machine'], 'Standing Biceps Curl|Biceps'],
  ['Goblet Squat', 'Quads', ['Dumbbell'], null],
  ['Bulgarian Split Squat', 'Quads', ['Dumbbell', 'Bar', 'Smith Machine'], 'Split Squat With Dumbbells|Quads'],
  ['Leg Curl', 'Hamstrings', ['Specialized Machine'], 'Seated Leg Curl|Hamstrings'],
  ['Cable Crunch', 'Abs', ['Cable Machine'], 'Rope Crunch|Abs'],
  ['Back Extension', 'Back', ['Bodyweight', 'Specialized Machine'], 'Hyperextensions With No Hyperextension Bench|Back'],
  ['Assisted Pull-Up', 'Back', ['Specialized Machine'], null],
  ['Pullover', 'Chest', ['Dumbbell', 'Cable Machine'], 'Straight-Arm Pullover|Chest'],
  ['Farmer’s Carry', 'Forearms', ['Dumbbell'], null],
  ['Kettlebell Swing', 'Hamstrings', ['Dumbbell'], 'Vertical Swing|Hamstrings'],
];
const ABBR = { Chest: 'CH', Shoulders: 'SH', Back: 'BK', Biceps: 'BI', Triceps: 'TR', Forearms: 'FO', Abs: 'AB', Quads: 'QU', Hamstrings: 'HA', Glutes: 'GL', Calves: 'CA' };
{
  const find = k => { if (!k) return null; const [n, m] = k.split('|'); return LIBRARY.find(e => e.name === n && e.muscle === m) || null; };
  for (const [name, muscle, equipment, borrow, borrow2] of BASIC) {
    const b = find(borrow), b2 = find(borrow2), imgs = {};
    for (const k of equipment) { const src = [b, b2].find(x => x && x.imgs && x.imgs[k]); if (src) imgs[k] = src.imgs[k]; }
    const id = `base:${slug(name)}`;
    BASE.set(id, { name, muscle, abbr: ABBR[muscle], equipment, secondary: b ? b.secondary || [] : [], mechanic: b && b.mechanic, force: b && b.force, level: b && b.level, imgs, steps: b ? b.steps : [], id, basic: true });
  }
}

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
// the three starter workouts earlier versions gave new users (kept for tests and old data)
export function seedWorkouts() {
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
/* ---- preloaded workouts: ten ready-to-go workouts every user has, kept apart from your own ----
   They're built from the library (ids "pre:..."), so they can't be edited or deleted; editing one makes a copy. */
const PRE = [
  ['push', 'Push', '#FF7A1A', 'chest', [['Bench Press', 'Chest', 'Barbell', 8], ['Incline Press', 'Chest', 'Dumbbell', 10], ['Shoulder Press', 'Shoulders', 'Dumbbell', 10], ['Lateral Raise', 'Shoulders', 'Dumbbell', 12], ['Chest Fly', 'Chest', 'Cable Machine', 12], ['Tricep Pulldown', 'Triceps', 'Cable Machine', 12], ['Skull Crusher', 'Triceps', 'Barbell', 10]]],
  ['pull', 'Pull', '#2B8CFF', 'back', [['Deadlift', 'Back', 'Barbell', 5], ['Lat Pulldown', 'Back', 'Cable Machine', 10], ['Barbell Row', 'Back', 'Barbell', 8], ['Seated Cable Row', 'Back', 'Cable Machine', 10], ['Face Pull', 'Shoulders', 'Cable Machine', 12], ['Bicep Curl', 'Biceps', 'Dumbbell', 10], ['Hammer Curl', 'Biceps', 'Dumbbell', 12]]],
  ['legs', 'Legs', '#1FC79A', 'legs', [['Squat', 'Quads', 'Barbell', 8], ['Romanian Deadlift', 'Hamstrings', 'Barbell', 8], ['Leg Press', 'Quads', 'Specialized Machine', 10], ['Leg Extension', 'Quads', 'Specialized Machine', 12], ['Seated Leg Curl', 'Hamstrings', 'Specialized Machine', 12], ['Hip Thrust', 'Glutes', 'Barbell', 10], ['Calf Raise', 'Calves', 'Smith Machine', 15]]],
  ['upper', 'Upper Body', '#E23FB4', 'arms', [['Bench Press', 'Chest', 'Barbell', 8], ['Barbell Row', 'Back', 'Barbell', 8], ['Shoulder Press', 'Shoulders', 'Dumbbell', 10], ['Lat Pulldown', 'Back', 'Cable Machine', 10], ['Bicep Curl', 'Biceps', 'Dumbbell', 12], ['Tricep Pulldown', 'Triceps', 'Cable Machine', 12]]],
  ['lower', 'Lower Body', '#0B8A7A', 'squat', [['Squat', 'Quads', 'Barbell', 8], ['Romanian Deadlift', 'Hamstrings', 'Barbell', 8], ['Bulgarian Split Squat', 'Quads', 'Dumbbell', 10], ['Lying Leg Curl', 'Hamstrings', 'Specialized Machine', 12], ['Seated Calf Raise', 'Calves', 'Specialized Machine', 15], ['Plank', 'Abs', 'Bodyweight', 15]]],
  ['fullA', 'Full Body A', '#FFB300', 'fullbody', [['Squat', 'Quads', 'Barbell', 8], ['Bench Press', 'Chest', 'Barbell', 8], ['Barbell Row', 'Back', 'Barbell', 8], ['Shoulder Press', 'Shoulders', 'Dumbbell', 10], ['Plank', 'Abs', 'Bodyweight', 15]]],
  ['fullB', 'Full Body B', '#8CCB2E', 'lifter', [['Deadlift', 'Back', 'Barbell', 5], ['Incline Press', 'Chest', 'Dumbbell', 10], ['Lat Pulldown', 'Back', 'Cable Machine', 10], ['Goblet Squat', 'Quads', 'Dumbbell', 10], ['Arnold Press', 'Shoulders', 'Dumbbell', 10], ['Hanging Leg Raise', 'Abs', 'Bodyweight', 12]]],
  ['chestarms', 'Chest & Arms', '#FF4F8B', 'flex', [['Bench Press', 'Chest', 'Barbell', 8], ['Incline Press', 'Chest', 'Dumbbell', 10], ['Chest Fly', 'Chest', 'Cable Machine', 12], ['Bicep Curl', 'Biceps', 'Dumbbell', 10], ['Preacher Curl', 'Biceps', 'Barbell', 10], ['Tricep Pulldown', 'Triceps', 'Cable Machine', 12], ['Tricep Kickback', 'Triceps', 'Dumbbell', 12]]],
  ['backshoulders', 'Back & Shoulders', '#4F7A9A', 'shoulders', [['Pull-Up', 'Back', 'Bodyweight', 8], ['Barbell Row', 'Back', 'Barbell', 8], ['Seated Cable Row', 'Back', 'Cable Machine', 10], ['Shoulder Press', 'Shoulders', 'Dumbbell', 10], ['Lateral Raise', 'Shoulders', 'Dumbbell', 12], ['Face Pull', 'Shoulders', 'Cable Machine', 12], ['Shrug', 'Back', 'Dumbbell', 12]]],
  ['core', 'Core & Abs', '#12C2E0', 'abs', [['Plank', 'Abs', 'Bodyweight', 15], ['Hanging Leg Raise', 'Abs', 'Bodyweight', 12], ['Cable Crunch', 'Abs', 'Cable Machine', 15], ['Russian Twist', 'Abs', 'Bodyweight', 15], ['Dead Bug', 'Abs', 'Bodyweight', 12], ['Crunches', 'Abs', 'Bodyweight', 15]]],
];
let preCache = null;
export function preloadedWorkouts() {
  if (preCache) return preCache;
  const builtIn = x => !x.custom || String(x.id).startsWith('seed:');   // library and FailMore's own starter exercises, never a user's
  const find = (n, m) => EXERCISES.find(x => builtIn(x) && x.name === n && x.muscle === m) || EXERCISES.find(x => builtIn(x) && x.name === n);
  preCache = PRE.map(([slug, name, color, icon, list]) => ({ id: 'pre:' + slug, preloaded: true, name, color, icon,
    exercises: list.map(([n, m, equip, reps]) => { const x = find(n, m); return x && { exId: x.id, name: x.name, muscle: x.muscle, sets: 3, reps, equip }; }).filter(Boolean) }));
  return preCache;
}
export const isPreloaded = id => String(id || '').startsWith('pre:');
// any workout by id: yours first, then the preloaded ones
export const workoutById = id => db.workouts.find(w => w.id === id) || (isPreloaded(id) ? preloadedWorkouts().find(w => w.id === id) : null);
function freshDb() {
  return {
    v: SCHEMA,
    workouts: [],                  // your own; ten preloaded ones are always available too
    equipment: [],                 // saved equipment { id, name, location, units, photo }
    locations: [],                 // added by you the first time you pick where you train
    sessions: [],                  // finished workouts, oldest first
    goalEdits: [],                 // manual goal changes { key, weight, at }
    active: null,                  // the workout in progress (or paused)
    plan: null,                    // { id, name, splitDays, days, start, end }
    planHistory: [],               // plans that finished or were ended { ...plan, endedOn }
    plans: [],                     // your plans to start again { id, name, splitDays, days, length }
    settings: { units: 'lbs', location: '' },
    exCustom: SEED_CUSTOM.map(e => ({ ...e })),
    exOverrides: {},
    exDeleted: [],
  };
}

/* ------------------------------ load / save ------------------------------ */
export const db = {};
let storageOk = true;

function buildExercises() {
  preCache = null;
  EXERCISES.length = 0;
  const del = new Set(db.exDeleted);
  for (const c of db.exCustom) EXERCISES.push({ ...seedMedia(c.id), ...c });
  for (const [id, base] of BASE) {
    if (del.has(id)) continue;
    const rn = LIB_RENAMES[`${base.name}|${base.muscle}`];
    const x = { ...base, ...(rn ? { name: rn } : {}), ...(db.exOverrides[id] || {}) };   // your own edits win
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
  db.settings = { units: 'lbs', location: '', ...(db.settings || {}) };
  if (!Array.isArray(db.suggestions)) db.suggestions = [];
  if (!Array.isArray(db.planHistory)) db.planHistory = [];
  if (!Array.isArray(db.inbox)) db.inbox = [];   // plans sent to you by link
  migratePlans();   // goal suggestions waiting on a yes/no
  migrateColors();
  migrateMachineTags();
  buildExercises();
  invalidate();
}
// One-time move to location tags. A machine's old single location becomes its first tag,
// and machines that shared a name (one per gym before) get numbered: Leg Extension 1, Leg Extension 2.
// Only names and tags change; every set, goal and photo stays on the same machine.
function migrateMachineTags() {
  if (!Array.isArray(db.equipment)) db.equipment = [];
  if (db.eqTagsV >= 1) { for (const sv of db.equipment) if (!Array.isArray(sv.locations)) sv.locations = []; return; }
  for (const sv of db.equipment) {
    const l = Array.isArray(sv.locations) && sv.locations.length ? sv.locations : [sv.location];
    sv.locations = [...new Set(l.filter(Boolean))];
    sv.location = sv.locations[0] || '';
  }
  numberDuplicateNames();
  db.eqTagsV = 1;
}
export function numberDuplicateNames() {
  const key = n => String(n || '').trim().toLowerCase();
  const groups = new Map();
  for (const sv of db.equipment) { const k = key(sv.name); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(sv); }
  const taken = new Set(db.equipment.map(sv => key(sv.name)));
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const base = list[0].name.trim();
    let n = 1;
    for (const sv of list) {
      while (taken.has(key(`${base} ${n}`))) n++;
      sv.name = `${base} ${n}`; taken.add(key(sv.name)); n++;
    }
  }
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
  return JSON.stringify({ app: 'FailMore', exported: new Date().toISOString(), ...db, photos });
}
export function importData(text) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.workouts) || !Array.isArray(d.sessions)) throw new Error('That file isn’t a FailMore backup.');
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
// Locations are tags on a saved machine. No tags: it's available everywhere.
// No location set for the workout: every machine is available.
export const eqLocs = sv => (Array.isArray(sv.locations) ? sv.locations : []).filter(Boolean);
export const eqTagged = (sv, loc) => !!loc && eqLocs(sv).includes(loc);
export const eqAt = (sv, loc) => !loc || !eqLocs(sv).length || eqLocs(sv).includes(loc);
export const eqLocText = sv => eqLocs(sv).join(', ') || 'Any location';
export function setEqLocs(sv, l) { sv.locations = [...new Set((l || []).filter(Boolean))]; sv.location = sv.locations[0] || ''; }
export const eqNameTaken = (name, exceptId) => db.equipment.some(x => x.id !== exceptId && x.name.trim().toLowerCase() === String(name).trim().toLowerCase());
// Deleting a location only takes its tag off machines; a machine left with none is available everywhere.
export function removeLocation(name) {
  db.locations = db.locations.filter(l => l !== name);
  for (const sv of db.equipment) if (eqLocs(sv).includes(name)) setEqLocs(sv, eqLocs(sv).filter(l => l !== name));
  if (db.settings.location === name) db.settings.location = '';
}
export const eqLocation = ref => (eqById(ref) || {}).location || null;
export const eqUnits = ref => (eqById(ref) || {}).units || db.settings.units;
export const unitLabel = u => u === 'kg' ? 'kg' : u === 'simple' ? '' : 'lbs';
export const unitWord = u => u === 'kg' ? 'Kilograms' : u === 'simple' ? 'Level' : 'Pounds';
export const increment = u => u === 'kg' ? 2.5 : u === 'simple' ? 1 : 5;
export const steps = u => u === 'kg' ? [2.5, 1] : u === 'simple' ? [2, 1] : [5, 2.5];
// The kind of machine a saved piece is: always one of the generic kinds ("Cable Machine 1" → "Cable Machine");
// anything else (an old save named after the machine) counts as a specialized machine.
const genericKind = t => { const g = genericOf(t || ''); return GENERIC.includes(g) ? g : null; };
export const eqType = sv => genericKind((sv.types && sv.types[0]) || sv.type) || genericKind(sv.name.replace(/\s+\d+$/, '')) || 'Specialized Machine';
// every kind a saved machine counts as (an Inspire FT2 can be a Smith Machine and a Cable Machine)
export const eqTypes = sv => { const t = [...new Set((sv.types || []).map(genericKind).filter(Boolean))]; return t.length ? t : [eqType(sv)]; };
// how many sets have been logged on a saved machine (for picking the usual one)
export const eqUse = id => db.sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.filter(x => (x.equip || e.equip) === 'eq:' + id).length, 0), 0);
// order for picking an equipment kind: machines first, they're the usual case
export const TYPE_ORDER = ['Specialized Machine', 'Cable Machine', 'Smith Machine', 'Barbell', 'Dumbbell', 'Bodyweight'];
// the only kinds worth saving as your own machine: bars, dumbbells and bodyweight are the same everywhere
export const MACHINE_TYPES = ['Specialized Machine', 'Cable Machine', 'Smith Machine'];
// Only specialized machines get saved now. A saved machine is "for" an exercise when the exercise
// lists it, or when it has been logged or given a goal on it (older saves), so nothing logged is lost.
export const SPECIAL = 'Specialized Machine';
export const isSpecial = sv => !!sv && eqTypes(sv).includes(SPECIAL);
export function machineFor(exId, sv) {
  const ref = 'eq:' + sv.id, x = exById(exId);
  if (x && (x.equipment || []).includes(ref)) return true;
  if (db.goalEdits.some(g => g.key.startsWith(`${exId}|${ref}|`))) return true;
  return db.sessions.some(s => s.exercises.some(e => e.exId === exId && (e.equip === ref || e.sets.some(x => x.equip === ref))));
}
// ---- One-time move: saved cable and Smith machines → the generic Cable Machine / Smith Machine ----
// Only specialized machines are saved now. This re-points every logged set, goal, workout and suggestion
// from those saved machines to the generic kind, converting weights when the machine used other units.
// Nothing logged is deleted; the saved machine entries are removed once their data has moved.
const MOVE_KINDS = ['Cable Machine', 'Smith Machine'];
const toUnit = (w, from, to) => w == null || from === to ? w : from === 'kg' ? w * 2.20462 : w / 2.20462;
export function genericMovePlan() {
  return db.equipment.filter(sv => !eqTypes(sv).includes(SPECIAL) && MOVE_KINDS.includes(eqTypes(sv)[0]))
    .map(sv => {
      const ref = 'eq:' + sv.id, from = sv.units || db.settings.units, to = db.settings.units;
      const sets = db.sessions.reduce((n, ss) => n + ss.exercises.reduce((m, e) => m + e.sets.filter(x => (x.equip || e.equip) === ref).length, 0), 0);
      const goals = db.goalEdits.filter(g => g.key.split('|')[1] === ref).length;
      return { sv, ref, kind: eqTypes(sv)[0], from, to, sets, goals, ok: from !== 'simple' || to === 'simple' };   // numbered stacks can't convert
    });
}
// Move everything logged on one equipment ref to another: workouts, every set, goals, suggestions.
// Weights convert when the units differ (lbs ↔ kg, rounded to the new step). Nothing is deleted.
export function repointRef(ref, target, from, to) {
  const conv = w => { if (w == null || from === to || from === 'simple' || to === 'simple') return w; const inc = increment(to); return Math.round(toUnit(w, from, to) / inc) * inc; };
  const label = eqLabel(target);
  for (const w of db.workouts) for (const e of w.exercises) if (e.equip === ref) e.equip = target;
  for (const ss of db.sessions) for (const e of ss.exercises) {
    const whole = e.equip === ref;
    for (const x of e.sets) if ((x.equip || e.equip) === ref) { x.weight = conv(x.weight); if (x.equip) x.equip = target; }
    if (whole) {
      e.equip = target; e.equipName = label;
      if (e.goal) e.goal.weight = conv(e.goal.weight);
      if (e.newGoal != null) e.newGoal = conv(e.newGoal);
    }
  }
  for (const g of db.goalEdits) { const [a, r, v] = g.key.split('|'); if (r === ref) { g.key = `${a}|${target}|${v}`; g.weight = conv(g.weight); } }
  for (const g of db.suggestions || []) if (g.equip === ref) { g.equip = target; g.weight = conv(g.weight); if (g.key) g.key = g.key.replace(`|${ref}|`, `|${target}|`); }
  if (db.volSuggDismissed) db.volSuggDismissed = db.volSuggDismissed.map(k => k.replace(`|${ref}|`, `|${target}|`));
  for (const x of EXERCISES) if ((x.equipment || []).includes(ref)) x.equipment = [...new Set(x.equipment.map(k => k === ref ? target : k))];
  invalidate();
}
export function moveToGeneric() {
  const plan = genericMovePlan().filter(m => m.ok);
  for (const { sv, ref, kind, from, to } of plan) {
    repointRef(ref, kind, from, to);
    db.equipment = db.equipment.filter(x => x !== sv);
  }
  invalidate();
  return plan;
}
// saved machines for an exercise (at a location when given)
export const machinesFor = (exId, location) => db.equipment.filter(sv => eqAt(sv, location) && machineFor(exId, sv));
// exercises a machine is for: picked when it was saved (or later), or already logged / given a goal on it
export const machineExercises = sv => EXERCISES.filter(x => machineFor(x.id, sv));

export const isMachineType = t => MACHINE_TYPES.includes(genericOf(t));

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
// A goal at another volume on the same equipment, converted to this volume.
// Reps convert with the average of the Epley and Brzycki one-rep-max formulas, rounded down
// to the equipment's weight step. Same set count first, then the closest rep count.
export const repFactor = r => { r = Math.max(1, Math.min(30, r)); return ((1 + r / 30) + 36 / (37 - r)) / 2; };
export function volumeSuggestion(exId, ref, sets, reps) {
  if (!exId || !ref || goalFor(exId, ref, sets, reps) != null) return null;
  const key = goalKey(exId, ref, sets, reps);
  if ((db.volSuggDismissed || []).includes(key)) return null;
  const pre = `${exId}|${ref}|`, cands = [];
  for (const [k, w] of Object.entries(derived().goals)) {
    if (w == null || !k.startsWith(pre)) continue;
    const [S, R] = k.slice(pre.length).split('x').map(Number);
    if (S && R) cands.push({ sets: S, reps: R, weight: w });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => (a.sets !== sets) - (b.sets !== sets) || Math.abs(a.reps - reps) - Math.abs(b.reps - reps) || Math.abs(a.sets - sets) - Math.abs(b.sets - sets));
  const src = cands[0]; if (!(src.weight > 0)) return null;
  const inc = increment(eqUnits(ref));
  const raw = src.weight * repFactor(src.reps) / repFactor(reps);
  const weight = Math.max(inc, Math.floor(raw / inc + 1e-9) * inc);
  return { key, sets, reps, weight, from: src };
}
export function dismissVolumeSuggestion(key) { db.volSuggDismissed = [...new Set([...(db.volSuggDismissed || []), key])]; }
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

// ---- your plans ----
// A plan you made lives in db.plans and can be started again. db.plan is the run in progress
// (with planId pointing at its plan) and planHistory holds finished or ended runs.
const planSig = p => `${p.name}|${p.splitDays}|${JSON.stringify((p.days || []).slice(0, p.splitDays))}`;
function migratePlans() {
  // every run (finished or in progress) gets a plan in your list, so nothing you ran goes missing
  if (!Array.isArray(db.plans)) db.plans = [];
  const runs = [...db.planHistory, ...(db.plan ? [db.plan] : [])].sort((a, b) => (a.start < b.start ? -1 : 1));
  for (const r of runs) {
    if (r.planId && (db.plans.some(x => x.id === r.planId) || r.planDeleted)) continue;
    let t = db.plans.find(x => planSig(x) === planSig(r));
    if (!t) { t = { id: uid('pt'), name: r.name, splitDays: r.splitDays, days: r.days.slice(0, r.splitDays), length: daysBetween(r.start, r.end) + 1, createdAt: r.start }; db.plans.push(t); }
    t.lastStarted = r.start; r.planId = t.id;
  }
}
// how many times a plan has been started
export const planRuns = id => db.planHistory.filter(r => r.planId === id).length + (db.plan && db.plan.planId === id ? 1 : 0);
export const planRunning = id => !!(db.plan && db.plan.planId === id && (planToday() || {}).status !== 'ended');

// ---- past plans ----
// Ending a plan (or replacing a finished one) files it in planHistory with the day it stopped.
export function archivePlan(plan = db.plan, today = dayKey()) {
  if (!plan) return;
  const endedOn = today < plan.end ? (today < plan.start ? plan.start : today) : plan.end;
  db.planHistory.push({ ...plan, id: plan.id || 'p' + Date.now().toString(36), endedOn });
  if (plan === db.plan) db.plan = null;
}
// Biggest goal increases during a plan: per exercise + equipment + volume, the goal in place when
// the plan started (or the first one set during it) against the last one set during it.
const toLbs = (w, u) => u === 'kg' ? w * 2.20462 : w;
export function planGains(from, to, limit = 3) {
  const inRange = at => { const k = dayKey(new Date(at)); return k >= from && k <= to; };
  const before = at => dayKey(new Date(at)) < from;
  const byKey = new Map();
  for (const g of db.goalEdits) { if (!byKey.has(g.key)) byKey.set(g.key, []); byKey.get(g.key).push(g); }
  const out = [];
  for (const [key, evs] of byKey) {
    const during = evs.filter(g => inRange(g.at) && g.weight != null).sort((a, b) => (a.at < b.at ? -1 : 1));
    if (!during.length) continue;
    const prior = evs.filter(g => before(g.at) && g.weight != null).sort((a, b) => (a.at < b.at ? -1 : 1)).pop();
    const first = prior ? prior.weight : during[0].weight, last = during[during.length - 1].weight;
    if (!(last > first)) continue;
    const [exId, ref, vol] = key.split('|'), [sets, reps] = vol.split('x').map(Number);
    const unit = eqUnits(ref);
    out.push({ exId, ref, sets, reps, first, last, unit, gain: last - first, rank: unit === 'simple' ? 0 : toLbs(last - first, unit) });
  }
  return out.sort((a, b) => b.rank - a.rank || b.gain - a.gain).slice(0, limit);
}

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
