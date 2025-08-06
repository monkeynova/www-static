// tile.js
import { ALLOWED_TILE_CLASSES } from './board.js'; // Assuming ALLOWED_TILE_CLASSES remains in board.js for now
import { ALLOWED_WALL_SIDES } from './config.js'; // For validation
import * as Logger from './logger.js';
import * as Config from './config.js';
import { emit } from './eventEmitter.js';

/**
 * Helper function to get the opposite wall side for a given direction.
 * (This function would be moved from board.js to here, or kept internal to Board if only Board uses it)
 * @param {'north' | 'south' | 'east' | 'west'} direction
 * @returns {'north' | 'south' | 'east' | 'west' | null}
 */
export function getOppositeWallSide(direction) {
    switch (direction) {
        case 'north': return 'south';
        case 'south': return 'north';
        case 'east': return 'west';
        case 'west': return 'east';
        default: return null;
    }
}

export class Tile {
    /**
     * Represents a single tile on the game board, encapsulating its properties
     * like classes, walls, primary type, and methods for interacting with a robot
     * (e.g., conveyor movement, repair station, hole effects).
     */
    /** @type {string[]} */
    classes;
    /** @type {string[]} */
    walls;
    /** @type {number} */
    row;
    /** @type {number} */
    col;
    /** @type {string} */
    primaryType;
    /** @type {number} */
    speed;
    /** @type {string | null} */
    conveyorDirection;
    /** @type {string | null} */
    laserDirection;
    /** @type {Set<number>} */
    pushPanelFireSteps; // NEW: Steps on which this push panel fires

    /**
     * Creates a new Tile instance from a raw tile definition.
     * @param {object} tileDef - The raw tile definition object {classes, walls}.
     * @param {number} r - The row index of the tile.
     * @param {number} c - The column index of the tile.
     */
    constructor(tileDef, r, c) {
        if (!tileDef || !Array.isArray(tileDef.classes)) {
            throw new Error(`Invalid tile definition at (${r}, ${c}): missing 'classes' array.`);
        }

        this.row = r;
        this.col = c;
        this.classes = ['tile', ...tileDef.classes]; // Combine base 'tile' with defined classes
        this.walls = Array.isArray(tileDef.walls) ? tileDef.walls : [];

        // Initialize pushPanelFireSteps
        this.pushPanelFireSteps = new Set();
        const pushStepsClass = this.classes.find(cls => cls.startsWith('push-steps-'));
        if (pushStepsClass) {
            const stepsStr = pushStepsClass.substring('push-steps-'.length);
            stepsStr.split('-').forEach(step => {
                const stepNum = parseInt(step, 10);
                if (!isNaN(stepNum) && stepNum >= 1 && stepNum <= Config.PROGRAM_SIZE) {
                    this.pushPanelFireSteps.add(stepNum);
                } else {
                    Logger.warn(`Invalid push step '${step}' in class '${pushStepsClass}' at (${r}, ${c}). Ignoring.`);
                }
            });
        }

        // Validate all defined classes
        for (const cls of tileDef.classes) {
            // Skip validation for push- and push-steps- classes as they are decorators and not primary tile types
            if (cls.startsWith('push-')) continue;
            if (cls.startsWith('push-steps-')) continue;
            if (!ALLOWED_TILE_CLASSES.has(cls)) {
                throw new Error(`Invalid or unknown tile class '${cls}' at (${r}, ${c}).`);
            }
        }

        // Determine primaryType based on non-modifier classes
        if (this.classes.includes('repair-station')) {
            this.primaryType = 'repair-station';
        } else if (this.classes.includes('hole')) {
            this.primaryType = 'hole';
        } else if (this.classes.includes('gear-cw')) {
            this.primaryType = 'gear-cw';
        } else if (this.classes.includes('gear-ccw')) {
            this.primaryType = 'gear-ccw';
        } else {
            const foundConveyorClass = this.classes.find(cls => cls.startsWith('conveyor-'));
            if (foundConveyorClass) {
                this.primaryType = 'conveyor';
                this.conveyorDirection = foundConveyorClass.split('-')[1];
            } else {
                this.primaryType = 'plain'; // Default primary type
            }
        }

        this.hasPushPanel = this.classes.some(cls => cls.startsWith('push-'));

        // Extract laser direction if present
        const foundLaserClass = this.classes.find(cls => cls.startsWith('laser-'));
        if (foundLaserClass) {
            this.laserDirection = foundLaserClass.split('-')[1];
            const requiredWallSide = getOppositeWallSide(this.laserDirection);
            if (!this.walls.includes(requiredWallSide)) {
                throw new Error(`Laser at (${r}, ${c}) firing ${this.laserDirection} must be attached to a ${requiredWallSide} wall.`);
            }
        } else {
            this.laserDirection = null;
        }

        // Validate push panel attachment to a wall
        const foundPushClass = this.classes.find(cls => cls.startsWith('push-'));
        if (foundPushClass) {
            const pushDirection = foundPushClass.split('-')[1];
            const requiredWallSide = getOppositeWallSide(pushDirection);
            if (!this.walls.includes(requiredWallSide)) {
                throw new Error(`Push panel at (${r}, ${c}) pushing ${pushDirection} must be attached to a ${requiredWallSide} wall.`);
            }
        }

        this.speed = this.classes.includes('speed-2x') ? 2 : 1; // Speed only applies to conveyors
    }

    /**
     * Checks if there is a wall on a specific side of this tile.
     * @param {'north' | 'south' | 'east' | 'west'} side - The side to check.
     * @returns {boolean} True if a wall exists on that side.
     */
    hasWall(side) {
        if (!ALLOWED_WALL_SIDES.includes(side)) {
            throw new Error(`Invalid wall side provided: ${side}. Must be one of ${ALLOWED_WALL_SIDES.join(', ')}.`);
        }
        return this.walls.includes(side);
    }

    /**
     * Attempts to apply a 2x speed conveyor movement from this tile.
     * @param {object} robotState - The current state of the robot (row, col, orientation).
     * @param {Board} board - The board instance for boundary/wall checks.
     * @returns {{moved: boolean, newR?: number, newC?: number}} - Indicates if a move occurred and the new position.
     */
    tryApplySpeed2xConveyor(robotState, board) {
        if (this.primaryType === 'conveyor' && this.speed === 2) {
            let dr = 0, dc = 0;
            let exitSide = '';
            switch (this.conveyorDirection) {
                case 'north': dr = -1; exitSide = 'north'; break;
                case 'south': dr = 1;  exitSide = 'south'; break;
                case 'west':  dc = -1; exitSide = 'west';  break;
                case 'east':  dc = 1;  exitSide = 'east';  break;
            }

            if (dr !== 0 || dc !== 0) {
                const nextR = this.row + dr;
                const nextC = this.col + dc;

                const targetTileData = board.getTileData(nextR, nextC);
                const blockedByWall = this.hasWall(exitSide) ||
                                      (targetTileData && targetTileData.hasWall(dr === 1 ? 'north' : (dr === -1 ? 'south' : (dc === 1 ? 'west' : 'east'))));

                if (targetTileData && !blockedByWall) {
                    Logger.log(`      2x Conveyor moving from (${this.row},${this.col}) to (${nextR},${nextC})`);
                    return { moved: true, newR: nextR, newC: nextC };
                } else {
                    Logger.log(`      2x Conveyor at (${this.row},${this.col}) blocked (Wall: ${blockedByWall}, Boundary: ${!targetTileData}).`);
                }
            }
        }
        return { moved: false };
    }

    /**
     * Attempts to apply a 1x or 2x speed conveyor movement from this tile.
     * @param {object} robotState - The current state of the robot (row, col, orientation).
     * @param {Board} board - The board instance for boundary/wall checks.
     * @returns {{moved: boolean, newR?: number, newC?: number}} - Indicates if a move occurred and the new position.
     */
    tryApplyConveyor(robotState, board) {
        if (this.primaryType === 'conveyor') {
            let dr = 0, dc = 0;
            let exitSide = '';
            switch (this.conveyorDirection) {
                case 'north': dr = -1; exitSide = 'north'; break;
                case 'south': dr = 1;  exitSide = 'south'; break;
                case 'west':  dc = -1; exitSide = 'west';  break;
                case 'east':  dc = 1;  exitSide = 'east';  break;
            }

            if (dr !== 0 || dc !== 0) {
                const nextR = this.row + dr;
                const nextC = this.col + dc;

                const targetTileData = board.getTileData(nextR, nextC);
                const blockedByWall = this.hasWall(exitSide) ||
                                      (targetTileData && targetTileData.hasWall(dr === 1 ? 'north' : (dr === -1 ? 'south' : (dc === 1 ? 'west' : 'east'))));

                if (targetTileData && !blockedByWall) {
                    Logger.log(`      1x/2x Conveyor moving from (${this.row},${this.col}) to (${nextR},${nextC})`);
                    return { moved: true, newR: nextR, newC: nextC };
                } else {
                    Logger.log(`      1x/2x Conveyor at (${this.row},${this.col}) blocked (Wall: ${blockedByWall}, Boundary: ${!targetTileData}).`);
                }
            }
        }
        return { moved: false };
    }

    /**
     * Attempts to apply repair station effects if the tile is a repair station.
     * @param {Robot} robot - The robot instance.
     * @param {Board} board - The board instance.
     * @returns {{gameEnded: boolean}} - Indicates if the game ended (win condition).
     */
    tryApplyRepairStation(robot, board) {
        let gameEnded = false;
        if (this.classes.includes('repair-station')) {
            const stationKey = `${this.row}-${this.col}`;
            robot.setLastVisitedStation(stationKey);

            if (!robot.hasVisitedStation(stationKey)) {
                Logger.log(`   Visiting NEW repair station at (${this.row}, ${this.col})!`);
                robot.visitStation(stationKey);
                emit('flagVisited', stationKey);
                const visitCount = robot.getVisitedStationCount();

                Logger.log(`   Visited ${visitCount} / ${board.repairStations.length} stations.`);
                if (visitCount === board.repairStations.length && board.repairStations.length > 0) {
                    Logger.log("   *** WIN CONDITION MET! ***");
                    emit('gameOver', true);
                    gameEnded = true;
                }
            } else {
                Logger.log(`   Already visited repair station at (${this.row}, ${this.col}).`);
            }
        }
        return { gameEnded };
    }

    /**
     * Attempts to apply hole effects if the tile is a hole.
     * @param {Robot} robot - The robot instance.
     * @param {Board} board - The board instance.
     * @returns {{gameEnded: boolean, fellInHole: boolean}} - Indicates if the game ended or robot fell in a hole.
     */
    async tryApplyHole(robot, board) {
        let gameEnded = false;
        let fellInHole = false;
        if (this.classes.includes('hole')) {
            Logger.log(`   Robot landed on a hole at (${this.row}, ${this.col})!`);
            fellInHole = true;
            robot.takeDamage();

            if (robot.isDestroyed()) {
                Logger.error("   *** ROBOT DESTROYED by falling in hole! ***");
                emit('gameOver', false);
                gameEnded = true;
            } else {
                const lastKey = robot.getRobotState().lastVisitedStationKey;
                if (lastKey) {
                    Logger.log(`   Returning to last visited station: ${lastKey}`);
                    const [lastR, lastC] = lastKey.split('-').map(Number);
                    if (board.getTileData(lastR, lastC)) {
                        robot.setPosition(lastR, lastC);
                        // No await sleep here, as it's handled by gameLoop after this function returns
                    } else {
                        Logger.error(`   Last visited station key ${lastKey} points to an invalid tile! Cannot return.`);
                    }
                } else {
                    Logger.error("   Fell in hole, but no last visited repair station recorded! Cannot return.");
                }
            }
        }
        return { gameEnded, fellInHole };
    }

    /**
     * Attempts to apply push panel movement from this tile.
     * @param {object} robotState - The current state of the robot (row, col, orientation).
     * @param {Board} board - The board instance for boundary/wall checks.
     * @param {number} currentProgramStep - The current step number of the program execution.
     * @returns {{moved: boolean, newR?: number, newC?: number}} - Indicates if a move occurred and the new position.
     */
    tryPushPanel(robotState, board, currentProgramStep) {
        if (this.hasPushPanel) { // Check the new decorator property
            // If pushPanelFireSteps is defined, only fire on specified steps
            if (this.pushPanelFireSteps.size > 0 && !this.pushPanelFireSteps.has(currentProgramStep)) {
                Logger.log(`      Push Panel at (${this.row},${this.col}) configured to fire only on steps [${Array.from(this.pushPanelFireSteps).join(', ')}], skipping step ${currentProgramStep}.`);
                return { moved: false };
            }
            let dr = 0, dc = 0;
            let exitSide = '';
            const pushDirection = this.classes.find(cls => cls.startsWith('push-')).split('-')[1];
            switch (pushDirection) {
                case 'north': dr = -1; exitSide = 'north'; break;
                case 'south': dr = 1;  exitSide = 'south'; break;
                case 'west':  dc = -1; exitSide = 'west';  break;
                case 'east':  dc = 1;  exitSide = 'east';  break;
            }

            if (dr !== 0 || dc !== 0) {
                const nextR = this.row + dr;
                const nextC = this.col + dc;

                const targetTileData = board.getTileData(nextR, nextC);
                const blockedByWall = this.hasWall(exitSide) ||
                                      (targetTileData && targetTileData.hasWall(dr === 1 ? 'north' : (dr === -1 ? 'south' : (dc === 1 ? 'west' : 'east'))));

                if (targetTileData && !blockedByWall) {
                    Logger.log(`      Push Panel moving from (${this.row},${this.col}) to (${nextR},${nextC})`);
                    return { moved: true, newR: nextR, newC: nextC };
                } else {
                    Logger.log(`      Push Panel at (${this.row},${this.col}) blocked (Wall: ${blockedByWall}, Boundary: ${!targetTileData}).`);
                }
            }
        }
        return { moved: false };
    }
}