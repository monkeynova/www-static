// gameLoop.js
import * as Config from './config.js';
import { Board } from './board.js';
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
 * @param {number} currentProgramStep - The current step number of the program execution.
 * @returns {Promise<object>} { gameEnded, boardMoved, fellInHole }
 */
export async function applyBoardEffects(boardData, robot, currentProgramStep) {
    Logger.log("   Checking board actions...");
    let robotState = robot.getRobotState(); // Initial state for the phase
    let boardMoved = false; // Track if ANY movement happened this phase
    let gameEnded = false;
    let fellInHole = false; // Make sure this is declared
    let finalTileData = boardData.getTileData(robotState.row, robotState.col); // Declare and initialize here

    // --- 1. Conveyor Movement ---
    // Phase 1: Check 2x Conveyor
    let tileData = boardData.getTileData(robotState.row, robotState.col);
    Logger.log(`      Phase 1: Checking 2x Conveyor ${tileData}`);

    const conveyor2xResult = tileData.tryApplySpeed2xConveyor(robotState, boardData);
    if (conveyor2xResult.moved) {
        robot.setPosition(conveyor2xResult.newR, conveyor2xResult.newC);
        boardMoved = true;
        await sleep(150); // Short delay after phase 1 movement
        robotState = robot.getRobotState(); // Get updated state
    }

    // Phase 2: Check All Conveyors
    Logger.log("      Phase 2: Checking All Conveyors");
    tileData = boardData.getTileData(robotState.row, robotState.col);

    const conveyorResult = tileData.tryApplyConveyor(robotState, boardData);
    if (conveyorResult.moved) {
        robot.setPosition(conveyorResult.newR, conveyorResult.newC);
        boardMoved = true;
        await sleep(150); // Short delay after phase 2 movement
        robotState = robot.getRobotState(); // Get final updated state
    }
    // --- End Conveyor Movement ---

    // --- NEW: 2. Push Panel Movement ---
    Logger.log("      Phase 3: Checking Push Panels");
    finalTileData = boardData.getTileData(robotState.row, robotState.col); // Re-fetch after conveyor movement
    const pushPanelResult = finalTileData.tryPushPanel(robotState, boardData, currentProgramStep);
    if (pushPanelResult.moved) {
        robot.setPosition(pushPanelResult.newR, pushPanelResult.newC);
        boardMoved = true;
        await sleep(150); // Short delay after push panel movement
        robotState = robot.getRobotState(); // Get updated state
    }

    // --- Get Final State After Push Panels ---
    // Ensure robotState reflects the final position after push panels
    robotState = robot.getRobotState();
    // No need to re-assign finalTileData here, it's updated by robotState

    // --- NEW: 3. Gear Rotation ---
    finalTileData = boardData.getTileData(robotState.row, robotState.col); // Re-fetch after potential movement
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
                const tile = boardData.getTileData(r, c);
                if (tile && tile.laserDirection) {
                    // Check if robot is on the laser emitter tile itself
                    const robotOnEmitter = (robotState.row === r && robotState.col === c);

                    const laserPath = boardData.getLaserPath(r, c, tile.laserDirection, robotState);
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


    // --- 4. Repair Station ---
    const repairStationResult = finalTileData.tryApplyRepairStation(robot, boardData);
    if (repairStationResult.gameEnded) {
        gameEnded = true;
    }

    // --- 4. Hole ---
    if (!gameEnded) { // Only check for hole if game hasn't ended from repair station
        const holeResult = await finalTileData.tryApplyHole(robot, boardData);
        if (holeResult.gameEnded) {
            gameEnded = true;
        }
        if (holeResult.fellInHole) {
            fellInHole = true;
            // Delay for robot return to station is handled in Tile.tryApplyHole
            if (!gameEnded) { // Only sleep if game didn't end
                await sleep(600); // Wait for robot to return to station
            }
        }
    }

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

    const programCards = robot.getProgram(); // Get program from robot

    if (programCards.length !== Config.PROGRAM_SIZE) {
        Logger.error("Program is not full!");
        emit('programExecutionFinished'); // EMIT EVENT
        return;
    }

    // --- Card Execution Loop ---
    for (let i = 0; i < programCards.length; i++) {
        const cardData = programCards[i]; // Get card data directly

        Logger.log(`
Executing Card ${i + 1}: ${cardData.text} (${cardData.type})`);
        let cardMoved = false;

        // --- 1. Execute Card Action ---
        if (cardData.type === 'turnL') {
            robot.turn(TURN_LEFT); // Update state
        } else if (cardData.type === 'turnR') {
            robot.turn(TURN_RIGHT); // Update state
        }
        // --- Handle U-Turn ---
        else if (cardData.type === 'uturn') {
            robot.uTurn(); // Update state & emit event
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
            }
        }

        await sleep(cardMoved ? 200 : 500);

        const boardResult = await applyBoardEffects(boardData, robot, i + 1);

        if (boardResult.gameEnded) {
            Cards.discard(programCards.map(card => card.instanceId)); // Discard by instanceId
            emit('programExecutionFinished');
            Logger.log("Game ended during board effects phase.");
            return;
        }

        if (!boardResult.boardMoved && !boardResult.fellInHole) {
             await sleep(100);
        }

    }

    Logger.log("\n--- Program Finished ---");
    Cards.discard(programCards.map(card => card.instanceId)); // Discard by instanceId
    emit('programExecutionFinished');
    Cards.draw(Config.PROGRAM_SIZE);

}

