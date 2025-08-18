// logger.js

import { ALLOWED_LOG_LEVELS } from './config.js';

const logHistory = [];
const MAX_LOG_ENTRIES = 200; // Limit history size to prevent memory issues

// Store original console methods
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
};

/**
 * Formats log arguments into a single string.
 * Basic implementation, similar to Logger.log's default behavior.
 */
function formatArgs(args) {
    return Array.from(args)
        .map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg); // Basic object stringification
                } catch (e) {
                    return '[Unserializable Object]';
                }
            }
            return String(arg);
        })
        .join(' ');
}

/**
 * Adds a message to the history and calls the original console method.
 * @param {'LOG' | 'WARN' | 'ERROR'} level - The log level.
 * @param {any[]} args - Arguments passed to the log function.
 */
function addLogEntry(level, args) {
    if (!ALLOWED_LOG_LEVELS.has(level)) {
        originalConsole.error(`Attempted to log with unknown level: "${level}". Allowed levels are: ${Array.from(ALLOWED_LOG_LEVELS).join(', ')}.`);
        return; // Do not process unknown log levels
    }
    const message = formatArgs(args);
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp} ${level}] ${message}`;

    logHistory.push(entry);

    // Keep history size manageable
    if (logHistory.length > MAX_LOG_ENTRIES) {
        logHistory.shift(); // Remove the oldest entry
    }

    // Call the original console method
    const consoleMethod = originalConsole[level.toLowerCase()];
    if (consoleMethod) {
        consoleMethod.apply(console, args);
    }
}

// --- Exported Logger Functions ---

export function log(...args) {
    addLogEntry('LOG', args);
}

export function warn(...args) {
    addLogEntry('WARN', args);
}

export function error(...args) {
    addLogEntry('ERROR', args);
}

/**
 * Returns a copy of the log history array.
 * @returns {string[]}
 */
export function getHistory() {
    return [...logHistory]; // Return a copy
}

/**
 * Clears the log history.
 */
export function clearHistory() {
    logHistory.length = 0;
}

// --- Optional: Override global console methods ---
// Uncomment the following lines if you want to automatically capture
// ALL Logger.log/warn/error calls, even from potential third-party code
// or places you forget to update. Use with caution.
/*
Logger.log = log;
Logger.warn = warn;
Logger.error = error;
console.info = log; // Map info to log
console.debug = log; // Map debug to log
*/
// If you uncomment the above, you might not need to manually replace
// every Logger.log call in your own code, but it's generally safer
// to explicitly use Logger.log etc. for your own messages.