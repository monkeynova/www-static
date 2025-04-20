// main.js
import * as Config from './config.js';
import * as Board from './board.js';
import * as Robot from './robot.js';
import * as Cards from './cards.js';
import * as UI from './ui.js';
import * as GameLoop from './gameLoop.js';
import * as Logger from './logger.js';

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

        // 4. Create Board UI (Creates flag indicators)
        UI.createBoardUI(boardData, boardData.cols);

        // 5. Initialize Deck and Hand State & Get Initial Hand Data
        const initialHandData = Cards.initDeckAndHand();

        // 6. Initial UI Updates
        const initialRobotState = Robot.getRobotState(); // Get state AFTER init
        // Place robot visually
        UI.updateRobotVisualsUI(initialRobotState.row, initialRobotState.col, initialRobotState.orientation, boardData.cols);
        // Update hand UI
        UI.updateHandUI(initialHandData);
        // Update health display
        UI.updateHealthUI(initialRobotState.health, Config.MAX_HEALTH);

        // --- NEW: Update starting flag indicator UI ---
        // Check if the robot's state indicates it started on a station
        if (initialRobotState.lastVisitedStationKey) {
            Logger.log(`Updating UI for starting station: ${initialRobotState.lastVisitedStationKey}`);
            UI.updateFlagIndicatorUI(initialRobotState.lastVisitedStationKey);
        }

        // 7. Setup Event Listeners
        UI.setupUIListeners(GameLoop.runProgramExecution);

        Logger.log("Game Initialized Successfully.");

    } catch (error) {
        Logger.error("Error during game initialization:", error);
        alert("Failed to initialize the game. Please check the console for errors.");
    }
});
