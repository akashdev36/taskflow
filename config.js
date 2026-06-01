// ============================================================
//  config.js — App Configuration
//  ⚠️  NEVER put your NOTION_TOKEN here (stays in Worker env)
// ============================================================

const CONFIG = {
  // ── Set to true to test locally without Notion setup ──────
  // Switch to false after deploying to Vercel
  DEMO_MODE: false,

  // 👇 After deploying to Vercel, replace with your Vercel URL:
  //    https://YOUR_PROJECT.vercel.app/api/notion
  PROXY_URL: "https://YOUR_PROJECT.vercel.app/api/notion",

  // 👇 Replace with your Notion Database ID (from DB page URL)
  DB_ID: "YOUR_NOTION_DATABASE_ID",
};
