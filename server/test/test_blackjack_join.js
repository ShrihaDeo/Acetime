// Simulates the exact user scenario:
//   1. Two clients join a room
//   2. Host picks Blackjack from the menu
//   3. Verify both clients receive a state with chips = 500 (not 0)
//   4. Place a bet for each, verify cards are dealt
//   5. Both stand, verify dealer plays and chips update

import { spawn } from 'child_process';
import { io as Client } from 'socket.io-client';

const PORT = 4321;
const HOST = `http://localhost:${PORT}`;

function start() {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['server/index.js'], {
      env: { ...process.env, PORT: String(PORT), GROQ_API_KEY: 'smoke' },
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    proc.stdout.on('data', d => {
      if (!started && String(d).includes('Server running')) {
        started = true;
        resolve(proc);
      }
    });
    proc.stderr.on('data', d => console.error('[server stderr]', String(d)));
    setTimeout(() => { if (!started) reject(new Error('server did not start')); }, 5000);
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

function nextEvent(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, payload => { clearTimeout(t); resolve(payload); });
  });
}

let pass = 0, fail = 0;
const check = (cond, msg) => {
  if (cond) { pass++; console.log('  ok  ' + msg); }
  else      { fail++; console.log('  FAIL ' + msg); }
};

async function main() {
  const proc = await start();
  console.log('\n── e2e: Blackjack join flow ──');

  try {
    // Both clients join the same room
    const a = Client(HOST, { transports: ['websocket'] });
    const b = Client(HOST, { transports: ['websocket'] });

    await Promise.all([
      new Promise(r => a.on('connect', r)),
      new Promise(r => b.on('connect', r)),
    ]);

    const room = 'bj-test-' + Date.now().toString(36);

    // both join
    a.emit('join-room', { room, nickname: 'alice' });
    b.emit('join-room', { room, nickname: 'bob' });

    // both should get game-init for the auto-created LastCard game
    const [aInit1, bInit1] = await Promise.all([
      nextEvent(a, 'game-init'),
      nextEvent(b, 'game-init'),
    ]);
    check(aInit1?.players?.length === 2, 'auto-init LastCard game has 2 players');

    // Now alice (host) picks Blackjack
    a.emit('game-selected', { room, game: 'blackjack' });

    // both should receive game-selected first, then game-init for the new Blackjack game
    const [aSel, bSel] = await Promise.all([
      nextEvent(a, 'game-selected'),
      nextEvent(b, 'game-selected'),
    ]);
    check(aSel.game === 'blackjack', 'game-selected fired with blackjack');

    const [aInit2, bInit2] = await Promise.all([
      nextEvent(a, 'game-init'),
      nextEvent(b, 'game-init'),
    ]);

    console.log('  -- alice game-init payload:');
    console.log('       phase:', aInit2.phase);
    console.log('       chips:', JSON.stringify(aInit2.chips));
    console.log('       bets:', JSON.stringify(aInit2.bets));
    console.log('       selectedGame:', aInit2.selectedGame);
    console.log('       yourID:', aInit2.yourID);

    check(aInit2.phase === 'betting',     'alice sees phase=betting');
    check(aInit2.selectedGame === 'Blackjack', 'alice sees selectedGame=Blackjack');
    check(typeof aInit2.chips === 'object' && aInit2.chips !== null, 'alice has a chips object');
    check(aInit2.chips?.[aInit2.yourID] === 500, 'alice has 500 chips at start');
    check(bInit2.chips?.[bInit2.yourID] === 500, 'bob has 500 chips at start');

    // Both place a bet
    a.emit('send-move', { room, action: 'bet', amount: 50 });
    b.emit('send-move', { room, action: 'bet', amount: 50 });

    // After the second bet, cards should be dealt (phase=playing) and both should get game-state-update
    const [aDeal] = await Promise.all([
      nextEvent(a, 'game-state-update', 3000),
      nextEvent(b, 'game-state-update', 3000),
    ]);

    // there may be multiple game-state-updates (one per bet). consume the second too
    let dealtState = aDeal;
    if (aDeal.phase !== 'playing') {
      dealtState = await nextEvent(a, 'game-state-update', 3000);
    }

    console.log('\n  -- after both bets:');
    console.log('       phase:', dealtState.phase);
    console.log('       chips:', JSON.stringify(dealtState.chips));
    console.log('       bets:', JSON.stringify(dealtState.bets));
    console.log('       dealer cards:', dealtState.dealerHand?.length);

    check(dealtState.phase === 'playing',          'phase becomes playing after both bet');
    check(dealtState.chips[dealtState.yourID] === 450, 'alice now has 450 chips (after 50 bet)');
    check(dealtState.bets[dealtState.yourID] === 50,   'alice bet recorded as 50');

    // Both stand
    a.emit('send-move', { room, action: 'stand' });
    b.emit('send-move', { room, action: 'stand' });

    // Drain updates until we hit "resolved"
    let resolved = null;
    for (let i = 0; i < 5 && !resolved; i++) {
      try {
        const u = await nextEvent(a, 'game-state-update', 2000);
        if (u.phase === 'resolved') resolved = u;
      } catch {}
    }
    check(!!resolved, 'round resolves after both stand');
    if (resolved) {
      console.log('\n  -- after stand/stand:');
      console.log('       phase:', resolved.phase);
      console.log('       results:', JSON.stringify(resolved.results));
      console.log('       chips:', JSON.stringify(resolved.chips));
      check(typeof resolved.results === 'object', 'results object populated');
    }

    a.close(); b.close();
  } finally {
    proc.kill();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('runner crashed:', e); process.exit(2); });
