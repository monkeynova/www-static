// robot.js
import { orientations, MAX_HEALTH, TURN_LEFT, TURN_RIGHT } from './config.js'; // Keep config import
import { Board } from './board.js';
import * as Logger from './logger.js';
// Board import needed for calculateMoveTarget's parameter type hint, but not logic here

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
    visitedRepairStations;
    program; // NEW: Array to store the program cards

    /**
     * Initializes a new Robot instance.
     * @param {number} startRow
     * @param {number} startCol
     * @param {string} startOrientation
     */
    constructor(startRow, startCol, startOrientation) {
        if (!orientations.includes(startOrientation)) {
            throw new Error(`Invalid initial robot orientation: ${startOrientation}. Must be one of ${orientations.join(', ')}.`);
        }
        this.row = startRow;
        this.col = startCol;
        this.orientation = startOrientation;
        this.health = MAX_HEALTH;
        this.lastVisitedStationKey = null;
        this.visitedRepairStations = new Set();
        this.program = []; // Initialize program as an empty array
        Logger.log("Robot instance created and initialized:", { ...this.getRobotState() });
    }

    /**
     * Sets the program cards for the robot to execute.
     * @param {object[]} cards - An array of card data objects.
     */
    setProgram(cards) {
        this.program = cards;
        Logger.log(`Robot program set with ${cards.length} cards.`);
    }

    /**
     * Gets the currently set program cards.
     * @returns {object[]} An array of card data objects.
     */
    getProgram() {
        return this.program;
    }

    /**
     * Returns a copy of the current robot state (excluding visited stations).
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
     * Marks a repair station as visited by this robot.
     * @param {string} stationKey - The key ('row-col') of the station.
     */
    visitStation(stationKey) {
        if (stationKey && !this.visitedRepairStations.has(stationKey)) {
            this.visitedRepairStations.add(stationKey);
            Logger.log(`Robot visited new station: ${stationKey}. Total: ${this.visitedRepairStations.size}`);
            // Note: We still emit 'flagVisited' from gameLoop when this happens
        }
    }

    /**
     * Checks if this robot has visited a specific repair station.
     * @param {string} stationKey - The key ('row-col') of the station.
     * @returns {boolean} True if the station has been visited.
     */
    hasVisitedStation(stationKey) {
        return this.visitedRepairStations.has(stationKey);
    }

    /**
     * Gets the number of unique repair stations visited by this robot.
     * @returns {number} The count of visited stations.
     */
    getVisitedStationCount() {
        return this.visitedRepairStations.size;
    }

    /**
     * Updates the robot's orientation based on turn direction.
     * @param {'left' | 'right'} direction - The direction to turn.
     * @returns {string} The new orientation.
     */
    turn(direction) {
        if (direction !== TURN_LEFT && direction !== TURN_RIGHT) {
            Logger.error(`Invalid turn direction: ${direction}. Must be '${TURN_LEFT}' or '${TURN_RIGHT}'.`);
            return this.orientation; // Return current orientation, do not turn
        }

        const currentIndex = orientations.indexOf(this.orientation);
        let newIndex;
        if (direction === TURN_LEFT) {
            newIndex = (currentIndex - 1 + orientations.length) % orientations.length;
        } else { // TURN_RIGHT
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

        // Use current instance orientation
        switch (this.orientation) {
            case 'north': dr = -moveDir; break;
            case 'east':  dc = moveDir;  break;
            case 'south': dr = moveDir;  break;
            case 'west':  dc = -moveDir; break;
        }

        // Determine the wall sides to check
        let exitWallSide, entryWallSide;
        if (dr === -1) { // Moving North
            exitWallSide = 'north';
            entryWallSide = 'south';
        } else if (dr === 1) { // Moving South
            exitWallSide = 'south';
            entryWallSide = 'north';
        } else if (dc === -1) { // Moving West
            exitWallSide = 'west';
            entryWallSide = 'east';
        } else if (dc === 1) { // Moving East
            exitWallSide = 'east';
            entryWallSide = 'west';
        } else {
            return { targetRow: this.row, targetCol: this.col, success: false, blockedByWall: false }; // Should not happen
        }

        // Use current instance position
        const targetRow = this.row + dr;
        const targetCol = this.col + dc;

        // 1. Check Boundaries for the target tile
        const isInBounds = targetRow >= 0 && targetRow < boardData.rows &&
                           targetCol >= 0 && targetCol < boardData.cols;
        if (!isInBounds) {
            return { targetRow, targetCol, success: false, blockedByWall: false };
        }

        // 2. Check Walls
        // Check for a wall on the current tile blocking exit
        const blockedByCurrentTileWall = boardData.hasWall(this.row, this.col, exitWallSide);
        // Check for a wall on the target tile blocking entry
        const blockedByTargetTileWall = boardData.hasWall(targetRow, targetCol, entryWallSide);

        if (blockedByCurrentTileWall || blockedByTargetTileWall) {
            Logger.log(`Move from (${this.row}, ${this.col}) towards ${this.orientation} blocked by wall.`);
            return { targetRow: this.row, targetCol: this.col, success: false, blockedByWall: true };
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