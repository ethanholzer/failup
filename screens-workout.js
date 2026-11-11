// ============================================================================
// FailUp — workout screens: home, workouts, Today's Lineup, the live session,
// set sheets, Workout Complete / past workout logs, and the plan wizard.
// ============================================================================
import { state } from './data.js';
import { I, WORKOUT_ICONS, statusBar, fmt, esc, wt, wtTight, D, PH_EQUIP } from './ui.js';
import {
  db, exById, eqById, eqLabel, eqUnits, unitLabel, unitWord, steps, goalFor, isFail, derived, photoSrc, exPhoto, eqType, genericOf, eqKind,
  timesCompleted, lastDone, dayKey, parseDay, daysBetween, addDays, planToday,
} from './store.js';
import { eqImg } from './screens-library.js';

/* ------------------------------ shared logic ------------------------------ */
export const exInfo = it => { const x = exById(it.exId); return x ? { name: x.name, muscle: x.muscle } : { name: it.name || 'Exercise', muscle: it.muscle || '' }; };
// the number on the slider thumb: 1–9, then F
// Effort slider geometry: 10 equal shades; the value is the shade under the thumb's center.
// F is only the far right end. Thumb is 56px with a 4px inset.
export const feelBand = feel => Math.min(9, Math.floor(feel * 10));
export const feelLeft = feel => { const b = feelBand(feel); return b === 9 ? 'calc(100% - 60px)' : `clamp(4px, calc(${(b + 0.5) * 10}% - 28px), calc(100% - 60px))`; };
export const rpeNum = feel => { const b = Math.min(9, Math.floor(feel * 10)); return b === 9 ? 'F' : String(b + 1); };
export function rpeOf(feel) {
  const band = Math.min(9, Math.floor(feel * 10));
  return band === 9 ? 'F' : `RPE ${band + 1}`;
}
// A set is purple when it's at (or above) the goal weight AND either hit the
// goal reps or was taken to failure. No goal yet → never purple.
export const setPurple = (st, e) => e.goal.weight != null && st.type === 'working' && st.weight >= e.goal.weight && (st.reps >= e.goal.reps || isFail(st));
export const exPurple = e => e.goal.weight != null && e.sets.filter(st => setPurple(st, e)).length >= e.goal.sets;
// A suggestion still waiting for this exercise (said "Not now" in this or an earlier workout).
export function pendingSuggestion(e) {
  if (e.declined) return e.declined;
  return db.suggestions.find(x => x.exId === e.exId && x.equip === e.equip && x.sets === e.goal.sets && x.reps === e.goal.reps) || null;
}
export const workingSets = e => e.sets.filter(st => st.type === 'working');
export const exComplete = e => workingSets(e).length >= e.goal.sets;

// One logged set. `tap` makes it a button that opens the set editor.
export function setRow(st, label, kind, e, unit, tap) {
  const tag = kind !== 'working' ? '' : st.rated === false ? '<span class="set-tag unrated" aria-label="Effort not rated"></span>' : isFail(st) ? '<span class="set-tag fail">F</span>' : `<span class="set-tag">${rpeOf(st.feel)}</span>`;
  const pr = kind === 'working' && setPurple(st, e) ? ' pr' : '';
  const inner = `
    <span class="set-badge ${kind}${pr}">${label}</span>
    <span class="set-text"><b>${wt(st.weight, unit)}</b><i>×</i><b>${st.reps} rep${st.reps === 1 ? '' : 's'}</b></span>
    ${tag}`;
  return tap ? `<button class="set-cell" ${tap}>${inner}</button>` : `<div class="set-cell">${inner}</div>`;
}
function setList(e, unit, tapFor) {
  let n = 0;
  return e.sets.map((st, si) => st.type === 'warmup'
    ? setRow(st, 'W', 'warm', e, unit, tapFor && tapFor(si))
    : setRow(st, ++n, 'working', e, unit, tapFor && tapFor(si))).join('');
}
export const sessionStats = s => {
  const done = s.exercises.filter(e => e.sets.length);
  const sets = done.flatMap(workingSets);
  return { exercises: done.length, sets: sets.length, fails: sets.filter(isFail).length };
};
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const muscleList = w => [...new Set(w.exercises.map(e => exInfo(e).muscle))].join(', ');

/* ------------------------- shared exercise-list editor ------------------------ */
// Templates keep volume flat ({sets, reps}); live-session exercises keep it under .goal.
export const vol = it => it.goal || it;
// the generic type shown as a workout exercise's preferred equipment (a saved machine counts as its kind)
const prefLabel = ref => { const sv = eqById(ref); return genericOf(sv ? eqType(sv) : ref || 'Bodyweight'); };
// one volume for the whole list, or "Mixed"
const masterVolLabel = items => { const k = new Set(items.map(x => `${x.goal.sets}x${x.goal.reps}`)); return k.size === 1 ? `${items[0].goal.sets} Sets · ${items[0].goal.reps} Reps` : 'Mixed'; };
// Nevermind / Save Changes tray after any change to today's plan or the live workout
export const pendingTray = () => { const p = state.pending; const t = `<div class="cw-footer pend-tray${p.shown ? '' : ' enter'}"><button class="btn ghost" data-action="pending-cancel">Nevermind</button><button class="btn solid" data-action="pending-save">Save Changes</button></div>`; p.shown = true; return t; };
export function listCtx(owner) {
  owner = owner || (state.screen === 'exercises' ? state.exercises.returnTo : state.screen);
  if (owner === 'lineup') return { owner, items: state.session.exercises, ui: state.lineup };
  if (owner === 'details') { const w = db.workouts.find(x => x.id === state.details.wid); return { owner, items: w ? w.exercises : [], ui: state.details, readOnly: true }; }
  return { owner: 'create', items: state.create.exercises, ui: state.create };
}
export function keepCurrentExercise(ctx, fn) {
  if (ctx.owner !== 'lineup') return fn();
  const s = state.session, cur = s.exercises[s.exIndex];
  fn();
  const k = s.exercises.indexOf(cur);
  s.exIndex = Math.max(0, k >= 0 ? k : Math.min(s.exIndex, s.exercises.length - 1));
}
const itemGoal = it => it.goal ? it.goal.weight : goalFor(it.exId, it.equip, it.sets, it.reps);
function exSub(it) {
  const v = vol(it), g = itemGoal(it), u = eqUnits(it.equip);
  return `<span class="mtag">${esc(exInfo(it).muscle)}</span>${v.sets} Sets x ${v.reps} Reps${g != null ? ` · <span class="lbs">${wtTight(g, u)}</span>` : ''}`;
}
export function exerciseCards(ctx) {
  if (!ctx.items.length) return `<div class="cw-empty">${ctx.readOnly ? 'No exercises in this workout yet.' : 'No exercises yet. Add your first one below.'}</div>`;
  const seen = {};
  return ctx.items.map((it, i) => {
    const nth = seen[it.exId] = (seen[it.exId] || 0) + 1;   // stable key, so reordering can animate
    const open = ctx.ui.expanded === i, v = vol(it), ro = ctx.readOnly;
    const g = itemGoal(it), u = eqUnits(it.equip), sv = eqById(it.equip);
    const stepper = (label, field) => ro ? `
          <div class="cw-stepper ro"><div class="cw-st-label">${label}</div><div class="cw-st-row ro"><div class="cw-st-val tnum">${v[field]}</div></div></div>` : `
          <div class="cw-stepper">
            <div class="cw-st-label">${label}</div>
            <div class="cw-st-row">
              <button class="cw-st-btn" data-action="cw-step" data-i="${i}" data-field="${field}" data-dir="-1" aria-label="Decrease ${label}">${I.minus20}</button>
              <div class="cw-st-val tnum">${v[field]}</div>
              <button class="cw-st-btn" data-action="cw-step" data-i="${i}" data-field="${field}" data-dir="1" aria-label="Increase ${label}">${I.plus20}</button>
            </div>
          </div>`;
    const logged = ctx.owner === 'lineup' && it.sets.length;
    const detail = !open ? '' : `
      <div class="cw-ex-detail">
        <div class="cw-detail-main">
          ${ctx.owner === 'create' ? `
          <button class="cw-pref" data-action="open-preftype" data-owner="create" data-i="${i}">
            <span class="cw-pref-text"><span class="cw-label">Preferred Equipment Type</span><span class="cw-pref-val">${esc(prefLabel(it.equip))}</span><span class="cw-pref-note">For convenience. Easy to swap mid-workout.</span></span>
            <span class="cw-pref-btn">${I.swap24}</span>
          </button>` : ''}
          ${ro ? `<div class="cw-volrow"><div class="cw-label">Volume</div><div class="cw-volval tnum">${v.sets} Sets · ${v.reps} Reps</div></div>` : `<div class="cw-steppers">${stepper('Sets', 'sets')}${stepper('Reps', 'reps')}</div>`}
          <div class="cw-goal">
            <div class="cw-goal-text"><div class="cw-label">Overload Goal</div><div class="cw-goal-val tnum">${v.sets} Sets · ${v.reps} Reps · <span class="lbs">${g != null ? wtTight(g, u) : 'No Goal Yet'}</span></div></div>
            ${ro ? '' : `<button class="cw-edit" data-action="open-goal" data-owner="${ctx.owner}" data-i="${i}">${I.editPen} Edit</button>`}
          </div>
        </div>
        ${ro ? '' : `<div class="cw-actions">
          <button class="cw-act" data-action="ex-move" data-i="${i}" data-dir="-1">${I.chevUp20} Up</button>
          <button class="cw-act" data-action="ex-move" data-i="${i}" data-dir="1">${I.chevDn20} Down</button>
          <button class="cw-act" data-action="ex-swap" data-i="${i}">${I.swap} Swap</button>
          <button class="cw-act del" data-action="ex-delete" data-i="${i}">${I.trashRed} Delete</button>
        </div>`}
      </div>`;
    return `
      <div class="cw-ex-card${open ? ' open' : ''}${ro ? ' ro' : ''}" data-anim="${ctx.owner}-${it.exId}-${nth}">
        <button class="cw-ex-row" data-action="toggle-ex" data-i="${i}">
          <span class="cw-badge tnum">${i + 1}</span>
          <span class="cw-ex-meta"><span class="cw-ex-name">${esc(exInfo(it).name)}</span><span class="cw-ex-sub">${exSub(it)}${logged ? ` · ${plural(workingSets(it).length, 'set')} logged` : ''}</span></span>
          <span class="cw-ex-caret">${open ? I.caretUp : I.caretDn}</span>
        </button>
        ${detail}
      </div>`;
  }).join('');
}

/* ---- Create / Edit Workout ---- */
export function CreateWorkoutScreen() {
  const c = state.create;
  return `
  <div class="cw-screen" style="--cw-current:${c.color}">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">${c.mode === 'edit' ? 'Edit Workout' : 'Create A Workout'}</span></div>
    <div class="cw-body">
      <div class="lu-tile cw-tile tint" style="--wc:${c.color}">${WORKOUT_ICONS[c.icon]}</div>
      <div class="cw-label">Workout Name</div>
      <label class="cw-name">
        <input class="cw-name-text cw-name-input" data-cwname value="${esc(c.name)}" placeholder="Name this workout" autocomplete="off">
        <span class="cw-pencil">${I.pencil}</span>
      </label>
      ${c.err ? `<div class="wiz-err">${esc(c.err)}</div>` : ''}
      <div class="cw-fields">
        <div class="cw-field"><div class="cw-label">Workout Color</div><button class="cw-swatch" style="background:${c.color}" data-action="open-color"><span class="cw-chev">${I.chevDown}</span></button></div>
        <div class="cw-field"><div class="cw-label">Workout Icon</div><button class="cw-swatch icon" data-action="open-icon" style="color:${c.color}">${WORKOUT_ICONS[c.icon]}<span class="cw-chev">${I.chevDown}</span></button></div>
      </div>
      <div class="cw-listlabel">Exercise List (${c.exercises.length})</div>
      ${exerciseCards(listCtx('create'))}
      <button class="cw-add" data-action="add-exercise">${I.plus20} Add exercise</button>
    </div>
    <div class="cw-footer">
      <button class="btn ghost" data-action="back">Cancel</button>
      <button class="btn solid" data-action="save-workout">Save workout</button>
    </div>
  </div>`;
}

/* ---- Today's Lineup: before the session (Let's Go) and during it ---- */
export function LineupScreen() {
  const s = state.session, ctx = listCtx('lineup');
  const n = s.workoutId ? timesCompleted(s.workoutId) : 0;
  const pre = !s.started;
  return `
  <div class="cw-screen lu-screen${pre ? ' has-footer' : ''}" style="--cw-current:${s.color}">
    ${statusBar()}
    <div class="nav">
      <button class="icon-btn" data-action="back">${I.chevL}</button>
      <span class="nav-title">${pre ? 'Today’s Plan' : 'Today’s Lineup'}</span>
    </div>
    <div class="cw-body">
      <div class="lu-head">
        <div class="lu-titlerow">
          <div class="lu-tile tint" style="--wc:${s.color}">${WORKOUT_ICONS[s.icon] || WORKOUT_ICONS.kick}</div>
          <div><div class="lu-title">${esc(s.workoutName)}</div><div class="lu-count">${n ? `Workout completed ${plural(n, 'time')}` : 'First time doing this workout'}</div></div>
        </div>
        <div class="lu-loc">
          <div class="lu-loctext"><div class="cw-label">Where is this Workout?</div><div class="lu-locname">${esc(s.location)}</div></div>
          <button class="lu-locpill" data-action="open-location" data-target="lineup" aria-label="Change location">${I.swap24}</button>
        </div>
      </div>
      ${pre && ctx.items.length ? `
      <div class="lu-loc lu-vol">
        <div class="lu-loctext"><div class="cw-label">Adjust all Volume</div><div class="lu-locname tnum">${masterVolLabel(ctx.items)}</div></div>
        <button class="lu-locpill" data-action="open-mastervol" aria-label="Set the volume for every exercise">${I.filter}</button>
      </div>` : ''}
      <div class="cw-listlabel">Exercise List (${ctx.items.length})</div>
      ${exerciseCards(ctx)}
      <button class="cw-add" data-action="add-exercise">${I.plus20} Add exercise</button>
    </div>
    ${state.pending ? pendingTray() : pre ? `<div class="cw-footer"><button class="btn solid lu-go" data-action="lets-go" ${ctx.items.length ? '' : 'disabled'}>Let’s Go</button></div>` : ''}
  </div>`;
}

/* ---- Workout Details (read-only) ---- */
export function WorkoutDetailsScreen() {
  const w = db.workouts.find(x => x.id === state.details.wid);
  if (!w) return '';
  const ctx = listCtx('details'), n = timesCompleted(w.id);
  return `
  <div class="cw-screen lu-screen" style="--cw-current:${w.color}">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">Workout Details</span><button class="nav-create" data-action="details-edit">Edit</button></div>
    <div class="cw-body">
      <div class="lu-head"><div class="lu-titlerow"><div class="lu-tile tint" style="--wc:${w.color}">${WORKOUT_ICONS[w.icon]}</div><div><div class="lu-title">${esc(w.name)}</div><div class="lu-count">${n ? `Completed ${plural(n, 'time')}` : 'Not done yet'}</div></div></div></div>
      <div class="cw-listlabel">Exercise List (${ctx.items.length})</div>
      ${exerciseCards(ctx)}
    </div>
  </div>`;
}

/* ---- Start Page / home ----
   Release 1.0 states, drawn with the Dev File home (dark panel, white cards). */
export const todaySession = wid => [...db.sessions].reverse().find(s => s.workoutId === wid && dayKey(new Date(s.finishedAt)) === dayKey());
// Plan stats for the home card: failures earned, and goals reached (each goal hit plus each new goal set) during the plan.
export function planStats(plan) {
  const from = plan.start, to = plan.end, inPlan = at => { const k = dayKey(new Date(at)); return k >= from && k <= to; };
  const ses = db.sessions.filter(s => inPlan(s.finishedAt));
  const failures = ses.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.filter(x => x.type === 'working' && isFail(x)).length, 0), 0);
  const out = derived().outcomes;
  let goals = 0;
  ses.forEach(s => s.exercises.forEach((e, i) => { if (out[`${s.id}:${i}`]?.type === 'hit') goals++; }));
  goals += db.goalEdits.filter(g => g.weight != null && inPlan(g.at)).length;   // every new goal set during the plan counts too
  return { failures, goals };
}
export const doneToday = wid => db.sessions.some(s => s.workoutId === wid && dayKey(new Date(s.finishedAt)) === dayKey());
export function resumeCard() {
  const s = state.session;
  if (!s) return '';
  const st = sessionStats(s);
  return `
    <div class="wcard hm-card">
      <div class="wcard-top">
        <div class="wcard-tile tint" style="--wc:${s.color}">${WORKOUT_ICONS[s.icon] || WORKOUT_ICONS.kick}</div>
        <div class="wcard-text">
          <div class="wcard-name">${esc(s.workoutName)}</div>
          <div class="wcard-sub">${s.started ? 'Paused' : 'Ready to start'}</div>
          <div class="wcard-sub">${s.started ? `Exercise ${s.exIndex + 1} of ${s.exercises.length} · ${plural(st.sets, 'set')} logged` : plural(s.exercises.length, 'exercise')}</div>
        </div>
      </div>
      <div class="wcard-actions"><button class="wpill" data-action="discard-session">Discard</button><button class="wpill dark" data-action="resume-session">${s.started ? 'Resume' : 'Continue'}</button></div>
    </div>`;
}
const restTile = '<div class="wcard-tile hm-resttile">☾</div>';
export function todayCard(pt, plan) {
  const card = (tile, name, subs, actions = '') => `
    <div class="wcard hm-card">
      <div class="wcard-top">${tile}<div class="wcard-text"><div class="wcard-name">${name}</div>${subs.map(x => `<div class="wcard-sub">${x}</div>`).join('')}</div></div>
      ${actions}
    </div>`;
  if (pt.status === 'upcoming') return card(restTile, `Starts in ${plural(pt.startsIn, 'day')}`, [D.dow(parseDay(plan.start))]);
  if (pt.status === 'ended') return card(restTile, 'Plan complete', ['Nice work. Start a new one when you’re ready.'],
    `<div class="wcard-actions"><button class="wpill dark" data-action="home-go" data-to="planwiz">Create a Plan</button></div>`);
  const day = pt.day, w = day && day.type === 'workout' ? db.workouts.find(x => x.id === day.workoutId) : null;
  if (!w) return card(restTile, 'Rest day', [`Day ${pt.index + 1} of ${plan.splitDays}${day && day.type === 'workout' ? ' · that workout was deleted' : ''}`]);
  return workoutCard(w, { label: 'Start', action: 'start-workout', needsExercises: true }, { done: doneToday(w.id) });
}
// Home quotes (shown when nothing is paused and no plan is running).
export const QUOTES = [
  ['The last three or four reps is what makes the muscle grow.', 'Arnold Schwarzenegger'],
  ['Strength does not come from winning. Your struggles develop your strengths.', 'Arnold Schwarzenegger'],
  ['The worst thing I can be is the same as everybody else.', 'Arnold Schwarzenegger'],
  ['The Iron never lies to you.', 'Henry Rollins'],
  ['The Iron is the best antidepressant I have ever found.', 'Henry Rollins'],
  ['Strong people are harder to kill than weak people, and more useful in general.', 'Mark Rippetoe'],
  ['Yeah buddy! Light weight, baby!', 'Ronnie Coleman'],
  ['Ain’t nothin’ but a peanut.', 'Ronnie Coleman'],
  ['Stimulate, don’t annihilate.', 'Lee Haney'],
];
export function workoutMinutes(w) {
  const done = db.sessions.filter(s => s.workoutId === w.id && s.startedAt).map(s => (new Date(s.finishedAt) - new Date(s.startedAt)) / 60000).filter(m => m > 3 && m < 240);
  const m = done.length ? done.reduce((a, b) => a + b, 0) / done.length : w.exercises.reduce((a, e) => a + e.sets * 2, 0);
  return Math.max(5, Math.round(m / 5) * 5);
}
export function workoutCard(w, primary, opts = {}) {
  return `
    <div class="wcard" style="--wc:${w.color}">
      <div class="wcard-top">
        <div class="wcard-tile tint" style="--wc:${w.color}">${WORKOUT_ICONS[w.icon]}</div>
        <div class="wcard-text">
          <div class="wcard-name">${esc(w.name)}</div>
          ${w.exercises.length ? `<div class="mtags">${muscleList(w).split(', ').map(m => `<span class="mtag">${esc(m)}</span>`).join('')}</div>` : '<div class="wcard-sub">No exercises yet</div>'}
          <div class="wcard-sub">${w.exercises.length ? `~${workoutMinutes(w)} minutes, ` : ''}${w.exercises.length} Exercise${w.exercises.length === 1 ? '' : 's'}</div>
        </div>
        ${opts.menu ? `<button class="wcard-kebab" data-action="workout-menu" data-id="${w.id}" aria-label="Workout options">${I.kebab}</button>` : ''}
      </div>
      <div class="wcard-actions">
        ${opts.done ? `<span class="hm-done">${I.checkC('#6c5ce7')} Workout completed</span>
        <button class="wpill" data-action="view-complete" data-id="${esc(todaySession(w.id)?.id || '')}">View</button>` : `
        <button class="wpill" data-action="workout-details" data-id="${w.id}">Details</button>`}
        ${primary && !opts.done ? `<button class="wpill dark" data-action="${primary.action}" data-id="${w.id}" ${primary.needsExercises && !w.exercises.length ? 'disabled' : ''}>${primary.label}</button>` : ''}
      </div>
    </div>`;
}
function workoutsNav(title = 'Workouts') {
  return `<div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">${title}</span><button class="nav-create" data-action="workout-create">Create</button></div>`;
}
const workoutList = (primary, opts) => `
    <div class="wl-list">
      <div class="wl-label">Your Workouts (${db.workouts.length})</div>
      ${db.workouts.map(w => workoutCard(w, primary, opts)).join('') || '<div class="mg-empty">No workouts yet. Tap Create to build one.</div>'}
    </div>`;
export function QuickSelectScreen() {
  return `
  <div class="wl-screen">
    ${statusBar()}${workoutsNav()}
    <div class="wl-body">
      <div class="wl-titleblock"><div class="wl-title">Choose a workout</div><div class="wl-help">What are we hitting today?</div></div>
      ${workoutList({ label: 'Start', action: 'start-workout', needsExercises: true })}
    </div>
  </div>`;
}
// My Workouts: your saved workouts
export function WorkoutsScreen() {
  const tab = state.workoutsTab || 'workouts';
  const seg = (k, icon, label) => `<button class="wt-seg${tab === k ? ' on' : ''}" data-action="workouts-tab" data-tab="${k}" role="tab" aria-selected="${tab === k}">${icon}<span>${label}</span></button>`;
  return `
  <div class="wl-screen">
    ${statusBar()}${workoutsNav('My Workouts')}
    <div class="wl-body">
      <div class="wt-tabs" role="tablist">${seg('workouts', I.book, 'Workouts')}${seg('history', I.history, 'History')}</div>
      ${tab === 'history' ? historyList() : `
      <div class="wl-titleblock"><div class="wl-title">Saved Workouts</div><div class="wl-help">Tap details to see the full workout.</div></div>
      ${workoutList(null, { menu: true })}`}
    </div>
  </div>`;
}
// History: every finished workout, newest first, with its date and time above it
function historyList() {
  const list = [...db.sessions].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
  if (!list.length) return '<div class="mg-empty">No finished workouts yet. Your first one lands here.</div>';
  return `<div class="wh-list">${list.map(s => {
    const d = new Date(s.finishedAt), st = sessionStats(s);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const hits = s.exercises.filter((e, i) => (derived().outcomes[`${s.id}:${i}`] || {}).type === 'hit').length;
    return `
      <div class="wh-item">
        <div class="wh-date">${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${time}</div>
        <button class="wcard wh-card" data-action="view-session" data-id="${s.id}" style="--wc:${s.color}">
          <span class="wcard-tile tint" style="--wc:${s.color}">${WORKOUT_ICONS[s.icon] || ''}</span>
          <span class="wh-text"><span class="wh-name">${esc(s.workoutName)}</span><span class="wh-sub tnum">${plural(st.exercises, 'exercise')} · ${plural(st.sets, 'set')}${hits ? ` · <b>${plural(hits, 'goal')} reached</b>` : ''}</span></span>
          <span class="xd-chev">${I.smChevR}</span>
        </button>
      </div>`;
  }).join('')}</div>`;
}
export function AssignDayScreen() {
  return `
  <div class="wl-screen">
    ${statusBar()}${workoutsNav()}
    <div class="wl-body">
      <div class="wl-titleblock"><div class="wl-title">Choose a workout</div><div class="wl-help">Pick a workout for day ${state.planwiz.pickDay + 1}, or set it as rest.</div></div>
      <div class="wl-rest">
        <div class="wl-moon">☾</div>
        <div class="wl-resttext"><div class="wl-restname">Rest day</div><div class="wl-restsub">Rest up. That’s when you grow.</div></div>
        <button class="wpill dark" data-action="plan-assign" data-type="rest">Select</button>
      </div>
      ${workoutList({ label: 'Select', action: 'plan-assign' })}
    </div>
  </div>`;
}

/* ---- the live session ---- */
// where Next goes: the next unfinished exercise after this one, else the first skipped one
export function nextTarget(s) {
  const open = s.exercises.map((e, i) => i).filter(i => i !== s.exIndex && !exComplete(s.exercises[i]));
  return open.find(i => i > s.exIndex) ?? open[0] ?? null;
}
export function WorkoutSessionScreen() {
  const s = state.session;
  if (!s.exercises.length) return `
  <div class="sess-screen" style="--sess-color:${s.color}">${statusBar()}
    <div class="mg-empty">This workout has no exercises left.<br><br><button class="wpill dark" data-action="open-lineup">Add exercises</button></div>
  </div>`;
  const ex = s.exercises[s.exIndex], info = exInfo(ex), u = eqUnits(ex.equip), sv = eqById(ex.equip);
  const total = s.exercises.length;
  const segs = s.exercises.map((e, i) => {
    let cls = 'sess-progseg';
    // the exercise you're on stays "current" until you move on; then it fills in (or blinks purple)
    if (i === s.exIndex) cls += ' cur';
    else if (exPurple(e)) cls += ' pr';
    else if (exComplete(e)) cls += ' done';
    return `<span class="${cls}"></span>`;
  }).join('');
  const last = lastDone(ex.exId, ex.equip);
  const lastTxt = last ? (() => { const w = workingSets(last.e); const top = w.length ? w.reduce((a, b) => (b.weight > a.weight ? b : a)) : null; return top ? `Last time: ${wt(top.weight, eqUnits(last.e.equip))} × ${top.reps} · ${D.short(new Date(last.s.finishedAt))}` : 'Logged before'; })() : 'Not logged yet';
  // the machine's own photo, else the library photo of this exercise on that kind of equipment
  const imgSrc = sv && photoSrc(sv.photo);   // only your own machine photo; a library shot can suggest the wrong equipment
  const img = imgSrc ? `${PH_EQUIP(eqKind(ex.equip))}<img src="${imgSrc}" alt="" onerror="this.remove()">` : '';
  // goal row button: View a waiting suggestion, the tracker when there's a goal, nothing otherwise
  const sugg = ex.newGoal == null ? pendingSuggestion(ex) : null;
  const goalBtn = sugg ? `<button class="sess-dpill sess-view" data-action="goal-view">View</button>`
    : ex.goal.weight != null ? `<button class="sess-dpill" data-action="session-tracker" aria-label="Open Overload Tracker">${I.graph}</button>` : '';
  const detail = !s.expanded ? '' : `
    <div class="sess-exdetail">
      <div class="sess-swaprow"><button class="wpill sess-swapex" data-action="sess-swap-ex">${I.swap} Swap exercise</button></div>
      <div class="sess-drow">
        <div class="sess-dleft">
          <div class="dimg generic ph kind${img ? ' photo' : ''}">${img || PH_EQUIP(eqKind(ex.equip))}</div>
          <div><div class="dlabel">Equipment</div><div class="dval">${esc(eqLabel(ex.equip))}</div>${sv ? `<div class="dlabel" style="margin-top:2px">At ${esc(sv.locations && sv.locations.length > 1 && state.session && sv.locations.includes(state.session.location) ? state.session.location : (sv.locations || [sv.location]).join(', '))}</div>` : ''}</div>
        </div>
        <button class="sess-dpill" data-action="open-swap" data-owner="session" aria-label="Change equipment">${I.swap24}</button>
      </div>
      <div class="sess-drow">
        <div><div class="dlabel">Volume</div><div class="dval tnum">${ex.goal.sets} Sets · ${ex.goal.reps} Reps</div></div>
        <button class="sess-dpill" data-action="open-volume" data-owner="session" aria-label="Volume settings">${I.filter}</button>
      </div>
      <div class="sess-drow">
        <div><div class="dlabel">${sugg && ex.goal.weight == null ? 'Overload Goal Suggestion' : 'Overload Goal'}</div><div class="dval goal">${ex.goal.weight != null ? `${wtTight(ex.goal.weight, u)} at volume or to failure` : sugg ? `${sugg.sets} Sets · ${sugg.reps} Reps · ${wtTight(sugg.weight, u)}` : 'No Goal Yet'}</div>
        ${sugg && ex.goal.weight != null ? `<div class="dlabel" style="margin-top:2px">Suggested: ${wtTight(sugg.weight, u)}</div>` : ''}
        ${ex.newGoal != null ? `<div class="dlabel" style="margin-top:2px">Next time: ${wtTight(ex.newGoal, u)}</div>` : ''}</div>
        ${goalBtn}
      </div>
    </div>`;
  const working = workingSets(ex);
  const complete = working.length >= ex.goal.sets;
  const logged = setList(ex, u, si => `data-action="edit-set" data-si="${si}"`);
  const nextWeight = working.length ? working[working.length - 1].weight : ex.goal.weight;
  let ghosts = '';
  for (let i = working.length; i < ex.goal.sets; i++)
    ghosts += `<div class="set-cell ghost"><span class="set-badge">${i + 1}</span><span class="set-text">${nextWeight != null ? `<b>${wt(nextWeight, u)}</b><i>×</i>` : ''}<b>${ex.goal.reps} reps</b></span></div>`;
  const nt = nextTarget(s);
  const footer = complete
    ? (nt == null
      ? `<button class="btn solid nextbtn" data-action="sess-finish">Finish Workout ${I.arrowR}</button>`
      : `<button class="btn solid nextbtn" data-action="sess-next">${nt > s.exIndex ? 'Next Exercise' : 'Back to Skipped'} ${I.arrowR}</button>`)
    : `<button class="btn ghost warm" data-action="sess-log" data-type="warmup">Warmup Set</button>
      <button class="btn solid setbtn" data-action="sess-log" data-type="working">Set ${working.length + 1}</button>`;
  return `
  <div class="sess-screen" style="--sess-color:${s.color}">
    ${statusBar()}
    <div class="sess-widget">
      <div class="sess-excard" data-anim="sess-${s.exIndex}">
        <button class="sess-exrow" data-action="sess-toggle">
          <span class="sess-exbadge tnum">${s.exIndex + 1}</span>
          <span class="sess-exmeta">
            <span class="sess-exname">${esc(info.name)}</span>
            <span class="sess-exsub"><span class="mtag">${esc(info.muscle)}</span>${esc(eqLabel(ex.equip))}${sv ? ` · ${esc(sv.locations && state.session && sv.locations.includes(state.session.location) ? state.session.location : sv.location)}` : ''}</span>
          </span>
          <span class="sess-excaret">${s.expanded ? I.caretUp : I.caretDn}</span>
        </button>
        ${detail}
      </div>
      <div class="sess-prog">${segs}</div>
      <div class="sess-transport">
        <span class="sess-exlabel">Exercise <span class="sess-num"><span>${s.exIndex + 1}</span></span> of ${total}</span>
        <button class="sess-tbtn" data-action="sess-move" data-dir="-1" aria-label="Previous exercise" ${s.exIndex ? '' : 'disabled'}>${I.smChevL}</button>
        <button class="sess-tbtn" data-action="sess-pause" aria-label="Pause workout">${I.pause}</button>
        <button class="sess-tbtn" data-action="sess-move" data-dir="1" aria-label="Skip to next exercise" ${s.exIndex < total - 1 ? '' : 'disabled'}>${I.smChevR}</button>
        <button class="sess-tbtn sq" data-action="open-lineup" aria-label="Today’s lineup">${I.list}</button>
      </div>
    </div>
    <div class="sess-sets">
      ${logged ? `<div class="set-list">${logged}</div>` : ''}
      ${ghosts}
      ${complete ? `<button class="set-extra" data-action="sess-log" data-type="working">${I.plus20} Extra Set</button>` : ''}
    </div>
    ${state.pending ? pendingTray() : `<div class="sess-footer">${footer}</div>`}
  </div>`;
}

// SetWidget: log a set, or edit one already logged (a.edit = { si } | { sid, ei, si })
const TARGET = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>';
export function ActiveSetSheet() {
  const a = state.setDraft;
  const [big, small] = steps(a.unit), ul = unitLabel(a.unit);
  const pct = Math.round(a.feel * 100);
  const thumbLeft = feelLeft(a.feel);   // the thumb rests in the middle of its shade (F: all the way right)
  const se = state.session && state.session.exercises[state.session.exIndex];
  const swOf = se ? se.goal.sets : 0, swEx = se ? `${exInfo(se).name} · ${eqLabel(se.equip)}` : '';
  return `
  <div class="scrim" data-action="sess-cancelset">
    <div class="sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="sw-head">
        <div class="sw-title">${a.edit ? 'Edit ' : ''}${a.type === 'warmup' ? `Warmup${a.setNum ? ' ' + a.setNum : ''}` : `Set ${a.setNum}`}${a.type !== 'warmup' && swOf ? `<span class="sw-of">${a.setNum > swOf ? 'Extra set' : `of ${swOf}`}</span>` : ''}</div>
        ${swEx ? `<div class="sw-exname">${esc(swEx)}</div>` : ''}
      </div>
      ${a.hint ? `<div class="sw-goalchip${a.hint.goal ? ' goal' : ''}">${a.hint.goal ? `Overload goal <b class="tnum">${esc(a.hint.title)}</b>` : 'No overload goal yet'}</div>` : ''}
      <div class="sw-group">
        <div class="sw-glabel">${a.bw ? `Weight <span class="sw-bw">${a.weight > 0 ? 'added' : a.weight < 0 ? 'assisted' : 'bodyweight only'}</span>` : 'Weight'}</div>
        <div class="sw-grow">
          <button class="sw-adj" data-action="sw-w" data-d="-${big}">&minus;${big}</button>
          <button class="sw-adj" data-action="sw-w" data-d="-${small}">&minus;${small}</button>
          <label class="sw-val tnum"><span class="sw-numwrap">${a.unit === 'simple' ? '<span class="pre">#</span>' : ''}<input class="sw-in" data-swfield="weight" inputmode="decimal" value="${fmt(a.weight)}" style="width:${Math.max(1, fmt(a.weight).length) + 0.3}ch" aria-label="Weight">${ul ? `<span class="u">${ul}</span>` : ''}</span></label>
          <button class="sw-adj" data-action="sw-w" data-d="${small}">+${small}</button>
          <button class="sw-adj" data-action="sw-w" data-d="${big}">+${big}</button>
        </div>
      </div>
      <div class="sw-group">
        <div class="sw-glabel">Reps</div>
        <div class="sw-grow">
          <button class="sw-adj" data-action="sw-r" data-d="-1">&minus;1</button>
          <label class="sw-val tnum"><input class="sw-in" data-swfield="reps" inputmode="numeric" value="${a.reps}" aria-label="Reps"></label>
          <button class="sw-adj" data-action="sw-r" data-d="1">+1</button>
        </div>
      </div>
      <div class="sw-feelwrap">
        <div class="sw-glabel">Effort Rating</div>
        <div class="ff-wrap">
        <div class="sw-feel" data-feelbar>
          ${['#c8c4e7', '#beb9e7', '#b4ade7', '#aaa2e7', '#9f96e7', '#958be7', '#8b7fe7', '#8174e7', '#7768e7', '#426e8f'].map(c => `<span class="ff-seg" style="background:${c}"></span>`).join('')}
          <div class="ff-text">${a.touched && rpeOf(a.feel) === 'F' ? 'FAILURE' : ''}</div>
          <div class="ff-end"><span class="ff-f">F</span></div>
          <div class="ff-thumb" style="left:${thumbLeft}"><svg class="ff-ring${rpeOf(a.feel) === 'F' && a.touched ? ' on' : ''}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" pathLength="100"/></svg><span class="ff-num">${rpeNum(a.feel)}</span></div>
        </div>
        </div>
      </div>
      <div class="sw-done"><button class="sw-donebtn" data-action="sw-done">DONE</button></div>
      ${a.edit ? '<button class="sw-delete" data-action="sw-delete">Delete this set</button>' : '<div style="height:18px"></div>'}
    </div>
  </div>`;
}

export function OverloadGoalSheet() {
  const g = state.goalEdit, [big, small] = steps(g.unit), ul = unitLabel(g.unit);
  return `
  <div class="scrim" data-action="close-goal">
    <div class="sheet goal-sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="sheet-head"><div class="sheet-title purple">Overload Goal</div><div class="sheet-sub">Change your goal for...</div></div>
      <div class="goal-card">
        <div class="goal-exname">${esc(g.name)}</div>
        <div class="goal-exmeta"><span class="mus">${g.muscle}</span>${g.sets} Sets x ${g.reps} Reps</div>
        <div class="goal-exequip">${esc(eqLabel(g.equip))}</div>
      </div>
      <div class="goal-wlabel">Goal weight${ul ? ` (${ul})` : ''}</div>
      <div class="sw-group">
        <div class="sw-grow">
          <button class="sw-adj" data-action="goal-adj" data-d="-${big}">&minus;${big}</button>
          <button class="sw-adj" data-action="goal-adj" data-d="-${small}">&minus;${small}</button>
          <label class="sw-val tnum"><input class="sw-in" data-goalfield inputmode="decimal" value="${fmt(g.weight)}" aria-label="Goal weight"></label>
          <button class="sw-adj" data-action="goal-adj" data-d="${small}">+${small}</button>
          <button class="sw-adj" data-action="goal-adj" data-d="${big}">+${big}</button>
        </div>
      </div>
      <div class="sheet-actions"><button class="btn ghost" data-action="close-goal">Nevermind</button><button class="btn solid" data-action="save-goal">Save</button></div>
    </div>
  </div>`;
}

export function UpdateGoalSheet() {
  const u = state.goalUpdate, e = state.session.exercises[state.session.exIndex], unit = eqUnits(e.equip);
  return `
  <div class="scrim" data-action="ug-cancel">
    <div class="sheet ug-sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="ug-body">
        <div class="ug-titleblock"><div class="ug-title">Update goal weight?</div><div class="ug-text">Lighter weight, strong effort. Make this your goal?</div></div>
        <div class="ug-summary">${e.goal.sets} sets · ${e.goal.reps} reps · <s>${wtTight(u.from, unit)}</s> <span>${wtTight(u.to, unit)}</span></div>
        <div class="ug-actions"><button class="ug-btn" data-action="ug-cancel">Cancel</button><button class="ug-btn dark" data-action="ug-confirm">Yes, Update Goal</button></div>
      </div>
    </div>
  </div>`;
}

// "Set an overload goal?" — offered when the required sets are done (see goalPrompt in app.js)
export function GoalAskSheet() {
  const g = state.goalAsk, e = state.session.exercises[g.ei] || state.session.exercises[state.session.exIndex], u = eqUnits(e.equip);
  const [big, small] = steps(u), ul = unitLabel(u);
  const pick = g.kind === 'pick', raise = g.kind === 'raise' && !g.noGoal;
  const title = g.first ? 'Your first goal!' : raise ? 'Raise your goal?' : pick ? (g.heavy ? 'Lighten it up?' : 'Too light?') : 'New overload goal!';
  // New Goal: locked until you tap the pencil, so the suggestion is the easy path
  const val = g.editing
    ? `<label class="sw-val tnum"><span class="sw-numwrap">${u === 'simple' ? '<span class="pre">#</span>' : ''}<input class="sw-in" data-goalaskfield inputmode="decimal" value="${fmt(g.weight)}" style="width:${Math.max(1, fmt(g.weight).length) + 0.3}ch" aria-label="New goal weight">${ul ? `<span class="u">${ul}</span>` : ''}</span></label>`
    : `<div class="sw-val ga-locked tnum"><span class="sw-numwrap">${u === 'simple' ? '<span class="pre">#</span>' : ''}<span>${fmt(g.weight)}</span>${ul ? `<span class="u">${ul}</span>` : ''}</span></div>`;
  const picker = `
        <div class="ga-picker">
          <div class="goal-wlabel">New Goal</div>
          ${g.editing ? `
          <div class="sw-grow">
            <button class="sw-adj" data-action="goalask-adj" data-d="-${big}">&minus;${big}</button>
            <button class="sw-adj" data-action="goalask-adj" data-d="-${small}">&minus;${small}</button>
            ${val}
            <button class="sw-adj" data-action="goalask-adj" data-d="${small}">+${small}</button>
            <button class="sw-adj" data-action="goalask-adj" data-d="${big}">+${big}</button>
          </div>` : `
          <div class="ga-lockrow">
            <span class="ga-spacer" aria-hidden="true"></span>
            ${val}
            <button class="sess-dpill ga-edit" data-action="goalask-edit" aria-label="Edit goal weight">${I.pencil}</button>
          </div>`}
          ${g.from != null && !g.noGoal ? `<div class="ga-from">Today: ${wt(g.from, u)}</div>` : ''}
        </div>`;
  const ring = g.first ? '<div class="ga-first" data-goal-lottie aria-hidden="true"></div>' : '';
  return `
  <div class="scrim" data-action="goalask-no">
    <div class="sheet ug-sheet${g.first ? ' ga-firstsheet' : ''}" data-stop>
      <div class="sheet-grab"></div>
      <div class="ug-body">
        ${ring}
        <div class="ug-titleblock">
          <div class="ug-title">${title}</div>
          <div class="ug-text">${esc(g.reason || '')}</div>
        </div>
        ${picker}
        <div class="ug-summary">${esc(exInfo(e).name)} · ${g.sets} × ${g.reps} · ${raise ? `<s>${wtTight(g.from, u)}</s> ` : ''}<span>${wtTight(g.weight, u)}</span></div>
        <div class="ug-actions"><button class="ug-btn" data-action="goalask-no">Not Now</button><button class="ug-btn dark" data-action="goalask-yes">${g.noGoal ? 'Set as Goal' : 'Set Goal'}</button></div>
      </div>
    </div>
  </div>`;
}

// Pause (Release 1.0): confirm → home; the workout resumes from the home screen.
export function PauseSheet() {
  const st = sessionStats(state.session);
  const row = (action, icon, label, sub, danger) => `
          <button class="xd-act pz-row" data-action="${action}">
            <span class="xd-acticon${danger ? ' del' : ''}">${icon}</span>
            <span class="pz-text"><span class="pz-label${danger ? ' danger' : ''}">${label}</span><span class="pz-sub">${sub}</span></span>
            ${I.smChevR}
          </button>`;
  return `
  <div class="scrim" data-action="close-pause">
    <div class="sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="mn-head"><div class="vs-title">Pause Workout?</div><div class="vs-sub">Everything’s saved.</div></div>
      <div class="mn-list">
        ${row('pause-confirm', I.pause, 'Pause Workout', 'Resume it from the home screen')}
        ${st.sets ? row('finish-early', I.checkC('#1C1B1F'), 'Finish Workout Now', `Save the ${st.sets} set${st.sets === 1 ? '' : 's'} you’ve logged`) : ''}
        ${row('close-pause', I.arrowR.replace(/fill="white"/g, 'fill="#1C1B1F"'), 'Keep Going', 'Back to your workout')}
        ${row('discard-session', I.trash24, 'Discard Workout', 'Delete everything from this workout', true)}
      </div>
    </div>
  </div>`;
}

/* ---- Workout Complete + past workout log (same layout) ----
   Release 1.0 content in the Dev File layout: nav header, title block, white
   exercise cards with the session's set list. */
// Bottom band on a Workout Complete card: goal reached (with the new goal), or first goal set.
function outcomeLine(s, i, e) {
  const o = derived().outcomes[`${s.id}:${i}`];
  if (!o || o.type === 'miss') return '';
  const u = eqUnits(e.equip), hit = o.type === 'hit', v = `${e.goal.sets} Sets · ${e.goal.reps} Reps · `;
  return `
        <div class="wc-band${hit ? ' hit' : ''}">
          <span class="wc-band-icon">${hit ? I.checkW : I.graph}</span>
          <div class="wc-band-text">
            <div class="wc-band-label">${hit ? 'Goal Reached' : 'New Goal Set'}</div>
            <div class="wc-band-val tnum">${hit ? (o.newGoal != null ? `New goal: ${v}<b>${wtTight(o.newGoal, u)}</b>` : `${v}<b>${wtTight(o.before, u)}</b>`) : `${v}<b>${wtTight(o.newGoal, u)}</b>`}</div>
          </div>
        </div>`;
}
// One step per exercise, as tall as its working sets (relative to the biggest).
export function SessionLogScreen() {
  const s = db.sessions.find(x => x.id === state.log.sid);
  if (!s) return '';
  const complete = state.log.mode === 'complete', st = sessionStats(s), d = new Date(s.finishedAt);
  const hits = s.exercises.filter((e, i) => (derived().outcomes[`${s.id}:${i}`] || {}).type === 'hit').length;
  // goals you set during this workout (from the goal prompts), for next time
  const newGoals = s.exercises.map((e, i) => ({ e, i, o: derived().outcomes[`${s.id}:${i}`] })).filter(x => x.o && x.o.newGoal != null);
  const newGoalsCard = newGoals.length ? `
      <div class="wc-newgoals">
        <div class="wc-ng-head"><span class="wc-ng-ic">${I.graph}</span><span><span class="wc-ng-title">New goals</span><span class="wc-ng-sub">For next time. Go get ’em.</span></span></div>
        ${newGoals.map(({ e, o }) => `
        <div class="wc-ng-row">
          <span class="wc-ng-text"><span class="wc-ng-name">${esc(exInfo(e).name)}</span><span class="wc-ng-meta tnum">${esc(e.equipName || eqLabel(e.equip))} · ${(e.newGoalVol || e.goal).sets} × ${(e.newGoalVol || e.goal).reps}</span></span>
          <span class="wc-ng-w tnum">${o.before != null ? `<s>${wtTight(o.before, eqUnits(e.equip))}</s>` : ''}${wtTight(o.newGoal, eqUnits(e.equip))}</span>
        </div>`).join('')}
      </div>` : '';
  // suggestions you skipped (or never got asked about), one tap to accept
  const pending = (db.suggestions || []).filter(x => x.sid === s.id);
  const pendingCard = pending.length ? `
      <div class="wc-newgoals wc-pending">
        <div class="wc-ng-head"><span class="wc-ng-ic">${I.graph}</span><span><span class="wc-ng-title">Overload Goal Suggestions</span><span class="wc-ng-sub">Want these for next time?</span></span></div>
        ${pending.map(x => `
        <div class="wc-sg-row">
          <div class="g-label">${esc(exById(x.exId) ? exById(x.exId).name : 'Exercise')} · ${esc(eqLabel(x.equip))}</div>
          <div class="tk-sugg-value tnum">${x.sets} Sets • ${x.reps} Reps • ${wtTight(x.weight, eqUnits(x.equip))}</div>
          ${x.reason ? `<div class="tk-sugg-reason">${esc(x.reason)}</div>` : ''}
          <div class="wcard-actions"><button class="wpill" data-action="sugg-no" data-key="${esc(x.key)}">Dismiss</button><button class="wpill dark" data-action="sugg-yes" data-key="${esc(x.key)}">Set Goal</button></div>
        </div>`).join('')}
      </div>` : '';
  const cards = s.exercises.map((e, i) => {
    if (!e.sets.length) return '';
    const info = exInfo(e), u = eqUnits(e.equip);
    return `
      <div class="wc-card">
        <div class="cw-ex-row wc-exrow">
          <span class="cw-badge tnum" style="--cw-current:${s.color}">${i + 1}</span>
          <span class="cw-ex-meta"><span class="cw-ex-name">${esc(info.name)}</span><span class="cw-ex-sub"><span class="mtag">${esc(info.muscle)}</span>${esc(e.equipName || eqLabel(e.equip))}</span></span>
          ${e.exId && exById(e.exId) ? `<button class="sess-dpill wc-trk" data-action="log-tracker" data-ei="${i}" aria-label="Open Overload Tracker">${I.graph}</button>` : ''}
        </div>
        <div class="set-list">${setList(e, u, si => `data-action="edit-logged-set" data-ei="${i}" data-si="${si}"`)}</div>
        ${outcomeLine(s, i, e)}
      </div>`;
  }).join('');
  return `
  <div class="wc-screen" style="--wc:${s.color}">
    ${statusBar()}
    <div class="nav">
      ${complete ? '' : `<button class="icon-btn" data-action="back">${I.chevL}</button>`}
      <span class="nav-title">${complete ? 'Workout Complete' : 'Workout'}</span>
      ${complete ? '' : `<button class="icon-btn wc-navbtn" data-action="session-menu" aria-label="Workout options">${I.kebab}</button>`}
    </div>
    <div class="wl-body wc-body">
      ${complete ? `
      <div class="wc-hero">
        <div class="wc-anim" data-lottie="complete" aria-hidden="true"></div>
        <div class="wc-cheer">Nice work!</div>
        <div class="wc-cheersub">${esc(s.workoutName)} is in the books${hits ? `, and you hit ${plural(hits, 'overload goal')}` : ''}${newGoals.length ? `. ${plural(newGoals.length, 'new goal')} set for next time` : ''}.</div>
      </div>` : ''}
      <div class="wc-stats">
        <div class="wc-stat"><b class="tnum">${st.sets}</b><span>Sets</span></div>
        <div class="wc-stat"><b class="tnum">${st.fails}</b><span>Fails</span></div>
        <div class="wc-stat goal"><b class="tnum">${hits}</b><span>Goals Reached</span></div>
      </div>
      <div class="wc-titlerow">
        <div class="wcard-tile wc-tile tint" style="--wc:${s.color}">${WORKOUT_ICONS[s.icon] || WORKOUT_ICONS.kick}</div>
        <div class="wl-titleblock">
          <div class="wl-title">${esc(s.workoutName)}${s.edited ? '<span class="eqd-chip wl-edited">Edited</span>' : ''}</div>
          <div class="wl-help">${D.dow(d)}, ${d.getFullYear()} · ${plural(st.exercises, 'exercise')}</div>
        </div>
      </div>
      ${complete ? `<div class="wc-actions">
        <button class="cw-add" data-action="add-more">${I.plus20} Add more exercises</button>
        <button class="wc-share" data-action="share-session" aria-label="Share workout">${I.share}</button>
      </div>` : ''}
      ${newGoalsCard}
      ${pendingCard}
      <div class="wc-list">${cards || '<div class="mg-empty">No sets were logged.</div>'}</div>
    </div>
    ${complete ? '<div class="cw-footer"><button class="btn solid wc-home" data-action="complete-home">Back to the Homepage</button></div>' : ''}
  </div>`;
}

/* ===================== CREATE A PLAN (5-step wizard) ====================== */
function planCalendar(w) {
  const [y, m] = w.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1), dim = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = first.getDay(); i > 0; i--) cells.push({ k: dayKey(new Date(y, m - 1, 1 - i)), dim: true });
  for (let d = 1; d <= dim; d++) cells.push({ k: dayKey(new Date(y, m - 1, d)) });
  for (let t = 1; cells.length % 7; t++) cells.push({ k: dayKey(new Date(y, m, t)), dim: true });
  const today = dayKey();
  const html = cells.map(c => {
    let cls = 'cal-num';
    if (c.dim) cls += ' dim';
    if (c.k === w.start || c.k === w.end) cls += ' end';
    else if (c.k > w.start && c.k < w.end) cls += ' range';
    return `<button class="cal-cell" data-action="plan-date" data-day="${c.k}"><div class="${cls}">${parseDay(c.k).getDate()}</div>${c.k === today ? '<span class="cal-today-dot"></span>' : ''}</button>`;
  }).join('');
  return `
    <div class="cal-card">
      <div class="cal-grid">${html}</div>
      <div class="cal-dows">${D.DOW.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cal-foot"><div class="cal-month">${D.month(first)}</div><div class="cal-nav"><button data-action="plan-month" data-dir="-1" aria-label="Previous month">${I.chevL}</button><button data-action="plan-month" data-dir="1" aria-label="Next month">${I.navR}</button></div></div>
    </div>`;
}
function planDayMeta(day) {
  if (day.type === 'rest') return { name: 'Rest day', sub: 'Recovery', cls: 'rest' };
  const w = day.type === 'workout' && db.workouts.find(x => x.id === day.workoutId);
  if (!w) return { name: 'Add a workout', sub: '', cls: 'empty' };
  return { name: w.name, sub: `${muscleList(w)} · ${plural(w.exercises.length, 'exercise')}`, cls: 'work' };
}
const dayBadge = (m, i) => `<span class="plan-daybadge ${m.cls === 'work' ? 'work' : m.cls === 'empty' ? 'empty' : 'rest'}">${i + 1}</span>`;
export function PlanWizard() {
  const w = state.planwiz, STEPS = 5;
  const segs = Array.from({ length: STEPS }, (_, i) => `<div class="wiz-seg ${i < w.step ? 'on' : ''}"></div>`).join('');
  const totalDays = daysBetween(w.start, w.end) + 1;
  const cycles = Math.floor(totalDays / w.splitDays);
  const err = w.err ? `<div class="wiz-err">${esc(w.err)}</div>` : '';
  let body = '';
  if (w.step === 1) {
    const chips = ['Push Pull Legs', 'Upper / Lower', 'Full Body', 'Bro Split'].map(n => `<button class="qchip" data-action="plan-quickname" data-name="${n}">${n}</button>`).join('');
    body = `
      <div class="wiz-title">Name your plan</div>
      <div class="wiz-help">You’ll see it on your home screen.</div>
      <input class="wiz-input" type="text" placeholder="e.g. Push Pull Legs" data-planwizname value="${esc(w.name)}" autocomplete="off">${err}
      <div class="wiz-help" style="margin-top:18px;font-size:13px">Quick names</div>
      <div class="wiz-quick">${chips}</div>`;
  } else if (w.step === 2) {
    body = `
      <div class="wiz-title">How long is your split?</div>
      <div class="wiz-help">Days before it repeats. 3 to 7 is a sweet spot.</div>
      <div class="plan-stepper"><div class="ps-label">Days</div><div class="ps-row">
        <button class="st-btn" data-action="plan-split" data-dir="-1" ${w.splitDays <= 1 ? 'disabled' : ''}>&minus;</button>
        <div class="st-value tnum">${w.splitDays}</div>
        <button class="st-btn" data-action="plan-split" data-dir="1" ${w.splitDays >= 10 ? 'disabled' : ''}>+</button>
      </div></div>
      <div class="plan-info"><div class="pi-icon">${I.refresh}</div><div><div class="pi-t1">Repeats every ${plural(w.splitDays, 'day')}</div><div class="pi-t2">You’ll fill in each day next.</div></div></div>`;
  } else if (w.step === 3) {
    const rows = w.days.slice(0, w.splitDays).map((day, i) => {
      const m = planDayMeta(day);
      return `
        <button class="plan-dayrow" data-action="plan-pickday" data-i="${i}">
          ${dayBadge(m, i)}
          <span class="plan-daytext"><span class="plan-dayname ${m.cls === 'empty' ? 'empty' : ''}">${esc(m.name)}</span>${m.sub ? `<span class="plan-daysub">${esc(m.sub)}</span>` : ''}</span>
          <span class="plan-daychev">${I.smChevR}</span>
        </button>`;
    }).join('');
    body = `<div class="wiz-title">Assign your days</div><div class="wiz-help">Day 1 is your start date. Don’t skip rest days.</div>${err}<div class="plan-daycard">${rows}</div>`;
  } else if (w.step === 4) {
    const f = (k, label, val) => `<button class="plan-datefield ${w.pick === k ? 'on' : ''}" data-action="plan-pickfield" data-k="${k}"><div class="pf-label">${label}</div><div class="pf-value">${val}</div></button>`;
    body = `
      <div class="wiz-title">Set your schedule</div>
      <div class="wiz-help">Your split repeats between these dates.</div>
      <div class="plan-datefields">
        ${f('start', 'Start date', D.short(parseDay(w.start)))}
        ${f('end', 'End date', D.short(parseDay(w.end)))}
        <div class="plan-datefield"><div class="pf-label"># of Days</div><div class="pf-value tnum">${totalDays}</div></div>
      </div>${err}
      ${planCalendar(w)}`;
  } else {
    const lineup = w.days.slice(0, w.splitDays).map((day, i) => { const m = planDayMeta(day); return `<div class="plan-lurow">${dayBadge(m, i)}<span class="plan-luname ${m.cls !== 'work' ? 'rest' : ''}">${esc(m.name)}</span></div>`; }).join('');
    const editPill = step => `<button class="plan-redit" data-action="plan-edit" data-step="${step}">Edit ${I.editPen}</button>`;
    body = `
      <div class="wiz-title">Review your plan</div>
      <div class="wiz-help">Look good? Save it.</div>
      <div class="plan-review">
        <div class="plan-rcard"><div class="plan-rhead"><div><div class="rc-label">Plan name</div><div class="rc-value">${esc(w.name)}</div></div>${editPill(1)}</div></div>
        <div class="plan-rcard"><div class="plan-rhead"><div><div class="rc-label">Split length</div><div class="rc-value">${plural(w.splitDays, 'day')}</div><div class="rc-sub">Repeats every ${plural(w.splitDays, 'day')}</div></div>${editPill(2)}</div></div>
        <div class="plan-rcard"><div class="plan-rhead"><div><div class="rc-label">Schedule</div><div class="rc-value">${D.long(parseDay(w.start))} to ${D.long(parseDay(w.end))}</div><div class="rc-sub">${plural(totalDays, 'day')} · ${plural(cycles, 'full cycle')}</div></div>${editPill(4)}</div></div>
        <div class="plan-rcard"><div class="plan-rhead"><div class="rc-label">Workout Lineup</div>${editPill(3)}</div><div class="plan-lineup">${lineup}</div></div>
      </div>`;
  }
  const last = w.step === STEPS;
  const footer = w.step === 1
    ? `<button class="btn solid" data-action="plan-next">Continue</button>`
    : `<button class="btn ghost back" data-action="plan-prev">Back</button><button class="btn solid" data-action="plan-next">${last ? 'Save Plan' : 'Continue'}</button>`;
  return `
  <div class="wiz-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="plan-headback">${I.chevL}</button><span class="nav-title">${w.editing ? 'Edit Plan' : 'Create a Plan'}</span></div>
    <div class="wiz-header"><div class="wiz-progress">${segs}</div><span class="wiz-count">${w.step} of ${STEPS}</span></div>
    <div class="wiz-body">${body}</div>
    <div class="wiz-footer">${footer}</div>
  </div>`;
}
