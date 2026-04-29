import express from "express";
import cors from "cors";
import { figmaRouter } from "./routes/figma.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "32mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Friendly hint when someone opens the API server in a browser by mistake.
app.get("/", (_req, res) => {
  res
    .status(200)
    .type("text/plain")
    .send(
      [
        "figma-render API server",
        "",
        "This is the backend API. Open the web UI at http://localhost:5173 instead.",
        "",
        "Available endpoints:",
        "  GET  /api/health",
        "  POST /api/figma/load",
        "  POST /api/figma/export",
      ].join("\n"),
    );
});

app.use("/api/figma", figmaRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, "127.0.0.1", () => {
  console.log(`figma-render server listening on http://127.0.0.1:${port}`);
});
