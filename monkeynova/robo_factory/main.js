// main.js
import * as Config from './config.js';
import * as Board from './board.js';
import { ALLOWED_TILE_CLASSES } from './board.js'; // Import for validation
import Robot from './robot.js';
import * as Cards from './cards.js';
import * as UI from './ui.js';
import * as GameLoop from './gameLoop.js';
import * as Logger from './logger.js';
import { emit } from './eventEmitter.js';

/**
 * Generates a large, feature-rich board.
 * @param {number} rows - The number of rows for the board.
 * @param {number} cols - The number of columns for the board.
 * @returns {object[][]} A 2D array of tile definition objects.
 */
function createDemonstrationBoard(rows, cols) {
    const board = [];
    // 1. Create a base board with border walls
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            const tile = { classes: ['plain'], walls: [] };
            if (r === 0) tile.walls.push('north');
            if (r === rows - 1) tile.walls.push('south');
            if (c === 0) tile.walls.push('west');
            if (c === cols - 1) tile.walls.push('east');
            row.push(tile);
        }
        board.push(row);
    }

    // 2. Carve a central chasm of holes
    const chasmStartCol = Math.floor(cols / 2) - 2;
    const chasmEndCol = chasmStartCol + 3;
    for (let r = 1; r < rows - 1; r++) {
        for (let c = chasmStartCol; c <= chasmEndCol; c++) {
            // Create a few bridges
            if (r % 7 !== 0 || c === chasmStartCol || c === chasmEndCol) {
                 board[r][c].classes = ['hole'];
            }
        }
    }

    // 3. Add a conveyor "river" next to the chasm
    const riverCol = chasmStartCol - 1;
    const expressRiverCol = chasmStartCol - 2;
    for (let r = 1; r < rows - 1; r++) {
        board[r][riverCol].classes = ['conveyor-south'];
        board[r][expressRiverCol].classes = ['conveyor-south', 'speed-2x'];
    }

    // 4. Create a walled maze in the top-right quadrant
    const mazeStartRow = 2, mazeEndRow = 8;
    const mazeStartCol = cols - 9, mazeEndCol = cols - 2;
    for (let r = mazeStartRow; r <= mazeEndRow; r++) {
        for (let c = mazeStartCol; c <= mazeEndCol; c++) {
            if (r % 2 === 0 && c < mazeEndCol -1) {
                board[r][c].walls.push('south');
                board[r+1][c].walls.push('north');
            }
            if (c % 2 !== 0 && r < mazeEndRow && r > mazeStartRow) {
                 board[r][c].walls.push('west');
                 board[r][c-1].walls.push('east');
            }
        }
    }

    // 5. Add a conveyor whirlpool in the bottom-left
    const whirlStart = { r: rows - 8, c: 2 };
    const whirlSize = 5;
    for (let i = 0; i < whirlSize; i++) {
        // Top row (right)
        board[whirlStart.r][whirlStart.c + i].classes = ['conveyor-east'];
        // Bottom row (left)
        board[whirlStart.r + whirlSize - 1][whirlStart.c + i].classes = ['conveyor-west'];
        // Left col (down)
        board[whirlStart.r + i][whirlStart.c].classes = ['conveyor-south'];
        // Right col (up)
        board[whirlStart.r + i][whirlStart.c + whirlSize - 1].classes = ['conveyor-north'];
    }

    // 6. Place repair stations strategically
    board[1][1].classes = ['repair-station']; // Start
    board[mazeStartRow + 1][mazeEndCol - 1].classes = ['repair-station']; // In the maze
    board[rows - 5][cols - 5].classes = ['repair-station']; // Across the chasm

    // 7. Add some gears
    board[whirlStart.r - 2][whirlStart.c + 2].classes = ['gear-cw'];
    board[whirlStart.r + whirlSize + 1][whirlStart.c + 2].classes = ['gear-ccw'];
    board[4][riverCol - 2].classes = ['gear-cw'];
    board[5][riverCol - 2].classes = ['gear-cw'];

    return board;
}


// Generate a larger board
const boardDataDefinition = createDemonstrationBoard(30, 40);

// --- Define starting position ---
const startRobotRow = 1;
const startRobotCol = 1;
const startRobotOrientation = 'east';

// --- Initialize Game on DOM Load ---
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        Logger.log("DOM Loaded. Initializing Robot Factory...");

        try {
            // Validate TILE_SYMBOLS against ALLOWED_TILE_CLASSES
            for (const key in Config.TILE_SYMBOLS) {
                // Skip 'repair-station' as it's a primary type, not a class for symbol lookup
                if (key === 'repair-station') continue;

                // For conveyor symbols, check the base class (e.g., 'conveyor-east' without '-speed-2x')
                const baseClass = key.replace('-speed-2x', '');
                if (!ALLOWED_TILE_CLASSES.has(baseClass)) {
                    throw new Error(`Invalid TILE_SYMBOLS key: '${key}'. It does not correspond to an allowed tile class.`);
                }
            }

            // 1. Process Board Data
            const boardData = Board.parseBoardObjectDefinition(boardDataDefinition);

            // 2. Initialize Robot State
            const robot = new Robot(startRobotRow, startRobotCol, startRobotOrientation);

            // --- 3. Perform Initial Station Check (Moved from setBoardData) ---
            const initialRobotStateForCheck = robot.getRobotState();
            const startTileData = Board.getTileData(initialRobotStateForCheck.row, initialRobotStateForCheck.col, boardData);
            if (startTileData && startTileData.classes.includes('repair-station')) {
                const key = `${initialRobotStateForCheck.row}-${initialRobotStateForCheck.col}`;
                Logger.log(`Robot starts on station ${key}. Updating state.`);
                robot.visitStation(key);
                robot.setLastVisitedStation(key);
                // UI update for this will happen via initial event emission later
            }
            // --- End Initial Station Check ---

            // 4. Initialize the UI (Canvas, Board, Flags, Robot Element)
            // This replaces initCanvas, renderBoard, createFlags, createRobot
            if (!UI.initializeUI(boardData)) {
                throw new Error("UI Initialization failed.");
            }

            // 5. Setup UI Listeners (Subscribes UI to future events)
            // This MUST happen AFTER initializeUI if listeners need DOM elements created by it,
            // and AFTER model init if listeners need initial state immediately (less common).
            UI.setupUIListeners(() => GameLoop.runProgramExecution(boardData, robot));

            // 6. Initialize Deck and Hand State
            Cards.initDeckAndHand(); // Emits events

            // 7. Trigger Initial Visual State Sync (Emit events NOW that UI is listening)
            Logger.log("Emitting initial state events for UI sync...");
            const initialRobotState = robot.getRobotState();

            // Emit robot position and orientation
            emit('robotMoved', { // Use 'robotMoved' as it updates position and orientation class
                row: initialRobotState.row,
                col: initialRobotState.col,
                orientation: initialRobotState.orientation
            });

            // Emit initial health
            emit('healthChanged', {
                health: initialRobotState.health,
                maxHealth: Config.MAX_HEALTH
            });
            // Emit starting flag visit status (if applicable)
            if (initialRobotState.lastVisitedStationKey) {
                emit('flagVisited', initialRobotState.lastVisitedStationKey);
            }
            // Emit initial counts explicitly after listeners are set up
            emit('cardCountsUpdated', {
                deck: Cards.getDeckSize(),
                discard: Cards.getDiscardSize(),
                hand: Cards.getHandSize()
           });

            Logger.log("Game Initialized Successfully.");

        } catch (error) {
            Logger.error("Error during game initialization:", error);
            alert("Failed to initialize the game. Please check the console for errors.");
        }
    });
}