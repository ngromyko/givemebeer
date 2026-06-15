import { createServer } from "node:http";
import { readFile, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const leaderboardPath = join(root, "leaderboard.json");
const port = Number(process.env.PORT || 8765);
const basePath = (process.env.BASE_PATH || "").replace(/\/+$/, "");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || "{}");
}

async function getScores() {
  try {
    const rows = JSON.parse(await readFile(leaderboardPath, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function saveScores(rows) {
  await writeFile(leaderboardPath, JSON.stringify(dedupeRows(rows).slice(0, 50), null, 2), "utf8");
}

function nameKey(name) {
  return String(name || "").trim().toLocaleLowerCase("ru-RU");
}

function cleanName(value) {
  return String(value || "безымянный")
    .replace(/[^\p{L}\p{N}_ .-]/gu, "")
    .trim()
    .slice(0, 18) || "безымянный";
}

function dedupeRows(rows) {
  const best = new Map();
  for (const row of rows) {
    const name = cleanName(row.name);
    const key = nameKey(name);
    const current = {
      name,
      score: Math.max(0, Math.min(999999, Number.parseInt(row.score, 10) || 0)),
      createdAt: row.createdAt || new Date().toISOString(),
    };
    const prev = best.get(key);
    if (!prev || current.score > prev.score || (current.score === prev.score && String(current.createdAt) < String(prev.createdAt))) {
      best.set(key, current);
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || String(a.createdAt).localeCompare(String(b.createdAt)));
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;
  if (basePath && pathname === basePath) {
    res.writeHead(308, { Location: `${basePath}/` });
    res.end();
    return;
  }
  if (basePath && pathname.startsWith(`${basePath}/`)) {
    pathname = pathname.slice(basePath.length) || "/";
  }
  const requestPath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^[/\\]+/, "");
  const safePath = normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const target = join(root, safePath);
  if (!target.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error("not file");
    const extension = extname(target);
    const noStore = [".html", ".css", ".js", ".json", ".webmanifest"].includes(extension) || safePath === "sw.js";
    const headers = {
      "Content-Type": types[extension] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": noStore ? "no-store" : "public, max-age=300",
    };
    if (safePath === "index.html" && basePath) {
      let html = await readFile(target, "utf8");
      html = html.replace("<body>", `<body data-base-path="${basePath}">`);
      res.writeHead(200, { ...headers, "Content-Length": Buffer.byteLength(html) });
      res.end(html);
      return;
    }
    res.writeHead(200, { ...headers, "Content-Length": info.size });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

createServer(async (req, res) => {
  try {
    const requestPath = new URL(req.url, `http://${req.headers.host}`).pathname;
    const apiPath = basePath && requestPath.startsWith(`${basePath}/api/`) ? requestPath.slice(basePath.length) : requestPath;
    if (req.method === "GET" && apiPath.startsWith("/api/leaderboard")) {
      const rows = dedupeRows(await getScores());
      await saveScores(rows);
      sendJson(res, 200, rows.slice(0, 10));
      return;
    }

    if (req.method === "POST" && apiPath.startsWith("/api/score")) {
      const body = await readJsonBody(req);
      const score = Math.max(0, Math.min(999999, Number.parseInt(body.score, 10) || 0));
      const rows = dedupeRows(await getScores());
      const name = cleanName(body.name);
      const key = nameKey(name);
      const filtered = rows.filter((row) => nameKey(row.name) !== key);
      const previous = rows.find((row) => nameKey(row.name) === key);
      if (!previous || score > Number(previous.score || 0)) {
        filtered.push({ name, score, createdAt: new Date().toISOString() });
      } else {
        filtered.push(previous);
      }
      rows.length = 0;
      rows.push(...filtered);
      rows.sort((a, b) => b.score - a.score || String(a.createdAt).localeCompare(String(b.createdAt)));
      await saveScores(rows);
      sendJson(res, 200, rows.slice(0, 10));
      return;
    }

    if (req.method === "GET") {
      await serveStatic(req, res);
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");
  } catch (error) {
    sendJson(res, 500, { error: "server_error" });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Flappy Smolevichi on http://127.0.0.1:${port}`);
});
