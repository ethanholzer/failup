// ============================================================================
// FailUp — app shell
// Screens are pure functions of state that return HTML strings. render() swaps
// #app.innerHTML, a single delegated click handler runs actions, and every
// render saves the store. Maps to React as: Screen → component, data-action →
// onClick, `state` → UI store, `db` (store.js) → persisted store.
// ============================================================================
import { state, WORKOUT_COLORS, PURPLE } from './data.js';
import { I, fmt, esc, wt, wtTight, eqName, D, WORKOUT_ICONS } from './ui.js';
import {
  db, load, save, loadPhotos, putPhoto, EXERCISES, exById, uid, GENERIC, eqById, eqLabel, eqUnits, eqType, increment,
  goalFor, goalKey, setGoal, derived, isFail, lastDone, dayKey, addDays, parseDay, daysBetween, genericOf,
  exportData, importData, clearExerciseData, resetAll, isBodyweight,
 volumeDots,
} from './store.js';
import {
  TrackerScreen, VolumeModal, ExercisesScreen, FilterSheet, exListInner, ColorPickerSheet, IconPickerSheet,
  ExerciseWizard, EquipmentWizard, ExerciseDetailScreen, ExerciseHistoryScreen, EquipmentListScreen, EquipmentDetailScreen,
  EquipmentSwapScreen, EquipmentSwapSheet, PrefTypeSheet, LocationSheet, NewLocationScreen, ConfirmSheet, MenuSheet, mergeExList, MergeExerciseScreen,
  MergeEquipmentScreen, SettingsScreen, EQ_TYPES, defaultRef,
} from './screens-library.js';
import { HomeScreen, HowItWorksScreen, GoalsScreen, FEEL_SEGS, RPE_NOTES, rpeLabel } from './screens-home.js';
import {
  QuickSelectScreen, WorkoutsScreen, AssignDayScreen, CreateWorkoutScreen, LineupScreen, WorkoutDetailsScreen,
  WorkoutSessionScreen, ActiveSetSheet, OverloadGoalSheet, UpdateGoalSheet, GoalAskSheet, PauseSheet, SessionLogScreen, PlanWizard,
  listCtx, keepCurrentExercise, vol, exInfo, workingSets, pendingSuggestion, nextTarget, rpeOf, rpeNum, setPurple, sessionStats,
} from './screens-workout.js';
import { UPPER_BODY, LOWER_BODY, LINKS } from './data.js';

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
const COPY_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></svg>';
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2600);
}

const SCREENS = {
  home: HomeScreen, quickselect: QuickSelectScreen, session: WorkoutSessionScreen, create: CreateWorkoutScreen,
  exwiz: ExerciseWizard, eqwiz: EquipmentWizard, planwiz: PlanWizard, exercises: ExercisesScreen, tracker: TrackerScreen,
  workouts: WorkoutsScreen, assignday: AssignDayScreen, lineup: LineupScreen, exdetail: ExerciseDetailScreen,
  exhistory: ExerciseHistoryScreen, equipment: EquipmentListScreen, eqdetail: EquipmentDetailScreen,
  swap: () => EquipmentSwapScreen(swapRef(), swapExId()), details: WorkoutDetailsScreen, newloc: NewLocationScreen,
  mergeex: MergeExerciseScreen, mergeeq: MergeEquipmentScreen, complete: SessionLogScreen, log: SessionLogScreen,
  settings: SettingsScreen, howto: HowItWorksScreen, goals: GoalsScreen,
};
const MODALS = {
  volume: VolumeModal, muscle: () => FilterSheet('muscle'), equipment: () => FilterSheet('equipment'),
  color: ColorPickerSheet, icon: IconPickerSheet, setwidget: ActiveSetSheet, goal: OverloadGoalSheet,
  swap: () => EquipmentSwapSheet(swapRef(), swapExId(), swapLocation()), preftype: PrefTypeSheet, updategoal: UpdateGoalSheet, goalask: GoalAskSheet, location: LocationSheet, confirm: ConfirmSheet, pause: PauseSheet, menu: MenuSheet,
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
  let oldCard = null, oldRect = null;
  if (pipFrom != null && state.session && state.session.exIndex !== pipFrom) {
    const c = app.querySelector('.sess-excard');
    if (c) { oldRect = c.getBoundingClientRect(); oldCard = c.cloneNode(true); }
  }
  if (state.pending && (!state.session || !['lineup', 'session', 'exercises', 'swap', 'eqwiz', 'newloc', 'exdetail'].includes(state.screen))) state.pending = null;   // leaving keeps your changes
  app.innerHTML = screenHTML();
  if (oldCard) slideExerciseCard(oldCard, oldRect, state.session.exIndex > pipFrom ? 1 : -1);
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
  fitExNames();
  mountGoalLottie();
  homeHeaderIcons();
  slideInCards();
  planCardFlair();
  revealAdded();
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
// Live workout exercise name: full size up to two lines; past that, a smaller size;
// still past two lines, the smaller size truncated at two lines.
function fitExNames() {
  for (const el of app.querySelectorAll('.sess-exrow .sess-exname')) {
    el.classList.remove('fit-sm', 'fit-clamp');
    const twoLines = () => el.scrollHeight <= parseFloat(getComputedStyle(el).lineHeight) * 2 + 1;
    if (twoLines()) continue;
    el.classList.add('fit-sm');
    if (!twoLines()) el.classList.add('fit-clamp');
  }
}
addEventListener('resize', () => fitExNames());

// Share FailUp: the App Store link once there is one, otherwise the website.
async function shareApp() {
  const url = LINKS.appStore || LINKS.site;
  const data = { title: 'FailUp', text: 'I track my lifts with FailUp. Free, no subscription. Try it:', url };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast(url); }
}

// Home: the Workouts / Exercises / Equipment buttons move into the header once they scroll away.
function homeHeaderIcons() {
  const root = app.querySelector(':scope > .hm2'); if (!root) return;
  const head = root.querySelector('.hm2-head'), nav = root.querySelector('.hm2-nav');
  if (!head || !nav) return;
  const up = nav.getBoundingClientRect().bottom < head.getBoundingClientRect().bottom + 4;
  if (root.classList.contains('icons-up') === up) return;
  root.classList.toggle('icons-up', up);
  for (const b of head.querySelectorAll('.hm2-ibtn.mini')) { b.tabIndex = up ? 0 : -1; b.setAttribute('aria-hidden', String(!up)); }
}
app.addEventListener('scroll', homeHeaderIcons, { passive: true });

// How FailUp Works: each card slides in from the right as it scrolls into view.
let slideIO = null;
// Back from the picker: center the exercise you just added and slide it in from the right.
function revealAdded() {
  const j = state.justAdded;
  if (!j || state.screen !== j.screen) return;
  state.justAdded = null;
  const card = app.querySelectorAll('.cw-ex-card')[j.index];
  if (!card) return;
  const r = card.getBoundingClientRect(), a = app.getBoundingClientRect();
  app.scrollTop += (r.top - a.top) - (a.height - r.height) / 2;
  if (!reduceMotion()) card.animate([{ transform: 'translateX(110%)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: 160, easing: 'cubic-bezier(.16,.84,.3,1)', fill: 'backwards' });
}
// Home plan card: the progress bar fills from empty and the two stats count up,
// each time you land on home (load, refresh, or coming back), not on every re-render there.
let homeShown = false;
function planCardFlair() {
  const onHome = state.screen === 'home' && !state.modal;
  const card = onHome && app.querySelector('.hm2-plan');
  if (!onHome) { if (state.screen !== 'home') homeShown = false; return; }
  if (homeShown || !card) return;
  homeShown = true;
  if (reduceMotion()) return;
  const bar = card.querySelector('.hm2-progbar > span');
  if (bar) { const w = bar.style.width; bar.style.transition = 'none'; bar.style.width = '0%'; bar.getBoundingClientRect();
    bar.style.transition = 'width 1.1s cubic-bezier(.22,.8,.3,1) .15s'; bar.style.width = w; }
  const pct = card.querySelector('.hm2-progtop .tnum'), target = pct ? parseInt(pct.textContent, 10) || 0 : 0;
  const nums = [...card.querySelectorAll('.hm2-statnum')].map(el => ({ el, to: parseInt(el.textContent, 10) || 0 }));
  if (pct) nums.push({ el: pct, to: target, suffix: '%' });
  const t0 = performance.now() + 150, dur = 1100, ease = t => 1 - Math.pow(1 - t, 3);
  nums.forEach(n => { n.el.textContent = '0' + (n.suffix || ''); });
  const tick = now => {
    const t = Math.min(1, Math.max(0, (now - t0) / dur));
    nums.forEach(n => { if (n.el.isConnected) n.el.textContent = Math.round(ease(t) * n.to) + (n.suffix || ''); });
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function slideInCards() {
  if (slideIO) { slideIO.disconnect(); slideIO = null; }
  const cards = app.querySelectorAll('.hw-screen .hw-sec, .hw-screen .hw-step');
  if (!cards.length || reduceMotion() || !('IntersectionObserver' in window)) return;
  slideIO = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); slideIO.unobserve(en.target); }
  }, { root: app, threshold: 0.15 });
  cards.forEach(c => { c.classList.add('hw-slide'); slideIO.observe(c); });
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
// Moving between exercises: the old card slides off and the new one slides in from the side you're heading to.
function slideExerciseCard(old, rect, dir) {
  const card = app.querySelector('.sess-excard');
  if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = card.parentElement, hr = host.getBoundingClientRect();
  old.removeAttribute('data-anim'); old.setAttribute('aria-hidden', 'true'); old.classList.add('sess-excard-ghost');
  Object.assign(old.style, { position: 'absolute', left: `${rect.left - hr.left}px`, top: `${rect.top - hr.top}px`, width: `${rect.width}px`, margin: '0', pointerEvents: 'none', zIndex: 3 });
  host.appendChild(old);
  // carousel: both cards travel the same distance together, a gap apart, so they never overlap
  const off = d => `translateX(calc(${d} * (100% + 24px)))`, opts = { duration: 460, easing: 'cubic-bezier(.65,0,.25,1)' };
  old.animate([{ transform: off(0) }, { transform: off(-dir) }], { ...opts, fill: 'forwards' }).onfinish = () => old.remove();
  card.animate([{ transform: off(dir) }, { transform: off(0) }], opts);
}
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

/* ---- start / finish surge: the workout color sweeps across, then purple; purple sweeps
   out, then the workout color, with the workout's icon big in the middle. The screen
   underneath changes while it's fully covered. ---- */
let surgeUntil = 0, surging = false;
function surge(color, icon, swap) {
  if (surging) return;
  if (reduceMotion()) { swap(); return; }
  surging = true;
  const T = { in1: 0, in2: 300, cover: 700, out2: 1020, out1: 1200, dur: 430, end: 1700 };
  surgeUntil = Date.now() + T.end;
  const layer = document.createElement('div');
  layer.className = 'surge';
  layer.innerHTML = `<div class="surge-band" style="background:${color}"></div><div class="surge-band purple"></div>
    <div class="surge-icon">${WORKOUT_ICONS[icon] || WORKOUT_ICONS.kick}</div>`;
  device.appendChild(layer);
  const [c, pu] = layer.querySelectorAll('.surge-band'), ic = layer.querySelector('.surge-icon');
  const IN = 'cubic-bezier(.7,0,.3,1)';
  const sweep = (el, from, to, delay) => el.animate([{ transform: `translateX(${from}) skewX(-14deg)` }, { transform: `translateX(${to}) skewX(-14deg)` }],
    { duration: T.dur, delay, easing: IN, fill: 'both' });
  sweep(c, '-130%', '0%', T.in1);
  sweep(pu, '-130%', '0%', T.in2);
  sweep(pu, '0%', '130%', T.out2);
  const last = sweep(c, '0%', '130%', T.out1);
  ic.animate([
    { opacity: 0, transform: 'translate(-50%,-50%) scale(.4) rotate(-12deg)' },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1.08) rotate(0)', offset: .22 },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .32 },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .72 },
    { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)' },
  ], { duration: T.end - 120, delay: 120, easing: 'ease-out', fill: 'both' });
  setTimeout(swap, T.cover);
  last.onfinish = () => { layer.remove(); surging = false; };
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
// First goal ever: a small purple check (lighter than the Workout Complete one), played once per prompt.
let goalLottie = null, goalLottieData = null;
function mountGoalLottie() {
  if (goalLottie) { goalLottie.destroy(); goalLottie = null; }
  const el = document.querySelector('[data-goal-lottie]'), g = state.goalAsk;
  if (!el || !window.lottie || !g) return;
  const play = data => {
    if (!el.isConnected) return;
    const anim = goalLottie = window.lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, animationData: data });
    if (g.played || matchMedia('(prefers-reduced-motion: reduce)').matches) anim.goToAndStop(anim.totalFrames - 1, true);
    else { g.played = true; setTimeout(() => anim.play(), 180); }
  };
  if (goalLottieData) play(goalLottieData);
  else fetch('./assets/goal-check.json').then(r => r.json()).then(d => { goalLottieData = d; play(d); }).catch(() => {});
}
function mountLottie() {
  if (lottieAnim) { lottieAnim.destroy(); lottieAnim = null; }
  const el = app.querySelector('[data-lottie]');
  if (!el || !window.lottie) return;
  const play = data => {
    const anim = lottieAnim = window.lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, animationData: data });
    const still = lottiePlayed === state.log.sid || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) anim.goToAndStop(anim.totalFrames - 1, true);
    else {
      lottiePlayed = state.log.sid;
      const wait = Math.max(0, surgeUntil - Date.now());   // let the start/finish surge clear first
      setTimeout(() => { anim.play(); slideInStats(); }, wait);
    }
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
    location: db.settings.location || db.locations[0] || 'Home', started: false, exIndex: 0, expanded: false,
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
    exercises: done.map(e => ({ exId: e.exId, name: exInfo(e).name, muscle: exInfo(e).muscle, equip: e.equip, equipName: eqLabel(e.equip), goal: { ...e.goal }, newGoal: e.newGoal ?? null, newGoalVol: e.newGoalVol || null, sets: e.sets.map(x => ({ ...x })) })),
  };
  db.sessions.push(rec);
  // anything you said "Not now" to, or never got asked about (fewer sets, ended early), waits as a suggestion
  done.forEach((e, j) => {
    const a = e.declined || goalPrompt(e, true);
    if (a) keepSuggestion(e, a, rec.id, j);
  });
  state.session = null;
  state.log = { sid: rec.id, mode: 'complete' };
  state.stack = ['home']; state.screen = 'complete'; state.modal = null;
}
// Reopen a just-finished workout (Add More Exercises).
function reopenSession(sid) {
  const i = db.sessions.findIndex(x => x.id === sid);
  if (i < 0) return false;
  const [s] = db.sessions.splice(i, 1);
  db.suggestions = db.suggestions.filter(x => x.sid !== sid);   // they're recalculated when you finish again
  state.session = { ...s, started: true, expanded: false, exIndex: s.exercises.length - 1, finishedAt: undefined };
  syncAllGoals();
  return true;
}
// Set defaults: the last working set, the goal, or what you did last time.
function setDraft(type, si) {
  const s = state.session, e = cur(), u = eqUnits(e.equip), inc = increment(u);
  const working = workingSets(e), warm = e.sets.filter(x => x.type === 'warmup');
  const last = lastDone(e.exId, e.equip);
  const lastTop = last ? Math.max(0, ...workingSets(last.e).map(x => x.weight)) : null;
  const hint = type === 'working' ? (e.goal.weight != null
    ? { goal: true, title: `${wt(e.goal.weight, u)} × ${e.goal.reps} reps`, sub: 'Hit every rep, or go to failure.' }
    : { goal: false, title: 'No goal yet', sub: `Finish ${e.goal.sets} × ${e.goal.reps} and FailUp suggests one.` }) : null;
  if (si != null) {
    const st = e.sets[si];
    const num = st.type === 'working' ? working.indexOf(st) + 1 : 0;
    return { ...st, setNum: num, unit: u, edit: { si }, touched: st.rated !== false, hint, bw: isBodyweight(e.equip), equip: st.equip || e.equip };
  }
  if (type === 'warmup') {
    const base = warm.length ? warm[warm.length - 1].weight : e.goal.weight ?? lastTop;
    return { type, setNum: warm.length + 1, weight: warm.length ? base : base ? Math.round((base * 0.5) / inc) * inc : 0, reps: e.goal.reps + 2, feel: 0, unit: u, hint, bw: isBodyweight(e.equip), equip: e.equip };
  }
  const weight = working.length ? working[working.length - 1].weight : e.goal.weight ?? lastTop ?? 0;
  return { type, setNum: working.length + 1, weight, reps: e.goal.reps, feel: 0, unit: u, hint, bw: isBodyweight(e.equip), equip: e.equip };
}

// ---------------------------------------------------------------------------------------------
// Goal suggestions. Runs when the planned sets are done, or (leaving = true) when you move on or
// finish with fewer sets than planned, in which case the goal is for the volume you actually did.
//   completed set  = hit the target reps and not marked F
//   failed attempt = marked F, or short of the target reps (both count as failure)
//   anchor         = heaviest completed set rated RPE 6+ (an unrated set counts, but never raises)
// No goal yet at this volume:
//   A. every set completed at one weight → +1 increment (felt hard), "Too light?" picker (felt easy or
//      3+ extra reps on every set; the jump scales with how easy), or that weight (unrated)
//   B. an anchor → the anchor: do every set there (ramps, drop sets, your 135 / 155 F / 135 F bench)
//   C. no anchor, failed every set → picker one increment under the best attempt (form first)
//   D. no anchor, some failures → the best failed attempt's weight
//   E. no anchor, only easy completed sets → "Too light?" picker from the heaviest
// A goal already at this volume: failure moves it to that weight; a clean, hard sweep raises it.
// ---------------------------------------------------------------------------------------------
const setRpe = x => (x.rated === false ? null : isFail(x) ? 10 : Math.min(9, Math.floor(x.feel * 10) + 1));
function goalPrompt(e, leaving = false) {
  if (e.goalAsked && e.goalAsked >= workingSets(e).length) return null;   // already asked about these sets (more sets later asks again)
  const u = eqUnits(e.equip), inc = increment(u), R = e.goal.reps, bw = isBodyweight(e.equip);
  let w = workingSets(e).filter(x => (x.equip || e.equip) === e.equip);   // only sets on the equipment you ended on
  if (!w.length) return null;
  let S = e.goal.sets;
  if (w.length < S) { if (!leaving) return null; S = w.length; }
  w = w.slice(0, S);                                                       // extra sets never change the goal
  const ei = state.session.exercises.indexOf(e);
  const g = goalFor(e.exId, e.equip, S, R);
  const ok = W => bw || W > 0;
  const done = x => !isFail(x) && x.reps >= R;
  const failed = w.filter(x => !done(x));
  const lastFailNum = (() => { for (let i = w.length - 1; i >= 0; i--) if (!done(w[i])) return i + 1; return 0; })();
  const out = (kind, weight, extra = {}) => (ok(weight) ? { kind, weight, sets: S, reps: R, ei, first: !db.goalEdits.length, ...extra } : null);
  const show = x => wtTight(x, u);
  const jump = r => (r >= 6 ? 1 : r >= 4 ? 2 : 3);                          // how far "Too light?" starts

  if (g != null) {                                                         // a goal already exists at this volume
    const last = w[w.length - 1];
    if (!done(last)) return last.weight !== g ? out('set', last.weight, { reason: `You earned failure on set ${w.length}. ${show(last.weight)} is your new goal!` }) : null;
    if (failed.length) return null;
    const W = Math.min(...w.map(x => x.weight)), to = W + inc, r = w.map(setRpe);
    if (g >= to || r.some(x => x == null)) return null;
    if (r.every(x => x >= 7)) return out('raise', to, { from: W, reason: `You completed ${S}x${R} at ${show(W)}. Increase the weight to ${show(to)}!` });
    return out('pick', W + inc * jump(Math.min(...r)), { from: W, light: true, reason: `You cruised through ${show(W)}. Pick a heavier goal.` });
  }

  const ws = new Set(w.map(x => x.weight));
  if (!failed.length && ws.size === 1) {                                   // A
    const W = w[0].weight, r = w.map(setRpe);
    if (r.some(x => x == null)) return out('set', W, { nudge: true, reason: `You completed ${S}x${R} at ${show(W)}.` });
    if (w.every(x => x.reps >= R + 3)) return out('pick', W + inc * 2, { from: W, light: true, reason: `Every set flew past ${R} reps. Time to go heavier.` });
    const lo = Math.min(...r);
    if (lo <= 6) return out('pick', W + inc * jump(lo), { from: W, light: true, reason: `You cruised through ${show(W)}. Pick a heavier goal.` });
    return out('raise', W + inc, { from: W, reason: `You completed ${S}x${R} at ${show(W)}. Increase the weight to ${show(W + inc)}!` });
  }
  const anchors = w.filter(x => done(x) && (setRpe(x) == null || setRpe(x) >= 6));
  if (anchors.length) {                                                    // B
    const A = Math.max(...anchors.map(x => x.weight));
    return out('set', A, { reason: failed.length ? `You earned failure on set ${lastFailNum}. ${show(A)} is your new goal!` : `You hit ${R} reps at ${show(A)}. Now own every set there.` });
  }
  if (failed.length) {
    const best = [...failed].sort((a, b) => b.reps - a.reps || b.weight - a.weight)[0];
    if (failed.length === w.length)                                        // C
      return out('pick', bw ? best.weight - inc : Math.max(inc, best.weight - inc), { from: best.weight, heavy: true, reason: `You earned failure on every set. Drop to ${show(bw ? best.weight - inc : Math.max(inc, best.weight - inc))} and keep your form sharp.` });
    return out('set', best.weight, { reason: `You earned failure on set ${lastFailNum}. ${show(best.weight)} is your new goal!` });   // D
  }
  const top = Math.max(...w.map(x => x.weight)), lo = Math.min(...w.map(setRpe).filter(x => x != null), 6);
  return out('pick', top + inc * jump(lo), { from: top, light: true, reason: `You cruised through ${show(top)}. Pick a heavier goal.` });   // E
}
// Ask about the exercise you're leaving (fewer sets than planned still gets a goal for what you did).
function askOnLeave(it) {
  if (!it || state.modal) return;
  const a = goalPrompt(it, true);
  if (a) { it.goalAsked = workingSets(it).length; state.goalAsk = a; state.modal = 'goalask'; }
  return !!a;
}
// Turn a prompt into a waiting suggestion (shown on Workout Complete and the Overload Tracker).
function keepSuggestion(e, a, sid, ei) {
  const key = goalKey(e.exId, e.equip, a.sets, a.reps);
  db.suggestions = db.suggestions.filter(x => x.key !== key);
  db.suggestions.push({ key, exId: e.exId, equip: e.equip, sets: a.sets, reps: a.reps, weight: a.weight, reason: a.reason, sid, ei, at: new Date().toISOString() });
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
// the generic type a ref belongs to (a saved machine counts as its kind)
const prefTypeOf = ref => { const sv = eqById(ref); return genericOf(sv ? eqType(sv) : ref); };
function swapRef() { const t = swapTarget(); return t ? t.equip : state.tracker.equip; }
function swapExId() { const t = swapTarget(); return t ? t.exId : state.tracker.exId; }
const swapLocation = () => (['session', 'lineup'].includes(state.swap.owner) && state.session && state.session.location) || null;
// Changes to today's plan or the live workout (swaps, volume, order, adding or removing) are
// staged: a Nevermind / Save Changes tray slides up, and Nevermind puts everything back.
function beginChange(owner) {
  if (!state.session || state.pending || !['lineup', 'session'].includes(owner)) return;
  state.pending = { snap: JSON.stringify({ ex: state.session.exercises, loc: state.session.location, i: state.session.exIndex }) };
}
// Add an exercise from the picker to whatever opened it.
function addToCtx(id) {
  const ex = state.exercises, c = listCtx(ex.returnTo || 'create'), x = exById(id);
  if (!x) return;
  const ref = defaultRef(x);
  beginChange(c.owner);
  let item;
  if (c.owner === 'lineup') { item = sessionItem(x.id, ref); }
  else item = { exId: x.id, name: x.name, muscle: x.muscle, sets: 3, reps: 8, equip: prefTypeOf(ref) };
  if (c.ui.swapIndex != null) {
    const old = c.items[c.ui.swapIndex], ov = vol(old);
    Object.assign(vol(item), { sets: ov.sets, reps: ov.reps });
    if (c.owner === 'lineup' && old.sets.length) { c.items.splice(c.ui.swapIndex + 1, 0, item); c.ui.expanded = c.ui.swapIndex + 1; }
    else { keepCurrentExercise(c, () => { c.items[c.ui.swapIndex] = item; }); c.ui.expanded = c.ui.swapIndex; }
  } else { c.items.push(item); c.ui.expanded = c.items.length - 1; }
  state.justAdded = { screen: c.owner, index: c.ui.expanded };
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
// When saving from the swap sheet, start on the kind of equipment you were using.
function swapTypeGuess(returnTo) {
  if (returnTo !== 'swap') return null;
  const r = swapRef(), sv = eqById(r);
  return r ? genericOf(sv ? eqType(sv) : r) : null;
}
function freshEqWizard(returnTo) { state.eqwiz = { step: 1, location: (state.session && state.session.location) || db.settings.location || db.locations[0] || '', name: '', type: swapTypeGuess(returnTo), units: db.settings.units, photo: null, returnTo }; }

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
  try { await document.fonts.load('800 40px Archivo'); await document.fonts.load('700 40px Archivo'); } catch {}
  const W = 1080, P = 64, st = sessionStats(s);
  const done = s.exercises.filter(e => e.sets.length);
  const rowH = 76, cardHead = 128;
  const H = 420 + done.reduce((a, e) => a + cardHead + e.sets.length * rowH + 40, 0) + 120;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  g.fillStyle = '#ebebeb'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#5f636b'; g.font = '600 34px Archivo'; g.textBaseline = 'alphabetic';
  g.fillText('Workout Complete', P, 170);
  g.fillStyle = '#fff'; rr(P, 200, W - P * 2, 130, 12); g.fill();
  g.fillStyle = s.color; g.fillRect(P, 200, 14, 130);
  g.fillStyle = '#111'; g.font = '700 52px Archivo'; g.fillText(s.workoutName, P + 40, 262);
  g.fillStyle = s.color; g.font = '700 28px Archivo';
  g.fillText(`${st.exercises} EXERCISES • ${st.sets} SETS • ${st.fails} TO FAILURE`.toUpperCase(), P + 40, 306);
  let y = 370;
  for (const e of done) {
    const info = exInfo(e), u = eqUnits(e.equip), h = cardHead + e.sets.length * rowH + 10;
    g.fillStyle = '#fff'; rr(P, y, W - P * 2, h, 20); g.fill();
    g.fillStyle = '#111'; g.font = '700 46px Archivo'; g.fillText(info.name, P + 32, y + 66);
    g.fillStyle = '#5f636b'; g.font = '700 24px Archivo'; g.fillText(`${info.muscle} • ${e.equipName || eqLabel(e.equip)}`.toUpperCase(), P + 32, y + 104);
    let n = 0, ry = y + cardHead;
    for (const set of e.sets) {
      const warm = set.type === 'warmup', label = warm ? 'W' : String(++n);
      g.fillStyle = warm ? '#828282' : setPurple(set, e) ? PURPLE : '#111';
      rr(P + 32, ry, 56, 56, 6); g.fill();
      g.fillStyle = '#fff'; g.font = '900 28px Archivo'; g.textAlign = 'center'; g.fillText(label, P + 60, ry + 38); g.textAlign = 'left';
      g.fillStyle = '#111'; g.font = '500 32px Archivo'; g.fillText(`${wt(set.weight, u)} × ${set.reps} reps`, P + 112, ry + 39);
      if (!warm) {
        const tag = isFail(set) ? 'F' : rpeOf(set.feel), tw = isFail(set) ? 48 : 112;
        g.strokeStyle = PURPLE; g.lineWidth = 2; g.fillStyle = isFail(set) ? PURPLE : '#fff';
        rr(W - P - 32 - tw, ry + 6, tw, 44, 6); g.fill(); g.stroke();
        g.fillStyle = isFail(set) ? '#fff' : '#8174e7'; g.font = '700 22px Archivo'; g.textAlign = 'center';
        g.fillText(tag, W - P - 32 - tw / 2, ry + 36); g.textAlign = 'left';
      }
      ry += rowH;
    }
    y += h + 30;
  }
  g.font = '800 52px Archivo'; g.fillStyle = PURPLE; g.fillText('Fail', P, H - 60);
  g.fillStyle = '#111'; g.fillText('Up', P + g.measureText('Fail').width, H - 60);
  g.fillStyle = '#5f636b'; g.font = '500 26px Archivo'; g.textAlign = 'right'; g.fillText(D.long(new Date(s.finishedAt)), W - P, H - 66); g.textAlign = 'left';
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
// Press feedback: every tappable flashes light purple (a brighter purple on dark buttons).
const isDark = el => { const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g); if (!m || (m[3] != null && +m[3] < 0.5)) return false; const [r, g, b] = m.map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) < 110; };
device.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('button, label, a, .fl-row, [role="button"]');
  if (!el || !device.contains(el) || el.closest('[data-feelbar]') || el.disabled) return;
  el.classList.remove('flash', 'flash-dark'); void el.offsetWidth;
  el.classList.add('flash'); if (isDark(el)) el.classList.add('flash-dark');
  el.addEventListener('animationend', () => el.classList.remove('flash', 'flash-dark'), { once: true });
}, { passive: true });
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
        goalFor: (st, r) => goalFor(exId, ref, st, r), points: (st, r) => volumeDots(exId, ref, st, r).length };
      state.modal = 'volume'; break;
    }
    case 'close-volume': state.modal = null; break;
    case 'open-mastervol': {   // Today's Plan: one volume for every exercise
      const items = state.session.exercises, f = items[0].goal;
      state.volumeDraft = { context: 'master', sets: f.sets, reps: f.reps, count: items.length };
      state.modal = 'volume'; break;
    }
    case 'pending-save': state.pending = null; toast('Changes saved'); break;
    case 'pending-cancel': {
      const p = JSON.parse(state.pending.snap);
      Object.assign(state.session, { exercises: p.ex, location: p.loc, exIndex: Math.min(p.i, p.ex.length - 1) });
      syncAllGoals(); state.pending = null;
      if (state.lineup) state.lineup.expanded = null;
      break;
    }
    case 'vol-step': state.volumeDraft[d.field] = Math.min(50, Math.max(1, state.volumeDraft[d.field] + +d.dir)); break;
    case 'save-volume': {
      const v = state.volumeDraft;
      if (v.context === 'master') { for (const it of state.session.exercises) { it.goal.sets = v.sets; it.goal.reps = v.reps; syncGoal(it); } toast('Volume set for every exercise'); }
      else if (v.context === 'session') { const it = cur(); it.goal.sets = v.sets; it.goal.reps = v.reps; syncGoal(it); }
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
      if (ex.mode === 'add') { state.exPick = { id: d.id, swap: listCtx(ex.returnTo || 'create').ui.swapIndex != null }; state.exDetail = d.id; go('exdetail'); }   // look first, then Add / Swap In
      else if (ex.mode === 'quickadd') toggleIn(ex.picked, d.id);
      else if (ex.mode === 'tracker') {
        const x = exById(d.id), t = state.tracker;
        const usable = x.equipment.map(k => k.startsWith('eq:') ? k : eqName(k));
        if (!usable.includes(t.equip) && !lastDone(d.id, t.equip)) t.equip = defaultRef(x);
        t.exId = d.id; t.volume = defaultVolume(d.id, t.equip); resetPicker(); back();
      } else { state.exDetail = d.id; go('exdetail'); }
      break;
    case 'xd-pick': { const id = state.exPick && state.exPick.id; state.exPick = null; if (!id) break; back(); addToCtx(id); break; }
    case 'quickadd-done': {
      const start = s.exercises.length;
      for (const id of ex.picked) s.exercises.push(sessionItem(id, defaultRef(exById(id))));
      applyLocationDefaults(s);
      s.exIndex = start; s.expanded = false;
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
    case 'open-preftype': state.prefType = { owner: d.owner || listCtx().owner, index: +d.i }; state.modal = 'preftype'; break;
    case 'pick-preftype': { const c = listCtx(state.prefType.owner), it = c.items[state.prefType.index]; if (it) it.equip = d.name; state.modal = null; break; }
    case 'close-preftype': state.modal = null; break;
    case 'toggle-ex': { const c = listCtx(), i = +d.i; c.ui.expanded = c.ui.expanded === i ? null : i; break; }
    case 'cw-step': {
      const c = listCtx(), it = c.items[+d.i], v = vol(it);
      beginChange(c.owner);
      v[d.field] = Math.min(50, Math.max(1, v[d.field] + +d.dir));
      if (it.goal) syncGoal(it);
      break;
    }
    case 'ex-move': {
      const c = listCtx(), i = +d.i, j = i + +d.dir, arr = c.items;
      if (j >= 0 && j < arr.length) beginChange(c.owner);
      if (j >= 0 && j < arr.length) keepCurrentExercise(c, () => { [arr[i], arr[j]] = [arr[j], arr[i]]; c.ui.expanded = j; });
      break;
    }
    case 'sess-swap-ex': {
      if (!state.lineup) state.lineup = { expanded: null, swapIndex: null };
      const c = listCtx('lineup'), it = c.items[s.exIndex];
      c.ui.swapIndex = s.exIndex; ex.returnTo = 'lineup'; ex.mode = 'add'; ex.search = '';
      ex.muscles = [exInfo(it).muscle]; ex.swapping = true;
      go('exercises'); break;
    }
    case 'ex-swap': {
      const c = listCtx(), it = c.items[+d.i];
      c.ui.swapIndex = +d.i; ex.returnTo = c.owner; ex.mode = 'add'; ex.search = '';
      ex.muscles = [exInfo(it).muscle]; ex.swapping = true;
      go('exercises'); break;
    }
    case 'ex-delete': {
      const c = listCtx(), i = +d.i, it = c.items[i];
      const run = () => { beginChange(c.owner); keepCurrentExercise(c, () => { c.items.splice(i, 1); c.ui.expanded = null; }); };
      const logged = c.owner === 'lineup' && it.sets.length;
      confirm({ title: 'Delete exercise?', danger: true, label: 'Delete',
        text: logged ? `You’ve logged ${it.sets.length} set${it.sets.length === 1 ? '' : 's'} of ${esc(exInfo(it).name)} today. Deleting it removes them.` : `${esc(exInfo(it).name)} comes off this ${c.owner === 'lineup' ? 'plan' : 'workout'}.`, run });
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
    case 'search-clear': {   // the little × in a search field
      const inp = el.parentElement.querySelector('input');
      if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); }
      el.parentElement.classList.remove('has-text');
      return false;
    }
    case 'workouts-tab': state.workoutsTab = d.tab; break;
    case 'workout-menu': {
      const w = db.workouts.find(x => x.id === d.id);
      menu({ title: w.name, items: [
        { label: 'Edit Workout', icon: I.editPen, run: () => openWorkoutEditor(w.id) },
        { label: 'Duplicate Workout', icon: COPY_ICON, run: () => {   // "Chest & Arms" → "Chest & Arms 2", then 3…
          const base = w.name.replace(/\s+\d+$/, '');
          let n = 2; while (db.workouts.some(x => x.name.toLowerCase() === `${base} ${n}`.toLowerCase())) n++;
          const copy = { ...JSON.parse(JSON.stringify(w)), id: uid('w'), name: `${base} ${n}` };
          const same = x => x.name.replace(/\s+\d+$/, '').toLowerCase() === base.toLowerCase();
          const after = db.workouts.reduce((k, x, i) => (same(x) ? i : k), db.workouts.indexOf(w));   // after the last copy
          db.workouts.splice(after + 1, 0, copy); toast(`${copy.name} added`);
        } },
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
      surge(s.color, s.icon, () => {
        s.started = true; s.startedAt = new Date().toISOString(); s.exIndex = 0; s.expanded = false;
        state.stack = ['home']; state.screen = 'session'; render();
      });
      return false;
    case 'resume-session': state.stack = ['home']; state.screen = s.started ? 'session' : 'lineup'; break;
    case 'discard-session':
      confirm({ title: 'Discard workout?', danger: true, label: 'Discard', text: s.started ? 'The sets you logged in this workout will be deleted.' : 'Today’s lineup changes will be cleared.',
        run: () => { state.session = null; home(); } });
      break;
    case 'open-lineup': state.lineup = { expanded: s.exIndex, swapIndex: null }; go('lineup'); break;
    case 'sess-toggle': s.expanded = !s.expanded; break;
    case 'sess-move': s.exIndex = Math.min(s.exercises.length - 1, Math.max(0, s.exIndex + +d.dir)); break;   // arrows only browse; goals are asked on Next Exercise
    case 'sess-jump': s.exIndex = +d.i; break;
    case 'sess-next': { const from = cur(), t = nextTarget(s); if (t != null) { s.exIndex = t; askOnLeave(from); } break; }
    case 'sess-pause': state.modal = 'pause'; break;
    case 'close-pause': state.modal = null; break;
    case 'pause-confirm': home(); break;
    case 'finish-early': state.modal = null; render(); surge(s.color, s.icon, () => { finishSession(); render(); }); return false;
    case 'sess-finish': {   // ask about the last exercise first, then finish once it's answered
      if (askOnLeave(cur())) { state.goalAsk.thenFinish = true; break; }
      surge(s.color, s.icon, () => { finishSession(); render(); }); return false;
    }
    case 'complete-home': home(); break;
    case 'add-more':
      if (!reopenSession(state.log.sid)) break;
      ex.mode = 'quickadd'; ex.picked = []; ex.search = ''; ex.returnTo = 'lineup';
      state.stack = ['home', 'session']; state.screen = 'exercises'; break;
    case 'sess-log': s.expanded = false; state.setDraft = setDraft(d.type); state.modal = 'setwidget'; break;   // the card folds up as the logger slides in
    case 'edit-set': state.setDraft = setDraft(null, +d.si); state.modal = 'setwidget'; break;
    case 'edit-logged-set': {
      const ls = db.sessions.find(x => x.id === state.log.sid), le = ls.exercises[+d.ei], st = le.sets[+d.si];
      const working = workingSets(le);
      state.setDraft = { ...st, setNum: st.type === 'working' ? working.indexOf(st) + 1 : 0, unit: eqUnits(le.equip), touched: st.rated !== false, bw: isBodyweight(le.equip), equip: st.equip || le.equip, edit: { sid: ls.id, ei: +d.ei, si: +d.si } };
      state.modal = 'setwidget'; break;
    }
    case 'sw-w': state.setDraft.weight = Math.max(state.setDraft.bw ? -9999 : 0, Math.round((state.setDraft.weight + +d.d) * 100) / 100); break;   // bodyweight: + added, − assisted
    case 'sw-r': state.setDraft.reps = Math.max(1, state.setDraft.reps + +d.d); break;
    case 'sess-cancelset': state.setDraft = null; state.modal = null; break;
    case 'sw-done': {
      const a = state.setDraft, rec = { weight: a.weight, reps: a.reps, feel: a.touched ? a.feel : 0, type: a.type, rated: !!a.touched, equip: a.equip };
      state.setDraft = null; state.modal = null;
      if (a.edit && a.edit.sid) {
        const ls = db.sessions.find(x => x.id === a.edit.sid);
        ls.exercises[a.edit.ei].sets[a.edit.si] = rec; ls.edited = true; break;
      }
      const it = cur();
      if (a.edit) { it.sets[a.edit.si] = rec; break; }
      it.sets.push(rec);
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
    case 'goalask-edit': state.goalAsk.editing = true; break;
    case 'goalask-adj': { const g = state.goalAsk, bw = isBodyweight(s.exercises[g.ei].equip); g.weight = Math.max(bw ? -9999 : 0, Math.round((g.weight + +d.d) * 100) / 100); break; }
    case 'goalask-no': {   // "Not now": keep it as a suggestion for Workout Complete and the Overload Tracker
      const g = state.goalAsk, it = s.exercises[g.ei];
      if (it) it.declined = { ...g, thenFinish: undefined, editing: false };
      state.modal = null; state.goalAsk = null;
      if (g.thenFinish) { render(); surge(s.color, s.icon, () => { finishSession(); render(); }); return false; }
      break;
    }
    case 'goalask-yes': {
      const g = state.goalAsk, it = s.exercises[g.ei];
      setGoal(it.exId, it.equip, g.sets, g.reps, g.weight);
      it.newGoal = g.weight; it.newGoalVol = { sets: g.sets, reps: g.reps }; it.declined = null;   // takes effect next time
      state.modal = null; state.goalAsk = null; toast(g.first ? 'Your first goal is set!' : 'Overload goal set');
      if (g.thenFinish) { render(); surge(s.color, s.icon, () => { finishSession(); render(); }); return false; }
      break;
    }
    case 'goal-view': {   // reopen a "Not now" suggestion from the exercise dropdown
      const it = cur(), x = it.declined || pendingSuggestion(it); if (!x) break;
      state.goalAsk = { kind: 'set', first: !db.goalEdits.length, ...x, ei: s.exercises.indexOf(it), thenFinish: undefined, editing: false }; state.modal = 'goalask'; break;
    }
    case 'sugg-yes': {   // accept a waiting suggestion (Workout Complete or the Overload Tracker)
      const x = db.suggestions.find(y => y.key === d.key); if (!x) break;
      setGoal(x.exId, x.equip, x.sets, x.reps, x.weight);
      const ls = x.sid && db.sessions.find(y => y.id === x.sid), le = ls && ls.exercises[x.ei];
      if (le) { le.newGoal = x.weight; le.newGoalVol = { sets: x.sets, reps: x.reps }; }
      toast('Overload goal set'); break;
    }
    case 'sugg-no': db.suggestions = db.suggestions.filter(y => y.key !== d.key); break;
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
    case 'workouts-tab': state.workoutsTab = d.tab; break;
    case 'view-complete': if (!d.id || !db.sessions.some(x => x.id === d.id)) break; state.log = { sid: d.id, mode: 'complete' }; go('complete'); break;
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
    case 'home-tracker': {   // a goal card or row → that goal's Overload Tracker
      const [exId, ref, vol] = d.key.split('|'), [sets, reps] = vol.split('x').map(Number);
      state.tracker = { exId, equip: ref, range: 'All', volume: { sets, reps } }; go('tracker'); break;
    }
    case 'share-app': shareApp(); return false;
    case 'home-go-mini':
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
          text: 'It comes off your home screen. Workouts and history stay.', run: () => { db.plan = null; } }) },
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
    case 'swap-add': state.modal = null; freshEqWizard('swap'); go('eqwiz'); break;
    case 'edit-equipment': {
      const sv = db.equipment.find(x => x.id === state.eqDetail);
      state.eqwiz = { step: 1, editId: sv.id, location: sv.location, name: sv.name, type: GENERIC.includes(eqType(sv)) ? eqType(sv) : null, units: sv.units, photo: sv.photo, returnTo: 'eqdetail' };
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
      if (w.step === 3 && !w.type) { w.err = 'Pick the kind of equipment this is.'; break; }
      if (w.step < 5) { w.step++; break; }
      const rec = { name: w.name.trim(), location: w.location, type: w.type, units: w.units, photo: w.photo || null };
      if (w.editId) { Object.assign(db.equipment.find(x => x.id === w.editId), rec); back(); syncAllGoals(); toast('Equipment saved'); break; }
      const sv = { id: uid('e'), ...rec }; db.equipment.push(sv);
      const ref = 'eq:' + sv.id;
      back();
      if (w.returnTo === 'exwiz') { if (!state.exwiz.saved.includes(ref)) state.exwiz.saved.push(ref); }
      else if (w.returnTo === 'exdetail') { const x = exById(state.exDetail); if (x && !x.equipment.includes(ref)) x.equipment.push(ref); }
      else if (w.returnTo === 'swap') { const x = exById(swapExId()); if (x && !x.equipment.includes(ref)) x.equipment.push(ref); return handle('swap-pick', { ref }, el, ex); }
      toast('Equipment saved'); break;
    }
    case 'eqwiz-prev': state.eqwiz.err = null; state.eqwiz.step = Math.max(1, state.eqwiz.step - 1); break;
    case 'eqwiz-headback': if (state.eqwiz.step > 1) { state.eqwiz.err = null; state.eqwiz.step--; } else back(); break;
    case 'eqwiz-location': state.eqwiz.location = d.name; state.eqwiz.err = null; break;
    case 'eqwiz-units': state.eqwiz.units = d.name; break;
    case 'eqwiz-type': state.eqwiz.type = d.name; state.eqwiz.err = null; break;
    case 'eqwiz-addloc': state.newLoc = { name: '', target: 'eqwiz' }; go('newloc'); break;
    case 'open-swap': state.swap = { owner: d.owner || listCtx().owner, index: +d.i || 0 }; state.modal = 'swap'; break;
    case 'swap-all': state.modal = null; go('swap'); break;
    case 'swap-toggle': {   // what shows in this exercise's quick swap sheet
      const x = exById(swapExId()); if (!x) break;
      const i = x.equipment.indexOf(d.key);
      if (i >= 0) x.equipment.splice(i, 1); else x.equipment.push(d.key);
      break;
    }
    case 'close-swap': state.modal = null; break;
    case 'swap-pick': {
      const ref = d.ref, sw = state.swap;
      if (sw.owner === 'tracker') { state.tracker.equip = ref; state.tracker.volume = defaultVolume(state.tracker.exId, ref); }
      else { const it = swapTarget(); if (it.equip !== ref) beginChange(sw.owner); it.equip = ref; if (it.goal) syncGoal(it); }
      if (state.screen === 'swap') back();
      state.modal = null; break;
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
      if (scr === 'exdetail') state.exPick = null;
      if (scr === 'assignday') state.planwiz.pickDay = null;
      if (scr === 'create') state.create.err = null;
      back(); break;
    }
    default: return false;
  }
}

/* ---- "How did it feel?" slider: drag the white thumb; its number counts 1–9, then F ---- */
let feelDrag = null;
// The value is the shade under the thumb's center; F only when the thumb is pushed all the way right.
// Returns { feel, left }: feel is the middle of that shade (what gets saved), left follows the finger.
function feelFromPointer(bar, x) {
  const r = bar.getBoundingClientRect(), W = r.width, half = 28, inset = 4;
  const cx = Math.min(W - inset - half, Math.max(inset + half, x - r.left));
  const atEnd = cx >= W - inset - half - 0.5;
  const band = atEnd ? 9 : Math.min(8, Math.floor(cx / (W / 10)));
  return { feel: (band + 0.5) / 10, left: `${cx - half}px` };
}
let ringAt = 0;
function paintFeel(bar, f) {
  const th = bar.querySelector('.ff-thumb');
  th.style.left = f.left;
  th.querySelector('.ff-num').textContent = rpeNum(f.feel);
  bar.querySelector('.ff-text').textContent = rpeOf(f.feel) === 'F' ? 'FAILURE' : '';
  const ring = bar.querySelector('.ff-ring'), on = rpeOf(f.feel) === 'F';
  if (ring && ring.classList.contains('on') !== on) { ring.classList.toggle('on', on); ringAt = Date.now(); }
}
device.addEventListener('pointerdown', (e) => {
  const bar = e.target.closest('[data-feelbar]');
  if (!bar || !state.setDraft) return;
  e.preventDefault();
  feelDrag = bar;
  try { bar.setPointerCapture(e.pointerId); } catch {}
  const f = feelFromPointer(bar, e.clientX); state.setDraft.feel = f.feel; state.setDraft.touched = true;
  paintFeel(bar, f);
});
device.addEventListener('pointermove', (e) => {
  if (!feelDrag || !state.setDraft) return;
  const f = feelFromPointer(feelDrag, e.clientX); state.setDraft.feel = f.feel;
  paintFeel(feelDrag, f);
});
const endFeel = () => { if (!feelDrag) return; feelDrag = null; const wait = Math.max(0, 480 - (Date.now() - ringAt)); setTimeout(() => { if (!feelDrag && state.setDraft) render(); }, wait); };   // let the F ring finish drawing
device.addEventListener('pointerup', endFeel);
device.addEventListener('pointercancel', endFeel);

/* ---- text inputs (update state without re-rendering, so focus survives) ---- */
device.addEventListener('input', (e) => {
  const t = e.target;
  if (t.matches('[data-search],[data-goalsearch],[data-mergesearch]')) t.parentElement.classList.toggle('has-text', !!t.value);   // shows the ×
  if (t.matches('[data-search]')) { state.exercises.search = t.value; const l = document.getElementById('ex-list'); if (l) l.innerHTML = exListInner(); return; }
  if (t.matches('[data-exwizname]')) { state.exwiz.name = t.value; return; }
  if (t.matches('[data-eqwizname]')) { state.eqwiz.name = t.value; return; }
  if (t.matches('[data-newloc]')) { state.newLoc.name = t.value; return; }
  if (t.matches('[data-planwizname]')) { state.planwiz.name = t.value; return; }
  if (t.matches('[data-cwname]')) { state.create.name = t.value; if (state.create.err) { state.create.err = null; const er = t.closest('.cw-body').querySelector('.wiz-err'); if (er) er.remove(); } return; }
  if (t.matches('[data-rpedemo]')) {   // How FailUp Works: the practice effort slider
    const v = +t.value, demo = t.closest('.hv-rpe-demo'), c = FEEL_SEGS[v - 1];
    demo.style.setProperty('--c', c); demo.style.setProperty('--p', `${((v - 0.5) / 10) * 100}%`);
    demo.querySelector('[data-rpe-label]').textContent = rpeLabel(v);
    demo.querySelector('[data-rpe-note]').textContent = RPE_NOTES[v - 1];
    demo.querySelector('.hv-rpe-box').classList.toggle('dark', v <= 4);
    return;
  }
  if (t.matches('[data-goalsearch]')) {
    const q = t.value.trim().toLowerCase(); let n = 0;
    for (const r of document.querySelectorAll('#gl-list .gl-row')) { const on = !q || r.dataset.q.includes(q); r.hidden = !on; n += on; }
    const none = document.querySelector('#gl-list .gl-none'); if (none) none.hidden = n > 0 || !q;
    return;
  }
  if (t.matches('[data-mergesearch]')) { state.merge.q = t.value; const l = document.getElementById('merge-list'); if (l) l.innerHTML = mergeExList(); return; }
  if (t.matches('[data-swfield]')) {
    const v = parseFloat(t.value.replace(',', '.'));
    if (!isNaN(v) && (v >= 0 || (state.setDraft.bw && t.dataset.swfield === 'weight'))) state.setDraft[t.dataset.swfield] = t.dataset.swfield === 'reps' ? Math.max(1, Math.round(v)) : v;
    if (t.dataset.swfield === 'weight') t.style.width = (Math.max(1, t.value.length) + 0.3) + 'ch';
    return;
  }
  if (t.matches('[data-goalaskfield]')) { const v = parseFloat(t.value.replace(',', '.')); if (!isNaN(v) && (v >= 0 || isBodyweight(state.session.exercises[state.goalAsk.ei].equip))) state.goalAsk.weight = v; return; }
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
