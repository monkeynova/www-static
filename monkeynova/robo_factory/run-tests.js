// run-tests.js
import { runTests } from './testRunner.js';

// This file is the command-line entry point for running tests.
// It imports the same test runner used by the browser and executes it.

(async () => {
    try {
        await runTests();
        // Exit with success code
        process.exit(0);
    } catch (error) {
        console.error("A critical error occurred during the test run:", error);
        // Exit with failure code
        process.exit(1);
    }
})();