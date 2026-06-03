// Smoke-test the /api/ask endpoint's new shape: { question, game, context }.
// Boots the server on a free port with a fake Groq key, fires three requests
// (lastcard, blackjack, general) and asserts the server accepts them all (doesn't 400).

import http from 'http';
import { spawn } from 'child_process';

const PORT = 4123;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: 'localhost', port: PORT, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 5000,
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} }); }
        catch (e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(data); req.end();
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  let pass = 0, fail = 0;
  const test = async (name, fn) => {
    try { await fn(); console.log('  ok  ' + name); pass++; }
    catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); fail++; }
  };

  const proc = spawn('node', ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), GROQ_API_KEY: 'bad-key-for-test' },
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // wait for the server to start listening
  await new Promise(resolve => {
    proc.stdout.on('data', d => {
      if (String(d).includes('Server running')) resolve();
    });
    setTimeout(resolve, 2000);
  });

  console.log('\n── /api/ask wire-up ──');

  await test('rejects an empty question with 400', async () => {
    const r = await post('/api/ask', {});
    if (r.status !== 400) throw new Error('expected 400, got ' + r.status);
  });

  await test('accepts a Last Card question with context (does not 400)', async () => {
    const r = await post('/api/ask', {
      question: 'Can I play a 2 on a Jack?',
      game: 'lastcard',
      context: { handSize: 5, topCard: '♣J', declaredSuit: '♣', drawStack: 0 },
    });
    if (r.status === 400) throw new Error('server rejected the shape (400): ' + JSON.stringify(r.body));
  });

  await test('accepts a Blackjack question with context (does not 400)', async () => {
    const r = await post('/api/ask', {
      question: 'Should I hit on 15 against a 10?',
      game: 'blackjack',
      context: { phase: 'playing', yourScore: 15, yourChips: 450, dealerUpcard: '♣10' },
    });
    if (r.status === 400) throw new Error('server rejected the shape (400): ' + JSON.stringify(r.body));
  });

  await test('accepts a question with no game (general)', async () => {
    const r = await post('/api/ask', { question: 'How do I start a game?' });
    if (r.status === 400) throw new Error('server rejected the shape (400): ' + JSON.stringify(r.body));
  });

  await test('accepts a question with an unknown game (falls back to general)', async () => {
    const r = await post('/api/ask', { question: 'hi', game: 'gin-rummy' });
    if (r.status === 400) throw new Error('server rejected the shape (400): ' + JSON.stringify(r.body));
  });

  proc.kill();
  await wait(150);
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('runner crashed:', e);
  process.exit(2);
});
