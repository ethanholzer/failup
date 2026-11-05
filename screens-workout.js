// ============================================================================
// FailUp — workout screens: home, workouts, Today's Lineup, the live session,
// set sheets, Workout Complete / past workout logs, and the plan wizard.
// ============================================================================
import { state } from './data.js';
import { I, WORKOUT_ICONS, statusBar, fmt, esc, wt, wtTight, D } from './ui.js';
import {
  db, exById, eqById, eqLabel, eqUnits, unitLabel, unitWord, steps, goalFor, isFail, derived, photoSrc,
  timesCompleted, lastDone, dayKey, parseDay, daysBetween, addDays, planToday,
} from './store.js';
import { eqImg } from './screens-library.js';

/* ------------------------------ shared logic ------------------------------ */
export const exInfo = it => { const x = exById(it.exId); return x ? { name: x.name, muscle: x.muscle } : { name: it.name || 'Exercise', muscle: it.muscle || '' }; };
export function rpeOf(feel) {
  const band = Math.min(9, Math.floor(feel * 10));
  return band === 9 ? 'F' : `RPE ${band + 1}`;
}
// A set is purple when it's at (or above) the goal weight AND either hit the
// goal reps or was taken to failure. No goal yet → never purple.
export const setPurple = (st, e) => e.goal.weight != null && st.type === 'working' && st.weight >= e.goal.weight && (st.reps >= e.goal.reps || isFail(st));
export const exPurple = e => e.goal.weight != null && e.sets.filter(st => setPurple(st, e)).length >= e.goal.sets;
export const workingSets = e => e.sets.filter(st => st.type === 'working');
export const exComplete = e => workingSets(e).length >= e.goal.sets;

// One logged set. `tap` makes it a button that opens the set editor.
export function setRow(st, label, kind, e, unit, tap) {
  const tag = kind !== 'working' ? '' : isFail(st) ? '<span class="set-tag fail">F</span>' : `<span class="set-tag">${rpeOf(st.feel)}</span>`;
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
  return `${exInfo(it).muscle} · ${v.sets}s x ${v.reps}r${g != null ? ` · <span class="lbs">${wtTight(g, u)}</span>` : ''}`;
}
export function exerciseCards(ctx) {
  if (!ctx.items.length) return `<div class="cw-empty">${ctx.readOnly ? 'No exercises in this workout yet.' : 'No exercises yet. Add your first one below.'}</div>`;
  return ctx.items.map((it, i) => {
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
          <div class="cw-eq">
            <div class="cw-eq-text"><div class="cw-label">Default Equipment</div><div class="cw-eq-name">${esc(eqLabel(it.equip))}${sv ? ` <span class="cw-eq-loc">· ${esc(sv.location)}</span>` : ''}</div></div>
            ${ro ? '' : `<button class="cw-eq-swap" data-action="open-swap" data-i="${i}" aria-label="Change equipment">${I.swap24}</button>`}
          </div>
          <div class="cw-steppers">${stepper('Sets', 'sets')}${stepper('Reps', 'reps')}</div>
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
      <div class="cw-ex-card${open ? ' open' : ''}${ro ? ' ro' : ''}">
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
      <div class="lu-tile cw-tile" style="background:${c.color}">${WORKOUT_ICONS[c.icon]}</div>
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
      ${s.workoutId && db.workouts.some(w => w.id === s.workoutId) ? '<button class="nav-create" data-action="lineup-edit">Edit</button>' : ''}
    </div>
    <div class="cw-body">
      <div class="lu-head">
        <div class="lu-titlerow">
          <div class="lu-tile" style="background:${s.color}">${WORKOUT_ICONS[s.icon] || WORKOUT_ICONS.kick}</div>
          <div><div class="lu-title">${esc(s.workoutName)}</div><div class="lu-count">${n ? `Workout completed ${plural(n, 'time')}` : 'First time doing this workout'}</div></div>
        </div>
        <div class="lu-loc">
          <div class="lu-loctext"><div class="cw-label">Where is this Workout?</div><div class="lu-locname">${esc(s.location)}</div></div>
          <button class="lu-locpill" data-action="open-location" data-target="lineup" aria-label="Change location">${I.swap24}</button>
        </div>
      </div>
      <div class="cw-listlabel">Exercise List (${ctx.items.length})</div>
      ${pre ? '<div class="lu-help">Changes here only apply to today. Edit the workout to change it for good.</div>' : ''}
      ${exerciseCards(ctx)}
      <button class="cw-add" data-action="add-exercise">${I.plus20} Add exercise</button>
    </div>
    ${pre ? `<div class="cw-footer"><button class="btn solid lu-go" data-action="lets-go" ${ctx.items.length ? '' : 'disabled'}>Let’s Go</button></div>` : ''}
  </div>`;
}

/* ---- Workout Details (read-only) ---- */
export function WorkoutDetailsScreen() {
  const w = db.workouts.find(x => x.id === state.details.wid);
  if (!w) return '';
  const ctx = listCtx('details'), n = timesCompleted(w.id);
  return `
  <div class="cw-screen lu-screen has-footer" style="--cw-current:${w.color}">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">Workout Details</span><button class="nav-create" data-action="details-edit">Edit</button></div>
    <div class="cw-body">
      <div class="lu-head"><div class="lu-titlerow"><div class="lu-tile" style="background:${w.color}">${WORKOUT_ICONS[w.icon]}</div><div><div class="lu-title">${esc(w.name)}</div><div class="lu-count">${n ? `Completed ${plural(n, 'time')}` : 'Not done yet'}</div></div></div></div>
      <div class="cw-listlabel">Exercise List (${ctx.items.length})</div>
      ${exerciseCards(ctx)}
    </div>
    <div class="cw-footer"><button class="btn solid" data-action="start-workout" data-id="${w.id}" ${w.exercises.length ? '' : 'disabled'}>Start Workout</button></div>
  </div>`;
}

/* ---- Start Page / home ----
   Release 1.0 states, drawn with the Dev File home (dark panel, white cards). */
const doneToday = wid => db.sessions.some(s => s.workoutId === wid && dayKey(new Date(s.finishedAt)) === dayKey());
function resumeCard() {
  const s = state.session;
  if (!s) return '';
  const st = sessionStats(s);
  return `
    <div class="wcard hm-card">
      <div class="wcard-top">
        <div class="wcard-tile" style="background:${s.color}">${WORKOUT_ICONS[s.icon] || WORKOUT_ICONS.kick}</div>
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
function todayCard(pt, plan) {
  const card = (tile, name, subs, actions = '') => `
    <div class="wcard hm-card">
      <div class="wcard-top">${tile}<div class="wcard-text"><div class="wcard-name">${name}</div>${subs.map(x => `<div class="wcard-sub">${x}</div>`).join('')}</div></div>
      ${actions}
    </div>`;
  if (pt.status === 'upcoming') return card(restTile, `Starts in ${plural(pt.startsIn, 'day')}`, [D.dow(parseDay(plan.start))]);
  if (pt.status === 'ended') return card(restTile, 'Plan complete', ['Start a new plan when you’re ready.'],
    `<div class="wcard-actions"><button class="wpill dark" data-action="home-go" data-to="planwiz">Create a Plan</button></div>`);
  const day = pt.day, w = day && day.type === 'workout' ? db.workouts.find(x => x.id === day.workoutId) : null;
  if (!w) return card(restTile, 'Rest day', [`Day ${pt.index + 1} of ${plan.splitDays}${day && day.type === 'workout' ? ' · that workout was deleted' : ''}`]);
  return workoutCard(w, { label: 'Start', action: 'start-workout', needsExercises: true }, { done: doneToday(w.id) });
}
export function HomeScreen() {
  const plan = db.plan, pt = planToday();
  const top = `
    <img class="home-hero" src="./assets/hero.jpg" alt="">
    <div class="home-top">${statusBar(true)}<div class="home-bar"><div class="home-logo"><span class="fail">Fail</span>Up</div>
      <div class="home-icons">
        <button class="home-ibtn" data-action="home-go" data-to="workouts" aria-label="Workouts">${I.book}</button>
        <button class="home-ibtn" data-action="home-go" data-to="exercises" aria-label="Exercises">${I.barbell}</button>
        <button class="home-ibtn" data-action="home-go" data-to="equipment" aria-label="Equipment">${I.equipment}</button>
        <button class="home-ibtn" data-action="home-go" data-to="settings" aria-label="Settings">${I.gear}</button>
      </div></div></div>
    <div class="home-headline">REACH <span class="hl">FAILURE</span><br>GET <span class="hl">STRONGER</span></div>`;
  const quick = `<button class="home-cta quick" data-action="home-go" data-to="quickselect">${I.quickstart}<span>Quickstart</span></button>`;
  if (!plan) return `
  <div class="home">${top}
    <div class="home-panel">
      ${resumeCard()}
      ${quick}
      <button class="home-cta" data-action="home-go" data-to="planwiz">${I.addCircle}<span>Create a Workout Plan</span></button>
    </div>
  </div>`;
  return `
  <div class="home withplan">${top}
    <div class="home-panel">
      ${resumeCard()}
      <div class="hm-planhead">
        <div>
          <div class="hm-planname">${esc(plan.name)}</div>
          <div class="hm-planmeta">${plan.splitDays} day split · ${D.short(parseDay(plan.start))} to ${D.long(parseDay(plan.end))}</div>
        </div>
        <button class="hm-kebab" data-action="plan-menu" aria-label="Plan options">${I.kebab}</button>
      </div>
      <div class="hm-label">Today · ${D.dow(new Date())}</div>
      ${todayCard(pt, plan)}
      ${quick}
    </div>
  </div>`;
}

/* ---- workout cards & lists ---- */
// "~45 minutes": your average time for this workout, or about 2 minutes a set.
export function workoutMinutes(w) {
  const done = db.sessions.filter(s => s.workoutId === w.id && s.startedAt).map(s => (new Date(s.finishedAt) - new Date(s.startedAt)) / 60000).filter(m => m > 3 && m < 240);
  const m = done.length ? done.reduce((a, b) => a + b, 0) / done.length : w.exercises.reduce((a, e) => a + e.sets * 2, 0);
  return Math.max(5, Math.round(m / 5) * 5);
}
export function workoutCard(w, primary, opts = {}) {
  return `
    <div class="wcard">
      <div class="wcard-top">
        <div class="wcard-tile" style="background:${w.color}">${WORKOUT_ICONS[w.icon]}</div>
        <div class="wcard-text">
          <div class="wcard-name">${esc(w.name)}</div>
          <div class="wcard-sub">${esc(muscleList(w)) || 'No exercises yet'}</div>
          <div class="wcard-sub">${w.exercises.length ? `~${workoutMinutes(w)} minutes, ` : ''}${w.exercises.length} Exercise${w.exercises.length === 1 ? '' : 's'}</div>
        </div>
        ${opts.menu ? `<button class="wcard-kebab" data-action="workout-menu" data-id="${w.id}" aria-label="Workout options">${I.kebab}</button>` : ''}
      </div>
      <div class="wcard-actions">
        ${opts.done ? `<span class="hm-done">${I.checkC('#6c5ce7')} Workout completed</span>` : ''}
        <button class="wpill" data-action="workout-details" data-id="${w.id}">Details</button>
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
      <div class="wl-titleblock"><div class="wl-title">Choose a workout</div><div class="wl-help">What’s the workout for today?</div></div>
      ${workoutList({ label: 'Start', action: 'start-workout', needsExercises: true })}
    </div>
  </div>`;
}
// My Workouts: Library + History tabs
export function WorkoutsScreen() {
  const tab = state.workoutsTab || 'library';
  const tabs = `<div class="tk-seg wl-tabs"><button class="${tab === 'library' ? 'on' : ''}" data-action="workouts-tab" data-tab="library">Library</button><button class="${tab === 'history' ? 'on' : ''}" data-action="workouts-tab" data-tab="history">History</button></div>`;
  let body;
  if (tab === 'library') body = workoutList({ label: 'Start', action: 'start-workout', needsExercises: true }, { menu: true });
  else {
    const list = [...db.sessions].reverse();
    const groups = [];
    for (const s of list) {
      const m = D.month(new Date(s.finishedAt));
      if (!groups.length || groups[groups.length - 1].m !== m) groups.push({ m, items: [] });
      groups[groups.length - 1].items.push(s);
    }
    body = groups.map(g => `
      <div class="wl-list">
        <div class="wl-label">${g.m}</div>
        ${g.items.map(s => {
          const st = sessionStats(s), d = new Date(s.finishedAt);
          return `
          <button class="wl-hist" data-action="view-session" data-id="${s.id}">
            <div class="wcard-tile" style="background:${s.color}">${WORKOUT_ICONS[s.icon] || WORKOUT_ICONS.kick}</div>
            <div class="wl-histtext">
              <div class="wcard-name">${esc(s.workoutName)}${s.edited ? '<span class="eqd-chip wl-edited">Edited</span>' : ''}</div>
              <div class="wcard-sub">${D.dow(d)} · ${plural(st.exercises, 'exercise')} · ${plural(st.sets, 'set')}${st.fails ? ` · ${st.fails} to failure` : ''}</div>
            </div>
            <span class="xd-chev">${I.smChevR}</span>
          </button>`;
        }).join('')}
      </div>`).join('') || '<div class="mg-empty">Finished workouts show up here.</div>';
  }
  return `
  <div class="wl-screen">
    ${statusBar()}${workoutsNav('My Workouts')}
    <div class="wl-body">${tabs}${body}</div>
  </div>`;
}
export function AssignDayScreen() {
  return `
  <div class="wl-screen">
    ${statusBar()}${workoutsNav()}
    <div class="wl-body">
      <div class="wl-titleblock"><div class="wl-title">Choose a workout</div><div class="wl-help">Pick a workout for day ${state.planwiz.pickDay + 1}, or set it as rest.</div></div>
      <div class="wl-rest">
        <div class="wl-moon">☾</div>
        <div class="wl-resttext"><div class="wl-restname">Rest day</div><div class="wl-restsub">Recovery, no training logged</div></div>
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
    if (i === s.exIndex && !exComplete(e)) cls += ' cur';
    else if (exPurple(e)) cls += ' pr';
    else if (exComplete(e)) cls += ' done';
    else if (i === s.exIndex) cls += ' cur';
    return `<button class="${cls}" data-action="sess-jump" data-i="${i}" aria-label="Exercise ${i + 1}"></button>`;
  }).join('');
  const last = lastDone(ex.exId, ex.equip);
  const lastTxt = last ? (() => { const w = workingSets(last.e); const top = w.length ? w.reduce((a, b) => (b.weight > a.weight ? b : a)) : null; return top ? `Last time: ${wt(top.weight, eqUnits(last.e.equip))} × ${top.reps} · ${D.short(new Date(last.s.finishedAt))}` : 'Logged before'; })() : 'Not logged yet';
  const img = sv && photoSrc(sv.photo) ? `<img src="${photoSrc(sv.photo)}" alt="">` : '';
  const detail = !s.expanded ? '' : `
    <div class="sess-exdetail">
      <div class="sess-drow">
        <div class="sess-dleft">
          <div class="dimg${img ? '' : ' generic'}">${img}</div>
          <div><div class="dlabel">Default Equipment</div><div class="dval">${esc(eqLabel(ex.equip))}</div><div class="dlabel" style="margin-top:2px">At ${esc(sv ? sv.location : s.location)}</div></div>
        </div>
        <button class="sess-dpill" data-action="open-swap" data-owner="session" aria-label="Change equipment">${I.swap24}</button>
      </div>
      <div class="sess-drow">
        <div><div class="dlabel">Volume</div><div class="dval tnum">${ex.goal.sets} Sets · ${ex.goal.reps} Reps</div></div>
        <button class="sess-dpill" data-action="open-volume" data-owner="session" aria-label="Volume settings">${I.filter}</button>
      </div>
      <div class="sess-drow">
        <div><div class="dlabel">Overload Goal</div><div class="dval goal">${ex.goal.weight != null ? `${wtTight(ex.goal.weight, u)} at volume or to failure` : 'No Goal Yet'}</div>
        ${ex.goal.weight == null ? `<div class="dlabel" style="margin-top:2px">Finish ${ex.goal.sets} × ${ex.goal.reps} to set your first goal</div>` : ''}</div>
        <button class="sess-dpill" data-action="open-goal" data-owner="session" aria-label="Edit overload goal">${I.graph}</button>
      </div>
      <div class="sess-drow">
        <div><div class="dlabel">Exercise History</div><div class="dval sm">${lastTxt}</div></div>
        <button class="sess-dpill" data-action="open-exhistory" data-id="${ex.exId}" aria-label="Exercise history">${I.history}</button>
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
      <div class="sess-excard">
        <button class="sess-exrow" data-action="sess-toggle">
          <span class="sess-exbadge tnum">${s.exIndex + 1}</span>
          <span class="sess-exmeta">
            <span class="sess-exname">${esc(info.name)}</span>
            <span class="sess-exmuscle">${info.muscle}</span>
            <span class="sess-exsub">${esc(eqLabel(ex.equip))} · ${esc(sv ? sv.location : s.location)}</span>
          </span>
          <span class="sess-excaret">${s.expanded ? I.caretUp : I.caretDn}</span>
        </button>
        ${detail}
      </div>
      <div class="sess-prog">${segs}</div>
      <div class="sess-transport">
        <span class="sess-exlabel">Exercise ${s.exIndex + 1} of ${total}</span>
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
      ${logged ? '<div class="sess-tip">Tap a set to change or delete it.</div>' : ''}
    </div>
    <div class="sess-footer">${footer}</div>
  </div>`;
}

// SetWidget: log a set, or edit one already logged (a.edit = { si } | { sid, ei, si })
export function ActiveSetSheet() {
  const a = state.setDraft;
  const [big, small] = steps(a.unit), ul = unitLabel(a.unit);
  const pct = Math.round(a.feel * 100);
  const thumbLeft = `calc(${pct}% - ${(pct * 0.56).toFixed(1)}px)`;
  return `
  <div class="scrim" data-action="sess-cancelset">
    <div class="sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="sw-label">${a.edit ? 'EDIT ' : ''}${a.type === 'warmup' ? 'WARMUP SET' : `SET ${a.setNum}`}</div>
      ${a.hint ? `<div class="sw-hint">${a.hint}</div>` : ''}
      <div class="sw-group">
        <div class="sw-glabel">Weight</div>
        <div class="sw-grow">
          <button class="sw-adj" data-action="sw-w" data-d="-${big}">&minus;${big}</button>
          <button class="sw-adj" data-action="sw-w" data-d="-${small}">&minus;${small}</button>
          <label class="sw-val tnum"><input class="sw-in" data-swfield="weight" inputmode="decimal" value="${fmt(a.weight)}" aria-label="Weight">${ul ? `<span class="u">${ul}</span>` : ''}</label>
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
        <div class="sw-feel" data-feelbar>
          ${['#c8c4e7', '#beb9e7', '#b4ade7', '#aaa2e7', '#9f96e7', '#958be7', '#8b7fe7', '#8174e7', '#7768e7', '#426e8f'].map(c => `<span class="ff-seg" style="background:${c}"></span>`).join('')}
          <div class="ff-text">${a.touched ? (rpeOf(a.feel) === 'F' ? 'FAILURE' : rpeOf(a.feel)) : 'HOW DID IT FEEL?'}</div>
          <div class="ff-end"><span class="ff-f">F</span></div>
          <div class="ff-thumb" style="left:${thumbLeft}"></div>
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
    <div class="sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="sheet-head"><div class="sheet-title purple">Overload Goal</div><div class="sheet-sub">Adjust your overload goal for...</div></div>
      <div class="goal-card">
        <div class="goal-exname">${esc(g.name)}</div>
        <div class="goal-exmeta"><span class="mus">${g.muscle}</span> · ${g.sets} Sets x ${g.reps} Reps</div>
        <div class="goal-exequip">${esc(eqLabel(g.equip))}</div>
      </div>
      <div class="goal-wlabel">GOAL WEIGHT${ul ? ` (${ul.toUpperCase()})` : ''}</div>
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
        <div class="ug-titleblock"><div class="ug-title">Update goal weight?</div><div class="ug-text">You reduced the weight you’re lifting, but had a strong RPE score. Do you want to update your overload goal?</div></div>
        <div class="ug-graphic">
          <div class="ug-kb big">${I.kbBig}<span><b>${fmt(u.from)}</b>${unitWord(unit)}</span></div>
          <div class="ug-arrow">${I.kbArrow}</div>
          <div class="ug-kb small">${I.kbSmall}<span><b>${fmt(u.to)}</b>${unitWord(unit)}</span></div>
        </div>
        <div class="ug-summary">${e.goal.sets} sets · ${e.goal.reps} reps · <span>${wtTight(u.to, unit)}</span></div>
        <div class="ug-actions"><button class="ug-btn" data-action="ug-cancel">Cancel</button><button class="ug-btn dark" data-action="ug-confirm">Yes, Update Goal</button></div>
      </div>
    </div>
  </div>`;
}

// Pause (Release 1.0): confirm → home; the workout resumes from the home screen.
export function PauseSheet() {
  const st = sessionStats(state.session);
  return `
  <div class="scrim" data-action="close-pause">
    <div class="sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="ug-body cf-body">
        <div class="ug-titleblock"><div class="vs-title">Pause Workout?</div><div class="ug-text">Your progress is saved. Pick it back up from the home screen whenever you’re ready.</div></div>
        <div class="pz-stack">
          <div class="ug-actions"><button class="ug-btn" data-action="close-pause">Keep Going</button><button class="ug-btn dark" data-action="pause-confirm">Pause</button></div>
          <div class="ug-actions">
            ${st.sets ? '<button class="ug-btn" data-action="finish-early">Finish Now</button>' : ''}
            <button class="ug-btn danger-ghost" data-action="discard-session">Discard</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---- Workout Complete + past workout log (same layout) ----
   Release 1.0 content in the Dev File layout: nav header, title block, white
   exercise cards with the session's set list. */
function outcomeLine(s, i, e) {
  const o = derived().outcomes[`${s.id}:${i}`];
  if (!o || o.type === 'miss') return '';
  const u = eqUnits(e.equip);
  return `
        <div class="cw-goal wc-goal">
          <div class="cw-goal-text">
            <div class="cw-label">${o.type === 'first' ? 'First Overload Goal Set' : 'Goal Hit · Next Overload Goal'}</div>
            <div class="cw-goal-val tnum">${e.goal.sets} Sets · ${e.goal.reps} Reps · <span class="lbs">${wtTight(o.after, u)}</span></div>
          </div>
        </div>`;
}
export function SessionLogScreen() {
  const s = db.sessions.find(x => x.id === state.log.sid);
  if (!s) return '';
  const complete = state.log.mode === 'complete', st = sessionStats(s), d = new Date(s.finishedAt);
  const cards = s.exercises.map((e, i) => {
    if (!e.sets.length) return '';
    const info = exInfo(e), u = eqUnits(e.equip);
    return `
      <div class="wc-card">
        <div class="cw-ex-row wc-exrow">
          <span class="cw-badge tnum" style="--cw-current:${s.color}">${i + 1}</span>
          <span class="cw-ex-meta"><span class="cw-ex-name">${esc(info.name)}</span><span class="cw-ex-sub"><span class="mus">${esc(info.muscle)}</span> · ${esc(e.equipName || eqLabel(e.equip))}</span></span>
        </div>
        ${outcomeLine(s, i, e)}
        <div class="set-list">${setList(e, u, si => `data-action="edit-logged-set" data-ei="${i}" data-si="${si}"`)}</div>
      </div>`;
  }).join('');
  return `
  <div class="wc-screen">
    ${statusBar()}
    <div class="nav">
      ${complete ? '' : `<button class="icon-btn" data-action="back">${I.chevL}</button>`}
      <span class="nav-title">${complete ? 'Workout Complete' : 'Workout'}</span>
      <button class="icon-btn wc-navbtn" data-action="${complete ? 'share-session' : 'session-menu'}" aria-label="${complete ? 'Share' : 'Workout options'}">${complete ? I.share : I.kebab}</button>
    </div>
    <div class="wl-body wc-body">
      <div class="wl-titleblock">
        <div class="wl-title">${esc(s.workoutName)}${s.edited ? '<span class="eqd-chip wl-edited">Edited</span>' : ''}</div>
        <div class="wl-help">${D.dow(d)}, ${d.getFullYear()} · ${plural(st.exercises, 'exercise')} · ${plural(st.sets, 'set')} · ${st.fails} to failure</div>
      </div>
      ${complete ? `<button class="cw-add" data-action="add-more">${I.plus20} Add more exercises</button>` : ''}
      <div class="wc-list">${cards || '<div class="mg-empty">No sets were logged.</div>'}</div>
      <div class="sess-tip">Tap a set to fix it.</div>
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
      <div class="wiz-help">Give it a name you'll recognize on your home screen.</div>
      <input class="wiz-input" type="text" placeholder="e.g. Push Pull Legs" data-planwizname value="${esc(w.name)}" autocomplete="off">${err}
      <div class="wiz-help" style="margin-top:18px;font-size:13px">Quick names</div>
      <div class="wiz-quick">${chips}</div>`;
  } else if (w.step === 2) {
    body = `
      <div class="wiz-title">How long is your split?</div>
      <div class="wiz-help">The number of days before your plan repeats (1 to 10).</div>
      <div class="plan-stepper"><div class="ps-label">Days</div><div class="ps-row">
        <button class="st-btn" data-action="plan-split" data-dir="-1" ${w.splitDays <= 1 ? 'disabled' : ''}>&minus;</button>
        <div class="st-value tnum">${w.splitDays}</div>
        <button class="st-btn" data-action="plan-split" data-dir="1" ${w.splitDays >= 10 ? 'disabled' : ''}>+</button>
      </div></div>
      <div class="plan-info"><div class="pi-icon">${I.refresh}</div><div><div class="pi-t1">Repeats every ${plural(w.splitDays, 'day')}</div><div class="pi-t2">You'll assign a workout or rest to each day next.</div></div></div>`;
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
    body = `<div class="wiz-title">Assign your days</div><div class="wiz-help">Day 1 is your start date. Pick a workout or a rest day for each day in your split.</div>${err}<div class="plan-daycard">${rows}</div>`;
  } else if (w.step === 4) {
    const f = (k, label, val) => `<button class="plan-datefield ${w.pick === k ? 'on' : ''}" data-action="plan-pickfield" data-k="${k}"><div class="pf-label">${label}</div><div class="pf-value">${val}</div></button>`;
    body = `
      <div class="wiz-title">Set your schedule</div>
      <div class="wiz-help">Pick a start and end date. Your split repeats across the range.</div>
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
      <div class="wiz-help">Check the details, then save your plan. Tap edit on anything you want to change.</div>
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
