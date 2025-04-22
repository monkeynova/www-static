// ui.js
import * as Config from './config.js';
// Import functions needed to update card state on drop
import { getCardData, removeFromHandData, addToHandData } from './cards.js';
import { on } from './eventEmitter.js';
import * as Board from './board.js';
import { TILE_CLASSES } from './config.js';
import * as Logger from './logger.js';
import { getHistory as getLogHistory } from './logger.js';

// --- DOM Element References ---
const factoryFloor = document.getElementById('factory-floor');
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

let robotElement = null; // Reference to the robot DOM element
let draggedCardElement = null; // Track dragged DOM element during drag event

// --- Board UI ---
/**
 * Creates the visual board tiles and flag indicators.
 * @param {object} boardData - Parsed board data from board.js.
 * @param {number} gridCols - Number of columns (passed explicitly now).
 */
export function createBoardUI(boardData, gridCols) { // gridCols might be redundant if boardData has it
    factoryFloor.innerHTML = '';
    factoryFloor.style.gridTemplateColumns = `repeat(${boardData.cols}, 50px)`;
    factoryFloor.style.gridTemplateRows = `repeat(${boardData.rows}, 50px)`;

    flagStatusContainer.querySelectorAll('.flag-indicator').forEach(el => el.remove());

    // Create Tiles
    for (let r = 0; r < boardData.rows; r++) {
        for (let c = 0; c < boardData.cols; c++) {
            const tileData = Board.getTileData(r, c, boardData); // Use Board helper
            if (!tileData) {
                 Logger.error(`UI Error: Could not get tile data for (${r},${c}) during board creation.`);
                 continue;
            }
            const tileElement = document.createElement('div');

            // Get classes based on tile type using config mapping
            const typeChar = tileData.type;
            const typeClasses = TILE_CLASSES[typeChar] || ['plain'];
            const allClasses = ['tile', ...typeClasses];
            allClasses.forEach(cls => tileElement.classList.add(cls));

            if (tileData.walls && Array.isArray(tileData.walls)) {
                if (tileData.walls.includes('north')) tileElement.classList.add('wall-north');
                if (tileData.walls.includes('south')) tileElement.classList.add('wall-south');
                if (tileData.walls.includes('east')) tileElement.classList.add('wall-east');
                if (tileData.walls.includes('west')) tileElement.classList.add('wall-west');
            }
            // --- End Optional ---

            factoryFloor.appendChild(tileElement);
        }
    }

    // Create Flag Indicators (remains the same)
    boardData.repairStations.forEach(station => {
        const stationKey = `${station.row}-${station.col}`;
        const indicator = document.createElement('div');
        indicator.classList.add('flag-indicator');
        indicator.dataset.stationKey = stationKey; // Link indicator to station data
        indicator.textContent = Config.TILE_SYMBOLS['repair-station'] || '🔧'; // Use symbol from config
        flagStatusContainer.appendChild(indicator);
    });

    // Create Robot Element (remains the same)
    robotElement = document.createElement('div');
    robotElement.classList.add('robot');
    Logger.log("Board UI created.");
}

// --- UI Update Functions ---

/**
 * Updates the robot's position and orientation in the UI.
 * @param {number} row
 * @param {number} col
 * @param {string} orientation
 * @param {number} gridCols - Needed for index calculation.
 */
export function updateRobotVisualsUI(row, col, orientation, gridCols) {
    if (!robotElement) {
        Logger.error("UI Error: Robot element not created yet.");
        return;
    }
    const tileElement = getTileElementUI(row, col, gridCols); // Get tile DOM element
    if (tileElement) {
        // Update orientation class
        robotElement.classList.remove('facing-north', 'facing-east', 'facing-south', 'facing-west');
        robotElement.classList.add(`facing-${orientation}`);
        // Move element
        tileElement.appendChild(robotElement);
    } else {
        Logger.error(`UI Error: Cannot find tile element at (${row}, ${col}) to move robot.`);
    }
}

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
    if (!dropTarget || !draggedCardElement) {
         Logger.warn("Drop failed: No drop target or dragged element reference.");
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

    subscribeToModelEvents(boardData); // Setup model listeners

    // Initial check for button state after setup
    checkProgramReady();
    Logger.log("UI Listeners set up.");
}

function subscribeToModelEvents(boardData) { // Pass needed static data like gridCols
    on('robotMoved', ({ row, col, orientation }) => {
        updateRobotVisualsUI(row, col, orientation, boardData.cols);
    });
    on('robotTurned', ({ row, col, orientation }) => {
        updateRobotVisualsUI(row, col, orientation, boardData.cols); // Same UI update needed
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
