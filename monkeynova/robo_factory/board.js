// board.js
import * as Logger from './logger.js';

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
            const walls = Array.isArray(tileDef.walls) ? tileDef.walls : [];
            let primaryType = definedClasses[0] || 'plain';
            const conveyorClass = definedClasses.find(cls => cls.startsWith('conveyor-'));
            if (conveyorClass) {
                primaryType = 'conveyor';
            }

            const speed = definedClasses.includes('speed-2x') ? 2 : 1;
            let direction = null;
            if (primaryType === 'conveyor') {
                const directionClass = definedClasses.find(cls => cls.startsWith('conveyor-'));
                if (directionClass) {
                    direction = directionClass.split('-')[1]; // Extract 'north', 'east', etc.
                }
            }

            const tileData = {
                classes: ['tile', ...definedClasses], // Combine base 'tile' with defined classes
                walls: walls,
                row: r,
                col: c,
                primaryType: primaryType,
                speed: speed,
                direction: direction // NEW: Store conveyor direction
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
