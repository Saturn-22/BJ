/**
 * Game utility functions for Blackjack
 */

/**
 * Extract card IDs from card objects
 * @param {Array} cards - Array of card objects with {id, cardId} structure
 * @returns {Array} Array of card IDs (numbers)
 */
export const getCardIds = (cards) => {
  if (!cards || !Array.isArray(cards)) return [];
  return cards.map(card => card.cardId).filter(id => id !== undefined && id !== 99);
};

/**
 * Calculate the total value of a hand
 * @param {Array} cardIds - Array of card IDs (0-51)
 * @returns {number} Total hand value
 */
export const getHandTotal = (cardIds) => {
  if (!cardIds || cardIds.length === 0) return 0;
  
  let total = 0;
  let aces = 0;
  
  for (const cardId of cardIds) {
    if (cardId === 99) continue; // Skip hidden/hole cards
    
    const rank = cardId % 13; // 0=A, 1=2, ..., 12=K
    
    if (rank === 0) {
      // Ace
      total += 11;
      aces += 1;
    } else if (rank >= 10) {
      // J, Q, K = 10
      total += 10;
    } else {
      // 2-10
      total += rank + 1;
    }
  }
  
  // Adjust for aces if bust
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  
  return total;
};

/**
 * Get the display name for a card
 * @param {number} cardId - Card ID (0-51)
 * @returns {string} Card display name
 */
export const getCardName = (cardId) => {
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUITS = ["♣", "♦", "♥", "♠"];
  
  if (cardId === 99) return "[Hidden]";
  if (cardId < 0 || cardId > 51) return "[?]";
  
  const rank = cardId % 13;
  const suit = Math.floor(cardId / 13);
  
  return `${RANKS[rank]}${SUITS[suit]}`;
};

/**
 * Check if a hand is splittable (two cards of same rank)
 * @param {Array} cardIds - Array of card IDs
 * @returns {boolean} True if hand can be split
 */
export const isSplittable = (cardIds) => {
  if (!cardIds || cardIds.length !== 2) return false;
  
  const rank1 = cardIds[0] % 13;
  const rank2 = cardIds[1] % 13;
  
  return rank1 === rank2;
};

/**
 * Check if player has blackjack (21 with 2 cards)
 * @param {Array} cardIds - Array of card IDs
 * @returns {boolean} True if blackjack
 */
export const isBlackjack = (cardIds) => {
  if (!cardIds || cardIds.length !== 2) return false;
  return getHandTotal(cardIds) === 21;
};

/**
 * Check if hand is bust
 * @param {Array} cardIds - Array of card IDs
 * @returns {boolean} True if bust
 */
export const isBust = (cardIds) => {
  return getHandTotal(cardIds) > 21;
};
