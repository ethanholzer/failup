# FailUp · Release 2.0

A progressive-overload workout tracker. No build step: plain HTML, CSS, and ES
modules. Everything you log is saved in your browser, so it works as a real tool
straight from GitHub Pages.

## What's new in 2.0
Release 1.0 defined the flows. Release 2.0 rebuilds them as a working system in a
refreshed visual design:
- Workouts, history, goals, plans, and equipment are saved and survive reloads
- Overload goals are set and raised automatically from what you actually lift
- Sets and exercises turn purple when you hit your goal (or reach failure at it)
- The overload graph fills in from your real history, per exercise, equipment, and volume
- Release 1.0 flows (Workout Complete, Pause, Skip, Swap, Exercise History,
  My Workouts, Plans, Settings) restyled to match the new design
- Backup and restore, sharing a workout as an image, and phone-ready layout

## Run it
- **GitHub Pages:** put these files at the repo root (or `/docs`) and turn on Pages for that folder.
- **Locally:** it uses ES modules, so serve it instead of opening the file:
  `python3 -m http.server` (or `npx serve .`) and open the printed URL.
- **On your phone:** open the Pages URL in Safari → Share → Add to Home Screen. It opens full screen,
  and the mock status bar disappears on real phones.

## Files
- `index.html`: mount point
- `store.js`: the saved data (localStorage + IndexedDB for photos), seed data, goal replay, stats, dates
- `screens-workout.js`: home, workouts, Today's Plan / Lineup, live session, set sheets, Workout Complete, plan wizard
- `screens-library.js`: exercises, exercise history, equipment, Overload Tracker, wizards, locations, merge, Settings
- `app.js`: navigation, every action (one delegated click handler), share image, boot
- `ui.js`: icons exported from Figma, formatting helpers
- `vendor/lottie_light.min.js`: lottie-web player (MIT) for the Workout Complete animation in `assets/complete.json`
- `data.js`: workout colors + the in-memory UI state
- `exercises.js`: the 502-movement library (generated from `goodfail_library.json`)
- `styles.css`, `fonts/`, `assets/`

## What's saved
Workouts, custom and edited exercises, saved equipment, locations, the plan, the
workout in progress, every finished workout, manual goal edits, and settings. A
fresh install starts with the 3 starter workouts and the exercise library, with
no history and no goals.

Library exercises are stored as edits on top of `exercises.js`, so you can keep
improving the library file and people's own edits survive.

## How overload goals work
Goals belong to an **exercise × equipment × volume** (for example Bench Press,
Barbell, 3 × 8), and you always choose them. FailUp suggests one when you finish
the required sets of an exercise:

- **Last two sets went to failure:** "Set an overload goal?" offers the weight you
  failed at, so the goal is to reach the volume at that weight without failing.
- **Every required set hit the reps, none failed, all RPE 7 or higher:** "Raise your
  goal?" offers that weight plus one increment (5 lbs, 2.5 kg, or 1 for "Simple
  Numbers" equipment).
- **Every required set hit the reps, but it felt easy (any set RPE 6 or lower):** "Too
  light?" lets you pick a heavier goal weight for next time (starts one increment up).
- You can also set or change a goal any time with the pencil on the Overload Tracker,
  or Edit on an exercise card. A new goal starts with your next workout.

**Purple sets:** a set's number box turns purple when it's at (or above) the goal
weight and either reaches the goal reps or is marked as failure. Without a goal,
sets stay black. An exercise's progress pip turns purple when all its required sets
are purple.

**Overload graph:** each dot is a workout where every required set reached the goal
reps at the goal weight, for that exercise, equipment, and volume.

Goals are stored as the choices you made; the graph and the "Goal Reached" badges are
recalculated from your workout history, so editing or deleting a past workout keeps
everything consistent.

## Flows
- **Home:** no plan → Quickstart / Create a Workout Plan. Active plan → plan name
  and dates (options menu to edit or end it), then today's workout card with
  Start, a rest day, or Workout completed, then Quickstart. A paused workout shows a Resume card. The top
  icons open My Workouts, Exercises, Equipment, and Settings.
- **Start a workout:** pick one → Today's Plan (change location, sets, reps,
  equipment, order, swap or add exercises for today only) → Let's Go.
- **Session:** log sets (type or step weight and reps, slide for effort), tap a
  logged set to edit or delete it, Extra Set, skip with the arrows or by tapping
  a progress segment. Skipped exercises stay unfilled and "Back to Skipped" takes
  you to them before Finish Workout. Pause saves and returns home; the pause sheet
  can also finish early or discard. Reloading the page mid-workout keeps it.
- **Workout Complete:** per-exercise sets with "first goal set" / "goal hit" notes,
  Add More Exercises (multi-select Quick Add reopens the workout), Share (a PNG
  through the phone's share sheet, or a download on desktop), Back to the Homepage.
- **My Workouts:** your saved workouts, with an options menu to edit or delete.
- **Swap Exercise:** opens the library filtered to the same muscle group, with
  Create for making a new exercise on the spot.
- **Exercise History:** from the bottom of the Overload Tracker.
- **Locations:** the workout's location sets each exercise's default equipment
  (a saved machine of the same kind there, otherwise the generic type).
- **Plans:** 1 to 10 day split, real calendar with month navigation, edit or end
  the plan from the home card's menu.
- **Settings:** weight units for generic equipment, back up / restore (a JSON file
  that includes photos), clear exercise data, reset.

## Accessibility
- Text sizes are in `rem`, and `index.html` reads the iPhone's Text Size setting (through Safari's
  `-apple-system-body` font) to scale the root size. The default setting looks exactly like the design.
- Minimum text size is 13px; secondary labels are 14px. Small text meets WCAG AA contrast (4.5:1).
- Buttons and controls have at least a 44 × 44px tap area.

## Dev shortcuts
`#home`, `#quickselect`, `#workouts`, `#exercises`, `#equipment`, `#settings`,
`#session` (resumes the workout in progress). `window.__failup` exposes the store
in the console.

## Porting to React later
Each `Screen()` becomes a component, each `data-action` an `onClick`, `state` a UI
store, and `db` in `store.js` a persisted store (the shapes carry over as is).
