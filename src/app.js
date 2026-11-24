import { DaifugoGame } from "./game.js";

const statusElement = document.querySelector("#status");
const handElement = document.querySelector("#hand");
const tableCardElement = document.querySelector("#table-card");
const playerElement = document.querySelector(".player");
const humanTurnIndicator = document.querySelector("#human-turn-indicator");
const passButton = document.querySelector("#pass-button");
const skipActionButton = document.querySelector("#skip-action-button");
const restartButton = document.querySelector("#restart-button");
const opponentElements = document.querySelectorAll(".opponent");

let game = new DaifugoGame();
let aiTimer = null;
let cutTimer = null;
let cutCard = null;
let cardAnimating = false;
let flightCard = null;
let flightAnimation = null;
let pendingGiftCard = null;
let pendingDiscardCard = null;

function cardLabel(card) {
  return card ? (card.joker ? "ジョーカー" : `${card.suit}${card.rank}`) : "";
}

function render() {
  opponentElements.forEach((element) => {
    const player = Number(element.dataset.player);
    const count = game.hands[player].length;
    const hasTurn = !game.finished && game.currentPlayer === player;
    element.classList.toggle("active-turn", hasTurn);
    element.querySelector(".turn-indicator").hidden = !hasTurn;
    element.querySelector(".card-count").textContent = `${count}枚`;
    const indicator = element.querySelector(".pass-indicator");
    indicator.hidden =
      !game.passedPlayers.has(player) && game.skippedPlayer !== player;
    indicator.textContent = game.skippedPlayer === player
      ? "[スキップ]"
      : "[パス]";
  });

  const humanHasTurn = !game.finished && game.currentPlayer === 0;
  playerElement.classList.toggle("active-turn", humanHasTurn);
  humanTurnIndicator.hidden = !humanHasTurn;

  handElement.replaceChildren();
  const pendingActionCard = pendingGiftCard ?? pendingDiscardCard;
  handElement.classList.toggle("card-selection", pendingActionCard !== null);
  game.hands[0].forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      `card${card.joker ? " joker-card" : ["♥", "♦"].includes(card.suit) ? " red" : ""}`;
    button.dataset.cardId = card.id;
    button.setAttribute(
      "aria-label",
      pendingGiftCard
        ? `渡すカード: ${cardLabel(card)}`
        : pendingDiscardCard
          ? `捨てるカード: ${cardLabel(card)}`
          : cardLabel(card)
    );
    if (card.joker) {
      const image = document.createElement("img");
      image.className = "joker-image";
      image.src = "./joker.svg";
      image.alt = "";
      button.append(image);
    } else {
      button.textContent = cardLabel(card);
    }
    button.disabled = pendingActionCard
      ? card.id === pendingActionCard.id
      : game.finished || game.currentPlayer !== 0 ||
        cutCard !== null || cardAnimating || !game.canPlay(0, card);
    button.addEventListener("click", () => {
      if (pendingGiftCard) {
        const playedCard = pendingGiftCard;
        pendingGiftCard = null;
        if (!playCard(0, playedCard, card.id)) render();
        return;
      }

      if (pendingDiscardCard) {
        const playedCard = pendingDiscardCard;
        pendingDiscardCard = null;
        if (!playCard(0, playedCard, null, card.id)) render();
        return;
      }

      if ((card.value === 4 || card.value === 7) &&
          game.canGiftCard(0, card)) {
        pendingGiftCard = card;
        render();
        return;
      }

      if (card.value === 10 && game.canDiscardWithTen(0, card)) {
        pendingDiscardCard = card;
        render();
        return;
      }

      playCard(0, card);
    });
    handElement.append(button);
  });

  const visibleTableCard = cutCard ?? game.tableCard;
  tableCardElement.replaceChildren();
  tableCardElement.className =
    `table-card${cutCard ? " cut-in" : ""}${cardAnimating ? " arriving" : ""}${visibleTableCard && (visibleTableCard.joker || ["♥", "♦"].includes(visibleTableCard.suit)) ? " red" : ""}`;
  if (visibleTableCard?.joker) {
    const image = document.createElement("img");
    image.className = "joker-image";
    image.src = "./joker.svg";
    image.alt = "ジョーカー";
    tableCardElement.append(image);
  } else if (visibleTableCard) {
    tableCardElement.textContent = cardLabel(visibleTableCard);
  }
  passButton.disabled =
    game.finished || game.currentPlayer !== 0 || pendingActionCard !== null ||
    cutCard !== null || cardAnimating;
  skipActionButton.hidden = pendingActionCard === null;
  skipActionButton.textContent =
    pendingDiscardCard ? "捨てない" : "渡さない";
  const backStatus = game.elevenBackActive ? "／イレブンバック中" : "";

  if (pendingDiscardCard) {
    statusElement.textContent =
      `10捨て：捨てるカードを選んでください${backStatus}`;
  } else if (pendingGiftCard) {
    const recipient = game.getGiftRecipient(0, pendingGiftCard);
    const names = ["あなた", "AI 1", "AI 2", "AI 3"];
    const effect = pendingGiftCard.value === 4 ? "4戻し" : "7渡し";
    statusElement.textContent =
      `${effect}：${names[recipient]}に渡すカードを選んでください${backStatus}`;
  } else if (game.finished) {
    statusElement.textContent =
      game.winners[0] === 0
        ? "あなたの勝ちです！"
        : `AI ${game.winners[0]}の勝ちです！`;
  } else {
    const names = ["あなた", "AI 1", "AI 2", "AI 3"];
    const tableStatus = cutCard
      ? `／場札：${cardLabel(cutCard)}（場切り）`
      : game.tableCard
        ? `／場札：${cardLabel(game.tableCard)}`
        : "／場札なし";
    statusElement.textContent =
      `${names[game.currentPlayer]}の手番です${tableStatus}${backStatus}`;
  }

  if (!game.finished && game.currentPlayer !== 0) {
    scheduleAiTurn();
  }
}

function playCard(player, card, giftCardId = null, discardCardId = null) {
  const sourceRect = getCardSourceRect(player, card);
  const cutsTable = card.value === 8 ||
    (card.value === 3 &&
      (game.tableCard?.joker === true || game.elevenBackActive));
  if (!game.play(player, card, giftCardId, discardCardId)) return false;

  if (cutTimer !== null) window.clearTimeout(cutTimer);
  cutCard = cutsTable ? card : null;
  cutTimer = cutsTable
    ? window.setTimeout(() => {
      cutCard = null;
      cutTimer = null;
      render();
    }, 900)
    : null;
  cardAnimating = sourceRect !== null;
  render();
  if (sourceRect) {
    animateCardToTable(card, sourceRect, tableCardElement.getBoundingClientRect());
  }
  return true;
}

function getCardSourceRect(player, card) {
  if (player === 0) {
    const cardElement = [...handElement.querySelectorAll(".card")]
      .find((element) => element.dataset.cardId === card.id);
    if (cardElement) return cardElement.getBoundingClientRect();
  }

  const playerElement = player === 0
    ? document.querySelector(".player")
    : [...opponentElements].find(
      (element) => Number(element.dataset.player) === player
    );
  if (!playerElement) return null;

  const bounds = playerElement.getBoundingClientRect();
  const width = 72;
  const height = 104;
  return {
    left: bounds.left + (bounds.width - width) / 2,
    top: bounds.top + (bounds.height - height) / 2,
    width,
    height
  };
}

function animateCardToTable(card, sourceRect, targetRect) {
  flightCard = document.createElement("div");
  flightCard.className =
    `card play-flight${card.joker || ["♥", "♦"].includes(card.suit) ? " red" : ""}${card.joker ? " joker-card" : ""}`;
  flightCard.setAttribute("aria-hidden", "true");
  flightCard.style.left = `${sourceRect.left}px`;
  flightCard.style.top = `${sourceRect.top}px`;
  flightCard.style.width = `${sourceRect.width}px`;
  flightCard.style.height = `${sourceRect.height}px`;
  if (card.joker) {
    const image = document.createElement("img");
    image.className = "joker-image";
    image.src = "./joker.svg";
    image.alt = "";
    flightCard.append(image);
  } else {
    flightCard.textContent = cardLabel(card);
  }
  document.body.append(flightCard);

  if (typeof flightCard.animate !== "function") {
    flightCard.remove();
    flightCard = null;
    cardAnimating = false;
    render();
    return;
  }

  flightAnimation = flightCard.animate(
    [
      {
        left: `${sourceRect.left}px`,
        top: `${sourceRect.top}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
        fontSize: "22px"
      },
      {
        left: `${targetRect.left}px`,
        top: `${targetRect.top}px`,
        width: `${targetRect.width}px`,
        height: `${targetRect.height}px`,
        fontSize: "38px"
      }
    ],
    {
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 1
        : 520,
      easing: "cubic-bezier(0.2, 0.75, 0.3, 1)",
      fill: "forwards"
    }
  );
  flightAnimation.onfinish = finishCardAnimation;
  flightAnimation.oncancel = finishCardAnimation;
}

function finishCardAnimation(event) {
  if (flightAnimation !== event.currentTarget) return;
  flightCard?.remove();
  flightCard = null;
  flightAnimation = null;
  cardAnimating = false;
  render();
}

function cancelCardAnimation() {
  if (flightAnimation) {
    flightAnimation.onfinish = null;
    flightAnimation.oncancel = null;
    flightAnimation.cancel();
  }
  flightCard?.remove();
  flightCard = null;
  flightAnimation = null;
  cardAnimating = false;
}

function scheduleAiTurn() {
  if (aiTimer !== null) return;
  aiTimer = window.setTimeout(() => {
    aiTimer = null;
    if (game.finished) return;

    const player = game.currentPlayer;
    if (player === 0) {
      render();
      return;
    }

    const card = game.chooseAiCard(player);
    if (card) {
      const giftCard = game.chooseAiGiftCard(player, card);
      const discardCard = game.chooseAiDiscardCard(player, card);
      playCard(
        player,
        card,
        giftCard?.id ?? null,
        discardCard?.id ?? null
      );
    } else {
      game.pass(player);
      render();
    }
  }, 2000 + Math.random() * 2000);
}

passButton.addEventListener("click", () => {
  if (game.pass(0)) {
    render();
  }
});

skipActionButton.addEventListener("click", () => {
  if (pendingGiftCard) {
    const playedCard = pendingGiftCard;
    pendingGiftCard = null;
    if (!playCard(0, playedCard)) render();
  } else if (pendingDiscardCard) {
    const playedCard = pendingDiscardCard;
    pendingDiscardCard = null;
    if (!playCard(0, playedCard)) render();
  }
});

restartButton.addEventListener("click", () => {
  if (aiTimer !== null) window.clearTimeout(aiTimer);
  if (cutTimer !== null) window.clearTimeout(cutTimer);
  cancelCardAnimation();
  aiTimer = null;
  cutTimer = null;
  cutCard = null;
  pendingGiftCard = null;
  pendingDiscardCard = null;
  game = new DaifugoGame();
  render();
});

render();
