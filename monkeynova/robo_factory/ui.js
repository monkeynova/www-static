// ui.js
/**
 * =============================================================================
 * UI Module (View Layer) for Robot Factory Game
 * =============================================================================
 *
 * PRINCIPLE: Separation of Concerns (MVC - View)
 * This module is responsible ONLY for presenting the game state to the user
 * and capturing user input. It should be decoupled from the core game logic
 * (Model) and the main execution flow (Controller).
 *
 * INTERACTIONS:
 *  - Listens To: Events emitted by the Model (e.g., 'robotMoved', 'healthChanged',
 *    'handUpdated', 'gameOver') via the eventEmitter.
 *  - Updates: The DOM (HTML elements) and Canvas based on data received from events.
 *  - Captures: User input (button clicks, drag-and-drop).
 *  - Triggers: Controller actions (e.g., calling `runProgramExecution` from gameLoop.js`)
 *    or specific Model updates related to input (e.g., calling `Cards.addToHandData`
 *    after a drop event) in response to user input.
 *
 * RESPONSIBILITIES:
 *  - Creating/Updating DOM elements (robot div, cards in hand, status text, modals).
 *  - Rendering graphics onto the Canvas (board tiles, walls, lasers).
 *  - Setting up UI-specific event listeners (buttons, drag/drop targets).
 *  - Subscribing to relevant events from the eventEmitter to know *when* to update.
 *  - Displaying data provided via events.
 *
 * RESTRICTIONS (What this module SHOULD NOT DO):
 *  - DO NOT implement core game logic (e.g., calculating movement paths,
 *    determining damage, checking win/loss conditions, deck shuffling rules).
 *    This belongs in the Model (`robot.js`, `cards.js`, `board.js`) or
 *    Controller (`gameLoop.js`).
 *  - DO NOT directly modify the game state stored in other modules (e.g.,
 *    do not change `Robot.state.health` directly). State changes should happen
 *    within the Model modules, triggered by the Controller or Model logic itself.
 *  - DO NOT directly call functions in `gameLoop.js` or Model modules *except* 
 *    when forwarding a direct user input action (like the 'Run Program' button
 *    click calling `runProgramExecution`, or a drop event calling card state updates).
 *
 * GUIDANCE FOR FUTURE CHANGES:
 *  - To display new game state information:
 *      1. Ensure the Model emits an event with the necessary data when that state changes.
 *      2. Add a listener for that event in `subscribeToModelEvents` within this module.
 *      3. Create or update a function here to modify the DOM/Canvas accordingly.
 *  - To add new user interactions:
 *      1. Add the necessary HTML elements.
 *      2. Set up an event listener for the interaction in `setupUIListeners`.
 *      3. In the listener's callback, call the appropriate function in the
 *         Controller (`gameLoop.js`) or Model (`cards.js`, `robot.js`) to
 *         handle the *consequence* of that user action.
 *
 * NECESSARY EXPORTS:
 *  - Initialization Function(s): A function (e.g., `initializeUI`) that sets up
 *    the canvas, renders the initial static board, creates necessary DOM
 *    elements (like the robot, flag indicators), etc. This is called once by `main.js`.
 *  - Listener Setup Function: A function (e.g., `setupUIListeners`) that attaches
 *    event listeners to interactive UI elements (buttons, drag/drop zones) and
 *    subscribes internal UI update functions to events from the Model via the
 *    eventEmitter. This connects user actions to the Controller and Model updates
 *    to the View.
 *
 * DISCOURAGED / FORBIDDEN EXPORTS:
 *  - Specific Update Functions: Functions like `updateRobotVisualsUI`, `updateHandUI`,
 *    `updateHealthUI`, `showModalUI`, `resetProgramSlotsUI`, etc., should generally
 *    NOT be exported. Their execution should be triggered *internally* within this
 *    module in response to events received from the eventEmitter. Exporting them
 *    allows external modules to directly manipulate the UI, bypassing the event system
 *    and violating the MVC separation.
 *  - Internal Helper Functions: Any functions used solely within `ui.js` should
 *    not be exported.
 *
 * RATIONALE:
 * By limiting exports, we ensure that:
 *  1. The primary way the UI updates is by reacting to state changes announced via events.
 *  2. The internal implementation details of how the UI renders state are hidden
 *     (encapsulated) within this module.
 *  3. Other modules cannot accidentally (or intentionally) cause UI inconsistencies
 *     by calling update functions directly at the wrong time or with incorrect data.
 *
 * =============================================================================
 */

import * as Config from './config.js';
import { Board } from './board.js'; // Need this for tile/wall data
import { on } from './eventEmitter.js';
import * as Logger from './logger.js';
// Card imports remain if needed for drag/drop state updates
import { getCardData, removeFromHandData, addToHandData } from './cards.js';
import * as TestRunner from './testRunner.js'; // Import the test runner

// --- DOM Element References (initialized in cacheDOMElements) ---
let cardHandContainer = null;
let programSlots = [];
let programSlotsContainer = null;
let runProgramButton = null;
let flagStatusContainer = null;
let healthValueEl = null;
let maxHealthValueEl = null;
let modal = null;
let modalTitleEl = null;
let modalMessageEl = null;
let modalCloseButton = null;
let debugTrigger = null;
let debugModal = null;
let debugDeckCount = null;
let debugDiscardCount = null;
let debugHandCount = null;
let debugCloseButton = null;
let debugLogOutput = null;
let boardContainer = null;
let boardCanvas = null;
let boardScrollArea = null;
let runTestsButton = null;
let zoomInButton = null;
let zoomOutButton = null;
let zoomLevelDisplay = null;

/**
 * Caches references to all necessary DOM elements.
 * This function should only be called when the DOM is fully loaded.
 */
function cacheDOMElements() {
    cardHandContainer = document.getElementById('card-hand');
    programSlots = document.querySelectorAll('#program-slots .program-slot');
    programSlotsContainer = document.getElementById('program-slots');
    runProgramButton = document.getElementById('run-program');
    flagStatusContainer = document.getElementById('flag-status');
    healthValueEl = document.getElementById('health-value');
    maxHealthValueEl = document.getElementById('max-health-value');
    modal = document.getElementById('end-game-modal');
    modalTitleEl = document.getElementById('modal-title');
    modalMessageEl = document.getElementById('modal-message');
    modalCloseButton = document.getElementById('modal-close-button');
    debugTrigger = document.getElementById('debug-trigger');
    debugModal = document.getElementById('debug-modal');
    debugDeckCount = document.getElementById('debug-deck-count');
    debugDiscardCount = document.getElementById('debug-discard-count');
    debugHandCount = document.getElementById('debug-hand-count');
    debugCloseButton = document.getElementById('debug-close-button');
    debugLogOutput = document.getElementById('debug-log-output');
    boardContainer = document.getElementById('board-container');
    boardCanvas = document.getElementById('board-canvas');
    boardScrollArea = document.getElementById('board-scroll-area');
    runTestsButton = document.getElementById('run-tests-button');
    zoomInButton = document.getElementById('zoom-in-button');
    zoomOutButton = document.getElementById('zoom-out-button');
    zoomLevelDisplay = document.getElementById('zoom-level');
    Logger.log("DOM elements cached.");
}


// --- Canvas / Rendering State ---
let ctx = null; // Canvas 2D context
let robotElement = null; // Reference to the robot DOM element
let draggedCardElement = null; // Track dragged DOM element during drag event
let wallStripePattern = null; // Store the created pattern
let zoomLevel = 1.0; // NEW: Zoom level state
const ZOOM_INCREMENT = 0.1;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;

/**
 * Initializes the entire game UI (canvas, static board, indicators, robot element).
 * Should be called once during application startup.
 * @param {object} boardData - Parsed board data.
 * @returns {boolean} True if initialization was successful, false otherwise.
 */
export function initializeUI(boardData, initialRobotState) {
    Logger.log("Initializing UI...");
    cacheDOMElements(); // Corrected function name
    if (!initCanvas(boardData)) return false; // Init canvas size/context
    renderStaticBoardElements(boardData);   // Draw static board elements
    createFlagIndicatorsUI(boardData.repairStations); // Create flag DOM elements
    createRobotElement();                   // Create robot DOM element
    applyZoom();                            // NEW: Apply initial zoom
    drawLaserBeams(boardData, initialRobotState); // Initial draw of laser beams
    Logger.log("UI Initialization complete.");
    return true;
}

/** Initialize Canvas dimensions and context */
export function initCanvas(boardData) {
    if (!boardCanvas) {
        Logger.error("Canvas element not found!");
        return false;
    }
    try {
        ctx = boardCanvas.getContext('2d');
        if (!ctx) {
             Logger.error("Failed to get 2D context from canvas!");
             return false;
        }
        boardCanvas.width = boardData.cols * Config.TILE_SIZE;
        boardCanvas.height = boardData.rows * Config.TILE_SIZE;
        Logger.log(`Canvas initialized to ${boardCanvas.width}x${boardCanvas.height}`);

        // --- Create Wall Stripe Pattern ---
        const patternCanvas = document.createElement('canvas');
        const patternCtx = patternCanvas.getContext('2d');
        const patternSize = 8; // Match the gradient repeat size
        patternCanvas.width = patternSize;
        patternCanvas.height = patternSize;

        // Draw the pattern onto the small canvas (adjust colors/size)
        patternCtx.fillStyle = '#333333'; // Background color of pattern
        patternCtx.fillRect(0, 0, patternSize, patternSize);
        patternCtx.strokeStyle = '#FFD700'; // Stripe color
        patternCtx.lineWidth = 1.5; // Adjust for desired stripe thickness
        patternCtx.beginPath();
        // Draw diagonal lines for the pattern
        for (let i = -patternSize; i < patternSize * 2; i += 4) { // Adjust spacing (4px here)
             patternCtx.moveTo(i, -1);
             patternCtx.lineTo(i + patternSize + 1, patternSize + 1);
        }
        patternCtx.stroke();
        wallStripePattern = ctx.createPattern(patternCanvas, 'repeat');
        Logger.log("Wall stripe pattern created.");
        // --- End Pattern Creation ---

        return true;
    } catch (error) {
        Logger.error("Error initializing canvas:", error);
        return false;
    }
}

/**
 * Draws all laser beams dynamically, considering the robot's current position.
 * This function should be called whenever the robot moves.
 * @param {object} boardData - The parsed board data.
 * @param {object} robotState - The current state of the robot (row, col, orientation).
 */
function drawLaserBeams(boardData, robotState) {
    if (!ctx || !boardData) {
        Logger.error("Cannot draw laser beams: Missing context or board data.");
        return;
    }

    // Clear only the area where lasers might be drawn. This is tricky without a separate canvas.
    // For simplicity, we'll clear the entire canvas and redraw static elements, then dynamic.
    // A more optimized approach would use multiple canvases or track dirty regions.
    // For now, let's just clear and redraw the static board elements first.
    // This is a temporary measure until a more robust layering/clearing strategy is implemented.
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height); // Clear previous frame
    renderStaticBoardElements(boardData); // Redraw everything *except* dynamic elements

    const styles = getComputedStyle(document.documentElement);
    const wallThickness = parseInt(styles.getPropertyValue('--wall-thickness').trim()) || 3;

    ctx.strokeStyle = 'red'; // Laser beam color
    ctx.lineWidth = 2; // Laser beam thickness

    for (let r = 0; r < boardData.rows; r++) {
        for (let c = 0; c < boardData.cols; c++) {
            const tileData = boardData.getTileData(r, c);
            if (!tileData || !tileData.laserDirection) continue;

            const x = c * Config.TILE_SIZE;
            const y = r * Config.TILE_SIZE;
            const centerX = x + Config.TILE_SIZE / 2;
            const centerY = y + Config.TILE_SIZE / 2;

            // Pass robotState to getLaserPath for dynamic termination
            const laserPath = boardData.getLaserPath(r, c, tileData.laserDirection, robotState);
            if (laserPath.length > 0) { // Only draw if there's a path
                ctx.beginPath();

                let startBeamX = centerX;
                let startBeamY = centerY;

                // Adjust starting point to be on the edge of the tile where the laser is attached, firing outwards
                switch (tileData.laserDirection) {
                    case 'north':
                        startBeamY = y + Config.TILE_SIZE; // Start from bottom edge (south wall)
                        break;
                    case 'south':
                        startBeamY = y; // Start from top edge (north wall)
                        break;
                    case 'east':
                        startBeamX = x; // Start from left edge (west wall)
                        break;
                    case 'west':
                        startBeamX = x + Config.TILE_SIZE; // Start from right edge (east wall)
                        break;
                }
                Logger.log(`Laser at (${r},${c}) firing ${tileData.laserDirection}. Calculated start: (${startBeamX}, ${startBeamY})`);

                ctx.moveTo(startBeamX, startBeamY);

                let currentBeamX = startBeamX;
                let currentBeamY = startBeamY;

                for (let i = 0; i < laserPath.length; i++) {
                    const pathTile = laserPath[i];
                    const pathTileX = pathTile.col * Config.TILE_SIZE;
                    const pathTileY = pathTile.row * Config.TILE_SIZE;

                    let targetBeamX = pathTileX + Config.TILE_SIZE / 2;
                    let targetBeamY = pathTileY + Config.TILE_SIZE / 2;

                    // Determine if this is the last segment (hitting a wall or robot)
                    const isLastSegment = (i === laserPath.length - 1);

                    if (isLastSegment) {
                        if (robotState && pathTile.row === robotState.row && pathTile.col === robotState.col) {
                            // If the last tile is the robot, draw to its edge
                            const robotStyle = getComputedStyle(robotElement);
                            const robotWidth = parseInt(robotStyle.width) || 35;
                            const robotHeight = parseInt(robotStyle.height) || 35;

                            switch (tileData.laserDirection) {
                                case 'north':
                                    targetBeamY = pathTileY + Config.TILE_SIZE - (Config.TILE_SIZE - robotHeight) / 2; // Bottom edge of robot
                                    break;
                                case 'south':
                                    targetBeamY = pathTileY + (Config.TILE_SIZE - robotHeight) / 2; // Top edge of robot
                                    break;
                                case 'east':
                                    targetBeamX = pathTileX + (Config.TILE_SIZE - robotWidth) / 2; // Left edge of robot
                                    break;
                                case 'west':
                                    targetBeamX = pathTileX + Config.TILE_SIZE - (Config.TILE_SIZE - robotWidth) / 2; // Right edge of robot
                                    break;
                            }
                            Logger.log(`  Beam ends at robot (${pathTile.row},${pathTile.col}). Calculated end: (${targetBeamX}, ${targetBeamY})`);
                        } else { // Terminate on the wall
                            switch (tileData.laserDirection) {
                                case 'north':
                                    targetBeamY = pathTileY; // Top edge of tile (wall)
                                    break;
                                case 'south':
                                    targetBeamY = pathTileY + Config.TILE_SIZE; // Bottom edge of tile (wall)
                                    break;
                                case 'east':
                                    targetBeamX = pathTileX + Config.TILE_SIZE; // Right edge of tile (wall)
                                    break;
                                case 'west':
                                    targetBeamX = pathTileX; // Left edge of tile (wall)
                                    break;
                            }
                            Logger.log(`  Beam ends at wall (${pathTile.row},${pathTile.col}). Calculated end: (${targetBeamX}, ${targetBeamY})`);
                        }
                    } else {
                        // For intermediate tiles, draw to the edge of the current tile, towards the next
                        switch (tileData.laserDirection) {
                            case 'north':
                                targetBeamY = pathTileY; // Top edge of current tile
                                break;
                            case 'south':
                                targetBeamY = pathTileY + Config.TILE_SIZE; // Bottom edge of current tile
                                break;
                            case 'east':
                                targetBeamX = pathTileX + Config.TILE_SIZE; // Right edge of current tile
                                break;
                            case 'west':
                                targetBeamX = pathTileX; // Left edge of current tile
                                break;
                        }
                    }
                    ctx.lineTo(targetBeamX, targetBeamY);
                    currentBeamX = targetBeamX;
                    currentBeamY = targetBeamY;
                }
                ctx.stroke();
            }
        }
    }
}

/** Renders only the static board elements (tiles, walls, grid) onto the canvas */
function renderStaticBoardElements(boardData) {
    if (!ctx || !boardData) {
        Logger.error("Cannot render static board elements: Missing context or board data.");
        return;
    }
    // Logger.log("Rendering static board elements to canvas..."); // Avoid excessive logging

    // --- Get computed styles for colors (more robust than hardcoding) ---
    const styles = getComputedStyle(document.documentElement);
    const plainColor = styles.getPropertyValue('--tile-plain-color').trim() || '#eee';
    const conveyorColor = styles.getPropertyValue('--tile-conveyor-color').trim() || '#aaddff';
    const repairColor = styles.getPropertyValue('--tile-repair-color').trim() || '#90ee90';
    const holeColor = styles.getPropertyValue('--tile-hole-color').trim() || '#222';
    const gearColor = styles.getPropertyValue('--tile-gear-color').trim() || '#d8bfd8';
    const laserColor = styles.getPropertyValue('--tile-laser-color').trim() || '#ffcccc'; // NEW: Laser color
    const wallThickness = parseInt(styles.getPropertyValue('--wall-thickness').trim()) || 3;
    // Use pattern if available, otherwise fallback color
    const wallFill = wallStripePattern || styles.getPropertyValue('--wall-solid-color').trim() || '#630';
    const gridLineColor = '#cccccc'; // Define light grey for grid lines

    // --- Draw Tiles ---
    for (let r = 0; r < boardData.rows; r++) {
        for (let c = 0; c < boardData.cols; c++) {
            const tileData = boardData.getTileData(r, c);
            if (!tileData) continue;

            const x = c * Config.TILE_SIZE;
            const y = r * Config.TILE_SIZE;

            // 1. Draw Tile Background Color
            switch (tileData.primaryType) {
                case 'repair-station': ctx.fillStyle = repairColor; break;
                case 'hole': ctx.fillStyle = holeColor; break;
                case 'conveyor': ctx.fillStyle = conveyorColor; break;
                case 'gear-cw': case 'gear-ccw': ctx.fillStyle = gearColor; break;
                case 'plain': default: ctx.fillStyle = plainColor; break;
            }
            ctx.fillRect(x, y, Config.TILE_SIZE, Config.TILE_SIZE);

            // 2. Draw Symbols (Optional - can be kept in CSS if preferred)
            ctx.fillStyle = '#333'; // Symbol color
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const centerX = x + Config.TILE_SIZE / 2;
            const centerY = y + Config.TILE_SIZE / 2;

            let symbol = '';
            const isSpeed2x = tileData.classes.includes('speed-2x');

            if (tileData.classes.includes('repair-station')) {
                symbol = Config.TILE_SYMBOLS['repair-station'] || '🔧';
            } else if (tileData.classes.includes('gear-cw')) {
                symbol = Config.TILE_SYMBOLS['gear-cw'] || '↻';
            } else if (tileData.classes.includes('gear-ccw')) {
                symbol = Config.TILE_SYMBOLS['gear-ccw'] || '↺';
            } else if (tileData.primaryType === 'conveyor') {
                const symbolKey = `conveyor-${tileData.conveyorDirection}${isSpeed2x ? '-speed-2x' : ''}`;
                symbol = Config.TILE_SYMBOLS[symbolKey] || ''; // Fallback to empty string if symbol not found
            }

            if (symbol) {
               ctx.fillText(symbol, centerX, centerY);
            }

            // NEW: Draw Laser Symbol (if present, on top of other tile visuals)
            if (tileData.laserDirection) {
                const laserSymbol = Config.TILE_SYMBOLS[tileData.laserDirection] || '';
                if (laserSymbol) {
                    ctx.fillStyle = '#FFFF00'; // Bright yellow for laser symbol
                    ctx.font = '30px sans-serif'; // Larger font size

                    let symbolX = centerX;
                    let symbolY = centerY;

                    // Adjust symbol position to be on the wall it's attached to
                    switch (tileData.laserDirection) {
                        case 'north': // Attached to south wall
                            symbolY = y + Config.TILE_SIZE - (Config.TILE_SIZE / 4); // Near bottom edge
                            break;
                        case 'south': // Attached to north wall
                            symbolY = y + (Config.TILE_SIZE / 4); // Near top edge
                            break;
                        case 'east': // Attached to west wall
                            symbolX = x + (Config.TILE_SIZE / 4); // Near left edge
                            break;
                        case 'west': // Attached to east wall
                            symbolX = x + Config.TILE_SIZE - (Config.TILE_SIZE / 4); // Near right edge
                            break;
                    }
                    ctx.fillText(laserSymbol, symbolX, symbolY);
                    // No need to reset fillStyle here, it will be set for the next tile or grid lines
                }
            }
        }
    }

    // Reset fillStyle and font for subsequent drawings (grid lines, walls)
    ctx.fillStyle = '#333'; // Default symbol color
    ctx.font = '24px sans-serif'; // Default font size

    ctx.strokeStyle = gridLineColor;
    ctx.lineWidth = 1;
    ctx.beginPath(); // Start a new path for all grid lines

    // Draw horizontal lines (skip first row)
    for (let r = 1; r < boardData.rows; r++) {
        const y = r * Config.TILE_SIZE;
        ctx.moveTo(0, y - 0.5); // Use -0.5 for sharper lines on some displays
        ctx.lineTo(boardCanvas.width, y - 0.5);
    }

    // Draw vertical lines (skip first column)
    for (let c = 1; c < boardData.cols; c++) {
        const x = c * Config.TILE_SIZE;
        ctx.moveTo(x - 0.5, 0);
        ctx.lineTo(x - 0.5, boardCanvas.height);
    }

    ctx.stroke(); // Draw all the lines added to the path

    // --- Draw Walls (Draw AFTER all tiles for correct layering) ---
    ctx.fillStyle = wallFill;
    for (let r = 0; r < boardData.rows; r++) {
        for (let c = 0; c < boardData.cols; c++) {
             const tileData = boardData.getTileData(r, c);
             if (!tileData || !tileData.walls) continue;

             const x = c * Config.TILE_SIZE;
             const y = r * Config.TILE_SIZE;

             if (tileData.walls.includes('north')) {
                 ctx.fillRect(x, y, Config.TILE_SIZE, wallThickness);
             }
             if (tileData.walls.includes('south')) {
                 // Draw slightly offset so it doesn't overlap tile below's north wall
                 ctx.fillRect(x, y + Config.TILE_SIZE - wallThickness, Config.TILE_SIZE, wallThickness);
             }
             if (tileData.walls.includes('west')) {
                 ctx.fillRect(x, y, wallThickness, Config.TILE_SIZE);
             }
             if (tileData.walls.includes('east')) {
                 // Draw slightly offset
                 ctx.fillRect(x + Config.TILE_SIZE - wallThickness, y, wallThickness, Config.TILE_SIZE);
             }
        }
    }
    Logger.log("Board rendering complete.");

    // --- Draw Laser Emitters (Draw AFTER walls for correct layering) ---
    ctx.fillStyle = '#8B0000'; // Dark red for the emitter
    const emitterSize = Config.TILE_SIZE / 4; // Size of the emitter square
    // const styles = getComputedStyle(document.documentElement); // REMOVED: Already declared above
    // const wallThickness = parseInt(styles.getPropertyValue('--wall-thickness').trim()) || 3; // Get wall thickness - REMOVED: Already declared above

    for (let r = 0; r < boardData.rows; r++) {
        for (let c = 0; c < boardData.cols; c++) {
            const tileData = boardData.getTileData(r, c);
            if (!tileData || !tileData.laserDirection) continue;

            const x = c * Config.TILE_SIZE;
            const y = r * Config.TILE_SIZE;
            const centerX = x + Config.TILE_SIZE / 2;
            const centerY = y + Config.TILE_SIZE / 2;

            let emitterX = x, emitterY = y;

            // Position the emitter on the wall it's attached to, which is opposite the firing direction.
            switch (tileData.laserDirection) {
                case 'north': // Laser fires north, emitter is on the south wall of this tile
                    emitterX = centerX - emitterSize / 2;
                    emitterY = y + Config.TILE_SIZE - emitterSize;
                    break;
                case 'south': // Laser fires south, emitter is on the north wall of this tile
                    emitterX = centerX - emitterSize / 2;
                    emitterY = y;
                    break;
                case 'east': // Laser fires east, emitter is on the west wall of this tile
                    emitterX = x;
                    emitterY = centerY - emitterSize / 2;
                    break;
                case 'west': // Laser fires west, emitter is on the east wall of this tile
                    emitterX = x + Config.TILE_SIZE - emitterSize;
                    emitterY = centerY - emitterSize / 2;
                    break;
            }
            ctx.fillRect(emitterX, emitterY, emitterSize, emitterSize);
        }
    }
}

/** Creates the flag indicator DOM elements */
export function createFlagIndicatorsUI(repairStations) {
    if (!flagStatusContainer) {
        Logger.error("UI Error: Flag status container not found.");
        return;
    }
    // Clear any previous indicators
    flagStatusContainer.querySelectorAll('.flag-indicator').forEach(el => el.remove());

    if (!repairStations || repairStations.length === 0) {
        Logger.warn("UI: No repair stations found in board data to create indicators for.");
        return;
    }

    Logger.log(`UI: Creating indicators for ${repairStations.length} stations.`);
    repairStations.forEach(station => {
        const stationKey = `${station.row}-${station.col}`;
        const indicator = document.createElement('div');
        indicator.classList.add('flag-indicator');
        indicator.dataset.stationKey = stationKey; // Link indicator to station data
        // Use symbol from config if available, otherwise fallback
        const symbol = Config.TILE_SYMBOLS ? (Config.TILE_SYMBOLS['repair-station'] || '🔧') : '🔧';
        indicator.textContent = symbol;
        flagStatusContainer.appendChild(indicator);
    });
}

/** Creates the robot DOM element and appends it to the container */
export function createRobotElement() {
    if (robotElement) { // Avoid creating multiple robots
        robotElement.remove();
    }
    robotElement = document.createElement('div');
    robotElement.id = 'robot-element'; // Assign an ID
    robotElement.className = 'robot'; // Use class for base styling

    // Add orientation indicator structure if needed (CSS handles the ::before)

    if (boardContainer) {
        boardContainer.appendChild(robotElement);
        Logger.log("Robot DOM element created.");
    } else {
        Logger.error("Cannot create robot element: boardContainer not found.");
    }
}

/**
 * Updates the robot's position and orientation in the UI (DOM element).
 * @param {number} row
 * @param {number} col
 * @param {string} orientation
 */
function updateRobotVisualsUI(row, col, orientation) {
    if (!robotElement) {
        Logger.error("UI Error: Robot element not ready for update.");
        return;
    }

    // Calculate pixel position (top-left corner of the robot)
    const robotStyle = getComputedStyle(robotElement);
    const robotWidth = parseInt(robotStyle.width) || 35; // Get actual size
    const robotHeight = parseInt(robotStyle.height) || 35;

    // Center the robot within the tile
    const targetX = col * Config.TILE_SIZE + (Config.TILE_SIZE - robotWidth) / 2;
    const targetY = row * Config.TILE_SIZE + (Config.TILE_SIZE - robotHeight) / 2;

    // Apply styles
    robotElement.style.left = `${targetX}px`;
    robotElement.style.top = `${targetY}px`;

    // Update orientation class for rotation (CSS handles ::before rotation)
    robotElement.className = `robot facing-${orientation}`; // Reset classes and add current

    // Logger.log(`UI: Moved robot to (${row}, ${col}), facing ${orientation}`);
}

// --- UI Update Functions ---

/**
 * Updates the card hand display based on provided card data.
 * @param {object[]} handCardsData - Array of card data objects from cards.js.
 */
function updateHandUI(handCardsData) {
    cardHandContainer.innerHTML = ''; // Clear current UI cards
    if (!handCardsData) {
        Logger.warn("updateHandUI called with null/undefined hand data.");
        return;
    }
    handCardsData.forEach(cardData => {
        const cardElement = document.createElement('div');
        cardElement.id = cardData.instanceId;
        cardElement.classList.add('card', cardData.type);
        cardElement.draggable = true;
        cardElement.textContent = cardData.text;
        addDragHandlersToCardElement(cardElement);
        cardHandContainer.appendChild(cardElement);
    });
    Logger.log("Hand UI updated via event.");
}

/** Clears program slots and shows numbers. */
function resetProgramSlotsUI() {
    programSlots.forEach((slot, index) => {
        slot.innerHTML = `${index + 1}`;
        slot.className = 'program-slot drop-zone'; // Reset classes, keep drop-zone
    });
    // Logger.log("Program slots UI reset.");
}

/** Updates the health display. */
function updateHealthUI(health, maxHealth) {
    if (healthValueEl && maxHealthValueEl) {
        healthValueEl.textContent = health;
        maxHealthValueEl.textContent = maxHealth;
        healthValueEl.classList.toggle('full', health === maxHealth);
    }
}

/** Marks a flag indicator as visited. */
function updateFlagIndicatorUI(stationKey) {
    const indicator = flagStatusContainer.querySelector(`.flag-indicator[data-station-key="${stationKey}"]`);
    if (indicator) {
        indicator.classList.add('visited');
    } else {
        Logger.warn(`UI: Could not find flag indicator for key ${stationKey}`);
    }
}

/** Shows the end game modal. */
function showModalUI(isWin) {
    if (modal && modalTitleEl && modalMessageEl) {
        modalTitleEl.textContent = isWin ? "You Win!" : "Robot Destroyed!";
        modalTitleEl.className = isWin ? 'win' : 'loss'; // Add class for styling
        modalMessageEl.textContent = isWin ? "Congratulations! You visited all repair stations!" : "Your robot ran out of health.";
        modal.style.display = 'flex'; // Show modal
    }
}

/** Hides the end game modal. */
function hideModalUI() {
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Updates the card counts in the debug modal.
 * @param {object} counts - Object like { deck, discard, hand }.
 */
function updateDebugCountsUI(counts) {
    if (debugDeckCount && debugDiscardCount && debugHandCount) {
        debugDeckCount.textContent = counts.deck;
        debugDiscardCount.textContent = counts.discard;
        debugHandCount.textContent = counts.hand;
    }
}

/** Shows the debug modal and updates its content. */
function showDebugModal() {
    if (debugModal && debugLogOutput) { // Check only needed elements
        const history = Logger.getHistory();
        debugLogOutput.textContent = history.slice().reverse().join('\n');
        debugLogOutput.scrollTop = 0;

        debugModal.style.display = 'flex';
    } else {
        console.error("Debug modal elements not found!");
    }
}

/** Hides the debug modal. */
function hideDebugModal() {
    if (debugModal) {
        debugModal.style.display = 'none';
    }
}

/** Enables or disables the Run Program button. */
function updateButtonStateUI(isEnabled) {
    runProgramButton.disabled = !isEnabled;
}

// --- UI Helpers ---

/** NEW: Applies the current zoom level to the board container */
function applyZoom() {
    if (boardContainer && zoomLevelDisplay) {
        boardContainer.style.transform = `scale(${zoomLevel})`;
        boardContainer.style.transformOrigin = 'top left';
        zoomLevelDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
}

// --- Drag and Drop Handlers ---

function addDragHandlersToCardElement(cardElement) {
    cardElement.addEventListener('dragstart', handleDragStart);
    cardElement.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    draggedCardElement = e.target; // Store the element being dragged
    e.dataTransfer.setData('text/plain', draggedCardElement.id); // Use instanceId
    // Use timeout to ensure drag image is created before style change
    setTimeout(() => {
        if(draggedCardElement) draggedCardElement.classList.add('dragging');
    }, 0);
}

function handleDragEnd(e) {
    // Cleanup style, regardless of drop success
    if (draggedCardElement) {
        draggedCardElement.classList.remove('dragging');
    }
    draggedCardElement = null; // Clear reference
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
}

function handleDragEnter(e) {
    e.preventDefault();
    const target = e.target.closest('.program-slot, #card-hand');
    if (target) {
        target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const target = e.target.closest('.program-slot, #card-hand');
    // Check if the relatedTarget (where the mouse entered) is still within the drop target
    if (target && !target.contains(e.relatedTarget)) {
         target.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const dropTarget = e.target.closest('.program-slot, #card-hand');

    // Ensure we have the element that was actually dragged (from dragstart)
    if (!dropTarget) {
         Logger.warn("Drop failed: No drop target.");
         // Ensure dragging class is removed if dragend didn't fire correctly
         if(draggedCardElement) draggedCardElement.classList.remove('dragging');
         draggedCardElement = null;
         return;
    }
    if (!draggedCardElement) {
        Logger.warn("Drop failed: No dragged element reference.");
        // Ensure dragging class is removed if dragend didn't fire correctly
        if(draggedCardElement) draggedCardElement.classList.remove('dragging');
        draggedCardElement = null;
        return;
   }

    dropTarget.classList.remove('drag-over'); // Remove highlight

    const cardInstanceId = e.dataTransfer.getData('text/plain');
    // It's safer to use the reference stored in dragstart
    const cardElement = draggedCardElement; // Use the stored element reference

    if (!cardElement || cardElement.id !== cardInstanceId) {
         Logger.error("Drop error: Mismatch between dragged element and dataTransfer ID.");
         if(draggedCardElement) draggedCardElement.classList.remove('dragging');
         draggedCardElement = null;
         return;
    }


    const originWasHand = cardElement.parentElement.id === 'card-hand';

    // --- Logic for dropping ---

    // --- Logic for dropping ---
    if (dropTarget.classList.contains('program-slot')) {
        const existingCard = dropTarget.querySelector('.card');
        if (!existingCard || existingCard === cardElement) {
            if (existingCard !== cardElement) {
                dropTarget.innerHTML = '';
                dropTarget.appendChild(cardElement); // Move element visually
                // Update card data state (remove from hand) - This will trigger events
                if (originWasHand) {
                    removeFromHandData(cardInstanceId); // Let cards.js emit events
                }
            }
        } else {
            Logger.log('Slot occupied by a different card, drop prevented.');
        }
    } else if (dropTarget.id === 'card-hand') {
        if (!originWasHand) {
            cardHandContainer.appendChild(cardElement); // Move element visually
            // Update card data state (add back to hand) - This will trigger events
            addToHandData(cardInstanceId); // Let cards.js emit events
        } else {
            cardHandContainer.appendChild(cardElement); // Ensure visually back
        }
    }

    // Final cleanup is handled by dragend
    checkProgramReady(); // Update run button state after any drop
}

/** Checks if program slots are full and updates button state. */
function checkProgramReady() {
    let filledSlots = 0;
    programSlots.forEach(slot => {
        if (slot.querySelector('.card')) {
            filledSlots++;
        }
    });
    updateButtonStateUI(filledSlots === Config.PROGRAM_SIZE);
}

// --- Event Listener Setup ---
/**
 * Sets up all static UI event listeners.
 * @param {Function} runProgramCallback - Function to call when Run button is clicked.
 */
export function setupUIListeners(runProgramCallback, boardData) { // Pass boardData
    // Attach drop listeners to static containers
    const dropZones = [cardHandContainer, ...programSlots];
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('dragenter', handleDragEnter);
        zone.addEventListener('dragleave', handleDragLeave);
        zone.addEventListener('drop', handleDrop);
    });

    // Attach run button listener
    runProgramButton.addEventListener('click', async () => {
        Logger.log("Run Program button clicked.");
        updateButtonStateUI(false); // Disable button immediately
        try {
            // Directly call the provided callback, which now has boardData baked in
            await runProgramCallback();
        } catch (err) {
            Logger.error("Error during program execution:", err);
            // Optionally re-enable button on error? Or rely on programExecutionFinished event?
            // updateButtonStateUI(true);
        }
    });

    // Attach modal close button listener
    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', hideModalUI);
    } else {
         Logger.warn("Modal close button not found.");
    }

    if (debugTrigger) {
        debugTrigger.addEventListener('click', showDebugModal);
    } else {
        Logger.warn("Debug trigger element not found.");
    }

    if (debugCloseButton) {
        debugCloseButton.addEventListener('click', hideDebugModal);
    } else {
        Logger.warn("Debug close button element not found.");
    }

    // Optional: Close debug modal if clicking overlay
    if (debugModal) {
        debugModal.addEventListener('click', (event) => {
            // Check if the click was directly on the overlay, not the content inside
            if (event.target === debugModal) {
                hideDebugModal();
            }
        });
    }

    // Add listener for test button
    if (runTestsButton) {
        runTestsButton.addEventListener('click', async () => {
            Logger.log("Run Tests button clicked.");
            // Disable button while running?
            runTestsButton.disabled = true;
            runTestsButton.textContent = "Running Tests...";
            try {
                await TestRunner.runTests(); // Execute tests
            } catch(e) {
                 Logger.error("Error running test suite:", e);
            } finally {
                 runTestsButton.disabled = false; // Re-enable
                 runTestsButton.textContent = "Run Tests";
            }
        });
    } else {
        Logger.warn("Run Tests button not found.");
    }

    // NEW: Attach Zoom Listeners
    if (zoomInButton) {
        zoomInButton.addEventListener('click', () => {
            zoomLevel = Math.min(MAX_ZOOM, zoomLevel + ZOOM_INCREMENT);
            applyZoom();
        });
    }
    if (zoomOutButton) {
        zoomOutButton.addEventListener('click', () => {
            zoomLevel = Math.max(MIN_ZOOM, zoomLevel - ZOOM_INCREMENT);
            applyZoom();
        });
    }
    if (boardScrollArea) {
        boardScrollArea.addEventListener('wheel', (event) => {
            // Only zoom if Ctrl key is held down
            if (event.ctrlKey) {
                event.preventDefault(); // Prevent page from scrolling
                const scrollAmount = event.deltaY < 0 ? ZOOM_INCREMENT : -ZOOM_INCREMENT;
                zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + scrollAmount));
                applyZoom();
            }
            // If Ctrl is not held, do nothing and allow default scroll behavior
        }, { passive: false }); // passive:false is needed for preventDefault
    }


    subscribeToModelEvents(boardData); // Setup model listeners

    // Initial check for button state after setup
    checkProgramReady();
    Logger.log("UI Listeners set up.");
}

function subscribeToModelEvents(boardData, robot) { // Pass needed static data like gridCols
    on('robotMoved', ({ row, col, orientation }) => {
        updateRobotVisualsUI(row, col, orientation);
        // Redraw laser beams whenever the robot moves
        drawLaserBeams(boardData, { row, col, orientation });
    });
    on('robotTurned', ({ row, col, orientation }) => {
        updateRobotVisualsUI(row, col, orientation); // Same UI update needed
    });
    on('healthChanged', ({ health, maxHealth }) => {
        updateHealthUI(health, maxHealth);
    });
    on('flagVisited', (stationKey) => { // Assuming gameLoop emits this
         updateFlagIndicatorUI(stationKey);
    });
    on('gameOver', (isWin) => { // Assuming gameLoop emits this
         showModalUI(isWin);
    });
    on('handUpdated', (handData) => {
        updateHandUI(handData);
        checkProgramReady(); // Check button state whenever hand changes (might be empty)
    });
    on('cardCountsUpdated', (counts) => {
        updateDebugCountsUI(counts);
    });
    on('programExecutionFinished', () => {
        Logger.log("UI: Received programExecutionFinished event. Resetting slots.");
        resetProgramSlotsUI();
        // Also ensure the run button is disabled after reset, as the program is no longer full
        // checkProgramReady() might be called by handUpdated, but let's be explicit
        updateButtonStateUI(false);
    });
    Logger.log("UI subscribed to model events.");
}
