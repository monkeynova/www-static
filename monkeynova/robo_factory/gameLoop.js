// gameLoop.js
import * as Config from './config.js';
import * as Board from './board.js';
import * as Cards from './cards.js'; 
import * as Logger from './logger.js';
import { emit } from './eventEmitter.js';
import { TURN_LEFT, TURN_RIGHT } from './config.js'; // NEW: Import laser constants

// Simple sleep utility
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/**
 * Applies effects of the tile the robot is currently on.
 * @param {object} boardData - The parsed board data.
 * @param {Robot} robot - The robot instance.
 * @returns {Promise<object>} { gameEnded, boardMoved, fellInHole }
 */
export async function applyBoardEffects(boardData, robot) {
    Logger.log("   Checking board actions...");
    let robotState = robot.getRobotState(); // Initial state for the phase
    let boardMoved = false; // Track if ANY movement happened this phase
    let gameEnded = false;
    let fellInHole = false; // Make sure this is declared

    // --- 1. Conveyor Movement ---
    let currentR = robotState.row;
    let currentC = robotState.col;
    let movedInPhase1 = false;
    let movedInPhase2 = false;

    // --- Phase 1: Check 2x Conveyor ---
    let tileDataPhase1 = Board.getTileData(currentR, currentC, boardData);
    Logger.log("      Phase 1: Checking 2x Conveyor ${tileDataPhase1}");

    // Check if the robot STARTS this phase on a 2x conveyor
    if (tileDataPhase1 && tileDataPhase1.primaryType === 'conveyor' && tileDataPhase1.speed === 2) {
        // Calculate the potential move
        let dr = 0, dc = 0;
        let exitSide = '';
        switch (tileDataPhase1.conveyorDirection) {
            case 'north': dr = -1; exitSide = 'north'; break;
            case 'south': dr = 1;  exitSide = 'south'; break;
            case 'west':  dc = -1; exitSide = 'west';  break;
            case 'east':  dc = 1;  exitSide = 'east';  break;
        }

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
        robot.setPosition(currentR, currentC); // This emits 'robotMoved'
        await sleep(150); // Short delay after phase 1 movement
        robotState = robot.getRobotState(); // Get updated state
    } else {
        // Ensure robotState is the latest even if no move happened in phase 1
        robotState = robot.getRobotState();
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
        switch (tileDataPhase2.conveyorDirection) {
            case 'north': dr = -1; exitSide = 'north'; break;
            case 'south': dr = 1;  exitSide = 'south'; break;
            case 'west':  dc = -1; exitSide = 'west';  break;
            case 'east':  dc = 1;  exitSide = 'east';  break;
        }

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
        robot.setPosition(currentR, currentC); // This emits 'robotMoved'
        await sleep(150); // Short delay after phase 2 movement
        robotState = robot.getRobotState(); // Get final updated state
    }
    // --- End Conveyor Movement ---


    // --- Get Final State After Conveyors ---
    // Ensure robotState reflects the final position after both phases
    robotState = robot.getRobotState();
    let finalTileData = Board.getTileData(robotState.row, robotState.col, boardData);
    if (!finalTileData) {
         Logger.error("   Robot is on an invalid tile location after conveyor phase!");
         // Decide how to handle this - maybe force game over or reset?
         // For now, prevent further actions in this phase.
         return { gameEnded: false, boardMoved, fellInHole: false };
    }

    // --- NEW: 2. Gear Rotation ---
    if (finalTileData.classes.includes('gear-cw')) {
        Logger.log(`   On clockwise gear. Turning right.`);
        robot.turn('right');
        await sleep(350); // Wait for turn animation
        robotState = robot.getRobotState(); // Update state after turn
    } else if (finalTileData.classes.includes('gear-ccw')) {
        Logger.log(`   On counter-clockwise gear. Turning left.`);
        robot.turn('left');
        await sleep(350);
        robotState = robot.getRobotState(); // Update state after turn
    }
    // --- End Gear Rotation ---


    // --- End Gear Rotation ---


    // --- NEW: 3. Laser Firing ---
    if (!gameEnded) { // Only fire lasers if game hasn't ended from previous effects
        Logger.log("   Checking for laser fire...");
        // Iterate through all tiles to find lasers
        for (let r = 0; r < boardData.rows; r++) {
            for (let c = 0; c < boardData.cols; c++) {
                const tile = Board.getTileData(r, c, boardData);
                if (tile && tile.laserDirection) {
                    // Check if robot is on the laser emitter tile itself
                    const robotOnEmitter = (robotState.row === r && robotState.col === c);

                    const laserPath = Board.getLaserPath(r, c, tile.laserDirection, boardData, robotState);
                    // Check if robot is on any tile in the laser's path
                    const robotInLaserPath = laserPath.some(
                        pathTile => pathTile.row === robotState.row && pathTile.col === robotState.col
                    );

                    if (robotOnEmitter || robotInLaserPath) {
                        Logger.log(`   Robot hit by laser from (${r},${c}) firing ${tile.laserDirection}!`);
                        Logger.log(`   Robot health BEFORE damage: ${robot.getRobotState().health}`);
                        robot.takeDamage();
                        Logger.log(`   Robot health AFTER damage: ${robot.getRobotState().health}`);
                        await sleep(300); // Small delay for visual feedback of damage
                        robotState = robot.getRobotState(); // Update robot state after damage
                        if (robot.isDestroyed()) {
                            Logger.error("   *** ROBOT DESTROYED by laser! ***");
                            emit('gameOver', false);
                            gameEnded = true;
                            return { gameEnded, boardMoved, fellInHole }; // Exit early if game over
                        }
                    }
                }
            }
        }
    }
    // --- End Laser Firing ---


    // --- 4. Repair Station --- (Logic updated to use finalTileData)
    // Re-fetch tile data in case a gear turn happened on a repair station tile (unlikely but possible)
    finalTileData = Board.getTileData(robotState.row, robotState.col, boardData);
    if (!gameEnded && finalTileData.classes.includes('repair-station')) { // Check gameEnded
        const stationKey = `${robotState.row}-${robotState.col}`;
        robot.setLastVisitedStation(stationKey);

        if (!robot.hasVisitedStation(stationKey)) {
            Logger.log(`   Visiting NEW repair station at (${robotState.row}, ${robotState.col})!`);
            robot.visitStation(stationKey);
            emit('flagVisited', stationKey);
            const visitCount = robot.getVisitedStationCount()

            Logger.log(`   Visited ${visitCount} / ${boardData.repairStations.length} stations.`);
            if (visitCount === boardData.repairStations.length && boardData.repairStations.length > 0) {
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
        robot.takeDamage(); // Update state (emits healthChanged)

        if (robot.isDestroyed()) {
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
                    robot.setPosition(lastR, lastC);
                    await sleep(600);
                    // Update robotState again after reset? Might not be necessary if phase ends here.
                    // robotState = robot.getRobotState();
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
 * @param {Robot} robot - The robot instance.
 */
export async function runProgramExecution(boardData, robot) {
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
        let robotState = robot.getRobotState(); // Get state before action

        // --- 1. Execute Card Action ---
        if (cardData.type === 'turnL') {
            robot.turn(TURN_LEFT); // Update state
        } else if (cardData.type === 'turnR') {
            robot.turn(TURN_RIGHT); // Update state
        }
        // --- Handle U-Turn ---
        else if (cardData.type === 'uturn') {
            robot.uTurn(); // Update state & emit event
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
                const moveTarget = robot.calculateMoveTarget(stepType, boardData);

                if (moveTarget.success) {
                    // No need for extra obstacle check here, calculateMoveTarget did it
                    Logger.log(`   Attempting move step ${moveStep + 1} to (${moveTarget.targetRow}, ${moveTarget.targetCol})`);
                    robot.setPosition(moveTarget.targetRow, moveTarget.targetCol);
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
        const boardResult = await applyBoardEffects(boardData, robot);

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
