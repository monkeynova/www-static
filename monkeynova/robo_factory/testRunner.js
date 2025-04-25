// testRunner.js
import * as Board from './board.js';
import * as Robot from './robot.js';
import * as GameLoop from './gameLoop.js';
import * as Logger from './logger.js';
import * as Config from './config.js'; // May need for constants like MAX_HEALTH

/**
 * Defines a test scenario.
 * @param {string} description - What the test verifies.
 * @param {Function} setup - Async function to set up board and robot state for the test.
 * @param {Function} action - Async function to execute the game logic being tested.
 * @param {object} expected - The expected final state object.
 * @param {Function} assert - Function to compare actual vs expected state.
 * @returns {object} The test scenario object.
 */
function defineTest(description, setup, action, expected, assert) {
    return { description, setup, action, expected, assert };
}

// --- Test Scenarios ---
const testScenarios = [

    defineTest(
        "Conveyor: 2x speed -> 1x speed moves robot 2 spaces",
        async () => {
            // Setup: Robot on 2x conveyor (0,0)->Right, next tile 1x conveyor (0,1)->Right
            const testBoardDef = [
                // Row 0
                [
                    { classes: ['conveyor', 'right', 'speed-2x'], walls: ['north', 'west'] },
                    { classes: ['conveyor', 'right'], walls: ['north'] },
                    { classes: ['plain'], walls: ['north'] },
                    { classes: ['plain'], walls: ['north', 'east'] }
                ],
                // Row 1
                [
                    { classes: ['plain'], walls: ['south', 'west'] },
                    { classes: ['plain'], walls: ['south'] },
                    { classes: ['plain'], walls: ['south'] },
                    { classes: ['plain'], walls: ['south', 'east'] }
                ]
            ];
            const boardData = Board.parseBoardObjectDefinition(testBoardDef);
            Robot.initRobot(0, 0, 'east'); // Start on the 2x conveyor
            return { boardData }; // Return needed data for action/assert
        },
        async (setupData) => {
            const visitedStations = new Set();
            await GameLoop.applyBoardEffects(setupData.boardData, visitedStations);
        },
        {
            // Expected: Robot should end up 2 tiles over
            robot: { row: 0, col: 2, orientation: 'east' }
        },
        (actualState, expectedState) => {
            // Assert: Check final robot position and orientation
            const posMatch = actualState.row === expectedState.robot.row && actualState.col === expectedState.robot.col;
            const orientMatch = actualState.orientation === expectedState.robot.orientation;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expectedState.robot.row},${expectedState.robot.col}), Got (${actualState.row},${actualState.col})`);
            if (!orientMatch) Logger.error(`   FAIL: Orientation mismatch. Expected ${expectedState.robot.orientation}, Got ${actualState.orientation}`);
            return posMatch && orientMatch;
        }
    ),

    defineTest(
        "Conveyor: 1x speed -> 1x speed moves robot 1 space",
         async () => {
            // Setup: Robot on 1x conveyor (0,0)->Right, next tile 1x conveyor (0,1)->Right
            const testBoardDef = [
                [ { classes: ['conveyor', 'right'], walls: ['north', 'west'] }, { classes: ['conveyor', 'right'], walls: ['north'] }, { classes: ['plain'], walls: ['north', 'east'] } ],
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = Board.parseBoardObjectDefinition(testBoardDef);
            Robot.initRobot(0, 0, 'east');
            return { boardData }; // Return needed data for action/assert
        },
        async (setupData) => {
            const visitedStations = new Set();
            await GameLoop.applyBoardEffects(setupData.boardData, visitedStations);
        },
        { robot: { row: 0, col: 1, orientation: 'east' } }, // Expected: Moves only 1 space
        (actual, expected) => {
            const pass = actual.row === expected.robot.row && actual.col === expected.robot.col;
            if (!pass) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            return pass;
        }
    ),

    defineTest(
        "Conveyor: 2x speed hits wall stops after 1 space",
         async () => {
            // Setup: Robot on 2x conveyor (0,0)->Right, wall blocking exit from (0,1)
            const testBoardDef = [
                [ { classes: ['conveyor', 'right', 'speed-2x'], walls: ['north', 'west'] }, { classes: ['plain', 'right'], walls: ['north', 'east'] } ], // Wall east of (0,1)
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = Board.parseBoardObjectDefinition(testBoardDef);
            Robot.initRobot(0, 0, 'east');
            return { boardData }; // Return needed data for action/assert
        },
        async (setupData) => {
            const visitedStations = new Set();
            await GameLoop.applyBoardEffects(setupData.boardData, visitedStations);
        },
        { robot: { row: 0, col: 1, orientation: 'east' } }, // Expected: Moves 1 space (phase 1), blocked in phase 2
        (actual, expected) => {
            const pass = actual.row === expected.robot.row && actual.col === expected.robot.col;
            if (!pass) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            return pass;
        }
    ),

    // --- Add More Test Scenarios Here ---
    // e.g., Wall blocking movement, Hole interaction, Repair station visit, Turns
    defineTest(
        "Movement: Move 1 forward hits wall",
        async () => {
            const testBoardDef = [
                [ { classes: ['plain'], walls: ['north', 'west', 'east'] }, { classes: ['plain'], walls: ['north', 'east'] } ], // Wall east of (0,0)
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = Board.parseBoardObjectDefinition(testBoardDef);
            Robot.initRobot(0, 0, 'east'); // Start at (0,0) facing wall
            return { boardData }; // Return boardData
        },
        async (setupData) => {
            // Pass boardData from setup
            const moveTarget = Robot.calculateMoveTarget(1, setupData.boardData);
            if (moveTarget.success) {
                Robot.setPosition(moveTarget.targetRow, moveTarget.targetCol); // Simulate move if calc succeeded (it shouldn't)
            }
            // Note: This only tests the calculation. Testing the full runProgramExecution is more complex.
        },
        { robot: { row: 0, col: 0, orientation: 'east' } }, // Expected: Robot doesn't move
        (actual, expected) => {
            const pass = actual.row === expected.robot.row && actual.col === expected.robot.col;
             if (!pass) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            return pass;
        }
    ),

];

/** Runs all defined test scenarios */
export async function runTests() {
    Logger.log("===== STARTING AUTOMATED TESTS =====");
    let passed = 0;
    let failed = 0;

    for (const test of testScenarios) {
        Logger.log(`\n--- Test: ${test.description} ---`);
        try {
            // 1. Setup state for this specific test
            const setupData = await test.setup(); // e.g., { boardData }
            Logger.log("   Setup complete.");

            // 2. Execute the action
            await test.action(setupData);
            Logger.log("   Action complete.");

            // 3. Get the actual resulting state
            const actualState = Robot.getRobotState(); // Assuming this reflects the result
            Logger.log("   Actual final state:", actualState);
            Logger.log("   Expected final state:", test.expected);


            // 4. Assert the result
            if (test.assert(actualState, test.expected)) {
                Logger.log("   Result: PASS");
                passed++;
            } else {
                // Assertion function should log specific failure details
                Logger.error("   Result: FAIL");
                failed++;
            }
        } catch (error) {
            Logger.error(`   ERROR during test execution: ${error}`, error.stack);
            failed++;
        }
    }

    Logger.log("\n===== TESTS COMPLETE =====");
    Logger.log(`Passed: ${passed}, Failed: ${failed}`);
    Logger.log("==========================");

    // Optional: Reset game state after tests? Or assume page reload.
    // Logger.log("Note: Game state may have been altered by tests.");
}
