// robot.js
import { orientations, MAX_HEALTH } from './config.js';
import * as Logger from './logger.js';
import * as Config from './config.js';
import * as Board from './board.js';
import { emit } from './eventEmitter.js';

// Internal state - not directly exported
let state = {
    row: 0,
    col: 0,
    orientation: 'east',
    health: MAX_HEALTH,
    lastVisitedStationKey: null,
};

/**
 * Initializes the robot's state.
 */
export function initRobot(startRow, startCol, startOrientation) {
    state.row = startRow;
    state.col = startCol;
    state.orientation = startOrientation;
    state.health = MAX_HEALTH;
    state.lastVisitedStationKey = null;
    Logger.log("Robot state initialized:", { ...state });
}

/**
 * Returns a copy of the current robot state.
 */
export function getRobotState() {
    return { ...state }; // Return a copy to prevent direct modification
}

/**
 * Updates the robot's orientation based on turn direction.
 * @param {'left' | 'right'} direction - The direction to turn.
 * @returns {string} The new orientation.
 */
export function turn(direction) {
    const currentIndex = orientations.indexOf(state.orientation);
    let newIndex;
    if (direction === 'left') {
        newIndex = (currentIndex - 1 + orientations.length) % orientations.length;
    } else { // 'right'
        newIndex = (currentIndex + 1) % orientations.length;
    }
    state.orientation = orientations[newIndex];
    emit('robotTurned', { row: state.row, col: state.col, orientation: state.orientation }); // Emit event
    return state.orientation;
}
// Add U-Turn logic here later:
// export function uTurn() { ... state.orientation = opposite ... }


/**
 * Calculates the target coordinates for a move attempt.
 * Checks boundaries and walls. Does NOT change the robot's state.
 * @param {number} steps - Number of steps (+ve forward, -ve backward).
 * @param {object} boardData - Parsed board data for boundary/wall checks.
 * @returns {object} { targetRow, targetCol, success: boolean, blockedByWall: boolean }
 */
export function calculateMoveTarget(steps, boardData) {
    let dr = 0, dc = 0;
    const moveDir = steps > 0 ? 1 : -1;
    let wallSideToCheck = null; // Which side of the *current* tile blocks this move?

    switch (state.orientation) {
        case 'north': dr = -moveDir; wallSideToCheck = 'north'; break;
        case 'east':  dc = moveDir;  wallSideToCheck = 'east';  break;
        case 'south': dr = moveDir;  wallSideToCheck = 'south'; break;
        case 'west':  dc = -moveDir; wallSideToCheck = 'west';  break;
    }

    const targetRow = state.row + dr;
    const targetCol = state.col + dc;

    // 1. Check Boundaries
    const isInBounds = targetRow >= 0 && targetRow < boardData.rows &&
                       targetCol >= 0 && targetCol < boardData.cols;

    if (!isInBounds) {
        return { targetRow, targetCol, success: false, blockedByWall: false };
    }

    // 2. Check Walls (only if in bounds)
    // Check the wall on the side of the *current* tile that leads to the target tile.
    const isBlocked = Board.hasWall(state.row, state.col, wallSideToCheck, boardData);

    if (isBlocked) {
        Logger.log(`Move from (${state.row}, ${state.col}) towards ${wallSideToCheck} blocked by wall.`);
        return { targetRow, targetCol, success: false, blockedByWall: true };
    }

    // If in bounds and not blocked by wall
    return { targetRow, targetCol, success: true, blockedByWall: false };
}

/**
 * Directly sets the robot's position state.
 */
export function setPosition(row, col) {
    if (state.row !== row || state.col !== col) {
        state.row = row;
        state.col = col;
        emit('robotMoved', { row, col, orientation: state.orientation }); // Emit event
    }
}

/**
 * Decreases robot health by 1.
 * @returns {number} The new health value.
 */
export function takeDamage() {
    state.health--;
    emit('healthChanged', { health: state.health, maxHealth: Config.MAX_HEALTH }); // Emit event
    return state.health;
}

/**
 * Updates the last visited station key.
 */
export function setLastVisitedStation(key) {
    state.lastVisitedStationKey = key;
}

/**
 * Checks if the robot's health is 0 or less.
 */
export function isDestroyed() {
    return state.health <= 0;
}
