import { createGame , buildDeck} from "../game.js";

const deck = buildDeck();
console.assert(deck.length === 52, 'expected 52, got ' + deck.length)
console.log("deck has 52 cards") 

const game = createGame(['x', 'y']);
    console.assert(game.hands['x'].length === 7, "Expected x has 7, got " + game.hands['x'].length)
    console.log("x has 7")
    console.assert(game.hands['y'].length === 7, "Expected y has 7, got " + + game.hands['y'].length)
    console.log("y has 7")
    console.assert(game.deck.length === 37, "Expected deck has 37 cards, got" + game.deck.length)
    console.log("deck has 37")
