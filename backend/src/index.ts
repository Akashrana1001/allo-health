import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import productsRouter from "./routes/products";
import warehousesRouter from "./routes/warehouses";

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
// app.use("/api/reservations", reservationsRouter); — Phase 6+
// app.use("/api/cron", cronRouter);                 — Phase 8

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}`, code: "NOT_FOUND" });
});

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});
