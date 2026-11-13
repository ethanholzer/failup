// First-launch intro: energize, skip what people already know, teach the loop, set units + gym, then lift.
import { state } from './data.js';
import { db } from './store.js';
import { esc } from './ui.js';

const TERMS = [
  { key: 'po', title: 'Progressive overload', sub: 'Doing a little more over time' },
  { key: 'fail', title: 'Training to failure', sub: 'The rep you can’t finish' },
  { key: 'vol', title: 'Volume', sub: 'Sets × reps' },
];
export function obSteps(ob) {
  const teach = TERMS.filter(t => !ob.known.includes(t.key)).map(t => 'teach-' + t.key);
  return ['welcome', 'familiar', ...teach, 'loop', 'nosub', 'ready'];
}

const CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const BOOK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>';
// "the research says" card: the finding, then where it comes from
const evidence = (finding, cite, url) => `
      <a class="ob-stat ob-float" style="--fd:.8s" href="${url}" target="_blank" rel="noopener">
        <span class="ob-evlabel">${BOOK} What the research says</span>
        <span class="ob-evtext">${finding}</span>
        <span class="ob-evcite">${cite} <span aria-hidden="true">↗</span></span>
      </a>`;
// a pared-down overload graph: the climb draws itself, dots land as it reaches them, goals step up behind it
function poGraph() {
  const W = 300, H = 150, pts = [100, 100, 105, 105, 110, 115, 115, 120];
  const x = i => 14 + i * ((W - 28) / (pts.length - 1)), y = v => H - 14 - (v - 100) * ((H - 40) / 20);
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const goals = [[0, 2, 105], [2, 4, 110], [4, 6, 115]], cur = 120;
  return `
      <svg class="ob-graph" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        ${[0, 1, 2].map(k => `<line x1="0" x2="${W}" y1="${(30 + k * 45).toFixed(0)}" y2="${(30 + k * 45).toFixed(0)}" class="ob-ggrid"/>`).join('')}
        ${goals.map(([a, b, v], k) => `<line class="ob-gpast" x1="${x(a).toFixed(1)}" x2="${x(b).toFixed(1)}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" style="--d:${(0.6 + k * 0.7).toFixed(2)}s"/>`).join('')}
        <line class="ob-gcur" x1="${x(6).toFixed(1)}" x2="${W}" y1="${y(cur).toFixed(1)}" y2="${y(cur).toFixed(1)}"/>
        <path class="ob-gline" d="${line}" pathLength="100"/>
        ${pts.map((v, i) => `<circle class="ob-gdot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5" style="--d:${(0.45 + i * (2.6 / (pts.length - 1))).toFixed(2)}s"/>`).join('')}
        <text class="ob-glbl" x="${W - 4}" y="${(y(cur) - 8).toFixed(1)}" text-anchor="end">Goal</text>
      </svg>`;
}
// the set tracker, logging 3 × 8 with the last set ending in failure, then a new goal
function trackerDemo() {
  const rows = [['1', '135 lbs × 8 reps', 'RPE 8'], ['2', '135 lbs × 8 reps', 'RPE 9'], ['F', '135 lbs × 6 reps', 'F']];
  return `
      <div class="ob-trk ob-float" data-action="ob-replay" role="button" aria-label="Replay">
        <div class="ob-trkhead"><span>Bench Press</span><span class="ob-trkvol">3 Sets × 8 Reps</span></div>
        ${rows.map(([n, t, tag], i) => `
        <div class="ob-trkrow${n === 'F' ? ' f' : ''}" style="--d:${(0.5 + i * 0.6).toFixed(1)}s"><span class="ob-trkn">${n}</span><span class="ob-trkt">${t}</span><span class="ob-trktag">${tag}</span></div>`).join('')}
        <div class="ob-trkgoal"><svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" pathLength="100"/><path d="M8.5 14.5l3.5 3.5 7.5-8" pathLength="100"/></svg><span>New goal set</span><b>135 lbs × 8</b></div>
      </div>`;
}

function body(step, ob) {
  switch (step) {
    case 'welcome': return `
      <div class="ob-flame" data-ob-flame></div>
      <div class="ob-mid ob-welcome ob-txt">
        <div class="ob-logo">Fail<span>Up</span></div>
        <h1 class="ob-h1"><span class="ob-fbox">Failure</span> is<br>the goal</h1>
        <p class="ob-p">FailUp turns your hardest set into your next goal, here’s how it works in about a minute</p>
      </div>
      <div class="ob-foot">
        <button class="ob-btn" data-action="ob-next">Continue ${ARROW}</button>
      </div>`;
    case 'familiar': return `
      <div class="ob-top ob-txt"><h2 class="ob-h2">What’s already familiar?</h2><p class="ob-p">Tap what you know, we’ll skip it</p></div>
      <div class="ob-cards">
        ${TERMS.map((t, i) => { const on = ob.known.includes(t.key); return `
        <button class="ob-card${on ? ' on' : ''}" data-action="ob-known" data-k="${t.key}" role="checkbox" aria-checked="${on}" style="--d:${i * 70}ms">
          <span class="ob-cardtext"><span class="ob-cardtitle">${t.title}</span><span class="ob-cardsub">${t.sub}</span></span>
          <span class="ob-tick">${on ? CHECK : ''}</span>
        </button>`; }).join('')}
      </div>
      <div class="ob-foot">
        <button class="ob-btn" data-action="ob-next" data-ob-continue>Continue ${ARROW}</button>
      </div>`;
    case 'teach-po': return `
      <div class="ob-visual ob-graphwrap ob-float" aria-hidden="true">${poGraph()}</div>
      <div class="ob-top ob-txt"><div class="ob-kicker">Progressive overload</div><h2 class="ob-h2">Ask a little more every time</h2>
        <p class="ob-p">Your muscles adapt to what you ask of them, so keep adding a bit more weight or a few more reps, and they keep growing</p></div>
      ${evidence('In an 8-week study of 38 trained lifters, adding weight and adding reps both built muscle, what mattered was making it harder', 'Plotkin et al., PeerJ, 2022', 'https://peerj.com/articles/14142')}
      <div class="ob-foot"><button class="ob-btn" data-action="ob-next">Continue ${ARROW}</button></div>`;
    case 'teach-fail': return `
      <div class="ob-visual ob-sets ob-small" aria-hidden="true">
        ${[['1', '8 reps'], ['2', '8 reps'], ['F', '6 reps']].map(([n, r], i) => `<div class="ob-set${n === 'F' ? ' f' : ''}" style="--d:${i * 380}ms"><span class="ob-setn">${n}</span><span>135 lbs × ${r}</span>${n === 'F' ? '<span class="ob-ftag">Failure</span>' : `<span class="ob-ok">${CHECK}</span>`}</div>`).join('')}
      </div>
      <div class="ob-top ob-txt"><div class="ob-kicker">Training to failure</div><h2 class="ob-h2">The rep you can’t finish</h2>
        <p class="ob-p">Failure is the rep you try and can’t complete with good form, it’s proof the set was hard enough to count</p></div>
      ${evidence('Across 55 studies, sets taken closer to failure built more muscle', 'Robinson et al., Sports Medicine, 2024', 'https://doi.org/10.1007/s40279-024-02069-2')}
      <div class="ob-foot"><button class="ob-btn" data-action="ob-next">Continue ${ARROW}</button></div>`;
    case 'teach-vol': return `
      <div class="ob-visual ob-dots ob-small ob-float" aria-hidden="true">
        ${[0, 1, 2].map(r => `<div class="ob-dotrow"><span class="ob-dotlbl">Set ${r + 1}</span>${Array.from({ length: 8 }, (_, c) => `<i style="--d:${r * 420 + c * 45}ms"></i>`).join('')}</div>`).join('')}
        <div class="ob-volsum">3 sets × 8 reps</div>
      </div>
      <div class="ob-top ob-txt"><div class="ob-kicker">Volume</div><h2 class="ob-h2">How many times you do the exercise</h2>
        <p class="ob-p">Volume is your sets × reps, FailUp keeps it steady and raises the weight once you’ve earned it</p></div>
      <div class="ob-foot"><button class="ob-btn" data-action="ob-next">Continue ${ARROW}</button></div>`;
    case 'loop': return `
      ${trackerDemo()}
      <div class="ob-top ob-txt"><div class="ob-kicker">How FailUp works</div><h2 class="ob-h2">Fail until you don’t, then up the weight</h2></div>
      <div class="ob-big ob-glitch" data-text="That’s failing upward">That’s failing upward</div>
      <p class="ob-p ob-after">It’s also progressive overload</p>
      <div class="ob-foot ob-late"><button class="ob-btn" data-action="ob-next">Continue ${ARROW}</button></div>`;
    case 'nosub': return `
      <div class="ob-visual ob-nosub ob-float" aria-hidden="true">
        <div class="ob-receipt">
          <div class="ob-rrow"><span>Monthly fee</span><b>$0</b></div>
          <div class="ob-rrow"><span>Yearly fee</span><b>$0</b></div>
          <div class="ob-rrow"><span>Features behind a paywall</span><b>0</b></div>
          <div class="ob-rtotal"><span>Subscriptions, ever</span><b>None</b></div>
        </div>
      </div>
      <div class="ob-top ob-txt"><div class="ob-kicker">Users over profit</div><h2 class="ob-h2">Buy once, no subscription</h2>
        <p class="ob-p">FailUp will never ask you for a monthly fee, every feature is yours</p>
        <p class="ob-p ob-p2">FailUp doesn’t have a marketing budget, so if you enjoy it, please spread the word</p></div>
      <div class="ob-foot">
        <button class="ob-btn" data-action="ob-next">Continue ${ARROW}</button>
        <button class="ob-btn2" data-action="ob-share">Share FailUp with a friend</button>
      </div>`;
    case 'ready': return `
      <div class="ob-flame big" data-ob-flame></div>
      <div class="ob-mid ob-txt">
        <h1 class="ob-h1">You’re ready<br>to <span class="ob-fbox">Fail</span></h1>
        <p class="ob-p">Your first goal is one hard set away</p>
      </div>
      <div class="ob-foot">
        <button class="ob-btn" data-action="ob-starter">Start failing ${ARROW}</button>
      </div>`;
  }
  return '';
}

export function OnboardScreen() {
  const ob = state.ob, steps = obSteps(ob), i = Math.max(0, steps.indexOf(ob.step)), step = steps[i];
  const pct = ((i + 1) / steps.length) * 100;
  const showSkip = !['nosub', 'ready'].includes(step);
  return `
  <div class="ob-screen ob-s-${step}${ob.dir ? ' dir-' + ob.dir : ''}" data-ob-step="${step}">
    <div class="ob-glow"></div>
    <div class="ob-bar-top">
      ${ob.replay && (i === 0 || step === 'ready') ? `<button class="ob-back" data-action="ob-close" aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : i > 0 && step !== 'ready' ? `<button class="ob-back" data-action="ob-back" aria-label="Back"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>` : '<span class="ob-back ph"></span>'}
      <div class="ob-progress"><span style="width:${pct.toFixed(1)}%"></span></div>
      ${showSkip ? '<button class="ob-skip" data-action="ob-skip">Skip</button>' : '<span class="ob-skip ph"></span>'}
    </div>
    <div class="ob-body">${body(step, ob)}</div>
  </div>`;
}
