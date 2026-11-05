// ============================================================================
// FailUp — data layer
// Constants + the mutable UI state. Saved user data lives in store.js.
// ============================================================================

// 12 workout colors — cool-forward, each tuned to 4.9:1 on white (WCAG AA small text).
export const WORKOUT_COLORS = [
  { name: 'Slate',   hex: '#4573A8' },
  { name: 'Ocean',   hex: '#25799D' },
  { name: 'Teal',    hex: '#177D81' },
  { name: 'Pine',    hex: '#1E805F' },
  { name: 'Fern',    hex: '#258144' },
  { name: 'Indigo',  hex: '#6B64C9' },
  { name: 'Violet',  hex: '#835ACB' },
  { name: 'Grape',   hex: '#A24BBD' },
  { name: 'Magenta', hex: '#BD3F93' },
  { name: 'Rose',    hex: '#C34264' },
  { name: 'Clay',    hex: '#A95C3B' },
  { name: 'Amber',   hex: '#8E6B26' },
];

export const PURPLE = '#6c5ce7'; // overload / progress — always purple on the tracker

// Muscle groups split by region for the creation grids.
export const UPPER_BODY = ['Chest', 'Shoulders', 'Back', 'Biceps', 'Triceps', 'Forearms', 'Abs'];
export const LOWER_BODY = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];

// Mutable UI state. render() reads this; actions mutate it then re-render.
export const state = {
  screen: 'home',              // 'home' | 'quickselect' | 'session' | 'exercises' | 'create' | 'exwiz' | 'eqwiz' | 'planwiz' | 'tracker'
  exDetail: null,
  eqDetail: null,              // saved equipment id
  eqReturn: null,              // exercise name shown on the detail screen
  trackerReturn: null,
  modal: null,                 // null | 'volume' | 'muscle' | 'equipment' | 'color' | 'icon'
  exercises: {
    mode: 'browse',            // 'browse' (→ tracker) | 'add' (→ add to workout)
    search: '',
    muscles: [],
    equipment: [],
    draftMuscles: [],
    draftEquipment: [],
    recentOpen: false,
  },
  create: { mode: 'new', editIndex: null, name: '', color: '#4573A8', icon: 'kick', expanded: null, exercises: [] },
  details: { wi: 0, expanded: null },
  lineup: { expanded: null, swapIndex: null },
  tracker: { exId: null, equip: null, range: 'All', volume: { sets: 3, reps: 8 } },
  exwiz: {               // Create an Exercise wizard
    step: 1,
    name: '',
    primary: null,
    secondary: [],
    equipment: [],
    saved: [],
  },
  eqwiz: {               // Save Equipment wizard
    step: 1,
    location: 'Wash Park',
    name: '',
    units: 'lbs',
    returnTo: 'exwiz',
  },
  planwiz: null,          // Create a Plan wizard (set when opened)
};
