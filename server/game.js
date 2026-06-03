//Game States
export const SUITS = ["♠", "♥", "♦", "♣"];
export const VALUES = ["A","2","3","4","5","6","7","8","9","10","J","Q","K",];
export const cardGames = ["LastCard"];

//Builds the deck
export function buildDeck() {
  const deck = [];

  //Should create 52 cards
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({
        id: `${suit}${value}`,
        suit: suit,
        value: value,
      });
    }
  }

  // Fisher-Yates, picks j from remaining unshuffled range
  function shuffle() {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  return shuffle(); //returns whatever shuffle returns which is the shuffled deck.
}

//Creates the game state
export function createGame(playerIDS, selectedGame) {
  const deck = buildDeck();
  const hands = {};
  let startCard = null;

  if (selectedGame == "LastCard") {
    //For each of the players give 7 cards each
    for (const id of playerIDS) {
      hands[id] = [];
      for (let i = 0; i < 7; i++) {
        hands[id].push(deck.shift());
      }
    }

    startCard = deck[0];
    deck.shift();

    return {
      players: playerIDS,
      hands,
      deck,
      discard: [startCard],
      currSuit: startCard.suit,
      currIndex: 0,
      direction: 1,
      drawStack: 0,
      winner: null,
      log: "Game Started!",
      selectedGame: "LastCard",
    };
  }

  if (selectedGame === "Blackjack") {
    // start in betting phase — no cards dealt until both players bet
    return {
      players: playerIDS,
      hands: Object.fromEntries(playerIDS.map(id => [id, []])),
      scores: Object.fromEntries(playerIDS.map(id => [id, 0])),
      status: Object.fromEntries(playerIDS.map(id => [id, "waiting"])),
      bets: {},
      chips: Object.fromEntries(playerIDS.map(id => [id, STARTING_CHIPS])),
      dealerHand: [],
      dealerScore: 0,
      dealerHoleHidden: true,
      deck,
      currIndex: 0,
      direction: 1,
      phase: "betting", // "betting" | "playing" | "resolved"
      winner: null,
      results: null,    // { p1: 'win'|'lose'|'push'|'blackjack'|'bust', ... }
      log: "Place your bets to start the round.",
      selectedGame: "Blackjack",
    };
  }
}

// ─── Blackjack ─────────────────────────────────────────────────────────────
// players play against a server-controlled dealer. flow:
//   betting  → both players place a bet
//   playing  → cards dealt; each player hits/stands/doubles in turn
//   (auto)   → dealer reveals hole card and hits to 17
//   resolved → payouts applied; "next round" returns to betting
//
// payouts: blackjack pays 3:2, win pays 1:1, push returns bet, lose/bust loses bet

const STARTING_CHIPS = 500;
const MIN_BET = 10;

// score a Blackjack hand. Aces count as 11 unless that busts, then they drop to 1
export function scoreHand(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.value === 'A') { aces += 1; total += 11; }
    else if (c.value === 'J' || c.value === 'Q' || c.value === 'K') total += 10;
    else total += parseInt(c.value, 10);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

// place a bet during the betting phase. once both players have bet, the round deals automatically
export function placeBet(state, playerID, amount) {
  if (state.selectedGame !== "Blackjack") return { newState: state, error: "Not Blackjack" };
  if (state.phase !== "betting")          return { newState: state, error: "Not in betting phase" };
  if (!state.players.includes(playerID))  return { newState: state, error: "Not a player" };
  if (state.bets[playerID])               return { newState: state, error: "Bet already placed" };

  const a = parseInt(amount, 10);
  if (!Number.isFinite(a) || a < MIN_BET) {
    return { newState: state, error: `Bet must be at least ${MIN_BET}` };
  }
  if (a > state.chips[playerID]) {
    return { newState: state, error: "Not enough chips" };
  }

  const newBets  = { ...state.bets,  [playerID]: a };
  const newChips = { ...state.chips, [playerID]: state.chips[playerID] - a };
  let newState = {
    ...state,
    bets: newBets,
    chips: newChips,
    log: `${playerID} bet ${a}`,
  };

  // both bets in — deal the round
  if (state.players.every(id => newBets[id])) {
    newState = dealRound(newState);
  }
  return { newState, error: null };
}

// deal 2 cards to each player and 2 to the dealer (hole card stays hidden client-side)
function dealRound(state) {
  let deck = [...state.deck];

  // reshuffle if we don't have enough for the round (worst case ~6 cards)
  const needed = state.players.length * 2 + 2;
  if (deck.length < needed) deck = buildDeck();

  const hands = {};
  for (const id of state.players) {
    hands[id] = [deck.shift(), deck.shift()];
  }
  const dealerHand = [deck.shift(), deck.shift()];

  const scores = {};
  const status = {};
  for (const id of state.players) {
    scores[id] = scoreHand(hands[id]);
    status[id] = scores[id] === 21 ? "blackjack" : "playing";
  }

  let newState = {
    ...state,
    deck,
    hands,
    scores,
    status,
    dealerHand,
    dealerScore: scoreHand(dealerHand),
    dealerHoleHidden: true,
    phase: "playing",
    log: "Cards dealt.",
  };

  // if everyone got a natural blackjack, no decisions to make — go straight to dealer
  if (!state.players.some(id => status[id] === "playing")) {
    return playDealer(newState);
  }

  // start with the first player who's still playing
  for (let i = 0; i < state.players.length; i++) {
    if (status[state.players[i]] === "playing") {
      newState = { ...newState, currIndex: i };
      break;
    }
  }
  return newState;
}

// player takes another card. both players can act independently — Blackjack is
// each-player-vs-dealer, so turn order doesn't matter the way it does in LastCard
export function hit(state, playerID) {
  if (state.phase !== "playing") return { newState: state, error: "Not in playing phase" };
  if (state.status[playerID] !== "playing") {
    return { newState: state, error: "You're not playing anymore" };
  }
  if (state.deck.length === 0) {
    return { newState: state, error: "Deck is empty" };
  }

  const newDeck = [...state.deck];
  const card = newDeck.shift();
  const newHand = [...state.hands[playerID], card];
  const newScore = scoreHand(newHand);

  let newStatus = "playing";
  let log = `${playerID} hit — ${card.value}${card.suit} (${newScore})`;
  if (newScore > 21)        { newStatus = "busted";   log = `${playerID} busted at ${newScore}!`; }
  else if (newScore === 21) { newStatus = "standing"; log = `${playerID} hit 21!`; }

  let newState = {
    ...state,
    deck: newDeck,
    hands:  { ...state.hands,  [playerID]: newHand },
    scores: { ...state.scores, [playerID]: newScore },
    status: { ...state.status, [playerID]: newStatus },
    log,
  };
  if (newStatus !== "playing") newState = endTurnOrRound(newState);
  return { newState, error: null };
}

// player locks in their score
export function stand(state, playerID) {
  if (state.phase !== "playing") return { newState: state, error: "Not in playing phase" };
  if (state.status[playerID] !== "playing") {
    return { newState: state, error: "You're already done" };
  }

  let newState = {
    ...state,
    status: { ...state.status, [playerID]: "standing" },
    log: `${playerID} stands at ${state.scores[playerID]}`,
  };
  return { newState: endTurnOrRound(newState), error: null };
}

// double down — only allowed on the first 2 cards. doubles the bet, draws exactly 1 card, then stands
export function double(state, playerID) {
  if (state.phase !== "playing") return { newState: state, error: "Not in playing phase" };
  if (state.status[playerID] !== "playing") {
    return { newState: state, error: "Can't double now" };
  }
  if (state.hands[playerID].length !== 2) {
    return { newState: state, error: "Can only double on first 2 cards" };
  }
  if (state.chips[playerID] < state.bets[playerID]) {
    return { newState: state, error: "Not enough chips to double" };
  }
  if (state.deck.length === 0) {
    return { newState: state, error: "Deck is empty" };
  }

  const newChips = { ...state.chips, [playerID]: state.chips[playerID] - state.bets[playerID] };
  const newBets  = { ...state.bets,  [playerID]: state.bets[playerID] * 2 };

  const newDeck = [...state.deck];
  const card = newDeck.shift();
  const newHand = [...state.hands[playerID], card];
  const newScore = scoreHand(newHand);
  const newStatus = newScore > 21 ? "busted" : "standing";

  let newState = {
    ...state,
    deck: newDeck,
    chips: newChips,
    bets:  newBets,
    hands:  { ...state.hands,  [playerID]: newHand },
    scores: { ...state.scores, [playerID]: newScore },
    status: { ...state.status, [playerID]: newStatus },
    log: `${playerID} doubled — drew ${card.value}${card.suit} (${newScore})`,
  };
  return { newState: endTurnOrRound(newState), error: null };
}

// once a player's action finishes, run the dealer iff everyone else is also done.
// no currIndex bookkeeping — both players play in parallel against the same dealer
function endTurnOrRound(state) {
  const allDone = state.players.every(id => state.status[id] !== "playing");
  return allDone ? playDealer(state) : state;
}

// reveal the hole card and hit until the dealer has 17 or more, then resolve all bets
function playDealer(state) {
  let deck = [...state.deck];
  let dealerHand = [...state.dealerHand];
  let dealerScore = scoreHand(dealerHand);

  // if every player busted, the dealer doesn't actually need to draw — but for transparency, we still flip
  const anyPlayerStanding = state.players.some(id =>
    state.status[id] === "standing" || state.status[id] === "blackjack"
  );

  while (anyPlayerStanding && dealerScore < 17 && deck.length > 0) {
    dealerHand.push(deck.shift());
    dealerScore = scoreHand(dealerHand);
  }

  // payouts
  const dealerBlackjack = dealerScore === 21 && state.dealerHand.length === 2;
  const results = {};
  const newChips = { ...state.chips };

  for (const id of state.players) {
    const ps = state.scores[id];
    const bet = state.bets[id];
    const playerBlackjack = state.status[id] === "blackjack";

    let result;
    if (state.status[id] === "busted") {
      result = "bust"; // bet already taken
    } else if (playerBlackjack && dealerBlackjack) {
      result = "push";
      newChips[id] += bet;
    } else if (playerBlackjack) {
      result = "blackjack";
      newChips[id] += bet + Math.floor(bet * 1.5);   // 3:2 payout + bet back
    } else if (dealerBlackjack) {
      result = "lose";
    } else if (dealerScore > 21) {
      result = "win";
      newChips[id] += bet * 2;                       // bet back + winnings
    } else if (ps > dealerScore) {
      result = "win";
      newChips[id] += bet * 2;
    } else if (ps < dealerScore) {
      result = "lose";
    } else {
      result = "push";
      newChips[id] += bet;
    }
    results[id] = result;
  }

  return {
    ...state,
    deck,
    dealerHand,
    dealerScore,
    dealerHoleHidden: false,
    chips: newChips,
    phase: "resolved",
    results,
    log: "Round resolved.",
  };
}

// clear the table and return to the betting phase. anyone can trigger this from the resolved screen
export function nextRound(state, playerID) {
  if (state.selectedGame !== "Blackjack") return { newState: state, error: "Not Blackjack" };
  if (state.phase !== "resolved")         return { newState: state, error: "Round not over" };

  return {
    newState: {
      ...state,
      hands:  Object.fromEntries(state.players.map(id => [id, []])),
      scores: Object.fromEntries(state.players.map(id => [id, 0])),
      status: Object.fromEntries(state.players.map(id => [id, "waiting"])),
      bets: {},
      dealerHand: [],
      dealerScore: 0,
      dealerHoleHidden: true,
      phase: "betting",
      results: null,
      log: "Place your bets.",
    },
    error: null,
  };
}

//NOTE: Deleted start game function as the server does not wait, it reacts to events will implement with socket.io

//Logic for each player's turn in card game| Used AI to debug 15/5/26
export function playTurn(state, selectedGame, playerID, cardPlayed, chosenSuit) {
  switch (selectedGame) {
    case "LastCard": {
      //Sets the hand to whatever cards the player has (per player)
      const hand = state.hands[playerID];
      //Just creates the variables
      let card = null;
      let cardIndex = -1;

      //Cycles through the players hand and sees if the hand contains the appropriate card
      for (let i = 0; i < hand.length; i++) {
        if (hand[i].id === cardPlayed) {
          card = hand[i];
          cardIndex = i;
          break;
        }
      }

      //if the card is not in the hand then draw a card and then it is the next players turn
      if (cardIndex === -1) {
        const { newState } = drawCard(state, playerID, selectedGame);                                 
        return { newState: newState ?? state, error: "Card not in hand!" };
      }

      //Top card of the discard pile
      const topCard = state.discard[state.discard.length - 1];

      //Checks if the card that the player wants to play is a legal move
      if (!isLegalPlay(topCard, card, selectedGame, state.currSuit, state.drawStack)) {
        return { newState: state, error: "Is not legal play!" };
      }

      //creates the new hand for the player without the played card | we use 'i' here because we need to skip a certain position
      const newHand = [];
      for (let i = 0; i < hand.length; i++) {
        if (i !== cardIndex) {
          newHand.push(hand[i]);
        }
      }

      //builds a new discard pile with the new added card on top
      const discardPile = [];
      for (const c of state.discard) {
        discardPile.push(c); //Push just means that the card is added to the end of the array
      }
      discardPile.push(card);

      // Ace cannot be played as the last card
      if (newHand.length === 0 && card.value === 'A') {
        return { newState: state, error: "You cannot win with an Ace!" };
      }

      //the new updated state
      let newState = {
        ...state,
        hands: { ...state.hands, [playerID]: newHand },
        discard: [...state.discard, card],
        // Ace is wild: use the chosen suit; all other cards set currSuit to their own suit
        currSuit: card.value === 'A' ? (chosenSuit ?? card.suit) : card.suit,
        log: playerID + " played " + card.value + card.suit,
      };

      // apply special effects after building state
      newState = applyCardEffect(newState, playerID, card, selectedGame);

      //simply checks if the player has finished their hand
      const winner = checkWinner(newState, playerID, selectedGame);
      if (winner) {
        console.log(playerID + " is the winner!");
        return { newState: { ...newState, winner }, error: null };
      }

      // J skips next player (advance twice); all others advance once
      if (card.value === 'J') {
        newState = nextPlayer(nextPlayer(newState));
      } else {
        newState = nextPlayer(newState);
      }

      return { newState, error: null };
    }
  }
}

// checks whether playing this card is legal given the current state.
//   - Ace is wild so it's always legal
//   - if a drawStack is active (someone played a 2 or 3), you can only counter with 2/3
//   - otherwise you need to match the current suit OR the value of the top card
export function isLegalPlay(topCard, cardPlayed, selectedGame, currSuit, drawStack = 0) {
  if (selectedGame === "LastCard") {
    if (cardPlayed.value === 'A') return true;
    if (drawStack > 0) {
      return cardPlayed.value === '2' || cardPlayed.value === '3';
    }
    return cardPlayed.suit === currSuit || cardPlayed.value === topCard.value;
  }
}
  


// apply the side effect of a special card (e.g. add to drawStack, flip direction).
// normal number cards just fall through and return state unchanged
export function applyCardEffect(state, playerID, card, selectedGame) {
  switch (selectedGame) {
    case "LastCard": {
      if (card.value === "2") {
        return { ...state, drawStack: state.drawStack + 2,
          log: playerID + " played 2 — draw stack: " + (state.drawStack + 2) };
      }
      if (card.value === "3") {
        return { ...state, drawStack: state.drawStack + 3,
          log: playerID + " played 3 — draw stack: " + (state.drawStack + 3) };
      }
      if (card.value === "8") {
        return { ...state, direction: state.direction * -1,
          log: playerID + " played 8 — direction reversed!" };
      }
      if (card.value === "J") {
        return { ...state, log: playerID + " played Jack — next player skipped!" };
      }
      if (card.value === "A") {
        return { ...state, log: playerID + " played Ace — suit changed to " + state.currSuit };
      }
    }
  }
  return state; // normal card — no effect
}

// when the draw pile runs out, take the discard pile (minus the top card),
// shuffle it, and use that as the new deck. returns {deck, discard}
function refillIfEmpty(deck, discard) {
  if (deck.length > 0 || discard.length <= 1) return { deck, discard };
  const top = discard[discard.length - 1];
  const pool = discard.slice(0, -1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { deck: pool, discard: [top] };
}

// draw card(s) for a player. handles drawStack (so a "2" forces them to draw 2 etc.)
// and reshuffles the discard pile back in if we run out of cards mid-draw
export function drawCard(state, playerID, selectedGame) {
  switch (selectedGame) {
    case "LastCard": {
      let deck = [...state.deck];
      let discard = [...state.discard];
      ({ deck, discard } = refillIfEmpty(deck, discard));

      if (deck.length === 0) {
        return { newState: state, error: "No cards left to draw" };
      }

      const count = state.drawStack > 0 ? state.drawStack : 1;
      const newHand = [...state.hands[playerID]];

      for (let i = 0; i < count; i++) {
        ({ deck, discard } = refillIfEmpty(deck, discard));
        if (deck.length === 0) break;
        newHand.push(deck.shift());
      }

      const newState = {
        ...state,
        deck,
        discard,
        hands: { ...state.hands, [playerID]: newHand },
        drawStack: 0,
        log: playerID + " drew " + count + " card" + (count > 1 ? "s" : ""),
      };

      return { newState: nextPlayer(newState, playerID), error: null };
    }
  }
}

//Change next player. (able to add reverse card effects and such in future) | Code Generated with AI 15/5/26
export function nextPlayer(state, playerID) {
  const total = state.players.length;
  const next = (state.currIndex + state.direction + total) % total;
  return { ...state, currIndex: next };
}

// penalty version of drawCard. doesn't advance the turn and doesn't touch drawStack.
// used for "you forgot to say Last Card!" type punishments
export function forceDraw(state, playerID, count) {
  let deck = [...state.deck];
  let discard = [...state.discard];
  const newHand = [...state.hands[playerID]];
  for (let i = 0; i < count; i++) {
    ({ deck, discard } = refillIfEmpty(deck, discard));
    if (deck.length === 0) break;
    newHand.push(deck.shift());
  }
  return { ...state, deck, discard, hands: { ...state.hands, [playerID]: newHand } };
}

//Check for selected games' win condition
export function checkWinner(state, playerID, selectedGame) {
  if (selectedGame == "LastCard") {
    //If current player hand is empty. If empty, win
    if (state.hands[playerID].length === 0) {
      console.log(playerID + " wins!");
      return playerID;
    }
  }
  return null;
}
