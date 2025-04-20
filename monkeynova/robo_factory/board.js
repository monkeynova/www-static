// board.js
import { TILE_CLASSES } from './config.js';

/**
 * Parses the board layout string array.
 * @param {string[]} boardLayout - Array of strings representing the board.
 * @returns {object} { rows, cols, repairStations, tiles }
 */
export function parseBoardLayout(boardLayout) {
    if (!boardLayout || boardLayout.length === 0) {
        throw new Error("Board layout is empty or invalid.");
    }
    const rows = boardLayout.length;
    const cols = boardLayout[0].length;
    const repairStations = [];
    const tiles = []; // Store parsed data for each tile

    for (let r = 0; r < rows; r++) {
        if (boardLayout[r].length !== cols) {
            throw new Error(`Board layout row ${r} has inconsistent length.`);
        }
        const rowTiles = [];
        for (let c = 0; c < cols; c++) {
            const char = boardLayout[r][c];
            const classes = TILE_CLASSES[char] || ['plain']; // Default to plain
            const tileData = {
                char: char,
                classes: ['tile', ...classes], // Include base 'tile' class
                row: r,
                col: c
            };
            rowTiles.push(tileData);

            if (char === 'R') {
                repairStations.push({ row: r, col: c });
            }
        }
        tiles.push(rowTiles);
    }
    console.log(`Parsed board: ${rows}x${cols}. Found ${repairStations.length} repair stations.`);
    return { rows, cols, repairStations, tiles };
}

/**
 * Gets the parsed data for a specific tile.
 * @param {number} r - Row index.
 * @param {number} c - Column index.
 * @param {object} boardData - The object returned by parseBoardLayout.
 * @returns {object|null} Tile data object or null if out of bounds.
 */
export function getTileData(r, c, boardData) {
    if (!boardData || !boardData.tiles) return null;
    if (r < 0 || r >= boardData.rows || c < 0 || c >= boardData.cols) {
        return null; // Out of bounds
    }
    return boardData.tiles[r][c];
}
