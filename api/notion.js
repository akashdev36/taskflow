// ============================================================
//  api/notion.js — Vercel Serverless Function (Notion Proxy)
//
//  PURPOSE:
//    - Keeps NOTION_TOKEN secret (stored as Vercel env variable)
//    - Fixes CORS so the browser can call Notion API
//
//  This file is auto-detected by Vercel as a serverless function.
//  It handles all requests to /api/notion/*
// ============================================================

export default async function handler(req, res) {
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

  // ── CORS Headers ─────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ── Handle preflight ──────────────────────────────────────
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // ── Only allow GET / POST / PATCH ────────────────────────
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // ── Build Notion URL ──────────────────────────────────────
  //  Incoming:  /api/notion/databases/<id>/query
  //  Outgoing:  https://api.notion.com/v1/databases/<id>/query
  const notionPath = req.url.replace(/^\/api\/notion/, "");

  if (!notionPath.startsWith("/")) {
    return res.status(400).json({ message: "Invalid path" });
  }

  const notionURL = `https://api.notion.com/v1${notionPath}`;

  // ── Forward to Notion ─────────────────────────────────────
  const fetchOptions = {
    method: req.method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
  };

  if (req.method !== "GET" && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  try {
    const notionRes = await fetch(notionURL, fetchOptions);
    const data = await notionRes.json();
    return res.status(notionRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ message: "Proxy error", error: err.message });
  }
}
