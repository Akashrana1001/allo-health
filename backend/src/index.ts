import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import cron from "node-cron";
import productsRouter from "./routes/products";
import warehousesRouter from "./routes/warehouses";
import reservationsRouter from "./routes/reservations";
import cronRouter from "./routes/cron";
import { releaseExpiredReservations } from "./db/expire";

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/products", productsRouter);
app.use("/api/warehouses", warehousesRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/cron", cronRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}`, code: "NOT_FOUND" });
});

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});

// In-process cron: release expired reservations every minute.
// This keeps reservedQuantity accurate in the DB (the lazy-cleanup layer in
// GET /api/products handles availability accuracy between cron runs).
cron.schedule("* * * * *", async () => {
  try {
    const released = await releaseExpiredReservations();
    if (released > 0) {
      console.log(`[cron] released ${released} expired reservation(s)`);
    }
  } catch (err) {
    console.error("[cron] expiry job failed:", err);
  }
});
