// ============================================================================
// FailUp — app shell
// Screens are pure functions of state that return HTML strings. render() swaps
// #app.innerHTML, a single delegated click handler runs actions, and every
// render saves the store. Maps to React as: Screen → component, data-action →
// onClick, `state` → UI store, `db` (store.js) → persisted store.
// ============================================================================
import { state, WORKOUT_COLORS, PURPLE } from './data.js';
import { I, fmt, esc, wt, eqName, D } from './ui.js';
import {
  db, load, save, loadPhotos, putPhoto, EXERCISES, exById, uid, GENERIC, eqById, eqLabel, eqUnits, eqType, increment,
  goalFor, goalKey, setGoal, derived, isFail, lastDone, dayKey, addDays, parseDay, daysBetween,
  exportData, importData, clearExerciseData, resetAll,
} from './store.js';
import {
  TrackerScreen, VolumeModal, ExercisesScreen, FilterSheet, exListInner, ColorPickerSheet, IconPickerSheet,
  ExerciseWizard, EquipmentWizard, ExerciseDetailScreen, ExerciseHistoryScreen, EquipmentListScreen, EquipmentDetailScreen,
  EquipmentSwapScreen, LocationSheet, NewLocationScreen, ConfirmSheet, MenuSheet, mergeExList, MergeExerciseScreen,
  MergeEquipmentScreen, SettingsScreen, EQ_TYPES, defaultRef,
} from './screens-library.js';
import {
  HomeScreen, QuickSelectScreen, WorkoutsScreen, AssignDayScreen, CreateWorkoutScreen, LineupScreen, WorkoutDetailsScreen,
  WorkoutSessionScreen, ActiveSetSheet, OverloadGoalSheet, UpdateGoalSheet, GoalAskSheet, PauseSheet, SessionLogScreen, PlanWizard,
  listCtx, keepCurrentExercise, vol, exInfo, workingSets, nextTarget, rpeOf, rpeNum, setPurple, sessionStats,
} from './screens-workout.js';
import { UPPER_BODY, LOWER_BODY } from './data.js';

// The live workout is part of the saved store, so a reload mid-workout resumes it.
Object.defineProperty(state, 'session', { get: () => db.active, set: v => { db.active = v; } });

/* -------------------------------- navigation ------------------------------- */
state.stack = [];
let goingBack = false;
function go(to) { state.stack.push(state.screen); state.screen = to; state.modal = null; }
function back() { goingBack = true; state.screen = state.stack.pop() || 'home'; state.modal = null; }
function home() { goingBack = true; if (state.screen !== 'home') state.quoteIdx = (state.quoteIdx || 0) + 1 + Math.floor(Math.random() * 3); state.stack = []; state.screen = 'home'; state.modal = null; }
state.quoteIdx = Math.floor(Math.random() * 100);

/* ---------------------------------- render --------------------------------- */
const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
const device = document.querySelector('.device');
const toastEl = document.createElement('div');
toastEl.className = 'toast';
device.appendChild(toastEl);
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2600);
}

const SCREENS = {
  home: HomeScreen, quickselect: QuickSelectScreen, session: WorkoutSessionScreen, create: CreateWorkoutScreen,
  exwiz: ExerciseWizard, eqwiz: EquipmentWizard, planwiz: PlanWizard, exercises: ExercisesScreen, tracker: TrackerScreen,
  workouts: WorkoutsScreen, assignday: AssignDayScreen, lineup: LineupScreen, exdetail: ExerciseDetailScreen,
  exhistory: ExerciseHistoryScreen, equipment: EquipmentListScreen, eqdetail: EquipmentDetailScreen,
  swap: () => EquipmentSwapScreen(swapRef()), details: WorkoutDetailsScreen, newloc: NewLocationScreen,
  mergeex: MergeExerciseScreen, mergeeq: MergeEquipmentScreen, complete: SessionLogScreen, log: SessionLogScreen,
  settings: SettingsScreen,
};
const MODALS = {
  volume: VolumeModal, muscle: () => FilterSheet('muscle'), equipment: () => FilterSheet('equipment'),
  color: ColorPickerSheet, icon: IconPickerSheet, setwidget: ActiveSetSheet, goal: OverloadGoalSheet,
  updategoal: UpdateGoalSheet, goalask: GoalAskSheet, location: LocationSheet, confirm: ConfirmSheet, pause: PauseSheet, menu: MenuSheet,
};
const NEEDS_SESSION = ['session', 'lineup'];
function screenHTML() {
  if (NEEDS_SESSION.includes(state.screen) && !state.session) home();
  let html = '';
  try { html = (SCREENS[state.screen] || HomeScreen)(); } catch (err) { console.error(err); }
  if (!html) { home(); html = HomeScreen(); }
  return html;
}
let lastModal = null, lastScreen = null;
const scrollMemory = {};
function render() {
  if (lastScreen && state.screen !== lastScreen) scrollMemory[lastScreen] = app.scrollTop;
  const sameModal = state.modal && state.modal === lastModal;
  const scrolls = sameModal ? [...overlay.querySelectorAll('*')].filter(el => el.scrollTop > 0).map(el => [el.className, el.scrollTop]) : [];
  const flip = state.screen === lastScreen ? measureExpandables() : null;
  const pipFrom = state.screen === 'session' && lastScreen === 'session' && state.session ? lastExIndex : null;
  app.innerHTML = screenHTML();
  if (flip) animateExpandables(flip);
  if (pipFrom != null && state.session && state.session.exIndex !== pipFrom) { slideCurrentPip(pipFrom, state.session.exIndex); animatePip(pipFrom); rollNumber(pipFrom + 1, state.session.exIndex > pipFrom ? 1 : -1); }
  lastExIndex = state.session ? state.session.exIndex : null;
  let modal = '';
  try { modal = state.modal && MODALS[state.modal] ? MODALS[state.modal]() : ''; } catch (err) { console.error(err); state.modal = null; }
  overlay.innerHTML = modal;
  overlay.classList.toggle('settled', !!sameModal);
  for (const [cls, top] of scrolls) { const el = [...overlay.querySelectorAll('*')].find(x => x.className === cls); if (el) el.scrollTop = top; }
  lastModal = state.modal;
  if (state.screen !== lastScreen) {
    app.scrollTop = goingBack ? (scrollMemory[state.screen] || 0) : 0;
    if (lastScreen) pageTransition(goingBack);
  }
  lastScreen = state.screen; goingBack = false;
  mountLottie();
  blendHeader();
  if (!save() && !state.warnedStorage) { state.warnedStorage = true; toast('Couldn’t save. This browser is blocking storage.'); }
}

/* ---- headers: on a white screen the header blends in, and lifts once you scroll ---- */
const isWhite = c => /^rgba?\(255, 255, 255(, 1)?\)$/.test(c);
function bgOf(el) {
  for (let n = el; n && n !== app.parentElement; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') return c;
  }
  return '';
}
function blendHeader() {
  const root = app.firstElementChild;
  if (!root) return;
  const head = root.querySelector(':scope > .wiz-header') || root.querySelector(':scope > .nav');
  const below = head && head.nextElementSibling;
  const blend = !!below && isWhite(bgOf(below));
  root.classList.toggle('blend-top', blend);
  root.classList.toggle('raised', app.scrollTop > 2);
}
app.addEventListener('scroll', () => { const r = app.firstElementChild; if (r) r.classList.toggle('raised', app.scrollTop > 2); }, { passive: true });

/* ---- page transitions: forward slides in from the right, back from the left ---- */
function pageTransition(isBack) {
  if (reduceMotion()) return;
  const dx = isBack ? -40 : 40;
  app.animate([{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

/* ---- expand / collapse: animate the card from its old height to its new one ---- */
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isOpen = el => !!el.querySelector('.cw-ex-detail, .sess-exdetail');
function measureExpandables() {
  const m = new Map();
  for (const el of app.querySelectorAll('[data-anim]')) m.set(el.dataset.anim, { h: el.offsetHeight, open: isOpen(el), top: el.getBoundingClientRect().top });
  return m;
}
function animateExpandables(before) {
  if (reduceMotion()) return;
  for (const el of app.querySelectorAll('[data-anim]')) {
    const was = before.get(el.dataset.anim), open = isOpen(el);
    if (!was) continue;
    // reorder (Up / Down): slide each card from where it was; the one you moved lifts a little
    const dy = was.top - el.getBoundingClientRect().top;
    if (Math.abs(dy) > 1 && was.open === open && Math.abs(dy) > Math.abs(was.h - el.offsetHeight)) {
      const lifted = open;
      el.style.position = 'relative'; el.style.zIndex = lifted ? 2 : 1;
      const a = el.animate(lifted
        ? [{ transform: `translateY(${dy}px)` }, { transform: `translateY(${dy / 2}px) scale(1.02)`, boxShadow: '0 16px 36px rgba(20,20,23,.18)' }, { transform: 'none' }]
        : [{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 340, easing: EASE });
      a.onfinish = () => { el.style.zIndex = ''; el.style.position = ''; };
      continue;
    }
    if (was.open === open) continue;
    const h = el.offsetHeight;
    el.animate([{ height: was.h + 'px', overflow: 'hidden' }, { height: h + 'px', overflow: 'hidden' }], { duration: 280, easing: EASE });
    const detail = el.querySelector('.cw-ex-detail, .sess-exdetail');
    if (detail) detail.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: 40, easing: EASE, fill: 'backwards' });
    const caret = el.querySelector('.cw-ex-caret, .sess-excaret');
    if (caret) caret.animate([{ transform: 'rotate(180deg)' }, { transform: 'rotate(0)' }], { duration: 280, easing: EASE });
  }
}

/* ---- "Exercise N of 7": the old number rolls out, the new one rolls in with a little lift ---- */
function rollNumber(oldN, dir) {
  if (reduceMotion()) return;
  const box = app.querySelector('.sess-num'), cur = box && box.firstElementChild;
  if (!cur) return;
  const ghost = document.createElement('span');
  ghost.className = 'sess-num-ghost'; ghost.textContent = oldN;
  box.appendChild(ghost);
  const ease = 'cubic-bezier(.3,1.4,.5,1)';
  ghost.animate([{ transform: 'none', opacity: 1, filter: 'blur(0)' }, { transform: `translateY(${-dir * 110}%) scale(.7)`, opacity: 0, filter: 'blur(1.5px)' }],
    { duration: 260, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).onfinish = () => ghost.remove();
  cur.animate([{ transform: `translateY(${dir * 110}%) scale(.7)`, opacity: 0, filter: 'blur(1.5px)' }, { transform: 'none', opacity: 1, filter: 'blur(0)' }],
    { duration: 420, delay: 90, easing: ease, fill: 'backwards' });
  box.animate([{ color: 'inherit' }, { color: getComputedStyle(app.querySelector('.sess-screen')).getPropertyValue('--sess-color').trim() || '#cf2a0f', offset: .45 }, { color: 'inherit' }], { duration: 700 });
}

/* ---- progress pips: the workout color slides (and stretches) from one pip to the next ---- */
const SLIDE_MS = 380;
function slideCurrentPip(from, to) {
  if (reduceMotion()) return;
  const bar = app.querySelector('.sess-prog'), pips = bar && bar.querySelectorAll('.sess-progseg');
  if (!pips || !pips[from] || !pips[to]) return;
  const box = bar.getBoundingClientRect(), a = pips[from].getBoundingClientRect(), b = pips[to].getBoundingClientRect();
  const color = getComputedStyle(pips[to]).backgroundColor;
  const blob = document.createElement('span');
  blob.className = 'sess-pipblob';
  blob.style.cssText = `top:${a.top - box.top}px;height:${a.height}px;background:${color}`;
  bar.appendChild(blob);
  const L = r => r.left - box.left, lo = Math.min(L(a), L(b)), span = Math.max(L(a) + a.width, L(b) + b.width) - lo;
  blob.animate([
    { left: L(a) + 'px', width: a.width + 'px' },
    { left: lo + 'px', width: span + 'px', offset: .5 },
    { left: L(b) + 'px', width: b.width + 'px' },
  ], { duration: SLIDE_MS, easing: 'cubic-bezier(.65,0,.35,1)' }).onfinish = () => blob.remove();
  // the destination pip stays empty until the color lands
  pips[to].animate([{ backgroundColor: '#fff' }, { backgroundColor: '#fff' }], { duration: SLIDE_MS - 20 });
}

/* ---- progress pips: when you move on, a finished exercise fills in; a purple one blinks ---- */
let lastExIndex = null;
function animatePip(i) {
  if (reduceMotion()) return;
  const pip = app.querySelectorAll('.sess-progseg')[i];
  if (!pip) return;
  if (pip.classList.contains('pr')) {
    pip.animate([{ opacity: 1 }, { opacity: .2 }, { opacity: 1 }, { opacity: .2 }, { opacity: 1 }, { opacity: .2 }, { opacity: 1 }],
      { duration: 1400, delay: SLIDE_MS / 2, easing: 'ease-in-out' });
  } else if (pip.classList.contains('done')) {
    const from = '#fff';
    pip.animate([
      { backgroundColor: from, backgroundImage: 'linear-gradient(#5a5961,#5a5961)', backgroundRepeat: 'no-repeat', backgroundSize: '0% 100%' },
      { backgroundColor: from, backgroundImage: 'linear-gradient(#5a5961,#5a5961)', backgroundRepeat: 'no-repeat', backgroundSize: '100% 100%' },
    ], { duration: 900, delay: SLIDE_MS / 2, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' });
  }
}

/* ---- Workout Complete stat cards slide up into place, one after another ---- */
function slideInStats() {
  app.querySelectorAll('.wc-stat').forEach((el, i) => {
    const y = i === 1 ? 14 : 0;   // the middle card rests a little lower
    el.animate([{ opacity: 0, transform: `translateY(${y + 48}px)` }, { opacity: 1, transform: `translateY(${y}px)` }],
      { duration: 520, delay: 450 + i * 90, easing: 'cubic-bezier(.2,.9,.25,1.15)', fill: 'backwards' });
  });
}

/* ---- "complete" animation (Lottie, bundled in vendor/) ---- */
let lottieData = null, lottiePlayed = null, lottieAnim = null;
function mountLottie() {
  if (lottieAnim) { lottieAnim.destroy(); lottieAnim = null; }
  const el = app.querySelector('[data-lottie]');
  if (!el || !window.lottie) return;
  const play = data => {
    const anim = lottieAnim = window.lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, animationData: data });
    const still = lottiePlayed === state.log.sid || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) anim.goToAndStop(anim.totalFrames - 1, true);
    else { lottiePlayed = state.log.sid; anim.play(); slideInStats(); }
  };
  if (lottieData) play(lottieData);
  else fetch('./assets/complete.json').then(r => r.json()).then(d => { lottieData = d; if (el.isConnected) play(d); }).catch(() => {});
}

/* ------------------------------ session logic ------------------------------ */
const cur = () => state.session.exercises[state.session.exIndex];
function syncGoal(e) { e.goal.weight = goalFor(e.exId, e.equip, e.goal.sets, e.goal.reps); }
function syncAllGoals() { if (state.session) state.session.exercises.forEach(syncGoal); }
// Generic fallback for an exercise when its saved equipment goes away.
function genericFor(e, sv) {
  const t = sv ? eqType(sv) : null;
  if (t && GENERIC.includes(t)) return t;
  const x = exById(e.exId), k = x && x.equipment.find(k => !k.startsWith('eq:'));
  return k ? eqName(k) : 'Bodyweight';
}
// The workout's location picks each exercise's default equipment: a saved piece
// of the same kind there, otherwise the generic type.
function applyLocationDefaults(s) {
  for (const e of s.exercises) {
    if (e.sets.length) continue;                       // don't move sets already logged
    const sv = eqById(e.equip);
    const type = sv ? eqType(sv) : e.equip;
    const here = db.equipment.filter(x => x.location === s.location && eqType(x) === type);
    if (here.length) e.equip = here.includes(sv) ? e.equip : 'eq:' + here[0].id;
    else if (sv && sv.location !== s.location && GENERIC.includes(type)) e.equip = type;
    syncGoal(e);
  }
}
function sessionItem(exId, equip, sets = 3, reps = 8) {
  const x = exById(exId);
  return { exId, name: x ? x.name : '', muscle: x ? x.muscle : '', equip, goal: { sets, reps, weight: null }, sets: [] };
}
function prepSession(w) {
  state.session = {
    id: uid('s'), workoutId: w.id, workoutName: w.name, color: w.color, icon: w.icon,
    location: db.settings.location || db.locations[0] || 'Home', started: false, exIndex: 0, expanded: true,
    exercises: w.exercises.map(t => sessionItem(t.exId, t.equip, t.sets, t.reps)),
  };
  applyLocationDefaults(state.session);
  state.lineup = { expanded: null, swapIndex: null };
  go('lineup');
}
function finishSession() {
  const s = state.session;
  const done = s.exercises.filter(e => e.sets.length);
  if (!done.length) { state.session = null; home(); toast('Nothing was logged, so nothing was saved.'); return; }
  const rec = {
    id: s.id, workoutId: s.workoutId, workoutName: s.workoutName, color: s.color, icon: s.icon, location: s.location,
    startedAt: s.startedAt, finishedAt: new Date().toISOString(), edited: !!s.edited,
    exercises: done.map(e => ({ exId: e.exId, name: exInfo(e).name, muscle: exInfo(e).muscle, equip: e.equip, equipName: eqLabel(e.equip), goal: { ...e.goal }, newGoal: e.newGoal ?? null, sets: e.sets.map(x => ({ ...x })) })),
  };
  db.sessions.push(rec);
  state.session = null;
  state.log = { sid: rec.id, mode: 'complete' };
  state.stack = ['home']; state.screen = 'complete'; state.modal = null;
}
// Reopen a just-finished workout (Add More Exercises).
function reopenSession(sid) {
  const i = db.sessions.findIndex(x => x.id === sid);
  if (i < 0) return false;
  const [s] = db.sessions.splice(i, 1);
  state.session = { ...s, started: true, expanded: true, exIndex: s.exercises.length - 1, finishedAt: undefined };
  syncAllGoals();
  return true;
}
// Set defaults: the last working set, the goal, or what you did last time.
function setDraft(type, si) {
  const s = state.session, e = cur(), u = eqUnits(e.equip), inc = increment(u);
  const working = workingSets(e), warm = e.sets.filter(x => x.type === 'warmup');
  const last = lastDone(e.exId, e.equip);
  const lastTop = last ? Math.max(0, ...workingSets(last.e).map(x => x.weight)) : null;
  const hint = type === 'working' ? (e.goal.weight != null ? `Goal: ${wt(e.goal.weight, u)} × ${e.goal.reps} reps, or to failure` : `No goal yet. Finish ${e.goal.sets} × ${e.goal.reps} and FailUp will suggest one`) : '';
  if (si != null) {
    const st = e.sets[si];
    const num = st.type === 'working' ? working.indexOf(st) + 1 : 0;
    return { ...st, setNum: num, unit: u, edit: { si }, touched: true, hint };
  }
  if (type === 'warmup') {
    const base = warm.length ? warm[warm.length - 1].weight : e.goal.weight ?? lastTop;
    return { type, setNum: warm.length + 1, weight: warm.length ? base : base ? Math.round((base * 0.5) / inc) * inc : 0, reps: e.goal.reps + 2, feel: 0, unit: u, hint };
  }
  const weight = working.length ? working[working.length - 1].weight : e.goal.weight ?? lastTop ?? 0;
  return { type, setNum: working.length + 1, weight, reps: e.goal.reps, feel: 0, unit: u, hint };
}

// The goal prompts:
//  • last two working sets went to failure → goal = that weight (reach the volume without failing)
//  • all required sets hit the reps, none failed, all RPE 7+ → goal = that weight + one increment
//  • same, but it felt easy (any set RPE 6 or lower) → "too light?" and you pick the new weight
function goalPrompt(e) {
  if (e.goalAsked) return null;
  const w = workingSets(e);
  if (w.length < e.goal.sets) return null;
  const g = e.goal.weight, inc = increment(eqUnits(e.equip));
  const last2 = w.slice(-2);
  if (last2.length === 2 && last2.every(isFail)) {
    const W = last2[1].weight;
    return W > 0 && g !== W ? { kind: 'fail', weight: W } : null;
  }
  const req = w.slice(0, e.goal.sets), rpe = x => Math.min(10, Math.floor(x.feel * 10) + 1);
  if (req.every(x => !isFail(x) && x.reps >= e.goal.reps)) {
    const W = Math.min(...req.map(x => x.weight)), to = W + inc;
    if (!(W > 0) || (g != null && g >= to)) return null;
    // felt hard (RPE 7+) → offer one increment; felt easy → "too light?" with a weight you pick
    return req.every(x => rpe(x) > 6) ? { kind: 'raise', from: W, weight: to } : { kind: 'light', from: W, weight: to };
  }
  return null;
}

/* --------------------------------- helpers --------------------------------- */
function toggleIn(arr, v) { const i = arr.indexOf(v); if (i === -1) arr.push(v); else arr.splice(i, 1); }
function confirm(c) { state.confirm = c; state.modal = 'confirm'; }
function menu(m) { state.menu = m; state.modal = 'menu'; }
function resetPicker() {
  const ex = state.exercises;
  if (ex.swapping) ex.muscles = [];
  ex.mode = 'browse'; ex.swapping = false; ex.picked = []; ex.search = '';
}
function setLocation(target, name) {
  if (target === 'lineup') { state.session.location = name; db.settings.location = name; applyLocationDefaults(state.session); }
  else if (target === 'equipment') { const sv = db.equipment.find(x => x.id === state.eqDetail); if (sv) sv.location = name; }
  else if (target === 'eqwiz') state.eqwiz.location = name;
}
function openWorkoutEditor(wid) {
  const w = db.workouts.find(x => x.id === wid);
  if (!w) return;
  state.create = { mode: 'edit', editId: wid, name: w.name, color: w.color, icon: w.icon, expanded: null, exercises: w.exercises.map(e => ({ ...e })) };
  go('create');
}
function swapTarget() {
  const sw = state.swap;
  if (sw.owner === 'session') return cur();
  if (sw.owner === 'tracker') return null;
  return listCtx(sw.owner).items[sw.index];
}
function swapRef() { const t = swapTarget(); return t ? t.equip : state.tracker.equip; }
// Add an exercise from the picker to whatever opened it.
function addToCtx(id) {
  const ex = state.exercises, c = listCtx(ex.returnTo || 'create'), x = exById(id);
  if (!x) return;
  const ref = defaultRef(x);
  let item;
  if (c.owner === 'lineup') { item = sessionItem(x.id, ref); }
  else item = { exId: x.id, name: x.name, muscle: x.muscle, sets: 3, reps: 8, equip: ref };
  if (c.ui.swapIndex != null) {
    const old = c.items[c.ui.swapIndex], ov = vol(old);
    Object.assign(vol(item), { sets: ov.sets, reps: ov.reps });
    if (c.owner === 'lineup' && old.sets.length) { c.items.splice(c.ui.swapIndex + 1, 0, item); c.ui.expanded = c.ui.swapIndex + 1; }
    else { keepCurrentExercise(c, () => { c.items[c.ui.swapIndex] = item; }); c.ui.expanded = c.ui.swapIndex; }
  } else { c.items.push(item); c.ui.expanded = c.items.length - 1; }
  if (c.owner === 'lineup') applyLocationDefaults(state.session);
  c.ui.swapIndex = null;
  resetPicker();
  back();
}
function defaultVolume(exId, ref) {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    const e = db.sessions[i].exercises.find(x => x.exId === exId && x.equip === ref);
    if (e) return { sets: e.goal.sets, reps: e.goal.reps };
  }
  for (const w of db.workouts) { const t = w.exercises.find(x => x.exId === exId); if (t) return { sets: t.sets, reps: t.reps }; }
  return { sets: 3, reps: 8 };
}
function openTracker(exId, ref) {
  state.tracker = { exId, equip: ref, range: 'All', volume: defaultVolume(exId, ref) };
  go('tracker');
}
function openPlanWizard(edit) {
  const today = dayKey(), p = edit && db.plan;
  state.planwiz = p
    ? { step: 1, name: p.name, splitDays: p.splitDays, days: p.days.map(d => ({ ...d })), start: p.start, end: p.end, month: p.start.slice(0, 7), pick: 'start', editing: true }
    : { step: 1, name: '', splitDays: 7, days: Array.from({ length: 7 }, () => ({ type: 'empty' })), start: today, end: addDays(today, 27), month: today.slice(0, 7), pick: 'start', editing: false };
  while (state.planwiz.days.length < 10) state.planwiz.days.push({ type: 'empty' });
  go('planwiz');
}
function freshExWizard(extra = {}) { state.exwiz = { step: 1, name: '', primary: null, secondary: [], equipment: [], saved: [], photo: null, ...extra }; }
function freshEqWizard(returnTo) { state.eqwiz = { step: 1, location: (state.session && state.session.location) || db.settings.location || db.locations[0] || '', name: '', units: db.settings.units, photo: null, returnTo }; }

// Replace one equipment ref with another everywhere (merge / delete).
function replaceRef(from, toFn, { history } = {}) {
  for (const w of db.workouts) for (const e of w.exercises) if (e.equip === from) e.equip = toFn(e);
  if (state.session) for (const e of state.session.exercises) if (e.equip === from) { e.equip = toFn(e); syncGoal(e); }
  for (const x of EXERCISES) if (x.equipment.includes(from)) x.equipment = x.equipment.filter(k => k !== from);
  if (history) {
    for (const s of db.sessions) for (const e of s.exercises) if (e.equip === from) e.equip = history;
    for (const g of db.goalEdits) { const [a, r, v] = g.key.split('|'); if (r === from) g.key = `${a}|${history}|${v}`; }
  }
}

/* --------------------------- sharing (PNG summary) -------------------------- */
async function shareSession(s) {
  try { await document.fonts.load('80px "League Gothic"'); await document.fonts.load('700 40px Inter'); } catch {}
  const W = 1080, P = 64, st = sessionStats(s);
  const done = s.exercises.filter(e => e.sets.length);
  const rowH = 76, cardHead = 128;
  const H = 420 + done.reduce((a, e) => a + cardHead + e.sets.length * rowH + 40, 0) + 120;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  g.fillStyle = '#ebebeb'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#5f636b'; g.font = '600 34px Inter'; g.textBaseline = 'alphabetic';
  g.fillText('Workout Complete', P, 170);
  g.fillStyle = '#fff'; rr(P, 200, W - P * 2, 130, 12); g.fill();
  g.fillStyle = s.color; g.fillRect(P, 200, 14, 130);
  g.fillStyle = '#111'; g.font = '700 52px Inter'; g.fillText(s.workoutName, P + 40, 262);
  g.fillStyle = s.color; g.font = '700 28px Inter';
  g.fillText(`${st.exercises} EXERCISES • ${st.sets} SETS • ${st.fails} TO FAILURE`.toUpperCase(), P + 40, 306);
  let y = 370;
  for (const e of done) {
    const info = exInfo(e), u = eqUnits(e.equip), h = cardHead + e.sets.length * rowH + 10;
    g.fillStyle = '#fff'; rr(P, y, W - P * 2, h, 20); g.fill();
    g.fillStyle = '#111'; g.font = '700 46px Inter'; g.fillText(info.name, P + 32, y + 66);
    g.fillStyle = '#5f636b'; g.font = '700 24px Inter'; g.fillText(`${info.muscle} • ${e.equipName || eqLabel(e.equip)}`.toUpperCase(), P + 32, y + 104);
    let n = 0, ry = y + cardHead;
    for (const set of e.sets) {
      const warm = set.type === 'warmup', label = warm ? 'W' : String(++n);
      g.fillStyle = warm ? '#828282' : setPurple(set, e) ? PURPLE : '#111';
      rr(P + 32, ry, 56, 56, 6); g.fill();
      g.fillStyle = '#fff'; g.font = '900 28px Inter'; g.textAlign = 'center'; g.fillText(label, P + 60, ry + 38); g.textAlign = 'left';
      g.fillStyle = '#111'; g.font = '500 32px Inter'; g.fillText(`${wt(set.weight, u)} × ${set.reps} reps`, P + 112, ry + 39);
      if (!warm) {
        const tag = isFail(set) ? 'F' : rpeOf(set.feel), tw = isFail(set) ? 48 : 112;
        g.strokeStyle = PURPLE; g.lineWidth = 2; g.fillStyle = isFail(set) ? PURPLE : '#fff';
        rr(W - P - 32 - tw, ry + 6, tw, 44, 6); g.fill(); g.stroke();
        g.fillStyle = isFail(set) ? '#fff' : '#8174e7'; g.font = '700 22px Inter'; g.textAlign = 'center';
        g.fillText(tag, W - P - 32 - tw / 2, ry + 36); g.textAlign = 'left';
      }
      ry += rowH;
    }
    y += h + 30;
  }
  g.font = '64px "League Gothic"'; g.fillStyle = PURPLE; g.fillText('Fail', P, H - 60);
  g.fillStyle = '#111'; g.fillText('Up', P + g.measureText('Fail').width, H - 60);
  g.fillStyle = '#5f636b'; g.font = '500 26px Inter'; g.textAlign = 'right'; g.fillText(D.long(new Date(s.finishedAt)), W - P, H - 66); g.textAlign = 'left';
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], `failup-${s.workoutName.replace(/\W+/g, '-').toLowerCase()}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `${s.workoutName} · FailUp` }); } catch {}
  } else downloadBlob(blob, file.name);
}
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---- the delegated click handler (≈ React onClick) ---- */
device.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (el.classList.contains('scrim') && e.target.closest('[data-stop]')) return;
  const a = el.dataset.action, d = el.dataset, ex = state.exercises;
  if (handle(a, d, el, ex) !== false) render();
});

function handle(a, d, el, ex) {
  const s = state.session;
  switch (a) {
    /* ---------------- tracker ---------------- */
    case 'open-tracker': openTracker(state.exDetail, d.equip); break;
    case 'eq-open-tracker': openTracker(d.id, 'eq:' + state.eqDetail); break;
    case 'set-range': state.tracker.range = d.range; break;
    case 'tracker-pick-exercise': ex.mode = 'tracker'; ex.search = ''; go('exercises'); break;
    case 'open-volume': {
      const inSession = d.owner === 'session', it = inSession ? cur() : null;
      const exId = inSession ? it.exId : state.tracker.exId, ref = inSession ? it.equip : state.tracker.equip;
      const v = inSession ? it.goal : state.tracker.volume;
      state.volumeDraft = { context: inSession ? 'session' : 'tracker', sets: v.sets, reps: v.reps, unit: eqUnits(ref),
        goalFor: (st, r) => goalFor(exId, ref, st, r), points: (st, r) => (derived().ach[goalKey(exId, ref, st, r)] || []).length };
      state.modal = 'volume'; break;
    }
    case 'close-volume': state.modal = null; break;
    case 'vol-step': state.volumeDraft[d.field] = Math.min(50, Math.max(1, state.volumeDraft[d.field] + +d.dir)); break;
    case 'save-volume': {
      const v = state.volumeDraft;
      if (v.context === 'session') { const it = cur(); it.goal.sets = v.sets; it.goal.reps = v.reps; syncGoal(it); }
      else state.tracker.volume = { sets: v.sets, reps: v.reps };
      state.modal = null; break;
    }

    /* ---------------- exercise picker ---------------- */
    case 'open-muscle': ex.draftMuscles = [...ex.muscles]; state.modal = 'muscle'; break;
    case 'open-equipment': ex.draftEquipment = [...ex.equipment]; state.modal = 'equipment'; break;
    case 'toggle-facet': toggleIn(d.kind === 'muscle' ? ex.draftMuscles : ex.draftEquipment, d.name); break;
    case 'clear-facet': if (d.kind === 'muscle') ex.draftMuscles = []; else ex.draftEquipment = []; break;
    case 'apply-filter':
      if (d.kind === 'muscle') ex.muscles = [...ex.draftMuscles]; else ex.equipment = [...ex.draftEquipment];
      if (d.kind === 'muscle') ex.swapping = false;
      state.modal = null; break;
    case 'cancel-filter': state.modal = null; break;
    case 'remove-chip':
      if (d.type === 'muscle') { ex.muscles = ex.muscles.filter(m => m !== d.name); ex.swapping = false; }
      else ex.equipment = ex.equipment.filter(x => x !== d.name);
      break;
    case 'expand-recent': ex.recentOpen = true; break;
    case 'open-exercise':
      if (ex.mode === 'add') addToCtx(d.id);
      else if (ex.mode === 'quickadd') toggleIn(ex.picked, d.id);
      else if (ex.mode === 'tracker') {
        const x = exById(d.id), t = state.tracker;
        const usable = x.equipment.map(k => k.startsWith('eq:') ? k : eqName(k));
        if (!usable.includes(t.equip) && !lastDone(d.id, t.equip)) t.equip = defaultRef(x);
        t.exId = d.id; t.volume = defaultVolume(d.id, t.equip); resetPicker(); back();
      } else { state.exDetail = d.id; go('exdetail'); }
      break;
    case 'quickadd-done': {
      const start = s.exercises.length;
      for (const id of ex.picked) s.exercises.push(sessionItem(id, defaultRef(exById(id))));
      applyLocationDefaults(s);
      s.exIndex = start; s.expanded = true;
      resetPicker(); state.stack = ['home']; state.screen = 'session';
      break;
    }
    case 'create-exercise-start': freshExWizard({ addTo: ex.mode === 'add' }); go('exwiz'); break;

    /* ---------------- workout editor ---------------- */
    case 'open-color': state.pickDraft = state.create.color; state.modal = 'color'; break;
    case 'open-icon': state.pickDraft = state.create.icon; state.modal = 'icon'; break;
    case 'close-picker': state.modal = null; break;
    case 'pick-color': state.pickDraft = d.hex; break;
    case 'pick-icon': state.pickDraft = d.icon; break;
    case 'save-picker': if (state.modal === 'color') state.create.color = state.pickDraft; else state.create.icon = state.pickDraft; state.modal = null; break;
    case 'toggle-ex': { const c = listCtx(), i = +d.i; c.ui.expanded = c.ui.expanded === i ? null : i; break; }
    case 'cw-step': {
      const c = listCtx(), it = c.items[+d.i], v = vol(it);
      v[d.field] = Math.min(50, Math.max(1, v[d.field] + +d.dir));
      if (it.goal) syncGoal(it);
      break;
    }
    case 'ex-move': {
      const c = listCtx(), i = +d.i, j = i + +d.dir, arr = c.items;
      if (j >= 0 && j < arr.length) keepCurrentExercise(c, () => { [arr[i], arr[j]] = [arr[j], arr[i]]; c.ui.expanded = j; });
      break;
    }
    case 'ex-swap': {
      const c = listCtx(), it = c.items[+d.i];
      c.ui.swapIndex = +d.i; ex.returnTo = c.owner; ex.mode = 'add'; ex.search = '';
      ex.muscles = [exInfo(it).muscle]; ex.swapping = true;
      go('exercises'); break;
    }
    case 'ex-delete': {
      const c = listCtx(), i = +d.i, it = c.items[i];
      const run = () => keepCurrentExercise(c, () => { c.items.splice(i, 1); c.ui.expanded = null; });
      if (c.owner === 'lineup' && it.sets.length) confirm({ title: 'Remove exercise?', danger: true, label: 'Remove', text: `You’ve logged ${it.sets.length} set${it.sets.length === 1 ? '' : 's'} of ${esc(exInfo(it).name)} today. Removing it deletes them.`, run });
      else run();
      break;
    }
    case 'add-exercise': { const c = listCtx(); c.ui.swapIndex = null; ex.returnTo = c.owner; ex.mode = 'add'; ex.search = ''; go('exercises'); break; }
    case 'save-workout': {
      const c = state.create, name = c.name.trim();
      if (!name) { c.err = 'Give your workout a name.'; break; }
      const rec = { name, color: c.color, icon: c.icon, exercises: c.exercises.map(e => ({ exId: e.exId, name: exInfo(e).name, muscle: exInfo(e).muscle, sets: e.sets, reps: e.reps, equip: e.equip })) };
      if (c.mode === 'edit') {
        const w = db.workouts.find(x => x.id === c.editId);
        if (w) Object.assign(w, rec);
        if (s && s.workoutId === c.editId) { s.workoutName = name; s.color = c.color; s.icon = c.icon; }
      } else db.workouts.push({ id: uid('w'), ...rec });
      back(); toast(c.mode === 'edit' ? 'Workout saved' : 'Workout created'); break;
    }
    case 'workout-create':
      state.create = { mode: 'new', editId: null, name: '', color: WORKOUT_COLORS[db.workouts.length % WORKOUT_COLORS.length].hex, icon: 'kick', expanded: null, exercises: [] };
      go('create'); break;
    case 'workout-details': state.details = { wid: d.id, expanded: null }; go('details'); break;
    case 'details-edit': openWorkoutEditor(state.details.wid); break;
    case 'lineup-edit': openWorkoutEditor(s.workoutId); break;
    case 'workouts-tab': state.workoutsTab = d.tab; break;
    case 'workout-menu': {
      const w = db.workouts.find(x => x.id === d.id);
      menu({ title: w.name, items: [
        { label: 'Edit Workout', icon: I.editPen, run: () => openWorkoutEditor(w.id) },
        { label: 'Delete Workout', icon: I.trash24, danger: true, run: () => confirm({ title: 'Delete workout?', danger: true, label: 'Delete',
          text: `${esc(w.name)} will be removed. Workouts you’ve already logged stay in your history.`,
          run: () => { db.workouts.splice(db.workouts.indexOf(w), 1); toast('Workout deleted'); } }) },
      ] });
      break;
    }
    case 'close-menu': state.modal = null; break;
    case 'menu-pick': { const it = state.menu.items[+d.i]; state.modal = null; it.run(); break; }

    /* ---------------- starting / running a workout ---------------- */
    case 'start-workout': {
      const w = db.workouts.find(x => x.id === d.id);
      if (!w) break;
      if (s && s.started) confirm({ title: 'Start a new workout?', danger: true, label: 'Start New', cancel: 'Keep Paused',
        text: `${esc(s.workoutName)} is still in progress. Starting ${esc(w.name)} discards it.`, run: () => { state.session = null; prepSession(w); } });
      else prepSession(w);
      break;
    }
    case 'lets-go':
      s.started = true; s.startedAt = new Date().toISOString(); s.exIndex = 0; s.expanded = true;
      state.stack = ['home']; state.screen = 'session'; break;
    case 'resume-session': state.stack = ['home']; state.screen = s.started ? 'session' : 'lineup'; break;
    case 'discard-session':
      confirm({ title: 'Discard workout?', danger: true, label: 'Discard', text: s.started ? 'The sets you logged in this workout will be deleted.' : 'Today’s lineup changes will be cleared.',
        run: () => { state.session = null; home(); } });
      break;
    case 'open-lineup': state.lineup = { expanded: s.exIndex, swapIndex: null }; go('lineup'); break;
    case 'sess-toggle': s.expanded = !s.expanded; break;
    case 'sess-move': s.exIndex = Math.min(s.exercises.length - 1, Math.max(0, s.exIndex + +d.dir)); break;
    case 'sess-jump': s.exIndex = +d.i; break;
    case 'sess-next': { const t = nextTarget(s); if (t != null) s.exIndex = t; break; }
    case 'sess-pause': state.modal = 'pause'; break;
    case 'close-pause': state.modal = null; break;
    case 'pause-confirm': home(); break;
    case 'finish-early': state.modal = null; finishSession(); break;
    case 'sess-finish': finishSession(); break;
    case 'complete-home': home(); break;
    case 'add-more':
      if (!reopenSession(state.log.sid)) break;
      ex.mode = 'quickadd'; ex.picked = []; ex.search = ''; ex.returnTo = 'lineup';
      state.stack = ['home', 'session']; state.screen = 'exercises'; break;
    case 'sess-log': state.setDraft = setDraft(d.type); state.modal = 'setwidget'; break;
    case 'edit-set': state.setDraft = setDraft(null, +d.si); state.modal = 'setwidget'; break;
    case 'edit-logged-set': {
      const ls = db.sessions.find(x => x.id === state.log.sid), le = ls.exercises[+d.ei], st = le.sets[+d.si];
      const working = workingSets(le);
      state.setDraft = { ...st, setNum: st.type === 'working' ? working.indexOf(st) + 1 : 0, unit: eqUnits(le.equip), touched: true, edit: { sid: ls.id, ei: +d.ei, si: +d.si } };
      state.modal = 'setwidget'; break;
    }
    case 'sw-w': state.setDraft.weight = Math.max(0, Math.round((state.setDraft.weight + +d.d) * 100) / 100); break;
    case 'sw-r': state.setDraft.reps = Math.max(1, state.setDraft.reps + +d.d); break;
    case 'sess-cancelset': state.setDraft = null; state.modal = null; break;
    case 'sw-done': {
      const a = state.setDraft, rec = { weight: a.weight, reps: a.reps, feel: a.feel, type: a.type };
      state.setDraft = null; state.modal = null;
      if (a.edit && a.edit.sid) {
        const ls = db.sessions.find(x => x.id === a.edit.sid);
        ls.exercises[a.edit.ei].sets[a.edit.si] = rec; ls.edited = true; break;
      }
      const it = cur();
      if (a.edit) { it.sets[a.edit.si] = rec; break; }
      it.sets.push(rec);
      // offer to set (or raise) an overload goal once the required sets are done
      if (a.type === 'working') {
        const ask = goalPrompt(it);
        if (ask) { it.goalAsked = true; state.goalAsk = ask; state.modal = 'goalask'; break; }
      }
      // Figma "Weight Adjustment Edgecase": reduced weight, goal volume, RPE 7+
      const r = rpeOf(a.feel), rpe = r === 'F' ? 10 : +r.slice(4);
      if (a.type === 'working' && it.goal.weight != null && a.weight < it.goal.weight && a.reps >= it.goal.reps && rpe >= 7 && !it.goalPrompted) {
        it.goalPrompted = true;
        state.goalUpdate = { from: it.goal.weight, to: a.weight };
        state.modal = 'updategoal';
      }
      break;
    }
    case 'sw-delete': {
      const a = state.setDraft; state.setDraft = null; state.modal = null;
      if (a.edit.sid) {
        const ls = db.sessions.find(x => x.id === a.edit.sid);
        ls.exercises[a.edit.ei].sets.splice(a.edit.si, 1); ls.edited = true;
        if (!ls.exercises[a.edit.ei].sets.length) ls.exercises.splice(a.edit.ei, 1);
        if (!ls.exercises.length) { db.sessions.splice(db.sessions.indexOf(ls), 1); back(); toast('Workout removed from history'); }
      } else cur().sets.splice(a.edit.si, 1);
      break;
    }
    case 'goalask-adj': state.goalAsk.weight = Math.max(0, Math.round((state.goalAsk.weight + +d.d) * 100) / 100); break;
    case 'goalask-no': state.modal = null; state.goalAsk = null; break;
    case 'goalask-yes': {
      const it = cur(), g = state.goalAsk;
      setGoal(it.exId, it.equip, it.goal.sets, it.goal.reps, g.weight);
      it.newGoal = g.weight;                      // takes effect next time; today's sets keep today's goal
      state.modal = null; state.goalAsk = null; toast('Overload goal set'); break;
    }
    case 'ug-cancel': state.modal = null; state.goalUpdate = null; break;
    case 'ug-confirm': {
      const it = cur();
      setGoal(it.exId, it.equip, it.goal.sets, it.goal.reps, state.goalUpdate.to);
      syncAllGoals(); state.modal = null; state.goalUpdate = null; break;
    }
    case 'open-goal': {
      let it, owner = d.owner;
      if (owner === 'session') it = { ...cur(), sets: cur().goal.sets, reps: cur().goal.reps };
      else if (owner === 'tracker') { const t = state.tracker; it = { exId: t.exId, equip: t.equip, sets: t.volume.sets, reps: t.volume.reps }; }
      else { const src = listCtx(owner).items[+d.i], v = vol(src); it = { exId: src.exId, equip: src.equip, sets: v.sets, reps: v.reps }; }
      const g = goalFor(it.exId, it.equip, it.sets, it.reps), info = exInfo(it);
      const last = lastDone(it.exId, it.equip);
      const suggest = last ? Math.max(0, ...workingSets(last.e).map(x => x.weight)) : 0;
      state.goalEdit = { ...it, name: info.name, muscle: info.muscle, unit: eqUnits(it.equip), weight: g ?? suggest };
      state.modal = 'goal'; break;
    }
    case 'goal-adj': state.goalEdit.weight = Math.max(0, Math.round((state.goalEdit.weight + +d.d) * 100) / 100); break;
    case 'close-goal': state.modal = null; break;
    case 'save-goal': {
      const g = state.goalEdit;
      setGoal(g.exId, g.equip, g.sets, g.reps, g.weight);
      syncAllGoals(); state.modal = null; toast('Overload goal saved'); break;
    }
    case 'session-tracker': { const it = cur(); state.tracker = { exId: it.exId, equip: it.equip, range: 'All', volume: { sets: it.goal.sets, reps: it.goal.reps } }; go('tracker'); break; }
    case 'log-tracker': {
      const ls = db.sessions.find(x => x.id === state.log.sid), le = ls.exercises[+d.ei];
      state.tracker = { exId: le.exId, equip: le.equip, range: 'All', volume: { sets: le.goal.sets, reps: le.goal.reps } };
      go('tracker'); break;
    }
    case 'open-exhistory': state.exHistory = d.id; go('exhistory'); break;
    case 'view-session': state.log = { sid: d.id, mode: 'view' }; go('log'); break;
    case 'share-session': { const ls = db.sessions.find(x => x.id === state.log.sid); if (ls) shareSession(ls); return false; }
    case 'session-menu': {
      const ls = db.sessions.find(x => x.id === state.log.sid);
      menu({ title: ls.workoutName, sub: D.long(new Date(ls.finishedAt)), items: [
        { label: 'Share Workout', icon: I.share, run: () => shareSession(ls) },
        { label: 'Delete From History', icon: I.trash24, danger: true, run: () => confirm({ title: 'Delete workout?', danger: true, label: 'Delete',
          text: 'This workout’s sets will be removed from your history, and your overload goals will be recalculated without it.',
          run: () => { db.sessions.splice(db.sessions.indexOf(ls), 1); back(); toast('Workout deleted'); } }) },
      ] });
      break;
    }

    /* ---------------- plans ---------------- */
    case 'home-go': {
      const to = d.to;
      if (to === 'planwiz') { openPlanWizard(false); break; }
      if (to === 'exercises') { resetPicker(); ex.muscles = []; ex.equipment = []; }
      go(to); break;
    }
    case 'plan-menu':
      menu({ title: db.plan.name, items: [
        { label: 'Edit Plan', icon: I.editPen, run: () => openPlanWizard(true) },
        { label: 'End Plan', icon: I.trash24, danger: true, run: () => confirm({ title: 'End this plan?', danger: true, label: 'End Plan',
          text: 'Your plan is removed from the home screen. Your workouts and history stay.', run: () => { db.plan = null; } }) },
      ] });
      break;
    case 'plan-next': {
      const w = state.planwiz; w.err = null;
      if (w.step === 1 && !w.name.trim()) { w.err = 'Give your plan a name.'; break; }
      if (w.step === 3) {
        const days = w.days.slice(0, w.splitDays);
        if (days.some(x => x.type === 'empty' || (x.type === 'workout' && !db.workouts.some(k => k.id === x.workoutId)))) { w.err = 'Pick a workout or rest for every day.'; break; }
        if (!days.some(x => x.type === 'workout')) { w.err = 'Add at least one workout day.'; break; }
      }
      if (w.step === 4 && w.end < w.start) { w.err = 'The end date needs to be after the start date.'; break; }
      if (w.step < 5) { w.step++; break; }
      db.plan = { name: w.name.trim(), splitDays: w.splitDays, days: w.days.slice(0, w.splitDays), start: w.start, end: w.end };
      home(); toast(w.editing ? 'Plan updated' : 'Plan saved'); break;
    }
    case 'plan-prev': state.planwiz.err = null; state.planwiz.step = Math.max(1, state.planwiz.step - 1); break;
    case 'plan-headback': if (state.planwiz.step > 1) { state.planwiz.err = null; state.planwiz.step--; } else back(); break;
    case 'plan-edit': state.planwiz.step = +d.step; break;
    case 'plan-quickname': state.planwiz.name = d.name; state.planwiz.err = null; break;
    case 'plan-split': state.planwiz.splitDays = Math.min(10, Math.max(1, state.planwiz.splitDays + +d.dir)); break;
    case 'plan-pickday': state.planwiz.pickDay = +d.i; go('assignday'); break;
    case 'plan-assign': {
      const w = state.planwiz;
      w.days[w.pickDay] = d.type === 'rest' ? { type: 'rest' } : { type: 'workout', workoutId: d.id };
      w.pickDay = null; w.err = null; back(); break;
    }
    case 'plan-pickfield': { const w = state.planwiz; w.pick = d.k; w.month = (d.k === 'start' ? w.start : w.end).slice(0, 7); break; }
    case 'plan-month': {
      const w = state.planwiz, [y, m] = w.month.split('-').map(Number), dt = new Date(y, m - 1 + +d.dir, 1);
      w.month = dayKey(dt).slice(0, 7); break;
    }
    case 'plan-date': {
      const w = state.planwiz, k = d.day; w.err = null;
      if (w.pick === 'start' || k < w.start) {
        w.start = k;
        if (w.end < k || w.pick === 'start') w.end = w.end >= k ? w.end : addDays(k, w.splitDays * 4 - 1);
        w.pick = 'end';
      } else w.end = k;
      w.month = k.slice(0, 7); break;
    }

    /* ---------------- exercise detail ---------------- */
    case 'edit-exercise': {
      const x = exById(state.exDetail), muscles = [...UPPER_BODY, ...LOWER_BODY];
      const capw = v => v.charAt(0).toUpperCase() + v.slice(1);
      freshExWizard({ editId: x.id, name: x.name, primary: x.muscle,
        secondary: (x.secondary || []).map(capw).filter(v => muscles.includes(v) && v !== x.muscle),
        equipment: x.equipment.filter(k => EQ_TYPES.includes(k)), saved: x.equipment.filter(k => k.startsWith('eq:')), photo: x.photo || null });
      go('exwiz'); break;
    }
    case 'exwiz-next': {
      const w = state.exwiz; w.err = null;
      if (w.step === 1) {
        if (!w.name.trim()) { w.err = 'Give the exercise a name.'; break; }
      }
      if (w.step === 2) {
        if (!w.primary) { w.err = 'Pick the main muscle this works.'; break; }
        const dup = EXERCISES.find(x => x.id !== w.editId && x.name.toLowerCase() === w.name.trim().toLowerCase() && x.muscle === w.primary);
        if (dup) { w.err = `You already have ${dup.name} (${dup.muscle}). Use a different name, or go back and use that one.`; break; }
      }
      if (w.step === 4 && !w.equipment.length && !w.saved.length) { w.err = 'Pick at least one kind of equipment.'; break; }
      if (w.step < 5) { w.step++; break; }
      const abbr = { Chest: 'CH', Shoulders: 'SH', Back: 'BK', Biceps: 'BI', Triceps: 'TR', Forearms: 'FO', Abs: 'AB', Quads: 'QU', Hamstrings: 'HA', Glutes: 'GL', Calves: 'CA' }[w.primary] || w.primary.slice(0, 2).toUpperCase();
      const fields = { name: w.name.trim(), muscle: w.primary, abbr, equipment: [...w.equipment, ...w.saved], secondary: w.secondary.map(v => v.toLowerCase()), photo: w.photo || null };
      if (w.editId) {
        const x = exById(w.editId); Object.assign(x, fields);
        for (const wk of db.workouts) for (const it of wk.exercises) if (it.exId === x.id) { it.name = x.name; it.muscle = x.muscle; }
        back(); toast('Exercise saved'); break;
      }
      const x = { id: uid('c:'), custom: true, ...fields };
      EXERCISES.unshift(x);
      back();
      if (w.addTo) addToCtx(x.id); else toast('Exercise created');
      break;
    }
    case 'exwiz-prev': state.exwiz.err = null; state.exwiz.step = Math.max(1, state.exwiz.step - 1); break;
    case 'exwiz-headback': if (state.exwiz.step > 1) { state.exwiz.err = null; state.exwiz.step--; } else back(); break;
    case 'exwiz-primary': state.exwiz.primary = d.name; state.exwiz.secondary = state.exwiz.secondary.filter(m => m !== d.name); state.exwiz.err = null; break;
    case 'exwiz-secondary': toggleIn(state.exwiz.secondary, d.name); break;
    case 'exwiz-equip': toggleIn(state.exwiz.equipment, d.name); state.exwiz.err = null; break;
    case 'exwiz-saved': toggleIn(state.exwiz.saved, d.ref); state.exwiz.err = null; break;
    case 'exwiz-addequip': freshEqWizard('exwiz'); go('eqwiz'); break;
    case 'delete-exercise': {
      const x = exById(state.exDetail);
      confirm({ title: 'Delete exercise?', danger: true, label: 'Delete',
        text: `${esc(x.name)} will be removed from your library and your saved workouts. Workouts you’ve already logged keep their sets.`,
        run: () => {
          EXERCISES.splice(EXERCISES.indexOf(x), 1);
          for (const w of db.workouts) w.exercises = w.exercises.filter(it => it.exId !== x.id);
          back(); toast('Exercise deleted');
        } });
      break;
    }
    case 'merge-exercise': state.merge = { q: '' }; go('mergeex'); break;
    case 'merge-pick-ex': {
      const from = exById(state.exDetail), to = exById(d.id);
      confirm({ title: 'Merge exercises?', label: 'Merge',
        text: `${esc(from.name)} will be merged into ${esc(to.name)}. Its logged history and goals move over, and ${esc(from.name)} is removed from your library.`,
        run: () => {
          to.equipment = [...new Set([...to.equipment, ...from.equipment])];
          to.secondary = [...new Set([...(to.secondary || []), ...(from.secondary || [])])];
          if (!to.photo && from.photo) to.photo = from.photo;
          const mv = it => { if (it.exId === from.id) { it.exId = to.id; it.name = to.name; it.muscle = to.muscle; } };
          db.sessions.forEach(x => x.exercises.forEach(mv));
          db.workouts.forEach(x => x.exercises.forEach(mv));
          if (state.session) state.session.exercises.forEach(mv);
          for (const g of db.goalEdits) if (g.key.startsWith(from.id + '|')) g.key = to.id + g.key.slice(from.id.length);
          EXERCISES.splice(EXERCISES.indexOf(from), 1);
          state.exDetail = to.id; state.stack.pop(); state.screen = 'exdetail'; syncAllGoals();
        } });
      break;
    }

    /* ---------------- equipment ---------------- */
    case 'open-equipment-detail': state.eqDetail = d.id; go('eqdetail'); break;
    case 'eq-create': freshEqWizard('equipment'); go('eqwiz'); break;
    case 'xd-add-equipment': freshEqWizard('exdetail'); go('eqwiz'); break;
    case 'swap-add': freshEqWizard('swap'); go('eqwiz'); break;
    case 'edit-equipment': {
      const sv = db.equipment.find(x => x.id === state.eqDetail);
      state.eqwiz = { step: 1, editId: sv.id, location: sv.location, name: sv.name, units: sv.units, photo: sv.photo, returnTo: 'eqdetail' };
      go('eqwiz'); break;
    }
    case 'eq-units': { const sv = db.equipment.find(x => x.id === state.eqDetail); sv.units = d.unit; syncAllGoals(); break; }
    case 'eqwiz-next': {
      const w = state.eqwiz; w.err = null;
      if (w.step === 1 && !db.locations.includes(w.location)) { w.err = 'Pick where this equipment is.'; break; }
      if (w.step === 2) {
        const name = w.name.trim();
        if (!name) { w.err = 'Give the equipment a name.'; break; }
        if (db.equipment.some(x => x.id !== w.editId && x.location === w.location && x.name.toLowerCase() === name.toLowerCase())) { w.err = `There’s already a ${name} at ${w.location}.`; break; }
      }
      if (w.step < 4) { w.step++; break; }
      const rec = { name: w.name.trim(), location: w.location, units: w.units, photo: w.photo || null };
      if (w.editId) { Object.assign(db.equipment.find(x => x.id === w.editId), rec); back(); syncAllGoals(); toast('Equipment saved'); break; }
      const sv = { id: uid('e'), ...rec }; db.equipment.push(sv);
      const ref = 'eq:' + sv.id;
      back();
      if (w.returnTo === 'exwiz') { if (!state.exwiz.saved.includes(ref)) state.exwiz.saved.push(ref); }
      else if (w.returnTo === 'exdetail') { const x = exById(state.exDetail); if (x && !x.equipment.includes(ref)) x.equipment.push(ref); }
      else if (w.returnTo === 'swap') return handle('swap-pick', { ref }, el, ex);
      toast('Equipment saved'); break;
    }
    case 'eqwiz-prev': state.eqwiz.err = null; state.eqwiz.step = Math.max(1, state.eqwiz.step - 1); break;
    case 'eqwiz-headback': if (state.eqwiz.step > 1) { state.eqwiz.err = null; state.eqwiz.step--; } else back(); break;
    case 'eqwiz-location': state.eqwiz.location = d.name; state.eqwiz.err = null; break;
    case 'eqwiz-units': state.eqwiz.units = d.name; break;
    case 'eqwiz-addloc': state.newLoc = { name: '', target: 'eqwiz' }; go('newloc'); break;
    case 'open-swap': state.swap = { owner: d.owner || listCtx().owner, index: +d.i || 0 }; go('swap'); break;
    case 'swap-pick': {
      const ref = d.ref, sw = state.swap;
      if (sw.owner === 'tracker') { state.tracker.equip = ref; state.tracker.volume = defaultVolume(state.tracker.exId, ref); }
      else { const it = swapTarget(); it.equip = ref; if (it.goal) syncGoal(it); }
      back(); break;
    }
    case 'delete-equipment': {
      const sv = db.equipment.find(x => x.id === state.eqDetail), ref = 'eq:' + sv.id;
      confirm({ title: 'Delete equipment?', danger: true, label: 'Delete',
        text: `${esc(sv.name)} at ${esc(sv.location)} will be removed. Workouts using it switch to generic equipment. Logged workouts keep their sets.`,
        run: () => { replaceRef(ref, e => genericFor(e, sv)); db.equipment.splice(db.equipment.indexOf(sv), 1); back(); toast('Equipment deleted'); } });
      break;
    }
    case 'merge-equipment': go('mergeeq'); break;
    case 'merge-pick-eq': {
      const A = db.equipment.find(x => x.id === state.eqDetail), B = db.equipment.find(x => x.id === d.id);
      confirm({ title: 'Merge equipment?', label: 'Merge',
        text: `${esc(A.name)} at ${esc(A.location)} will be merged into ${esc(B.name)} at ${esc(B.location)}. Its goals and history move over, and ${esc(A.name)} is removed.`,
        run: () => {
          const from = 'eq:' + A.id, to = 'eq:' + B.id;
          for (const x of EXERCISES) if (x.equipment.includes(from) && !x.equipment.includes(to)) x.equipment.push(to);
          replaceRef(from, () => to, { history: to });
          if (!B.photo && A.photo) B.photo = A.photo;
          db.equipment.splice(db.equipment.indexOf(A), 1);
          state.eqDetail = B.id; state.stack.pop(); state.screen = 'eqdetail';
        } });
      break;
    }

    /* ---------------- locations ---------------- */
    case 'open-location': state.locPick = { target: d.target }; state.modal = 'location'; break;
    case 'close-location': state.modal = null; break;
    case 'pick-location': setLocation(state.locPick.target, d.name); state.modal = null; break;
    case 'add-location': state.newLoc = { name: '', target: state.locPick.target }; go('newloc'); break;
    case 'save-location': {
      const n = state.newLoc, name = n.name.trim();
      if (!name) { n.err = 'Type a name for this location.'; break; }
      const existing = db.locations.find(l => l.toLowerCase() === name.toLowerCase());
      if (!existing) db.locations.push(name);
      setLocation(n.target, existing || name);
      back(); break;
    }

    /* ---------------- confirm ---------------- */
    case 'confirm-no': state.modal = null; state.confirm = null; break;
    case 'confirm-yes': { const run = state.confirm.run; state.modal = null; state.confirm = null; run(); break; }

    /* ---------------- settings ---------------- */
    case 'set-units': db.settings.units = d.unit; syncAllGoals(); break;
    case 'export-data': {
      const blob = new Blob([exportData()], { type: 'application/json' });
      const name = `failup-backup-${dayKey()}.json`, file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'FailUp backup' }).catch(() => {});
      else downloadBlob(blob, name);
      return false;
    }
    case 'clear-data':
      confirm({ title: 'Clear exercise data?', danger: true, label: 'Clear', text: 'This deletes every logged workout and overload goal. Your workouts, exercises, and equipment stay. Back up first if you might want it later.',
        run: () => { clearExerciseData(); home(); toast('Exercise data cleared'); } });
      break;
    case 'reset-app':
      confirm({ title: 'Reset FailUp?', danger: true, label: 'Reset', text: 'Everything goes back to the starter workouts. Logged workouts, goals, custom exercises, equipment, and plans are deleted.',
        run: () => { resetAll(); home(); toast('FailUp was reset'); } });
      break;

    /* ---------------- back ---------------- */
    case 'back': {
      const scr = state.screen;
      if (scr === 'exercises' && ex.mode !== 'browse') { const c = ex.mode === 'add' ? listCtx() : null; if (c) c.ui.swapIndex = null; resetPicker(); }
      if (scr === 'lineup' && s && !s.started) state.session = null;
      if (scr === 'complete') { home(); break; }
      if (scr === 'assignday') state.planwiz.pickDay = null;
      if (scr === 'create') state.create.err = null;
      back(); break;
    }
    default: return false;
  }
}

/* ---- "How did it feel?" slider: drag the white thumb; its number counts 1–9, then F ---- */
let feelDrag = null;
function feelFromPointer(bar, x) {
  const r = bar.getBoundingClientRect(), inset = 4 + 28;      // 4px gap + half the 56px thumb
  return Math.min(1, Math.max(0, (x - r.left - inset) / (r.width - inset * 2)));
}
function paintFeel(bar, feel) {
  const th = bar.querySelector('.ff-thumb');
  th.style.left = `calc(4px + (100% - 64px) * ${feel.toFixed(4)})`;
  th.querySelector('.ff-num').textContent = rpeNum(feel);
  bar.querySelector('.ff-text').textContent = rpeOf(feel) === 'F' ? 'FAILURE' : '';
}
device.addEventListener('pointerdown', (e) => {
  const bar = e.target.closest('[data-feelbar]');
  if (!bar || !state.setDraft) return;
  e.preventDefault();
  feelDrag = bar;
  try { bar.setPointerCapture(e.pointerId); } catch {}
  state.setDraft.feel = feelFromPointer(bar, e.clientX); state.setDraft.touched = true;
  paintFeel(bar, state.setDraft.feel);
});
device.addEventListener('pointermove', (e) => {
  if (!feelDrag || !state.setDraft) return;
  state.setDraft.feel = feelFromPointer(feelDrag, e.clientX);
  paintFeel(feelDrag, state.setDraft.feel);
});
const endFeel = () => { if (feelDrag) { feelDrag = null; render(); } };
device.addEventListener('pointerup', endFeel);
device.addEventListener('pointercancel', endFeel);

/* ---- text inputs (update state without re-rendering, so focus survives) ---- */
device.addEventListener('input', (e) => {
  const t = e.target;
  if (t.matches('[data-search]')) { state.exercises.search = t.value; const l = document.getElementById('ex-list'); if (l) l.innerHTML = exListInner(); return; }
  if (t.matches('[data-exwizname]')) { state.exwiz.name = t.value; return; }
  if (t.matches('[data-eqwizname]')) { state.eqwiz.name = t.value; return; }
  if (t.matches('[data-newloc]')) { state.newLoc.name = t.value; return; }
  if (t.matches('[data-planwizname]')) { state.planwiz.name = t.value; return; }
  if (t.matches('[data-cwname]')) { state.create.name = t.value; if (state.create.err) { state.create.err = null; const er = t.closest('.cw-body').querySelector('.wiz-err'); if (er) er.remove(); } return; }
  if (t.matches('[data-mergesearch]')) { state.merge.q = t.value; const l = document.getElementById('merge-list'); if (l) l.innerHTML = mergeExList(); return; }
  if (t.matches('[data-swfield]')) {
    const v = parseFloat(t.value.replace(',', '.'));
    if (!isNaN(v) && v >= 0) state.setDraft[t.dataset.swfield] = t.dataset.swfield === 'reps' ? Math.max(1, Math.round(v)) : v;
    if (t.dataset.swfield === 'weight') t.style.width = (Math.max(1, t.value.length) + 0.3) + 'ch';
    return;
  }
  if (t.matches('[data-goalaskfield]')) { const v = parseFloat(t.value.replace(',', '.')); if (!isNaN(v) && v >= 0) state.goalAsk.weight = v; return; }
  if (t.matches('[data-goalfield]')) { const v = parseFloat(t.value.replace(',', '.')); if (!isNaN(v) && v >= 0) state.goalEdit.weight = v; }
});
// Enter in a text field moves forward
device.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.matches('input')) return;
  const next = document.querySelector('[data-action="exwiz-next"],[data-action="eqwiz-next"],[data-action="plan-next"],[data-action="save-location"]');
  if (e.target.matches('.sw-in,[data-goalfield],[data-goalaskfield]')) { e.target.blur(); render(); return; }
  if (next) { e.preventDefault(); next.click(); }
});
device.addEventListener('focusin', (e) => { if (e.target.matches('.sw-in')) e.target.select(); });

// Photos from the native picker, and backup files.
device.addEventListener('change', (e) => {
  const imp = e.target.closest('input[data-import]');
  if (imp && imp.files && imp.files[0]) {
    imp.files[0].text().then(text => {
      confirm({ title: 'Restore backup?', danger: true, label: 'Restore', text: 'Everything on this device is replaced with the backup.',
        run: () => { try { importData(text); home(); toast('Backup restored'); } catch (err) { toast(err.message || 'That file couldn’t be read.'); } } });
      render();
    });
    imp.value = '';
    return;
  }
  const inp = e.target.closest('input[data-photo]');
  if (!inp || !inp.files || !inp.files[0]) return;
  readPhoto(inp.files[0], (url) => {
    const ref = putPhoto(url), t = inp.dataset.photo;
    if (t === 'exercise') exById(state.exDetail).photo = ref;
    else if (t === 'equipment') db.equipment.find(x => x.id === state.eqDetail).photo = ref;
    else if (t === 'exwiz') state.exwiz.photo = ref;
    else if (t === 'eqwiz') state.eqwiz.photo = ref;
    render();
  });
});
function readPhoto(file, done) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      done(c.toDataURL('image/jpeg', 0.85));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ---- dev: open a screen directly via #hash ---- */
function applyHash() {
  const h = location.hash.replace('#', '');
  if (['home', 'quickselect', 'workouts', 'exercises', 'equipment', 'settings'].includes(h)) { home(); if (h !== 'home') go(h); }
  else if (h === 'session' && state.session) { state.stack = ['home']; state.screen = state.session.started ? 'session' : 'lineup'; }
}
window.addEventListener('hashchange', () => { applyHash(); render(); });
window.__failup = { db, state, render };   // handy for debugging in the console

/* ---- boot ---- */
load();
loadPhotos().finally(() => { applyHash(); render(); });
