// board.js
import * as Logger from './logger.js';
import { ALLOWED_WALL_SIDES, TILE_SYMBOLS } from './config.js'; // Import for validation and laser constants
import { Tile, getOppositeWallSide } from './tile.js';

export class Board {
    /**
     * Represents the game board, managing a 2D grid of Tile objects.
     * It handles the overall structure of the board, including dimensions,
     * and provides methods for accessing tile data and calculating laser paths.
     */
    /**
     * Creates a new Board instance from a board definition.
     * Parses the raw board definition into a grid of Tile objects, validating tile properties.
     * @param {object[][]} boardDefinition - 2D array of tile objects {type, walls}.
     */
    constructor(boardDefinition) {
        if (!boardDefinition || boardDefinition.length === 0 || !boardDefinition[0] || boardDefinition[0].length === 0) {
            throw new Error("Board definition is empty or invalid.");
        }
        this.rows = boardDefinition.length;
        this.cols = boardDefinition[0].length;
        this.flags = [];
        this.tiles = [];

        Logger.log(`Parsing ${this.rows}x${this.cols} object board definition...`);

        for (let r = 0; r < this.rows; r++) {
            if (!boardDefinition[r] || boardDefinition[r].length !== this.cols) {
                throw new Error(`Board definition row ${r} has inconsistent length or is missing.`);
            }
            const rowTiles = [];
            for (let c = 0; c < this.cols; c++) {
                const tileDef = boardDefinition[r][c];
                const floorDevice = tileDef.floorDevice || { type: 'none' };

                if (!floorDevice.type) {
                    throw new Error(`Tile at (${r}, ${c}) is missing floorDevice type.`);
                }

                if (floorDevice.type === 'gear') {
                    if (floorDevice.direction !== 'cw' && floorDevice.direction !== 'ccw') {
                        throw new Error(`Invalid gear direction '${floorDevice.direction}' at (${r}, ${c}). Must be 'cw' or 'ccw'.`);
                    }
                }
                if (floorDevice.type === 'conveyor') {
                    if (!floorDevice.direction || !ALLOWED_WALL_SIDES.includes(floorDevice.direction)) {
                        throw new Error(`Invalid conveyor direction at (${r}, ${c}).`);
                    }
                    if (floorDevice.speed !== 1 && floorDevice.speed !== 2) {
                        throw new Error(`Invalid conveyor speed '${floorDevice.speed}' at (${r}, ${c}). Must be 1 or 2.`);
                    }
                }

                if (floorDevice.type === 'checkpoint') {
                    if (typeof floorDevice.order !== 'number' || floorDevice.order < 1) {
                        throw new Error(`Checkpoint at (${r}, ${c}) is missing a valid 'order' property (must be a number >= 1).`);
                    }
                }

                const tileData = new Tile(floorDevice, r, c, tileDef.walls, tileDef.wallDevices);
                rowTiles.push(tileData);

                if (tileData.floorDevice.type === 'repair-station' || tileData.floorDevice.type === 'checkpoint') {
                    this.flags.push({ row: r, col: c, type: tileData.floorDevice.type, order: tileData.floorDevice.order });
                }
            }
            this.tiles.push(rowTiles);
        }

        // Sort flags by order and count total checkpoints
        this.flags.sort((a, b) => a.order - b.order);
        this.totalCheckpoints = this.flags.filter(flag => flag.type === 'checkpoint').length;

        Logger.log(`Parsed board. Found ${this.flags.length} flags.`);
        Logger.log(`Total checkpoints: ${this.totalCheckpoints}`);
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
            return false;
        }

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
        let exitWallSide = '';
        let entryWallSide = '';

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

            // Laser hit a wall on the next tile's entry side, so it stops *before* entering this tile.
            if (this.getTileData(nextR, nextC).hasWall(entryWallSide)) {
                break;
            }

            path.push({ row: nextR, col: nextC });

            currentR = nextR;
            currentC = nextC;
            nextR += dr;
            nextC += dc;
        }

        return path;
    }

    /**
     * Applies damage to the robot if it is in the path of any laser on the board.
     * @param {Robot} robot - The robot instance.
     * @param {Function} sleep - The sleep utility function from gameLoop.js.
     * @returns {Promise<boolean>} True if the game ended due to laser damage, false otherwise.
     */
    async applyLasers(robot, sleep) {
        Logger.log("   Checking for laser fire...");
        let gameEnded = false;

        // Iterate through all tiles to find lasers
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.getTileData(r, c);
                const laserDevice = tile ? tile.getWallDevice('laser') : null;
                if (laserDevice) {
                    // Check if robot is on the laser emitter tile itself
                    const robotOnEmitter = (robot.row === r && robot.col === c);

                    const laserPath = this.getLaserPath(r, c, laserDevice.direction, robot.getRobotState());
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
                            gameEnded = true;
                            return true;
                        }
                    }
                }
            }
        }
        return gameEnded;
    }
}