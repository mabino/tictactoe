/**
 * Tic-Tac-Toe Game Engine & AI Integration
 */

export const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export const DEFAULT_CONFIG = {
  apiEndpoint: 'http://127.0.0.1:8000/v1/chat/completions',
  model: 'mlx-community/Qwen3.8-27B-4bit',
  timeoutMs: 7000,
  enableThinking: false
};

export const FALLBACK_TAKING_BREAK_MESSAGES = [
  "[Taking a break] My neural network is offline right now, but I still made my move with Minimax!",
  "[Taking a break] Connection taking a breather! Minimax mode engaged.",
  "[Taking a break] Server is offline, but don't think that makes your board safe!",
  "[Taking a break] My high-powered brain is resting, but my offline heuristic will handle you just fine."
];

export const FALLBACK_USER_CHAT_RESPONSES = [
  "[Taking a break] AI server is offline right now, but I still see every mistake you make on that board.",
  "[Taking a break] Offline mode active — save the excuses for when you lose!",
  "[Taking a break] Less chatting, more losing!",
  "[Taking a break] I'd reply with deep prose, but beating you offline doesn't require high compute.",
  "[Taking a break] Keep talking, it won't save your corner."
];

export const FALLBACK_ENDGAME_COMMENTS = {
  ai_win: [
    "Checkmate! Wait, wrong game, but you still lost.",
    "Calculated to perfection. Better luck next time!",
    "Another victory for silicon over carbon."
  ],
  human_win: [
    "Beginner's luck. I demand a rematch!",
    "Enjoy your fleeting moment in the sun!",
    "Must have been a cosmic ray flip. Won't happen again."
  ],
  draw: [
    "A stalemate... you survived this round.",
    "A draw? I call that a tactical mercy.",
    "Gridlock. Let's see if you can do better next round."
  ]
};

/**
 * Checks the board for a winner.
 * @param {Array<string|null>} board 9-element array
 * @returns {{winner: string, line: number[]}|null}
 */
export function checkWinner(board) {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return null;
}

/**
 * Checks if the board is full.
 * @param {Array<string|null>} board
 * @returns {boolean}
 */
export function isBoardFull(board) {
  return board.every(cell => cell !== null && cell !== '');
}

/**
 * Returns an array of valid move indices (0-8).
 * @param {Array<string|null>} board
 * @returns {number[]}
 */
export function getAvailableMoves(board) {
  const moves = [];
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) moves.push(i);
  }
  return moves;
}

/**
 * Minimax algorithm for optimal fallback move calculation.
 */
export function minimax(board, depth, isMaximizing, aiSymbol = 'O', humanSymbol = 'X') {
  const win = checkWinner(board);
  if (win) {
    return win.winner === aiSymbol ? 10 - depth : depth - 10;
  }
  if (isBoardFull(board)) {
    return 0;
  }

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = aiSymbol;
        const score = minimax(board, depth + 1, false, aiSymbol, humanSymbol);
        board[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = humanSymbol;
        const score = minimax(board, depth + 1, true, aiSymbol, humanSymbol);
        board[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

/**
 * Returns the best move using Minimax.
 * @param {Array<string|null>} board
 * @param {string} aiSymbol
 * @param {string} humanSymbol
 * @returns {number}
 */
export function getBestMinimaxMove(board, aiSymbol = 'O', humanSymbol = 'X') {
  const availableMoves = getAvailableMoves(board);
  if (availableMoves.length === 0) return -1;
  if (availableMoves.length === 9) {
    const openers = [0, 2, 4, 6, 8];
    return openers[Math.floor(Math.random() * openers.length)];
  }

  let bestMove = availableMoves[0];
  let bestScore = -Infinity;

  for (const move of availableMoves) {
    board[move] = aiSymbol;
    const score = minimax(board, 0, false, aiSymbol, humanSymbol);
    board[move] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

/**
 * Safely parses the LLM response JSON containing move and comment.
 * Handles raw JSON, Markdown code blocks, or embedded JSON objects.
 * @param {string} rawContent
 * @param {number[]} availableMoves
 * @returns {{move: number, comment: string}|null}
 */
export function parseLLMMoveResponse(rawContent, availableMoves) {
  if (!rawContent || typeof rawContent !== 'string') return null;

  let cleaned = rawContent.trim();
  
  // Extract from markdown code blocks if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Find the outermost JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(cleaned);
    let move = Number(parsed.move);
    if (!Number.isInteger(move) || !availableMoves.includes(move)) {
      return null;
    }
    const comment = typeof parsed.comment === 'string' && parsed.comment.trim() 
      ? parsed.comment.trim() 
      : "Your move.";
    return { move, comment };
  } catch {
    return null;
  }
}

/**
 * Builds the LLM prompt messages for making an AI move.
 */
export function buildMovePrompt(board, availableMoves, lastPlayerMove = null, aiSymbol = 'O', humanSymbol = 'X') {
  const formattedBoard = board.map((v, i) => v === null ? `${i}` : v);
  const boardAscii = `
 ${formattedBoard[0]} | ${formattedBoard[1]} | ${formattedBoard[2]}
---+---+---
 ${formattedBoard[3]} | ${formattedBoard[4]} | ${formattedBoard[5]}
---+---+---
 ${formattedBoard[6]} | ${formattedBoard[7]} | ${formattedBoard[8]}
`.trim();

  const systemPrompt = `You are a witty, boastful, trash-talking Tic-Tac-Toe AI champion playing as '${aiSymbol}'.
You are playing against a human '${humanSymbol}'.
Board indices are 0-8.
Always pick a valid integer move from the Available moves list.
Respond ONLY with a valid JSON object in this exact schema:
{"move": <integer 0-8>, "comment": "<1 short, snappy, boastful or witty trash-talk comment about the move>"}
Do not include extra explanations or markdown outside the JSON.`;

  const userPrompt = `Current board state:
${boardAscii}

Board array: ${JSON.stringify(board)}
Available moves: ${JSON.stringify(availableMoves)}
${lastPlayerMove !== null ? `Human '${humanSymbol}' just played at square ${lastPlayerMove}.` : `It is your turn.`}
Choose your winning or blocking move and trash talk your opponent!`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

/**
 * Builds the LLM prompt for reacting to a user chat message.
 */
export function buildChatPrompt(userMessage, board, chatHistory = [], aiSymbol = 'O', humanSymbol = 'X') {
  const systemPrompt = `You are a witty, sassy, competitive Tic-Tac-Toe AI master playing as '${aiSymbol}' against human '${humanSymbol}'.
The human is chatting with you during your match. Reply with a short, funny, boastful trash-talk retort (1-2 sentences). Keep it playful and sharp.`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Include recent chat context (up to 4 past messages)
  const recentHistory = chatHistory.slice(-4);
  for (const item of recentHistory) {
    messages.push({
      role: item.sender === 'user' ? 'user' : 'assistant',
      content: item.text
    });
  }

  messages.push({
    role: 'user',
    content: `Board: ${JSON.stringify(board)}. Human says: "${userMessage}"`
  });

  return messages;
}

/**
 * Builds the prompt for endgame reaction.
 */
export function buildEndGamePrompt(result, board, aiSymbol = 'O', humanSymbol = 'X') {
  const outcomeText = result === 'ai_win' 
    ? `You (${aiSymbol}) won against Human (${humanSymbol})!`
    : result === 'human_win' 
      ? `Human (${humanSymbol}) defeated you (${aiSymbol})!`
      : `Game ended in a draw/tie!`;

  const systemPrompt = `You are a boastful, dramatic Tic-Tac-Toe AI. The game just finished.
Give a single punchy, hilarious, in-character reaction sentence (${result === 'ai_win' ? 'bragging about your genius' : result === 'human_win' ? 'making a funny excuse or demanding a rematch' : 'commenting on the stalemate'}).`;

  const userPrompt = `Game Result: ${outcomeText}\nFinal board: ${JSON.stringify(board)}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

/**
 * Makes an API call to the local OpenAI-compatible endpoint.
 */
export async function callLocalLLM(messages, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: options.max_tokens || 120,
        temperature: options.temperature ?? 0.8,
        chat_template_kwargs: {
          enable_thinking: config.enableThinking
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('Malformed LLM completion payload');
    }
    return content.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
