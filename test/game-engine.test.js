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
  buildEndGamePrompt
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

describe('Prompt Construction', () => {
  test('buildMovePrompt returns valid schema and instructions', () => {
    const board = ['X', null, null, null, null, null, null, null, null];
    const prompts = buildMovePrompt(board, [1, 2, 3, 4, 5, 6, 7, 8], 0);
    assert.equal(prompts.length, 2);
    assert.equal(prompts[0].role, 'system');
    assert.equal(prompts[1].role, 'user');
    assert.match(prompts[0].content, /JSON/);
    assert.match(prompts[1].content, /square 0/);
  });

  test('buildChatPrompt includes message history', () => {
    const history = [
      { sender: 'user', text: 'Hey there' },
      { sender: 'ai', text: 'Prepare to lose!' }
    ];
    const board = Array(9).fill(null);
    const prompts = buildChatPrompt('Are you ready?', board, history);
    assert.equal(prompts.length, 4); // system + 2 history + new user message
    assert.match(prompts[3].content, /Are you ready\?/);
  });

  test('buildEndGamePrompt formats win outcome correctly', () => {
    const prompts = buildEndGamePrompt('ai_win', ['O', 'O', 'O', 'X', 'X', null, null, null, null]);
    assert.match(prompts[1].content, /won against Human/);
  });
});
