// eventEmitter.js
import { ALLOWED_EVENT_NAMES } from './config.js';

const listeners = {};

/**
 * Subscribe to an event.
 * @param {string} eventName - The name of the event.
 * @param {Function} callback - Function to execute when event is emitted.
 */
export function on(eventName, callback) {
    if (!ALLOWED_EVENT_NAMES.has(eventName)) {
        console.warn(`Attempted to subscribe to unknown event: "${eventName}". Allowed events are: ${Array.from(ALLOWED_EVENT_NAMES).join(', ')}.`);
        return; // Do not subscribe to unknown events
    }
    if (!listeners[eventName]) {
        listeners[eventName] = [];
    }
    listeners[eventName].push(callback);
}

/**
 * Emit an event, calling all subscribed listeners.
 * @param {string} eventName - The name of the event.
 * @param {any} [data] - Optional data to pass to listeners.
 */
export function emit(eventName, data) {
    if (!ALLOWED_EVENT_NAMES.has(eventName)) {
        console.warn(`Attempted to emit unknown event: "${eventName}". Allowed events are: ${Array.from(ALLOWED_EVENT_NAMES).join(', ')}.`);
        return; // Do not emit unknown events
    }
    if (listeners[eventName]) {
        listeners[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`Error in listener for event "${eventName}":`, e);
            }
        });
    }
}

/** Remove all listeners (useful for resets) */
export function offAll() {
    for (const eventName in listeners) {
        delete listeners[eventName];
    }
}
