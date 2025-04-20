// main.js
import * as Config from './config.js';
import * as Board from './board.js';
import * as Robot from './robot.js';
import * as Cards from './cards.js';
import * as UI from './ui.js';
import * as GameLoop from './gameLoop.js';
import * as Logger from './logger.js';
import { emit } from './eventEmitter.js';

// --- Define the specific board for this game instance ---
const boardLayout = [
    //   0123456789ABCDEF
        "R >>>>>v         ", // 0
        "    O  v         ", // 1
        " ^<<<<<v   >>>>v ", // 2
        " ^     v  O    v ", // 3
        " ^ >>>>^       v ", // 4
        "      O^  <<<v v ", // 5
        "       ^     v v ", // 6
        "       ^ >>>^v v ", // 7
        "  O        ^     ", // 8
        "           ^     ", // 9
        "           ^>>>> ", // A (10)
        "                R"  // B (11)
];

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
        const boardData = Board.parseBoardLayout(boardLayout);

        // 2. Initialize Robot State (Do this BEFORE setBoardData needs it)
        Robot.initRobot(startRobotRow, startRobotCol, startRobotOrientation);

        // 3. Set Board Data in Game Loop (Updates internal state like visited stations)
        GameLoop.setBoardData(boardData); // Now only updates state

        // 4. Initialize Deck and Hand State
        const initialHandData = Cards.initDeckAndHand(); // Emits 'handUpdated' internally? If not, emit here.

        // ***** Setup Event Listeners in UI BEFORE initial UI updates *****
        // Pass boardData needed for listeners (e.g., gridCols)
        UI.setupUIListeners(GameLoop.runProgramExecution, boardData);

        // 5. Create Board UI (Now just creates structure)
        UI.createBoardUI(boardData, boardData.cols);

        // 6. Trigger Initial UI State Sync (Emit events or call UI functions once)
        emit('robotMoved', Robot.getRobotState()); // Assuming setPosition doesn't emit if no change
        emit('healthChanged', { health: Robot.getRobotState().health, maxHealth: Config.MAX_HEALTH });
        emit('handUpdated', initialHandData);
        if (Robot.getRobotState().lastVisitedStationKey) {
            emit('flagVisited', Robot.getRobotState().lastVisitedStationKey);
        }

        Logger.log("Game Initialized Successfully.");

    } catch (error) {
        Logger.error("Error during game initialization:", error);
        alert("Failed to initialize the game. Please check the console for errors.");
    }
});
