import { createGame, buildDeck, checkWinner, playTurn, isLegalPlay, drawCard} from "../game.js";

const deck = buildDeck();
console.assert(deck.length === 52, 'expected 52, got ' + deck.length)
console.log("deck has 52 cards") 

const game = createGame(['x', 'y'], 'LastCard');
console.assert(game.hands['x'].length === 7, "Expected x has 7, got " + game.hands['x'].length)
console.log("x has 7")
console.assert(game.hands['y'].length === 7, "Expected y has 7, got " + + game.hands['y'].length)
console.log("y has 7")
console.assert(game.deck.length === 37, "Expected deck has 37 cards, got" + game.deck.length)
console.log("deck has 37")

//----------------------------------------------------------------------------------------------------------------------------------------------------------

// get the top card of the discard pile to find a legal card for x
const topCard = game.discard[game.discard.length - 1];
let cardToPlay = null;

// loop through x's hand and find a card that matches suit or value
for (const c of game.hands['x']) {
  if (c.suit === topCard.suit || c.value === topCard.value) {
    cardToPlay = c.id;  // found a legal card
    break;              // stop looking
  }
}

console.log('top of discard:', game.discard[game.discard.length - 1]);  // see what needs to be matched

// declared outside so y's turn can also access it
let newState = null;

if (!cardToPlay) {
  console.log('x has no legal card to play — must draw');
  const { newState: drawnState } = drawCard(game, 'x', "LastCard");
  console.log('x hand size:', drawnState.hands['x'].length);
} else {
  // renamed to xState so it doesnt shadow the outer newState
  const { newState: xState, error } = playTurn(game, 'LastCard', 'x', cardToPlay);

  if (error) {
    console.log('error:', error);  // illegal play — expected if card doesnt match
  } else {
    newState = xState;  // assign to outer variable so y's turn can use it
    console.log('card played ' + cardToPlay);
    console.log('discard length:', newState.discard.length);  // should be 2
    console.log('x hand size:', newState.hands['x'].length);  // should be 6
  }
}

console.log('top of discard:', game.discard[game.discard.length - 1]);

// only run y's turn if x successfully played
if (newState) {
  // now find a legal card for y using the NEW state
  const newTopCard = newState.discard[newState.discard.length - 1];
  let cardToPlay2 = null;

  // loop through y's hand and find a card that matches the new top card
  for (const c of newState.hands['y']) {
    if (c.suit === newTopCard.suit || c.value === newTopCard.value) {
      cardToPlay2 = c.id;
      break;
    }
  }

  if (!cardToPlay2) {
    console.log('y has no legal card to play — must draw');
    const { newState: drawnState2 } = drawCard(newState, 'y', "LastCard");
    console.log('y hand size:', drawnState2.hands['y'].length);
  } else {
    const { newState: newState2, error: error2 } = playTurn(newState, 'LastCard', 'y', cardToPlay2);
    if (error2) {
      console.log('error:', error2);
    } else {
      console.log('y played a card ' + cardToPlay2);
      console.log('discard length:', newState2.discard.length);  // should be 3
      console.log('y hand size:', newState2.hands['y'].length);  // should be 6
    }
  }
}

// ── Test draw 2 ────────────────────────────────────────────────────────────────
// force a 2 into x's hand that matches the top card's suit
const topCard2 = game.discard[game.discard.length - 1];
game.hands['x'][0] = { id: topCard2.suit + '2', suit: topCard2.suit, value: '2' };

console.log('--------------------------------------------------------------------------------------------------------------------------');
console.log("Testing Drawing 2");
console.log('top of discard:', topCard2);

// x plays the 2
const { newState: drawState, error: drawError } = playTurn(game, 'LastCard', 'x', topCard2.suit + '2');

if (drawError) {
  console.log('error:', drawError);
} else {
  console.log('x played a 2');
  console.assert(drawState.drawStack === 2, 'Expected drawStack 2, got ' + drawState.drawStack);
  console.log('draw stack is', drawState.drawStack);  // should be 2

  // y must draw — they have no 2 to stack
  const { newState: afterDraw, error: drawErr } = drawCard(drawState, 'y', 'LastCard');

  if (drawErr) {
    console.log('error:', drawErr);
  } else {
    console.log('y drew cards');
    // y started with 7 cards and drew 2 so should have 9
    console.assert(afterDraw.hands['y'].length === 9, 'Expected y to have 9 cards, got ' + afterDraw.hands['y'].length);
    console.log('y hand size:', afterDraw.hands['y'].length);  // should be 9
    // draw stack should be reset to 0 after drawing
    console.assert(afterDraw.drawStack === 0, 'Expected drawStack 0, got ' + afterDraw.drawStack);
    console.log('draw stack reset to', afterDraw.drawStack);  // should be 0
  }
}

//----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/*game.hands['x'] = [];
game.hands['y'] = [{ id: '♠A', suit: '♠', value: 'A' }];
const winner1 = checkWinner(game, 'y', 'LastCard');
console.log('Y should not be winner ', winner1);
const winner2 = checkWinner(game, 'x', 'LastCard');
console.log('winner should be x got ', winner2);*/