// ui.js
import * as Config from './config.js';
import * as Board from './board.js'; // Need this for tile/wall data
import { on } from './eventEmitter.js';
import * as Logger from './logger.js';
// Card imports remain if needed for drag/drop state updates
import { getCardData, removeFromHandData, addToHandData } from './cards.js';

// --- DOM Element References ---
const cardHandContainer = document.getElementById('card-hand');
const programSlots = document.querySelectorAll('#program-slots .program-slot');
const programSlotsContainer = document.getElementById('program-slots');
const runProgramButton = document.getElementById('run-program');
const flagStatusContainer = document.getElementById('flag-status');
const healthValueEl = document.getElementById('health-value');
const maxHealthValueEl = document.getElementById('max-health-value');
const modal = document.getElementById('end-game-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalMessageEl = document.getElementById('modal-message');
const modalCloseButton = document.getElementById('modal-close-button');
const debugTrigger = document.getElementById('debug-trigger');
const debugModal = document.getElementById('debug-modal');
const debugDeckCount = document.getElementById('debug-deck-count');
const debugDiscardCount = document.getElementById('debug-discard-count');
const debugHandCount = document.getElementById('debug-hand-count');
const debugCloseButton = document.getElementById('debug-close-button');
const debugLogOutput = document.getElementById('debug-log-output'); // Add ref for log output area
const boardContainer = document.getElementById('board-container'); // NEW
const boardCanvas = document.getElementById('board-canvas');     // NEW

// --- Canvas / Rendering State ---
let ctx = null; // Canvas 2D context
let robotElement = null; // Reference to the robot DOM element
let draggedCardElement = null; // Track dragged DOM element during drag event
let wallStripePattern = null; // Store the created pattern

// --- Board UI ---
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

/** Renders the entire static board (tiles, walls) onto the canvas */
export function renderBoard(boardData) {
    if (!ctx || !boardData) {
        Logger.error("Cannot render board: Missing context or board data.");
        return;
    }
    Logger.log("Rendering board to canvas...");
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height); // Clear previous frame

    // --- Get computed styles for colors (more robust than hardcoding) ---
    const styles = getComputedStyle(document.documentElement);
    const plainColor = styles.getPropertyValue('--tile-plain-color').trim() || '#eee';
    const conveyorColor = styles.getPropertyValue('--tile-conveyor-color').trim() || '#aaddff';
    const repairColor = styles.getPropertyValue('--tile-repair-color').trim() || '#90ee90';
    const holeColor = styles.getPropertyValue('--tile-hole-color').trim() || '#222';
    const wallThickness = parseInt(styles.getPropertyValue('--wall-thickness').trim()) || 3;
    // Use pattern if available, otherwise fallback color
    const wallFill = wallStripePattern || styles.getPropertyValue('--wall-solid-color').trim() || '#630';


    // --- Draw Tiles ---
    for (let r = 0; r < boardData.rows; r++) {
        for (let c = 0; c < boardData.cols; c++) {
            const tileData = Board.getTileData(r, c, boardData);
            if (!tileData) continue;

            const x = c * Config.TILE_SIZE;
            const y = r * Config.TILE_SIZE;

            // 1. Draw Tile Background Color
            switch (tileData.type) {
                case 'R': ctx.fillStyle = repairColor; break;
                case 'O': ctx.fillStyle = holeColor; break;
                case '^': case 'v': case '<': case '>':
                    ctx.fillStyle = conveyorColor; break;
                case ' ': default: ctx.fillStyle = plainColor; break;
            }
            ctx.fillRect(x, y, Config.TILE_SIZE, Config.TILE_SIZE);

            // 2. Draw Symbols (Optional - can be kept in CSS if preferred)
            ctx.fillStyle = '#333'; // Symbol color
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const centerX = x + Config.TILE_SIZE / 2;
            const centerY = y + Config.TILE_SIZE / 2;

            switch (tileData.type) {
                case 'R': ctx.fillText('🔧', centerX, centerY); break;
                case '>': ctx.fillText('→', centerX, centerY); break;
                case '<': ctx.fillText('←', centerX, centerY); break;
                case '^': ctx.fillText('↑', centerX, centerY); break;
                case 'v': ctx.fillText('↓', centerX, centerY); break;
            }
        }
    }

    // --- Draw Walls (Draw AFTER all tiles for correct layering) ---
    ctx.fillStyle = wallFill;
    for (let r = 0; r < boardData.rows; r++) {
        for (let c = 0; c < boardData.cols; c++) {
             const tileData = Board.getTileData(r, c, boardData);
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
export function updateRobotVisualsUI(row, col, orientation) {
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
export function updateHandUI(handCardsData) {
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
export function resetProgramSlotsUI() {
    programSlots.forEach((slot, index) => {
        slot.innerHTML = `${index + 1}`; // Restore number
        slot.className = 'program-slot drop-zone'; // Reset classes, keep drop-zone
    });
    // Logger.log("Program slots UI reset.");
}

/** Updates the health display. */
export function updateHealthUI(health, maxHealth) {
    if (healthValueEl && maxHealthValueEl) {
        healthValueEl.textContent = health;
        maxHealthValueEl.textContent = maxHealth;
        healthValueEl.classList.toggle('full', health === maxHealth);
    }
}

/** Marks a flag indicator as visited. */
export function updateFlagIndicatorUI(stationKey) {
    const indicator = flagStatusContainer.querySelector(`.flag-indicator[data-station-key="${stationKey}"]`);
    if (indicator) {
        indicator.classList.add('visited');
    } else {
        Logger.warn(`UI: Could not find flag indicator for key ${stationKey}`);
    }
}

/** Shows the end game modal. */
export function showModalUI(isWin) {
    if (modal && modalTitleEl && modalMessageEl) {
        modalTitleEl.textContent = isWin ? "You Win!" : "Robot Destroyed!";
        modalTitleEl.className = isWin ? 'win' : 'loss'; // Add class for styling
        modalMessageEl.textContent = isWin ? "Congratulations! You visited all repair stations!" : "Your robot ran out of health.";
        modal.style.display = 'flex'; // Show modal
    }
}

/** Hides the end game modal. */
export function hideModalUI() {
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
export function showDebugModal() {
    if (debugModal && debugLogOutput) { // Check only needed elements
        // Counts are updated via event listener now, no need to fetch here
        // const history = getLogHistory(); ... (log display logic remains) ...
        const history = getLogHistory();
        debugLogOutput.textContent = history.slice().reverse().join('\n');
        debugLogOutput.scrollTop = 0;

        debugModal.style.display = 'flex';
    } else {
        console.error("Debug modal elements not found!");
    }
}

/** Hides the debug modal. */
export function hideDebugModal() {
    if (debugModal) {
        debugModal.style.display = 'none';
    }
}

/** Enables or disables the Run Program button. */
export function updateButtonStateUI(isEnabled) {
    runProgramButton.disabled = !isEnabled;
}

// --- UI Helpers ---

/** Gets the DOM element for a specific tile. */
function getTileElementUI(row, col, gridCols) {
    const index = row * gridCols + col;
    if (index >= 0 && index < factoryFloor.children.length) {
        return factoryFloor.children[index];
    }
    return null;
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
    runProgramButton.addEventListener('click', () => {
        // Disable button immediately in UI
        updateButtonStateUI(false);
        // Call the provided game loop execution function
        runProgramCallback();
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

    subscribeToModelEvents(); // Setup model listeners

    // Initial check for button state after setup
    checkProgramReady();
    Logger.log("UI Listeners set up.");
}

function subscribeToModelEvents(boardData) { // Pass needed static data like gridCols
    on('robotMoved', ({ row, col, orientation }) => {
        updateRobotVisualsUI(row, col, orientation);
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
