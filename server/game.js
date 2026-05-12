//Game States
export const SUITS  = ['♠', '♥', '♦', '♣'];
export const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
export const cardGames = ["LastCard"];

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
export function createGame(playerIDS, selectedGame) {
  const deck = buildDeck();
  const hands = {};

  //Some games may have different starting hands, etc.
  if (selectedGame == "LastCard") {
    //For each of the players give 7 cards each (does it by P1-> gives 7 cards, then P2)
    for (const id of playerIDS) {
      hands[id] = [];
      for (let i = 0; i < 7; i++) {
        hands[id].push(deck.shift()); //there should be 38 cards remaining at this stage 
      }
    }

    const startCard = deck[0];
    deck.shift(); // now there should be 37 cards remaining
  }

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

export function startGame(selectedGame) {
  isGameValid = true; //Should current game keep going

  if (selectedGame == LastCard) {
    playerID = true //Paalav hmu what are the playerIDS
    isCardPlayed == false;

    while (isGameValid == true){
      if (isCardPlayed == true){ //Wait for a card to be played
        playTurn(selectedGame, playerID, cardPlayed)
        playerID = !playerID
      }
      isGameValid == checkWinner();
    }

    System.out.printLn("winner is player" + currIndex)

  }
  
}

//Logic for each player's turn in card game
export function playTurn(selectedGame, playerID, cardPlayed) {
  isPlayerTurn = 0; //Index of current player's turn - 0: player 1, 1: player 2

  if(selectedGame == LastCard) { //Could do this playerID thing better as well, but I don't really understand what playerID is. Is it an array of playerids and stuff idk
    if (playerID == true) { //PlayerID true = player 1
      if(isLegalPlay(, cardPlayed, selectedGame) == true) { //Missing top card parameter but not sure where I can find it.
        //Add cardPlayed to pile, 
        //remove from current player's hand
        if(cardPlayed.value == 4 || cardPlayed.value == 2) { //for example, if a card is 4, make other player draw 4 cards 
          applyCardEffect('other player', cardPlayed, selectedGame)
        }
      }
      checkWinner();
      playerID != playerID //Switch player
    }
    else { //PlayerID false = player 2         ***BUT WILL CHANGE AS I LEARN WHAT PLAYERIDS WILL BE LIKE //just add the above code to this pretty much same. I just didn't add as we could do this a way better way, using the playerID dynamically. I don't really get how your code above works sowwy
      if(isLegalPlay == true) {
        
      }

      playerID != playerID
    }
  }
  

}

//Checks if the card a player has drawn works as turn
export function isLegalPlay(topCard, cardPlayed, selectedGame) {
  //if played card is a special card such as .... if not, just play card like normal
  if (selectedGame == "LastCard") {
    if(cardPlayed.suit == topCard.suit || cardPlayed.value == topCard.suit) {
      return true;
    }
    else {
      return false
    }
  }

}

//If the played card is a special card such as ...., apply effects
export function applyCardEffect(playerID, cardPlayed, selectedGame) {
  if (selectedGame == "LastCard") {
    if(cardPlayed.value == 4 || cardPlayed.value == 2) { //For example, pick up 4
        for (i = 0; i >= cardPlayed.value; i++) {
            playerIDS[0].hands.drawCard
          }
      }
  }
}

//Draws card from pile, adds to player hand, then removes from pile
export function drawCard(playerID) {
  //Just add card to playerID hand and remove from deck
}

//Change next player. (able to add reverse card effects and such in future)
export function nextPlayer(playerID) {
  
}

//Check for selected games' win condition 
export function checkWinner(state, selectedGame) {

  if (selectedGame == "LastCard"){ //If current player hand is empty. If empty, win
    for(const id of state.players){ //change this lil boy
    if(state.hands[id].length === 0 || state.deck.length === 0){
      return false;
    }
  }
  }
  return null;
}