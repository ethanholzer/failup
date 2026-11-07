// ============================================================================
// FailUp — library screens: exercises, equipment, the Overload Tracker,
// creation wizards, locations, merge/confirm sheets, Settings.
// ============================================================================
import { state, PURPLE, UPPER_BODY, LOWER_BODY } from './data.js';
import { MUSCLES, EQUIPMENT } from './exercises.js';
import { I, WORKOUT_ICONS, WORKOUT_ICON_KEYS, statusBar, fmt, eqName, esc, wt, wtTight, D, PH_EQUIP, PH_EXERCISE } from './ui.js';
import { WORKOUT_COLORS } from './data.js';
import {
  db, EXERCISES, exById, GENERIC, eqById, eqLabel, eqUnits, unitLabel, unitWord, steps, increment,
  derived, goalKey, goalFor, goalsOf, exerciseStats, exerciseLog, isFail, photoSrc, storageWorks, exPhoto,
} from './store.js';
import { rpeOf, setRow } from './screens-workout.js';

export const EQ_TYPES = ['Bar', 'Dumbbell', 'Bodyweight', 'Cable Machine', 'Smith Machine', 'Specialized Machine'];
// label for an entry in an exercise's equipment list (library key or saved ref)
export const anyEqLabel = k => k.startsWith('eq:') ? eqLabel(k) : eqName(k);
export function exEquipSummary(list) {
  const names = list.filter(k => !k.startsWith('eq:') || eqById(k)).map(anyEqLabel);
  if (names.length <= 2) return names.join(', ');
  return names.slice(0, 2).join(', ') + ' +' + (names.length - 2);
}
// default equipment ref for an exercise
export const defaultRef = ex => { const k = (ex.equipment || [])[0]; return !k ? 'Bodyweight' : k.startsWith('eq:') ? k : eqName(k); };

const cap = w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
const sortHdr = '';

/* ----------------------------- overload chart ----------------------------- */
function niceStep(span) {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200]) if (span / s <= 4) return s;
  return 500;
}
// series: [{ label, w }], oldest → newest. Pure SVG string.
export function overloadChart(series, goalWeight, unit) {
  const W = 377, H = 232;
  const padL = 16, padR = 40, padT = 24, padB = 28;
  const plotL = padL, plotR = W - padR, plotT = padT, plotB = H - padB;
  const vals = series.map(d => d.w).concat(goalWeight != null ? [goalWeight] : []);
  const empty = !series.length;
  let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 40;
  if (hi - lo < 4) { lo -= 4; hi += 4; }
  const step = niceStep(hi - lo);
  const yMin = Math.max(0, Math.floor(lo / step) * step - step / 2), yMax = Math.ceil(hi / step) * step + step / 2;
  const yTicks = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) yTicks.push(v);
  const y = v => plotB - ((v - yMin) / (yMax - yMin)) * (plotB - plotT);
  const goalX = plotL + (plotR - plotL) * 0.80;
  const n = series.length;
  const x = i => n === 1 ? plotL + (goalX - plotL) / 2 : plotL + 8 + (i / (n - 1)) * (goalX - plotL - 16);
  const pts = series.map((d, i) => ({ px: x(i), py: y(d.w), ...d }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ');
  const grid = yTicks.map(v => `<line x1="${plotL}" x2="${plotR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e4e4e8" stroke-width="1" stroke-dasharray="2 5"/>`).join('');
  const yLabels = yTicks.map(v => `<text x="${W - 32}" y="${(y(v) + 4).toFixed(1)}" font-family="Archivo" font-size="13" fill="#000">${fmt(v)}</text>`).join('');
  // label at most 5 points so they never collide
  const every = Math.max(1, Math.ceil(n / 5));
  const xLabels = pts.map((p, i) => (i % every && i !== n - 1) ? '' :
    `<text x="${p.px.toFixed(1)}" y="${plotB + 18}" font-family="Archivo" font-size="11" fill="#000" text-anchor="middle">${p.label}</text>`).join('');
  const dots = pts.map(p => `<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="5" fill="${PURPLE}" stroke="#fff" stroke-width="2"/>`).join('');
  if (empty) return `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="No overload data yet">
    ${grid}${goalWeight != null ? yLabels : ''}
    <text x="${((plotL + plotR) / 2).toFixed(1)}" y="${((plotT + plotB) / 2 + 6).toFixed(1)}" font-family="Archivo" font-weight="500" font-size="16" fill="#5f636b" text-anchor="middle">No Data Yet</text>
  </svg>`;
  const band = goalWeight == null ? '' : `
    <rect x="${goalX.toFixed(1)}" y="${y(goalWeight).toFixed(1)}" width="${(plotR - goalX).toFixed(1)}" height="${(plotB - y(goalWeight)).toFixed(1)}" fill="url(#goalgrad)"/>
    <line x1="${goalX.toFixed(1)}" x2="${plotR}" y1="${y(goalWeight).toFixed(1)}" y2="${y(goalWeight).toFixed(1)}" stroke="${PURPLE}" stroke-width="2"/>
    <text x="${(goalX + 4).toFixed(1)}" y="${(y(goalWeight) - 7).toFixed(1)}" font-family="Archivo" font-weight="700" font-size="10" fill="${PURPLE}" letter-spacing=".04em">GOAL</text>`;
  return `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progressive overload chart">
    <defs><linearGradient id="goalgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PURPLE}" stop-opacity="0.5"/><stop offset="1" stop-color="${PURPLE}" stop-opacity="0"/></linearGradient></defs>
    ${grid}${band}${yLabels}${xLabels}
    ${n > 1 ? `<path d="${line}" fill="none" stroke="${PURPLE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    ${dots}
  </svg>`;
}

/* ------------------------------ tracker screen ---------------------------- */
const RANGES = { '1W': 7, '1M': 31, '3M': 92, '6M': 183, '1Y': 366, 'All': 1e6 };
export function trackerData() {
  const t = state.tracker, v = t.volume;
  const key = goalKey(t.exId, t.equip, v.sets, v.reps);
  const all = derived().ach[key] || [];
  const cutoff = Date.now() - RANGES[t.range] * 86400000;
  const shown = all.filter(a => new Date(a.at).getTime() >= cutoff);
  return { all, shown, goal: goalFor(t.exId, t.equip, v.sets, v.reps), unit: eqUnits(t.equip) };
}
export function TrackerScreen() {
  const t = state.tracker, v = t.volume;
  const ex = exById(t.exId) || { name: 'Exercise', muscle: '' };
  const { all, shown, goal, unit } = trackerData();
  const seg = Object.keys(RANGES).map(r => `<button data-action="set-range" data-range="${r}" class="${r === t.range ? 'on' : ''}">${r}</button>`).join('');
  // history: newest first, grouped by month, with the change from the previous achievement
  const items = all.map((a, i) => ({ ...a, delta: i ? a.weight - all[i - 1].weight : null, first: i === 0 })).reverse();
  const months = [];
  for (const it of items) {
    const m = D.month(new Date(it.at));
    if (!months.length || months[months.length - 1].month !== m) months.push({ month: m, items: [] });
    months[months.length - 1].items.push(it);
  }
  const history = months.map(m => `
    <div>
      <div class="tk-month">${m.month}</div>
      <div class="card tk-history" style="margin-top:12px">
        ${m.items.map(it => `
          <div class="tk-hrow">
            <div><div class="h-weight tnum">${wtTight(it.weight, unit)}</div><div class="h-date">${D.dow(new Date(it.at))}</div></div>
            ${it.first ? `<div class="h-delta first">${I.plusCircle('#5f636b')} First Logged</div>`
              : `<div class="h-delta">${I.trendUp(PURPLE)} ${it.delta >= 0 ? '+' : ''}${wtTight(it.delta, unit)}</div>`}
          </div>`).join('')}
      </div>
    </div>`).join('');
  const sv = eqById(t.equip);
  const equipImg = sv && photoSrc(sv.photo)
    ? `<img class="tk-equip-img" src="${photoSrc(sv.photo)}" alt="">`
    : `<div class="tk-equip-img ph">${PH_EQUIP()}</div>`;
  const series = shown.map(a => ({ label: D.short(new Date(a.at)), w: a.weight }));
  return `
  <div class="tracker">
    ${statusBar()}
    <div class="nav">
      <button class="icon-btn" data-action="back">${I.chevL}</button>
      <span class="nav-title">Overload Tracker</span>
    </div>
    <div class="tk-hero">
      <div class="tk-head">
        <div class="tk-title">${esc(ex.name)}</div>
        <button class="tk-sortbtn" data-action="tracker-pick-exercise" aria-label="Change exercise">${I.swap24}</button>
      </div>
      <div class="tk-equip">
        ${equipImg}
        <div class="tk-equip-text">
          <div class="tk-equip-label">Equipment</div>
          <div class="tk-equip-name">${esc(eqLabel(t.equip))}${sv ? ` <span class="tk-equip-loc">· ${esc(sv.location)}</span>` : ''}</div>
        </div>
        <button class="tk-sortbtn" data-action="open-swap" data-owner="tracker" aria-label="Change equipment">${I.swap24}</button>
      </div>
      <div class="tk-chart">${overloadChart(series, goal, unit)}</div>
      <div class="tk-goalrow">
        <div>
          <div class="g-label">${goal != null ? 'Overload Goal Displayed' : 'Overload Goal'}</div>
          <div class="g-value tnum">${v.sets} Sets · ${v.reps} Reps · <span class="lbs">${goal != null ? wtTight(goal, unit) : 'No Goal Yet'}</span></div>
        </div>
        <div class="g-actions">
          <button class="pill-btn circle" data-action="open-volume" aria-label="Volume filter">${I.filter}</button>
          <button class="pill-btn circle" data-action="open-goal" data-owner="tracker" aria-label="Edit goal">${I.pencil}</button>
        </div>
      </div>
      <div class="tk-seg">${seg}</div>
      <div class="tk-legend">
        <div class="lg"><span class="swatch-line"></span> Current Goal</div>
        <div class="lg"><span class="swatch-dot"></span> <span>Goal Achieved<br><span class="sub">(${v.sets} Sets, ${v.reps} Reps)</span></span></div>
      </div>
    </div>
    <div class="tk-body">
      <div class="card tk-explain">
        <h3>Progressive Overload</h3>
        <p>The dots on this graph show each time you have reached an overload goal for ${esc(ex.name)} using ${esc(eqLabel(t.equip))}. Each dot represents a workout in which you completed ${v.sets} sets of ${v.reps} reps of your overload goal weight.</p>
        ${goal == null ? `<p class="tk-note">No goal yet for ${v.sets} sets of ${v.reps} reps on this setup. Set one with the pencil, or finish a workout and FailUp will suggest one.</p>` : ''}
      </div>
      ${history}
    </div>
    <div class="xd-actions tk-actions">
      <button class="xd-act" data-action="open-exhistory" data-id="${t.exId}"><span class="xd-acticon">${I.history}</span><span>Exercise History</span>${I.smChevR}</button>
    </div>
  </div>`;
}

/* --------------------------- volume filter modal -------------------------- */
export function VolumeModal() {
  const v = state.volumeDraft;
  const inSession = v.context === 'session';
  const goal = v.goalFor(v.sets, v.reps), pts = v.points(v.sets, v.reps);
  const stepper = (label, field, val) => `
      <div class="vs-group">
        <div class="vs-label">${label}</div>
        <div class="vs-row">
          <button class="sw-adj" data-action="vol-step" data-field="${field}" data-dir="-1" aria-label="Fewer ${label}">${I.minus20}</button>
          <div class="vs-val tnum">${val}</div>
          <button class="sw-adj" data-action="vol-step" data-field="${field}" data-dir="1" aria-label="More ${label}">${I.plus20}</button>
        </div>
      </div>`;
  return `
  <div class="scrim" data-action="close-volume">
    <div class="sheet vs-sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="vs-body">
        <div class="vs-top">
          <div class="vs-titleblock">
            <div class="vs-title">${inSession ? 'Volume Settings' : 'Volume Filter'}</div>
            <div class="vs-sub">${inSession ? 'How much do you want to lift today?' : 'Select the volume you want to see data for'}</div>
          </div>
          <div class="vs-info">
            <div>
              <div class="vs-main tnum">${v.sets} Sets · ${v.reps} Reps · <span class="lbs">${goal != null ? wtTight(goal, v.unit) : 'No Goal Yet'}</span></div>
              <div class="vs-meta">${goal != null ? `${pts} datapoint${pts === 1 ? '' : 's'} logged` : 'Log this exercise to get your first overload goal'}</div>
            </div>
            <span class="vs-graph">${I.graph}</span>
          </div>
          <div class="vs-steppers">${stepper('Sets', 'sets', v.sets)}${stepper('Reps', 'reps', v.reps)}</div>
        </div>
        <div class="ug-actions">
          <button class="ug-btn" data-action="close-volume">Nevermind</button>
          <button class="ug-btn dark" data-action="save-volume">Save</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ===================== EXERCISE SELECTION (browse + filter) ================ */
export function matchExercises() {
  const s = state.exercises;
  const q = s.search.trim().toLowerCase();
  return EXERCISES.filter(ex => {
    if (s.muscles.length && !s.muscles.includes(ex.muscle)) return false;
    if (s.equipment.length && !ex.equipment.some(e => s.equipment.includes(e))) return false;
    if (q && !ex.name.toLowerCase().includes(q)) return false;
    return true;
  });
}
// Exercise thumbnail: your photo, else the library photo; the dumbbell sits underneath in case it can't load.
export function exTile(ex, ref) {
  const p = exPhoto(ex, ref);
  return `<span class="ex-tile ph${p ? ' photo' : ''}">${PH_EXERCISE()}${p ? `<img src="${p}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span>`;
}
function exRow(ex) {
  const s = state.exercises;
  const multi = s.mode === 'quickadd', on = multi && s.picked.includes(ex.id);
  return `
    <button class="ex-row${on ? ' picked' : ''}" data-action="open-exercise" data-id="${ex.id}">
      ${exTile(ex)}
      <span class="ex-meta">
        <span class="ex-name">${esc(ex.name)}</span>
        <span class="ex-sub"><span class="mus">${ex.muscle}</span>${esc(exEquipSummary(ex.equipment))}</span>
      </span>
      ${multi ? `<span class="wiz-check red ${on ? 'on' : ''}">${on ? I.checkW : ''}</span>` : `<span class="ex-chev">${I.smChevR}</span>`}
    </button>`;
}
// Recently logged exercises, newest first.
function recentExercises() {
  const seen = new Set(), out = [];
  for (let i = db.sessions.length - 1; i >= 0 && out.length < 15; i--)
    for (const e of db.sessions[i].exercises) {
      if (seen.has(e.exId)) continue;
      seen.add(e.exId);
      const x = exById(e.exId);
      if (x) out.push(x);
    }
  return out;
}
export function exListInner() {
  const s = state.exercises;
  const active = s.muscles.length || s.equipment.length;
  const matched = matchExercises();
  if (active || s.search.trim()) {
    if (!matched.length) return `<div class="ex-empty">No exercises match those filters.${s.mode !== 'browse' ? '' : ''}</div>`;
    return `<div class="ex-sectionrow"><span class="sec-label">Results (${matched.length})</span></div>${matched.map(exRow).join('')}`;
  }
  const recent = recentExercises();
  const recentShown = s.recentOpen ? recent : recent.slice(0, 4);
  return `
    ${recent.length ? `
    <div class="ex-sectionrow"><span class="sec-label">Recent (${recent.length})</span></div>
    ${recentShown.map(exRow).join('')}
    ${s.recentOpen || recent.length <= 4 ? '' : `<button class="ex-showmore" data-action="expand-recent">Show More (${recent.length - 4} more)</button>`}` : ''}
    <div class="ex-sectionrow"><span class="sec-label">All exercises (${EXERCISES.length})</span><span class="sec-sort">A–Z</span></div>
    ${[...EXERCISES].sort((a, b) => a.name.localeCompare(b.name)).map(exRow).join('')}`;
}
export function ExercisesScreen() {
  const s = state.exercises;
  const chips = [
    ...s.muscles.map(m => ({ type: 'muscle', label: m, raw: m })),
    ...s.equipment.map(e => ({ type: 'equipment', label: eqName(e), raw: e })),
  ];
  const title = { add: s.swapping ? 'Swap Exercise' : 'Add Exercise', quickadd: 'Quick Add', tracker: 'Choose Exercise' }[s.mode] || 'Exercises';
  const canCreate = s.mode === 'browse' || s.mode === 'add';
  return `
  <div class="ex-screen${s.mode === 'quickadd' ? ' has-footer' : ''}">
    ${statusBar()}
    <div class="nav">
      <button class="icon-btn" data-action="back">${I.chevL}</button>
      <span class="nav-title">${title}</span>
      ${canCreate ? '<button class="nav-create" data-action="create-exercise-start">Create</button>' : ''}
    </div>
    <div class="ex-search">
      ${I.search}
      <input type="text" placeholder="Search exercises" data-search value="${esc(s.search)}">
    </div>
    <div class="ex-filters">
      <button class="chip-drop ${s.muscles.length ? 'active' : ''}" data-action="open-muscle">Muscle${s.muscles.length ? ' (' + s.muscles.length + ')' : ''} ${I.chevDown}</button>
      <button class="chip-drop ${s.equipment.length ? 'active' : ''}" data-action="open-equipment">Equipment${s.equipment.length ? ' (' + s.equipment.length + ')' : ''} ${I.chevDown}</button>
    </div>
    ${chips.length ? `<div class="ex-chips">${chips.map(c => `<span class="chip-active">${c.label}<button data-action="remove-chip" data-type="${c.type}" data-name="${c.raw}" aria-label="Remove ${esc(c.label)}">${I.x}</button></span>`).join('')}</div>` : ''}
    <div id="ex-list">${exListInner()}</div>
    ${s.mode === 'quickadd' ? `<div class="cw-footer"><button class="btn ghost" data-action="back">Cancel</button><button class="btn solid" data-action="quickadd-done" ${s.picked.length ? '' : 'disabled'}>Add ${s.picked.length || ''} Exercise${s.picked.length === 1 ? '' : 's'}</button></div>` : ''}
  </div>`;
}

export function FilterSheet(kind) {
  const isMuscle = kind === 'muscle';
  const items = isMuscle ? MUSCLES : [...EQUIPMENT].sort((a, b) => EQ_TYPES.indexOf(a.name) - EQ_TYPES.indexOf(b.name));
  const draft = isMuscle ? state.exercises.draftMuscles : state.exercises.draftEquipment;
  const count = name => EXERCISES.filter(e => isMuscle ? e.muscle === name : e.equipment.includes(name)).length;
  const rows = items.map(it => {
    const on = draft.includes(it.name);
    return `
      <div class="fl-row" data-action="toggle-facet" data-kind="${kind}" data-name="${it.name}">
        <span class="fl-name">${eqName(it.name)}</span>
        <span class="fl-right"><span class="fl-count tnum">${count(it.name)} Exercises</span><span class="fl-check ${on ? 'on' : ''}">${on ? I.checkW : ''}</span></span>
      </div>`;
  }).join('');
  return `
  <div class="scrim" data-action="cancel-filter">
    <div class="sheet filter" data-stop>
      <div class="sheet-grab"></div>
      <div class="filter-head"><div class="filter-title">${isMuscle ? 'Muscle' : 'Equipment'}</div><button class="filter-clear" data-action="clear-facet" data-kind="${kind}">Clear</button></div>
      <div class="filter-sub">Select one or more...</div>
      <div class="filter-list">${rows}</div>
      <div class="sheet-actions">
        <button class="btn ghost" data-action="cancel-filter">Cancel</button>
        <button class="btn solid" data-action="apply-filter" data-kind="${kind}">Set Filter</button>
      </div>
    </div>
  </div>`;
}

/* ---- Choose a Color / Choose an Icon ---- */
function pickerSheet(kind, cells) {
  return `
  <div class="scrim" data-action="close-picker">
    <div class="sheet pk-sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="pk-body">
        <div class="pk-titleblock"><div class="vs-title">${kind === 'color' ? 'Choose a color' : 'Choose an icon'}</div><div class="vs-sub">For this workout’s thumbnail</div></div>
        <div class="pk-grid">${cells}</div>
        <div class="pk-actions"><button class="pk-btn" data-action="close-picker">Nevermind</button><button class="pk-btn dark" data-action="save-picker">Save</button></div>
      </div>
    </div>
  </div>`;
}
export function ColorPickerSheet() {
  const sel = state.pickDraft;
  return pickerSheet('color', WORKOUT_COLORS.map(c => `
    <button class="pk-swatch ${c.hex === sel ? 'on' : ''}" style="background:${c.hex}" data-action="pick-color" data-hex="${c.hex}" aria-label="${c.name}">${c.hex === sel ? `<span class="pk-check">${I.checkW}</span>` : ''}</button>`).join(''));
}
export function IconPickerSheet() {
  const sel = state.pickDraft;
  const tiles = Array.from({ length: 16 }, (_, i) => {
    const k = WORKOUT_ICON_KEYS[i];
    return k ? `<button class="pk-icon ${k === sel ? 'on' : ''}" data-action="pick-icon" data-icon="${k}" aria-label="${k}">${WORKOUT_ICONS[k]}</button>` : '<span class="pk-icon empty"></span>';
  }).join('');
  return pickerSheet('icon', tiles);
}

/* ===================== CREATE AN EXERCISE (5-step wizard) ================== */
function exMuscleGrid(selected, action, exclude) {
  const card = m => `<button class="wiz-card ${selected.includes(m) ? 'on' : ''}" data-action="${action}" data-name="${m}">${m}</button>`;
  return `
    <div class="wiz-grouplabel">Upper Body</div><div class="wiz-grid">${UPPER_BODY.filter(m => m !== exclude).map(card).join('')}</div>
    <div class="wiz-grouplabel">Lower Body</div><div class="wiz-grid">${LOWER_BODY.filter(m => m !== exclude).map(card).join('')}</div>`;
}
const wizErr = w => w.err ? `<div class="wiz-err">${esc(w.err)}</div>` : '';
export function ExerciseWizard() {
  const w = state.exwiz, STEPS = 5;
  const segs = Array.from({ length: STEPS }, (_, i) => `<div class="wiz-seg ${i < w.step ? 'on' : ''}"></div>`).join('');
  let body = '';
  if (w.step === 1) {
    body = `
      <div class="wiz-title">Name the Exercise</div>
      <div class="wiz-help">Give it a name you'll recognize in your workout list.</div>
      <input class="wiz-input" type="text" placeholder="e.g. Bajan Cable Curl" data-exwizname value="${esc(w.name)}" autocomplete="off">${wizErr(w)}`;
  } else if (w.step === 2) {
    body = `<div class="wiz-title">Select a primary muscle group</div><div class="wiz-help">Which muscle is primarily worked in this exercise?</div>${wizErr(w)}${exMuscleGrid(w.primary ? [w.primary] : [], 'exwiz-primary', null)}`;
  } else if (w.step === 3) {
    body = `<div class="wiz-title">Select any secondary muscle groups</div><div class="wiz-help">(Optional) Select all that apply</div>${exMuscleGrid(w.secondary, 'exwiz-secondary', w.primary)}`;
  } else if (w.step === 4) {
    const savedRows = db.equipment.map(sv => {
      const ref = 'eq:' + sv.id, on = w.saved.includes(ref), p = photoSrc(sv.photo);
      return `<button class="wiz-eqrow" data-action="exwiz-saved" data-ref="${ref}">
        <span class="eqimg${p ? '' : ' ph'}">${p ? `<img src="${p}" alt="">` : PH_EQUIP()}</span>
        <span class="eqtext"><span class="eqname">${esc(sv.name)}</span><span class="eqloc">At ${esc(sv.location)}</span></span>
        <span class="wiz-check red ${on ? 'on' : ''}">${on ? I.checkW : ''}</span>
      </button>`;
    }).join('');
    const genRows = EQ_TYPES.map(name => {
      const on = w.equipment.includes(name);
      return `<button class="wiz-eqrow generic" data-action="exwiz-equip" data-name="${name}">
        <span class="eqtext"><span class="eqname">${eqName(name)}</span></span>
        <span class="wiz-check red ${on ? 'on' : ''}">${on ? I.checkW : ''}</span>
      </button>`;
    }).join('');
    body = `
      <div class="wiz-title">What kind of equipment?</div>
      <div class="wiz-help">Select all types of equipment you could use for this exercise</div>${wizErr(w)}
      <div class="wiz-eqcard">
        <div class="wiz-eqnote"><p>Equipment can be swap between mid-workout, It’s super convenient.</p><button class="wiz-eqadd" data-action="exwiz-addequip">Add</button></div>
        <div class="wiz-eqsection"><span class="lbl">Saved (${db.equipment.length})</span></div>
        ${savedRows || '<div class="wiz-eqempty">No saved equipment yet. Tap Add to save a machine from your gym.</div>'}
        <div class="wiz-eqsection"><span class="lbl">Generic Equipment (${EQ_TYPES.length})</span></div>
        ${genRows}
      </div>`;
  } else {
    const p = photoSrc(w.photo);
    body = `
      <div class="wiz-title">Add a thumbnail photo</div>
      <div class="wiz-help">(Optional) Take a picture, or upload one</div>
      ${p ? `<div class="wiz-imgcard filled"><img src="${p}" alt="">${photoButton('exwiz', 'Change photo', 'xd-changephoto')}</div>` : `
      <div class="wiz-imgcard">${I.photoGlyph}<div class="imgt1">No photo yet</div><div class="imgt2">Add one to make this exercise easy to spot</div>${photoButton('exwiz', 'Add a photo', 'imgbtn')}</div>`}`;
  }
  const last = w.step === STEPS;
  const footer = w.step === 1
    ? `<button class="btn solid" data-action="exwiz-next">Continue</button>`
    : `<button class="btn ghost back" data-action="exwiz-prev">Back</button><button class="btn solid" data-action="exwiz-next">${last ? 'Save Exercise' : 'Continue'}</button>`;
  return `
  <div class="wiz-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="exwiz-headback">${I.chevL}</button><span class="nav-title">${w.editId ? 'Edit Exercise' : 'Create an Exercise'}</span></div>
    <div class="wiz-header"><div class="wiz-progress">${segs}</div><span class="wiz-count">${w.step} of ${STEPS}</span></div>
    <div class="wiz-body">${body}</div>
    <div class="wiz-footer">${footer}</div>
  </div>`;
}

/* ===================== SAVE EQUIPMENT (4-step wizard) ===================== */
export function EquipmentWizard() {
  const w = state.eqwiz, STEPS = 4;
  const segs = Array.from({ length: STEPS }, (_, i) => `<div class="wiz-seg ${i < w.step ? 'on' : ''}"></div>`).join('');
  const UNITS = [['lbs', 'Pounds (lbs)'], ['kg', 'Kilograms (kg)'], ['simple', 'Simple Numbers']];
  let body = '';
  if (w.step === 1) {
    body = `
      <div class="wiz-title">Where is this located?</div>
      <div class="wiz-help">This will help organize what equipment you can swap between mid-workout.</div>
      <div class="wiz-loclist">
        ${db.locations.map(l => `<button class="wiz-locard ${w.location === l ? 'on' : ''}" data-action="eqwiz-location" data-name="${esc(l)}">${esc(l)}</button>`).join('')}
        <button class="wiz-locard add" data-action="eqwiz-addloc">Add a new location ${I.plus20}</button>
      </div>${wizErr(w)}`;
  } else if (w.step === 2) {
    body = `
      <div class="wiz-title">Name the Equipment</div>
      <div class="wiz-help">Give it a name you'll recognize in your saved equipment list.</div>
      <div class="wiz-namecard"><input type="text" placeholder="e.g. Assisted Pull-up Machine" data-eqwizname value="${esc(w.name)}" autocomplete="off"><div class="loc">At ${esc(w.location)}</div></div>${wizErr(w)}`;
  } else if (w.step === 3) {
    body = `
      <div class="wiz-title">Choose weight units</div>
      <div class="wiz-help">How do you want to track weight on this equipment?</div>
      <div class="wiz-unitcard"><div class="ulbl">Weight Units</div><div class="unit-pills">${UNITS.map(([k, label]) => `<button class="unit-pill ${w.units === k ? 'on' : ''}" data-action="eqwiz-units" data-name="${k}">${label}</button>`).join('')}</div></div>`;
  } else {
    const p = photoSrc(w.photo);
    body = `
      <div class="wiz-title">Add a thumbnail photo</div>
      <div class="wiz-help">(Optional) Take a picture, or upload one</div>
      ${p ? `<div class="wiz-imgcard filled"><img src="${p}" alt="">${photoButton('eqwiz', 'Change photo', 'xd-changephoto')}</div>` : `
      <div class="wiz-imgcard">${I.photoGlyph}<div class="imgt1">No photo yet</div><div class="imgt2">Add one to make this equipment easy to spot</div>${photoButton('eqwiz', 'Add a photo', 'imgbtn')}</div>`}`;
  }
  const last = w.step === STEPS;
  const footer = w.step === 1
    ? `<button class="btn solid" data-action="eqwiz-next">Continue</button>`
    : `<button class="btn ghost back" data-action="eqwiz-prev">Back</button><button class="btn solid" data-action="eqwiz-next">${last ? 'Save Equipment' : 'Continue'}</button>`;
  return `
  <div class="wiz-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="eqwiz-headback">${I.chevL}</button><span class="nav-title">${w.editId ? 'Edit Equipment' : 'Save Equipment'}</span></div>
    <div class="wiz-header"><div class="wiz-progress">${segs}</div><span class="wiz-count">${w.step} of ${STEPS}</span></div>
    <div class="wiz-body">${body}</div>
    <div class="wiz-footer">${footer}</div>
  </div>`;
}

/* ---- Exercise detail ---- */
export function ExerciseDetailScreen() {
  const e = exById(state.exDetail);
  if (!e) return '';
  const st = exerciseStats(e.id);
  const tags = [e.mechanic, e.force && e.force !== 'static' ? e.force : null, e.mechanic ? 'strength' : null, e.level, e.custom ? 'custom' : null].filter(Boolean).map(cap);
  const secondary = e.secondary && e.secondary.length ? cap(e.secondary.join(', ')) : '—';
  const goalCount = ref => goalsOf(g => g.exId === e.id && g.ref === ref).length;
  const goalTxt = n => n ? ` · <span class="goals">${n} Goal${n === 1 ? '' : 's'}</span>` : '';
  // generic setups: what the library lists, plus any generic you've actually used
  const used = new Set(exerciseLog(e.id).map(x => x.e.equip));
  const generic = [...new Set([...e.equipment.filter(k => !k.startsWith('eq:')).map(eqName), ...[...used].filter(r => !r.startsWith('eq:'))])];
  const saved = db.equipment.filter(sv => e.equipment.includes('eq:' + sv.id) || used.has('eq:' + sv.id) || goalCount('eq:' + sv.id));
  const others = db.equipment.filter(sv => !saved.includes(sv));
  const savedRow = sv => `
        <button class="xd-eqrow" data-action="open-tracker" data-equip="eq:${sv.id}">
          ${eqImg(sv)}
          <span class="xd-eqtext"><span class="xd-eqname">${esc(sv.name)}</span><span class="xd-eqsub">At ${esc(sv.location)}${goalTxt(goalCount('eq:' + sv.id))}</span></span>
          <span class="xd-chev">${I.smChevR}</span>
        </button>`;
  const genRows = generic.map(g => `
        <button class="xd-eqrow" data-action="open-tracker" data-equip="${esc(g)}">
          ${eqImg(null)}
          <span class="xd-eqtext"><span class="xd-eqname">${esc(g)}</span>${goalCount(g) ? `<span class="xd-eqsub">${goalTxt(goalCount(g)).slice(3)}</span>` : ''}</span>
          <span class="xd-chev">${I.smChevR}</span>
        </button>`).join('');
  const stat = (label, val) => `<div class="xd-stat"><div class="xd-statlabel">${label}</div>${val}</div>`;
  const own = photoSrc(e.photo), p = exPhoto(e);
  const howTo = (e.steps || []).filter(Boolean);
  return `
  <div class="xd-screen">
    <div class="xd-hero">
      ${statusBar()}
      <button class="icon-btn xd-back" data-action="back" aria-label="Back">${I.chevL}</button>
      ${p ? `<img class="xd-heroimg" src="${p}" alt="" onerror="this.remove()">${photoButton('exercise', own ? 'Change photo' : 'Use your own photo', 'xd-changephoto')}` : `
      <div class="xd-empty">${I.photoGlyph}<div class="xd-empty-title">No photo yet</div><div class="xd-empty-help">Add one to make this exercise easy to spot</div>${photoButton('exercise', 'Add a photo', 'xd-addphoto')}</div>`}
    </div>
    <div class="xd-content">
      <div class="xd-card xd-details">
        <div class="xd-name">${esc(e.name)}</div>
        ${tags.length ? `<div class="xd-tags">${tags.map(t => `<span class="xd-tag">${t}</span>`).join('')}</div>` : ''}
        <div class="xd-rule"></div>
        <div class="xd-kv"><span>Primary muscles</span><span class="mus">${e.muscle}</span></div>
        <div class="xd-kv"><span>Secondary muscles</span><span>${esc(secondary)}</span></div>
        <div class="xd-rule"></div>
        <div class="xd-kv"><span>Listing Type</span><span>${e.custom ? 'User Added' : 'Default Set'}</span></div>
      </div>
      <div class="xd-card xd-logged">
        <div class="xd-hgroup xd-hrow">
          <div><div class="xd-h">${st.logged ? `Logged ${st.logged} time${st.logged === 1 ? '' : 's'}` : 'Not logged yet'}</div>
          <div class="xd-sub">${st.logged ? `Across ${st.setups} setup${st.setups === 1 ? '' : 's'}` : 'Log a set to start tracking this exercise'}</div></div>
        </div>
        <div class="xd-stats">
          ${stat('Total Sets', `<div class="xd-statval">${st.totalSets}</div>`)}
          ${stat('Earned Fails', `<div class="xd-statval purple">${st.fails}</div>`)}
        </div>
        ${stat('Avg. RPE', st.rpe ? `<span class="set-tag">${st.rpe >= 10 ? 'F' : 'RPE ' + st.rpe}</span>` : '<div class="xd-statval">—</div>')}
      </div>
      <div class="xd-card xd-related">
        <div class="xd-relhead">
          <div class="xd-hgroup"><div class="xd-h">Related Equipment</div><div class="xd-sub">This is the list of equipment you can quickly swap between mid-workout. Tap one to see its Overload Tracker.</div></div>
          <button class="xd-add" data-action="xd-add-equipment">Add</button>
        </div>
        ${saved.length ? `<div class="xd-sechdr"><span>SAVED (${saved.length})</span></div>${saved.map(savedRow).join('')}` : ''}
        <div class="xd-sechdr"><span>GENERIC EQUIPMENT (${generic.length})</span></div>
        ${genRows}
        ${others.length ? `<div class="xd-sechdr"><span>OTHER SAVED EQUIPMENT (${others.length})</span></div>${others.map(savedRow).join('')}` : ''}
      </div>
      ${howTo.length ? `
      <div class="xd-card xd-howto">
        <div class="xd-hgroup"><div class="xd-h">How to do it</div></div>
        <ol class="xd-steps">${howTo.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
      </div>` : ''}
    </div>
    <div class="xd-actions">
      <button class="xd-act" data-action="edit-exercise"><span class="xd-acticon">${I.editPen}</span><span>Edit Exercise</span>${I.smChevR}</button>
      <button class="xd-act" data-action="merge-exercise"><span class="xd-acticon">${I.merge}</span><span>Merge With Another Exercise</span>${I.smChevR}</button>
      <button class="xd-act" data-action="delete-exercise"><span class="xd-acticon del">${I.trash24}</span><span>Delete Exercise</span>${I.smChevR}</button>
    </div>
  </div>`;
}

/* ---- Exercise History (Release 1.0: every logged set, grouped by date) ---- */
export function ExerciseHistoryScreen() {
  const e = exById(state.exHistory) || { name: 'Exercise', id: state.exHistory };
  const log = exerciseLog(e.id);
  const sets = log.flatMap(x => x.e.sets.filter(s => s.type === 'working'));
  const fails = sets.filter(isFail).length;
  const cards = log.map(({ s, e: se }) => {
    const u = eqUnits(se.equip);
    let n = 0;
    const rows = se.sets.map(st => st.type === 'warmup' ? setRow(st, 'W', 'warm', se, u) : setRow(st, ++n, 'working', se, u)).join('');
    return `
      <div class="hx-group">
        <div class="hx-date">${D.dow(new Date(s.finishedAt))}<span>${esc(s.workoutName)}</span></div>
        <div class="hx-card">
          <div class="hx-head">${esc(se.equipName || eqLabel(se.equip))} · ${se.goal.sets} × ${se.goal.reps}${se.goal.weight != null ? ` · goal ${wtTight(se.goal.weight, u)}` : ''}</div>
          <div class="set-list">${rows}</div>
        </div>
      </div>`;
  }).join('');
  return `
  <div class="eql-screen hx-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">Exercise History</span></div>
    <div class="eql-head">
      <div class="eql-title">${esc(e.name)}</div>
      <div class="eql-help">${sets.length} set${sets.length === 1 ? '' : 's'} recorded · <span class="hx-fails">${fails} set${fails === 1 ? '' : 's'} to failure</span></div>
    </div>
    <div class="hx-list">${cards || '<div class="mg-empty">Nothing logged yet. Your sets show up here after you finish a workout.</div>'}</div>
  </div>`;
}

/* ---- Your Saved Equipment ---- */
const eqGoalCount = sv => goalsOf(g => g.ref === 'eq:' + sv.id).length;
export function EquipmentListScreen() {
  const list = [...db.equipment].sort((a, b) => a.location.localeCompare(b.location) || a.name.localeCompare(b.name));
  const rows = list.map(sv => {
    const n = eqGoalCount(sv);
    return `
      <button class="xd-eqrow eq-row" data-action="open-equipment-detail" data-id="${sv.id}">
        ${eqImg(sv)}
        <span class="xd-eqtext"><span class="xd-eqname">${esc(sv.name)}</span><span class="xd-eqsub">At ${esc(sv.location)}${n ? ` · <span class="goals">${n} Goal${n === 1 ? '' : 's'}</span>` : ''}</span></span>
        <span class="xd-chev">${I.smChevR}</span>
      </button>`;
  }).join('');
  return `
  <div class="eql-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">Equipment</span><button class="nav-create" data-action="eq-create">Create</button></div>
    <div class="eql-head">
      <div class="eql-title">Your Saved Equipment</div>
      <div class="eql-help">Weight can feel different equipment to equipment. Saving specific equipment to ensure a consistent overload goal</div>
    </div>
    <div class="eql-listhdr"><span>Saved equipment (${list.length})</span></div>
    ${rows || `<div class="mg-empty">Nothing saved yet. Save a machine from your gym so its goals stay separate from other machines of the same type.<br><br><button class="wpill dark" data-action="eq-create">Save Equipment</button></div>`}
  </div>`;
}
export function EquipmentDetailScreen() {
  const sv = db.equipment.find(x => x.id === state.eqDetail);
  if (!sv) return '';
  const ref = 'eq:' + sv.id;
  const unit = (key, label) => `<button class="eqd-unit ${sv.units === key ? 'on' : ''}" data-action="eq-units" data-unit="${key}">${label}</button>`;
  // exercises done on this machine, with their active goals
  const exIds = new Set([
    ...db.sessions.flatMap(s => s.exercises.filter(e => e.equip === ref).map(e => e.exId)),
    ...goalsOf(g => g.ref === ref).map(g => g.exId),
  ]);
  const related = [...exIds].map(id => exById(id)).filter(Boolean).map(x => {
    const chips = goalsOf(g => g.ref === ref && g.exId === x.id).map(g => `<span class="eqd-chip">${g.sets} x ${g.reps}</span>`).join('');
    return `
        <button class="eqd-exrow" data-action="eq-open-tracker" data-id="${x.id}">
          ${exTile(x)}
          <span class="eqd-extext"><span class="eqd-exname">${esc(x.name)}</span><span class="eqd-chips">${chips || '<span class="eqd-nogoal">No goal yet</span>'}</span></span>
        </button>`;
  }).join('');
  const p = photoSrc(sv.photo);
  return `
  <div class="xd-screen eqd-screen">
    <div class="xd-hero eqd-hero">
      ${p ? `<img src="${p}" alt="">${photoButton('equipment', 'Change photo', 'xd-changephoto')}` : `
      <div class="xd-empty">${I.photoGlyph}<div class="xd-empty-title">No photo yet</div><div class="xd-empty-help">Add one to make this equipment easy to spot</div>${photoButton('equipment', 'Add a photo', 'xd-addphoto')}</div>`}
      ${statusBar(!!p)}
      <button class="icon-btn xd-back" data-action="back" aria-label="Back">${I.chevL}</button>
    </div>
    <div class="xd-content">
      <div class="xd-card xd-details">
        <div class="xd-name eqd-name">${esc(sv.location)} ${esc(sv.name)}</div>
        <div class="xd-kv"><span>Listing Type</span><span>User Added</span></div>
      </div>
      <button class="eqd-loc" data-action="open-location" data-target="equipment"><span class="cw-label">Where is this Located?</span><span class="eqd-locval">${esc(sv.location)}</span></button>
      <div class="xd-card eqd-units">
        <div class="xd-hgroup"><div class="xd-h">Equipment Details</div><div class="xd-sub">Select the equipment’s weight units and goal increments</div></div>
        <div class="cw-label eqd-unitslbl">Weight Units</div>
        <div class="eqd-unitrow">${unit('lbs', 'Pounds (lbs)')}${unit('kg', 'Kilograms (kg)')}${unit('simple', 'Simple Numbers')}</div>
      </div>
      <div class="xd-card xd-related">
        <div class="xd-relhead"><div class="xd-hgroup"><div class="xd-h">Related Exercises</div><div class="xd-sub">Listed are exercises you've done on this machine and any active overload goals per exercise</div></div></div>
        <div class="xd-sechdr"><span>EXERCISES (${exIds.size})</span></div>
        <div class="eqd-exlist">${related || '<div class="mg-empty sm">Exercises show up here once you log them on this equipment.</div>'}</div>
      </div>
    </div>
    <div class="xd-actions">
      <button class="xd-act" data-action="edit-equipment"><span class="xd-acticon">${I.editPen}</span><span>Edit Equipment</span>${I.smChevR}</button>
      <button class="xd-act" data-action="merge-equipment"><span class="xd-acticon">${I.merge}</span><span>Merge With Another Equipment</span>${I.smChevR}</button>
      <button class="xd-act" data-action="delete-equipment"><span class="xd-acticon del">${I.trash24}</span><span>Delete Equipment</span>${I.smChevR}</button>
    </div>
  </div>`;
}

/* ---- Equipment Swap ---- */
export function EquipmentSwapScreen(currentRef) {
  const curSv = eqById(currentRef);
  const saved = db.equipment.filter(sv => 'eq:' + sv.id !== currentRef);
  const generic = EQ_TYPES.map(eqName).filter(n => n !== currentRef);
  return `
  <div class="swp-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">Equipment Swap</span></div>
    <div class="swp-body">
      <div class="eql-title">Swap to different equipment</div>
      <div class="xd-card swp-current">
        ${eqImg(curSv)}
        <span class="xd-eqtext"><span class="xd-eqname">${esc(eqLabel(currentRef))}</span>${curSv ? `<span class="xd-eqsub">At ${esc(curSv.location)}</span>` : ''}</span>
        <span class="xd-chev">${I.exchange}</span>
      </div>
      <div class="swp-h">Swapping to...</div>
      ${db.equipment.length ? `<div class="xd-card swp-list">
        <div class="swp-help"><span>Select the equipment you are using for this exercise</span><button class="xd-add" data-action="swap-add">Add</button></div>
        <div class="swp-hdr"><span>Saved (${saved.length})</span></div>
        ${saved.map(sv => `
        <button class="xd-eqrow" data-action="swap-pick" data-ref="eq:${sv.id}">
          ${eqImg(sv)}
          <span class="xd-eqtext"><span class="xd-eqname">${esc(sv.name)}</span><span class="xd-eqsub">At ${esc(sv.location)}</span></span>
          <span class="xd-chev">${I.smChevR}</span>
        </button>`).join('') || '<div class="swp-empty">No saved equipment yet.</div>'}
      ` : `
      <div class="swp-cta">
        <div class="swp-cta-icon">${I.equipment}</div>
        <div class="swp-cta-title">Save the machines you train on</div>
        <div class="swp-cta-text">No two cable stacks or leg presses feel the same. Save a specific machine and it gets its own overload goals, so your progress stays honest from gym to gym.</div>
        <ul class="swp-cta-points">
          <li>${I.checkC('#6c5ce7')} Goals tracked per machine</li>
          <li>${I.checkC('#6c5ce7')} Picked automatically at that location</li>
        </ul>
        <button class="btn solid swp-cta-btn" data-action="swap-add">Save a Machine</button>
      </div>
      <div class="xd-card swp-list">
      `}
        <div class="swp-hdr"><span>Generic Equipment (${generic.length})</span></div>
        ${generic.map(n => `<button class="swp-generic" data-action="swap-pick" data-ref="${n}"><span>${n}</span>${I.smChevR}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

/* ===================== photos, locations, delete & merge ===================== */
export function photoButton(target, label, cls) {
  return `<label class="${cls}">${label}<input type="file" accept="image/*" data-photo="${target}" hidden></label>`;
}
export function eqImg(sv, cls = 'xd-eqimg') {
  const p = sv && photoSrc(sv.photo);
  return p ? `<img class="${cls}" src="${p}" alt="">` : `<span class="${cls} generic ph">${PH_EQUIP()}</span>`;
}

export function LocationSheet() {
  const lp = state.locPick;
  const cur = lp.target === 'lineup' ? (state.session && state.session.location) : lp.target === 'equipment' ? (db.equipment.find(x => x.id === state.eqDetail) || {}).location : null;
  return `
  <div class="scrim" data-action="close-location">
    <div class="sheet pk-sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="pk-body loc-body">
        <div class="pk-titleblock"><div class="vs-title">Choose a location</div><div class="vs-sub">${lp.target === 'lineup' ? 'Where are you working out today? Equipment defaults to what’s saved there.' : 'Where is this equipment?'}</div></div>
        <div class="wiz-loclist">
          ${db.locations.map(l => `<button class="wiz-locard ${l === cur ? 'on' : ''}" data-action="pick-location" data-name="${esc(l)}">${esc(l)}</button>`).join('')}
          <button class="wiz-locard add" data-action="add-location">Add a new location ${I.plus20}</button>
        </div>
      </div>
    </div>
  </div>`;
}
export function NewLocationScreen() {
  return `
  <div class="wiz-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">New Location</span></div>
    <div class="wiz-body">
      <div class="wiz-title">Add a location</div>
      <div class="wiz-help">Name a gym, or anywhere else you train.</div>
      <input class="wiz-input" data-newloc placeholder="Location name" value="${esc(state.newLoc.name)}" autocomplete="off">${wizErr(state.newLoc)}
    </div>
    <div class="wiz-footer"><button class="btn solid" data-action="save-location">Save Location</button></div>
  </div>`;
}
export function ConfirmSheet() {
  const c = state.confirm;
  return `
  <div class="scrim" data-action="confirm-no">
    <div class="sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="ug-body cf-body">
        <div class="ug-titleblock"><div class="vs-title ${c.danger ? 'danger' : ''}">${c.title}</div><div class="ug-text">${c.text}</div></div>
        <div class="ug-actions"><button class="ug-btn" data-action="confirm-no">${c.cancel || 'Cancel'}</button><button class="ug-btn ${c.danger ? 'danger' : 'dark'}" data-action="confirm-yes">${c.label}</button></div>
      </div>
    </div>
  </div>`;
}
// Options menu (kebab): state.menu = { title, sub, items: [{ label, icon, action, data, danger }] }
export function MenuSheet() {
  const m = state.menu;
  return `
  <div class="scrim" data-action="close-menu">
    <div class="sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="mn-head"><div class="vs-title">${esc(m.title)}</div>${m.sub ? `<div class="vs-sub">${esc(m.sub)}</div>` : ''}</div>
      <div class="mn-list">
        ${m.items.map((it, i) => `<button class="xd-act" data-action="menu-pick" data-i="${i}"><span class="xd-acticon${it.danger ? ' del' : ''}">${it.icon || I.editPen}</span><span>${it.label}</span>${I.smChevR}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

export function mergeExList() {
  const src = exById(state.exDetail);
  const q = (state.merge.q || '').toLowerCase();
  const list = EXERCISES.filter(x => x !== src && x.name.toLowerCase().includes(q))
    .sort((a, b) => (b.muscle === src.muscle) - (a.muscle === src.muscle)).slice(0, 40);
  return list.map(x => `
    <button class="ex-row" data-action="merge-pick-ex" data-id="${x.id}">
      ${exTile(x)}
      <span class="ex-meta"><span class="ex-name">${esc(x.name)}</span><span class="ex-sub"><span class="mus">${x.muscle}</span>${esc(exEquipSummary(x.equipment))}</span></span>
      <span class="ex-chev">${I.smChevR}</span>
    </button>`).join('') || '<div class="mg-empty">No exercises match.</div>';
}
export function MergeExerciseScreen() {
  const src = exById(state.exDetail);
  return `
  <div class="eql-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">Merge Exercise</span></div>
    <div class="eql-head"><div class="eql-title">Merge with another exercise</div><div class="eql-help">Pick the exercise to keep. ${esc(src.name)}’s history and goals move to it.</div></div>
    <div class="mg-search">${I.search}<input data-mergesearch placeholder="Search exercises" value="${esc(state.merge.q || '')}" autocomplete="off"></div>
    <div id="merge-list">${mergeExList()}</div>
  </div>`;
}
export function MergeEquipmentScreen() {
  const src = db.equipment.find(x => x.id === state.eqDetail);
  const rows = db.equipment.filter(sv => sv !== src).map(sv => `
      <button class="xd-eqrow eq-row" data-action="merge-pick-eq" data-id="${sv.id}">
        ${eqImg(sv)}
        <span class="xd-eqtext"><span class="xd-eqname">${esc(sv.name)}</span><span class="xd-eqsub">At ${esc(sv.location)}</span></span>
        <span class="xd-chev">${I.smChevR}</span>
      </button>`).join('');
  return `
  <div class="eql-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">Merge Equipment</span></div>
    <div class="eql-head"><div class="eql-title">Merge with another equipment</div><div class="eql-help">Pick the equipment to keep. ${esc(src.name)}’s goals and history move to it.</div></div>
    ${rows || '<div class="mg-empty">No other saved equipment yet.</div>'}
  </div>`;
}

/* ---- Settings (Release 1.0: "very modest") ---- */
export function SettingsScreen() {
  const u = db.settings.units;
  const unit = (key, label) => `<button class="eqd-unit ${u === key ? 'on' : ''}" data-action="set-units" data-unit="${key}">${label}</button>`;
  const row = (action, icon, label, sub, danger) => `<button class="xd-act st-act" data-action="${action}"><span class="xd-acticon${danger ? ' del' : ''}">${icon}</span><span><span class="st-label">${label}</span><span class="st-sub">${sub}</span></span>${I.smChevR}</button>`;
  return `
  <div class="xd-screen st-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">Settings</span></div>
    <div class="xd-content st-content">
      ${storageWorks() ? '' : '<div class="st-warn">This browser isn’t letting FailUp save. Your data will be lost when you close the tab. Private browsing is the usual cause.</div>'}
      <div class="xd-card eqd-units">
        <div class="xd-hgroup"><div class="xd-h">Weight Units</div><div class="xd-sub">Used for generic equipment. Saved equipment keeps its own units.</div></div>
        <div class="eqd-unitrow">${unit('lbs', 'Pounds (lbs)')}${unit('kg', 'Kilograms (kg)')}</div>
      </div>
      <div class="xd-card st-card">
        <div class="xd-hgroup"><div class="xd-h">Your Data</div><div class="xd-sub">Everything is saved in this browser. Back it up now and then, and restore it on a new phone.</div></div>
        <div class="st-stats">${db.sessions.length} workout${db.sessions.length === 1 ? '' : 's'} logged · ${db.workouts.length} saved workout${db.workouts.length === 1 ? '' : 's'} · ${db.equipment.length} saved equipment</div>
      </div>
    </div>
    <div class="xd-actions">
      ${row('export-data', I.share, 'Back Up My Data', 'Save a backup file')}
      <label class="xd-act st-act"><span class="xd-acticon">${I.history}</span><span><span class="st-label">Restore From Backup</span><span class="st-sub">Replaces what’s on this device</span></span>${I.smChevR}<input type="file" accept=".json,application/json" data-import hidden></label>
      ${row('clear-data', I.trash24, 'Clear My Exercise Data', 'Deletes logged workouts and goals', true)}
      ${row('reset-app', I.trash24, 'Reset FailUp', 'Back to the 3 starter workouts', true)}
    </div>
  </div>`;
}
