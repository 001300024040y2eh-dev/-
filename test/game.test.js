import test from "node:test";
import assert from "node:assert/strict";
import {
  DaifugoGame,
  compareCards,
  createDeck,
  shuffle,
  sortHand
} from "../src/game.js";

test("deck contains 54 unique cards with two jokers", () => {
  const deck = createDeck();
  assert.equal(deck.length, 54);
  assert.equal(new Set(deck.map((card) => card.id)).size, 54);
  assert.equal(deck.filter((card) => card.joker).length, 2);
});

test("shuffle deals every card exactly once", () => {
  const original = createDeck();
  const shuffled = shuffle(original, () => 0.25);
  assert.deepEqual(
    [...original].sort((a, b) => a.id.localeCompare(b.id)),
    [...shuffled].sort((a, b) => a.id.localeCompare(b.id))
  );
});

test("card strength runs from 3 through 2", () => {
  const three = { value: 3 };
  const ace = { value: 14 };
  const two = { value: 15 };
  assert.equal(compareCards(two, ace), true);
  assert.equal(compareCards(three, two), false);
  assert.equal(compareCards(three, null), true);
});

test("hand sorting puts low cards before high cards", () => {
  const hand = [
    { suit: "♠", rank: "2", value: 15 },
    { suit: "♣", rank: "3", value: 3 },
    { suit: "A", rank: "A", value: 14 }
  ];
  assert.deepEqual(
    sortHand(hand).map((card) => card.value),
    [3, 14, 15]
  );
});

test("a game deals 54 cards evenly", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  assert.deepEqual(game.hands.map((hand) => hand.length), [14, 14, 13, 13]);
});

test("joker beats normal cards but cannot beat a 3", () => {
  const joker = { joker: true, id: "joker-1" };
  const three = { value: 3 };
  const two = { value: 15 };

  assert.equal(compareCards(joker, three), false);
  assert.equal(compareCards(joker, two), true);
  assert.equal(compareCards(three, joker), true);
  assert.equal(compareCards(two, joker), false);
  assert.equal(compareCards(joker, { joker: true, id: "joker-2" }), false);
});

test("joker cannot be played from a joker-only hand", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const joker = { joker: true, id: "joker-1", rank: "ジョーカー" };
  game.hands = [[joker], [], [], []];
  game.currentPlayer = 0;
  assert.equal(game.canPlay(0, joker), false);

  game.hands = [[joker, { id: "♠-3", value: 3 }], [], [], []];
  assert.equal(game.canPlay(0, joker), true);
});

test("playing a 4 can transfer a selected card to the previous active player", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const four = { id: "♠-4", value: 4 };
  const gift = { id: "♠-7", value: 7 };
  const previousPlayerCard = { id: "♦-10", value: 10 };
  game.hands = [
    [four, gift, { id: "♥-8", value: 8 }],
    [{ id: "♣-9", value: 9 }],
    [],
    [previousPlayerCard]
  ];
  game.currentPlayer = 0;

  assert.equal(game.canGiftCard(0, four), true);
  assert.equal(game.getPreviousActivePlayer(0), 3);
  assert.equal(game.play(0, four, gift.id), true);
  assert.deepEqual(game.hands[0].map((card) => card.id), ["♥-8"]);
  assert.equal(game.hands[3].length, 2);
  assert.equal(game.hands[3].some((card) => card.id === gift.id), true);
  assert.equal(game.tableCard, four);
});

test("4 return skips empty players and rejects invalid gifts", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const four = { id: "♠-4", value: 4 };
  const otherCard = { id: "♠-6", value: 6 };
  game.hands = [
    [four, otherCard],
    [{ id: "♣-9", value: 9 }],
    [{ id: "♦-10", value: 10 }],
    []
  ];
  game.currentPlayer = 0;

  assert.equal(game.getPreviousActivePlayer(0), 2);
  assert.equal(game.play(0, four, four.id), false);
  assert.equal(game.play(0, { id: "♠-5", value: 5 }, otherCard.id), false);
  assert.equal(game.hands[0].length, 2);
  assert.equal(game.hands[2].length, 1);
});

test("playing a 7 transfers a selected card to the next active player", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const seven = { id: "♠-7", value: 7 };
  const gift = { id: "♠-3", value: 3 };
  game.hands = [
    [seven, gift, { id: "♥-8", value: 8 }],
    [],
    [{ id: "♦-10", value: 10 }],
    [{ id: "♣-9", value: 9 }]
  ];
  game.currentPlayer = 0;

  assert.equal(game.canGiftCard(0, seven), true);
  assert.equal(game.getGiftRecipient(0, seven), 2);
  assert.equal(game.play(0, seven, gift.id), true);
  assert.equal(game.hands[2].some((card) => card.id === gift.id), true);
  assert.equal(game.currentPlayer, 2);
});

test("playing a 10 discards a selected extra card from the hand", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const ten = { id: "♠-10", value: 10 };
  const discard = { id: "♠-3", value: 3 };
  const remaining = { id: "♠-8", value: 8 };
  game.hands = [
    [ten, discard, remaining],
    [{ id: "♥-9", value: 9 }],
    [{ id: "♦-J", value: 11 }],
    [{ id: "♣-Q", value: 12 }]
  ];
  game.currentPlayer = 0;

  assert.equal(game.canDiscardWithTen(0, ten), true);
  assert.equal(game.chooseAiDiscardCard(0, ten), discard);
  assert.equal(game.play(0, ten, null, discard.id), true);
  assert.deepEqual(game.hands[0], [remaining]);
  assert.equal(game.tableCard, ten);
  assert.equal(game.currentPlayer, 1);
});

test("10 discard can finish the hand and rejects invalid discard cards", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const ten = { id: "♠-10", value: 10 };
  const discard = { id: "♠-3", value: 3 };
  game.hands = [[ten, discard], [{ id: "♥-9", value: 9 }], [], []];
  game.currentPlayer = 0;

  assert.equal(game.play(0, ten, null, ten.id), false);
  assert.equal(game.play(0, { id: "♠-9", value: 9 }, null, discard.id), false);
  assert.equal(game.hands[0].length, 2);

  assert.equal(game.play(0, ten, null, discard.id), true);
  assert.equal(game.finished, true);
  assert.deepEqual(game.hands[0], []);
});

test("AI gives the lowest remaining card when it plays a 4", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const four = { id: "♠-4", value: 4 };
  const lowCard = { id: "♠-3", value: 3 };
  const highCard = { id: "♠-8", value: 8 };
  game.hands = [
    [four, lowCard, highCard],
    [{ id: "♣-9", value: 9 }],
    [],
    [{ id: "♦-10", value: 10 }]
  ];
  game.currentPlayer = 0;

  assert.equal(game.chooseAiGiftCard(0, four), lowCard);
});

test("playing a 5 skips the next active player", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const five = { id: "♠-5", value: 5 };
  game.hands = [
    [five, { id: "♠-8", value: 8 }],
    [{ id: "♥-6", value: 6 }],
    [{ id: "♦-7", value: 7 }],
    [{ id: "♣-9", value: 9 }]
  ];
  game.currentPlayer = 0;

  assert.equal(game.play(0, five), true);
  assert.equal(game.skippedPlayer, 1);
  assert.equal(game.currentPlayer, 2);

  assert.equal(game.pass(2), true);
  assert.equal(game.skippedPlayer, null);
});

test("5 skip ignores players who are already out", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const five = { id: "♠-5", value: 5 };
  game.hands = [
    [five, { id: "♠-8", value: 8 }],
    [],
    [{ id: "♦-7", value: 7 }],
    [{ id: "♣-9", value: 9 }]
  ];
  game.currentPlayer = 0;

  assert.equal(game.play(0, five), true);
  assert.equal(game.skippedPlayer, 2);
  assert.equal(game.currentPlayer, 3);
});

test("playing a 3 after a joker cuts the table immediately", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const joker = { joker: true, id: "joker-1" };
  const three = { id: "♠-3", value: 3 };

  game.hands = [
    [joker, { id: "♥-5", value: 5 }],
    [three, { id: "♦-4", value: 4 }],
    [],
    []
  ];
  game.currentPlayer = 0;
  assert.equal(game.play(0, joker), true);
  assert.equal(game.currentPlayer, 1);

  assert.equal(game.play(1, three), true);
  assert.equal(game.tableCard, null);
  assert.equal(game.currentPlayer, 1);
  assert.equal(game.consecutivePasses, 0);
  assert.equal(game.passedPlayers.size, 0);
});

test("playing an 8 clears the table and lets the same player lead again", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const eight = { id: "♠-8", value: 8 };
  const three = { id: "♠-3", value: 3 };
  game.hands = [
    [eight, three, { id: "♥-9", value: 9 }],
    [{ id: "♣-10", value: 10 }],
    [{ id: "♦-J", value: 11 }],
    [{ id: "♠-Q", value: 12 }]
  ];
  game.currentPlayer = 0;
  game.tableCard = { id: "♣-6", value: 6 };
  game.consecutivePasses = 1;
  game.passedPlayers.add(3);

  assert.equal(game.play(0, eight), true);
  assert.equal(game.tableCard, null);
  assert.equal(game.currentPlayer, 0);
  assert.equal(game.consecutivePasses, 0);
  assert.equal(game.passedPlayers.size, 0);
  assert.equal(game.canPlay(0, three), true);

  assert.equal(game.play(0, three), true);
  assert.equal(game.tableCard, three);
  assert.equal(game.currentPlayer, 1);
});

test("11 back reverses strength, disables jokers, and ends on 8", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const jack = { id: "♠-J", value: 11 };
  const ten = { id: "♠-10", value: 10 };
  const queen = { id: "♠-Q", value: 12 };
  const joker = { id: "joker-1", joker: true };
  const eight = { id: "♠-8", value: 8 };
  const three = { id: "♠-3", value: 3 };
  const secondJoker = { id: "joker-2", joker: true };
  game.hands = [
    [jack, { id: "♥-6", value: 6 }],
    [ten, queen, joker],
    [eight, three, secondJoker],
    [{ id: "♦-9", value: 9 }]
  ];
  game.currentPlayer = 0;
  game.tableCard = { id: "♣-7", value: 7 };

  assert.equal(compareCards(three, ten, true), true);
  assert.equal(compareCards(ten, jack, true), true);
  assert.equal(compareCards(jack, ten, true), false);
  assert.equal(game.play(0, jack), true);
  assert.equal(game.elevenBackActive, true);
  assert.equal(game.canPlay(1, ten), true);
  assert.equal(game.canPlay(1, queen), false);
  assert.equal(game.canPlay(1, joker), false);

  assert.equal(game.play(1, ten), true);
  assert.equal(game.play(2, eight), true);
  assert.equal(game.tableCard, null);
  assert.equal(game.currentPlayer, 2);
  assert.equal(game.elevenBackActive, false);
  assert.equal(game.canPlay(2, secondJoker), true);
});

test("passing out a table clears 11 back", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const jack = { id: "♠-J", value: 11 };
  game.hands = [
    [jack, { id: "♠-6", value: 6 }],
    [{ id: "♥-7", value: 7 }],
    [{ id: "♦-8", value: 8 }],
    [{ id: "♣-9", value: 9 }]
  ];
  game.currentPlayer = 0;
  game.tableCard = { id: "♣-10", value: 10 };

  assert.equal(game.play(0, jack), true);
  assert.equal(game.elevenBackActive, true);
  game.pass(1);
  game.pass(2);
  game.pass(3);

  assert.equal(game.tableCard, null);
  assert.equal(game.elevenBackActive, false);
  assert.equal(game.currentPlayer, 0);
});

test("a 3 immediately cuts the table during 11 back", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const three = { id: "♠-3", value: 3 };
  game.hands = [
    [three, { id: "♠-9", value: 9 }],
    [{ id: "♥-10", value: 10 }],
    [{ id: "♦-J", value: 11 }],
    [{ id: "♣-Q", value: 12 }]
  ];
  game.currentPlayer = 0;
  game.tableCard = { id: "♣-5", value: 5 };
  game.elevenBackActive = true;
  game.consecutivePasses = 2;
  game.passedPlayers.add(3);

  assert.equal(game.play(0, three), true);
  assert.equal(game.tableCard, null);
  assert.equal(game.elevenBackActive, false);
  assert.equal(game.consecutivePasses, 0);
  assert.equal(game.passedPlayers.size, 0);
  assert.equal(game.currentPlayer, 0);
  assert.equal(game.canPlay(0, { id: "♠-9", value: 9 }), true);
});

test("AI preserves valuable cards early but spends them in the endgame", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const two = { id: "♠-2", value: 15 };
  const joker = { id: "joker-1", joker: true };

  game.hands = [
    [two, joker, { id: "♠-5", value: 5 }, { id: "♠-6", value: 6 },
      { id: "♠-7", value: 7 }, { id: "♠-8", value: 8 }],
    [{ id: "♠-10", value: 10 }],
    [{ id: "♠-J", value: 11 }],
    [{ id: "♠-Q", value: 12 }, { id: "♠-4", value: 4 }]
  ];
  game.currentPlayer = 0;
  game.leadPlayer = 3;
  game.tableCard = { id: "♠-A", value: 14 };
  assert.equal(game.chooseAiCard(0), null);

  game.hands[0] = [two, joker, { id: "♠-5", value: 5 }];
  assert.equal(game.chooseAiCard(0), two);
});

test("AI also saves a king early, but uses it late", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const king = { id: "♠-K", value: 13 };
  game.hands = [
    [king, ...Array.from({ length: 8 }, (_, index) => ({
      id: `low-${index}`,
      value: 3
    }))],
    [{ id: "♠-10", value: 10 }],
    [{ id: "♠-J", value: 11 }],
    [{ id: "♠-Q", value: 12 }, { id: "♠-4", value: 4 }]
  ];
  game.currentPlayer = 0;
  game.leadPlayer = 3;
  game.tableCard = { id: "♠-9", value: 9 };
  assert.equal(game.chooseAiCard(0), null);

  game.hands[0] = [king, { id: "low-0", value: 3 }, { id: "low-1", value: 3 }];
  assert.equal(game.chooseAiCard(0), king);
});

test("play requires an exact turn and a stronger card", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const card = game.hands[0][0];
  assert.equal(game.canPlay(1, card), false);

  game.tableCard = { value: 10 };
  assert.equal(
    game.canPlay(0, { ...card, value: 9 }),
    false
  );
});

test("passing advances to the next player", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  assert.equal(game.pass(0), true);
  assert.equal(game.currentPlayer, 1);
  assert.equal(game.passedPlayers.has(0), true);
});

test("everyone passing ends the round and starts it with the last card player", () => {
  const game = new DaifugoGame({ random: () => 0.42 });
  const card = game.hands[0][0];

  game.play(0, card);
  assert.equal(game.currentPlayer, 1);

  game.pass(1);
  game.pass(2);
  game.pass(3);

  assert.equal(game.tableCard, null);
  assert.equal(game.currentPlayer, 0);
  assert.deepEqual([...game.passedPlayers], [1, 2, 3]);
  assert.equal(game.play(0, game.hands[0][0]), true);
  assert.equal(game.passedPlayers.size, 0);
});
