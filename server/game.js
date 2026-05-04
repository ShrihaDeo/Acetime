//Game States
export const SUITS  = ['♠', '♥', '♦', '♣'];
export const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

//Builds the deck
export function buildDeck() {
  const deck = [];

  //Should create 52 cards
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({
        id:    `${suit}${value}`,
        suit:  suit,
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
export function createGame(playerIDS) {
  const deck = buildDeck();
  const hands = {};

  //For each of the players give 7 cards each (does it by P1-> gives 7 cards, then P2)
  for (const id of playerIDS) {
    hands[id] = [];
    for (let i = 0; i < 7; i++) {
      hands[id].push(deck.shift()); //there should be 38 cards remaining at this stage 
    }
  }

  const startCard = deck[0];
  deck.shift(); // now there should be 37 cards remaining

  return {
    players:   playerIDS,
    hands,
    deck,
    currSuit:  startCard.suit,
    currIndex: 0,
    direction: 1,
    drawStack: 0,
    winner:    null,
    log:       'Game Started!'
  };
}