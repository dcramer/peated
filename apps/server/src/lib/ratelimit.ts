import { getRedis } from "./redis";

type LimitOpts = {
  key: string;
  windowSec: number;
  max: number;
};

export async function rateLimit({ key, windowSec, max }: LimitOpts) {
  const redis = getRedis();
  const now = Math.floor(Date.now() / 1000);
  const bucket = `${key}:${Math.floor(now / windowSec)}`; // fixed window
  const count = await redis.incr(bucket);
  if (count === 1) {
    await redis.expire(bucket, windowSec + 2);
  }
  return count <= max;
}

export async function assertRateLimit(opts: LimitOpts, onError: () => never) {
  const ok = await rateLimit(opts);
  if (!ok) onError();
}
