# Snake for Even G2

Classic Snake game for [Even Realities G2](https://www.evenrealities.com/) smart glasses.

Swipe to steer, eat food, grow longer. Global leaderboard shared across all players.

## Controls

| Input | Action |
|---|---|
| Tap | Start game / restart after game over |
| Swipe down | Turn right (clockwise) |
| Swipe up | Turn left (counterclockwise) |
| Double tap | Quit to splash / exit app |

## Architecture

Three screen layouts, switched via `rebuildPageContainer`:

- **Splash** – logo image + best score + top 5 leaderboard
- **Game** – fullwidth unicode grid (`▦` snake, `◆` food) + score overlay
- **Game over** – blinking "GAME OVER" title + score/best + leaderboard, then "TAP TO RESTART"

A hidden text container with `isEventCapture: 1` is present on every screen to capture input events without triggering the firmware's internal text scrolling.

During gameplay, only `textContainerUpgrade` is called for the grid and score – no page rebuilds until the game ends or the player quits.

### Grid

- 28 columns x 10 rows
- Wall death (hitting edges ends the game)
- ~350 ms per tick (~3 moves/second)

### Leaderboard

Scores are fetched from and submitted to `scores.g2.ninja`. Reading the leaderboard works without authentication. Submitting scores requires a token set via the `VITE_SCORES_TOKEN` environment variable (sent as `Authorization: Bearer` header).

## Project structure

```
g2/
  index.ts       App module registration
  main.ts        Bridge connection with timeout
  app.ts         Game loop and screen transitions
  state.ts       Game state (snake, food, direction, score)
  game.ts        Game logic (tick, collision, turning)
  renderer.ts    Screen configs, grid rendering, blink animation
  events.ts      Event normalisation + input dispatch
  scores-api.ts  Leaderboard fetch/submit
  layout.ts      Display and grid constants
  logo.png       Splash screen logo
```

## Setup

```bash
npm install
npm run dev
```

### Scores token

To enable score submission, create a `.env` file:

```
VITE_SCORES_TOKEN=your-token-here
```

### Run with Even Hub simulator

```bash
./start-even.sh
```

### Run on real glasses

```bash
npm run dev   # keep running
npm run qr    # generates QR code for http://<your-ip>:5173
```

### Package for distribution

```bash
npm run pack  # builds and creates snake.ehpk
```

## Tech stack

- **Runtime:** TypeScript + [Even Hub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- **Build:** [Vite](https://vitejs.dev/)
- **Leaderboard:** [scores.g2.ninja](https://scores.g2.ninja) API
- **CLI:** [evenhub-cli](https://www.npmjs.com/package/@evenrealities/evenhub-cli)
