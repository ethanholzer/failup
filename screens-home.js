// ============================================================================
// FailUp: home (modular sections), How FailUp Works, and the list of overload goals.
// ============================================================================
import { state, LINKS } from './data.js';
import { I, statusBar, fmt, esc, wtTight, D } from './ui.js';
import { db, exById, eqLabel, eqUnits, derived, planToday, parseDay, volumeDots, goalSegments } from './store.js';
import { overloadChart, rangeBounds } from './screens-library.js';
import { resumeCard, todayCard, doneToday, planStats } from './screens-workout.js';

const ICON = {
  contacts: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><circle cx="12" cy="10" r="2.6"/><path d="M8 16.5c.8-1.8 2.2-2.6 4-2.6s3.2.8 4 2.6"/><path d="M2.5 7h2M2.5 12h2M2.5 17h2"/></svg>',
  arrow: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  heart: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 4.2 2.4h2c.6-1.3 2.1-2.4 4.2-2.4 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>',
  down: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  share: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/></svg>',
};

/* ---- overload goals, most recently changed first ---- */
export function goalItems() {
  const dv = derived(), out = [];
  for (const [key, weight] of Object.entries(dv.goals)) {
    if (weight == null) continue;
    const [exId, ref, vol] = key.split('|');
    const ex = exById(exId); if (!ex) continue;
    const [sets, reps] = vol.split('x').map(Number);
    const pts = [...(dv.starts[key] ? [dv.starts[key]] : []), ...(dv.ach[key] || [])];
    const times = [...pts.map(p => p.at), ...db.goalEdits.filter(g => g.key === key).map(g => g.at)].map(t => new Date(t).getTime());
    out.push({ key, ex, exId, ref, sets, reps, weight, pts, updated: Math.max(0, ...times) });
  }
  return out.sort((a, b) => b.updated - a.updated);
}

// a small line of the goal's history: ring = where it started, dots = goals reached
function spark(pts) {
  const W = 236, H = 76, P = 8;
  if (!pts.length) return '';
  const ws = pts.map(p => p.weight), lo = Math.min(...ws), hi = Math.max(...ws), span = hi - lo || 1;
  const xy = pts.map((p, i) => [pts.length === 1 ? W / 2 : P + (W - 2 * P) * i / (pts.length - 1), hi === lo ? H / 2 : H - P - (H - 2 * P) * (p.weight - lo) / span]);
  const line = xy.length > 1 ? `<polyline points="${xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="#6C5CE7" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : '';
  const dots = xy.map(([x, y], i) => pts[i].start
    ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#fff" stroke="#6C5CE7" stroke-width="2.5"/>`
    : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#6C5CE7" stroke="#fff" stroke-width="2"/>`).join('');
  return `<svg class="hg-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="${H - 1}" x2="${W}" y2="${H - 1}" stroke="#ecebf3" stroke-width="2"/>${line}${dots}</svg>`;
}

// the same graph the tracker opens with (All), shrunk: dots, the climb, past goals faint, current goal solid
function goalMini(g) {
  const dots = volumeDots(g.exId, g.ref, g.sets, g.reps), goals = goalSegments(g.exId, g.ref, g.sets, g.reps);
  const firsts = [...dots.map(d => new Date(d.at).getTime()), ...goals.map(x => new Date(x.from).getTime())];
  const b = rangeBounds('All', Date.now(), firsts.length ? Math.min(...firsts) : null);
  return overloadChart({ dots, goals, ...b }, eqUnits(g.ref), true);
}
function goalCard(g) {
  const u = eqUnits(g.ref), done = volumeDots(g.exId, g.ref, g.sets, g.reps).length;
  return `
    <button class="hg-card" data-action="home-tracker" data-key="${esc(g.key)}">
      <span class="hg-top">
        <span class="hg-name">${esc(g.ex.name)}</span>
        <span class="hg-sub">${esc(eqLabel(g.ref))} · ${g.sets} × ${g.reps}</span>
      </span>
      ${goalMini(g)}
      <span class="hg-foot">
        <span class="hg-w tnum">${wtTight(g.weight, u)}</span>
        <span class="hg-meta">${done ? `${done} completed` : 'Goal set'} · ${D.short(new Date(g.updated))}</span>
      </span>
    </button>`;
}

/* ---- plan stats + progress ---- */
function planProgress(plan, pt) {
  const st = planStats(plan);
  const done = pt.status === 'ended' ? pt.total : pt.status === 'upcoming' ? 0 : pt.dayNum - 1;   // full days behind you
  const pct = Math.round((done / pt.total) * 100);
  const label = pt.status === 'upcoming' ? 'Not started' : pt.status === 'ended' ? 'Plan complete' : `Day ${pt.dayNum} of ${pt.total}`;
  return `
        <div class="hm2-stats">
          <div class="hm2-stat"><div class="hm2-statnum tnum">${st.failures}</div><div class="hm2-statlbl">Failures earned</div></div>
          <div class="hm2-stat"><div class="hm2-statnum tnum">${st.goals}</div><div class="hm2-statlbl">Goals reached</div></div>
        </div>
        <div class="hm2-prog">
          <div class="hm2-progtop"><span>${label}</span><span class="tnum">${pct}%</span></div>
          <div class="hm2-progbar"><span style="width:${pct}%"></span></div>
        </div>`;
}
/* ---- a plan that hasn't started yet: count down to day 1 ---- */
export function countdownParts(startKey, now = Date.now()) {
  const ms = Math.max(0, parseDay(startKey).getTime() - now);
  return { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60 };
}
function planCountdown(plan) {
  const c = countdownParts(plan.start), first = plan.days[0];
  const w = first && first.type === 'workout' ? db.workouts.find(x => x.id === first.workoutId) : null;
  const box = (k, n, l) => `<div class="hm2-cd"><div class="hm2-cdnum tnum" data-cd="${k}">${n}</div><div class="hm2-statlbl">${l}</div></div>`;
  return `
        <div class="hm2-today">Starts ${D.dow(parseDay(plan.start))}</div>
        <div class="hm2-cdrow" data-countdown="${plan.start}">
          ${box('d', c.d, c.d === 1 ? 'Day' : 'Days')}${box('h', c.h, c.h === 1 ? 'Hour' : 'Hours')}${box('m', c.m, c.m === 1 ? 'Minute' : 'Minutes')}
        </div>
        ${w ? `<div class="hm2-firstup">First up: <b>${esc(w.name)}</b></div>` : first ? `<div class="hm2-firstup">Day 1 is a rest day</div>` : ''}`;
}
/* ---- primary card: paused workout > active plan > get started ---- */
function primary() {
  if (state.session) {
    // a paused quick workout keeps your plan on screen underneath (not when the paused one is today's plan workout)
    const pt = db.plan ? planToday() : null, day = pt && pt.status === 'active' ? pt.day : null;
    const isPlanToday = day && day.type === 'workout' && day.workoutId === state.session.workoutId;
    return `
      <div class="hm2-label light">You left off here</div>
      ${resumeCard()}
      ${db.plan && !isPlanToday ? planPart(true) : ''}`;
  }
  return planPart(false);
}
function planPart(underPaused) {
  const plan = db.plan;
  const quick = `<button class="hm2-quick" data-action="home-go" data-to="quickselect">${I.quickstart}<span>Quickstart</span></button>`;
  // a workout on deck that you haven't done yet: its yellow Start is the main button, so no Quickstart
  const pt = plan ? planToday() : null, day = pt && pt.status === 'active' ? pt.day : null;
  const todayW = day && day.type === 'workout' ? db.workouts.find(x => x.id === day.workoutId) : null;
  const startToday = !!(todayW && !doneToday(todayW.id));
  if (plan) return `
      <div class="hm2-card hm2-plan">
        <div class="hm2-planhead">
          <div>
            <div class="hm2-planname">${esc(plan.name)}</div>
            <div class="hm2-planmeta">${plan.splitDays} day split</div>
          </div>
          <button class="hm2-kebab" data-action="plan-menu" aria-label="Plan options">${I.kebab}</button>
        </div>
        ${pt.status === 'upcoming' ? planCountdown(plan) : `
        ${planProgress(plan, pt)}
        <div class="hm2-today">Today · ${D.dow(new Date())}</div>
        ${todayCard(pt, plan)}`}
      </div>
      ${startToday || underPaused ? '' : quick}`;
  return `
      <div class="hm2-card hm2-start">
        <div class="hm2-starttitle">Push yourself today.</div>
        <div class="hm2-startbtns">
          <button class="hm2-btn dark" data-action="home-go" data-to="planwiz">${I.addCircle}<span>Create a Workout Plan</span></button>
          ${quick}
        </div>
      </div>`;
}

export function HomeScreen() {
  const goals = goalItems().slice(0, 8);
  const navBtn = (to, icon, label) => `<button class="hm2-navbtn" data-action="home-go" data-to="${to}">${icon}<span>${label}</span></button>`;
  // the header copies of the library buttons stay hidden (and out of the tab order) until those buttons scroll away
  const iBtn = (to, icon, label, cls = '') => `<button class="hm2-ibtn ${cls}" data-action="${cls ? 'home-go-mini' : 'home-go'}" data-to="${to}" aria-label="${label}"${cls ? ' tabindex="-1" aria-hidden="true"' : ''}>${icon}</button>`;
  return `
  <div class="hm2">
    <header class="hm2-head">
      ${statusBar(true)}
      <div class="hm2-bar">
        <div class="hm2-logo">FailUp</div>
        <div class="hm2-icons">
          ${iBtn('workouts', I.book, 'Workouts', 'mini')}${iBtn('exercises', I.barbell, 'Exercises', 'mini')}${iBtn('equipment', I.equipment, 'Equipment', 'mini')}
          ${iBtn('settings', I.gear, 'Settings')}
        </div>
      </div>
    </header>

    <section class="hm2-primary">
      ${primary()}
    </section>

    <section class="hm2-nav" aria-label="Library">
      ${navBtn('workouts', I.book, 'Workouts')}${navBtn('exercises', I.barbell, 'Exercises')}${navBtn('equipment', I.equipment, 'Equipment')}
    </section>

    <section class="hm2-sec">
      <div class="hm2-sechead"><h2>How FailUp Works</h2></div>
      <div class="hm2-rail hm2-howrail">
        <button class="hm2-how" data-action="home-go" data-to="howto" aria-label="How FailUp Works. Learn about our super simple training strategy.">
          <img class="hm2-howimg" src="./assets/hero.jpg" alt="">
          <span class="hm2-howart">${heroLines()}</span>
          <span class="hm2-howtext"><span class="hm2-howsub">Learn about our super simple training strategy.</span></span>
          <span class="hm2-howarrow">${ICON.arrow}</span>
        </button>
        <div class="hm2-maker">
          <img class="hm2-makerphoto" src="./assets/maker.jpg" alt="Ethan and his golden retriever">
          <div class="hm2-makertitle">Hey, I made this.</div>
          <div class="hm2-makertext">Built by one guy, for his own training. Free forever, because subscriptions suck.</div>
          <a class="hm2-makerbtn" href="${LINKS.maker}" target="_blank" rel="noopener">Why I made it &amp; how to help</a>
        </div>
      </div>
    </section>

    <section class="hm2-sec">
      <div class="hm2-sechead"><h2>Progressive Overload Goals</h2>${goals.length ? '<button class="hm2-seeall" data-action="home-go" data-to="goals">See All</button>' : ''}</div>
      ${goals.length ? `<div class="hm2-rail hm2-goalrail">${goals.map(goalCard).join('')}</div>` : `
      <div class="hm2-card hm2-nogoals">
        <div class="hm2-nogoalstitle">Your goals will live here</div>
        <div class="hm2-nogoalstext">Finish an exercise and FailUp suggests one. Then watch them climb.</div>
      </div>`}
    </section>

    <section class="hm2-sec hm2-last">
      <div class="hm2-card hm2-share">
        <div class="hm2-sharetop">
          <div><div class="hm2-sharetitle">Tell your friends, please!</div><div class="hm2-sharetext">It helps a ton. Send it to your gym buddy.</div></div>
          <span class="hm2-shareic">${ICON.contacts}</span>
        </div>
        <button class="hm2-btn dark" data-action="share-app">${ICON.share}<span>Share FailUp with Friends</span></button>
      </div>
    </section>
  </div>`;
}

/* ---- How FailUp Works ---- */
// "Hit failure. Set a goal. Beat it. Repeat." with the yellow pointer stepping down the lines
export const heroLines = () => `<div class="hw-big" aria-label="Hit failure. Set a goal. Beat it. Repeat."><i class="hw-pointer" aria-hidden="true"></i><span class="hw-line l1">Hit failure.</span><span class="hw-line l2">Set a goal.</span><span class="hw-line l3">Beat it.</span><span class="hw-line l4 yel">Repeat.</span></div>`;
// the same colors as the set logger's effort slider
export const FEEL_SEGS = ['#c8c4e7', '#beb9e7', '#b4ade7', '#aaa2e7', '#9f96e7', '#958be7', '#8b7fe7', '#8174e7', '#7768e7', '#6c5ce7'];
export const RPE_NOTES = [
  'Barely a warmup.',
  'Easy. Just moving.',
  'Easy. Lots left in the tank.',
  'Comfortable. Could keep going a while.',
  'Starting to work. Plenty left.',
  'Real effort. About 4 more reps in you.',
  'Hard. 3 more reps, tops.',
  'Really hard. Maybe 2 more.',
  'You finished that last rep, but the next one would fail.',
  'Failure. You couldn’t finish the rep. This is the one you want.',
];
export const rpeLabel = v => (v >= 10 ? 'F' : `RPE ${v}`);
function rpeDemo(v = 9) {
  const c = FEEL_SEGS[v - 1], pct = ((v - 0.5) / 10) * 100;
  return `
        <div class="hv-rpe-demo" style="--c:${c}; --p:${pct}%">
          <div class="hv-rpe-box${v <= 4 ? ' dark' : ''}"><b data-rpe-label>${rpeLabel(v)}</b><span data-rpe-note>${RPE_NOTES[v - 1]}</span></div>
          <div class="hv-rpe-bar">
            ${FEEL_SEGS.slice(0, 9).map((x, i) => `<span style="background:${x}">${i + 1}</span>`).join('')}<span style="background:#7768e7"></span>
            <b class="hv-rpe-end">F</b>
            <input type="range" min="1" max="10" step="1" value="${v}" data-rpedemo aria-label="Effort rating">
            <i class="hv-rpe-thumb"></i>
          </div>
        </div>`;
}
export function HowItWorksScreen() {
  const sec = (n, title, lead, body, pull) => `
      <section class="hw-sec">
        <div class="hw-num">${n}</div>
        <h2 class="hw-h">${title}</h2>
        <p class="hw-lead">${lead}</p>
        ${body.map(p => `<p class="hw-p">${p}</p>`).join('')}
        ${pull ? `<div class="hw-pull">${pull}</div>` : ''}
      </section>`;
  return `
  <div class="hw-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back" aria-label="Back">${I.chevL}</button><span class="nav-title">How FailUp Works</span></div>
    <div class="hw-hero">
      ${heroLines()}
      <div class="hw-herosub">Two minutes. Here’s why it works.</div>
    </div>
    ${sec(1, 'Progressive overload',
      '<b>Do a little more than last time.</b>',
      ['A bit more weight, or one more rep. Stack that up for a few months and you’ll be shocked.'])}
    ${sec(2, 'Why it works',
      '<b>Your body only changes when it has to.</b>',
      ['Give your muscles more than they’re used to and they build back stronger. Same weight every week? They get comfy. Comfy doesn’t grow.'])}
    ${sec(3, 'Why go to failure',
      '<b>Failure tells you the truth.</b>',
      ['Failure is the rep you can’t finish with good form. Those last grinding reps build the most muscle, and hitting failure means you know your real limit. Most people stop early and guess.'])}
    ${sec(4, 'How FailUp helps',
      '<b>You lift. FailUp does the math.</b>',
      [])}
    <div class="hw-steps">
      <div class="hw-step">
        <div class="hw-steptitle">Rate every set</div>
        <div class="hw-steptext">Measure your effort to keep yourself honest.</div>
        ${rpeDemo()}
      </div>
      <div class="hw-step">
        <div class="hw-steptitle"><span class="hw-purple">Failure</span> is the goal</div>
        <div class="hw-steptext">Chase failure while maintaining good form. If you can do every set without failing, time to increase the weight!</div>
        <div class="hw-vis">
          <div class="hv-sets">
            ${[['1', '100 lbs × 8', 'RPE 8', ''], ['2', '100 lbs × 8', 'RPE 9', ''], ['3', '100 lbs × 6', 'F', 'f']].map(([n, t, r, f]) => `<div class="hv-set"><span class="hv-badge">${n}</span><span class="hv-settext tnum">${t}</span><span class="hv-rpe ${f}">${r}</span></div>`).join('')}
          </div>
          <div class="hv-arrowdown">${ICON.down}</div>
          <div class="hv-goal"><span>New goal</span><b class="tnum">3 × 8 at 100 lbs</b></div>
        </div>
      </div>
      <div class="hw-step">
        <div class="hw-steptitle">Aim for Purple</div>
        <div class="hw-steptext">Sets turn purple if you complete a set at your goal weight, or fail trying. It means you’re on the right path.</div>
        <div class="hw-vis">
          <div class="hv-sets">
            ${[['1', false], ['2', true], ['3', true]].map(([n, on]) => `<div class="hv-set"><span class="hv-badge${on ? ' on' : ''}">${n}</span><span class="hv-settext tnum">${on ? '100 lbs × 8' : '95 lbs × 8'}</span>${on ? '<span class="hv-hit">Goal hit</span>' : ''}</div>`).join('')}
          </div>
        </div>
      </div>
      <div class="hw-step">
        <div class="hw-steptitle">Save your machines</div>
        <div class="hw-steptext">No two cable stacks feel the same. Each saved machine gets its own goals.</div>
        <div class="hw-vis hv-machines">
          ${[['Cable Machine 1', 'Home', '90 lbs'], ['Cable Machine 2', 'Downtown gym', '75 lbs']].map(([n, l, w]) => `<div class="hv-mach"><span class="hv-machic">${I.equipment}</span><span class="hv-machtext"><b>${n}</b><span>${l}</span></span><span class="hv-machw tnum">${w}</span></div>`).join('')}
        </div>
      </div>
      <div class="hw-step">
        <div class="hw-steptitle">Watch it climb</div>
        <div class="hw-steptext">The Overload Tracker plots every goal you hit. Best part of the app.</div>
        <div class="hw-vis">${spark([{ weight: 100, start: true }, { weight: 105 }, { weight: 110 }, { weight: 110 }, { weight: 115 }, { weight: 125 }])}</div>
      </div>
    </div>
    <div class="hw-end">
      <button class="hm2-btn dark" data-action="home-go" data-to="quickselect">${I.quickstart}<span>Alright, let’s lift</span></button>
    </div>
  </div>`;
}

/* ---- See All: every overload goal, searchable ---- */
export function GoalsScreen() {
  const items = goalItems();
  return `
  <div class="gl-screen">
    ${statusBar()}
    <div class="nav"><button class="icon-btn" data-action="back" aria-label="Back">${I.chevL}</button><span class="nav-title">Overload Goals</span></div>
    <div class="gl-search">${I.search}<input data-goalsearch placeholder="Search exercises or equipment" aria-label="Search goals"><button class="search-x" data-action="search-clear" aria-label="Clear search"><svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="10" fill="#b4b2bd"/><path d="M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>
    <div class="gl-list" id="gl-list">
      ${items.map(g => `
      <button class="gl-row" data-action="home-tracker" data-key="${esc(g.key)}" data-q="${esc(`${g.ex.name} ${g.ex.muscle} ${eqLabel(g.ref)}`.toLowerCase())}">
        <span class="gl-text"><span class="gl-name">${esc(g.ex.name)}</span><span class="gl-sub"><span class="mtag gl-tag">${esc(g.ex.muscle)}</span>${esc(eqLabel(g.ref))} · ${g.sets} × ${g.reps}</span></span>
        <span class="gl-w tnum">${wtTight(g.weight, eqUnits(g.ref))}</span>
        <span class="xd-chev">${I.smChevR}</span>
      </button>`).join('') || '<div class="mg-empty">No goals yet. Finish a workout and they’ll start showing up.</div>'}
      <div class="gl-none" hidden>Nothing matches that.</div>
    </div>
  </div>`;
}

// After a workout (Back to Home on Workout Complete): ask to share FailUp
export function ShareAskSheet() {
  return `
  <div class="scrim" data-action="shareask-close">
    <div class="sheet ug-sheet" data-stop>
      <div class="sheet-grab"></div>
      <div class="ug-body sa-body">
        <span class="hm2-shareic sa-ic">${ICON.contacts}</span>
        <div class="ug-titleblock"><div class="ug-title">Share FailUp with a friend</div><div class="ug-text">FailUp doesn’t have a marketing budget. Please help spread the word!</div></div>
        <div class="ug-actions"><button class="ug-btn" data-action="shareask-close">Close</button><button class="ug-btn dark" data-action="shareask-share">${ICON.share}<span>Share</span></button></div>
      </div>
    </div>
  </div>`;
}
