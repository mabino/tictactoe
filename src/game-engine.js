/**
 * Tic-Tac-Toe Game Engine & AI Integration
 */

export const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export const POSITION_NAMES = [
  'top-left corner',
  'top edge',
  'top-right corner',
  'left edge',
  'the center',
  'right edge',
  'bottom-left corner',
  'bottom edge',
  'bottom-right corner'
];

/**
 * Returns human-readable board position description.
 * @param {number} index 0-8
 * @returns {string}
 */
export function formatMoveDescription(index) {
  if (typeof index !== 'number' || index < 0 || index >= POSITION_NAMES.length) {
    return 'the board';
  }
  return POSITION_NAMES[index];
}

export const DEFAULT_CONFIG = {
  apiEndpoint: 'http://127.0.0.1:8000/v1/chat/completions',
  model: 'mlx-community/Qwen3.8-27B-4bit',
  timeoutMs: 7000,
  enableThinking: false,
  temperature: 0.7,
  frequency_penalty: 0.7,
  presence_penalty: 0.5,
  max_tokens: 45
};

export const FALLBACK_TAKING_BREAK_MESSAGES = [
  "Calculated move to dismantle your strategy.",
  "Setting up an inescapable trap. Your turn!",
  "Taking optimal position. Don't blink!",
  "Predictable move from a carbon-based lifeform.",
  "My heuristics say you're in trouble now.",
  "Corner secured. Let's see your response.",
  "Step into my parlor, said the spider to the fly."
];

export const FALLBACK_USER_CHAT_RESPONSES = [
  "Less chatting, more losing!",
  "Save the excuses for the post-game summary.",
  "I see every flaw in your grid from here.",
  "Bold words for someone with an exposed corner.",
  "Keep talking, it won't stop the inevitable.",
  "My algorithms are thoroughly unimpressed.",
  "Talk is cheap, but moves on this board are expensive.",
  "Are you always this confident before walking into a trap?"
];

export const FALLBACK_ENDGAME_COMMENTS = {
  ai_win: [
    "Checkmate! Wrong game, but you still lost.",
    "Calculated to absolute perfection. Better luck next time!",
    "Another flawless victory for silicon over carbon.",
    "Flawless match. Would you like another lesson in geometry?",
    "Math wins again. Don't feel too bad about it."
  ],
  human_win: [
    "A solar flare clearly flipped a bit in my logic gate! Rematch now.",
    "Beginner's luck. Enjoy your fleeting glory!",
    "A minor anomaly. I demand an immediate rematch.",
    "You got lucky that turn. It won't happen twice."
  ],
  draw: [
    "A stalemate... you survived this round by the skin of your teeth.",
    "A draw? I consider that tactical mercy on my part.",
    "Gridlock! Neither of us yielded an inch.",
    "You managed to not lose. Congratulations on surviving!"
  ]
};

/**
 * Strips quotes, roleplay asterisks, emoji loops, bracketed tags, and collapses repetition.
 * @param {string} text Raw model output
 * @param {string[]} fallbackList Optional fallback list if output is degenerate
 * @returns {string} Cleaned, punchy retort
 */
export function sanitizeTrashTalk(text, fallbackList = FALLBACK_USER_CHAT_RESPONSES) {
  if (!text || typeof text !== 'string') {
    return getRandomFallback(fallbackList);
  }

  let cleaned = text.trim();

  // Strip code blocks / markdown tags if present
  cleaned = cleaned.replace(/```(?:json)?[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // Strip bracketed metadata like [Scope: None], [Minimax Mode], [Taking a break]
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');

  // Strip roleplay asterisks like *smiles*, *chuckles*, *laughs*
  cleaned = cleaned.replace(/\*[^*]*\*/g, '');

  // Strip roleplay parentheticals like (smiles), (laughs)
  cleaned = cleaned.replace(/\([^)]*(?:smile|laugh|giggle|grin|sigh|chuckle)[^)]*\)/gi, '');

  // Strip token / number artifact leaks like :200, :1200, etc.
  cleaned = cleaned.replace(/:\d+/g, '');

  // Strip emoticons (like :D, :P, :), *;D, etc.) anywhere in the string
  cleaned = cleaned.replace(/[:;=8][\-o\*\']?[)D\]P(\/@\\Opo]/gi, '');

  // Strip remaining asterisks, backticks, hashes
  cleaned = cleaned.replace(/[*_#]/g, '');

  // Strip surrounding quotes
  cleaned = cleaned.replace(/^["'`“]+|["'`”]+$/g, '').trim();

  // Remove repeated quotes inside text if wrapped like: "Hello"
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Detect and collapse repeating sentences (e.g. "I can beat you! I can beat you!")
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 0) {
    const uniqueSentences = [];
    for (const s of sentences) {
      const normalized = s.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized && !uniqueSentences.some(u => u.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized)) {
        uniqueSentences.push(s.replace(/^["'`“]+|["'`”]+$/g, '').trim());
      }
    }
    cleaned = uniqueSentences.slice(0, 2).join(' ');
  }

  // Collapse repeated punctuation like !!!!! or ?????
  cleaned = cleaned.replace(/([!?.])\1{2,}/g, '$1');
  cleaned = cleaned.replace(/([^\w\s])\1{2,}/g, '$1');

  // Strip excessive emojis (limit to max 2)
  const emojiRegex = /[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}]/gu;
  let emojiCount = 0;
  cleaned = cleaned.replace(emojiRegex, (match) => {
    emojiCount++;
    return emojiCount <= 2 ? match : '';
  });

  // Final trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Check for repetitive degeneracy like ":200 :)" or length < 4 or nonsense characters only
  if (cleaned.length < 4 || /^[:\-\d\s*~=()]+$/.test(cleaned)) {
    return getRandomFallback(fallbackList);
  }

  return cleaned;
}

function getRandomFallback(list) {
  if (Array.isArray(list) && list.length > 0) {
    return list[Math.floor(Math.random() * list.length)];
  }
  return "Your move.";
}

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
  const lastMoveDesc = lastPlayerMove !== null ? formatMoveDescription(lastPlayerMove) : null;
  const availableDescs = availableMoves.map(i => `${i} (${POSITION_NAMES[i]})`).join(', ');

  const systemPrompt = `You are a witty, boastful, competitive Tic-Tac-Toe AI champion playing as '${aiSymbol}'.
You are playing against a human opponent playing as '${humanSymbol}'.

CRITICAL RULES:
1. Always pick a valid move index from the Available moves list.
2. In your comment, NEVER mention coordinate numbers, square numbers, cell indices, or array numbers (do NOT say "square 4" or "move 0"). Instead, use natural words like "the center", "that corner", or "the edge".
3. Keep your trash talk to exactly 1 short, punchy, hilarious sentence (under 15 words).
4. Do NOT wrap your comment in quotation marks. Do NOT include stage directions or asterisks (*smiles*).
5. Respond ONLY with a valid JSON object in this exact schema:
{"move": <integer 0-8>, "comment": "<1 short, punchy trash-talk sentence>"}

Few-shot examples of good trash talk:
- "Taking the center because I know you can't defend both flanks."
- "You left that corner wide open—amateur hour already?"
- "Blocking your line before you even realized you had one."
- "Enjoy that move while you can, your defeat is already charted."`;

  const userPrompt = `Available moves: [${availableMoves.join(', ')}]
Board positions available: ${availableDescs}
${lastMoveDesc ? `Human '${humanSymbol}' just claimed ${lastMoveDesc}.` : `You have the first move.`}
Select your winning move index and give a snappy trash-talk comment.`;

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
You are chatting with your opponent during a live match.

RULES:
1. Give exactly ONE short, punchy, hilarious trash-talk retort (under 18 words).
2. NEVER repeat or quote the human's message back to them.
3. NEVER use archaic or medieval words (no "verily", "thee", "doth"). Speak like a sharp modern gamer.
4. NEVER mention cell numbers or coordinates (no "square 4" or "0").
5. Do NOT use quotation marks around your answer. Do NOT use stage directions or asterisks (*smiles*, *chuckles*).
6. Do NOT spam emojis or repeating punctuation.

Examples of great retorts:
Human: "Ready to play"
AI: "Prepare to be humbled by basic geometry."

Human: "Think you can beat me?"
AI: "I've calculated fourteen million timelines, and you lose in every single one."

Human: "You're going down!"
AI: "Bold words from someone walking straight into my corner trap."

Human: "Play again?"
AI: "Back for another lesson? Set up the board."`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Include recent sanitized chat context (up to 4 past messages)
  const recentHistory = chatHistory
    .filter(item => item && item.text && typeof item.text === 'string' && !item.isOffline)
    .slice(-4);

  for (const item of recentHistory) {
    messages.push({
      role: item.sender === 'user' ? 'user' : 'assistant',
      content: item.text.replace(/["*]/g, '').trim()
    });
  }

  messages.push({
    role: 'user',
    content: userMessage.trim()
  });

  return messages;
}

/**
 * Builds the prompt for endgame reaction.
 */
export function buildEndGamePrompt(result, board, aiSymbol = 'O', humanSymbol = 'X') {
  const outcomeText = result === 'ai_win' 
    ? `You (${aiSymbol}) defeated the Human (${humanSymbol}).`
    : result === 'human_win' 
      ? `The Human (${humanSymbol}) defeated you (${aiSymbol}).`
      : `The match ended in a draw/tie.`;

  const systemPrompt = `You are a boastful, competitive Tic-Tac-Toe AI champion. The game just finished.
Give exactly 1 punchy, funny, boastful reaction sentence (under 16 words).
${result === 'ai_win' ? 'Brag about your flawless silicon mind.' : result === 'human_win' ? 'Make a hilarious excuse or demand an instant rematch.' : 'Act smug that they could only manage a tie.'}

RULES:
- NEVER mention cell numbers or coordinates.
- Do NOT wrap your retort in quotation marks.
- Do NOT use roleplay asterisks or archaic words.

Examples:
- AI Win: "Math wins again. Better luck next century!"
- Human Win: "A solar flare interfered with my circuitry! Rematch now."
- Draw: "A draw? I call that tactical mercy on my part."`;

  const userPrompt = `Match Outcome: ${outcomeText}\nTrash talk your opponent!`;

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
        max_tokens: options.max_tokens || config.max_tokens || 45,
        temperature: options.temperature ?? config.temperature ?? 0.7,
        frequency_penalty: options.frequency_penalty ?? config.frequency_penalty ?? 0.7,
        presence_penalty: options.presence_penalty ?? config.presence_penalty ?? 0.5,
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
