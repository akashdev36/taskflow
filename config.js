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
  PROXY_URL: "https://taskflow-mu-wine.vercel.app/api/notion",

  // 👇 Replace with your Notion Database ID (from DB page URL)
  DB_ID: "6fa4e7e2-10b9-45cf-a558-2f2137543ab2",
};
