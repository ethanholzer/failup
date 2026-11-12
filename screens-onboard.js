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
const src = (label, url) => `<a class="ob-src" href="${url}" target="_blank" rel="noopener">${label}</a>`;

function body(step, ob) {
  switch (step) {
    case 'welcome': return `
      <div class="ob-flame" data-ob-flame></div>
      <div class="ob-mid ob-welcome ob-txt">
        <div class="ob-logo">Fail<span>Up</span></div>
        <h1 class="ob-h1">Failure is<br>the goal.</h1>
        <p class="ob-p">FailUp turns your hardest set into your next goal. Here’s how it works, in about a minute.</p>
      </div>
      <div class="ob-foot">
        <button class="ob-btn" data-action="ob-next">Let’s go ${ARROW}</button>
        <button class="ob-btn2" data-action="ob-skip">I know the drill</button>
      </div>`;
    case 'familiar': return `
      <div class="ob-top ob-txt"><h2 class="ob-h2">What’s already familiar?</h2><p class="ob-p">Tap what you know. We’ll skip it.</p></div>
      <div class="ob-cards">
        ${TERMS.map((t, i) => { const on = ob.known.includes(t.key); return `
        <button class="ob-card${on ? ' on' : ''}" data-action="ob-known" data-k="${t.key}" role="checkbox" aria-checked="${on}" style="--d:${i * 70}ms">
          <span class="ob-cardtext"><span class="ob-cardtitle">${t.title}</span><span class="ob-cardsub">${t.sub}</span></span>
          <span class="ob-tick">${on ? CHECK : ''}</span>
        </button>`; }).join('')}
      </div>
      <div class="ob-foot">
        <button class="ob-btn" data-action="ob-next">${ob.known.length === 3 ? 'I know all three' : 'Continue'} ${ARROW}</button>
        <button class="ob-btn2" data-action="ob-new">I’m new to all of this</button>
      </div>`;
    case 'teach-po': return `
      <div class="ob-visual ob-bars ob-float" aria-hidden="true">
        ${[135, 140, 145, 150].map((w, i) => `<div class="ob-bar" style="--h:${38 + i * 18}%;--d:${i * 140}ms"><span>${w}</span></div>`).join('')}
      </div>
      <div class="ob-top ob-txt"><div class="ob-kicker">Progressive overload</div><h2 class="ob-h2">Ask a little more every time.</h2>
        <p class="ob-p">Your muscles adapt to what you ask of them. Keep adding a bit more weight or a few more reps, and they keep growing.</p></div>
      <div class="ob-stat ob-float" style="--fd:.7s"><b>38 lifters, 8 weeks.</b> Adding weight and adding reps both built muscle. The key was making it harder. ${src('Plotkin et al., PeerJ 2022', 'https://peerj.com/articles/14142')}</div>
      <div class="ob-foot"><button class="ob-btn" data-action="ob-next">Got it ${ARROW}</button></div>`;
    case 'teach-fail': return `
      <div class="ob-visual ob-sets" aria-hidden="true">
        ${[['1', '8 reps'], ['2', '8 reps'], ['F', '6 reps']].map(([n, r], i) => `<div class="ob-set${n === 'F' ? ' f' : ''}" style="--d:${i * 380}ms"><span class="ob-setn">${n}</span><span>135 lbs × ${r}</span>${n === 'F' ? '<span class="ob-ftag">Failure</span>' : `<span class="ob-ok">${CHECK}</span>`}</div>`).join('')}
      </div>
      <div class="ob-top ob-txt"><div class="ob-kicker">Training to failure</div><h2 class="ob-h2">The rep you can’t finish.</h2>
        <p class="ob-p">Failure is the rep you try and can’t complete with good form. It’s proof the set was hard enough to count.</p></div>
      <div class="ob-stat ob-float" style="--fd:.7s"><b>55 studies.</b> Sets taken closer to failure built more muscle. ${src('Robinson et al., Sports Medicine 2024', 'https://doi.org/10.1007/s40279-024-02069-2')}</div>
      <div class="ob-foot"><button class="ob-btn" data-action="ob-next">Got it ${ARROW}</button></div>`;
    case 'teach-vol': return `
      <div class="ob-visual ob-dots ob-float" aria-hidden="true">
        ${[0, 1, 2].map(r => `<div class="ob-dotrow"><span class="ob-dotlbl">Set ${r + 1}</span>${Array.from({ length: 8 }, (_, c) => `<i style="--d:${r * 420 + c * 45}ms"></i>`).join('')}</div>`).join('')}
        <div class="ob-volsum">3 sets × 8 reps</div>
      </div>
      <div class="ob-top ob-txt"><div class="ob-kicker">Volume</div><h2 class="ob-h2">How much work you do.</h2>
        <p class="ob-p">Volume is your sets × reps. FailUp keeps your volume steady and raises the weight once you’ve earned it.</p></div>
      <div class="ob-foot"><button class="ob-btn" data-action="ob-next">Got it ${ARROW}</button></div>`;
    case 'loop': return `
      <div class="ob-top ob-txt"><div class="ob-kicker">How FailUp works</div><h2 class="ob-h2">Hit failure. Set a goal. Beat it.</h2></div>
      <div class="ob-loop">
        ${['Log your weight, reps and effort for every set.', 'Finish every rep, or hit failure trying.', 'FailUp sets your next goal for that exact machine.', 'Beat it next time. Then do it again.'].map((t, i) => `
        <div class="ob-step" style="--i:${i}"><span class="ob-stepn">${i + 1}</span><span>${t}</span></div>`).join('')}
      </div>
      <div class="ob-big ob-glitch" data-text="That’s failing upward.">That’s failing upward.</div>
      <div class="ob-foot ob-late"><button class="ob-btn" data-action="ob-next">Awesome, what’s next? ${ARROW}</button></div>`;
    case 'nosub': return `
      <div class="ob-visual ob-nosub ob-float" aria-hidden="true">
        <div class="ob-receipt">
          <div class="ob-rrow"><span>Monthly fee</span><b>$0</b></div>
          <div class="ob-rrow"><span>Yearly fee</span><b>$0</b></div>
          <div class="ob-rrow"><span>Features behind a paywall</span><b>0</b></div>
          <div class="ob-rtotal"><span>Subscriptions, ever</span><b>None</b></div>
        </div>
      </div>
      <div class="ob-top ob-txt"><div class="ob-kicker">Users over profit</div><h2 class="ob-h2">No subscriptions. We hate those.</h2>
        <p class="ob-p">Subscriptions suck. FailUp will never ask you for a monthly fee, and nothing is locked away. Every feature is yours.</p>
        <p class="ob-p ob-p2">FailUp doesn’t have a marketing budget, so if you enjoy it, please help spread the word.</p></div>
      <div class="ob-foot">
        <button class="ob-btn" data-action="ob-next">Deal ${ARROW}</button>
        <button class="ob-btn2" data-action="ob-share">Share FailUp with a friend</button>
      </div>`;
    case 'ready': return `
      <div class="ob-flame big" data-ob-flame></div>
      <div class="ob-mid ob-txt">
        <h1 class="ob-h1">You’re ready<br>to <span class="ob-fbox">F</span>ail.</h1>
        <p class="ob-p">Your first goal is one hard set away.</p>
      </div>
      <div class="ob-foot">
        <button class="ob-btn" data-action="ob-starter">Start failing ${ARROW}</button>
        <button class="ob-btn2" data-action="ob-build">Build my own workout</button>
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
