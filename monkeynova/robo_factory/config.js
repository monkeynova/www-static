// config.js
export const HAND_SIZE = 7;
export const PROGRAM_SIZE = 5;
export const MAX_HEALTH = 10;
export const TILE_SIZE = 50; // Define tile size in pixels

// Board dimensions (can be derived, but useful for reference)
// export const GRID_ROWS = 12; // Derived from layout in main.js now
// export const GRID_COLS = 16; // Derived from layout in main.js now

export const orientations = ['north', 'east', 'south', 'west'];
export const ALLOWED_WALL_SIDES = ['north', 'east', 'south', 'west'];

export const ALLOWED_CARD_TYPES = new Set([
    'move1',
    'move2',
    'back1',
    'turnL',
    'turnR',
    'uturn',
]);

export const ALLOWED_EVENT_NAMES = new Set([
    'robotMoved',
    'robotTurned',
    'healthChanged',
    'flagVisited',
    'gameOver',
    'handUpdated',
    'cardCountsUpdated',
    'programExecutionFinished',
]);

export const ALLOWED_LOG_LEVELS = new Set([
    'LOG',
    'WARN',
    'ERROR',
]);

export const TURN_LEFT = 'left';
export const TURN_RIGHT = 'right';

// NEW: Laser Directions
export const LASER_NORTH = 'laser-north';
export const LASER_EAST = 'laser-east';
export const LASER_SOUTH = 'laser-south';
export const LASER_WEST = 'laser-west';

// Optional: Mapping for symbols if needed beyond CSS ::after
export const TILE_SYMBOLS = {
    'repair-station': '🔧',
    // Conveyor Arrows
    'conveyor-east': '→',
    'conveyor-west': '←',
    'conveyor-north': '↑',
    'conveyor-south': '↓',
    // Double Arrows (Using Unicode double arrows)
    'conveyor-east-speed-2x': '⇒',
    'conveyor-west-speed-2x': '⇐',
    'conveyor-north-speed-2x': '⇑',
    'conveyor-south-speed-2x': '⇓',
    'gear-cw': '↻',
    'gear-ccw': '↺',
    // NEW: Laser Symbols
    [LASER_NORTH]: '▲', // Upward triangle
    [LASER_EAST]: '►',  // Rightward triangle
    [LASER_SOUTH]: '▼', // Downward triangle
    [LASER_WEST]: '◄',   // Leftward triangle
};

// Card definitions (can also live in cards.js)
export const FULL_DECK_DEFINITION = [
    // Move 1 (18)
    { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' },
    { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' },
    { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' },
    { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' },
    { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' },
    { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' }, { type: 'move1', text: 'Move 1' },
    // Move 2 (10)
    { type: 'move2', text: 'Move 2' }, { type: 'move2', text: 'Move 2' }, { type: 'move2', text: 'Move 2' },
    { type: 'move2', text: 'Move 2' }, { type: 'move2', text: 'Move 2' }, { type: 'move2', text: 'Move 2' },
    { type: 'move2', text: 'Move 2' }, { type: 'move2', text: 'Move 2' }, { type: 'move2', text: 'Move 2' },
    { type: 'move2', text: 'Move 2' },
    // Back 1 (6)
    { type: 'back1', text: 'Back 1' }, { type: 'back1', text: 'Back 1' }, { type: 'back1', text: 'Back 1' },
    { type: 'back1', text: 'Back 1' }, { type: 'back1', text: 'Back 1' }, { type: 'back1', text: 'Back 1' },
    // Turn L (9)
    { type: 'turnL', text: 'Turn L' }, { type: 'turnL', text: 'Turn L' }, { type: 'turnL', text: 'Turn L' },
    { type: 'turnL', text: 'Turn L' }, { type: 'turnL', text: 'Turn L' }, { type: 'turnL', text: 'Turn L' },
    { type: 'turnL', text: 'Turn L' }, { type: 'turnL', text: 'Turn L' }, { type: 'turnL', text: 'Turn L' },
    // Turn R (9)
    { type: 'turnR', text: 'Turn R' }, { type: 'turnR', text: 'Turn R' }, { type: 'turnR', text: 'Turn R' },
    { type: 'turnR', text: 'Turn R' }, { type: 'turnR', text: 'Turn R' }, { type: 'turnR', text: 'Turn R' },
    { type: 'turnR', text: 'Turn R' }, { type: 'turnR', text: 'Turn R' }, { type: 'turnR', text: 'Turn R' },
    // U-Turn (2)
    { type: 'uturn', text: 'U-Turn' }, { type: 'uturn', text: 'U-Turn' },
];
