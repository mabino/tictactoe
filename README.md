# Tic-Tac-Toe: AI Trash-Talk Edition

A responsive web Tic-Tac-Toe game featuring an AI opponent powered by a local LLM server (`omlx` / `mlx_lm.server` hosting `mlx-community/Qwen3.8-27B-4bit`) with in-game trash-talk chat, real-time commentary, and an unbeatable Minimax offline fallback mode.

## Features

- **Mode Selection**:
  - **🤖 Play vs AI**: Play against the local LLM running at `http://127.0.0.1:8000`.
  - **👥 2-Player Local**: Pass-and-play two-player mode on the same device.
- **In-Game AI Chat Panel**:
  - The AI delivers snarky, witty trash-talk with every move.
  - Interactive chat box allowing the player to trash-talk back, ask questions, or react to moves.
  - Quick-action trash-talk chip buttons for fast mobile and desktop banter.
  - Endgame reactions (on AI wins, human wins, and stalemates).
  - Animated typing indicator when the AI is formulating its moves or replies.
- **Reliable Fallback Architecture**:
  - If the local AI server is offline, busy, or unreachable, the game alerts the player ("Taking a break...") and uses an offline Minimax algorithm so gameplay is never interrupted.
  - Automatic reconnection checks to resume live LLM commentary as soon as the server is available.
- **Sound Effects & Polish**:
  - Web Audio API retro synthesizer chimes for moves, victories, and chats (toggleable via UI).
  - Glowing dark-mode neon visuals, pop animations, and winning-line pulses.

## Quick Start

### 1. Start Local LLM Server (Optional for AI Commentary)

Start the `mlx_lm.server` (or `omlx`):

```bash
python3 -m mlx_lm.server --model mlx-community/Qwen3.8-27B-4bit --port 8000 --cors
```

### 2. Launch the Game

Open `index.html` directly in any modern browser, or serve it locally:

```bash
# Using Python
python3 -m http.server 8080

# Or using npm
npm start
```

Then visit `http://localhost:8080` in your web browser.

## Running Tests

Run unit and integration tests using Node's built-in test runner:

```bash
npm test
```

Or run tests in a container:

```bash
docker build -t tictactoe-tests .
```
