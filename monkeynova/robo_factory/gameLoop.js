// gameLoop.js
import * as Config from './config.js';
import * as Board from './board.js';
import * as Robot from './robot.js';
import * as Cards from './cards.js'; 
import * as UI from './ui.js';
import * as Logger from './logger.js';
import { emit } from './eventEmitter.js';

let gameBoardData = null; // Stores the parsed board data
const visitedRepairStations = new Set(); // Tracks visited stations for win condition

/** Stores the parsed board data for use in the loop. */
export function setBoardData(boardData) {
    gameBoardData = boardData;
    visitedRepairStations.clear(); // Reset on new board data

    // Check if robot starts on a station and update state/UI
    const initialState = Robot.getRobotState();
    const startTileData = Board.getTileData(initialState.row, initialState.col, gameBoardData);
    if (startTileData && startTileData.char === 'R') {
        const key = `${initialState.row}-${initialState.col}`;
        visitedRepairStations.add(key);
        Robot.setLastVisitedStation(key);
    }
}

// Simple sleep utility
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/** Applies effects of the tile the robot is currently on. */
async function applyBoardEffects() {
    Logger.log("   Checking board actions...");
    let robotState = Robot.getRobotState();
    let currentTileData = Board.getTileData(robotState.row, robotState.col, gameBoardData);
    let boardMoved = false;
    let fellInHole = false;

    if (!currentTileData) {
        Logger.error("   Robot is on an invalid tile location!");
        return { gameEnded: false, boardMoved: false, fellInHole: false };
    }

    // --- Conveyor ---
    if (currentTileData.classes.includes('conveyor')) {
        let dr = 0, dc = 0;
        let direction = '';
        // Determine direction from classes
        if (currentTileData.classes.includes('up')) { dr = -1; direction = 'Up'; }
        else if (currentTileData.classes.includes('down')) { dr = 1; direction = 'Down'; }
        else if (currentTileData.classes.includes('left')) { dc = -1; direction = 'Left'; }
        else if (currentTileData.classes.includes('right')) { dc = 1; direction = 'Right'; }

        if (direction) {
            const targetRow = robotState.row + dr;
            const targetCol = robotState.col + dc;
            const targetTileData = Board.getTileData(targetRow, targetCol, gameBoardData);

            // Basic check: is target tile valid? (Add wall check later)
            if (targetTileData /* && !targetTileData.classes.includes('wall') */) {
                Logger.log(`   Activating conveyor (${direction}) to (${targetRow}, ${targetCol})`);
                Robot.setPosition(targetRow, targetCol); // Update state
                boardMoved = true;
                await sleep(400); // Visual delay
                // Update state vars for subsequent checks this turn
                robotState = Robot.getRobotState();
                currentTileData = Board.getTileData(robotState.row, robotState.col, gameBoardData);
            } else {
                Logger.log("   Conveyor move failed: Hit boundary or obstacle.");
            }
        }
    }

    // Re-check tile data in case conveyor moved robot
    if (!currentTileData) {
         Logger.error("   Robot is on an invalid tile location after conveyor!");
         return { gameEnded: false, boardMoved, fellInHole: false };
    }

    // --- Repair Station ---
    if (currentTileData.classes.includes('repair-station')) {
        const stationKey = `${robotState.row}-${robotState.col}`;
        Robot.setLastVisitedStation(stationKey); // Always update last visited

        if (!visitedRepairStations.has(stationKey)) {
            visitedRepairStations.add(stationKey);
            emit('flagVisited', stationKey); // Emit event for UI

            // --- Win Condition Check ---
            Logger.log(`   Visited ${visitedRepairStations.size} / ${gameBoardData.repairStations.length} stations.`);
            if (visitedRepairStations.size === gameBoardData.repairStations.length && gameBoardData.repairStations.length > 0) {
                emit('gameOver', true); // Emit event for UI
                return { gameEnded: true, boardMoved, fellInHole: false }; // Signal game end
            }
        } else {
            Logger.log(`   Already visited repair station at (${robotState.row}, ${robotState.col}).`);
        }
    }

    // --- Hole ---
    if (currentTileData.classes.includes('hole')) {
        Logger.log(`   Robot landed on a hole at (${robotState.row}, ${robotState.col})!`);
        fellInHole = true;
        const newHealth = Robot.takeDamage(); // Update state

        if (Robot.isDestroyed()) {
            emit('gameOver', false); // Emit event for UI
            return { gameEnded: true, boardMoved, fellInHole: true }; // Signal game end
        }

        // Return to last station if not destroyed
        const lastKey = robotState.lastVisitedStationKey; // Get key AFTER taking damage
        if (lastKey) {
            Logger.log(`   Returning to last visited station: ${lastKey}`);
            const [lastR, lastC] = lastKey.split('-').map(Number);
            // Check if the station coordinates are still valid on the board
            if (Board.getTileData(lastR, lastC, gameBoardData)) {
                Robot.setPosition(lastR, lastC); // Update state
                await sleep(600); // Visual delay for reset
            } else {
                Logger.error(`   Last visited station key ${lastKey} points to an invalid tile! Cannot return.`);
                // What happens here? Robot stays in hole? Game over? For now, just log.
            }
        } else {
            Logger.error("   Fell in hole, but no last visited repair station recorded! Cannot return.");
            // What happens here? Reset to 0,0? For now, just log.
        }
    }

    return { gameEnded: false, boardMoved, fellInHole }; // Signal game continues
}


/** Executes the sequence of programmed cards and board actions. */
export async function runProgramExecution() {
    if (!gameBoardData) {
        Logger.error("Cannot run program: Board data not set.");
        // UI.updateButtonStateUI(true); // Re-enable button?
        return;
    }
    Logger.log("--- Starting Program Execution ---");

    const programmedCardElements = document.querySelectorAll('#program-slots .program-slot .card');
    if (programmedCardElements.length !== Config.PROGRAM_SIZE) {
        Logger.error("Program is not full!");
        UI.updateButtonStateUI(true); // Re-enable button if error occurred before starting
        return;
    }

    const usedCardInstanceIds = []; // Track IDs of cards used this turn

    // --- Card Execution Loop ---
    for (let i = 0; i < programmedCardElements.length; i++) {
        const cardElement = programmedCardElements[i];
        const instanceId = cardElement.id;
        usedCardInstanceIds.push(instanceId); // Add to list for discarding later

        const cardData = Cards.getCardData(instanceId);
        if (!cardData) {
            Logger.error(`Cannot find card data for ${instanceId}! Skipping card.`);
            continue;
        }

        Logger.log(`\nExecuting Card ${i + 1}: ${cardData.text} (${cardData.type})`);
        let cardMoved = false;
        let robotState = Robot.getRobotState(); // Get state before action

        // --- 1. Execute Card Action ---
        if (cardData.type === 'turnL' || cardData.type === 'turnR') {
            const direction = cardData.type === 'turnL' ? 'left' : 'right';
            const newOrientation = Robot.turn(direction); // Update state
        }
        // Add U-Turn later: else if (cardData.type === 'uturn') { ... }
        else { // Movement cards (move1, move2, back1)
            let steps = 0;
            if (cardData.type === 'move1') steps = 1;
            else if (cardData.type === 'move2') steps = 2;
            else if (cardData.type === 'back1') steps = -1;

            const moveCount = cardData.type === 'move2' ? 2 : 1;
            const stepType = cardData.type === 'back1' ? -1 : 1; // -1 for back, 1 for move

            for (let moveStep = 0; moveStep < moveCount; moveStep++) {
                // Calculate where the robot *would* go
                const moveTarget = Robot.calculateMoveTarget(stepType, gameBoardData);

                if (moveTarget.success) {
                    // Check for obstacles on the target tile BEFORE moving state/UI
                    const targetTileData = Board.getTileData(moveTarget.targetRow, moveTarget.targetCol, gameBoardData);

                    // Example Obstacle Check (add 'wall' to TILE_CLASSES later)
                    // if (targetTileData && targetTileData.classes.includes('wall')) {
                    //    Logger.log(`   Move blocked by wall at (${moveTarget.targetRow}, ${moveTarget.targetCol}).`);
                    //    if (moveCount > 1) break; // Stop Move 2 if first step blocked
                    //    continue; // Skip this step if blocked
                    // }

                    // If not blocked, proceed with move
                    Logger.log(`   Attempting move step ${moveStep + 1} to (${moveTarget.targetRow}, ${moveTarget.targetCol})`);
                    Robot.setPosition(moveTarget.targetRow, moveTarget.targetCol); // Update state
                    cardMoved = true;
                    if (moveCount > 1) await sleep(500); // Delay between steps of Move 2

                } else { // Move failed boundary check
                    Logger.log("   Move failed: Hit boundary.");
                    if (moveCount > 1) break; // Stop Move 2 if first step fails
                }
            } // End loop for move steps (for Move 2)
        } // End movement card logic

        // Delay after card action completes
        await sleep(cardMoved ? 200 : 500);

        // --- 2. Execute Board Actions ---
        const boardResult = await applyBoardEffects();

        // If board effects ended the game, stop processing cards
        if (boardResult.gameEnded) {
            // Discard cards used *up to this point*
            Cards.discard(usedCardInstanceIds);
            UI.resetProgramSlotsUI(); // Clear slots visually
            Logger.log("Game ended during board effects phase.");
            return; // Exit the runProgramExecution function
        }

        // Optional delay between full card+board steps
        if (!boardResult.boardMoved && !boardResult.fellInHole) {
             await sleep(100);
        }

    } // --- End Card Execution Loop ---

    // --- Post-Execution Cleanup (if game didn't end mid-turn) ---
    Logger.log("\n--- Program Finished ---");
    Cards.discard(usedCardInstanceIds); // Discard all used cards
    UI.resetProgramSlotsUI(); // Clear program slots visually
    const drawnCardsData = Cards.draw(Config.PROGRAM_SIZE); // Draw new cards (state updated in cards.js)
    UI.updateHandUI(Cards.getHandCards()); // Update hand UI with the new full hand
    // Run button state will be updated by the checkProgramReady in ui.js when cards are dragged

} // End runProgramExecution
