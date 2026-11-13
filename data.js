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
  // 20 more solids
  { name: 'Crimson',   hex: '#D7263D' },
  { name: 'Ember',     hex: '#FF5A36' },
  { name: 'Coral',     hex: '#FF7F66' },
  { name: 'Rust',      hex: '#B5502B' },
  { name: 'Copper',    hex: '#C8783A' },
  { name: 'Gold',      hex: '#E8B931' },
  { name: 'Mustard',   hex: '#C99A17' },
  { name: 'Olive',     hex: '#7A8B2E' },
  { name: 'Sage',      hex: '#8DAA88' },
  { name: 'Forest',    hex: '#1E6B3C' },
  { name: 'Emerald',   hex: '#10A35A' },
  { name: 'Seafoam',   hex: '#5FCFB3' },
  { name: 'Lagoon',    hex: '#0F9AA8' },
  { name: 'Sky',       hex: '#5BB8FF' },
  { name: 'Cobalt',    hex: '#1F4FD8' },
  { name: 'Navy',      hex: '#16233F' },
  { name: 'Slate',     hex: '#5B6573' },
  { name: 'Charcoal',  hex: '#2B2F36' },
  { name: 'Burgundy',  hex: '#7D1D3F' },
  { name: 'Magenta',   hex: '#C2187A' },
];
// Themed tiles: drawn only on the workout icon tile and exercise number tiles (styles.css [data-tex=...]).
// hex is the plain color every other part of the app uses for the workout.
export const TEXTURES = {
  'tartan-stewart': 'Royal Stewart tartan', 'tartan-watch': 'Black Watch tartan',
  'fire-red': 'Red fire', 'fire-blue': 'Blue fire', 'fire-green': 'Green fire',
  'scifi-circuit': 'Circuit', 'scifi-hex': 'Shield grid', 'scifi-grid': 'Neon horizon',
  tattered: 'Tattered',
};
export const TEXTURED_COLORS = [
  { hex: '#C8102E', tex: 'tartan-stewart', name: 'Royal Stewart tartan' },
  { hex: '#1E5A3A', tex: 'tartan-watch', name: 'Black Watch tartan' },
  { hex: '#E8401C', tex: 'fire-red', name: 'Red fire' },
  { hex: '#2B6BFF', tex: 'fire-blue', name: 'Blue fire' },
  { hex: '#17B34A', tex: 'fire-green', name: 'Green fire' },
  { hex: '#0F9AA8', tex: 'scifi-circuit', name: 'Circuit' },
  { hex: '#12C2E0', tex: 'scifi-hex', name: 'Shield grid' },
  { hex: '#E23FB4', tex: 'scifi-grid', name: 'Neon horizon' },
  { hex: '#FF7A1A', tex: 'tattered', name: 'Tattered tangerine' },
  { hex: '#D7263D', tex: 'tattered', name: 'Tattered crimson' },
  { hex: '#1F4FD8', tex: 'tattered', name: 'Tattered cobalt' },
  { hex: '#7A8B2E', tex: 'tattered', name: 'Tattered olive' },
  { hex: '#2B2F36', tex: 'tattered', name: 'Tattered charcoal' },
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
