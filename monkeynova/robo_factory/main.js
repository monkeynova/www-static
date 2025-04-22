// main.js
import * as Config from './config.js';
import * as Board from './board.js';
import * as Robot from './robot.js';
import * as Cards from './cards.js';
import * as UI from './ui.js';
import * as GameLoop from './gameLoop.js';
import * as Logger from './logger.js';
import { emit } from './eventEmitter.js';

// --- Define the board using objects ---
const boardRows = 12;
const boardCols = 17;
const boardDataDefinition = [];

// Helper to create a default tile object
function createTileObject(type = ' ', walls = []) {
    return { type, walls };
}

// Create the grid structure
for (let r = 0; r < boardRows; r++) {
    const row = [];
    for (let c = 0; c < boardCols; c++) {
        // Start with a plain tile, add walls later
        row.push(createTileObject(' '));
    }
    boardDataDefinition.push(row);
}

// --- Apply Tile Types from the old layout (for initial setup) ---
const oldLayout = [
    "R >>>>>v         ", "    O  v         ", " ^<<<<<v   >>>>v ",
    " ^     v  O    v ", " ^ >>>>^       v ", "      O^  <<<v v ",
    "       ^     v v ", "       ^ >>>^v v ", "  O        ^     ",
    "           ^     ", "           ^>>>> ", "                R"
];
for (let r = 0; r < boardRows; r++) {
    for (let c = 0; c < boardCols; c++) {
        if (oldLayout[r] && oldLayout[r][c]) {
            boardDataDefinition[r][c].type = oldLayout[r][c];
        }
    }
}

// --- Add Outer Boundary Walls ---
for (let c = 0; c < boardCols; c++) {
    boardDataDefinition[0][c].walls.push('north');       // Top edge
    boardDataDefinition[boardRows - 1][c].walls.push('south'); // Bottom edge
}
for (let r = 0; r < boardRows; r++) {
    boardDataDefinition[r][0].walls.push('west');        // Left edge
    boardDataDefinition[r][boardCols - 1].walls.push('east'); // Right edge
}

// --- Example: Add an Internal Wall ---
// Add a wall EAST of (1, 4) which is also WEST of (1, 5)
if (boardDataDefinition[1] && boardDataDefinition[1][4]) {
    boardDataDefinition[1][3].walls.push('east');
}
if (boardDataDefinition[1] && boardDataDefinition[1][5]) {
    boardDataDefinition[1][4].walls.push('west');
}

// --- Define starting position ---
// Could potentially find the first 'R' in the layout
const startRobotRow = 0;
const startRobotCol = 0;
const startRobotOrientation = 'east';

// --- Initialize Game on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
    Logger.log("DOM Loaded. Initializing Robot Factory...");

    try {
        // 1. Process Board Data
        const boardData = Board.parseBoardObjectDefinition(boardDataDefinition);

        // 2. Initialize Robot State (Do this BEFORE setBoardData needs it)
        Robot.initRobot(startRobotRow, startRobotCol, startRobotOrientation);

        // 3. Set Board Data in Game Loop (Updates internal state like visited stations)
        GameLoop.setBoardData(boardData); // Now only updates state

        // 4. Initialize Deck and Hand State
        const initialHandData = Cards.initDeckAndHand(); // Emits 'handUpdated' internally? If not, emit here.

        // 5. Setup Event Listeners in UI BEFORE initial UI updates
        UI.setupUIListeners(GameLoop.runProgramExecution, boardData);

        // 6. Create Board UI
        UI.createBoardUI(boardData, boardData.cols);

        // 6. Trigger Initial UI State Sync (Emit events or call UI functions once)
        emit('robotMoved', Robot.getRobotState()); // Assuming setPosition doesn't emit if no change
        emit('healthChanged', { health: Robot.getRobotState().health, maxHealth: Config.MAX_HEALTH });
        emit('handUpdated', initialHandData);
        if (Robot.getRobotState().lastVisitedStationKey) {
            emit('flagVisited', Robot.getRobotState().lastVisitedStationKey);
        }
        // Emit initial counts
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
