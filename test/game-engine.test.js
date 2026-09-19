import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkWinner,
  isBoardFull,
  getAvailableMoves,
  minimax,
  getBestMinimaxMove,
  parseLLMMoveResponse,
  buildMovePrompt,
  buildChatPrompt,
  buildEndGamePrompt,
  POSITION_NAMES,
  formatMoveDescription,
  sanitizeTrashTalk
} from '../src/game-engine.js';

describe('Game Engine - Board & Win Conditions', () => {
  test('detects row win for X', () => {
    const board = ['X', 'X', 'X', null, 'O', 'O', null, null, null];
    const win = checkWinner(board);
    assert.deepEqual(win, { winner: 'X', line: [0, 1, 2] });
  });

  test('detects column win for O', () => {
    const board = ['X', 'O', null, 'X', 'O', null, null, 'O', 'X'];
    const win = checkWinner(board);
    assert.deepEqual(win, { winner: 'O', line: [1, 4, 7] });
  });

  test('detects diagonal win for X', () => {
    const board = ['X', 'O', null, null, 'X', 'O', null, null, 'X'];
    const win = checkWinner(board);
    assert.deepEqual(win, { winner: 'X', line: [0, 4, 8] });
  });

  test('returns null when no winner exists', () => {
    const board = ['X', 'O', 'X', null, null, null, null, null, null];
    assert.equal(checkWinner(board), null);
  });

  test('checks if board is full', () => {
    const full = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    const notFull = ['X', 'O', 'X', 'X', null, 'O', 'O', 'X', 'X'];
    assert.equal(isBoardFull(full), true);
    assert.equal(isBoardFull(notFull), false);
  });

  test('retrieves available move indices', () => {
    const board = ['X', null, 'O', null, null, 'X', null, 'O', null];
    assert.deepEqual(getAvailableMoves(board), [1, 3, 4, 6, 8]);
  });
});

describe('Minimax AI Fallback', () => {
  test('takes immediate winning move for AI (O)', () => {
    // O can win at index 2
    const board = [
      'O', 'O', null,
      'X', 'X', null,
      null, null, null
    ];
    const bestMove = getBestMinimaxMove(board, 'O', 'X');
    assert.equal(bestMove, 2);
  });

  test('blocks opponent (X) from winning on next turn', () => {
    // X is about to win at index 2 (0, 1, 2)
    const board = [
      'X', 'X', null,
      'O', null, null,
      null, null, null
    ];
    const bestMove = getBestMinimaxMove(board, 'O', 'X');
    assert.equal(bestMove, 2);
  });

  test('blocks diagonal win attempt', () => {
    // X has 0 and 4, O must block at 8
    const board = [
      'X', null, null,
      null, 'X', null,
      null, null, null
    ];
    // O should prioritize 8 or center/corners to defend
    const bestMove = getBestMinimaxMove(board, 'O', 'X');
    assert.equal(bestMove, 8);
  });

  test('returns -1 if board is full', () => {
    const fullBoard = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    assert.equal(getBestMinimaxMove(fullBoard, 'O', 'X'), -1);
  });
});

describe('LLM Response Parsing & Validation', () => {
  test('parses clean JSON response', () => {
    const raw = '{"move": 4, "comment": "Taking center stage!"}';
    const parsed = parseLLMMoveResponse(raw, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(parsed, { move: 4, comment: "Taking center stage!" });
  });

  test('parses markdown code block JSON', () => {
    const raw = '```json\n{"move": 7, "comment": "You walked right into this."}\n```';
    const parsed = parseLLMMoveResponse(raw, [1, 3, 7]);
    assert.deepEqual(parsed, { move: 7, comment: "You walked right into this." });
  });

  test('rejects move if index is not in available moves', () => {
    const raw = '{"move": 0, "comment": "Trying an already occupied square"}';
    const parsed = parseLLMMoveResponse(raw, [1, 2, 3]); // 0 is not available
    assert.equal(parsed, null);
  });

  test('rejects malformed text without valid JSON', () => {
    const raw = 'I choose square 4 because it is the center.';
    const parsed = parseLLMMoveResponse(raw, [4]);
    assert.equal(parsed, null);
  });

  test('supplies fallback comment if comment is missing in valid JSON', () => {
    const raw = '{"move": 2}';
    const parsed = parseLLMMoveResponse(raw, [2, 5]);
    assert.deepEqual(parsed, { move: 2, comment: "Your move." });
  });
});

describe('Spatial Position Naming', () => {
  test('correctly names all 9 board positions', () => {
    assert.equal(POSITION_NAMES.length, 9);
    assert.equal(formatMoveDescription(0), 'top-left corner');
    assert.equal(formatMoveDescription(4), 'the center');
    assert.equal(formatMoveDescription(8), 'bottom-right corner');
  });

  test('falls back gracefully for invalid indices', () => {
    assert.equal(formatMoveDescription(-1), 'the board');
    assert.equal(formatMoveDescription(99), 'the board');
    assert.equal(formatMoveDescription(null), 'the board');
  });
});

describe('Trash Talk Sanitizer & Anti-Loop Guardrails', () => {
  test('strips surrounding quotation marks', () => {
    assert.equal(sanitizeTrashTalk('"Seven nines of trash, for you!"'), 'Seven nines of trash, for you!');
    assert.equal(sanitizeTrashTalk("'You are going down'"), 'You are going down');
  });

  test('strips roleplay asterisks and parentheticals', () => {
    const raw = ':P "You\'re going down!" *only slightly more jovial smile*';
    const cleaned = sanitizeTrashTalk(raw);
    assert.equal(cleaned, "You're going down!");
  });

  test('strips bracketed tags like [Scope: None]', () => {
    const raw = '[Scope: None] Taking your corner now!';
    const cleaned = sanitizeTrashTalk(raw);
    assert.equal(cleaned, 'Taking your corner now!');
  });

  test('collapses duplicate repeating sentences', () => {
    const raw = 'I can beat you! I can beat you! I can beat you!';
    const cleaned = sanitizeTrashTalk(raw);
    assert.equal(cleaned, 'I can beat you!');
  });

  test('detects and cleans repetitive degenerate loops', () => {
    const raw = ':D "Oh, I can beat you! " :200 :) :D *:D "I can beat you!" :1200 :)';
    const cleaned = sanitizeTrashTalk(raw);
    assert.ok(cleaned.length > 0);
    assert.ok(!cleaned.includes(':200'));
    assert.ok(!cleaned.includes('*:D'));
  });

  test('returns fallback for empty or nonsense strings', () => {
    const fallbackList = ['Fallback response'];
    assert.equal(sanitizeTrashTalk('', fallbackList), 'Fallback response');
    assert.equal(sanitizeTrashTalk('[Scope: None]', fallbackList), 'Fallback response');
    assert.equal(sanitizeTrashTalk(':D :P', fallbackList), 'Fallback response');
    assert.equal(sanitizeTrashTalk(null, fallbackList), 'Fallback response');
  });
});

describe('Prompt Construction', () => {
  test('buildMovePrompt returns valid schema and spatial instructions', () => {
    const board = ['X', null, null, null, null, null, null, null, null];
    const prompts = buildMovePrompt(board, [1, 2, 3, 4, 5, 6, 7, 8], 0);
    assert.equal(prompts.length, 2);
    assert.equal(prompts[0].role, 'system');
    assert.equal(prompts[1].role, 'user');
    assert.match(prompts[0].content, /JSON/);
    assert.match(prompts[0].content, /NEVER mention coordinate numbers/);
    assert.match(prompts[1].content, /top-left corner/);
  });

  test('buildChatPrompt includes few-shot examples and clean history', () => {
    const history = [
      { sender: 'user', text: 'Hey there' },
      { sender: 'ai', text: 'Prepare to lose!' }
    ];
    const board = Array(9).fill(null);
    const prompts = buildChatPrompt('Are you ready?', board, history);
    assert.equal(prompts.length, 4); // system + 2 history + new user message
    assert.match(prompts[0].content, /Examples of great retorts/);
    assert.match(prompts[3].content, /Are you ready\?/);
  });

  test('buildEndGamePrompt formats outcome without numbers', () => {
    const prompts = buildEndGamePrompt('ai_win', ['O', 'O', 'O', 'X', 'X', null, null, null, null]);
    assert.match(prompts[0].content, /NEVER mention cell numbers/);
    assert.match(prompts[1].content, /defeated the Human/);
  });
});
