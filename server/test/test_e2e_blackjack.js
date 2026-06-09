// End-to-end simulation of a full Blackjack round with parallel play.
// Walks the engine through: betting → deal → both players act in any order → dealer → resolved → next round.

import { createGame, placeBet, hit, stand, double, nextRound } from '../game.js';

let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); console.log('  ok  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); fail++; }
};
const truthy = (v, msg) => { if (!v) throw new Error(msg || 'expected truthy'); };
const falsy  = (v, msg) => { if (v) throw new Error(msg || 'expected falsy'); };
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
};

console.log('\n── e2e: parallel play with hit, stand, double ──');

test('player y can act before player x, and dealer plays once both finish', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  eq(s.phase, 'betting');

  // both place bets — second one triggers the deal
  s = placeBet(s, 'x', 50).newState;
  truthy(s.phase === 'betting', 'still betting after just x bet');
  s = placeBet(s, 'y', 100).newState;
  eq(s.phase, 'playing', 'phase becomes playing after both bet');
  truthy(s.hands['x'].length === 2 && s.hands['y'].length === 2, 'both got 2 cards');
  truthy(s.dealerHand.length === 2, 'dealer got 2 cards');

  // y acts FIRST even though currIndex is 0 (x) — this is the bug the user reported, now fixed
  if (s.status['y'] === 'playing') {
    const r = stand(s, 'y');
    eq(r.error, null, 'y can stand whenever they like');
    s = r.newState;
  }

  // x then acts — should still be allowed
  if (s.status['x'] === 'playing') {
    const r = stand(s, 'x');
    eq(r.error, null, 'x can stand whenever they like');
    s = r.newState;
  }

  // both done → dealer should have played → phase resolved
  eq(s.phase, 'resolved', 'phase becomes resolved after both done');
  truthy(s.results, 'results were calculated');
  truthy(s.results.x, 'x has a result');
  truthy(s.results.y, 'y has a result');
});

test('a player who already stood cannot act again', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = placeBet(s, 'x', 50).newState;
  s = placeBet(s, 'y', 50).newState;
  // x stands
  s = stand(s, 'x').newState;
  // x tries to hit — should be rejected
  const r = hit(s, 'x');
  truthy(r.error, 'cannot hit after standing');
});

test('one player busts, the other plays on, dealer settles independently', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  // force a state where x is at 20 and y at 15
  s.hands  = { x: [{ value: 'K', suit: '♠' }, { value: 'Q', suit: '♥' }], y: [{ value: '7', suit: '♣' }, { value: '8', suit: '♦' }] };
  s.scores = { x: 20, y: 15 };
  s.status = { x: 'playing', y: 'playing' };
  s.bets   = { x: 50, y: 50 };
  s.chips  = { x: 450, y: 450 };
  s.dealerHand = [{ value: '6', suit: '♠' }, { value: '5', suit: '♥' }]; // 11, hits to ~17
  s.dealerScore = 11; s.dealerHoleHidden = true;
  s.deck = [
    { value: '5', suit: '♣' }, // x will bust → 25
    { value: '8', suit: '♦' }, // y will hit to 23 ... let's stand instead
    { value: '6', suit: '♣' }, // dealer to 17
  ];
  s.phase = 'playing'; s.currIndex = 0;

  // x hits and busts
  s = hit(s, 'x').newState;
  eq(s.status['x'], 'busted');
  truthy(s.phase === 'playing', 'still playing because y is in');

  // y stands
  s = stand(s, 'y').newState;
  eq(s.phase, 'resolved');
  eq(s.results['x'], 'bust', 'x lost (bust)');
  // y could be win/lose/push depending on dealer — just check it's defined
  truthy(s.results['y']);
});

test('after resolved, nextRound clears the table and re-enters betting', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = placeBet(s, 'x', 50).newState;
  s = placeBet(s, 'y', 50).newState;
  s = stand(s, 'x').newState;
  s = stand(s, 'y').newState;
  eq(s.phase, 'resolved');

  const r = nextRound(s, 'x');
  eq(r.error, null);
  eq(r.newState.phase, 'betting');
  eq(r.newState.hands['x'].length, 0);
  eq(r.newState.dealerHand.length, 0);
  falsy(r.newState.results, 'results cleared');
  // chips carry over
  truthy(r.newState.chips['x'] >= 0);
});

test('player can double down on a fresh 2-card hand', () => {
  // construct a deterministic state — no natural blackjacks so playDealer doesn't fire
  // immediately after the double finishes
  let s = createGame(['x', 'y'], 'Blackjack');
  s.hands  = { x: [{ value: '5', suit: '♠' }, { value: '6', suit: '♥' }], y: [{ value: '7', suit: '♣' }, { value: '8', suit: '♦' }] };
  s.scores = { x: 11, y: 15 };
  s.status = { x: 'playing', y: 'playing' }; // y stays playing so round doesn't auto-resolve
  s.bets   = { x: 50, y: 50 };
  s.chips  = { x: 450, y: 450 };
  s.deck   = [{ value: '7', suit: '♣' }];
  s.phase  = 'playing'; s.currIndex = 0;
  s.dealerHand = [{ value: '9', suit: '♠' }, { value: '6', suit: '♥' }];
  s.dealerScore = 15; s.dealerHoleHidden = true;

  const r = double(s, 'x');
  eq(r.error, null);
  eq(r.newState.bets['x'], 100, 'bet doubled');
  eq(r.newState.chips['x'], 400, 'extra 50 deducted from chips');
  truthy(r.newState.status['x'] === 'standing' || r.newState.status['x'] === 'busted',
    'auto-stand or bust after double');
  // round not over yet because y is still playing
  eq(r.newState.phase, 'playing');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
