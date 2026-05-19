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

  //Function to shuffle the deck
  function shuffle() {
    for (let i = 0; i < deck.length; i++) {
      let j = Math.floor(Math.random() * deck.length);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck; //returns the shuffled deck
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
export function playTurn(state, selectedGame, playerID, cardPlayed) {
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
        drawCard(state, playerID, selectedGame);
        return { state, error: "Card not in hand!" };
      }

      //Top card of the discard pile
      const topCard = state.discard[state.discard.length - 1];

      //Checks if the card that the player wants to play is a legal move
      if (!isLegalPlay(topCard, card, selectedGame)) {
        return { state, error: "Is not legal play!" };
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

      //the new updated state
      let newState = {
        ...state, //'...' just means to 'copy' of in this case state, and here we are changing hands discard pile and the current suit
        hands: { ...state.hands, [playerID]: newHand },
        discard: discardPile,
        currSuit: card.suit,
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

      //only advance for the normal cards
      if (card.value !== "8" && card.value !== "2") {
        newState = nextPlayer(newState);
      }

      return { newState, error: null }; //error: just gives the caller indication if whether or not something went wrong
    }
  }
}

//Checks if the card a player has drawn works as turn
export function isLegalPlay(topCard, cardPlayed, selectedGame) {
  //if played card is a special card such as .... if not, just play card like normal
  if (selectedGame == "LastCard") {
    if (cardPlayed.suit == topCard.suit || cardPlayed.value == topCard.value) {
      return true;
    } else {
      return false;
    }
  }
  
}

//If the played card is a special card such as ...., apply effects
export function applyCardEffect(state, playerID, card, selectedGame) {
  switch (selectedGame) {
    case "LastCard": {
      if (card.value === "2") {
        return {
          ...state,
          drawStack: state.drawStack + 2,
          log:
            playerID + " player 2- draw stack is now" + (state.drawStack + 2),
        };
      }

      /* Code lwk doesnt matter at the moment teehee
    if(card.value === '8'){
      const skipped = nextPlayer(state,playerID);
      //Since there are only 2 players at the moment (15/5/26)
      return{
        ...skipped,
        log: playerID + " played 8, his turn is skipped!"
      }
    }
    */

      //NOTE: maybe will later on implement the special effect of 'A' Reversing the play, but atm only have 2 players

      //J is just a wildcard- anything goes, the rest of them are just placeholders so program works smoothely
      if (card.value === "J" || card.value === "8" || card.value === "A") {
        return {
          ...state,
          log: playerID + " played J — suit changed to " + state.currSuit,
        };
      }
    }
  }

  // normal card — no effect
  return state;
}

//Draws card from pile, adds to player hand, then removes from pile
export function drawCard(state, playerID, selectedGame) {
  switch (selectedGame) {
    case "LastCard": {
      if (state.deck.length === 0) {
        return { state, error: "Deck is empty" };
      }

      //if drawStack active, draw that many — otherwise draw 1 | Generated by AI 15/5/26
      const count = state.drawStack > 0 ? state.drawStack : 1;

      //creates new deck array
      const newDeck = [];

      //Copies the deck
      for (const c of state.deck) {
        newDeck.push(c);
      }

      //copies the current players hand
      const newHand = [];
      for (const c of state.hands[playerID]) {
        newHand.push(c);
      }

      //Determines how many cards to draw
      for (let i = 0; i < count; i++) {
        if (newDeck.length === 0) break;
        newHand.push(newDeck.shift());
      }

      //NOTE: we want to copy the deck because we want to avoid mutating the original state, this may cause bugs as other parts of the code might hold a reference to the old state

      let newState = {
        ...state,
        deck: newDeck,
        hands: { ...state.hands, [playerID]: newHand },
        drawStack: 0,
        log: playerID + " drew a card",
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
