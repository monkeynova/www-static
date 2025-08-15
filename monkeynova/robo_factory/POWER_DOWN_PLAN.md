# Request

I'd like to introduce an opportunity for players to heal even when not at a repair station. To allow
for this a user will be allowed to add to the end of their 5 step program an intent to shut down. If
they choose to shut down they will not be able to act during the next round of 5 steps.

When a user exercises this option, the next turn when they shut down the board will continue to operate.
All board actions will continue to run through all 5 steps, even though the robot will not be able to
perform any actions. So if a conveyor or pusher would move a robot, it moves. If a laser would damage a
robot it takes damage.

After the 5 steps run where the robot performs no actions, it powers back up and when it powers up it
is restored to full health. 

As a special case if the robot loses its last health through taking damage or thorugh falling in the hole
it will still lose one life and be restored at its last checkpoint with full health.

Since the robot is unable to perform actions during the turn during which it is powered down, the user
should not be able to select cards for a program, but should be able to click "Run Program" to run through
the powered down turn.

# Revised Plan: UI-Driven Incremental "Power Down" Feature Implementation

This plan breaks down the "Power Down" feature into smaller, independently verifiable functional increments, with each phase resulting in a change observable through the UI.

## Phase 1: UI for Power Down Intent & Basic State Display

This phase focuses on introducing the UI elements to declare and display the power down state, without implementing the core game logic for skipping actions or healing.

1.  **Introduce `powerDownIntent` and `isPoweredDown` states:**
    *   Add `powerDownIntent` (boolean) to the robot's state (or game state).
    *   Add `isPoweredDown` (boolean) to the robot's state.
2.  **Implement "Power Down" intent UI (`ui.js`, `main.js`):**
    *   Add a UI element (e.g., a button or checkbox) that allows the user to set `powerDownIntent` for the next turn. This will be the primary way to trigger the feature.
3.  **Basic Visual Feedback for Power Down State (`ui.js`):**
    *   Implement a simple visual indicator in the UI (e.g., a text label, a dimmed robot sprite, or a change in a status bar) that clearly shows:
        *   When `powerDownIntent` is set (indicating the robot *will* power down next turn).
        *   When `isPoweredDown` is true (indicating the robot *is currently* powered down).
4.  **Modify Game Loop (`gameLoop.js`) for state transitions (minimal):**
    *   At the start of a new turn:
        *   If `powerDownIntent` was true from the *previous* turn, set `isPoweredDown` to `true` for the current turn and reset `powerDownIntent` to `false`.
        *   If `isPoweredDown` was true from the *previous* turn, reset `isPoweredDown` to `false` (robot powers back up).
    *   **Crucially:** At this stage, robot actions are *not* skipped, and healing is *not* implemented. The focus is solely on UI feedback of the state.
5.  **Verification (UI-driven):**
    *   Interact with the new UI element to set `powerDownIntent`.
    *   Observe the UI indicator change to reflect `powerDownIntent`.
    *   Run a turn and observe the UI indicator change to reflect `isPoweredDown`.
    *   Run another turn and observe the UI indicator change back to normal.

## Phase 2: Robot Actions Skipped During Power Down (UI Observable)

This phase implements the core mechanic of skipping robot actions, which will be directly observable through the UI.

1.  **Modify Game Loop (`gameLoop.js`) to skip robot actions:**
    *   During each of the 5 program steps, if `isPoweredDown` is true, skip the robot's action for that step.
    *   **Crucially:** Ensure environmental interactions (conveyors, pushers, lasers, holes) *still affect* the robot when `isPoweredDown` is true. This should be verified against existing logic.
2.  **Verification (UI-driven):**
    *   Program a robot action (e.g., move forward).
    *   Set `powerDownIntent` via the UI.
    *   Run the program: Observe that the robot *does not* perform its programmed action during the powered-down turn, but board elements (if present) still affect it.

## Phase 3: Implement Healing on Power Up (UI Observable)

This phase adds the healing functionality, with the health changes visible in the UI.

1.  **Implement `restoreFullHealth()` method (`robot.js`):**
    *   Add a method to the robot object that restores the robot's health to its maximum value.
2.  **Integrate healing into Game Loop (`gameLoop.js`):**
    *   When `isPoweredDown` transitions from true to false (robot powers back up), call `robot.restoreFullHealth()`.
3.  **Update UI to reflect health changes (`ui.js`):**
    *   Ensure the health display in the UI (e.g., health bar, numerical health) correctly updates when `restoreFullHealth()` is called.
4.  **Verification (UI-driven):**
    *   Damage the robot.
    *   Set `powerDownIntent` via the UI.
    *   Run through the powered-down turn.
    *   Observe the robot's health in the UI being restored to full at the start of the turn *after* the powered-down turn.

## Phase 4: Refine UI - Disable Programming During Power Down

This phase focuses on preventing user input during the powered-down state.

1.  **Disable programming during power down (`ui.js`):**
    *   When `isPoweredDown` is true, disable the ability for the user to select or program new cards in the UI.
2.  **Ensure "Run Program" button remains active (`ui.js`):**
    *   Verify that the "Run Program" button is always active, even when `isPoweredDown` is true, allowing the user to advance the turn.
3.  **Verification (UI-driven):**
    *   Set `powerDownIntent`.
    *   During the subsequent powered-down turn, attempt to select cards or modify the program. Verify that the UI prevents these actions.
    *   Verify that the "Run Program" button is still clickable.

## Phase 5: Handle Loss of Life During Power Down & Comprehensive Testing

This final phase addresses the special case and ensures overall stability.

1.  **Verify existing life loss/respawn logic:**
    *   Confirm that the existing logic for losing a life and respawning at the last checkpoint (with full health) correctly applies even if the robot takes fatal damage while `isPoweredDown`. If not, implement necessary adjustments.
2.  **Comprehensive Testing:**
    *   **Automated Tests:** Write unit tests for all new states, state transitions, skipped robot actions, and healing.
    *   **End-to-End Manual Testing:** Perform thorough manual testing of all scenarios, including edge cases like losing a life while powered down, and interactions with various board elements.