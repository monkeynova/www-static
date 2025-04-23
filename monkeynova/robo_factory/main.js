// main.js
import * as Config from './config.js';
import * as Board from './board.js';
import * as Robot from './robot.js';
import * as Cards from './cards.js';
import * as UI from './ui.js';
import * as GameLoop from './gameLoop.js';
import * as Logger from './logger.js';
import { emit } from './eventEmitter.js';

// Each object: { type: 'char', walls: ['north'?, 'south'?, 'east'?, 'west'?] }
const boardDataDefinition = [
    // Row 0
    [ { classes: ['repair-station'], walls: ['north', 'west'] }, { classes: ['plain'], walls: ['north'] }, { classes: ['conveyor', 'right'], walls: ['north'] }, { classes: ['conveyor', 'right'], walls: ['north'] }, { classes: ['conveyor', 'right'], walls: ['north'] }, { classes: ['conveyor', 'right'], walls: ['north'] }, { classes: ['conveyor', 'right'], walls: ['north'] }, { classes: ['conveyor', 'down'], walls: ['north'] }, { classes: ['plain'], walls: ['north'] }, { classes: ['plain'], walls: ['north'] }, { classes: ['plain'], walls: ['north'] }, { classes: ['plain'], walls: ['north'] }, { classes: ['plain'], walls: ['north'] }, { classes: ['plain'], walls: ['north'] }, { classes: ['plain'], walls: ['north'] }, { classes: ['plain'], walls: ['north', 'east'] } ],
    // Row 1
    [ { classes: ['plain'], walls: ['west'] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: ['east'] },  { classes: ['hole'], walls: ['west'] },  { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'down'], walls: [] }, { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: ['east'] } ],
    // Row 2
    [ { classes: ['plain'], walls: ['west'] },          { classes: ['conveyor', 'up'], walls: [] }, { classes: ['conveyor', 'left'], walls: [] }, { classes: ['conveyor', 'left'], walls: [] }, { classes: ['conveyor', 'left'], walls: [] }, { classes: ['conveyor', 'left'], walls: [] }, { classes: ['conveyor', 'left'], walls: [] }, { classes: ['conveyor', 'down'], walls: [] }, { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'down'], walls: ['east'] } ],
    // Row 3
    [ { classes: ['plain'], walls: ['west'] },          { classes: ['conveyor', 'up'], walls: [] }, { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'down'], walls: [] }, { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['hole'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'down'], walls: ['east'] } ],
    // Row 4
    [ { classes: ['plain'], walls: ['west'] },          { classes: ['conveyor', 'up'], walls: [] }, { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'up'], walls: [] },   { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'down'], walls: ['east'] } ],
    // Row 5
    [ { classes: ['plain'], walls: ['west'] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['hole'], walls: [] },          { classes: ['conveyor', 'up'], walls: [] },   { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'left'], walls: [] }, { classes: ['conveyor', 'left'], walls: [] }, { classes: ['conveyor', 'left'], walls: [] }, { classes: ['conveyor', 'down'], walls: [] }, { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'down'], walls: ['east'] } ],
    // Row 6
    [ { classes: ['plain'], walls: ['west'] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'up'], walls: [] },   { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'down'], walls: [] }, { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'down'], walls: ['east'] } ],
    // Row 7
    [ { classes: ['plain'], walls: ['west'] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'up'], walls: [] },   { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'up'], walls: [] },   { classes: ['conveyor', 'down'], walls: [] }, { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'down'], walls: ['east'] } ],
    // Row 8
    [ { classes: ['plain'], walls: ['west'] },          { classes: ['plain'], walls: [] },          { classes: ['hole'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'up'], walls: [] },   { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: ['east'] } ],
    // Row 9
    [ { classes: ['plain'], walls: ['west'] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'up'], walls: [] },   { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: ['east'] } ],
    // Row 10
    [ { classes: ['plain'], walls: ['west'] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['plain'], walls: [] },          { classes: ['conveyor', 'up'], walls: [] },   { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'right'], walls: [] }, { classes: ['conveyor', 'right'], walls: ['east'] } ],
    // Row 11
    [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['repair-station'], walls: ['south', 'east'] } ]
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
        const boardData = Board.parseBoardObjectDefinition(boardDataDefinition);

        // 2. Initialize Robot State
        Robot.initRobot(startRobotRow, startRobotCol, startRobotOrientation);

        // 3. Set Board Data in Game Loop (Internal state)
        GameLoop.setBoardData(boardData);

        // 4. Setup Event Listeners in UI (BEFORE initial draw/sync)
        UI.setupUIListeners(GameLoop.runProgramExecution);

        // 5. Initialize Deck and Hand State
        const initialHandData = Cards.initDeckAndHand(); // Emits events

        // 6. Initialize Canvas
        if (!UI.initCanvas(boardData)) {
             throw new Error("Canvas initialization failed.");
        }

        // 7. Render Static Board on Canvas
        UI.renderBoard(boardData);

        // 8. Create Flag Indicator DOM Elements <<< NEW STEP
        UI.createFlagIndicatorsUI(boardData.repairStations);

        // 9. Create Robot DOM Element
        UI.createRobotElement();

        // --- 10. Emit Initial State Events (Replaces Direct UI Calls) ---
        Logger.log("Emitting initial state events for UI sync...");
        const initialRobotState = Robot.getRobotState();

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

        Logger.log("Game Initialized Successfully.");

    } catch (error) {
        Logger.error("Error during game initialization:", error);
        alert("Failed to initialize the game. Please check the console for errors.");
    }
});