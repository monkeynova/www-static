// testRunner.js

// This import is intentionally here to ensure main.js (the application entry point)
// can be loaded without syntax errors or module resolution issues during tests.
// It does not directly contribute to test logic but validates the main application bundle.
import './main.js';

import { Board } from './board.js';
import Robot from './robot.js';
import * as GameLoop from './gameLoop.js';
import * as Logger from './logger.js';
import * as Config from './config.js'; // May need for constants like MAX_HEALTH
import { createDemonstrationBoard } from './main.js'; // NEW: Import createDemonstrationBoard

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
                    { classes: ['conveyor-east', 'speed-2x'], walls: ['north', 'west'] },
                    { classes: ['conveyor-east'], walls: ['north'] },
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
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 0, 'east');
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
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
                [ { classes: ['conveyor-east'], walls: ['north', 'west'] }, { classes: ['conveyor-east'], walls: ['north'] }, { classes: ['plain'], walls: ['north', 'east'] } ],
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 0, 'east');
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
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
                [ { classes: ['conveyor-east', 'speed-2x'], walls: ['north', 'west'] }, { classes: ['plain'], walls: ['north', 'east'] } ], // Wall east of (0,1)
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 0, 'east');
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
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
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 0, 'east');
            return { boardData, robot };
        },
        async (setupData) => {
            // Pass boardData from setup
            const moveTarget = setupData.robot.calculateMoveTarget(1, setupData.boardData);
            if (moveTarget.success) {
                setupData.robot.setPosition(moveTarget.targetRow, moveTarget.targetCol); // Simulate move if calc succeeded (it shouldn't)
            }
            return setupData.robot.getRobotState(); // Return robot state for assertion
        },
        { robot: { row: 0, col: 0, orientation: 'east' } }, // Expected: Robot doesn't move
        (actual, expected) => {
            const pass = actual.row === expected.robot.row && actual.col === expected.robot.col;
             if (!pass) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            return pass;
        }
    ),

    defineTest(
        "Movement: Back 1 into wall blocks motion",
        async () => {
            // Setup: Robot at (0,1) facing East. Wall West of (0,1).
            const testBoardDef = [
                // Row 0
                [
                    { classes: ['plain'], walls: ['north', 'west'] }, // Tile (0,0)
                    { classes: ['plain'], walls: ['north', 'west'] }, // Tile (0,1) - Add 'west' wall
                    { classes: ['plain'], walls: ['north', 'east'] }  // Tile (0,2)
                ],
                // Row 1
                [
                    { classes: ['plain'], walls: ['south', 'west'] },
                    { classes: ['plain'], walls: ['south'] },
                    { classes: ['plain'], walls: ['south', 'east'] }
                ]
            ];
            const boardData = new Board(testBoardDef);
            // Start robot at (0,1) facing East. Moving Back 1 would try to go West into the wall.
            const robot = new Robot(0, 1, 'east');
            return { boardData, robot };
        },
        async (setupData) => {
            // Action: Simulate calculating and attempting a "Back 1" move (steps = -1)
            const moveTarget = setupData.robot.calculateMoveTarget(-1, setupData.boardData);
            // We expect moveTarget.success to be false.
            // If it were true (which would be a bug), we'd simulate the move.
            if (moveTarget.success) {
                Logger.error("   TEST ERROR: calculateMoveTarget unexpectedly succeeded for Back 1 into wall.");
                setupData.robot.setPosition(moveTarget.targetRow, moveTarget.targetCol);
            } else {
                Logger.log("   Action: calculateMoveTarget correctly failed due to wall.");
            }
            return setupData.robot.getRobotState(); // Return robot state for assertion
        },
        { robot: { row: 0, col: 1, orientation: 'east' } }, // Expected: Robot remains at (0,1) facing East
        (actualState, expectedState) => {
            // Assert: Check final robot position and orientation
            const posMatch = actualState.row === expectedState.robot.row && actualState.col === expectedState.robot.col;
            const orientMatch = actualState.orientation === expectedState.robot.orientation;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expectedState.robot.row},${expectedState.robot.col}), Got (${actualState.row},${actualState.col})`);
            if (!orientMatch) Logger.error(`   FAIL: Orientation mismatch. Expected ${expectedState.robot.orientation}, Got ${actualState.orientation}`);
            return posMatch && orientMatch;
        }
    ),

    // --- NEW: Gear Tests ---
    defineTest(
        "Gears: Clockwise gear rotates robot right",
        async () => {
            const testBoardDef = [
                [ { classes: ['gear-cw'], walls: ['north', 'west'] }, { classes: ['plain'], walls: ['north', 'east'] } ],
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 0, 'north'); // Start facing North
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
        },
        { robot: { row: 0, col: 0, orientation: 'east' } }, // Expected: Robot faces East
        (actual, expected) => {
            const pass = actual.orientation === expected.robot.orientation;
            if (!pass) Logger.error(`   FAIL: Orientation mismatch. Expected ${expected.robot.orientation}, Got ${actual.orientation}`);
            return pass;
        }
    ),

    defineTest(
        "Gears: Counter-clockwise gear rotates robot left",
        async () => {
            const testBoardDef = [
                [ { classes: ['gear-ccw'], walls: ['north', 'west'] }, { classes: ['plain'], walls: ['north', 'east'] } ],
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 0, 'north'); // Start facing North
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
        },
        { robot: { row: 0, col: 0, orientation: 'west' } }, // Expected: Robot faces West
        (actual, expected) => {
            const pass = actual.orientation === expected.robot.orientation;
            if (!pass) Logger.error(`   FAIL: Orientation mismatch. Expected ${expected.robot.orientation}, Got ${actual.orientation}`);
            return pass;
        }
    ),

    defineTest(
        "Conveyor -> Gear: Robot is pushed onto a CW gear and rotates",
        async () => {
            // Setup: Robot on conveyor at (0,0) facing North. Conveyor pushes it East to (0,1).
            // Tile (0,1) is a clockwise gear.
            const testBoardDef = [
                // Row 0
                [
                    { classes: ['conveyor-east'], walls: ['north', 'west'] }, // (0,0)
                    { classes: ['gear-cw'], walls: ['north'] },                 // (0,1)
                    { classes: ['plain'], walls: ['north', 'east'] }            // (0,2)
                ],
                // Row 1
                [
                    { classes: ['plain'], walls: ['south', 'west'] },
                    { classes: ['plain'], walls: ['south'] },
                    { classes: ['plain'], walls: ['south', 'east'] }
                ]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 0, 'north'); // Initial orientation is North
            return { boardData, robot };
        },
        async (setupData) => {
            // Action: Apply board effects, which should move the robot then rotate it.
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
        },
        {
            // Expected: Robot moves to (0,1) and rotates from North to East.
            robot: { row: 0, col: 1, orientation: 'east' }
        },
        (actualState, expectedState) => {
            // Assert: Check final position and orientation
            const posMatch = actualState.row === expectedState.robot.row && actualState.col === expectedState.robot.col;
            const orientMatch = actualState.orientation === expectedState.robot.orientation;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expectedState.robot.row},${expectedState.robot.col}), Got (${actualState.row},${actualState.col})`);
            if (!orientMatch) Logger.error(`   FAIL: Orientation mismatch. Expected ${expectedState.robot.orientation}, Got ${actualState.orientation}`);
            return posMatch && orientMatch;
        }
    ),

    // --- NEW: Laser Tests ---
    defineTest(
        "Laser: Robot takes damage from a stationary laser",
        async () => {
            // Setup: Robot at (0,1) facing East. Laser at (0,0) firing East.
            const testBoardDef = [
                [ { classes: ['plain', 'laser-east'], walls: ['north', 'west', 'east'] }, { classes: ['plain'], walls: ['north'] }, { classes: ['plain'], walls: ['north', 'east'] } ],
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 1, 'east'); // Robot starts in laser path
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
        },
        { robot: { row: 0, col: 1, orientation: 'east', health: Config.MAX_HEALTH - 1 } }, // Expected: Robot takes 1 damage
        (actual, expected) => {
            const healthMatch = actual.health === expected.robot.health;
            if (!healthMatch) Logger.error(`   FAIL: Health mismatch. Expected ${expected.robot.health}, Got ${actual.health}`);
            return healthMatch;
        }
    ),

    defineTest(
        "Laser: Laser path is blocked by a wall",
        async () => {
            // Setup: Robot at (0,2). Laser at (0,0) firing East. Wall at (0,1) blocking laser.
            const testBoardDef = [
                [ { classes: ['plain', 'laser-east'], walls: ['north', 'west'] }, { classes: ['plain'], walls: ['north', 'west'] }, { classes: ['plain'], walls: [ 'north', 'east'] } ], // Wall west of (0,1)
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 2, 'east'); // Robot starts behind the wall
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
        },
        { robot: { row: 0, col: 2, orientation: 'east', health: Config.MAX_HEALTH } }, // Expected: Robot takes no damage
        (actual, expected) => {
            const healthMatch = actual.health === expected.robot.health;
            if (!healthMatch) Logger.error(`   FAIL: Health mismatch. Expected ${expected.robot.health}, Got ${actual.health}`);
            return healthMatch;
        }
    ),

    defineTest(
        "Conveyor -> Laser: Robot is pushed past a laser path and does not take damage",
        async () => {
            // Setup: Robot at (0,0) on conveyor-east. Tile (0,2) has a laser-north (attached to south wall).
            const testBoardDef = [
                [ { classes: ['conveyor-east'], walls: ['north', 'west'] }, { classes: ['plain'], walls: ['north'] }, { classes: ['plain', 'laser-north'], walls: ['north', 'east', 'south'] } ], // Added south wall
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 0, 'east'); // Robot starts on conveyor
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
        },
        { robot: { row: 0, col: 1, orientation: 'east', health: Config.MAX_HEALTH } }, // Expected: Robot moves to (0,1) but takes no damage
        (actual, expected) => {
            const posMatch = actual.row === expected.robot.row && actual.col === expected.robot.col;
            const healthMatch = actual.health === expected.robot.health;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            if (!healthMatch) Logger.error(`   FAIL: Health mismatch. Expected ${expected.robot.health}, Got ${actual.health}`);
            return posMatch && healthMatch;
        }
    ),

    defineTest(
        "Validation: Laser without required wall throws error",
        async () => {
            // Setup: Board with a laser-east tile but NO west wall on that tile.
            const testBoardDef = [
                [ { classes: ['plain', 'laser-east'], walls: ['north', 'south'] } ] // Missing 'west' wall
            ];
            // Expect this to throw an error during parsing
            return { testBoardDef };
        },
        async (setupData) => {
            let errorThrown = false;
            try {
                new Board(setupData.testBoardDef);
            } catch (e) {
                Logger.log(`   Expected error caught: ${e.message}`);
                errorThrown = true;
            }
            return { errorThrown };
        },
        { errorThrown: true },
        (actual, expected) => {
            const pass = actual.errorThrown === expected.errorThrown;
            if (!pass) Logger.error(`   FAIL: Expected errorThrown to be ${expected.errorThrown}, but was ${actual.errorThrown}`);
            return pass;
        }
    ),

    defineTest(
        "Laser on Conveyor: Robot takes damage from laser on conveyor tile",
        async () => {
            // Setup: Robot at (0,1) on conveyor-east with laser-east (attached to west wall).
            // Add an east wall to (0,1) to block conveyor movement.
            const testBoardDef = [
                [ { classes: ['plain'], walls: ['north', 'west'] }, { classes: ['conveyor-east', 'laser-east'], walls: ['north', 'west', 'east'] }, { classes: ['plain'], walls: ['north', 'east'] } ],
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 1, 'east'); // Robot starts on conveyor with laser
            return { boardData, robot };
        },
        async (setupData) => {
            // Simulate one program card execution to trigger board effects
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
        },
        { robot: { row: 0, col: 1, orientation: 'east', health: Config.MAX_HEALTH - 1 } }, // Expected: Robot stays at (0,1) and takes damage
        (actual, expected) => {
            const posMatch = actual.row === expected.robot.row && actual.col === expected.robot.col;
            const healthMatch = actual.health === expected.robot.health;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            if (!healthMatch) Logger.error(`   FAIL: Health mismatch. Expected ${expected.robot.health}, Got ${actual.health}`);
            return posMatch && healthMatch;
        }
    ),

    defineTest(
        "Laser on Gear: Robot takes damage from laser on gear tile",
        async () => {
            // Setup: Robot at (0,1) on gear-cw with laser-north (attached to south wall).
            const testBoardDef = [
                [ { classes: ['plain'], walls: ['north', 'west'] }, { classes: ['gear-cw', 'laser-north'], walls: ['north', 'south'] }, { classes: ['plain'], walls: ['north', 'east'] } ],
                [ { classes: ['plain'], walls: ['south', 'west'] }, { classes: ['plain'], walls: ['south'] }, { classes: ['plain'], walls: ['south', 'east'] } ]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(0, 1, 'north'); // Robot starts on gear with laser
            return { boardData, robot };
        },
        async (setupData) => {
            // Simulate one program card execution to trigger board effects
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
        },
        { robot: { row: 0, col: 1, orientation: 'east', health: Config.MAX_HEALTH - 1 } }, // Expected: Robot stays at (0,1), rotates, and takes damage
        (actual, expected) => {
            const posMatch = actual.row === expected.robot.row && actual.col === expected.robot.col;
            const orientMatch = actual.orientation === expected.robot.orientation;
            const healthMatch = actual.health === expected.robot.health;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            if (!orientMatch) Logger.error(`   FAIL: Orientation mismatch. Expected ${expected.robot.orientation}, Got ${actual.orientation}`);
            if (!healthMatch) Logger.error(`   FAIL: Health mismatch. Expected ${expected.robot.health}, Got ${actual.health}`);
            return posMatch && orientMatch && healthMatch;
        }
    ),

    // NEW: Test for main board definition parsing
    defineTest(
        "Main Board: createDemonstrationBoard parses successfully",
        async () => {
            const boardDef = createDemonstrationBoard(30, 40);
            let parseError = null;
            try {
                new Board(boardDef);
            } catch (e) {
                parseError = e;
            }
            return { parseError };
        },
        async (setupData) => {
            // No action needed, setup already performed parsing
            return setupData;
        },
        { parseError: null }, // Expect no parsing error
        (actual, expected) => {
            const pass = actual.parseError === expected.parseError;
            if (!pass) Logger.error(`   FAIL: Expected no parsing error, but got: ${actual.parseError ? actual.parseError.message : 'None'}`);
            return pass;
        }
    )
];

/** Runs all defined test scenarios */
export async function runAllTests() {
    Logger.log("===== STARTING AUTOMATED TESTS =====");
    let passed = 0;
    let failed = 0;

    for (const test of testScenarios) {
        Logger.log(`
--- Test: ${test.description} ---`);
        try {
            const setupData = await test.setup();
            const actual = await test.action(setupData);

            if (actual && actual.health !== undefined) {
                Logger.log(`   Health before assertion: ${actual.health}`);
            }

            // 4. Assert the result
            if (test.assert(actual, test.expected)) {
                Logger.log("   Result: PASS");
                passed++;
            } else {
                // Assertion function should log specific failure details
                Logger.error("   Result: FAIL");
                Logger.log("   Actual final state:", actual);
                Logger.log("   Expected final state:", test.expected);
                failed++;
            }
        } catch (error) {
            Logger.error(`   ERROR during test execution: ${error}`, error.stack);
            failed++;
        }
    }

    Logger.log("===== TESTS COMPLETE =====");
    Logger.log(`Passed: ${passed}, Failed: ${failed}`);
    Logger.log("==========================");

    // Optional: Reset game state after tests? Or assume page reload.
    // Logger.log("Note: Game state may have been altered by tests.");
}