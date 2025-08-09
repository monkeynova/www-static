// tile.js

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
     * like walls, primary type, and methods for interacting with a robot
     * (e.g., conveyor movement, repair station, hole effects).
     */
    
    /** @type {number} */
    row;
    /** @type {number} */
    col;
    /** @type {{type: 'none' | 'hole' | 'repair-station' | 'checkpoint' | 'conveyor' | 'gear', direction?: string, speed?: number, steps?: Set<number>} | null} */
    floorDevice;

    constructor(floorDevice, r, c, walls = [], wallDevices = []) {
        if (!floorDevice) {
            throw new Error(`Invalid floor device definition at (${r}, ${c}): floorDevice is null or undefined.`);
        }

        this.row = r;
        this.col = c;
        this.walls = Array.isArray(walls) ? walls : []; // ADDED THIS LINE
        this.floorDevice = floorDevice;
        this.wallDevices = Array.isArray(wallDevices) ? wallDevices : [];

        // Validate wall devices
        this.wallDevices.forEach(device => {
            if (!device.direction || !ALLOWED_WALL_SIDES.includes(device.direction)) {
                throw new Error(`Invalid ${device.type} direction at (${r}, ${c}).`);
            }
            const requiredWallSide = getOppositeWallSide(device.direction);
            if (!this.walls.includes(requiredWallSide)) {
                throw new Error(`${device.type} at (${r}, ${c}) firing ${device.direction} must be attached to a ${requiredWallSide} wall.`);
            }
            if (device.type === 'pusher' && (!device.steps || device.steps.size === 0)) {
                throw new Error(`Tile at (${r}, ${c}) has a push panel but no activation steps defined (e.g., steps: [1, 3, 5]).`);
            }
        });
    }

    // Helper to get a specific wall device
    getWallDevice(type) {
        return this.wallDevices.find(device => device.type === type);
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
        if (this.floorDevice.type === 'conveyor' && this.floorDevice.speed === 2) {
            let dr = 0, dc = 0;
            let exitSide = '';
            switch (this.floorDevice.direction) {
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
        if (this.floorDevice.type === 'conveyor') {
            let dr = 0, dc = 0;
            let exitSide = '';
            switch (this.floorDevice.direction) {
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
        if (this.floorDevice.type === 'repair-station') {
            const stationKey = `${this.row}-${this.col}`;
            robot.setLastVisitedStation(stationKey);
            robot.heal(); // Repair stations only heal
            Logger.log(`   Robot visited repair station at (${this.row}, ${this.col}) and healed.`);
        }
        return { gameEnded };
    }

    /**
     * Attempts to apply checkpoint effects if the tile is a checkpoint.
     * @param {Robot} robot - The robot instance.
     * @param {Board} board - The board instance.
     * @returns {{gameEnded: boolean}} - Indicates if the game ended (win condition).
     */
    tryApplyCheckpoint(robot, board) {
        let gameEnded = false;
        if (this.floorDevice.type === 'checkpoint') {
            const flagKey = `${this.row}-${this.col}`;
            const flagOrder = this.floorDevice.order;
            robot.setLastVisitedStation(flagKey); // Checkpoints also update last visited station
            robot.heal(); // Checkpoints also heal

            // Only visit if it's the next in order
            const visitedInOrder = robot.visitFlag(flagKey, flagOrder);

            if (visitedInOrder) {
                emit('flagVisited', { flagKey, visitedOrder: robot.getVisitedFlagCount() });
                const visitCount = robot.getVisitedFlagCount();

                Logger.log(`   Visited ${visitCount} / ${board.totalCheckpoints} checkpoints.`);
                if (visitCount === board.totalCheckpoints && board.totalCheckpoints > 0) {
                    Logger.log("   *** WIN CONDITION MET! ***");
                    emit('gameOver', true);
                    gameEnded = true;
                }
            } else {
                Logger.log(`   Checkpoint at (${this.row}, ${this.col}) (Order: ${flagOrder}) not visited in sequence.`);
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
        if (this.floorDevice.type === 'hole') {
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
        const pusher = this.getWallDevice('pusher');
        if (pusher) { // Check the new decorator property
            // If pushPanelFireSteps is defined, only fire on specified steps
            if (pusher.steps.size > 0 && !pusher.steps.has(currentProgramStep)) {
                Logger.log(`      Push Panel at (${this.row},${this.col}) configured to fire only on steps [${Array.from(pusher.steps).join(', ')}], skipping step ${currentProgramStep}.`);
                return { moved: false };
            }
            let dr = 0, dc = 0;
            let exitSide = '';
            const pushDirection = pusher.direction;
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