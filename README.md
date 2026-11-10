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
- `screens-home.js`: home, How FailUp Works, Overload Goals list
- `screens-workout.js`: workouts, Today's Plan / Lineup, live session, set sheets, Workout Complete, plan wizard
- `screens-library.js`: exercises, exercise history, equipment, Overload Tracker, wizards, locations, merge, Settings
- `app.js`: navigation, every action (one delegated click handler), share image, boot
- `ui.js`: icons exported from Figma, formatting helpers
- `vendor/lottie_light.min.js`: lottie-web player (MIT) for the Workout Complete animation in `assets/complete.json`
- `data.js`: workout colors + the in-memory UI state
- `exercises.js`: the 502-movement library (generated from `goodfail_library.json`), with photo ids and how-to steps
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
Barbell, 3 × 12), and you always confirm them. When you finish the planned sets of an
exercise (or move on with fewer, which suggests a goal for the volume you did), FailUp
suggests one, with a one-line reason.

- **Completed set:** hit the target reps, not marked F. **Failed attempt:** marked F, or
  short of the target reps. **Anchor:** the heaviest completed set rated RPE 6+.
- **No goal yet at this volume:**
  - Every set completed at one weight and felt hard: one increment up.
  - Same, but it felt easy (or 3+ extra reps on every set): "Too light?" picker, starting
    +1 increment at RPE 6, +2 at RPE 4 to 5, +3 at RPE 3 or lower (+2 for extra reps).
  - Same, but sets weren't rated: that weight, no raise, plus a nudge to rate sets.
  - Otherwise, an anchor: the anchor weight (ramps, drop sets, mixed weights).
  - Failed every set: picker starting one increment under the best attempt, to keep form.
  - Some failures, no anchor: the weight of the best failed attempt.
- **A goal already at this volume:** failure moves it to that weight; a clean, hard sweep raises it.
- Warmups and extra sets never change the goal. Sets only count on the equipment you ended on.
- "Not Now" keeps it as a suggestion on Workout Complete and on the Overload Tracker. Anything
  never asked (ended early) shows up there too.
- Your very first goal gets a celebration. Unrated sets show a dashed tag.
- Bodyweight exercises take added (+) or assisted (−) weight.
- You can also set or change a goal any time with the pencil on the Overload Tracker.

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
- **Home:** a purple header with the FailUp logo and Settings, then modular sections:
  1. The main action: a paused workout (Resume / Discard); or the active plan with today's
     workout or rest day plus a yellow Quickstart; or, with neither, Create a Workout Plan and Quickstart.
  2. Workouts, Exercises, Equipment. Once these scroll away they appear as icons in the header.
  3. How FailUp Works: a swipeable rail. The first card opens the explainer page; the second
     (purple) is about the maker and links to his site (`LINKS.maker` in `data.js`).
  4. Progressive Overload Goals: recently changed goals as small graphs (tap for the Overload
     Tracker), with See All for a searchable list of every goal.
  5. Tell your friends: shares `LINKS.appStore` once it's set, otherwise the website.
- **Start a workout:** pick one → Today's Plan (change location, set one volume for every
  exercise, or change sets, reps, order, swap or add exercises for today only) → Let's Go.
  Any change to today's plan or the live workout slides up Nevermind / Save Changes.
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
- **Equipment:** each exercise in a workout has a Preferred Equipment Type (set in Create /
  Edit Workout). When a workout starts, FailUp picks a saved machine of that type at the
  workout's location, otherwise the generic type. Saving equipment asks what kind it is.
  The swap sheet lists related saved equipment first, then every generic type.
- **Exercise lists** show how many sets you've logged ("No sets yet" / "12 sets logged");
  equipment is still used for filtering.
- **Plans:** 1 to 10 day split, real calendar with month navigation, edit or end
  the plan from the home card's menu.
- **Settings:** weight units for generic equipment, back up / restore (a JSON file
  that includes photos), clear exercise data, reset.

## Exercise photos
Library exercises show photos and how-to steps from [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(public domain, Unlicense). Photos load from GitHub as you scroll, matched to the equipment in use, and fall back to
the dumbbell icon if they can't load. A photo you add to an exercise or a saved machine always wins.

## Visual style
Flat, inspired by Happn: a near-white canvas tinted toward FailUp purple (#F6F5FA), headers
the same color as the page (a hairline appears once you scroll), soft square controls in a
lavender gray, black rounded-rectangle primary buttons, big tight titles, white cards with a
soft wide shadow, and color through pale tints (workout icons, badges, tags). RPE tags are
pale purple; a set taken to failure (F) stays solid purple.

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

## Equipment icons
Generic equipment thumbnails use line icons on a light purple tile (`EQ_ICONS` in ui.js, copies in assets/equipment/).
Dumbbell and Bodyweight come from [Tabler Icons](https://tabler.io/icons) (MIT, see LICENSE-tabler-icons.txt).
Barbell, Cable Machine, Smith Machine and Specialized Machine (a pendulum squat) were drawn for FailUp on the same 24px grid and 2px stroke so the set matches.
