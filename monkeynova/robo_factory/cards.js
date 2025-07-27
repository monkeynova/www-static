// cards.js
import { HAND_SIZE, FULL_DECK_DEFINITION, ALLOWED_CARD_TYPES } from './config.js';
import { emit } from './eventEmitter.js'; // Import emit
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

/** Emits the current card counts */
function emitCounts() {
    emit('cardCountsUpdated', {
        deck: currentDeck.length,
        discard: discardPile.length,
        hand: handCards.length
    });
}

/**
 * Initializes the deck, shuffles, and draws the starting hand.
 * @returns {object[]} The initial hand card data (still useful for initial UI setup).
 */
export function initDeckAndHand() {
    // Validate all cards in the FULL_DECK_DEFINITION at initialization
    for (const cardDef of FULL_DECK_DEFINITION) {
        if (!ALLOWED_CARD_TYPES.has(cardDef.type)) {
            throw new Error(`Invalid card type '${cardDef.type}' found in FULL_DECK_DEFINITION. Must be one of ${Array.from(ALLOWED_CARD_TYPES).join(', ')}.`);
        }
    }

    currentDeck = [...FULL_DECK_DEFINITION];
    shuffle(currentDeck);
    handCards = [];
    discardPile = [];
    allCardInstances = {};
    cardInstanceCounter = 0;
    Logger.log(`Deck initialized with ${currentDeck.length} cards.`);
    const initialHand = draw(HAND_SIZE); // Draw initial hand (this will emit events)
    // Emit initial counts AFTER drawing is complete
    // emitCounts(); // draw() already emits counts
    return initialHand; // Return data for potential direct use in main.js if needed
}

/**
 * Draws a specified number of cards, handling reshuffling.
 * @param {number} count - Number of cards to draw.
 * @returns {object[]} Array of the drawn card data objects.
 */
export function draw(count) {
    Logger.log(`Attempting to draw ${count} cards.`);
    const drawn = [];
    let reshuffled = false; // Track if reshuffle happened
    for (let i = 0; i < count; i++) {
        if (currentDeck.length === 0) {
            if (discardPile.length > 0) {
                Logger.log(`Deck empty. Reshuffling ${discardPile.length} cards from discard.`);
                currentDeck = [...discardPile];
                discardPile = [];
                shuffle(currentDeck);
                reshuffled = true; // Mark that reshuffle occurred
            } else {
                Logger.warn("Deck and discard pile are empty! Cannot draw more cards.");
                break;
            }
        }

        if (currentDeck.length > 0) {
            const cardData = currentDeck.pop();
            const instanceId = `card-instance-${cardInstanceCounter++}`;
            const cardInstance = { ...cardData, instanceId: instanceId };

            allCardInstances[instanceId] = cardInstance;
            handCards.push(cardInstance);
            drawn.push(cardInstance);
        } else {
            Logger.warn("Failed to draw card even after checking discard.");
            break;
        }
    }
    Logger.log(`Drew ${drawn.length}. Hand: ${handCards.length}. Deck: ${currentDeck.length}. Discard: ${discardPile.length}.`);

    // Emit events AFTER the draw loop is complete
    if (drawn.length > 0) {
        emit('handUpdated', [...handCards]); // Emit new hand state
    }
    // Always emit counts if anything changed (draw happened or reshuffle)
    if (drawn.length > 0 || reshuffled) {
         emitCounts();
    }

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
        Logger.log(`Removed ${instanceId} from hand data. Hand size: ${handCards.length}`);
        emit('handUpdated', [...handCards]); // Emit updated hand
        emitCounts(); // Emit updated counts
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
        Logger.log(`Added ${instanceId} back to hand data. Hand size: ${handCards.length}`);
        emit('handUpdated', [...handCards]); // Emit updated hand
        emitCounts(); // Emit updated counts
        return true;
    }
    return false;
}

/**
 * Moves card data for the given instance IDs to the discard pile.
 * @param {string[]} instanceIds - Array of instance IDs to discard.
 */
export function discard(instanceIds) {
    let count = 0;
    let changed = false;
    instanceIds.forEach(id => {
        const cardData = allCardInstances[id];
        if (cardData) {
            // Ensure it's not still in hand data (shouldn't be, but safety check)
            const handIndex = handCards.findIndex(c => c.instanceId === id);
            if (handIndex > -1) {
                Logger.warn(`Card ${id} found in hand during discard phase. Removing.`);
                handCards.splice(handIndex, 1);
                changed = true; // Hand changed unexpectedly
            }
            discardPile.push(cardData);
            count++;
        } else {
            Logger.warn(`Discard: Cannot find card data for ${id}`);
        }
    });
    Logger.log(`Discarded ${count} cards. Discard size: ${discardPile.length}`);
    if (count > 0) {
        emitCounts(); // Emit updated counts
    }
    if (changed) {
         emit('handUpdated', [...handCards]); // Emit hand update if it changed
    }
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
