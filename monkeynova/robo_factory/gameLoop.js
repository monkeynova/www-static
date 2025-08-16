// gameLoop.js
import * as Config from './config.js';
import { Board } from './board.js';
import * as Cards from './cards.js'; 
import * as Logger from './logger.js';
import { emit } from './eventEmitter.js';
import { TURN_LEFT, TURN_RIGHT } from './config.js'; // NEW: Import laser constants

// Simple sleep utility
let isTesting = false; // NEW: Flag to indicate if tests are running

export function setTestingMode(mode) {
    isTesting = mode;
}

function sleep(ms) { 
    if (isTesting) {
        return Promise.resolve(); // Resolve immediately during tests
    }
    return new Promise(resolve => setTimeout(resolve, ms)); 
}

/**
 * Applies effects of the tile the robot is currently on.
 * @param {object} boardData - The parsed board data.
 * @param {Robot} robot - The robot instance.
 * @param {number} currentProgramStep - The current step number of the program execution.
 * @returns {Promise<object>} { gameEnded, boardMoved, fellInHole }
 */
export async function applyBoardEffects(boardData, robot, currentProgramStep) {
    Logger.log("   Checking board actions...");
    let boardMoved = false; // Track if ANY movement happened this phase
    let gameEnded = false;
    let fellInHole = false; // Make sure this is declared
    let finalTileData = boardData.getTileData(robot.row, robot.col); // Declare and initialize here

    // --- 1. Conveyor Movement ---
    // Phase 1: Check 2x Conveyor
    let tileData = boardData.getTileData(robot.row, robot.col);
    Logger.log(`      Phase 1: Checking 2x Conveyor ${tileData}`);

    const conveyor2xResult = tileData.tryApplySpeed2xConveyor(robot.getRobotState(), boardData);
    if (conveyor2xResult.moved) {
        robot.setPosition(conveyor2xResult.newR, conveyor2xResult.newC);
        boardMoved = true;
        await sleep(150); // Short delay after phase 1 movement
    }

    // Phase 2: Check All Conveyors
    Logger.log("      Phase 2: Checking All Conveyors");
    tileData = boardData.getTileData(robot.row, robot.col);

    const conveyorResult = tileData.tryApplyConveyor(robot.getRobotState(), boardData);
    if (conveyorResult.moved) {
        robot.setPosition(conveyorResult.newR, conveyorResult.newC);
        boardMoved = true;
        await sleep(150); // Short delay after phase 2 movement
    }
    // --- End Conveyor Movement ---

    // --- NEW: 2. Push Panel Movement ---
    Logger.log("      Phase 3: Checking Push Panels");
    finalTileData = boardData.getTileData(robot.row, robot.col); // Re-fetch after conveyor movement
    const pushPanelResult = finalTileData.tryPushPanel(robot.getRobotState(), boardData, currentProgramStep);
    if (pushPanelResult.moved) {
        robot.setPosition(pushPanelResult.newR, pushPanelResult.newC);
        boardMoved = true;
        await sleep(150); // Short delay after push panel movement
    }

    // --- Get Final State After Push Panels ---
    // Ensure robotState reflects the final position after push panels
    // No need to re-assign finalTileData here, it's updated by robotState

    // --- NEW: 3. Gear Rotation ---
    finalTileData = boardData.getTileData(robot.row, robot.col); // Re-fetch after potential movement
    if (finalTileData.floorDevice.type === 'gear' && finalTileData.floorDevice.direction === 'cw') {
        Logger.log(`   On clockwise gear. Turning right.`);
        robot.turn('right');
        await sleep(350); // Wait for turn animation
    } else if (finalTileData.floorDevice.type === 'gear' && finalTileData.floorDevice.direction === 'ccw') {
        Logger.log(`   On counter-clockwise gear. Turning left.`);
        robot.turn('left');
        await sleep(350);
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
                const laserDevice = tile ? tile.getWallDevice('laser') : null;
                if (laserDevice) {
                    // Check if robot is on the laser emitter tile itself
                    const robotOnEmitter = (robot.row === r && robot.col === c);

                    const laserPath = boardData.getLaserPath(r, c, laserDevice.direction, robot.getRobotState());
                    // Check if robot is on any tile in the laser's path
                    const robotInLaserPath = laserPath.some(
                        pathTile => pathTile.row === robot.row && pathTile.col === robot.col
                    );

                    if (robotOnEmitter || robotInLaserPath) {
                        Logger.log(`   Robot hit by laser from (${r},${c}) firing ${laserDevice.direction}!`);
                        Logger.log(`   Robot health BEFORE damage: ${robot.getRobotState().health}`);
                        robot.takeDamage();
                        Logger.log(`   Robot health AFTER damage: ${robot.getRobotState().health}`);
                        await sleep(300); // Small delay for visual feedback of damage
                        if (robot.isDestroyed()) {
                            gameEnded = true; // Game ended due to no lives left
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

    // --- NEW: Checkpoint ---
    const checkpointResult = finalTileData.tryApplyCheckpoint(robot, boardData);
    if (checkpointResult.gameEnded) {
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
        endOfTurnCleanup(robot);
        return;
    }
    Logger.log("--- Starting Program Execution ---");

    const isRobotPoweredDown = robot.getIsPoweredDown();
    const programCards = robot.getProgram(); // Get program from robot

    if (!isRobotPoweredDown && programCards.length !== Config.PROGRAM_SIZE) {
        Logger.error("Program is not full!");
        endOfTurnCleanup(robot);
        return;
    }

    // --- Card Execution Loop ---
    for (let i = 0; i < Config.PROGRAM_SIZE; i++) { // Loop 5 times regardless of program length
        const cardData = programCards[i]; // cardData might be undefined if program is not full

        Logger.log(`
Executing Step ${i + 1}: ${isRobotPoweredDown ? 'Robot Powered Down' : (cardData ? cardData.text : 'No Card')}`);
        Logger.log(`  Current robot powered down state: ${isRobotPoweredDown}`);
        Logger.log(`  Card data for this step: ${JSON.stringify(cardData)}`);
        let cardActionTaken = false; // Track if a card action was performed

        // --- 1. Execute Card Action (only if not powered down) ---
        if (isRobotPoweredDown) {
            Logger.log("Robot is powered down. Skipping card action.");
            await sleep(500); // Small delay to show nothing is happening
        } else if (cardData) { // Only execute if cardData exists (program is full)
            if (cardData.type === 'turnL') {
                robot.turn(TURN_LEFT); // Update state
                cardActionTaken = true;
            } else if (cardData.type === 'turnR') {
                robot.turn(TURN_RIGHT); // Update state
                cardActionTaken = true;
            }
            // --- Handle U-Turn ---
            else if (cardData.type === 'uturn') {
                robot.uTurn(); // Update state & emit event
                cardActionTaken = true;
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
                        cardActionTaken = true;
                        if (moveCount > 1) await sleep(500);
                    } else {
                        if (moveTarget.blockedByWall) {
                            Logger.log("   Move failed: Hit wall.");
                        } else {
                            Logger.log("   Move failed: Hit boundary.");
                        }
                        if (moveCount > 1) break; // Stop Move 2 if first step fails
                    }
                }
            }
        }

        await sleep(cardActionTaken ? 200 : 500); // Use cardActionTaken for sleep duration

        const boardResult = await applyBoardEffects(boardData, robot, i + 1);

        if (boardResult.gameEnded) {
            // Discard cards only if not powered down, as they weren't used
            if (!isRobotPoweredDown) {
                Cards.discard(programCards.map(card => card.instanceId)); // Discard by instanceId
            }
            endOfTurnCleanup(robot);
            Logger.log("Game ended during board effects phase.");
            return;
        }

        if (!boardResult.boardMoved && !boardResult.fellInHole) {
             await sleep(100);
        }

    }

    Logger.log("\n--- Program Finished ---");
    // Only discard cards if robot was NOT powered down (i.e., cards were actually used)
    if (!isRobotPoweredDown) {
        Cards.discard(programCards.map(card => card.instanceId)); // Discard by instanceId
    }
    endOfTurnCleanup(robot);
    // Only draw new cards if robot was NOT powered down
    if (!isRobotPoweredDown) {
        Cards.draw(Config.PROGRAM_SIZE);
    }    
}

/**
 * Performs end-of-turn cleanup, including power down state transitions.
 * @param {Robot} robot - The robot instance.
 */
function endOfTurnCleanup(robot) { // No longer exported
    Logger.log("--- Performing End of Turn Cleanup ---");
    const robotState = robot.getRobotState();

    // Step 1: If robot was powered down last turn, power it back up now.
    if (robotState.isPoweredDown) {
        robot.setIsPoweredDown(false); // Robot powers back up
        robot.restoreFullHealth(); // NEW: Heal robot when powering back up
        Logger.log("Robot is powering back up from a powered-down turn.");
    }

    // Step 2: If robot intended to power down, set it to powered down for THIS turn.
    if (robotState.powerDownIntent) {
        robot.setIsPoweredDown(true);
        robot.setPowerDownIntent(false); // Consume the intent
        Logger.log("Robot is now powered down for this turn (due to previous intent).");
    }
    Logger.log("--- End of Turn Cleanup Complete ---");
    emit('programExecutionFinished'); // EMIT EVENT
}

