import React from 'react';
import './Card.css';

/**
 * Returns the image path for a given card ID.
 * @param {number} cardId - Card ID (0–51)
 * @returns {string} Image path for the card
 */
const getCardImageSrc = (cardId) => {
  const RANKS_MAP = [
    "ace", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    "jack", "queen", "king"
  ];
  const SUITS_MAP = ["clubs", "diamonds", "hearts", "spades"];

  const rankIndex = cardId % 13;
  const suitIndex = Math.floor(cardId / 13);
  const extension = ".svg";

  if (rankIndex > 12 || suitIndex > 3 || cardId < 0) {
    console.error("Invalid cardId passed to getCardImageSrc:", cardId);
    return null; 
  }

  const rankName = RANKS_MAP[rankIndex];
  const suitName = SUITS_MAP[suitIndex];
  return process.env.PUBLIC_URL + `/cards/${rankName}_of_${suitName}${extension}`;
};

const CARD_BACK_SRC = process.env.PUBLIC_URL + '/cards/CARD_BACK.svg';

/**
 * Returns the readable name of a card for debugging/log display.
 * @param {number} cardId - Card ID (0–51) or 99 for hidden card
 */
export const cardName = (cardId) => {
  const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const SUITS = ["♣","♦","♥","♠"];
  if (cardId === 99) return "[Hidden]";
  if (cardId < 0 || cardId > 51) return "[?]";
  return `${RANKS[cardId % 13]}${SUITS[Math.floor(cardId / 13)]}`;
};

/**
 * Card component 
 * @param {number} cardId - Card ID (0–51). Use 99 to show back side.
 * @param {boolean} isFlipped - Whether the card is flipped (showing back)
 */
function Card({ cardId, isFlipped = false }) {
  const flipped = isFlipped || cardId === 99;
  const frontSrc = (!flipped && cardId !== 99) ? getCardImageSrc(cardId) : null;

  return (
    <div className={`card-inner ${flipped ? 'is-flipped' : ''}`}>
      {/* Front face */}
      <div className="card-face card-front">
        {frontSrc ? (
          <img 
            src={frontSrc}
            alt={`card-${cardId}`}
            onError={(e) => { 
              e.target.style.display = 'none'; 
              e.target.parentElement.innerHTML = `[${cardId}]`; 
            }}
          />
        ) : (
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {!flipped ? `[${cardId}]` : ''}
          </div>
        )}
      </div>

      {/* Back face */}
      <div className="card-face card-back">
        <img src={CARD_BACK_SRC} alt="Card Back" />
      </div>
    </div>
  );
}

export default Card;
