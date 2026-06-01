// ============================================================
//  config.js — App Configuration
//  ⚠️  NEVER put your NOTION_TOKEN here (stays in Worker env)
// ============================================================

const CONFIG = {
  // ── Set to true to test locally without Notion setup ──────
  DEMO_MODE: true,

  // 👇 Replace with your deployed Cloudflare Worker URL
  PROXY_URL: "https://YOUR_WORKER.workers.dev/notion",

  // 👇 Replace with your Notion Database ID (from DB page URL)
  DB_ID: "YOUR_NOTION_DATABASE_ID",
};
