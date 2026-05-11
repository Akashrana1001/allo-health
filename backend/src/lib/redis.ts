import { Redis } from "@upstash/redis";
import { env } from "../config/env";

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.upstashRedisUrl || !env.upstashRedisToken) {
    return null;
  }
  if (_redis) return _redis;
  _redis = new Redis({
    url: env.upstashRedisUrl,
    token: env.upstashRedisToken,
  });
  return _redis;
}
