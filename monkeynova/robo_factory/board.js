// board.js
import * as Logger from './logger.js';
import { ALLOWED_WALL_SIDES, LASER_NORTH, LASER_EAST, LASER_SOUTH, LASER_WEST } from './config.js'; // Import for validation and laser constants

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
]);

/**
 * Parses the board layout defined as an array of objects.
 * @param {object[][]} boardDefinition - 2D array of tile objects {type, walls}.
 * @returns {object} { rows, cols, repairStations, tiles }
 */
export function parseBoardObjectDefinition(boardDefinition) {
    if (!boardDefinition || boardDefinition.length === 0 || !boardDefinition[0] || boardDefinition[0].length === 0) {
        throw new Error("Board definition is empty or invalid.");
    }
    const rows = boardDefinition.length;
    const cols = boardDefinition[0].length;
    const repairStations = [];
    const tiles = []; // Store processed data for each tile

    Logger.log(`Parsing ${rows}x${cols} object board definition...`);

    for (let r = 0; r < rows; r++) {
        if (!boardDefinition[r] || boardDefinition[r].length !== cols) {
            throw new Error(`Board definition row ${r} has inconsistent length or is missing.`);
        }
        const rowTiles = [];
        for (let c = 0; c < cols; c++) {
            const tileDef = boardDefinition[r][c];
            if (!tileDef || !Array.isArray(tileDef.classes)) { // Check for classes array
                throw new Error(`Invalid tile definition at (${r}, ${c})`);
            }

            const definedClasses = tileDef.classes;
            // Validate all defined classes
            for (const cls of definedClasses) {
                if (!ALLOWED_TILE_CLASSES.has(cls)) {
                    throw new Error(`Invalid or unknown tile class '${cls}' at (${r}, ${c}).`);
                }
            }
            const walls = Array.isArray(tileDef.walls) ? tileDef.walls : [];
            let primaryType = 'plain'; // Default primary type
            let conveyorDirection = null;
            let laserDirection = null;

            // Determine primaryType based on non-modifier classes
            if (definedClasses.includes('repair-station')) {
                primaryType = 'repair-station';
            } else if (definedClasses.includes('hole')) {
                primaryType = 'hole';
            } else if (definedClasses.includes('gear-cw')) {
                primaryType = 'gear-cw';
            } else if (definedClasses.includes('gear-ccw')) {
                primaryType = 'gear-ccw';
            } else { // If no other specific primary type, check for conveyor
                const foundConveyorClass = definedClasses.find(cls => cls.startsWith('conveyor-'));
                if (foundConveyorClass) {
                    primaryType = 'conveyor';
                    conveyorDirection = foundConveyorClass.split('-')[1];
                }
            }

            // Extract laser direction if present (laser is a decoration, not a primary type)
            const foundLaserClass = definedClasses.find(cls => cls.startsWith('laser-'));
            if (foundLaserClass) {
                laserDirection = foundLaserClass.split('-')[1];
                // NEW: Validate laser attachment to a wall (must be on the opposite side of firing direction)
                const requiredWallSide = getOppositeWallSide(laserDirection);
                if (!walls.includes(requiredWallSide)) {
                    throw new Error(`Laser at (${r}, ${c}) firing ${laserDirection} must be attached to a ${requiredWallSide} wall.`);
                }
            }

            const speed = definedClasses.includes('speed-2x') ? 2 : 1; // Speed only applies to conveyors

            const tileData = {
                classes: ['tile', ...definedClasses], // Combine base 'tile' with defined classes
                walls: walls,
                row: r,
                col: c,
                primaryType: primaryType,
                speed: speed,
                conveyorDirection: conveyorDirection, // Specific for conveyors
                laserDirection: laserDirection // Specific for lasers
            };
            rowTiles.push(tileData);

            if (definedClasses.includes('repair-station')) {
                repairStations.push({ row: r, col: c });
            }
        }
        tiles.push(rowTiles);
    }
    Logger.log(`Parsed board. Found ${repairStations.length} repair stations.`);
    // Note: Wall consistency (east wall of A matching west wall of B) is assumed
    // to be handled correctly in the definition for now.
    return { rows, cols, repairStations, tiles };
}

/**
 * Helper function to get the opposite wall side for a given direction.
 * @param {'north' | 'south' | 'east' | 'west'} direction
 * @returns {'north' | 'south' | 'east' | 'west' | null}
 */
function getOppositeWallSide(direction) {
    switch (direction) {
        case 'north': return 'south';
        case 'south': return 'north';
        case 'east': return 'west';
        case 'west': return 'east';
        default: return null; // Should not happen with valid laser directions
    }
}

/**
 * Gets the processed data for a specific tile.
 * @param {number} r - Row index.
 * @param {number} c - Column index.
 * @param {object} boardData - The object returned by parseBoardObjectDefinition.
 * @returns {object|null} Tile data object or null if out of bounds.
 */
export function getTileData(r, c, boardData) {
    if (!boardData || !boardData.tiles) return null;
    if (r < 0 || r >= boardData.rows || c < 0 || c >= boardData.cols) {
        return null; // Out of bounds
    }
    return boardData.tiles[r][c];
}

/**
 * Checks if there is a wall on a specific side of a given tile.
 * @param {number} r - Tile's row index.
 * @param {number} c - Tile's column index.
 * @param {'north' | 'south' | 'east' | 'west'} side - The side to check.
 * @param {object} boardData - The object returned by parseBoardObjectDefinition.
 * @returns {boolean} True if a wall exists on that side.
 */
export function hasWall(r, c, side, boardData) {
    if (!ALLOWED_WALL_SIDES.includes(side)) {
        throw new Error(`Invalid wall side provided: ${side}. Must be one of ${ALLOWED_WALL_SIDES.join(', ')}.`);
    }
    const tileData = getTileData(r, c, boardData);
    if (!tileData || !tileData.walls) {
        // If tile doesn't exist or has no wall data, assume no wall for safety? Or throw error?
        // Let's assume no wall if tile data is missing, but log a warning.
        // Logger.warn(`Checking wall on non-existent tile or tile without wall data at (${r}, ${c})`);
        return false;
    }

    // Direct check on the specified tile's wall array
    return tileData.walls.includes(side);

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
 * @param {object} boardData - The parsed board data.
 * @returns {Array<{row: number, col: number}>} An array of coordinates representing the laser path (excluding the laser tile itself).
 */
export function getLaserPath(startR, startC, laserDirection, boardData, robotState = null) {
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
        if (nextR < 0 || nextR >= boardData.rows || nextC < 0 || nextC >= boardData.cols) {
            break; // Out of bounds, path ends
        }

        // Check for robot in the next tile
        if (robotState && nextR === robotState.row && nextC === robotState.col) {
            path.push({ row: nextR, col: nextC }); // Include the robot's tile
            break; // Laser hit the robot
        }

        // Check for a wall on the *current* tile (from which the laser is exiting)
        // This is the wall on the emitter tile for the first step, or the previous path tile for subsequent steps.
        if (hasWall(currentR, currentC, exitWallSide, boardData)) {
            // If the current tile (or emitter) has a wall blocking exit, the laser stops *before* entering nextR, nextC
            // For the emitter tile, we assume the laser successfully exits.
            if (!(currentR === startR && currentC === startC)) { // Don't block on the emitter's own wall
                break; 
            }
        }

        // Check for a wall on the *next* tile (which the laser is trying to enter)
        if (hasWall(nextR, nextC, entryWallSide, boardData)) {
            path.push({ row: nextR, col: nextC }); // Include the tile with the blocking wall
            break; // Laser hit a wall on the next tile's entry side
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
