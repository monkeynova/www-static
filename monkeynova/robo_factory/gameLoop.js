// gameLoop.js
import * as Config from './config.js';
import * as Board from './board.js';
import * as Robot from './robot.js';
import * as Cards from './cards.js';
import * as UI from './ui.js';

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
        // Defer UI update to main.js after initial render? Or do it here?
        // Let's do it here for simplicity, assuming UI is ready.
         UI.updateFlagIndicatorUI(key);
    }
}

// Simple sleep utility
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/** Applies effects of the tile the robot is currently on. */
async function applyBoardEffects() {
    console.log("   Checking board actions...");
    let robotState = Robot.getRobotState();
    let currentTileData = Board.getTileData(robotState.row, robotState.col, gameBoardData);
    let boardMoved = false;
    let fellInHole = false;

    if (!currentTileData) {
        console.error("   Robot is on an invalid tile location!");
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
                console.log(`   Activating conveyor (${direction}) to (${targetRow}, ${targetCol})`);
                Robot.setPosition(targetRow, targetCol); // Update state
                UI.updateRobotVisualsUI(targetRow, targetCol, robotState.orientation, gameBoardData.cols); // Update UI
                boardMoved = true;
                await sleep(400); // Visual delay
                // Update state vars for subsequent checks this turn
                robotState = Robot.getRobotState();
                currentTileData = Board.getTileData(robotState.row, robotState.col, gameBoardData);
            } else {
                console.log("   Conveyor move failed: Hit boundary or obstacle.");
            }
        }
    }

    // Re-check tile data in case conveyor moved robot
    if (!currentTileData) {
         console.error("   Robot is on an invalid tile location after conveyor!");
         return { gameEnded: false, boardMoved, fellInHole: false };
    }

    // --- Repair Station ---
    if (currentTileData.classes.includes('repair-station')) {
        const stationKey = `${robotState.row}-${robotState.col}`;
        Robot.setLastVisitedStation(stationKey); // Always update last visited

        if (!visitedRepairStations.has(stationKey)) {
            console.log(`   Visiting NEW repair station at (${robotState.row}, ${robotState.col})!`);
            visitedRepairStations.add(stationKey);
            UI.updateFlagIndicatorUI(stationKey); // Update UI flag

            // --- Win Condition Check ---
            console.log(`   Visited ${visitedRepairStations.size} / ${gameBoardData.repairStations.length} stations.`);
            if (visitedRepairStations.size === gameBoardData.repairStations.length && gameBoardData.repairStations.length > 0) {
                console.log("   *** WIN CONDITION MET! ***");
                await sleep(100);
                UI.showModalUI(true); // Show win modal
                return { gameEnded: true, boardMoved, fellInHole: false }; // Signal game end
            }
        } else {
            console.log(`   Already visited repair station at (${robotState.row}, ${robotState.col}).`);
        }
    }

    // --- Hole ---
    if (currentTileData.classes.includes('hole')) {
        console.log(`   Robot landed on a hole at (${robotState.row}, ${robotState.col})!`);
        fellInHole = true;
        const newHealth = Robot.takeDamage(); // Update state
        UI.updateHealthUI(newHealth, Config.MAX_HEALTH); // Update UI

        if (Robot.isDestroyed()) {
            console.error("   *** ROBOT DESTROYED! Health reached 0. ***");
            await sleep(100);
            UI.showModalUI(false); // Show loss modal
            return { gameEnded: true, boardMoved, fellInHole: true }; // Signal game end
        }

        // Return to last station if not destroyed
        const lastKey = robotState.lastVisitedStationKey; // Get key AFTER taking damage
        if (lastKey) {
            console.log(`   Returning to last visited station: ${lastKey}`);
            const [lastR, lastC] = lastKey.split('-').map(Number);
            // Check if the station coordinates are still valid on the board
            if (Board.getTileData(lastR, lastC, gameBoardData)) {
                Robot.setPosition(lastR, lastC); // Update state
                // Orientation doesn't change when falling
                UI.updateRobotVisualsUI(lastR, lastC, robotState.orientation, gameBoardData.cols); // Update UI
                await sleep(600); // Visual delay for reset
            } else {
                console.error(`   Last visited station key ${lastKey} points to an invalid tile! Cannot return.`);
                // What happens here? Robot stays in hole? Game over? For now, just log.
            }
        } else {
            console.error("   Fell in hole, but no last visited repair station recorded! Cannot return.");
            // What happens here? Reset to 0,0? For now, just log.
        }
    }

    return { gameEnded: false, boardMoved, fellInHole }; // Signal game continues
}


/** Executes the sequence of programmed cards and board actions. */
export async function runProgramExecution() {
    if (!gameBoardData) {
        console.error("Cannot run program: Board data not set.");
        // UI.updateButtonStateUI(true); // Re-enable button?
        return;
    }
    console.log("--- Starting Program Execution ---");

    const programmedCardElements = document.querySelectorAll('#program-slots .program-slot .card');
    if (programmedCardElements.length !== Config.PROGRAM_SIZE) {
        console.error("Program is not full!");
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
            console.error(`Cannot find card data for ${instanceId}! Skipping card.`);
            continue;
        }

        console.log(`\nExecuting Card ${i + 1}: ${cardData.text} (${cardData.type})`);
        let cardMoved = false;
        let robotState = Robot.getRobotState(); // Get state before action

        // --- 1. Execute Card Action ---
        if (cardData.type === 'turnL' || cardData.type === 'turnR') {
            const direction = cardData.type === 'turnL' ? 'left' : 'right';
            const newOrientation = Robot.turn(direction); // Update state
            UI.updateRobotVisualsUI(robotState.row, robotState.col, newOrientation, gameBoardData.cols); // Update UI
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
                    //    console.log(`   Move blocked by wall at (${moveTarget.targetRow}, ${moveTarget.targetCol}).`);
                    //    if (moveCount > 1) break; // Stop Move 2 if first step blocked
                    //    continue; // Skip this step if blocked
                    // }

                    // If not blocked, proceed with move
                    console.log(`   Attempting move step ${moveStep + 1} to (${moveTarget.targetRow}, ${moveTarget.targetCol})`);
                    Robot.setPosition(moveTarget.targetRow, moveTarget.targetCol); // Update state
                    // Get potentially updated orientation (though moves don't change it)
                    const currentOrientation = Robot.getRobotState().orientation;
                    UI.updateRobotVisualsUI(moveTarget.targetRow, moveTarget.targetCol, currentOrientation, gameBoardData.cols); // Update UI
                    cardMoved = true;
                    if (moveCount > 1) await sleep(500); // Delay between steps of Move 2

                } else { // Move failed boundary check
                    console.log("   Move failed: Hit boundary.");
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
            console.log("Game ended during board effects phase.");
            return; // Exit the runProgramExecution function
        }

        // Optional delay between full card+board steps
        if (!boardResult.boardMoved && !boardResult.fellInHole) {
             await sleep(100);
        }

    } // --- End Card Execution Loop ---

    // --- Post-Execution Cleanup (if game didn't end mid-turn) ---
    console.log("\n--- Program Finished ---");
    Cards.discard(usedCardInstanceIds); // Discard all used cards
    UI.resetProgramSlotsUI(); // Clear program slots visually
    const drawnCardsData = Cards.draw(Config.PROGRAM_SIZE); // Draw new cards (state updated in cards.js)
    UI.updateHandUI(Cards.getHandCards()); // Update hand UI with the new full hand
    // Run button state will be updated by the checkProgramReady in ui.js when cards are dragged

} // End runProgramExecution
