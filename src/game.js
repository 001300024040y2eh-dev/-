export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = [
  { name: "3", value: 3 },
  { name: "4", value: 4 },
  { name: "5", value: 5 },
  { name: "6", value: 6 },
  { name: "7", value: 7 },
  { name: "8", value: 8 },
  { name: "9", value: 9 },
  { name: "10", value: 10 },
  { name: "J", value: 11 },
  { name: "Q", value: 12 },
  { name: "K", value: 13 },
  { name: "A", value: 14 },
  { name: "2", value: 15 }
];

export function createDeck() {
  const cards = RANKS.flatMap((rank) =>
    SUITS.map((suit) => ({
      suit,
      rank: rank.name,
      value: rank.value,
      id: `${suit}-${rank.name}`
    }))
  );
  for (let index = 1; index <= 2; index += 1) {
    cards.push({
      suit: "★",
      rank: "ジョーカー",
      value: null,
      id: `joker-${index}`,
      joker: true
    });
  }
  return cards;
}

export function shuffle(cards, random = Math.random) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] =
      [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function compareCards(card, tableCard, reversed = false) {
  if (reversed && card.joker) return false;
  if (tableCard === null) return true;
  if (card.joker) {
    return tableCard.joker ? false : tableCard.value !== 3;
  }
  if (tableCard.joker) return card.value === 3;
  return reversed
    ? card.value < tableCard.value
    : card.value > tableCard.value;
}

export function sortHand(hand) {
  return [...hand].sort((a, b) => {
    if (a.joker !== b.joker) return a.joker ? 1 : -1;
    if (a.joker) return 0;
    return a.value - b.value ||
      SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  });
}

export class DaifugoGame {
  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.hands = [[], [], [], []];
    this.currentPlayer = 0;
    this.leadPlayer = 0;
    this.tableCard = null;
    this.elevenBackActive = false;
    this.consecutivePasses = 0;
    this.passedPlayers = new Set();
    this.skippedPlayer = null;
    this.winners = [];
    this.finished = false;
    this.deal();
  }

  deal() {
    const deck = shuffle(createDeck(), this.random);
    for (let index = 0; index < deck.length; index += 1) {
      this.hands[index % 4].push(deck[index]);
    }
    this.hands = this.hands.map(sortHand);
  }

  get activePlayers() {
    return [0, 1, 2, 3].filter((player) =>
      this.hands[player].length > 0
    );
  }

  canPlay(player, card) {
    if (this.finished || player !== this.currentPlayer) return false;
    if (!this.hands[player].some((handCard) => handCard.id === card.id)) {
      return false;
    }
    if (card.joker) {
      const nonJokers = this.hands[player].filter(
        (handCard) => !handCard.joker
      );
      if (nonJokers.length === 0) return false;
    }
    return compareCards(card, this.tableCard, this.elevenBackActive);
  }

  getPreviousActivePlayer(player) {
    if (!Number.isInteger(player) || player < 0 || player >= this.hands.length) {
      return null;
    }
    for (let offset = 1; offset < this.hands.length; offset += 1) {
      const previous = (player - offset + this.hands.length) % this.hands.length;
      if (this.hands[previous].length > 0) return previous;
    }
    return null;
  }

  getNextActivePlayer(player) {
    if (!Number.isInteger(player) || player < 0 || player >= this.hands.length) {
      return null;
    }
    for (let offset = 1; offset < this.hands.length; offset += 1) {
      const next = (player + offset) % this.hands.length;
      if (this.hands[next].length > 0) return next;
    }
    return null;
  }

  getGiftRecipient(player, playedCard) {
    if (playedCard.value === 4) return this.getPreviousActivePlayer(player);
    if (playedCard.value === 7) return this.getNextActivePlayer(player);
    return null;
  }

  canGiftCard(player, card) {
    return (card.value === 4 || card.value === 7) &&
      this.hands[player]?.some((handCard) => handCard.id === card.id) &&
      this.hands[player].length > 1 &&
      this.getGiftRecipient(player, card) !== null;
  }

  canDiscardWithTen(player, playedCard) {
    return playedCard.value === 10 &&
      this.hands[player]?.some((card) => card.id === playedCard.id) &&
      this.hands[player].length > 1;
  }

  chooseAiGiftCard(player, playedCard) {
    if (!this.canGiftCard(player, playedCard)) return null;
    const candidates = this.hands[player].filter(
      (card) => card.id !== playedCard.id
    );
    return sortHand(candidates)[0] ?? null;
  }

  chooseAiDiscardCard(player, playedCard) {
    if (!this.canDiscardWithTen(player, playedCard)) return null;
    const candidates = this.hands[player].filter(
      (card) => card.id !== playedCard.id
    );
    return sortHand(candidates)[0] ?? null;
  }

  play(player, card, giftCardId = null, discardCardId = null) {
    if (!this.canPlay(player, card)) return false;

    const giftRecipient = this.getGiftRecipient(player, card);
    const giftCard = giftCardId === null
      ? null
      : this.hands[player].find(
        (handCard) => handCard.id === giftCardId && handCard.id !== card.id
      );
    const discardCard = discardCardId === null
      ? null
      : this.hands[player].find(
        (handCard) => handCard.id === discardCardId && handCard.id !== card.id
      );
    if (
      (giftCardId !== null && (!giftCard || giftRecipient === null)) ||
      (discardCardId !== null && (card.value !== 10 || !discardCard)) ||
      (giftCardId !== null && discardCardId !== null)
    ) {
      return false;
    }

    const wasJokerOnTable = this.tableCard?.joker === true;
    const wasElevenBackActive = this.elevenBackActive;
    this.passedPlayers.clear();
    this.skippedPlayer = null;
    this.hands[player] = this.hands[player].filter(
      (handCard) =>
        handCard.id !== card.id &&
        handCard.id !== giftCard?.id &&
        handCard.id !== discardCard?.id
    );
    if (giftCard) {
      this.hands[giftRecipient].push(giftCard);
      this.hands[giftRecipient] = sortHand(this.hands[giftRecipient]);
    }
    this.tableCard = card;
    this.leadPlayer = player;
    this.consecutivePasses = 0;
    if (card.value === 11) this.elevenBackActive = true;

    const cutsTable = card.value === 8 ||
      (card.value === 3 && (wasJokerOnTable || wasElevenBackActive));
    if (cutsTable) {
      this.tableCard = null;
      this.elevenBackActive = false;
      this.consecutivePasses = 0;
      this.passedPlayers.clear();
      this.currentPlayer = this.leadPlayer;
      if (this.hands[this.currentPlayer].length === 0) {
        this.moveToNextPlayer();
      }
    }

    if (this.hands[player].length === 0) {
      this.winners.push(player);
      if (this.winners.length === 1) {
        this.finished = true;
        return true;
      }
    }

    if (cutsTable) return true;

    const skippedPlayer = card.value === 5
      ? this.getNextActivePlayer(player)
      : null;
    if (skippedPlayer !== null) {
      this.skippedPlayer = skippedPlayer;
      this.moveToNextPlayer();
    }
    this.moveToNextPlayer();
    return true;
  }

  pass(player) {
    if (this.finished || player !== this.currentPlayer) return false;

    this.skippedPlayer = null;
    this.passedPlayers.add(player);
    this.consecutivePasses += 1;
    const activeCount = this.activePlayers.length;
    if (this.consecutivePasses >= activeCount - 1) {
      this.tableCard = null;
      this.elevenBackActive = false;
      this.consecutivePasses = 0;
      this.currentPlayer = this.leadPlayer;
      if (this.hands[this.currentPlayer].length === 0) {
        this.moveToNextPlayer();
      }
    } else {
      this.moveToNextPlayer();
    }
    return true;
  }

  moveToNextPlayer() {
    for (let offset = 1; offset <= 4; offset += 1) {
      const next = (this.currentPlayer + offset) % 4;
      if (this.hands[next].length > 0) {
        this.currentPlayer = next;
        return;
      }
    }
  }

  chooseAiCard(player) {
    if (player !== this.currentPlayer) return null;
    const playable = this.hands[player].filter((card) =>
      this.canPlay(player, card)
    );
    if (playable.length === 0) return null;

    const urgent = this.hands[player].length === 1 ||
      this.hands[this.leadPlayer].length === 1;
    const handSize = this.hands[player].length;
    const preserveFrom = handSize >= 9 ? 13 : handSize >= 5 ? 15 : Infinity;
    const preserveThrough = handSize >= 9 ? 5 : handSize >= 5 ? 3 : -Infinity;
    const economical = this.elevenBackActive
      ? playable.filter((card) => card.value > preserveThrough)
      : playable.filter((card) =>
        (card.joker ? 16 : card.value) < preserveFrom
      );
    if (!urgent && this.tableCard && economical.length === 0) return null;

    const choices = economical.length > 0 ? economical : playable;
    return this.elevenBackActive
      ? [...choices].sort((a, b) => b.value - a.value)[0]
      : sortHand(choices)[0];
  }
}
