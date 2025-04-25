// robot.js
import { orientations, MAX_HEALTH } from './config.js'; // Keep config import
import * as Logger from './logger.js';
// Board import needed for calculateMoveTarget's parameter type hint, but not logic here
import * as Board from './board.js';
import { emit } from './eventEmitter.js';

/**
 * Represents the player's robot, managing its state and actions.
 */
class Robot {
    // --- Properties ---
    row;
    col;
    orientation;
    health;
    lastVisitedStationKey;

    /**
     * Initializes a new Robot instance.
     * @param {number} startRow
     * @param {number} startCol
     * @param {string} startOrientation
     */
    constructor(startRow, startCol, startOrientation) {
        this.row = startRow;
        this.col = startCol;
        this.orientation = startOrientation;
        this.health = MAX_HEALTH;
        this.lastVisitedStationKey = null;
        Logger.log("Robot instance created and initialized:", { ...this.getRobotState() });
    }

    /**
     * Returns a copy of the current robot state.
     * @returns {object} A copy of the robot's state properties.
     */
    getRobotState() {
        // Return a copy to prevent direct external modification
        return {
            row: this.row,
            col: this.col,
            orientation: this.orientation,
            health: this.health,
            lastVisitedStationKey: this.lastVisitedStationKey,
        };
    }

    /**
     * Updates the robot's orientation based on turn direction.
     * @param {'left' | 'right'} direction - The direction to turn.
     * @returns {string} The new orientation.
     */
    turn(direction) {
        const currentIndex = orientations.indexOf(this.orientation);
        let newIndex;
        if (direction === 'left') {
            newIndex = (currentIndex - 1 + orientations.length) % orientations.length;
        } else { // 'right'
            newIndex = (currentIndex + 1) % orientations.length;
        }
        this.orientation = orientations[newIndex];
        Logger.log(`Robot turned ${direction}. New orientation: ${this.orientation}`);
        // Emit event with current state AFTER update
        emit('robotTurned', { row: this.row, col: this.col, orientation: this.orientation });
        return this.orientation;
    }

    /** Reverses the robot's orientation */
    uTurn() {
        const currentIndex = orientations.indexOf(this.orientation);
        const newIndex = (currentIndex + 2) % orientations.length;
        this.orientation = orientations[newIndex];
        Logger.log(`Robot performed U-Turn. New orientation: ${this.orientation}`);
        // Emit event with current state AFTER update
        emit('robotTurned', { row: this.row, col: this.col, orientation: this.orientation });
        return this.orientation;
    }

    /**
     * Calculates the target coordinates for a move attempt based on current state.
     * Checks boundaries and walls. Does NOT change the robot's state.
     * @param {number} steps - Number of steps (+ve forward, -ve backward).
     * @param {object} boardData - Parsed board data for boundary/wall checks.
     * @returns {object} { targetRow, targetCol, success: boolean, blockedByWall: boolean }
     */
    calculateMoveTarget(steps, boardData) {
        let dr = 0, dc = 0;
        const moveDir = steps > 0 ? 1 : -1;
        let wallSideToCheck = null;

        // Use current instance orientation
        switch (this.orientation) {
            case 'north': dr = -moveDir; wallSideToCheck = 'north'; break;
            case 'east':  dc = moveDir;  wallSideToCheck = 'east';  break;
            case 'south': dr = moveDir;  wallSideToCheck = 'south'; break;
            case 'west':  dc = -moveDir; wallSideToCheck = 'west';  break;
        }

        // Use current instance position
        const targetRow = this.row + dr;
        const targetCol = this.col + dc;

        // 1. Check Boundaries
        const isInBounds = targetRow >= 0 && targetRow < boardData.rows &&
                           targetCol >= 0 && targetCol < boardData.cols;
        if (!isInBounds) {
            return { targetRow, targetCol, success: false, blockedByWall: false };
        }

        // 2. Check Walls (using current instance position)
        const isBlocked = Board.hasWall(this.row, this.col, wallSideToCheck, boardData);
        if (isBlocked) {
            Logger.log(`Move from (${this.row}, ${this.col}) towards ${wallSideToCheck} blocked by wall.`);
            return { targetRow, targetCol, success: false, blockedByWall: true };
        }

        return { targetRow, targetCol, success: true, blockedByWall: false };
    }

    /**
     * Directly sets the robot's position state and emits an event if changed.
     * @param {number} row
     * @param {number} col
     */
    setPosition(row, col) {
        if (this.row !== row || this.col !== col) {
            this.row = row;
            this.col = col;
            Logger.log(`Robot position set to (${this.row}, ${this.col})`);
            // Emit event with current state AFTER update
            emit('robotMoved', { row: this.row, col: this.col, orientation: this.orientation });
        }
    }

    /**
     * Decreases robot health by 1 and emits an event.
     * @returns {number} The new health value.
     */
    takeDamage() {
        this.health--;
        Logger.log(`Robot took 1 damage. Health: ${this.health}`);
        // Emit event with current state AFTER update
        emit('healthChanged', { health: this.health, maxHealth: MAX_HEALTH });
        return this.health;
    }

    /**
     * Updates the last visited station key.
     * @param {string | null} key
     */
    setLastVisitedStation(key) {
        this.lastVisitedStationKey = key;
        Logger.log(`Robot last visited station set to: ${key}`);
    }

    /**
     * Checks if the robot's health is 0 or less.
     * @returns {boolean}
     */
    isDestroyed() {
        return this.health <= 0;
    }
}

// Export the class as the default export
export default Robot;
