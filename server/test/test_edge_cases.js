// Edge cases that the user actually hits while playing:
//   1. Blackjack: a player loses every round and ends up with < 10 chips
//   2. Blackjack: a player reconnects mid-round (socket-ID changes)
//   3. nextRound rejects a double-press from the second player

import {
  createGame, placeBet, hit, stand, nextRound,
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

console.log('\n── broke-player scenario ──');

test('placeBet refuses a bet when chips are below MIN_BET', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = { ...s, chips: { x: 5, y: 500 } };
  const { error } = placeBet(s, 'x', 10);
  truthy(error, 'should not allow bet larger than chips');
});

test('placeBet rejects a 0 bet', () => {
  const s = createGame(['x', 'y'], 'Blackjack');
  const { error } = placeBet(s, 'x', 0);
  truthy(error);
});

test('placeBet accepts a bet equal to remaining chips (all-in)', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  s = { ...s, chips: { x: 30, y: 500 } };
  const { newState, error } = placeBet(s, 'x', 30);
  eq(error, null);
  eq(newState.chips['x'], 0, 'all chips wagered');
  eq(newState.bets['x'], 30);
});

console.log('\n── nextRound idempotency ──');

test('nextRound from a state already in betting returns an error', () => {
  const s = createGame(['x', 'y'], 'Blackjack');
  const r = nextRound(s, 'x');
  truthy(r.error, 'cannot start a "next round" when not in resolved');
});

test('nextRound called twice in a row — second one is a no-op error', () => {
  let s = createGame(['x', 'y'], 'Blackjack');
  // play through to resolved
  s = placeBet(s, 'x', 50).newState;
  s = placeBet(s, 'y', 50).newState;
  s = stand(s, 'x').newState;
  s = stand(s, 'y').newState;
  eq(s.phase, 'resolved');
  // first nextRound: ok
  const first = nextRound(s, 'x');
  eq(first.error, null);
  eq(first.newState.phase, 'betting');
  // second nextRound on the betting state: error
  const second = nextRound(first.newState, 'y');
  truthy(second.error, 'second nextRound rejected');
});

console.log('\n── reconnection remap (simulating server logic) ──');

test('chips/bets/scores/status all follow when a player swaps socket IDs', () => {
  // start a Blackjack game, place bets, then simulate the server remap
  let s = createGame(['old-x', 'y'], 'Blackjack');
  s = placeBet(s, 'old-x', 50).newState;
  s = placeBet(s, 'y', 50).newState;
  // cards are dealt; verify state has all the dicts
  truthy(typeof s.chips['old-x'] === 'number', 'chips key exists');
  truthy(typeof s.scores['old-x'] === 'number', 'scores key exists');
  truthy(typeof s.status['old-x'] === 'string', 'status key exists');
  truthy(typeof s.bets['old-x'] === 'number',   'bets key exists');

  // apply the same remap the server does
  const remap = (dict) => {
    if (!dict || !('old-x' in dict)) return dict;
    const copy = { ...dict };
    copy['new-x'] = copy['old-x'];
    delete copy['old-x'];
    return copy;
  };
  s = {
    ...s,
    players: s.players.map(id => id === 'old-x' ? 'new-x' : id),
    hands:   remap(s.hands),
    chips:   remap(s.chips),
    bets:    remap(s.bets),
    scores:  remap(s.scores),
    status:  remap(s.status),
    results: remap(s.results),
  };

  // after remap: new-x should be able to act as if nothing happened
  eq(typeof s.chips['new-x'], 'number', 'chips moved over');
  eq(typeof s.scores['new-x'], 'number', 'scores moved over');
  eq(typeof s.status['new-x'], 'string', 'status moved over');
  eq(s.chips['old-x'], undefined, 'old key removed');

  // they can stand without errors
  const r = stand(s, 'new-x');
  eq(r.error, null, 'new-x can stand after the remap');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
