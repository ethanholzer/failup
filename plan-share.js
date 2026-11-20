// ============================================================================
// FailMore: share a plan as a link, and take one in.
// A link is https://failmore.app/plan/#<code>. The code is the plan, its workouts and any custom
// exercises in them, packed into JSON, compressed and made URL safe. Nothing logged travels with it:
// no sets, goals, photos or saved machines (those become their generic kind).
// The same code also arrives as failmore://plan#<code> (the app's own link) or #plan=<code> (web app).
// ============================================================================
import { db, EXERCISES, exById, uid, eqKind, GENERIC, SPECIAL, daysBetween, workoutById } from './store.js';

export const LINK_BASE = 'https://failmore.app/plan/#';
export const WORKOUT_LINK_BASE = 'https://failmore.app/workout/#';

/* ---- packing ---- */
const b64url = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); };
async function squeeze(bytes, dir) {
  const S = dir === 'in' ? window.CompressionStream : window.DecompressionStream;
  const stream = new Blob([bytes]).stream().pipeThrough(new S('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function pack(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) { try { return '1' + b64url(await squeeze(raw, 'in')); } catch {} }
  return '0' + b64url(raw);
}
async function unpack(code) {
  const bytes = unb64url(code.slice(1));
  const raw = code[0] === '1' ? await squeeze(bytes, 'out') : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}

/* ---- a plan → link ---- */
const kindOf = ref => { const k = eqKind(ref); return GENERIC.includes(k) ? k : SPECIAL; };
const packWorkout = (w, custom) => ({ n: w.name, c: w.color, i: w.icon, t: w.tex || '', x: w.exercises.map(e => {
  const x = exById(e.exId);
  if (x && x.custom) custom.set(x.id, { id: x.id, n: x.name, m: x.muscle, s: x.secondary || [], q: (x.equipment || []).filter(k => GENERIC.includes(k)), k: x.mechanic || '', f: x.force || '', l: x.level || '' });
  return [e.exId, (x && x.name) || e.name || '', (x && x.muscle) || e.muscle || '', kindOf(e.equip), e.sets, e.reps];
}) });
export function planPayload(t, findWorkout = workoutById) {
  const wIds = [], ws = [], custom = new Map();
  const days = t.days.slice(0, t.splitDays).map(d => {
    const w = d.type === 'workout' && findWorkout(d.workoutId);
    if (!w) return 'r';
    let i = wIds.indexOf(w.id);
    if (i < 0) {
      i = wIds.push(w.id) - 1;
      ws.push(packWorkout(w, custom));
    }
    return i;
  });
  return { v: 1, n: t.name, s: t.splitDays, l: t.length || 28, d: days, w: ws, e: [...custom.values()] };
}
export const planLink = async (t, findWorkout) => LINK_BASE + await pack(planPayload(t, findWorkout));
// one workout: { v, k: 'w', n, w: [the workout], e: custom exercises }
export async function workoutLink(w) { const custom = new Map(), one = packWorkout(w, custom); return WORKOUT_LINK_BASE + await pack({ v: 1, k: 'w', n: w.name, w: [one], e: [...custom.values()] }); }

/* ---- a link → a plan sent to you ---- */
export function codeFrom(text) {
  const s = String(text || '').trim();
  const m = s.match(/failmore\.app\/(?:plan|workout)\/?#([0-9A-Za-z_-]{8,})/) || s.match(/^failmore:\/\/(?:plan|workout)\/?#([0-9A-Za-z_-]{8,})/) || s.match(/[#&](?:plan|workout)=([0-9A-Za-z_-]{8,})/);
  return m ? m[1] : null;
}
const valid = p => p && p.v === 1 && typeof p.n === 'string' && Array.isArray(p.w) && (p.k === 'w' ? p.w.length === 1 : Array.isArray(p.d) && p.d.length >= 1 && p.d.length <= 10);
export const isWorkoutEntry = e => !!(e && e.p && e.p.k === 'w');
// Adds it to "Plans sent to you" (once, however many times the link is opened). Returns the entry or null.
export async function receivePlan(text) {
  const code = codeFrom(text); if (!code) return null;
  let p; try { p = await unpack(code); } catch { return null; }
  if (!valid(p)) return null;
  db.inbox = db.inbox || [];
  const have = db.inbox.find(x => x.code === code);
  if (have) return have;
  const entry = { id: uid('in'), code, at: new Date().toISOString(), p };
  db.inbox.push(entry);
  return entry;
}

/* ---- viewing a plan sent to you before it's yours ---- */
// a template-shaped view of it, with its workouts kept on the side
export function inboxPlan(entry) {
  const p = entry.p, ws = {};
  p.w.forEach((w, i) => { ws['inw' + i] = { id: 'inw' + i, name: w.n, color: w.c, icon: w.i, tex: w.t, exercises: w.x.map(([exId, name, muscle, equip, sets, reps]) => ({ exId: exById(exId) ? exId : null, name, muscle, equip, sets, reps })) }; });
  return { id: 'in:' + entry.id, inbox: entry.id, name: p.n, splitDays: p.s, length: p.l, days: p.d.map(d => d === 'r' ? { type: 'rest' } : { type: 'workout', workoutId: 'inw' + d }), ws };
}

/* ---- make it yours: workouts, custom exercises and the plan go into your lists ---- */
function adoptWorkouts(p) {
  const exMap = new Map();
  for (const e of p.e || []) {   // custom exercises: reuse yours when the name and muscle match
    const mine = EXERCISES.find(x => x.custom && x.name.toLowerCase() === e.n.toLowerCase() && x.muscle === e.m);
    if (mine) { exMap.set(e.id, mine.id); continue; }
    const id = uid('cx');
    EXERCISES.push({ id, name: e.n, muscle: e.m, secondary: e.s || [], equipment: e.q && e.q.length ? e.q : [SPECIAL], mechanic: e.k || undefined, force: e.f || undefined, level: e.l || undefined, custom: true });
    exMap.set(e.id, id);
  }
  const byName = new Map();   // library exercise ids match on every phone; otherwise match by name
  const resolve = (id, name, muscle) => exMap.get(id) || (exById(id) && id) || (() => {
    const k = `${name}|${muscle}`.toLowerCase();
    if (!byName.size) for (const x of EXERCISES) byName.set(`${x.name}|${x.muscle}`.toLowerCase(), x.id);
    return byName.get(k) || null;
  })();
  const same = (a, b) => JSON.stringify(a.exercises.map(e => [e.exId, e.sets, e.reps])) === JSON.stringify(b.exercises.map(e => [e.exId, e.sets, e.reps]));
  const wIds = p.w.map(w => {
    const fresh = { name: w.n, color: w.c, icon: w.i, tex: w.t || '', exercises: w.x.map(([id, name, muscle, equip, sets, reps]) => ({ exId: resolve(id, name, muscle), name, muscle, equip, sets, reps })).filter(e => e.exId) };
    const twin = db.workouts.find(x => x.name === fresh.name && same(x, fresh));
    if (twin) return twin.id;   // you already have this exact workout
    let name = fresh.name, n = 2;
    while (db.workouts.some(x => x.name === name)) name = `${fresh.name} ${n++}`;
    const made = { id: uid('w'), ...fresh, name };
    db.workouts.push(made);
    return made.id;
  });
  return wIds;
}
export function adoptPlan(entry) {
  const p = entry.p, wIds = adoptWorkouts(p);
  const t = { id: uid('pt'), name: p.n, splitDays: p.s, length: p.l, days: p.d.map(d => d === 'r' ? { type: 'rest' } : { type: 'workout', workoutId: wIds[d] }), createdAt: new Date().toISOString().slice(0, 10), shared: true };
  db.plans.push(t);
  db.inbox = db.inbox.filter(x => x !== entry);
  return t;
}
// a workout sent to you → your workouts (reused if you already have the exact same one)
export function adoptWorkout(entry) {
  const id = adoptWorkouts(entry.p)[0];
  db.inbox = db.inbox.filter(x => x !== entry);
  return db.workouts.find(w => w.id === id);
}
// what a workout sent to you looks like, for its card
export function inboxWorkout(entry) {
  const w = entry.p.w[0];
  return { id: 'in:' + entry.id, inbox: entry.id, name: w.n, color: w.c, icon: w.i, tex: w.t, exercises: w.x.map(([exId, name, muscle, equip, sets, reps]) => ({ exId: exById(exId) ? exId : null, name, muscle, equip, sets, reps })) };
}
export const planLengthOf = r => daysBetween(r.start, r.end) + 1;

/* ---- the share sheet ---- */
export async function shareLink(url, title, text) {
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.Share) {
    try { await cap.Plugins.Share.share({ title, text, url, dialogTitle: title }); return 'shared'; } catch { return 'cancelled'; }
  }
  if (navigator.share) { try { await navigator.share({ title, text, url }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; } }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { return 'failed'; }
}
