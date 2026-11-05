// ============================================================================
// FailUp — data layer
// Constants + the mutable UI state. Saved user data lives in store.js.
// ============================================================================

// 12 workout colors: bright and saturated. Includes the three starter workout colors.
export const WORKOUT_COLORS = [
  { name: 'Red',     hex: '#CF2A0F' },
  { name: 'Orange',  hex: '#F25C05' },
  { name: 'Amber',   hex: '#F5A400' },
  { name: 'Lime',    hex: '#5DB80F' },
  { name: 'Green',   hex: '#0FA958' },
  { name: 'Teal',    hex: '#00A6A6' },
  { name: 'Sky',     hex: '#1E90F0' },
  { name: 'Steel',   hex: '#426E8F' },
  { name: 'Purple',  hex: '#6C5CE7' },
  { name: 'Violet',  hex: '#A23BEC' },
  { name: 'Magenta', hex: '#E5309B' },
  { name: 'Pink',    hex: '#FF4F6D' },
]

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
