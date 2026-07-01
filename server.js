// Production server for Firebase App Hosting.
// App Hosting runs `npm run build` (→ dist/) then `npm start`, and expects a
// process listening on $PORT. This serves the static Vite SPA with a
// client-side-routing fallback to index.html.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const port = process.env.PORT || 8080;

const app = express();

// Hashed asset filenames are immutable → cache hard. index.html must not be
// cached so new deploys are picked up immediately.
app.use(
  express.static(distDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);

// SPA fallback: every non-asset route returns the app shell.
app.get("*", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, () => {
  console.log(`iCare Quiz Arena listening on port ${port}`);
});
