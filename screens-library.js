// ============================================================================
// FailUp — library screens: exercises, equipment, the Overload Tracker,
// creation wizards, locations, merge/confirm sheets, Settings.
// ============================================================================
import { state, PURPLE, UPPER_BODY, LOWER_BODY } from './data.js';
import { MUSCLES, EQUIPMENT } from './exercises.js';
import { I, WORKOUT_ICONS, WORKOUT_ICON_KEYS, WORKOUT_ICON_GROUPS, tex, statusBar, fmt, eqName, esc, wt, wtTight, D, PH_EQUIP, PH_EXERCISE, EQ_ICONS } from './ui.js';
import { WORKOUT_COLORS, TEXTURED_COLORS } from './data.js';
import {
  db, EXERCISES, exById, GENERIC, eqById, eqLabel, eqUnits, unitLabel, unitWord, steps, increment,
  derived, goalKey, goalFor, goalsOf, exerciseStats, exerciseLog, isFail, photoSrc, storageWorks, exPhoto, eqType, genericOf, eqKind, volumeDots, goalSegments, eqTypes, TYPE_ORDER, eqLocs, eqAt, eqLocText,
} from './store.js';
import { rpeOf, setRow, listCtx } from './screens-workout.js';

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
// Overload graph. X is time: the chosen range ending today, plus a small sliver past today so a
// goal set today is visible. Dots: workouts that completed the volume at one weight. Goals: a line
// from the day each was set; past goals are faint and end when replaced, the current one runs off the right edge.
const DAY = 86400000;
export function rangeBounds(range, now = Date.now(), earliest = null) {
  const d = new Date(now);
  let x0;
  if (range === '1W') x0 = now - 7 * DAY;
  else if (range === 'All') x0 = earliest != null ? Math.min(earliest, now - 7 * DAY) : now - 7 * DAY;
  else { const m = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }[range]; const s = new Date(d); s.setMonth(s.getMonth() - m); x0 = s.getTime(); }
  if (range === 'All' && earliest != null) x0 -= (now - x0) * 0.04;   // a little room before the first point
  return { x0, today: now, x1: now + (now - x0) * 0.08 };
}
function xTicks(x0, x1, today) {
  const span = (today - x0) / DAY, out = [];
  const mid = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (span <= 10) {
    for (let d = mid(today); d.getTime() >= x0; d.setDate(d.getDate() - 1)) out.unshift({ t: d.getTime(), label: W[d.getDay()] });
  } else if (span <= 45) {
    for (let d = mid(today); d.getTime() >= x0; d.setDate(d.getDate() - 7)) out.unshift({ t: d.getTime(), label: `${M[d.getMonth()]} ${d.getDate()}` });
  } else {
    const every = span <= 200 ? 1 : span <= 400 ? 2 : span <= 800 ? 3 : span <= 1600 ? 6 : 12;
    const yearly = span > 400;
    const d = mid(today); d.setDate(1);
    while (d.getMonth() % every) d.setMonth(d.getMonth() - 1);
    for (; d.getTime() >= x0; d.setMonth(d.getMonth() - every))
      out.unshift({ t: d.getTime(), label: yearly && (d.getMonth() === 0 || every >= 6) ? `${M[d.getMonth()]} '${String(d.getFullYear()).slice(2)}` : M[d.getMonth()] });
  }
  return out.filter(k => k.t <= x1);
}
// mini: the home goal card's thumbnail, same data and geometry, no labels
export function overloadChart({ dots, goals, x0, x1, today }, unit, mini = false) {
  const W = mini ? 236 : 377, H = mini ? 76 : 232;
  const padL = mini ? 8 : 16, padR = mini ? 8 : 40, padT = mini ? 10 : 24, padB = mini ? 8 : 28;
  const uid = mini ? 'm' + Math.random().toString(36).slice(2, 7) : '';
  const plotL = padL, plotR = W - padR, plotT = padT, plotB = H - padB;
  const T = a => new Date(a).getTime();
  const inView = dots.filter(d => T(d.at) >= x0);
  const segs = goals.filter(g => (g.to == null || T(g.to) >= x0) && T(g.from) <= x1);
  const vals = inView.map(d => d.weight).concat(segs.map(g => g.weight));
  if (!vals.length) return `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="No overload data yet"${mini ? ' class="hg-spark"' : ''}>
    <text x="${((plotL + plotR) / 2).toFixed(1)}" y="${((plotT + plotB) / 2 + 6).toFixed(1)}" font-family="Archivo" font-weight="500" font-size="16" fill="#5f636b" text-anchor="middle">No Data Yet</text>
  </svg>`;
  // Y axis counts in the equipment's goal increment (5 lbs, 2.5 kg, 1 for numbered stacks), or a multiple of it
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const inc = increment(unit) || 5;
  const step = inc * ([1, 2, 4, 5, 10, 20, 50, 100].find(k => (hi - lo) / (inc * k) <= 4) || 200);
  const pad = mini ? step / 2 : step;
  const yMin = lo >= 0 ? Math.max(0, Math.floor(lo / step) * step - pad) : Math.floor(lo / step) * step - pad;
  const yMax = Math.ceil(hi / step) * step + pad;
  const yTicks = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) yTicks.push(v);
  const y = v => plotB - ((v - yMin) / (yMax - yMin)) * (plotB - plotT);
  const x = t => plotL + ((t - x0) / (x1 - x0)) * (plotR - plotL);
  const f = n => n.toFixed(1);
  const grid = yTicks.map(v => `<line x1="${plotL}" x2="${plotR}" y1="${f(y(v))}" y2="${f(y(v))}" stroke="#e4e4e8" stroke-width="1" stroke-dasharray="2 5"/>`).join('');
  const yLabels = yTicks.map(v => `<text x="${W - 32}" y="${f(y(v) + 4)}" font-family="Archivo" font-size="13" fill="#000">${fmt(v)}</text>`).join('');
  const ticks = xTicks(x0, x1, today);
  const xLabels = ticks.map(k => { const px = x(k.t); const anchor = px < plotL + 14 ? 'start' : 'middle';
    return `<text x="${f(px)}" y="${plotB + 18}" font-family="Archivo" font-size="11" fill="#000" text-anchor="${anchor}">${k.label}</text>`; }).join('');
  // goal lines: past ones faint, the current one solid with its band
  const cur = segs.find(g => g.current);
  const gx = g => [Math.max(x0, T(g.from)), g.to == null ? x1 : Math.min(x1, T(g.to))];
  const past = segs.filter(g => !g.current).map(g => { const [a, b] = gx(g);
    return `<line x1="${f(x(a))}" x2="${f(x(b))}" y1="${f(y(g.weight))}" y2="${f(y(g.weight))}" stroke="${PURPLE}" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>`; }).join('');
  let current = '';
  if (cur) {
    const [a] = gx(cur), cx = x(a), cy = y(cur.weight);
    current = `
    <rect x="${f(cx)}" y="${f(cy)}" width="${f(plotR - cx)}" height="${f(plotB - cy)}" fill="url(#goalgrad${uid})"/>
    <line x1="${f(cx)}" x2="${plotR}" y1="${f(cy)}" y2="${f(cy)}" stroke="${PURPLE}" stroke-width="2.5" stroke-linecap="round"/>
    ${mini ? '' : `<text x="${f(Math.min(cx + 4, plotR - 28))}" y="${f(cy - 7)}" font-family="Archivo" font-weight="700" font-size="11" fill="${PURPLE}">Goal</text>`}`;
  }
  // the climb: dots joined in time order (one point before the range keeps the line coming in from the left)
  const firstIn = dots.findIndex(d => T(d.at) >= x0);
  const path = firstIn < 0 ? [] : dots.slice(Math.max(0, firstIn - 1));
  const line = path.map((d, i) => `${i ? 'L' : 'M'}${f(x(T(d.at)))} ${f(y(d.weight))}`).join(' ');
  const dotEls = inView.map(d => `<circle cx="${f(x(T(d.at)))}" cy="${f(y(d.weight))}" r="${mini ? 4 : 5}" fill="${PURPLE}" stroke="#fff" stroke-width="2"/>`).join('');
  return `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progressive overload chart"${mini ? ' class="hg-spark"' : ''}>
    <defs>
      <linearGradient id="goalgrad${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PURPLE}" stop-opacity="0.35"/><stop offset="1" stop-color="${PURPLE}" stop-opacity="0"/></linearGradient>
      <clipPath id="plotclip${uid}"><rect x="${plotL}" y="0" width="${plotR - plotL}" height="${plotB}"/></clipPath>
    </defs>
    ${mini ? '' : grid + yLabels + xLabels}
    <g clip-path="url(#plotclip${uid})">
      ${past}${current}
      ${path.length > 1 ? `<path d="${line}" fill="none" stroke="${PURPLE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${dotEls}
    </g>
  </svg>`;
}

/* ------------------------------ tracker screen ---------------------------- */
const RANGES = ['1W', '1M', '3M', '6M', '1Y', 'All'];
export function trackerData() {
  const t = state.tracker, v = t.volume;
  const dots = volumeDots(t.exId, t.equip, v.sets, v.reps);
  const goals = goalSegments(t.exId, t.equip, v.sets, v.reps);
  const firsts = [...dots.map(d => new Date(d.at).getTime()), ...goals.map(g => new Date(g.from).getTime())];
  const b = rangeBounds(t.range, Date.now(), firsts.length ? Math.min(...firsts) : null);
  return { dots, goals, ...b, goal: goalFor(t.exId, t.equip, v.sets, v.reps), unit: eqUnits(t.equip) };
}
export function TrackerScreen() {
  const t = state.tracker, v = t.volume;
  const ex = exById(t.exId) || { name: 'Exercise', muscle: '' };
  const data = trackerData(), { dots, goal, unit } = data;
  const seg = RANGES.map(r => `<button data-action="set-range" data-range="${r}" class="${r === t.range ? 'on' : ''}">${r}</button>`).join('');
  // history: newest first, grouped by month, with the change from the previous completed workout
  const items = dots.map((a, i) => ({ ...a, delta: i ? a.weight - dots[i - 1].weight : null, first: i === 0 })).reverse();
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
              : it.delta === 0 ? `<div class="h-delta same">Same weight</div>`
              : `<div class="h-delta${it.delta < 0 ? ' down' : ''}">${it.delta > 0 ? I.trendUp(PURPLE) : ''} ${it.delta > 0 ? '+' : ''}${wtTight(it.delta, unit)}</div>`}
          </div>`).join('')}
      </div>
    </div>`).join('');
  const sv = eqById(t.equip);
  // a goal suggestion waiting for a yes or no (this volume first, otherwise any for this exercise + equipment)
  const suggs = (db.suggestions || []).filter(x => x.exId === t.exId && x.equip === t.equip);
  const sugg = suggs.find(x => x.key === goalKey(t.exId, t.equip, v.sets, v.reps)) || suggs[0];
  const equipImg = sv && photoSrc(sv.photo)
    ? `<img class="tk-equip-img" src="${photoSrc(sv.photo)}" alt="">`
    : `<div class="tk-equip-img ph${EQ_ICONS[eqKind(t.equip)] ? ' kind' : ''}">${PH_EQUIP(eqKind(t.equip))}</div>`;
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
          <div class="tk-equip-name">${esc(eqLabel(t.equip))}${sv ? ` <span class="tk-equip-loc">· ${esc(eqLocText(sv))}</span>` : ''}</div>
        </div>
        <button class="tk-sortbtn" data-action="open-swap" data-owner="tracker" aria-label="Change equipment">${I.swap24}</button>
      </div>
      ${sugg ? `
      <div class="tk-sugg">
        <div class="g-label">Overload Goal Suggestion</div>
        <div class="tk-sugg-value tnum">${sugg.sets} Sets • ${sugg.reps} Reps • ${wtTight(sugg.weight, unit)}</div>
        ${sugg.reason ? `<div class="tk-sugg-reason">${esc(sugg.reason)}</div>` : ''}
        <div class="wcard-actions"><button class="wpill" data-action="sugg-no" data-key="${esc(sugg.key)}">Dismiss</button><button class="wpill dark" data-action="sugg-yes" data-key="${esc(sugg.key)}">Set Goal</button></div>
      </div>` : ''}
      <div class="tk-chart">${overloadChart(data, unit)}</div>
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
        <div class="lg"><span class="swatch-line past"></span> Past Goals</div>
        <div class="lg"><span class="swatch-dot"></span> <span>Completed<br><span class="sub">(${v.sets} Sets, ${v.reps} Reps)</span></span></div>
      </div>
    </div>
    <div class="tk-body">
      <div class="card tk-explain">
        <h3>Progressive Overload</h3>
        <p>Each dot is a workout where you did all ${v.sets} sets of ${v.reps} at one weight. The solid line is your current goal, starting the day you set it. Keep the dots climbing.</p>
        ${goal == null ? `<p class="tk-note">No goal yet for ${v.sets} sets of ${v.reps} reps on this setup. Tap the pencil, or finish a workout and FailUp suggests one.</p>` : ''}
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
  const inSession = v.context === 'session', master = v.context === 'master';
  const goal = master ? null : v.goalFor(v.sets, v.reps), pts = master ? 0 : v.points(v.sets, v.reps);
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
            <div class="vs-title">${master ? 'Volume for every exercise' : inSession ? 'Volume Settings' : 'Volume Filter'}</div>
            <div class="vs-sub">${master ? `Sets all ${v.count} exercises at once. You can still tweak any one after.` : inSession ? 'How much do you want to lift today?' : 'Select the volume you want to see data for'}</div>
          </div>
          ${master ? '' : `<div class="vs-info">
            <div>
              <div class="vs-main tnum">${v.sets} Sets · ${v.reps} Reps · <span class="lbs">${goal != null ? wtTight(goal, v.unit) : 'No Goal Yet'}</span></div>
              <div class="vs-meta">${goal != null ? `${pts} datapoint${pts === 1 ? '' : 's'} logged` : 'Log this exercise to get your first overload goal'}</div>
            </div>
            <span class="vs-graph">${I.graph}</span>
          </div>`}
          <div class="vs-steppers">${stepper('Sets', 'sets', v.sets)}${stepper('Reps', 'reps', v.reps)}</div>
        </div>
        <div class="ug-actions">
          <button class="ug-btn" data-action="close-volume">Nevermind</button>
          <button class="ug-btn dark" data-action="save-volume">${master ? 'Save Changes' : 'Save'}</button>
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
// how many working sets you've logged for each exercise (for the exercise lists)
let setsCache = { n: -1, map: new Map() };
function setsLogged(id) {
  if (setsCache.n !== db.sessions.length) {
    const map = new Map();
    for (const ss of db.sessions) for (const e of ss.exercises) map.set(e.exId, (map.get(e.exId) || 0) + e.sets.filter(x => x.type !== 'warmup').length);
    setsCache = { n: db.sessions.length, map };
  }
  return setsCache.map.get(id) || 0;
}
function exRow(ex) {
  const s = state.exercises;
  const multi = s.mode === 'quickadd', on = multi && s.picked.includes(ex.id);
  return `
    <button class="ex-row${on ? ' picked' : ''}" data-action="open-exercise" data-id="${ex.id}">
      ${exTile(ex)}
      <span class="ex-meta">
        <span class="ex-name">${esc(ex.name)}</span>
        <span class="ex-sub"><span class="mus">${ex.muscle}</span>${setsLogged(ex.id) ? `${setsLogged(ex.id)} set${setsLogged(ex.id) === 1 ? '' : 's'} logged` : 'No sets yet'}</span>
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
// "Not listed?" cell at the end of results: create it (name prefilled from the search)
function createRow(q) {
  if (!['browse', 'add'].includes(state.exercises.mode)) return '';
  return `<button class="ex-row ex-createrow" data-action="create-exercise-start" data-name="${esc(q)}">
      <span class="ex-tile ex-createic">${I.plus20}</span>
      <span class="ex-createtext"><span class="ex-createtitle">${q ? `Create “${esc(q)}”` : 'Create an exercise'}</span><span class="ex-createsub">Don’t see it? Add your own.</span></span>
      <span class="xd-chev">${I.smChevR}</span>
    </button>`;
}
export function exListInner() {
  const s = state.exercises;
  const active = s.muscles.length || s.equipment.length;
  const matched = matchExercises();
  if (active || s.search.trim()) {
    if (!matched.length) return `<div class="ex-empty">Nothing matches.</div>${createRow(s.search.trim())}`;
    return `<div class="ex-sectionrow"><span class="sec-label">Results (${matched.length})</span></div>${matched.map(exRow).join('')}${createRow(s.search.trim())}`;
  }
  const recent = recentExercises();
  const recentShown = s.recentOpen ? recent : recent.slice(0, 4);
  return `
    ${recent.length ? `
    <div class="ex-sectionrow"><span class="sec-label">Recent (${recent.length})</span></div>
    ${recentShown.map(exRow).join('')}
    ${s.recentOpen || recent.length <= 4 ? '' : `<button class="ex-showmore" data-action="expand-recent">Show More (${recent.length - 4} more)</button>`}` : ''}
    <div class="ex-sectionrow"><span class="sec-label">All exercises (${EXERCISES.length})</span><span class="sec-sort">A–Z</span></div>
    ${[...EXERCISES].sort((a, b) => a.name.localeCompare(b.name)).map(exRow).join('')}${createRow('')}`;
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
    <div class="ex-search${s.search ? ' has-text' : ''}">
      ${I.search}
      <input type="text" placeholder="Search exercises" data-search value="${esc(s.search)}">
      <button class="search-x" data-action="search-clear" aria-label="Clear search"><svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="10" fill="#b4b2bd"/><path d="M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg></button>
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
    <div class="sheet pk-sheet" data-stop style="--pk-sel:${state.create ? state.create.color : '#111'}">
      <div class="sheet-grab"></div>
      <div class="pk-body">
        <div class="pk-titleblock"><div class="vs-title">${kind === 'color' ? 'Choose a color' : 'Choose an icon'}</div><div class="vs-sub">For this workout’s thumbnail</div></div>
        <div class="pk-grid pk-scroll${kind === 'icon' ? ' pk-icongrid' : ' pk-colorgrid'}">${cells}</div>
        <div class="pk-actions"><button class="pk-btn" data-action="close-picker">Nevermind</button><button class="pk-btn dark" data-action="save-picker">Save</button></div>
      </div>
    </div>
  </div>`;
}
export function ColorPickerSheet() {
  const [selHex, selTex = ''] = String(state.pickDraft).split('|');
  const sw = (c, label) => {
    const on = c.hex === selHex && (c.tex || '') === selTex;
    return `<button class="pk-swatch ${on ? 'on' : ''}" style="background:${c.hex}" data-action="pick-color" data-hex="${c.hex}" data-tex="${c.tex || ''}" aria-label="${label}"><span class="pk-check">${I.checkW}</span></button>`;
  };
  const cells = `<div class="pk-group">Solid <span>${WORKOUT_COLORS.length}</span></div>${WORKOUT_COLORS.map(c => sw(c, c.name)).join('')}`
    + `<div class="pk-group">Themes <span>${TEXTURED_COLORS.length}</span></div>${TEXTURED_COLORS.map(c => sw(c, c.name)).join('')}`;
  return pickerSheet('color', cells);
}
export function IconPickerSheet() {
  const sel = state.pickDraft;
  const tile = k => `<button class="pk-icon ${k === sel ? 'on' : ''}" data-action="pick-icon" data-icon="${k}" aria-label="${k}">${WORKOUT_ICONS[k]}</button>`;
  const cells = WORKOUT_ICON_GROUPS.map(([t, keys]) => `<div class="pk-group">${t} <span>${keys.length}</span></div>${keys.map(tile).join('')}`).join('');
  return pickerSheet('icon', cells);
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
  const segs = `<div class="wiz-fill" style="width:${(w.step / STEPS * 100).toFixed(2)}%"></div>`;   // one bar across the screen, filled purple
  let body = '';
  if (w.step === 1) {
    body = `
      <div class="wiz-title">Name the Exercise</div>
      <div class="wiz-help">Whatever you’d call it at the gym.</div>
      <input class="wiz-input" type="text" placeholder="e.g. Bajan Cable Curl" data-exwizname value="${esc(w.name)}" autocomplete="off">${wizErr(w)}`;
  } else if (w.step === 2) {
    body = `<div class="wiz-title">Select a primary muscle group</div><div class="wiz-help">What does it hit the most?</div>${wizErr(w)}${exMuscleGrid(w.primary ? [w.primary] : [], 'exwiz-primary', null)}`;
  } else if (w.step === 3) {
    body = `<div class="wiz-title">Select any secondary muscle groups</div><div class="wiz-help">(Optional) Select all that apply</div>${exMuscleGrid(w.secondary, 'exwiz-secondary', w.primary)}`;
  } else if (w.step === 4) {
    // only generic kinds here; saved machines get picked mid-workout
    const kinds = [...EQ_TYPES].sort((x, y) => TYPE_ORDER.indexOf(eqName(x)) - TYPE_ORDER.indexOf(eqName(y)));
    body = `
      <div class="wiz-title">What kind of equipment?</div>
      <div class="wiz-help">Select every kind you could use for this exercise. You can pick your saved machines mid-workout.</div>${wizErr(w)}
      <div class="pk-list">
        ${kinds.map(k => pickCell({ action: 'exwiz-equip', data: { name: k }, on: w.equipment.includes(k), multi: true, kind: true, icon: PH_EQUIP(eqName(k)), title: eqName(k) })).join('')}
      </div>`;
  } else {
    const p = photoSrc(w.photo);
    body = `
      <div class="wiz-title">Add a thumbnail photo</div>
      <div class="wiz-help">(Optional) Take a picture, or upload one</div>
      ${p ? `<div class="wiz-imgcard filled"><img src="${p}" alt="">${photoButton('exwiz', 'Change photo', 'xd-changephoto')}</div>` : `
      <div class="wiz-imgcard">${I.photoGlyph}<div class="imgt1">No photo yet</div><div class="imgt2">Snap one so it’s easy to spot</div>${photoButton('exwiz', 'Add a photo', 'imgbtn')}</div>`}`;
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

/* A tappable list cell used for picking things (locations, equipment kinds). Selected = light green + green check. */
const PIN = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
export function pickCell({ action, data = {}, on = false, icon, title, sub = '', multi = false, add = false, kind = false }) {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  const tick = add ? `<span class="xd-chev">${I.smChevR}</span>`
    : multi ? `<span class="fl-check${on ? ' on' : ''}">${on ? I.checkW : ''}</span>`
    : on ? `<span class="swp-tick">${I.checkW}</span>` : '';
  return `<button class="xd-eqrow swp-row pk-cell${on ? ' on' : ''}${add ? ' add' : ''}" data-action="${action}"${attrs}${multi ? ` role="checkbox" aria-checked="${on}"` : ''}>
      <span class="xd-eqimg pk-ic${add ? ' add' : ''}${kind ? ' kind' : ''}">${icon}</span>
      <span class="xd-eqtext"><span class="xd-eqname">${esc(title)}</span>${sub ? `<span class="xd-eqsub">${esc(sub)}</span>` : ''}</span>
      ${tick}
    </button>`;
}
export function locationCells(cur, pickAction, addAction, multi = false) {
  const n = l => db.equipment.filter(x => eqAt(x, l)).length;
  return `<div class="pk-list">
      ${db.locations.map(l => pickCell({ action: pickAction, data: { name: l }, on: multi ? cur.includes(l) : l === cur, multi, icon: PIN, title: l, sub: n(l) ? `${n(l)} saved equipment` : 'No saved equipment yet' })).join('')}
      ${pickCell({ action: addAction, icon: I.plus20, title: 'Add a new location', add: true })}
    </div>`;
}
/* ===================== SAVE EQUIPMENT (4-step wizard) ===================== */
export function EquipmentWizard() {
  const w = state.eqwiz, STEPS = 5;
  const segs = `<div class="wiz-fill" style="width:${(w.step / STEPS * 100).toFixed(2)}%"></div>`;   // one bar across the screen, filled purple
  const UNITS = [['lbs', 'Pounds (lbs)'], ['kg', 'Kilograms (kg)'], ['simple', 'Simple Numbers']];
  let body = '';
  if (w.step === 1) {
    body = `
      <div class="wiz-title">Where is this located?</div>
      <div class="wiz-help">Where is it? It’ll show up when you train there.</div>
      ${locationCells(w.location, 'eqwiz-location', 'eqwiz-addloc')}${wizErr(w)}`;
  } else if (w.step === 2) {
    body = `
      <div class="wiz-title">Name the Equipment</div>
      <div class="wiz-help">Something you can recognize at a glance.</div>
      <div class="wiz-namecard"><input type="text" placeholder="e.g. Assisted Pull-up Machine" data-eqwizname value="${esc(w.name)}" autocomplete="off"><div class="loc">At ${esc(w.location)}</div></div>${wizErr(w)}`;
  } else if (w.step === 3) {
    body = `
      <div class="wiz-title">What kind of equipment is it?</div>
      <div class="wiz-help">Pick every kind it can be. FailUp uses this to grab your saved gear when a workout calls for it.</div>
      <div class="pk-list">
        ${TYPE_ORDER.map(t => pickCell({ action: 'eqwiz-type', data: { name: t }, on: (w.types || []).includes(t), multi: true, kind: true, icon: PH_EQUIP(t), title: t })).join('')}
      </div>${wizErr(w)}`;
  } else if (w.step === 4) {
    body = `
      <div class="wiz-title">Choose weight units</div>
      <div class="wiz-help">Match the stack or plates.</div>
      <div class="wiz-unitcard"><div class="ulbl">Weight Units</div><div class="unit-pills">${UNITS.map(([k, label]) => `<button class="unit-pill ${w.units === k ? 'on' : ''}" data-action="eqwiz-units" data-name="${k}">${label}</button>`).join('')}</div></div>`;
  } else {
    const p = photoSrc(w.photo);
    body = `
      <div class="wiz-title">Add a thumbnail photo</div>
      <div class="wiz-help">(Optional) Take a picture, or upload one</div>
      ${p ? `<div class="wiz-imgcard filled"><img src="${p}" alt="">${photoButton('eqwiz', 'Change photo', 'xd-changephoto')}</div>` : `
      <div class="wiz-imgcard">${I.photoGlyph}<div class="imgt1">No photo yet</div><div class="imgt2">Snap one so it’s easy to find</div>${photoButton('eqwiz', 'Add a photo', 'imgbtn')}</div>`}`;
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
          <span class="xd-eqtext"><span class="xd-eqname">${esc(sv.name)}</span><span class="xd-eqsub">At ${esc(eqLocText(sv))}${goalTxt(goalCount('eq:' + sv.id))}</span></span>
          <span class="xd-chev">${I.smChevR}</span>
        </button>`;
  const genRows = generic.map(g => `
        <button class="xd-eqrow" data-action="open-tracker" data-equip="${esc(g)}">
          ${eqImg(null, 'xd-eqimg', eqKind(g))}
          <span class="xd-eqtext"><span class="xd-eqname">${esc(g)}</span>${goalCount(g) ? `<span class="xd-eqsub">${goalTxt(goalCount(g)).slice(3)}</span>` : ''}</span>
          <span class="xd-chev">${I.smChevR}</span>
        </button>`).join('');
  const stat = (label, val) => `<div class="xd-stat"><div class="xd-statlabel">${label}</div>${val}</div>`;
  const own = photoSrc(e.photo), p = exPhoto(e);
  const howTo = (e.steps || []).filter(Boolean);
  // opened from the exercise picker: a fixed Add / Swap In button instead of the edit actions
  const pick = state.exPick && state.exPick.id === e.id && state.stack[state.stack.length - 1] === 'exercises' ? state.exPick : null;
  return `
  <div class="xd-screen${pick ? ' xd-picking' : ''}">
    <div class="xd-hero">
      ${statusBar()}
      <button class="icon-btn xd-back" data-action="back" aria-label="Back">${I.chevL}</button>
      ${p ? `<img class="xd-heroimg" src="${p}" alt="" onerror="this.remove()">${photoButton('exercise', own ? 'Change photo' : 'Use your own photo', 'xd-changephoto')}` : `
      <div class="xd-empty">${I.photoGlyph}<div class="xd-empty-title">No photo yet</div><div class="xd-empty-help">Snap one so it’s easy to spot</div>${photoButton('exercise', 'Add a photo', 'xd-addphoto')}</div>`}
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
          <div class="xd-hgroup"><div class="xd-h">Related Equipment</div><div class="xd-sub">Your mid-workout swaps. Tap one to see its goals.</div></div>
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
    ${pick ? `<div class="cw-footer xd-pickbar"><button class="btn solid" data-action="xd-pick">${pick.swap ? 'Swap In Exercise' : 'Add Exercise'}</button></div>` : `
    <div class="xd-actions">
      <button class="xd-act" data-action="edit-exercise"><span class="xd-acticon">${I.editPen}</span><span>Edit Exercise</span>${I.smChevR}</button>
      <button class="xd-act" data-action="merge-exercise"><span class="xd-acticon">${I.merge}</span><span>Merge With Another Exercise</span>${I.smChevR}</button>
      <button class="xd-act" data-action="delete-exercise"><span class="xd-acticon del">${I.trash24}</span><span>Delete Exercise</span>${I.smChevR}</button>
    </div>`}
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
    <div class="hx-list">${cards || '<div class="mg-empty">Nothing yet. Your sets land here after a workout.</div>'}</div>
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
        <span class="xd-eqtext"><span class="xd-eqname">${esc(sv.name)}</span><span class="xd-eqsub">At ${esc(eqLocText(sv))}${n ? ` · <span class="goals">${n} Goal${n === 1 ? '' : 's'}</span>` : ''}</span></span>
        <span class="xd-chev">${I.smChevR}</span>
      </button>`;
  }).join('');
  return `
  <div class="eql-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">Equipment</span><button class="nav-create" data-action="eq-create">Create</button></div>
    <div class="eql-head">
      <div class="eql-title">Your Saved Equipment</div>
      <div class="eql-help">Every machine feels different. Save yours so each gets its own goals.</div>
    </div>
    ${rows ? `<div class="eql-listhdr"><span>Saved equipment (${list.length})</span></div>${rows}` : ''}

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
      <div class="xd-empty">${I.photoGlyph}<div class="xd-empty-title">No photo yet</div><div class="xd-empty-help">Snap one so it’s easy to find</div>${photoButton('equipment', 'Add a photo', 'xd-addphoto')}</div>`}
      ${statusBar(!!p)}
      <button class="icon-btn xd-back" data-action="back" aria-label="Back">${I.chevL}</button>
    </div>
    <div class="xd-content">
      <div class="xd-card xd-details">
        <div class="xd-name eqd-name">${eqLocs(sv).length > 1 ? esc(sv.name) : `${esc(sv.location)} ${esc(sv.name)}`}</div>
        <div class="xd-kv"><span>Listing Type</span><span>User Added</span></div>
      </div>
      <div class="eqd-loc eqd-loccard"><span class="eqd-loctext"><span class="cw-label">What kind of equipment is it?</span><span class="eqd-locval">${esc(eqTypes(sv).join(', '))}</span></span><button class="sess-dpill eqd-locedit" data-action="open-eqtypes" aria-label="Edit equipment kinds">${I.pencil}</button></div>
      <div class="eqd-loc eqd-loccard"><span class="eqd-loctext"><span class="cw-label">Where is this located?</span><span class="eqd-locval">${esc(eqLocText(sv))}</span></span><button class="sess-dpill eqd-locedit" data-action="open-location" data-target="equipment" aria-label="Edit locations">${I.pencil}</button></div>
      <div class="xd-card eqd-units">
        <div class="xd-hgroup"><div class="xd-h">Equipment Details</div><div class="xd-sub">Units and how big your goal jumps are.</div></div>
        <div class="cw-label eqd-unitslbl">Weight Units</div>
        <div class="eqd-unitrow">${unit('lbs', 'Pounds (lbs)')}${unit('kg', 'Kilograms (kg)')}${unit('simple', 'Simple Numbers')}</div>
      </div>
      <div class="xd-card xd-related">
        <div class="xd-relhead"><div class="xd-hgroup"><div class="xd-h">Related Exercises</div><div class="xd-sub">Listed are exercises you've done on this machine and any active overload goals per exercise</div></div></div>
        <div class="xd-sechdr"><span>EXERCISES (${exIds.size})</span></div>
        <div class="eqd-exlist">${related || '<div class="mg-empty sm">Log something on this and it shows up here.</div>'}</div>
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
// All Equipment: every saved machine, then every generic type. Tap a row to use it now;
// the checkbox picks what shows up in this exercise's quick swap sheet.
export function EquipmentSwapScreen(currentRef) {
  const sel = state.swap.sel || currentRef;
  const saved = [...db.equipment].sort((a, b) => a.location.localeCompare(b.location) || a.name.localeCompare(b.name));
  const row = (ref, img, name, sub) => {
    const on = ref === sel;
    return `
      <button class="xd-eqrow swp-row ae-cell${on ? ' on' : ''}" data-action="swap-pick" data-ref="${esc(ref)}">
        ${img}
        <span class="xd-eqtext"><span class="xd-eqname">${esc(name)}</span>${sub ? `<span class="xd-eqsub">${esc(sub)}</span>` : ''}</span>
        ${on ? `<span class="swp-tick">${I.checkW}</span>` : ''}
      </button>`;
  };
  const changed = state.swap.sel && state.swap.sel !== currentRef;
  const tray = changed ? `<div class="cw-footer pend-tray${state.swap.trayShownAll ? '' : ' enter'}"><button class="btn ghost" data-action="swap-cancel">Nevermind</button><button class="btn solid" data-action="swap-save">Save</button></div>` : '';
  state.swap.trayShownAll = !!changed;
  return `
  <div class="swp-screen ae-screen${changed ? ' has-tray' : ''}">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back">${I.chevL}</button><span class="nav-title">All Equipment</span><button class="nav-create" data-action="swap-add">Create</button></div>
    <div class="ae-hdr"><span>Saved</span></div>
    <div class="ae-list">
      ${saved.map(sv => row('eq:' + sv.id, eqImg(sv), sv.name, `${eqTypes(sv).join(', ')} · At ${eqLocText(sv)}`)).join('') || `<div class="swp-none">Nothing saved yet. Tap Create to add a machine.</div>`}
    </div>
    <div class="ae-hdr"><span>Generic</span></div>
    <div class="ae-list">
      ${GENERIC.map(k => row(k, eqImg(null, 'xd-eqimg', k), k, '')).join('')}
    </div>
    ${tray}
  </div>`;
}

/* Preferred equipment type for an exercise in a workout (Create / Edit Workout). */
export function PrefTypeSheet() {
  const p = state.prefType, c = p && listCtx(p.owner), it = c && c.items[p.index];
  if (!it) return '';
  const cur = genericOf(eqById(it.equip) ? eqType(eqById(it.equip)) : it.equip);
  return `
  <div class="scrim" data-action="close-preftype">
    <div class="sheet swp-sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="swp-sheethead">
        <div class="vs-title">Preferred equipment</div>
        <div class="vs-sub">Just for convenience. FailUp grabs a matching machine you saved where you train, and you can swap anytime mid-workout.</div>
      </div>
      <div class="swp-sheetbody">
        ${GENERIC.map(t => `<button class="xd-eqrow swp-row${t === cur ? ' on' : ''}" data-action="pick-preftype" data-name="${esc(t)}">${eqImg(null, 'xd-eqimg', t)}<span class="xd-eqtext"><span class="xd-eqname">${esc(t)}</span></span>${t === cur ? `<span class="swp-tick">${I.checkW}</span>` : ''}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

/* Swap sheet: a short list of the saved machines that fit this exercise (here first),
   then the generic types it uses. "All equipment" opens the full swap screen. */
export function EquipmentSwapSheet(currentRef, exId, location) {
  const ex = exById(exId), sel = state.swap.sel || currentRef;
  // mid-workout: everything saved where you're training; otherwise saved gear of the kinds this exercise uses
  const lib = (ex && ex.equipment) || [];
  const types = new Set(lib.filter(k => !k.startsWith('eq:')).map(k => genericOf(eqName(k))));
  const curSv = eqById(currentRef);
  if (currentRef) eqTypes(curSv || { name: currentRef, type: genericOf(currentRef) }).forEach(t => types.add(t));
  const saved = db.equipment.filter(sv => location ? eqAt(sv, location) || sv === curSv
      : lib.includes('eq:' + sv.id) || eqTypes(sv).some(t => types.has(t)) || sv === curSv)
    .sort((a, b) => (b === curSv) - (a === curSv) || a.name.localeCompare(b.name));
  const tick = on => on ? `<span class="swp-tick">${I.checkW}</span>` : '';
  const savedRows = saved.map(sv => {
    const ref = 'eq:' + sv.id, on = ref === sel;
    return `<button class="xd-eqrow swp-row${on ? ' on' : ''}" data-action="swap-pick" data-ref="${ref}">
        ${eqImg(sv)}
        <span class="xd-eqtext"><span class="xd-eqname">${esc(sv.name)}</span><span class="xd-eqsub">${esc(eqTypes(sv).join(', '))}${location && eqAt(sv, location) ? '' : ` · At ${esc(eqLocText(sv))}`}</span></span>
        ${tick(on)}
      </button>`;
  }).join('');
  const genRows = GENERIC.map(n => {
    const on = n === sel;
    return `<button class="xd-eqrow swp-row${on ? ' on' : ''}" data-action="swap-pick" data-ref="${esc(n)}">
        ${eqImg(null, 'xd-eqimg', n)}
        <span class="xd-eqtext"><span class="xd-eqname">${esc(n)}</span></span>
        ${tick(on)}
      </button>`;
  }).join('');
  const changed = state.swap.sel && state.swap.sel !== currentRef;
  const tray = changed ? `<div class="ug-actions swp-sheetfoot pend-tray${state.swap.trayShown ? '' : ' enter'}"><button class="ug-btn" data-action="swap-cancel">Nevermind</button><button class="ug-btn dark" data-action="swap-save">Save</button></div>` : '';
  if (changed) state.swap.trayShown = true; else state.swap.trayShown = false;
  return `
  <div class="scrim" data-action="close-swap">
    <div class="sheet swp-sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="swp-sheethead">
        <div class="vs-title">Swap equipment</div>
        <div class="vs-sub">${ex ? `For ${esc(ex.name)}` : 'Pick what you’re using'}</div>
      </div>
      <div class="swp-sheetbody">
        <div class="swp-sechdr"><span>${location ? `Saved at ${esc(location)}` : 'Saved'}</span></div>
        ${pickCell({ action: 'swap-add', icon: I.plus20, title: 'Save a new machine', add: true }).replace('<span class="xd-chev">' + I.smChevR + '</span>', '')}
        ${savedRows}
        ${db.equipment.length ? pickCell({ action: 'swap-all', icon: I.list || I.smChevR, title: `View All Saved Equipment (${db.equipment.length})`, add: true }).replace('pk-ic add', 'pk-ic add swp-allic') : ''}
        <div class="swp-sechdr"><span>Generic</span></div>${genRows}
      </div>
      ${tray}
    </div>
  </div>`;
}

/* ===================== photos, locations, delete & merge ===================== */
export function photoButton(target, label, cls) {
  return `<label class="${cls}">${label}<input type="file" accept="image/*" data-photo="${target}" hidden></label>`;
}
export function eqImg(sv, cls = 'xd-eqimg', kind = null) {
  const p = sv && photoSrc(sv.photo), k = sv ? genericOf(eqType(sv)) : kind;
  return p ? `<img class="${cls}" src="${p}" alt="">` : `<span class="${cls} generic ph${EQ_ICONS[k] ? ' kind' : ''}">${PH_EQUIP(k)}</span>`;
}

export function LocationSheet() {
  const lp = state.locPick;
  const eqsv = lp.target === 'equipment' ? db.equipment.find(x => x.id === state.eqDetail) : null;
  const cur = lp.target === 'lineup' ? (state.session && state.session.location) : eqsv ? eqLocs(eqsv) : null;
  return `
  <div class="scrim" data-action="close-location">
    <div class="sheet pk-sheet" data-stop style="--pk-sel:${state.create ? state.create.color : '#111'}">
      <div class="sheet-grab"></div>
      <div class="pk-body loc-body">
        <div class="pk-titleblock"><div class="vs-title">${eqsv ? 'Where is this located?' : 'Choose a location'}</div><div class="vs-sub">${lp.target === 'lineup' ? 'Where are you lifting? FailUp grabs your saved gear there.' : 'Pick every place you have this same machine.'}</div></div>
        ${eqsv ? locationCells(cur, 'toggle-eqloc', 'add-location', true) : locationCells(cur, 'pick-location', 'add-location')}
        ${eqsv ? '<div class="ug-actions loc-done"><button class="ug-btn dark" data-action="close-location">Done</button></div>' : ''}
      </div>
    </div>
  </div>`;
}
// Kinds a saved machine counts as (from its details page)
export function EquipmentTypesSheet() {
  const sv = db.equipment.find(x => x.id === state.eqDetail); if (!sv) return '';
  const cur = eqTypes(sv);
  return `
  <div class="scrim" data-action="close-eqtypes">
    <div class="sheet pk-sheet" data-stop style="--pk-sel:${state.create ? state.create.color : '#111'}">
      <div class="sheet-grab"></div>
      <div class="pk-body loc-body">
        <div class="pk-titleblock"><div class="vs-title">What kind of equipment is it?</div><div class="vs-sub">Pick every kind it can be.</div></div>
        <div class="pk-list">${TYPE_ORDER.map(t => pickCell({ action: 'toggle-eqtype', data: { name: t }, on: cur.includes(t), multi: true, kind: true, icon: PH_EQUIP(t), title: t })).join('')}</div>
        <div class="ug-actions loc-done"><button class="ug-btn dark" data-action="close-eqtypes">Done</button></div>
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
      <div class="wiz-help">Gym, garage, wherever.</div>
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
    <div class="mg-search${state.merge.q ? ' has-text' : ''}">${I.search}<input data-mergesearch placeholder="Search exercises" value="${esc(state.merge.q || '')}" autocomplete="off"><button class="search-x" data-action="search-clear" aria-label="Clear search"><svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="10" fill="#b4b2bd"/><path d="M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>
    <div id="merge-list">${mergeExList()}</div>
  </div>`;
}
export function MergeEquipmentScreen() {
  const src = db.equipment.find(x => x.id === state.eqDetail);
  const rows = db.equipment.filter(sv => sv !== src).map(sv => `
      <button class="xd-eqrow eq-row" data-action="merge-pick-eq" data-id="${sv.id}">
        ${eqImg(sv)}
        <span class="xd-eqtext"><span class="xd-eqname">${esc(sv.name)}</span><span class="xd-eqsub">At ${esc(eqLocText(sv))}</span></span>
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
      ${row('intro-replay', I.history, 'Replay the Intro', 'The one-minute tour of how FailUp works')}
      ${row('export-data', I.share, 'Back Up My Data', 'Save a backup file')}
      <label class="xd-act st-act"><span class="xd-acticon">${I.history}</span><span><span class="st-label">Restore From Backup</span><span class="st-sub">Replaces what’s on this device</span></span>${I.smChevR}<input type="file" accept=".json,application/json" data-import hidden></label>
      ${row('clear-data', I.trash24, 'Clear My Exercise Data', 'Deletes logged workouts and goals', true)}
      ${row('reset-app', I.trash24, 'Reset FailUp', 'Back to the 3 starter workouts', true)}
    </div>
    <div class="st-credits">Skull, beast and battle icons by Lorc and Delapouite at game-icons.net, CC BY 3.0. Flame animation by Tom Fabre</div>
  </div>`;
}
