import express from "express";
import cors from "cors";
import { figmaRouter } from "./routes/figma.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "32mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/figma", figmaRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`figma-render server listening on http://localhost:${port}`);
});
