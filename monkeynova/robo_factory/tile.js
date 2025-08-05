// tile.js
import { ALLOWED_TILE_CLASSES } from './board.js'; // Assuming ALLOWED_TILE_CLASSES remains in board.js for now
import { ALLOWED_WALL_SIDES } from './config.js'; // For validation

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

        // Validate all defined classes
        for (const cls of tileDef.classes) {
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
                    return { moved: true, newR: nextR, newC: nextC };
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
                    return { moved: true, newR: nextR, newC: nextC };
                }
            }
        }
        return { moved: false };
    }
}