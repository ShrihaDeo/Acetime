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

  //Some games may have different starting hands, etc.
  if (selectedGame == "LastCard") {
    //For each of the players give 7 cards each (does it by P1-> gives 7 cards, then P2)
    for (const id of playerIDS) {
      hands[id] = [];
      for (let i = 0; i < 7; i++) {
        hands[id].push(deck.shift()); //there should be 38 cards remaining at this stage
      }
    }

    startCard = deck[0];
    deck.shift(); // now there should be 37 cards remaining
  }

  return {
    players: playerIDS,
    hands,
    deck, //Just as clarification 'deck' is the pile of cards you draw from
    discard: [startCard], //And discard or the discardpile is the pile of cards you actually play on e.g 2, you play 2
    currSuit: startCard.suit,
    currIndex: 0,
    direction: 1,
    drawStack: 0,
    winner: null,
    log: "Game Started!",
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
