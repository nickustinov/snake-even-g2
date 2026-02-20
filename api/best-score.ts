import type { VercelRequest, VercelResponse } from '@vercel/node'
import Redis from 'ioredis'

const REDIS_KEY = 'snake:best'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL!)
  }
  return redis
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const client = getRedis()

  if (req.method === 'GET') {
    const val = await client.get(REDIS_KEY)
    const score = val ? parseInt(val, 10) || 0 : 0
    return res.json({ score })
  }

  if (req.method === 'POST') {
    const { score } = req.body ?? {}
    if (typeof score !== 'number' || score < 0 || !Number.isInteger(score)) {
      return res.status(400).json({ error: 'Invalid score' })
    }

    // Atomic: set only if the new score is higher than the current best
    const result = await client.eval(
      `local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
       local proposed = tonumber(ARGV[1])
       if proposed > cur then
         redis.call('SET', KEYS[1], ARGV[1])
         return proposed
       end
       return cur`,
      1,
      REDIS_KEY,
      String(score),
    )
    return res.json({ score: Number(result) })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
