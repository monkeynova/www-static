// board.js
import * as Logger from './logger.js';
import { ALLOWED_WALL_SIDES } from './config.js'; // Import for validation and laser constants
import { Tile, getOppositeWallSide } from './tile.js';

// Define all allowed tile classes for validation
export const ALLOWED_TILE_CLASSES = new Set([
    'plain',
    'repair-station',
    'hole',
    'conveyor-north',
    'conveyor-east',
    'conveyor-south',
    'conveyor-west',
    'speed-2x',
    'gear-cw',
    'gear-ccw',
    'laser-north',
    'laser-east',
    'laser-south',
    'laser-west',
    'push-north',
    'push-east',
    'push-south',
    'push-west',
]);

export class Board {
    /**
     * Represents the game board, managing a 2D grid of Tile objects.
     * It handles the overall structure of the board, including dimensions,
     * and provides methods for accessing tile data and calculating laser paths.
     */
    /**
     * Creates a new Board instance from a board definition.
     * @param {object[][]} boardDefinition - 2D array of tile objects {type, walls}.
     */
    constructor(boardDefinition) {
        if (!boardDefinition || boardDefinition.length === 0 || !boardDefinition[0] || boardDefinition[0].length === 0) {
            throw new Error("Board definition is empty or invalid.");
        }
        this.rows = boardDefinition.length;
        this.cols = boardDefinition[0].length;
        this.repairStations = [];
        this.tiles = []; // Store processed data for each tile

        Logger.log(`Parsing ${this.rows}x${this.cols} object board definition...`);

        for (let r = 0; r < this.rows; r++) {
            if (!boardDefinition[r] || boardDefinition[r].length !== this.cols) {
                throw new Error(`Board definition row ${r} has inconsistent length or is missing.`);
            }
            const rowTiles = [];
            for (let c = 0; c < this.cols; c++) {
                const tileDef = boardDefinition[r][c];
                const tileData = new Tile(tileDef, r, c);
                rowTiles.push(tileData);

                if (tileData.classes.includes('repair-station')) {
                    this.repairStations.push({ row: r, col: c });
                }
            }
            this.tiles.push(rowTiles);
        }
        Logger.log(`Parsed board. Found ${this.repairStations.length} repair stations.`);
        // Note: Wall consistency (east wall of A matching west wall of B) is assumed
        // to be handled correctly in the definition for now.
    }

    /**
     * Gets the processed data for a specific tile.
     * @param {number} r - Row index.
     * @param {number} c - Column index.
     * @returns {object|null} Tile data object or null if out of bounds.
     */
    getTileData(r, c) {
        if (!this.tiles) return null;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
            return null; // Out of bounds
        }
        return this.tiles[r][c];
    }

    /**
     * Checks if there is a wall on a specific side of a given tile.
     * @param {number} r - Tile's row index.
     * @param {number} c - Tile's column index.
     * @param {'north' | 'south' | 'east' | 'west'} side - The side to check.
     * @returns {boolean} True if a wall exists on that side.
     */
    hasWall(r, c, side) {
        if (!ALLOWED_WALL_SIDES.includes(side)) {
            throw new Error(`Invalid wall side provided: ${side}. Must be one of ${ALLOWED_WALL_SIDES.join(', ')}.`);
        }
        const tileData = this.getTileData(r, c);
        if (!tileData || !tileData.walls) {
            // If tile doesn't exist or has no wall data, assume no wall for safety? Or throw error?
            // Let's assume no wall if tile data is missing, but log a warning.
            // Logger.warn(`Checking wall on non-existent tile or tile without wall data at (${r}, ${c})`);
            return false;
        }

        // Direct check on the specified tile's wall array
        return tileData.hasWall(side);

        // Note: This assumes the definition is consistent. E.g., if tile A has 'east' wall,
        // tile B (to its east) should have 'west' wall defined.
        // A more robust check could look at both adjacent tiles, but relies heavily
        // on the definition being perfectly symmetrical. Let's stick to the simpler check for now.
    }

    /**
     * Calculates the path of a laser beam from a given start tile and direction.
     * The path stops at the first wall or board boundary encountered.
     * @param {number} startR - Starting row of the laser tile.
     * @param {number} startC - Starting column of the laser tile.
     * @param {'north' | 'south' | 'east' | 'west'} laserDirection - The direction the laser fires.
     * @returns {Array<{row: number, col: number}>} An array of coordinates representing the laser path (excluding the laser tile itself).
     */
    getLaserPath(startR, startC, laserDirection, robotState = null) {
        const path = [];
        let currentR = startR;
        let currentC = startC;

        let dr = 0, dc = 0;
        let exitWallSide = ''; // Wall on the current tile that blocks the laser's exit
        let entryWallSide = ''; // Wall on the next tile that blocks the laser's entry

        switch (laserDirection) {
            case 'north': dr = -1; exitWallSide = 'north'; entryWallSide = 'south'; break;
            case 'south': dr = 1;  exitWallSide = 'south'; entryWallSide = 'north'; break;
            case 'east':  dc = 1;  exitWallSide = 'east';  entryWallSide = 'west';  break;
            case 'west':  dc = -1; exitWallSide = 'west';  entryWallSide = 'east';  break;
            default:
                Logger.warn(`Invalid laser direction: ${laserDirection}. Cannot calculate path.`);
                return path; // Return empty path for invalid direction
        }

        // Start checking from the tile *adjacent* to the laser emitter
        let nextR = startR + dr;
        let nextC = startC + dc;

        while (true) {
            // Check boundaries for the *next* tile
            if (nextR < 0 || nextR >= this.rows || nextC < 0 || nextC >= this.cols) {
                break; // Out of bounds, path ends
            }

            // Check for robot in the next tile
            if (robotState && nextR === robotState.row && nextC === robotState.col) {
                path.push({ row: nextR, col: nextC }); // Include the robot's tile
                break; // Laser hit the robot
            }

            // Check for a wall on the *current* tile (from which the laser is exiting)
            // This is the wall on the emitter tile for the first step, or the previous path tile for subsequent steps.
            if (this.getTileData(currentR, currentC).hasWall(exitWallSide)) {
                // If the current tile (or emitter) has a wall blocking exit, the laser stops *before* entering nextR, nextC
                // For the emitter tile, we assume the laser successfully exits.
                if (!(currentR === startR && currentC === startC)) { // Don't block on the emitter's own wall
                    break; 
                }
            }

            // Check for a wall on the *next* tile (which the laser is trying to enter)
            if (this.getTileData(nextR, nextC).hasWall(entryWallSide)) {
                // Laser hit a wall on the next tile's entry side, so it stops *before* entering this tile.
                break; // Laser stops here, do not include this tile in path
            }

            path.push({ row: nextR, col: nextC });

            // Move to the next tile for the next iteration
            currentR = nextR;
            currentC = nextC;
            nextR += dr;
            nextC += dc;
        }

        return path;
    }
}