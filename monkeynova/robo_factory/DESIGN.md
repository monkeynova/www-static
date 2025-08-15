# Robo Factory - Design Document

## 1. Overview

Robo Factory is a single-player, browser-based puzzle game. The player programs a robot using a limited hand of instruction cards to navigate a factory floor. The goal is to visit a series of designated "repair stations" (flags) in order to win. The factory floor contains various obstacles and elements like conveyor belts, walls, and holes that affect the robot's movement.

The game is turn-based, with a distinct programming phase and an execution phase. It is built with vanilla JavaScript using ES modules, emphasizing a separation of concerns between game logic (Model), user interface (View), and the main game loop (Controller).

## 2. Core Gameplay Mechanics

### 2.1. Game Objective

The primary objective is to guide the robot to visit all **Checkpoint** tiles on the board *in their designated numerical order*. The game is won when the robot visits the final checkpoint in sequence. The game is lost if the robot runs out of lives.

### 2.2. The Turn Cycle

Each round consists of two main phases:

1.  **Programming Phase:**
    *   The player is dealt a hand of 7 instruction cards from their deck.
    *   The player must choose 5 of these cards and place them into the 5 program slots.
    *   This is done via a drag-and-drop interface.
    *   Once all 5 slots are filled, the "Run Program" button becomes active.

2.  **Execution Phase:**
    *   When "Run Program" is clicked, the game takes over.
    *   The 5 programmed cards are executed sequentially, one by one.
    *   After each card's action is resolved, board elements (like conveyor belts, lasers, push panels, gears) are activated.
    *   This sequence (Card Action -> Board Effects) repeats for all 5 cards or until the game ends.
    *   After the execution phase, the 5 used cards are moved to a discard pile, and the player draws 5 new cards from their deck to replenish their hand to 7.

### 2.3. The Robot

The robot is the player's avatar on the board. Its state is defined by:
*   **Position:** A row and column on the grid.
*   **Orientation:** North, East, South, or West.
*   **Health:** Starts at a maximum (10) and decreases when hit by lasers. If health reaches 0, the robot loses a life and respawns.
*   **Lives:** Starts at 3. If the robot falls into a hole or its health reaches 0, it loses a life and respawns at the last visited checkpoint or repair station. The game ends if lives reach 0.
*   **Highest Visited Checkpoint:** The highest-numbered checkpoint the robot has visited in sequential order. This contributes to the win condition.
*   **Last Visited Station:** The robot's respawn point if it loses a life (either from health depletion or falling in a hole). This is updated when visiting any repair station or checkpoint.

### 2.4. The Cards

The player's actions are dictated by cards. The deck contains a fixed set of cards with different effects:
*   **Move 1 / Move 2:** Moves the robot forward 1 or 2 tiles in its current direction. A "Move 2" is blocked if either of the two single-tile moves is blocked by a wall.
*   **Back 1:** Moves the robot backward 1 tile without changing its orientation.
*   **Turn L / Turn R:** Rotates the robot 90 degrees left or right.
*   **U-Turn:** Rotates the robot 180 degrees.

Card management follows standard deck-builder rules: when the draw pile is empty, the discard pile is shuffled to become the new draw pile.

### 2.5. The Board

The game board is a grid of tiles with various properties.

*   **Tiles:**
    *   **Plain:** Standard empty space.
    *   **Repair Station:** These tiles heal the robot to full health and update its last visited station (respawn point). They do NOT count towards the win condition. Indicated by a 🔧 symbol.
    *   **Checkpoint:** These tiles heal the robot to full health, update its last visited station, and contribute to the win condition if visited in the correct numerical order. Indicated by a 🚩 symbol and a number.
    *   **Conveyor Belt:** Automatically moves the robot one tile in the indicated direction.
        *   **Normal (1x):** Moves the robot one tile.
        *   **Express (2x):** Can move the robot up to two tiles. The movement is phased: the 2x belt moves the robot one tile, then the conveyor on the *new* tile activates to move it a second tile.
    *   **Hole:** If the robot ends its movement on a hole, it loses a life and respawns at the last visited checkpoint or repair station. If no station has been visited, this is likely a game-ending event.
    *   **Lasers:** Stationary lasers attached to a wall that fire a beam perpendicularly away from the wall. The beam damages the first robot it encounters (costing 1 health) and is stopped by walls. Beams are always visible.
    *   **Push Panels:** Attached to walls, these panels activate on specific phases of play (e.g., 2/4 or 1/3/5) to push adjacent robots one tile away from the wall. They activate after conveyor belts and before gears.
    *   **Rotating Gears:** Tiles that rotate the robot standing on them (90 degrees clockwise for 'cw', 90 degrees counter-clockwise for 'ccw').
*   **Walls:** Impassable barriers that block robot movement. They exist on the edges of tiles.

## 3. Technical Architecture & Design

The application is architected with a clear separation of concerns, using modern JavaScript (ES Modules).

### 3.1. Module Breakdown

*   **`main.js`:** The main entry point. It initializes all other modules, defines the board layout, and starts the game.
*   **`config.js`:** A central place for game constants (e.g., `MAX_HEALTH`, `HAND_SIZE`, `TILE_SIZE`, deck composition).
*   **`robot.js`:** (Model) Defines the `Robot` class, managing its state (position, health, etc.) and state-changing methods (`move`, `turn`, `takeDamage`).
*   **`board.js`:** (Model) Contains functions for parsing the board definition and querying tile properties (e.g., `getTileData`, `hasWall`).
*   **`tile.js`:** (Model) Defines the `Tile` class, representing a single tile on the game board and encapsulating its properties (walls, floor devices, wall devices) and methods for applying their effects to the robot.
*   **`cards.js`:** (Model) Manages the card deck, hand, and discard pile. Handles shuffling, drawing, and discarding logic.
*   **`gameLoop.js`:** (Controller) Orchestrates the execution phase of the game. It processes the programmed cards and triggers board effects in the correct sequence.
*   **`ui.js`:** (View) Responsible for all DOM manipulation and canvas rendering. It listens for events to update the visual representation of the game state and captures user input (drag-and-drop, button clicks).
*   **`eventEmitter.js`:** A simple pub/sub system that allows the Model and Controller to broadcast events (e.g., `robotMoved`, `gameOver`) without being directly coupled to the `ui.js` module.
*   **`logger.js`:** A utility for logging game events to the console and maintaining a log history for debugging.
*   **`testRunner.js`:** A simple framework for running unit and integration tests for game logic. Tests can be executed via a button in the browser for quick validation or from the command line via `npm test` for automated and iterative development.

### 3.2. Event-Driven Architecture

The core of the decoupling strategy is the event emitter.
*   When game state changes in the Model (e.g., `robot.setPosition()`), an event is emitted (e.g., `emit('robotMoved', ...)`)
*   The `ui.js` module subscribes to these events and updates the visuals accordingly.
This prevents the game logic from needing any knowledge of the DOM or how it's structured.

### 3.3. State Management

Game state is decentralized into the primary model objects:
*   **Robot State:** Held within the `Robot` instance created in `main.js`.
*   **Board State:** The (mostly static) board data is parsed and held in an object created by `board.js`.
*   **Card State:** The deck, hand, and discard piles are managed as arrays within the `cards.js` module.

### 3.4. Coding Principles & Data Consistency

To maintain a clean, predictable, and maintainable codebase, the following principles are adopted:

*   **Principle of Least Astonishment / Single Source of Truth:** For any given operation or concept, there should ideally be one, and only one, clear way to represent or perform it across the codebase. This minimizes ambiguity and reduces the cognitive load for developers. For example, if a conveyor moves "right", it should consistently be referred to as "right" in all related code (board definitions, game logic, tests), rather than interchangeably using "east" or other synonyms.

*   **Data Validation for String-based Enums:** When string literals are used to represent a fixed set of predefined values (acting as an "enum"), robust validation mechanisms should be in place. This validation should occur as early as possible in the data's lifecycle, ideally at data parsing or module boundaries, to provide immediate and useful error feedback. This ensures that only expected values are processed, preventing subtle bugs caused by typos or unexpected input. For instance, if robot orientations are "north", "east", "south", "west", any function accepting an orientation string should validate it against this allowed set.

## 4. Future Work & Potential Enhancements

*   **More Card Types:**
    *   **"Again":** Repeats the previous card's action.
    *   **"Power Down":** Robot skips the next card but regains some health.
    *   **Conditional Cards:** "If-Then" logic (e.g., "If on a blue tile, move 2").
*   **Improved UI/UX:**
    *   Add sound effects for movement, collisions, and card plays.
    *   Smoother animations and visual feedback for game events.
    *   A more polished and visually appealing theme.
*   **Gameplay Enhancements:**
    *   **Multiplayer:** Allow multiple robots to be on the board at once, either cooperatively or competitively.
    *   **Campaign/Levels:** Create a series of different boards with increasing difficulty.
    *   **Scoring System:** Award points based on speed, efficiency, or remaining health.
*   **Technical Improvements:**
    *   **State Persistence:** Save and load game state using `localStorage`.
    *   **Refactor `gameLoop.js`:** Further break down the `runProgramExecution` function to better separate card actions from board actions.
    *   **Expand Test Coverage:** Add more tests for edge cases and new features.

## 5. Known Bugs that need fixing

* When robot's health goes to 0, lives decrement, but they don't go back to last checkpoint.
* Speaking of checkpoints, we probably should have an indication of the respawn point (ghost robot?).
* Undragging cards back to hand doesn't put the position indicator (number) back.