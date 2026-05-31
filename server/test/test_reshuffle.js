// Tests that drawCard correctly reshuffles the discard pile when the deck runs out,
// and that the Ace/J/2/3/8 behaviours match the rules.

import { createGame, playTurn, drawCard, isLegalPlay, forceDraw } from '../game.js';

let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); console.log('  ok  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); fail++; }
};
const eq = (a, b, msg) => { if (a !== b) throw new Error((msg || '') + ' expected ' + b + ' got ' + a); };
const truthy = (v, msg) => { if (!v) throw new Error(msg || 'expected truthy'); };

console.log('\n── drawCard reshuffle ──');

test('drawCard reshuffles discard into deck when deck empties', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  // Drain the deck artificially — move every card into the discard pile
  state.discard = [state.discard[0], ...state.deck];
  state.deck = [];
  const { newState, error } = drawCard(state, 'x', 'LastCard');
  eq(error, null, 'no error');
  truthy(newState.deck.length > 0, 'deck refilled from discard');
  eq(newState.hands['x'].length, 8, 'x drew exactly 1 card');
  eq(newState.discard.length, 1, 'discard kept only the top card');
  const total = newState.deck.length + newState.discard.length
              + newState.hands['x'].length + newState.hands['y'].length;
  eq(total, 52, 'all 52 cards still in play');
});

test('drawCard returns error when deck AND discard are exhausted', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  state.deck = [];
  state.discard = [state.discard[0]]; // only the start card — nothing to shuffle
  const { error } = drawCard(state, 'x', 'LastCard');
  truthy(error, 'should return an error');
});

test('drawCard with drawStack=4 draws 4 across a reshuffle boundary', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  // deck has 1 card, discard has 6 cards (incl. top)
  const top = state.discard[0];
  state.discard = [top, ...state.deck.slice(0, 5)];
  state.deck = state.deck.slice(5, 6); // exactly 1 card
  state.drawStack = 4;
  const { newState, error } = drawCard(state, 'x', 'LastCard');
  eq(error, null);
  eq(newState.hands['x'].length, 11, 'x drew 4 cards (started with 7)');
  eq(newState.drawStack, 0, 'drawStack reset');
});

console.log('\n── special card rules ──');

test('Ace is wild — always legal', () => {
  const topCard = { suit: '♣', value: 'K', id: '♣K' };
  const ace = { suit: '♦', value: 'A', id: '♦A' };
  eq(isLegalPlay(topCard, ace, 'LastCard', '♣', 0), true);
});

test('drawStack active — only 2 or 3 may counter', () => {
  const top = { suit: '♠', value: '2', id: '♠2' };
  eq(isLegalPlay(top, { suit: '♥', value: '3', id: '♥3' }, 'LastCard', '♠', 2), true, '3 stacks');
  eq(isLegalPlay(top, { suit: '♠', value: '2', id: '♠2' }, 'LastCard', '♠', 2), true, '2 stacks');
  eq(isLegalPlay(top, { suit: '♠', value: '5', id: '♠5' }, 'LastCard', '♠', 2), false, 'matching suit alone is NOT enough');
  eq(isLegalPlay(top, { suit: '♣', value: 'A', id: '♣A' }, 'LastCard', '♠', 2), true, 'Ace is still wild even over a stack');
});

test('playing an Ace sets currSuit to the chosen suit', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  state.hands['x'][0] = { suit: '♣', value: 'A', id: '♣A' };
  const { newState, error } = playTurn(state, 'LastCard', 'x', '♣A', '♥');
  eq(error, null);
  eq(newState.currSuit, '♥', 'currSuit is the chosen suit');
});

test('Ace defaults to its own suit when no chosenSuit was provided', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  state.hands['x'][0] = { suit: '♣', value: 'A', id: '♣A' };
  const { newState } = playTurn(state, 'LastCard', 'x', '♣A');
  eq(newState.currSuit, '♣');
});

test('You cannot win with an Ace', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  // Set x's hand to just one card — the Ace
  state.hands['x'] = [{ suit: '♥', value: 'A', id: '♥A' }];
  const top = state.discard[state.discard.length - 1];
  // make the Ace legal by ensuring it's wild (it always is)
  const { error } = playTurn(state, 'LastCard', 'x', '♥A', '♠');
  truthy(error, 'should be blocked');
});

test('Jack skips the next player (with 2 players → same player goes again)', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  // Ensure currSuit matches
  const jack = { suit: state.currSuit, value: 'J', id: state.currSuit + 'J' };
  state.hands['x'][0] = jack;
  const { newState, error } = playTurn(state, 'LastCard', 'x', jack.id);
  eq(error, null);
  eq(newState.currIndex, 0, 'still x\'s turn after a J in a 2-player game');
});

test('8 reverses direction and advances turn', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  const eight = { suit: state.currSuit, value: '8', id: state.currSuit + '8' };
  state.hands['x'][0] = eight;
  const { newState, error } = playTurn(state, 'LastCard', 'x', eight.id);
  eq(error, null);
  eq(newState.direction, -1, 'direction flipped');
  eq(newState.currIndex, 1, 'turn advanced');
});

test('2 adds 2 to drawStack and advances turn (no longer locks)', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  const two = { suit: state.currSuit, value: '2', id: state.currSuit + '2' };
  state.hands['x'][0] = two;
  const { newState, error } = playTurn(state, 'LastCard', 'x', two.id);
  eq(error, null);
  eq(newState.drawStack, 2);
  eq(newState.currIndex, 1, 'turn advanced after playing 2');
});

test('3 adds 3 to drawStack and advances turn', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  const three = { suit: state.currSuit, value: '3', id: state.currSuit + '3' };
  state.hands['x'][0] = three;
  const { newState, error } = playTurn(state, 'LastCard', 'x', three.id);
  eq(error, null);
  eq(newState.drawStack, 3);
  eq(newState.currIndex, 1);
});

test('forceDraw also reshuffles when deck empties', () => {
  const state = createGame(['x', 'y'], 'LastCard');
  state.discard = [state.discard[0], ...state.deck];
  state.deck = [];
  const next = forceDraw(state, 'x', 2);
  eq(next.hands['x'].length, 9, 'x drew 2 after reshuffle');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
