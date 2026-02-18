# Snake Even G2

> See also: [G2 development notes](https://github.com/nickustinov/even-g2-notes/blob/main/G2.md) – hardware specs, UI system, input handling and practical patterns for Even Realities G2.

Classic Snake game for [Even Realities G2](https://www.evenrealities.com/) smart glasses.

Swipe to steer, eat food, grow longer. No server required – everything runs client-side.

## Architecture

The main challenge is performance: the G2 display is updated by pushing PNG images over BLE, which makes high-frequency frame updates expensive. The game is designed around this constraint:

1. **Page container set up once** – `createStartUpPageContainer` is called once at launch. During gameplay, only `updateImageRawData` is called – no page rebuilds.

2. **Persistent canvas with delta rendering** – a single Canvas stays in memory for the entire session. Each tick only repaints the changed cells (new head, cleared tail, new food) instead of redrawing the full 576×288 board.

3. **Self-pacing game loop** – the loop awaits each image push before scheduling the next tick. If a push takes longer than the tick interval, the game slows gracefully instead of queuing frames.

4. **Frame skip on backpressure** – if a push is still in flight, the next frame is silently dropped rather than queued.

```
tick() → drawDelta() → await pushFrame() → sleep(remaining) → repeat
```

### Grid

- 576×288 display at 16px cells = 36 columns × 18 rows
- Snake wraps around edges (no wall death)
- ~250ms per tick (~4 moves/second)

## Controls

| Input | Action |
|---|---|
| Tap | Start game / restart after game over |
| Swipe down | Turn right (clockwise) |
| Swipe up | Turn left (counterclockwise) |
| Double tap | Start game / restart after game over |

## Project structure

```
g2/
  index.ts       App module registration
  main.ts        Bridge connection
  app.ts         Game loop orchestrator
  state.ts       Game state (snake, food, direction, score)
  game.ts        Game logic (tick, collision, turning)
  renderer.ts    Persistent canvas, delta rendering, image push
  events.ts      Event normalisation + input dispatch
  layout.ts      Display and grid constants
```

## Setup

Requires [even-dev](https://github.com/BxNxM/even-dev) (Unified Even Hub Simulator v0.0.2).

```bash
npm install

# Symlink into even-dev
ln -s /path/to/snake-even-g2/g2 /path/to/even-dev/apps/snake

# Run
cd /path/to/even-dev
APP_NAME=snake ./start-even.sh
```

Click **Connect glasses**, then tap on the glasses to start.

## Tech stack

- **G2 frontend:** TypeScript + [Even Hub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- **Build:** [Vite](https://vitejs.dev/)
