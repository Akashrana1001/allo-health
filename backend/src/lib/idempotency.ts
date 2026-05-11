import { getRedis } from "./redis";
import { prisma } from "./prisma";

const TTL_SECONDS = 86400; // 24 hours
const CACHE_PREFIX = "idem:";

type CachedResponse = { body: unknown; status: number };

export async function withIdempotency(
  key: string | undefined,
  handler: () => Promise<CachedResponse>
): Promise<CachedResponse> {
  if (!key) return handler();

  const redis = getRedis();
  const cacheKey = `${CACHE_PREFIX}${key}`;

  // Fast path: check Redis first
  if (redis) {
    const cached = await redis.get<CachedResponse>(cacheKey);
    if (cached) return cached;
  }

  // Durable fallback: check Postgres
  const dbRecord = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (dbRecord) {
    return { body: dbRecord.responseBody, status: dbRecord.statusCode };
  }

  // Cache miss: run the handler
  const result = await handler();

  // Only cache successful responses — errors should be retryable
  if (result.status >= 200 && result.status < 300) {
    if (redis) {
      await redis.set(cacheKey, result, { ex: TTL_SECONDS });
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

  return result;
}
