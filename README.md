# FailMore · Release 2.0

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
- `screens-home.js`: home, How FailMore Works, Overload Goals list
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
exercise (moving on with fewer sets skips the goal), FailMore
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
- The goal sheet opens when you tap Next Exercise (or Finish Workout on the last one). The arrows
  and the lineup only browse, so they never lock in a goal for a partial volume. Logging more sets
  after being asked asks again with the new count.
- Every goal sheet has a weight stepper, so you can fix a suggestion before setting it.
- "Not Now" keeps it as a suggestion on Workout Complete, the Overload Tracker, and the exercise
  dropdown, where View reopens the sheet. Anything never asked (ended early) is kept too.
- A brand-new exercise with no data shows "No Goal Yet" with no tracker button.
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
- **Home:** a purple header with the FailMore logo and Settings, then modular sections:
  1. The main action: a paused workout (Resume / Discard); or the active plan with today's
     workout or rest day plus a yellow Quickstart; or, with neither, Create a Workout Plan and Quickstart.
  2. Workouts, Exercises, Equipment. Once these scroll away they appear as icons in the header.
  3. How FailMore Works: a swipeable rail. The first card opens the explainer page; the second
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
  Edit Workout). When a workout starts, FailMore picks a saved machine of that type at the
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
Flat, inspired by Happn: a near-white canvas tinted toward FailMore purple (#F6F5FA), headers
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
Barbell, Cable Machine, Smith Machine and Specialized Machine (a pendulum squat) were drawn for FailMore on the same 24px grid and 2px stroke so the set matches.

## Equipment and locations (Nov 2026)
- Saved equipment can count as several kinds (an Inspire FT2 is a Smith Machine and a Cable Machine). The kind list starts with Specialized Machine, Cable Machine, Smith Machine.
- Starting a workout (or changing where it is) picks saved gear of each exercise's preferred kind at that location, the most used one when there are several.
- The swap sheet shows everything saved where you're training, then the generic kinds. Picking something stages it; Save applies, Nevermind backs out.
- Swapping mid-exercise moves the sets already logged to the new equipment. Going from a generic kind with a goal to a saved machine without one asks to bring the goal over; picking gear saved somewhere else asks whether to switch the workout's location.
- Goals: finishing every set while stepping up in weight suggests the top weight. With no goal yet, the sheet always says Set as Goal and never shows a current goal.

- Goals only come from the volume in the exercise dropdown: if you did fewer sets than it says by Next Exercise or Finish Workout, no goal is set or suggested. Extra sets are fine; the goal is based on the first sets up to that count.

## Live workout flame
During an exercise with a goal, a purple flame rises from the bottom of the screen. Each working set at the goal weight or heavier, with every rep or a failure, makes it taller and more opaque; finishing the whole volume on track flares it once. A set that falls short puts it out for that exercise. `assets/flame.json` is "Fire - Feu - Fuego" by Tom Fabre on LottieFiles (Lottie Simple License), recolored from orange and yellow to FailMore purples.

## Rest timer
Turn it on from Today's Plan (the choice and length become your default). During a workout the timer is one quiet row (stopwatch, −, time, +, play/pause) that sits in the bottom tray above the Warmup Set and Set buttons; it's not on the set logger. Logging a working set starts the countdown; at zero it chimes, buzzes where the phone allows, and opens the next set's logger. It stops once the exercise's set volume is logged. − and + jump to the nearest multiple of 15 seconds in that direction, then step by 15 (going below zero skips the rest). When no countdown is running they change your default length (15s to 10 min), and play starts a countdown by hand. The countdown is based on the time the set was logged, so it stays right if the phone sleeps.

## Ending a workout
The pause sheet has End Workout, which saves what you've logged and opens Workout Complete. On Home, a paused workout shows End and Resume; a workout that hasn't started yet still shows Discard.

## First-launch intro
New installs (no workouts logged) open a short purple intro: welcome, "What's already familiar?" (tap the terms you know), a teaching card for each term you didn't tap (progressive overload, training to failure, volume), how the FailMore loop works, then a no-subscriptions promise with a share button, then Start failing (a starter workout) or Build my own workout, with a lbs/kg toggle. Skip jumps to the promise screen. A "Fail safely" sheet slides up once, before the first workout. Replay it from Settings, or open the app at `#intro`.
Sources cited on the cards: Plotkin et al., PeerJ 2022 (load vs. rep progression); Robinson et al., Sports Medicine 2024 (proximity to failure).

## Workout icons
The icon picker has 53 icons in seven groups: Body parts (8), Lifts (5), Moves & poses (11), Skulls (7), Beasts & battle (12), Equipment (6) and Cardio (4).
The body part icons are drawn for FailMore as a muscle map, with the whole figure faded and the target muscle solid.
The added icons live in `icons-workout.js` (inline SVG that uses currentColor), with standalone copies in `assets/workout-icons/`.
Licenses are in `assets/workout-icons/LICENSES.txt`. The game-icons.net icons are CC BY 3.0, so Settings shows a credit line.
The selected icon is outlined in the workout's color.

## Workout colors
32 solid colors and 13 themes (`WORKOUT_COLORS`, `TEXTURED_COLORS` in data.js): two tartans, red, blue and green fire, three sci-fi patterns and a tattered finish on five colors. A theme is stored as `tex` next to `color` and drawn only on the workout icon tile and exercise number tiles (`[data-tex]` in styles.css). Everything else uses the plain `color`.

## Saved machines
Only Smith machines, cable machines and specialized machines can be saved as your own equipment (`MACHINE_TYPES` in store.js); bars, dumbbells and bodyweight are the same everywhere. Arriving on an exercise done on one of those kinds during a workout opens its details, so you see which machine it's on and can save or switch it.
On the Overload Tracker for a generic kind, your saved machines of that kind show as a grey dotted line with hollow dots. Below the graph, a list shows the saved machines with an active goal at this rep range; on a saved machine it shows the generic kind (with or without a goal) and the other machines with goals. Tapping one with a goal opens its graph.
Adding an exercise while building a workout asks which equipment you'll use (the library's usual one is already set, so closing the sheet keeps it). Exercises with only one kind skip the question.

## Share
Sharing FailMore (onboarding, the share sheet after a workout, the workout image) uses `LINKS` in data.js: the App Store link once it's set, otherwise https://ethanholzer.github.io/failup/. The spread-the-word slide plays `assets/share.json`, a Lottie drawn for FailMore (one person shares to three friends, and each of them shares to three more), so there's no license to track.

## Exercise search
`search.js` uses MiniSearch (MIT, `vendor/minisearch.js`) for typos, partial words and ranking, with gym rules on top: pull up = pull-up = pullup (same for push up, pulldown, chin-up, step-up and more), plurals (curls, flyes), shorthand (db, bb, kb, rdl, ohp, tri, bi, lats, hams), and an order that puts the exact name first, then names that start with what you typed, short basic names before long variations, and exercises you've logged.

## Basic exercise names
`store.js` adds 16 basic listings (Lat Pulldown, Seated Cable Row, Dumbbell Row, Cable Crossover, Overhead Press, Lateral Raise, Cable Curl, Goblet Squat, Bulgarian Split Squat, Leg Curl, Cable Crunch, Back Extension, Assisted Pull-Up, Pullover, Farmer's Carry, Kettlebell Swing) with fixed `base:` ids, and renames some library movements to their basic names (`LIB_RENAMES`). A library movement's id comes from its original name, so a rename only changes what's shown; logged sets, goals and workouts keep pointing at the same id. Your own exercise edits still win over these names.

## Missed plan workouts
On a plan rest day, the plan card shows "You missed this one" with the latest plan workout since the previous rest day that wasn't done (doing that workout any day since counts as made up). Start begins it; Dismiss hides that day (`plan.dismissed`), and an earlier miss from the same stretch shows next if there is one.

## Locations
There are no preset locations. Until you have one, Today's Plan shows "Where is this workout?" as a text field: type a name and it's saved as a location and used for that workout. After that, the swap button opens your saved locations plus "Add a new location".

## Goals at a new volume
When an exercise has no goal at its current volume but has one at another volume on the same equipment, the Overload Goal panel (Edit Workout and the live exercise dropdown) suggests a converted weight with Accept and Dismiss, and the label reads "Overload Goal (Suggested)". With no goal and no suggestion, an icon-only edit button opens the goal sheet. `volumeSuggestion` in store.js picks the closest goal (same set count first, then the nearest rep count) and converts it with the average of the Epley and Brzycki one-rep-max formulas, rounded down to the equipment's weight step. Accept saves it as a normal goal edit; Dismiss stores the volume key in `db.volSuggDismissed` so it stays quiet. Logged sessions are never changed.

## Notes and the rest timer pill
A row on the cream above the session footer holds a Notes button (left) and the rest timer (right, only when the timer is on). Closed, the timer shows the stopwatch and the countdown; tapping it opens −, + and play/pause (`state.restOpen`). Notes open a sheet for the current exercise. Each note lives on that exercise in the current session only (`ex.note`), so every new workout starts blank. The Notes button gets a purple outline when that exercise's note has text.
The countdown plays a short "boop" (523 Hz) at 3, 2 and 1 seconds left and a higher, longer "beep" (1047 Hz) at zero, with a light vibration on phones that support it. Sound is unlocked by the tap that starts the timer.
Settings → Rest Timer Sound (`db.settings.restSound`, on unless set to false) mutes the boops and the beep; vibration stays.

## Sharing
Share FailMore sends "FailMore is a quality workout tracker. It’s only $8.99, no subscription. You should get it too!" with the link. index.html carries Open Graph and Twitter tags pointing at `assets/og.jpg` (2400 × 1260) by absolute URL, so Messages and other apps show the preview card. If the app moves to another address, update the og:url and og:image URLs.

## Failure on the effort slider
At Failure the white thumb blooms, then breathes a slow purple glow (`ffBloom`, `ffBreathe`, `ffHalo` in styles.css). The old ring is hidden. Reduced motion gets a still glow.

## Today's Plan header
Flat white header (no rounded corners). "Where is this workout?" is a full-width row with a pin icon tinted in the workout color and the swap button. Under it, "All Volume" (with the volume button) and "Rest Timer" (On/Off with a toggle) sit side by side, rest timer first and compact, volume wider (grid `auto 1fr`); the location and volume buttons are both 40px. During a workout (Today's Lineup) only the rest timer row shows, full width.

## Rest timer is standalone
The rest timer never starts on its own and never opens the set logger: start it with play, and when it hits zero it only boops, beeps and resets. A tap anywhere outside the open timer closes it. The Notes and timer row has no fill, so the live-workout flames show behind it.

## Volume sheet
Sets and Reps use the side-by-side steppers from Edit Workout, and below them the Overload Goal cell from the exercise dropdown (including suggested goals with Accept and Dismiss). Accepting there saves the goal for that volume right away; the volume itself still needs Save.

## Small flows
- The end of the intro ("Start failing") lands on Home.
- Saved equipment: the kind card shows the generic thumbnail for its first kind, the location card shows a pin; both use the normal card shadow.
- Sharing Workout Complete sends the image plus "Tracked with FailMore" and the app link (also passed as `url`).
- Notes: when a workout finishes, each exercise's note is saved with that exercise in the session (`note`) and shown under its sets on Workout Complete. The share image never draws notes.
- Under "Exercise List" (Today's Plan and Edit Workout) a row of muscle tags shows how many exercises hit each group, in list order (`muscleSummary`).

## Goal timing in a workout
An exercise's session goal follows saved goals only until its first working set (`goalLock` in `syncGoal`). After that it's fixed for this workout, so reaching it keeps the purple sets, flames and progress segment even if a new goal is accepted or edited; that new goal shows as "Next time" and applies from the next workout. Changing the goal before any working set updates the current workout. Changing volume or equipment re-reads the goal.

## Effort slider and swap
The slider thumb moves with `transform` straight under the finger (no easing, no re-render on release). At Failure only the halo animates. The set logger header shows the exercise name only. Swap equipment marks equipment that has goals for this exercise with a purple dot and "X Goals" in its subtitle (sheet and full list).

## Saved machines (specialized only)
Only specialized machines are saved now. The Save a Machine flow is: where it is, a name, weight units (pounds or kilograms) and a photo. The new machine is linked to the exercise it was saved on (`exercise.equipment` gets `eq:<id>`). More exercises are added later from the machine's page: Related Exercises → Add opens a search to pick them (`eqrelated` screen). "What kind of equipment is it?" only offers the generic kinds, and any saved machine without a generic kind counts as a Specialized Machine.

- `machineFor(exId, machine)` in store.js: a machine is for an exercise when the exercise lists it, or it was already logged or given a goal on it. Older saved machines (cable, Smith) keep all their history and goals and still count for the exercises they were used with; they just can't be created anymore.
- Live workout: a "Specialized Machine" exercise auto-picks the most-used saved machine for that exercise at the workout's location and opens its details. With none saved there, a "Save this machine?" card offers Add Machine or Not Now (Not Now hides it for that exercise for this workout). Adding one uses it right away.
- Swap equipment during a workout lists only saved machines here that are for this exercise, then the generic list. "View All Saved Equipment" only appears outside a workout.
- Overload Tracker on the generic Specialized Machine graph: its own goals and completed workouts in purple, and the saved specialized machines for that exercise in grey (goal lines, dots and the line joining them).

## Moving cable and Smith data to generic
Settings → "Move Cable and Smith Data to Generic" (shown only while saved cable or Smith machines exist) moves every set, goal, workout and suggestion from those saved machines to the generic Cable Machine / Smith Machine (`moveToGeneric` in store.js), converting kg ↔ lbs to the app's units and rounding to the weight step, then removes the saved machines. Logged workouts are never deleted. Machines with numbered weights ("Simple Numbers") can't convert and stay saved. When a generic goal and a moved goal share an exercise and volume, the most recent one wins. It won't run during a workout.

## Editing exercise history
Exercise History has Edit in the top right. In edit mode each set log (one workout's sets for that exercise) gets a full-width red Delete button along its bottom; tapping it asks "Delete this set block?" with Nevermind or Delete. Deletions hide right away but are only saved when you tap Done (`state.hx.del`); leaving with Back discards them. Saving removes that exercise's entry from the workout, and a workout with nothing left is removed too. Goals and the tracker recalculate from what remains.

## Live workout dropdowns and goal suggestions
Exercise details in a live workout always start closed and close when you move to another exercise (`session.openAt`). In the Overload Goal panel a suggestion is the goal for the sets ahead (a converted goal with Accept/Dismiss, or a waiting suggestion); "Next time" only appears once a goal for next time is set, and then no suggestion is shown, so the two never appear together.
When a goal for next time is set, the Overload Goal panel shows "Next time:" (black) with the weight (purple) and that goal's volume underneath, with a pencil to adjust it. Adjusting it there changes next time's goal and leaves this workout's goal as it was.

## Copy pass (Nov 17)
Rewrote modal and confirmation copy after review: Pause sheet ("Take a break?"), Discard, Update goal, goal prompt titles and reasons (merged to four "completed" lines; finishing every set at your goal without effort ratings now offers a raise), Fail safely, Share ask, "Use your goal here?", the other-gym question, equipment and location sheet subtitles, Remove exercise, End plan, library delete, machine wording (Delete/Merge/Edit Machine), Move to generic, Clear/Reset. Exercise History edit mode now uses Save; leaving with unsaved deletions asks "Save your changes?" (Cancel Changes / Save Changes). Merging machines combines the merged machine's sets and goals into the other one (`repointRef`, converting units), and the one kept loses nothing.

## Equipment Type
Edit Workout and Today's Plan show "Equipment Type", a choice of the six generic kinds only. Generic equipment logs the same at every gym; only saved machines are tied to a location. On Today's Plan, choosing Specialized Machine picks a saved machine that fits the exercise at the workout's gym (and re-picks when the gym changes); with none there it stays the generic Specialized Machine.

## Tracker goal line
Only the current goal is drawn (no past goal lines, and the y-axis ignores them). The current goal's line and band start at the latest completed workout at that volume that's still in your history, so deleting that workout moves the start back to the one before. Saved machines on the generic graph follow the same rule in grey.
- Y axis: one grid step below the lowest point shown and one above the highest (usually the goal line).

## Pearl cards and the Safari sheet fix (Nov 19)
- **Pearl exercise cards** in Today's Plan, Create / Edit Workout, Workout Details and the live workout: milky white cards with a faint lilac hairline, a bright top edge and a soft violet-tinted shadow. Panels inside are lightly tinted with a hairline; buttons are white chips. Up, Down, Swap and Delete are flat icons (22, 22, 20 and 18 px, 44px tap areas, with accessible names) in a shorter strip. Muscle tags keep their outline in the workout color. All in one block at the end of styles.css.
- **Equipment picker fix (Safari):** on phones the page itself no longer scrolls (html and body are locked to the screen; the app scrolls inside .app). Safari's toolbars made the page taller than the screen, so a tap on a sheet could shift the page and land on the dimmed background, closing the sheet without picking anything. A sheet's background now also only closes it when the press started on the background.

## Renamed to FailMore (Nov 19)
- Every name people see now says FailMore: the home header, How FailMore Works, onboarding, Settings, share text, backup and share-image file names, the page title and the link preview image (assets/og.jpg).
- "Share FailMore with Friends" now shares https://failmore.app/.
- Storage keeps its original names on purpose, so nothing logged is lost: `failup.v1`, `failup.v1.savedAt`, the `failup-photos` photo database, and `window.__failup` for debugging. Backups made before the rename still import.
- The web app's own address is still ethanholzer.github.io/failup, so its link-preview tags still point there.

## Equipment icons from Figma (Nov 19)
- The six generic equipment icons (Barbell, Dumbbell, Bodyweight, Cable Machine, Smith Machine, Specialized Machine) are Ethan's own, from the Graphics page of the Overload Figma file. They're filled shapes on a 78 × 78 grid in `EQ_ICONS` (ui.js), colored with currentColor; the `eqi` class turns off the outline stroke the older line icons used. `assets/equipment/*.svg` holds the same icons in purple.

## Saved machines and location tags
- A saved machine is always a Specialized Machine. Names are unique (any letter case).
- `locations` is a list of tags. No tags means the machine is available everywhere; a workout with no location sees every machine.
- One-time migration (`migrateMachineTags` in store.js, flag `db.eqTagsV`): the old single location becomes the first tag, and machines sharing a name are numbered ("Leg Extension 1", "Leg Extension 2"). Nothing logged changes.
- Auto-pick: a linked machine tagged here (or untagged), the one last used for that exercise at this gym, else the newest saved.
- Picking a machine tagged elsewhere adds this gym tag; picking one not linked to the exercise links it.
- Merge combines tags, exercise links, sets and goals; the most recent goal wins. `removeLocation()` only removes the tag.
- Test: /tmp/claude-0/t/machines.cjs [port].
