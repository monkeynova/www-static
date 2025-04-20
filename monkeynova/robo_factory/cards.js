// cards.js
import { HAND_SIZE, FULL_DECK_DEFINITION } from './config.js';
import * as Logger from './logger.js';

let currentDeck = [];
let handCards = []; // Array of card data objects { type, text, instanceId }
let discardPile = [];
let allCardInstances = {}; // Map: instanceId -> card data object
let cardInstanceCounter = 0;

// Fisher-Yates Shuffle
function shuffle(deck) {
    Logger.log(`Shuffling ${deck.length} cards...`);
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

/**
 * Initializes the deck, shuffles, and draws the starting hand.
 * @returns {object[]} The initial hand card data.
 */
export function initDeckAndHand() {
    currentDeck = [...FULL_DECK_DEFINITION]; // Use definition from config
    shuffle(currentDeck);
    handCards = [];
    discardPile = [];
    allCardInstances = {};
    cardInstanceCounter = 0;
    Logger.log(`Deck initialized with ${currentDeck.length} cards.`);
    return draw(HAND_SIZE); // Draw and return initial hand
}

/**
 * Draws a specified number of cards, handling reshuffling.
 * @param {number} count - Number of cards to draw.
 * @returns {object[]} Array of the drawn card data objects.
 */
export function draw(count) {
    Logger.log(`Attempting to draw ${count} cards.`);
    const drawn = [];
    for (let i = 0; i < count; i++) {
        if (currentDeck.length === 0) {
            if (discardPile.length > 0) {
                Logger.log(`Deck empty. Reshuffling ${discardPile.length} cards from discard.`);
                currentDeck = [...discardPile];
                discardPile = [];
                shuffle(currentDeck);
            } else {
                Logger.warn("Deck and discard pile are empty! Cannot draw more cards.");
                break; // Stop drawing
            }
        }

        // Check again after potential reshuffle
        if (currentDeck.length > 0) {
            const cardData = currentDeck.pop();
            const instanceId = `card-instance-${cardInstanceCounter++}`;
            const cardInstance = { ...cardData, instanceId: instanceId };

            allCardInstances[instanceId] = cardInstance; // Store lookup
            handCards.push(cardInstance); // Add to hand data array
            drawn.push(cardInstance);
        } else {
            Logger.warn("Failed to draw card even after checking discard.");
            break;
        }
    }
    Logger.log(`Drew ${drawn.length}. Hand: ${handCards.length}. Deck: ${currentDeck.length}. Discard: ${discardPile.length}.`);
    return drawn;
}

/**
 * Removes a card from the internal handCards array.
 * @param {string} instanceId - The unique ID of the card instance.
 * @returns {boolean} True if removal was successful.
 */
export function removeFromHandData(instanceId) {
    const indexToRemove = handCards.findIndex(card => card.instanceId === instanceId);
    if (indexToRemove > -1) {
        handCards.splice(indexToRemove, 1);
        // Logger.log(`Removed ${instanceId} from hand data. Hand size: ${handCards.length}`);
        return true;
    }
    Logger.warn(`Card ${instanceId} not found in hand data to remove.`);
    return false;
}

/**
 * Adds card data back to the internal handCards array (if not already present).
 * @param {string} instanceId - The unique ID of the card instance.
 * @returns {boolean} True if addition was successful.
 */
export function addToHandData(instanceId) {
    const cardData = allCardInstances[instanceId];
    if (cardData && !handCards.some(card => card.instanceId === instanceId)) {
        handCards.push(cardData);
        // Logger.log(`Added ${instanceId} back to hand data. Hand size: ${handCards.length}`);
        return true;
    }
    // Logger.warn(`Cannot add ${instanceId} back to hand data (already present or data missing).`);
    return false;
}

/**
 * Moves card data for the given instance IDs to the discard pile.
 * @param {string[]} instanceIds - Array of instance IDs to discard.
 */
export function discard(instanceIds) {
    let count = 0;
    instanceIds.forEach(id => {
        const cardData = allCardInstances[id];
        if (cardData) {
            // Optional: Remove from handCards if it's somehow still there? Should be removed by drop handler.
            const handIndex = handCards.findIndex(c => c.instanceId === id);
            if (handIndex > -1) {
                Logger.warn(`Card ${id} found in hand during discard phase. Removing.`);
                handCards.splice(handIndex, 1);
            }

            discardPile.push(cardData);
            count++;
            // Decide whether to keep card data in allCardInstances after discard.
            // Keeping it allows potential future features (view discard, specific card effects).
            // delete allCardInstances[id]; // If memory is a concern
        } else {
            Logger.warn(`Discard: Cannot find card data for ${id}`);
        }
    });
    Logger.log(`Discarded ${count} cards. Discard size: ${discardPile.length}`);
}

/**
 * Returns the current number of cards in the draw pile.
 */
export function getDeckSize() {
    return currentDeck.length;
}

/**
 * Returns the current number of cards in the discard pile.
 */
export function getDiscardSize() {
    return discardPile.length;
}

/**
 * Returns the current number of cards in the hand data array.
 */
export function getHandSize() {
    return handCards.length;
}

/**
 * Returns a copy of the current hand card data.
 */
export function getHandCards() {
    return [...handCards]; // Return a copy
}

/**
 * Gets the data object for a specific card instance.
 */
export function getCardData(instanceId) {
    return allCardInstances[instanceId];
}
