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
                    { floorDevice: { type: 'conveyor', direction: 'east', speed: 2 }, walls: ['north', 'west'] },
                    { floorDevice: { type: 'conveyor', direction: 'east', speed: 1 }, walls: ['north'] },
                    { walls: ['north'] },
                    { walls: ['north', 'east'] }
                ],
                // Row 1
                [
                    { walls: ['south', 'west'] },
                    { walls: ['south'] },
                    { walls: ['south'] },
                    { walls: ['south', 'east'] }
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
                [ { floorDevice: { type: 'conveyor', direction: 'east', speed: 1 }, walls: ['north', 'west'] }, { floorDevice: { type: 'conveyor', direction: 'east', speed: 1 }, walls: ['north'] }, { walls: ['north', 'east'] } ],
                [ { walls: ['south', 'west'] }, { walls: ['south'] }, { walls: ['south', 'east'] } ]
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
                [ { floorDevice: { type: 'conveyor', direction: 'east', speed: 2 }, walls: ['north', 'west'] }, { walls: ['north', 'east'] } ], // Wall east of (0,1)
                [ { walls: ['south', 'west'] }, { walls: ['south', 'east'] } ]
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

    defineTest(
        "Push Panel: Basic push north",
        async () => {
            const testBoardDef = [
                [{ walls: ['north', 'west'] }, { walls: ['north'] }, { walls: ['north', 'east'] }],
                [{ walls: ['west'] }, { walls: ['south'], wallDevices: [{ type: 'pusher', direction: 'north', steps: new Set([1, 2, 3, 4, 5]) }] }, { walls: ['east'] }], // Push north panel at (1,1)
                [{ walls: ['south', 'west'] }, { walls: ['south'] }, { walls: ['south', 'east'] }]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(1, 1, 'north'); // Robot starts on push panel
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot, 1); // Pass step 1
            return setupData.robot.getRobotState();
        },
        { robot: { row: 0, col: 1, orientation: 'north' } }, // Expected: Moves to (0,1)
        (actual, expected) => {
            const posMatch = actual.row === expected.robot.row && actual.col === expected.robot.col;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            return posMatch;
        }
    ),

    defineTest(
        "Push Panel: Blocked by wall",
        async () => {
            const testBoardDef = [
                [{ walls: ['north', 'west'] }, { walls: ['north', 'east'] }],
                [{ walls: ['west'], wallDevices: [{ type: 'pusher', direction: 'east', steps: new Set([1, 2, 3, 4, 5]) }] }, { walls: ['west', 'east'] }] // Push east panel at (1,0), Tile (1,1) has a west wall
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(1, 0, 'east'); // Robot starts on push panel
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot);
            return setupData.robot.getRobotState();
        },
        { robot: { row: 1, col: 0, orientation: 'east' } }, // Expected: Stays at (1,0)
        (actual, expected) => {
            const posMatch = actual.row === expected.robot.row && actual.col === expected.robot.col;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            return posMatch;
        }
    ),

    defineTest(
        "Push Panel: Pushes into hole",
        async () => {
            const testBoardDef = [
                [{ walls: ['north', 'west'] }, { floorDevice: { type: 'hole' }, walls: [] }, { walls: ['north', 'east'] }], // Hole at (0,1)
                [{ walls: ['west'] }, { walls: ['south'], wallDevices: [{ type: 'pusher', direction: 'north', steps: new Set([1, 2, 3, 4, 5]) }] }, { walls: ['east'] }], // Push north panel at (1,1)
                [{ walls: ['south', 'west'] }, { walls: ['south'] }, { walls: ['south', 'east'] }]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(1, 1, 'north'); // Robot starts on push panel
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot, 1); // Pass step 1
            return setupData.robot.getRobotState();
        },
        { robot: { row: 0, col: 1, orientation: 'north', health: Config.MAX_HEALTH - 1 } }, // Expected: Moves to (0,1) and takes damage
        (actual, expected) => {
            const posMatch = actual.row === expected.robot.row && actual.col === expected.robot.col;
            const healthMatch = actual.health === expected.robot.health;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            if (!healthMatch) Logger.error(`   FAIL: Health mismatch. Expected ${expected.robot.health}, Got ${actual.health}`);
            return posMatch && healthMatch;
        }
    ),

    defineTest(
        "Conveyor -> Push Panel: Robot moved by conveyor onto push panel, then pushed perpendicularly",
        async () => {
            const testBoardDef = [
                [{ walls: ['north', 'west'] }, { walls: ['north'] }, { walls: ['north', 'east'] }],
                [{ floorDevice: { type: 'conveyor', direction: 'east', speed: 1 }, walls: ['west'] }, { walls: ['south'], wallDevices: [{ type: 'pusher', direction: 'north', steps: new Set([1, 2, 3, 4, 5]) }] }, { walls: ['east'] }], // Conveyor at (1,0), Push north panel at (1,1)
                [{ walls: ['south', 'west'] }, { walls: ['south'] }, { walls: ['south', 'east'] }]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(1, 0, 'east'); // Robot starts on conveyor
            return { boardData, robot };
        },
        async (setupData) => {
            await GameLoop.applyBoardEffects(setupData.boardData, setupData.robot, 1); // Pass a dummy step, as this test doesn't rely on steps
            return setupData.robot.getRobotState();
        },
        { robot: { row: 0, col: 1, orientation: 'east' } }, // Expected: Moves from (1,0) to (1,1) by conveyor, then to (0,1) by push panel
        (actual, expected) => {
            const posMatch = actual.row === expected.robot.row && actual.col === expected.robot.col;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            return posMatch;
        }
    ),

    defineTest(
        "Push Panel: Does not fire on off-step",
        async () => {
            const testBoardDef = [
                [{ walls: ['north', 'west'] }, { walls: ['north'] }, { walls: ['north', 'east'] }],
                [{ walls: ['west'] }, { walls: ['south'], wallDevices: [{ type: 'pusher', direction: 'north', steps: new Set([2, 4]) }] }, { walls: ['east'] }], // Push north panel at (1,1), fires on steps 2 and 4
                [{ walls: ['south', 'west'] }, { walls: ['south'] }, { walls: ['south', 'east'] }]
            ];
            const boardData = new Board(testBoardDef);
            const robot = new Robot(1, 1, 'north'); // Robot starts on push panel

            // Program: Turn L (step 1), Turn R (step 2), Move 1 (step 3)
            const programCards = [
                { type: 'turnL', text: 'Turn L', instanceId: 'card-1' },
                { type: 'turnR', text: 'Turn R', instanceId: 'card-2' },
                { type: 'move1', text: 'Move 1', instanceId: 'card-3' },
                { type: 'move1', text: 'Move 1', instanceId: 'card-4' },
                { type: 'move1', text: 'Move 1', instanceId: 'card-5' },
            ];
            robot.setProgram(programCards);

            return { boardData, robot };
        },
        async (setupData) => {
            // Only run the first step of the program
            const robot = setupData.robot;
            const boardData = setupData.boardData;
            const programCards = robot.getProgram();

            const cardData = programCards[0]; // First card (step 1)
            Logger.log(`
Executing Card 1: ${cardData.type} (${cardData.text})
`);

            // Execute Card Action (Turn L - no movement)
            if (cardData.type === 'turnL') {
                robot.turn(Config.TURN_LEFT);
            }

            await GameLoop.applyBoardEffects(boardData, robot, 1); // Pass step 1

            return robot.getRobotState();
        },
        { robot: { row: 1, col: 1, orientation: 'west' } }, // Expected: Robot stays at (1,1), turns west, because push panel doesn't fire on step 1
        (actual, expected) => {
            const posMatch = actual.row === expected.robot.row && actual.col === expected.robot.col;
            if (!posMatch) Logger.error(`   FAIL: Position mismatch. Expected (${expected.robot.row},${expected.robot.col}), Got (${actual.row},${actual.col})`);
            return posMatch;
        }
    ),

    defineTest(
        "Movement: Move 1 forward hits wall",
        async () => {
            const testBoardDef = [
                [ { walls: ['north', 'west', 'east'] }, { walls: ['north', 'east'] } ], // Wall east of (0,0)
                [ { walls: ['south', 'west'] }, { walls: ['south', 'east'] } ]
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
                    { walls: ['north', 'west'] }, // Tile (0,0)
                    { walls: ['north', 'west'] }, // Tile (0,1) - Add 'west' wall
                    { walls: ['north', 'east'] }  // Tile (0,2)
                ],
                // Row 1
                [
                    { walls: ['south', 'west'] },
                    { walls: ['south'] },
                    { walls: ['south', 'east'] }
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
                [ { walls: ['north', 'west'], floorDevice: { type: 'gear', direction: 'cw' } }, { walls: ['north', 'east'] } ],
                [ { walls: ['south', 'west'] }, { walls: ['south', 'east'] } ]
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
                [ { walls: ['north', 'west'], floorDevice: { type: 'gear', direction: 'ccw' } }, { walls: ['north', 'east'] } ],
                [ { walls: ['south', 'west'] }, { walls: ['south', 'east'] } ]
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
                    { floorDevice: { type: 'conveyor', direction: 'east', speed: 1 }, walls: ['north', 'west'] }, // (0,0)
                    { walls: ['north'], floorDevice: { type: 'gear', direction: 'cw' } },                 // (0,1)
                    { walls: ['north', 'east'] }            // (0,2)
                ],
                // Row 1
                [
                    { walls: ['south', 'west'] },
                    { walls: ['south'] },
                    { walls: ['south', 'east'] }
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
                [ { walls: ['north', 'west', 'east'], wallDevices: [{ type: 'laser', direction: 'east' }] }, { walls: ['north'] }, { walls: ['north', 'east'] } ],
                [ { walls: ['south', 'west'] }, { walls: ['south'] }, { walls: ['south', 'east'] } ]
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
                [ { walls: ['north', 'west'], wallDevices: [{ type: 'laser', direction: 'east' }] }, { walls: ['north', 'west'] }, { walls: [ 'north', 'east'] } ], // Wall west of (0,1)
                [ { walls: ['south', 'west'] }, { walls: ['south'] }, { walls: ['south', 'east'] } ]
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
                [ { floorDevice: { type: 'conveyor', direction: 'east', speed: 1 }, walls: ['north', 'west'] }, { walls: ['north'] }, { walls: ['north', 'east', 'south'], wallDevices: [{ type: 'laser', direction: 'north' }] } ], // Added south wall
                [ { walls: ['south', 'west'] }, { walls: ['south'] }, { walls: ['south', 'east'] } ]
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
                [ { walls: ['north', 'south'], wallDevices: [{ type: 'laser', direction: 'east' }] } ] // Missing 'west' wall
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
                [ { walls: ['north', 'west'] }, { floorDevice: { type: 'conveyor', direction: 'east', speed: 1 }, walls: ['north', 'west', 'east'], wallDevices: [{ type: 'laser', direction: 'east' }] }, { walls: ['north', 'east'] } ],
                [ { walls: ['south', 'west'] }, { walls: ['south'] }, { walls: ['south', 'east'] } ]
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
                [ { walls: ['north', 'west'] }, { walls: ['north', 'south'], floorDevice: { type: 'gear', direction: 'cw' }, wallDevices: [{ type: 'laser', direction: 'north' }] }, { walls: ['north', 'east'] } ],
                [ { walls: ['south', 'west'] }, { walls: ['south'] }, { walls: ['south', 'east'] } ]
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