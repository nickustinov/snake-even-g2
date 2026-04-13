const SCORES_URL = 'https://scores.g2.ninja'
const APP_TOKEN = 'g2-scores-dev-token'

export type LeaderboardEntry = {
  name: string
  score: number
  uid: number
}

export async function fetchLeaderboard(gameId: string): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${SCORES_URL}/api/scores/${gameId}?limit=10`)
    if (!res.ok) return []
    const data = await res.json() as { scores: LeaderboardEntry[] }
    return data.scores
  } catch {
    return []
  }
}

export async function submitScore(
  gameId: string,
  name: string,
  score: number,
  uid: number,
): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${SCORES_URL}/api/scores/${gameId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APP_TOKEN}`,
      },
      body: JSON.stringify({ name, score, uid }),
    })
    if (!res.ok) return []
    const data = await res.json() as { scores: LeaderboardEntry[] }
    return data.scores
  } catch {
    return []
  }
}
