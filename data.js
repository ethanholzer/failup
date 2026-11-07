// ============================================================================
// FailUp — data layer
// Constants + the mutable UI state. Saved user data lives in store.js.
// ============================================================================

// 12 workout colors, picked to sit well next to FailUp purple (#6C5CE7): warm golds and
// tangerine as its complements, cool aquas and blues beside it, pinks that lean away from red.
// No red (it fights the purple) and no purple (that color means "goal reached").
export const WORKOUT_COLORS = [
  { name: 'Tangerine', hex: '#FF7A1A' },
  { name: 'Marigold',  hex: '#FFB300' },
  { name: 'Lime',      hex: '#8CCB2E' },
  { name: 'Mint',      hex: '#1FC79A' },
  { name: 'Pine',      hex: '#0B8A7A' },
  { name: 'Aqua',      hex: '#12C2E0' },
  { name: 'Azure',     hex: '#2B8CFF' },
  { name: 'Steel',     hex: '#4F7A9A' },
  { name: 'Midnight',  hex: '#24305E' },
  { name: 'Fuchsia',   hex: '#E23FB4' },
  { name: 'Hot Pink',  hex: '#FF4F8B' },
  { name: 'Blush',     hex: '#FF8FAB' },
];
// Old palette → new, so saved workouts and history move over.
export const COLOR_MIGRATION = {
  '#CF2A0F': '#FF7A1A', '#F25C05': '#FF7A1A', '#F5A400': '#FFB300', '#5DB80F': '#8CCB2E',
  '#0FA958': '#0B8A7A', '#00A6A6': '#12C2E0', '#1E90F0': '#2B8CFF', '#426E8F': '#4F7A9A',
  '#6C5CE7': '#1FC79A', '#A23BEC': '#24305E', '#E5309B': '#E23FB4', '#FF4F6D': '#FF4F8B',
};

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

// Links used on the home screen. Set appStore once FailUp is in the App Store and
// "Share FailUp with Friends" will share that instead of the website.
export const LINKS = {
  site: 'https://ethanholzer.github.io/FailUp/',
  appStore: '',
  maker: 'https://ethanholzer.github.io/',
};
