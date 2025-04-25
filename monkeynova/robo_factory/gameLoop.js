// gameLoop.js
import * as Config from './config.js';
import * as Board from './board.js';
import * as Robot from './robot.js';
import * as Cards from './cards.js'; 
import * as Logger from './logger.js';
import { emit } from './eventEmitter.js';

// Simple sleep utility
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/**
 * Applies effects of the tile the robot is currently on.
 * @param {object} boardData - The parsed board data.
 * @param {Set<string>} visitedStations - The set of visited station keys.
 * @returns {Promise<object>} { gameEnded, boardMoved, fellInHole }
 */
export async function applyBoardEffects(boardData, visitedStations) {
    Logger.log("   Checking board actions...");
    let robotState = Robot.getRobotState(); // Initial state for the phase
    let boardMoved = false; // Track if ANY movement happened this phase
    let gameEnded = false;
    let fellInHole = false; // Make sure this is declared

    // --- 1. Conveyor Movement ---
    let currentR = robotState.row;
    let currentC = robotState.col;
    let movedInPhase1 = false;
    let movedInPhase2 = false;

    // --- Phase 1: Check 2x Conveyor ---
    Logger.log("      Phase 1: Checking 2x Conveyor");
    let tileDataPhase1 = Board.getTileData(currentR, currentC, boardData);

    // Check if the robot STARTS this phase on a 2x conveyor
    if (tileDataPhase1 && tileDataPhase1.primaryType === 'conveyor' && tileDataPhase1.speed === 2) {
        // Calculate the potential move
        let dr = 0, dc = 0;
        let exitSide = '';
        if (tileDataPhase1.classes.includes('up'))    { dr = -1; exitSide = 'north'; }
        else if (tileDataPhase1.classes.includes('down'))  { dr = 1;  exitSide = 'south'; }
        else if (tileDataPhase1.classes.includes('left'))  { dc = -1; exitSide = 'west'; }
        else if (tileDataPhase1.classes.includes('right')) { dc = 1;  exitSide = 'east'; }

        if (dr !== 0 || dc !== 0) { // Check if direction was found
            const nextR = currentR + dr;
            const nextC = currentC + dc;

            // Check boundaries and walls for this single step
            const targetTileData = Board.getTileData(nextR, nextC, boardData);
            const blockedByWall = Board.hasWall(currentR, currentC, exitSide, boardData) ||
                                  (targetTileData && Board.hasWall(nextR, nextC, dr === 1 ? 'north' : (dr === -1 ? 'south' : (dc === 1 ? 'west' : 'east')), boardData));

            if (targetTileData && !blockedByWall) {
                // If move is valid, update position for Phase 2
                Logger.log(`      2x Conveyor moving from (${currentR},${currentC}) to (${nextR},${nextC})`);
                currentR = nextR; // Update temporary position for next phase
                currentC = nextC;
                movedInPhase1 = true;
                boardMoved = true;
            } else {
                Logger.log(`      2x Conveyor at (${robotState.row},${robotState.col}) blocked (Wall: ${blockedByWall}, Boundary: ${!targetTileData}).`);
            }
        }
    }
    // Update robot state AFTER phase 1 check if needed
    if (movedInPhase1) {
        Robot.setPosition(currentR, currentC); // This emits 'robotMoved'
        await sleep(150); // Short delay after phase 1 movement
        robotState = Robot.getRobotState(); // Get updated state
    } else {
        // Ensure robotState is the latest even if no move happened in phase 1
        robotState = Robot.getRobotState();
        currentR = robotState.row;
        currentC = robotState.col;
    }


    // --- Phase 2: Check All Conveyors ---
    Logger.log("      Phase 2: Checking All Conveyors");
    let tileDataPhase2 = Board.getTileData(currentR, currentC, boardData);

    // Check if the robot is NOW on ANY conveyor
    if (tileDataPhase2 && tileDataPhase2.primaryType === 'conveyor') {
        // Calculate the potential move
        let dr = 0, dc = 0;
        let exitSide = '';
        if (tileDataPhase2.classes.includes('up'))    { dr = -1; exitSide = 'north'; }
        else if (tileDataPhase2.classes.includes('down'))  { dr = 1;  exitSide = 'south'; }
        else if (tileDataPhase2.classes.includes('left'))  { dc = -1; exitSide = 'west'; }
        else if (tileDataPhase2.classes.includes('right')) { dc = 1;  exitSide = 'east'; }

        if (dr !== 0 || dc !== 0) { // Check if direction was found
            const nextR = currentR + dr;
            const nextC = currentC + dc;

            // Check boundaries and walls for this single step
            const targetTileData = Board.getTileData(nextR, nextC, boardData);
            const blockedByWall = Board.hasWall(currentR, currentC, exitSide, boardData) ||
                                  (targetTileData && Board.hasWall(nextR, nextC, dr === 1 ? 'north' : (dr === -1 ? 'south' : (dc === 1 ? 'west' : 'east')), boardData));

            if (targetTileData && !blockedByWall) {
                // If move is valid, update position for subsequent phases
                Logger.log(`      1x/2x Conveyor moving from (${currentR},${currentC}) to (${nextR},${nextC})`);
                currentR = nextR; // Update temporary position
                currentC = nextC;
                movedInPhase2 = true;
                boardMoved = true;
            } else {
                Logger.log(`      1x/2x Conveyor at (${robotState.row},${robotState.col}) blocked (Wall: ${blockedByWall}, Boundary: ${!targetTileData}).`);
            }
        }
    }
    // Update robot state AFTER phase 2 check if needed
    if (movedInPhase2) {
        Robot.setPosition(currentR, currentC); // This emits 'robotMoved'
        await sleep(150); // Short delay after phase 2 movement
        robotState = Robot.getRobotState(); // Get final updated state
    }
    // --- End Conveyor Movement ---


    // --- Get Final State After Conveyors ---
    // Ensure robotState reflects the final position after both phases
    robotState = Robot.getRobotState();
    const finalTileData = Board.getTileData(robotState.row, robotState.col, boardData);
    if (!finalTileData) {
         Logger.error("   Robot is on an invalid tile location after conveyor phase!");
         // Decide how to handle this - maybe force game over or reset?
         // For now, prevent further actions in this phase.
         return { gameEnded: false, boardMoved, fellInHole: false };
    }

    // --- 2. Laser Firing --- (No changes needed here)
    // ... (Laser logic uses the final robotState) ...
    // Make sure laser logic correctly checks for gameEnded state

    // --- 3. Repair Station --- (Logic updated to use finalTileData)
    if (!gameEnded && finalTileData.classes.includes('repair-station')) { // Check gameEnded
        const stationKey = `${robotState.row}-${robotState.col}`;
        Robot.setLastVisitedStation(stationKey);

        if (!visitedStations.has(stationKey)) {
            Logger.log(`   Visiting NEW repair station at (${robotState.row}, ${robotState.col})!`);
            visitedStations.add(stationKey);
            emit('flagVisited', stationKey);

            Logger.log(`   Visited ${visitedStations.size} / ${boardData.repairStations.length} stations.`);
            if (visitedStations.size === boardData.repairStations.length && boardData.repairStations.length > 0) {
                Logger.log("   *** WIN CONDITION MET! ***");
                emit('gameOver', true);
                gameEnded = true; // Set gameEnded flag
            }
        } else {
            Logger.log(`   Already visited repair station at (${robotState.row}, ${robotState.col}).`);
        }
    } // End Repair Station

    // --- 4. Hole --- (Logic updated to use finalTileData)
    if (!gameEnded && finalTileData.classes.includes('hole')) { // Check gameEnded
        Logger.log(`   Robot landed on a hole at (${robotState.row}, ${robotState.col})!`);
        fellInHole = true;
        Robot.takeDamage(); // Update state (emits healthChanged)

        if (Robot.isDestroyed()) {
            Logger.error("   *** ROBOT DESTROYED by falling in hole! ***");
            emit('gameOver', false);
            gameEnded = true; // Set gameEnded flag
        } else {
            // Return to last station if not destroyed
            const lastKey = robotState.lastVisitedStationKey;
            if (lastKey) {
                Logger.log(`   Returning to last visited station: ${lastKey}`);
                const [lastR, lastC] = lastKey.split('-').map(Number);
                if (Board.getTileData(lastR, lastC, boardData)) {
                    Robot.setPosition(lastR, lastC);
                    await sleep(600);
                    // Update robotState again after reset? Might not be necessary if phase ends here.
                    // robotState = Robot.getRobotState();
                } else {
                    Logger.error(`   Last visited station key ${lastKey} points to an invalid tile! Cannot return.`);
                }
            } else {
                Logger.error("   Fell in hole, but no last visited repair station recorded! Cannot return.");
            }
        }
    } // End Hole

    return { gameEnded, boardMoved, fellInHole }; // Return final status
}

/**
* Executes the sequence of programmed cards and board actions.
* @param {object} boardData - The parsed board data.
* @param {Set<string>} visitedStations - The set of visited station keys.
*/
export async function runProgramExecution(boardData, visitedStations) {
   if (!boardData) {
        Logger.error("Cannot run program: Board data not set.");
        emit('programExecutionFinished'); // EMIT EVENT
        return;
    }
    Logger.log("--- Starting Program Execution ---");

    // TODO: UI method?
    const programmedCardElements = document.querySelectorAll('#program-slots .program-slot .card');
    if (programmedCardElements.length !== Config.PROGRAM_SIZE) {
        Logger.error("Program is not full!");
        emit('programExecutionFinished'); // EMIT EVENT
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
        // --- Handle U-Turn ---
        else if (cardData.type === 'uturn') {
            Robot.uTurn(); // Update state & emit event
            // UI update is handled by event listener
        }
        else { // Movement cards (move1, move2, back1)
            let steps = 0;
            if (cardData.type === 'move1') steps = 1;
            else if (cardData.type === 'move2') steps = 2;
            else if (cardData.type === 'back1') steps = -1;

            const moveCount = cardData.type === 'move2' ? 2 : 1;
            const stepType = cardData.type === 'back1' ? -1 : 1; // -1 for back, 1 for move

            for (let moveStep = 0; moveStep < moveCount; moveStep++) {
                // Calculate target and check boundaries/walls
                const moveTarget = Robot.calculateMoveTarget(stepType, boardData);

                if (moveTarget.success) {
                    // No need for extra obstacle check here, calculateMoveTarget did it
                    Logger.log(`   Attempting move step ${moveStep + 1} to (${moveTarget.targetRow}, ${moveTarget.targetCol})`);
                    Robot.setPosition(moveTarget.targetRow, moveTarget.targetCol);
                    cardMoved = true;
                    if (moveCount > 1) await sleep(500);
                } else { // Move failed boundary or wall check
                    if (moveTarget.blockedByWall) {
                        Logger.log("   Move failed: Hit wall.");
                    } else {
                        Logger.log("   Move failed: Hit boundary.");
                    }
                    if (moveCount > 1) break; // Stop Move 2 if first step fails
                }
            } // End loop for move steps
        } // End movement card logic

        // Delay after card action completes
        await sleep(cardMoved ? 200 : 500);

        // --- 2. Execute Board Actions ---
        const boardResult = await applyBoardEffects(boardData, visitedStations);

        // If board effects ended the game, stop processing cards
        if (boardResult.gameEnded) {
            // Discard cards used *up to this point*
            Cards.discard(usedCardInstanceIds);
            emit('programExecutionFinished'); // EMIT EVENT
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
    emit('programExecutionFinished'); // EMIT EVENT
    // Draw new cards (this will emit 'handUpdated' and 'cardCountsUpdated')
    Cards.draw(Config.PROGRAM_SIZE);

} // End runProgramExecution
