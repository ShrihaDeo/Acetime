// Tests for the Blackjack game engine — dealer-based version with betting and payouts.

import {
  createGame, scoreHand, hit, stand, double, placeBet, nextRound,
} from '../game.js';

let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); console.log('  ok  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); fail++; }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
};
const truthy = (v, msg) => { if (!v) throw new Error(msg || 'expected truthy'); };

console.log('\n── scoreHand ──');

test('number cards add up by face value', () => {
  eq(scoreHand([{ value: '5', suit: '♠' }, { value: '7', suit: '♥' }]), 12);
});
test('J/Q/K all count as 10', () => {
  eq(scoreHand([{ value: 'J', suit: '♠' }, { value: 'Q', suit: '♥' }]), 20);
});
test('Ace counts as 11 when safe', () => {
  eq(scoreHand([{ value: 'A', suit: '♠' }, { value: '9', suit: '♥' }]), 20);
});
test('Ace drops to 1 when 11 would bust', () => {
  eq(scoreHand([{ value: 'A', suit: '♠' }, { value: '5', suit: '♥' }, { value: '9', suit: '♦' }]), 15);
});
test('two Aces — one as 11, one as 1', () => {
  eq(scoreHand([{ value: 'A', suit: '♠' }, { value: 'A', suit: '♥' }]), 12);
});

console.log('\n── createGame (Blackjack) ──');

test('starts in betting phase with no cards dealt', () => {
  const s = createGame(['x', 'y'], 'Blackjack');
  eq(s.phase, 'betting');
  eq(s.hands['x'].length, 0);
  eq(s.hands['y'].length, 0);
  eq(s.chips['x'], 500);
  eq(s.chips['y'], 500);
  eq(s.dealerHand.length, 0);
});

console.log('\n── placeBet ──');

test('placeBet deducts chips and records the bet', () => {
  const s = createGame(['x', 'y'], 'Blackjack');
  const { newState, error } = placeBet(s, 'x', 50);
  eq(error, null);
  eq(newState.chips['x'], 450);
  eq(newState.bets['x'], 50);
  eq(newState.phase, 'betting', 'still betting because y has not bet yet');
});

test('once both players bet, cards are dealt and phase advances', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = placeBet(s, 'x', 50).newState;
  s = placeBet(s, 'y', 50).newState;
  eq(s.phase, 'playing');
  eq(s.hands['x'].length, 2);
  eq(s.hands['y'].length, 2);
  eq(s.dealerHand.length, 2);
});

test('bet below MIN_BET is rejected', () => {
  const s = createGame(['x', 'y'], 'Blackjack');
  const { error } = placeBet(s, 'x', 5);
  truthy(error);
});

test('bet larger than chips is rejected', () => {
  const s = createGame(['x', 'y'], 'Blackjack');
  const { error } = placeBet(s, 'x', 9999);
  truthy(error);
});

test('cannot bet twice', () => {
  const s = createGame(['x', 'y'], 'Blackjack');
  const first = placeBet(s, 'x', 50);
  const { error } = placeBet(first.newState, 'x', 50);
  truthy(error);
});

console.log('\n── playing phase: hit / stand / double ──');

test('hit adds a card and updates score', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  // force a known state
  s = { ...s,
    hands:  { x: [{ value: '2', suit: '♠', id: '♠2' }, { value: '3', suit: '♥', id: '♥3' }], y: [{ value: '5', suit: '♣' }, { value: '6', suit: '♦' }] },
    scores: { x: 5, y: 11 },
    status: { x: 'playing', y: 'playing' },
    bets:   { x: 50, y: 50 },
    chips:  { x: 450, y: 450 },
    dealerHand: [{ value: '7', suit: '♠' }, { value: '8', suit: '♥' }],
    dealerScore: 15, dealerHoleHidden: true,
    deck: [{ value: '4', suit: '♣', id: '♣4' }, { value: 'K', suit: '♦' }],
    phase: 'playing', currIndex: 0,
  };
  const { newState, error } = hit(s, 'x');
  eq(error, null);
  eq(newState.hands['x'].length, 3);
  eq(newState.scores['x'], 9);
});

test('hit beyond 21 marks the player busted', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = { ...s,
    hands:  { x: [{ value: 'K', suit: '♠' }, { value: 'Q', suit: '♥' }], y: [{ value: '5', suit: '♣' }, { value: '6', suit: '♦' }] },
    scores: { x: 20, y: 11 },
    status: { x: 'playing', y: 'playing' },
    bets:   { x: 50, y: 50 },
    dealerHand: [{ value: '7', suit: '♠' }, { value: '8', suit: '♥' }],
    dealerScore: 15, dealerHoleHidden: true,
    deck: [{ value: '5', suit: '♣' }, { value: '4', suit: '♦' }],
    phase: 'playing', currIndex: 0,
  };
  const { newState } = hit(s, 'x');
  eq(newState.status['x'], 'busted');
});

test('both players can act in parallel (no enforced turn order)', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = { ...s,
    hands:  { x: [{ value: '5', suit: '♠' }, { value: '6', suit: '♥' }], y: [{ value: '5', suit: '♣' }, { value: '6', suit: '♦' }] },
    scores: { x: 11, y: 11 },
    status: { x: 'playing', y: 'playing' },
    bets:   { x: 50, y: 50 },
    chips:  { x: 450, y: 450 },
    dealerHand: [{ value: '9', suit: '♠' }, { value: '9', suit: '♥' }],
    dealerScore: 18, dealerHoleHidden: true,
    deck: [{ value: '7', suit: '♣' }, { value: '7', suit: '♦' }],
    phase: 'playing', currIndex: 0,
  };
  // y acts first even though currIndex points to x — should succeed
  const yFirst = hit(s, 'y');
  eq(yFirst.error, null, 'y can hit even though currIndex is on x');
  eq(yFirst.newState.hands['y'].length, 3);
  // x can still act after y
  const xNext = stand(yFirst.newState, 'x');
  eq(xNext.error, null);
});

test('double: takes exactly one card, doubles the bet, then auto-stands', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = { ...s,
    hands:  { x: [{ value: '5', suit: '♠' }, { value: '6', suit: '♥' }], y: [{ value: '5', suit: '♣' }, { value: '6', suit: '♦' }] },
    scores: { x: 11, y: 11 },
    status: { x: 'playing', y: 'playing' },
    bets:   { x: 50, y: 50 },
    chips:  { x: 450, y: 450 },
    dealerHand: [{ value: '7', suit: '♠' }, { value: '8', suit: '♥' }],
    dealerScore: 15, dealerHoleHidden: true,
    deck: [{ value: '7', suit: '♣' }, { value: 'K', suit: '♦' }],
    phase: 'playing', currIndex: 0,
  };
  const { newState, error } = double(s, 'x');
  eq(error, null);
  eq(newState.bets['x'], 100, 'bet doubled');
  eq(newState.chips['x'], 400, 'extra chips deducted');
  eq(newState.hands['x'].length, 3, 'one card drawn');
  eq(newState.status['x'], 'standing', 'auto-stand after double');
});

test('double is rejected after a hit', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = { ...s,
    hands:  { x: [{ value: '5', suit: '♠' }, { value: '6', suit: '♥' }, { value: '2', suit: '♦' }] },
    scores: { x: 13 },
    status: { x: 'playing', y: 'playing' },
    bets:   { x: 50, y: 50 },
    chips:  { x: 450, y: 450 },
    phase: 'playing', currIndex: 0,
    deck: [{ value: '5', suit: '♣' }],
  };
  const { error } = double(s, 'x');
  truthy(error);
});

console.log('\n── dealer & payouts ──');

test('dealer hits until 17+, player wins if dealer busts', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = { ...s,
    hands:  { x: [{ value: 'K', suit: '♠' }, { value: '8', suit: '♥' }], y: [{ value: 'K', suit: '♣' }, { value: '8', suit: '♦' }] },
    scores: { x: 18, y: 18 },
    status: { x: 'playing', y: 'standing' },
    bets:   { x: 50, y: 50 },
    chips:  { x: 450, y: 450 },
    dealerHand: [{ value: '6', suit: '♠' }, { value: '7', suit: '♥' }], // 13
    dealerScore: 13, dealerHoleHidden: true,
    deck: [{ value: 'K', suit: '♣' }], // dealer draws to 23 → bust
    phase: 'playing', currIndex: 0,
  };
  const { newState } = stand(s, 'x');
  eq(newState.phase, 'resolved');
  truthy(newState.dealerScore > 21, 'dealer busted');
  eq(newState.results['x'], 'win');
  eq(newState.results['y'], 'win');
  eq(newState.chips['x'], 550, 'win pays bet + bet (1:1)');
});

test('player blackjack pays 3:2', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = { ...s,
    hands:  { x: [{ value: 'A', suit: '♠' }, { value: 'K', suit: '♥' }], y: [{ value: '5', suit: '♣' }, { value: '6', suit: '♦' }] },
    scores: { x: 21, y: 11 },
    status: { x: 'blackjack', y: 'playing' }, // y still needs to act
    bets:   { x: 100, y: 50 },
    chips:  { x: 400, y: 450 },
    dealerHand: [{ value: '9', suit: '♠' }, { value: '9', suit: '♥' }],
    dealerScore: 18, dealerHoleHidden: true,
    deck: [],
    phase: 'playing', currIndex: 1,
  };
  const { newState } = stand(s, 'y');
  eq(newState.results['x'], 'blackjack');
  eq(newState.chips['x'], 400 + 100 + 150, 'blackjack pays bet + 1.5x (3:2)');
});

test('push returns the bet only', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = { ...s,
    hands:  { x: [{ value: '9', suit: '♠' }, { value: '9', suit: '♥' }], y: [{ value: '5', suit: '♣' }, { value: '6', suit: '♦' }] },
    scores: { x: 18, y: 11 },
    status: { x: 'standing', y: 'standing' },
    bets:   { x: 50, y: 50 },
    chips:  { x: 450, y: 450 },
    dealerHand: [{ value: '9', suit: '♣' }, { value: '9', suit: '♦' }],
    dealerScore: 18, dealerHoleHidden: true,
    deck: [],
    phase: 'playing', currIndex: 0,
  };
  // both already standing; trigger by calling stand on a "playing" player — but both standing means we need to trigger differently
  // we'll manually invoke endTurnOrRound by standing on a fresh fake player… or just call playDealer indirectly via hit on a doomed setup.
  // Simpler: set both to 'playing' and stand each.
  s.status = { x: 'playing', y: 'playing' };
  const a = stand(s, 'x').newState;
  const { newState } = stand(a, 'y');
  eq(newState.results['x'], 'push');
  eq(newState.chips['x'], 500, 'bet returned');
});

test('bust loses the bet (no chips returned)', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = { ...s,
    hands:  { x: [{ value: 'K', suit: '♠' }, { value: 'Q', suit: '♥' }], y: [{ value: '5', suit: '♣' }, { value: '6', suit: '♦' }] },
    scores: { x: 20, y: 11 },
    status: { x: 'playing', y: 'standing' },
    bets:   { x: 50, y: 50 },
    chips:  { x: 450, y: 450 },
    dealerHand: [{ value: '9', suit: '♣' }, { value: '9', suit: '♦' }],
    dealerScore: 18, dealerHoleHidden: true,
    deck: [{ value: '5', suit: '♣' }], // x will draw and bust at 25
    phase: 'playing', currIndex: 0,
  };
  const { newState } = hit(s, 'x');
  eq(newState.results['x'], 'bust');
  eq(newState.chips['x'], 450, 'no refund on a bust');
});

console.log('\n── next round ──');

test('nextRound clears hands and returns to betting', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  // simulate a resolved round
  s = { ...s, phase: 'resolved',
    hands: { x: [{ value: 'K' }, { value: '8' }], y: [{ value: '9' }, { value: '9' }] },
    bets: { x: 50, y: 50 },
    results: { x: 'win', y: 'lose' },
    dealerHand: [{ value: '7' }, { value: '8' }],
    dealerScore: 15, dealerHoleHidden: false,
  };
  const { newState } = nextRound(s, 'x');
  eq(newState.phase, 'betting');
  eq(newState.hands['x'].length, 0);
  eq(newState.bets['x'], undefined);
  eq(newState.dealerHand.length, 0);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
