import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  directUrl: process.env.DIRECT_URL ?? "",
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL ?? "",
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  cronSecret: optional("CRON_SECRET", "dev-secret"),
  frontendOrigin: optional("FRONTEND_ORIGIN", "http://localhost:3000"),
  port: Number(optional("PORT", "4000")),
  reservationTtlMinutes: Number(optional("RESERVATION_TTL_MINUTES", "10")),
};
