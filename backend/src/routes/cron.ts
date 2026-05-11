import { Router } from "express";
import { releaseExpiredReservations } from "../db/expire";
import { UnauthorizedError } from "../lib/errors";
import { env } from "../config/env";

const router = Router();

// POST /api/cron/expire
// Protected by Authorization: Bearer <CRON_SECRET>.
// Vercel Cron (or any external scheduler) calls this every minute.
router.post("/expire", async (req, res, next) => {
  try {
    const auth = req.headers["authorization"];
    if (!auth || auth !== `Bearer ${env.cronSecret}`) {
      throw new UnauthorizedError();
    }

    const released = await releaseExpiredReservations();

    res.json({ released, message: `Released ${released} expired reservation(s)` });
  } catch (err) {
    next(err);
  }
});

export default router;
