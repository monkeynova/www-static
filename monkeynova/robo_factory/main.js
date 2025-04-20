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
        GameLoop.setBoardData(boardData); // Make board data available to game loop

        // 2. Create Board UI
        UI.createBoardUI(boardData, boardData.cols); // Pass cols for index calculation

        // 3. Initialize Robot State
        Robot.initRobot(startRobotRow, startRobotCol, startRobotOrientation);
        const initialRobotState = Robot.getRobotState();

        // 4. Initialize Deck and Hand State & Get Initial Hand Data
        const initialHandData = Cards.initDeckAndHand();

        // 5. Initial UI Updates
        // Place robot visually AFTER board UI is created
        UI.updateRobotVisualsUI(initialRobotState.row, initialRobotState.col, initialRobotState.orientation, boardData.cols);
        // Update hand UI with initial cards
        UI.updateHandUI(initialHandData);
        // Update health display
        UI.updateHealthUI(initialRobotState.health, Config.MAX_HEALTH);
        // Note: Starting flag indicator update is handled within GameLoop.setBoardData

        // 6. Setup Event Listeners (Drag/Drop, Buttons)
        // Pass the main game loop execution function as the callback for the run button
        UI.setupUIListeners(GameLoop.runProgramExecution);

        Logger.log("Game Initialized Successfully.");

    } catch (error) {
        Logger.error("Error during game initialization:", error);
        // Display error to user?
        alert("Failed to initialize the game. Please check the console for errors.");
    }
});
