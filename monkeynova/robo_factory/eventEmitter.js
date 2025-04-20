// eventEmitter.js
const listeners = {};

/**
 * Subscribe to an event.
 * @param {string} eventName - The name of the event.
 * @param {Function} callback - Function to execute when event is emitted.
 */
export function on(eventName, callback) {
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
