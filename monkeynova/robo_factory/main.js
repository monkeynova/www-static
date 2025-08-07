// main.js
import * as Config from './config.js';
import { Board, ALLOWED_TILE_CLASSES } from './board.js'; // Import for validation
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
export function createDemonstrationBoard(rows, cols) {
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
        board[r][riverCol].conveyor = { direction: 'south', speed: 1 };
        board[r][expressRiverCol].conveyor = { direction: 'south', speed: 2 };
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
        board[whirlStart.r][whirlStart.c + i].conveyor = { direction: 'east', speed: 1 };
        // Bottom row (left)
        board[whirlStart.r + whirlSize - 1][whirlStart.c + i].conveyor = { direction: 'west', speed: 1 };
        // Left col (down)
        board[whirlStart.r + i][whirlStart.c].conveyor = { direction: 'south', speed: 1 };
        // Right col (up)
        board[whirlStart.r + i][whirlStart.c + whirlSize - 1].conveyor = { direction: 'north', speed: 1 };
    }

    // 6. Place repair stations strategically
    board[1][1].classes = ['repair-station']; // Start
    board[mazeStartRow + 1][mazeEndCol - 1].classes = ['repair-station']; // In the maze
    board[rows - 5][cols - 5].classes = ['repair-station']; // Across the chasm

    // 7. Add some gears
    board[whirlStart.r - 2][whirlStart.c + 2].gear = 'cw';
    board[whirlStart.r + whirlSize + 1][whirlStart.c + 2].gear = 'ccw';
    board[4][riverCol - 2].gear = 'cw';
    board[5][riverCol - 2].gear = 'cw';

    // 8. Add some push panels (decorators)
    board[1][5].pusher = { direction: 'east', steps: [1, 3, 5] }; board[1][5].walls.push('west'); // Plain tile with push-east, needs west wall, fires on steps 1,3,5
    board[rows - 3][cols - 10].pusher = { direction: 'north', steps: [1, 2, 3, 4, 5] }; board[rows - 3][cols - 10].walls.push('south'); // Near bottom-right, push north, needs south wall, fires on all steps
    board[whirlStart.r][whirlStart.c + 1].pusher = { direction: 'south', steps: [2, 4] }; board[whirlStart.r][whirlStart.c + 1].walls.push('north'); // On a conveyor, push south, needs north wall, fires on steps 2,4
    board[whirlStart.r - 2][whirlStart.c + 2].pusher = { direction: 'west', steps: [1, 3, 5] }; board[whirlStart.r - 2][whirlStart.c + 2].walls.push('east'); // On a gear, push west, needs east wall, fires on steps 1,3,5

    // 9. Add some lasers
    // Basic laser firing east (on plain tile)
    board[10][5].laser = { direction: 'east' };
    board[10][5].walls.push('west'); // Changed from 'east' to 'west'

    // NEW: Laser near start for testing (at 1,2 firing south, attached to its north wall)
    board[1][2].laser = { direction: 'south' };
    board[1][2].walls.push('north');

    // Laser firing north, blocked by a wall (on plain tile)
    board[15][10].laser = { direction: 'north' };
    board[15][10].walls.push('south'); // Changed from 'north' to 'south'
    board[14][10].walls.push('north'); // Wall on the next tile, blocking the beam

    // Laser firing south, robot moves onto its path via conveyor (laser on a conveyor tile)
    board[20][15].conveyor = { direction: 'south', speed: 1 };
    board[20][15].laser = { direction: 'south' };
    board[20][15].walls.push('north'); // Changed from 'south' to 'north'
    board[19][15].conveyor = { direction: 'south', speed: 1 }; // Conveyor pushing robot onto this tile

    // Laser firing west, robot moves past its path via conveyor (laser on a gear tile)
    board[25][20].gear = 'cw';
    board[25][20].laser = { direction: 'west' };
    board[25][20].walls.push('east'); // Changed from 'west' to 'east'
    board[25][19].conveyor = { direction: 'east', speed: 1 }; // Conveyor pushing robot past laser

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
            

            // 1. Process Board Data
            const board = new Board(boardDataDefinition);

            // 2. Initialize Robot State
            const robot = new Robot(startRobotRow, startRobotCol, startRobotOrientation);
            const initialRobotState = robot.getRobotState(); // Define initialRobotState here

            // --- 3. Perform Initial Station Check (Moved from setBoardData) ---
            // Use the newly defined initialRobotState
            const startTileData = board.getTileData(initialRobotState.row, initialRobotState.col);
            if (startTileData && startTileData.classes.includes('repair-station')) {
                const key = `${initialRobotState.row}-${initialRobotState.col}`;
                Logger.log(`Robot starts on station ${key}. Updating state.`);
                robot.visitStation(key);
                robot.setLastVisitedStation(key);
                // UI update for this will happen via initial event emission later
            }
            // --- End Initial Station Check ---

            // 4. Initialize the UI (Canvas, Board, Flags, Robot Element)
            // This replaces initCanvas, renderBoard, createFlags, createRobot
            if (!UI.initializeUI(board, initialRobotState)) {
                throw new Error("UI Initialization failed.");
            }

            // 5. Setup UI Listeners (Subscribes UI to future events)
            // This MUST happen AFTER initializeUI if listeners need DOM elements created by it,
            // and AFTER model init if listeners need initial state immediately (less common).
            UI.setupUIListeners(() => GameLoop.runProgramExecution(board, robot), board, robot);

            // 6. Initialize Deck and Hand State
            Cards.initDeckAndHand(); // Emits events

            // 7. Trigger Initial Visual State Sync (Emit events NOW that UI is listening)
            Logger.log("Emitting initial state events for UI sync...");
            // initialRobotState is already defined and used above

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