// ============================================================================
// FailMore → Apple Health. Write-only: a finished workout is saved to Health as a Strength Training
// workout with its start time, end time and name. Nothing is read from Health, and nothing leaves
// the phone. Only on iPhone (the native FailMoreHealth piece lives in SceneDelegate.swift).
// ============================================================================
const cap = () => window.Capacitor;
let plugin = null;
function native() {
  const c = cap();
  if (!(c && c.isNativePlatform && c.isNativePlatform() && c.registerPlugin)) return null;
  if (!plugin) plugin = c.registerPlugin('FailMoreHealth');
  return plugin;
}
// Health exists on this device and this build of the app can talk to it
export async function healthAvailable() {
  const p = native(); if (!p) return false;
  try { return !!(await p.isAvailable()).available; } catch { return false; }
}
// Shows Apple's permission sheet (only the first time). Resolves true when FailMore may save workouts.
export async function requestHealth() {
  const p = native(); if (!p) return false;
  try { return !!(await p.requestAccess()).granted; } catch { return false; }
}
// Saves one finished workout. Resolves true when Health took it.
export async function saveToHealth(rec) {
  const p = native(); if (!p || !rec.startedAt || !rec.finishedAt) return false;
  const start = new Date(rec.startedAt).getTime(), end = new Date(rec.finishedAt).getTime();
  if (!(end - start >= 60000)) return false;   // under a minute isn't a workout
  try { return !!(await p.saveWorkout({ start, end, name: rec.workoutName || 'Workout' })).saved; } catch { return false; }
}
export const isNativeApp = () => !!native();
