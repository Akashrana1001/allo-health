import { getRedis } from "./redis";
import { prisma } from "./prisma";

const TTL_SECONDS = 86400; // 24 hours
const CACHE_PREFIX = "idem:";

type CachedResponse = { body: unknown; status: number };
type IdempotencyResult = CachedResponse & { replayed: boolean };

/**
 * Wraps a handler so retries with the same Idempotency-Key return the original
 * response without re-executing the side effect.
 *
 * Lookup order: Upstash Redis (fast) → Postgres `IdempotencyKey` (durable).
 * Only successful (2xx) responses are cached so error responses can be retried
 * against current state.
 */
export async function withIdempotency(
  key: string | undefined,
  handler: () => Promise<CachedResponse>
): Promise<IdempotencyResult> {
  if (!key) {
    const result = await handler();
    return { ...result, replayed: false };
  }

  const redis = getRedis();
  const cacheKey = `${CACHE_PREFIX}${key}`;

  // 1. Fast path: Redis
  if (redis) {
    try {
      const cached = await redis.get<CachedResponse>(cacheKey);
      if (cached) return { ...cached, replayed: true };
    } catch (err) {
      // Redis unavailable — fall through to Postgres rather than failing the request
      console.warn("[idempotency] redis lookup failed, falling back to db:", err);
    }
  }

  // 2. Durable fallback: Postgres
  const dbRecord = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (dbRecord) {
    return {
      body: dbRecord.responseBody,
      status: dbRecord.statusCode,
      replayed: true,
    };
  }

  // 3. Cache miss: execute the real handler
  const result = await handler();

  // Cache only successful responses — errors should be retryable
  if (result.status >= 200 && result.status < 300) {
    if (redis) {
      try {
        await redis.set(cacheKey, result, { ex: TTL_SECONDS });
      } catch (err) {
        console.warn("[idempotency] redis write failed:", err);
      }
    }
    await prisma.idempotencyKey.upsert({
      where: { key },
      update: {},
      create: {
        key,
        responseBody: result.body as never,
        statusCode: result.status,
      },
    });
  }

  return { ...result, replayed: false };
}
