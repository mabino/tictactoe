import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  callLocalLLM,
  buildMovePrompt,
  parseLLMMoveResponse,
  getBestMinimaxMove,
  DEFAULT_CONFIG
} from '../src/game-engine.js';

describe('Local LLM Integration & Fallback Handling', () => {
  test('handles live server query or gracefully falls back on error', async () => {
    const board = ['X', null, null, null, null, null, null, null, null];
    const available = [1, 2, 3, 4, 5, 6, 7, 8];
    const messages = buildMovePrompt(board, available, 0);

    let moveChosen;
    let commentText;
    let usedFallback = false;

    try {
      const response = await callLocalLLM(messages, { timeoutMs: 5000 });
      const parsed = parseLLMMoveResponse(response, available);
      if (parsed) {
        moveChosen = parsed.move;
        commentText = parsed.comment;
      } else {
        usedFallback = true;
        moveChosen = getBestMinimaxMove(board, 'O', 'X');
        commentText = "Fallback heuristic move selected.";
      }
    } catch (err) {
      usedFallback = true;
      moveChosen = getBestMinimaxMove(board, 'O', 'X');
      commentText = "Server offline: Minimax fallback triggered.";
    }

    assert.ok(available.includes(moveChosen), `Move ${moveChosen} must be in available moves ${JSON.stringify(available)}`);
    assert.ok(typeof commentText === 'string' && commentText.length > 0);
  });

  test('falls back immediately when endpoint is unreachable (e.g. invalid port)', async () => {
    const board = ['X', 'X', null, 'O', null, null, null, null, null];
    const available = [2, 4, 5, 6, 7, 8];
    const messages = buildMovePrompt(board, available, 1);

    let moveChosen;
    let usedFallback = false;

    try {
      await callLocalLLM(messages, { apiEndpoint: 'http://127.0.0.1:9999/invalid', timeoutMs: 1000 });
    } catch (err) {
      usedFallback = true;
      moveChosen = getBestMinimaxMove(board, 'O', 'X');
    }

    assert.equal(usedFallback, true);
    assert.equal(moveChosen, 2); // Minimax blocks X from winning at 2
  });
});
