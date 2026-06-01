// ============================================================
//  notion.js — Notion API Abstraction Layer
//
//  When CONFIG.DEMO_MODE = true  → uses in-memory mock data
//  When CONFIG.DEMO_MODE = false → calls real Notion via proxy
// ============================================================

const API = (() => {

  // ── MOCK DATA STORE ─────────────────────────────────────
  //  Simulates a Notion database in memory.
  //  Pre-seeded with sample tasks for today and yesterday.
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];

  let mockDB = [
    { id: "mock-1", text: "Review project plan",      done: true,  date: today },
    { id: "mock-2", text: "Fix CSS animation bug",    done: false, date: today },
    { id: "mock-3", text: "Write unit tests",         done: false, date: today },
    { id: "mock-4", text: "Send weekly report email", done: false, date: today },
    { id: "mock-5", text: "Team standup meeting",     done: true,  date: yesterday },
    { id: "mock-6", text: "Code review for PR #42",   done: false, date: yesterday },
    { id: "mock-7", text: "Update documentation",     done: true,  date: twoDaysAgo },
  ];

  function mockId() {
    return "mock-" + Math.random().toString(36).slice(2, 9);
  }

  // ── MOCK API FUNCTIONS ──────────────────────────────────

  async function mockGetTasks(date) {
    await delay(450); // simulate network latency
    const tasks = mockDB.filter((t) => t.date === date && t.text !== "__DAILY_LOG__" && !t._deleted);
    const log = mockDB.find((t) => t.date === date && t.text === "__DAILY_LOG__");
    const dailyLog = log ? {
      notes: log.notes || "",
      bedtime: log.bedtime || "",
      wakeup: log.wakeup || "",
    } : { notes: "", bedtime: "", wakeup: "" };
    return { tasks, dailyLog };
  }

  async function mockSaveTask(date, text) {
    await delay(350);
    const newTask = { id: mockId(), text, done: false, date };
    mockDB.push(newTask);
    return newTask;
  }

  async function mockUpdateTask(id, done) {
    await delay(200);
    const task = mockDB.find((t) => t.id === id);
    if (task) task.done = done;
  }

  async function mockDeleteTask(id) {
    await delay(200);
    const task = mockDB.find((t) => t.id === id);
    if (task) task._deleted = true;
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── REAL API FUNCTIONS ──────────────────────────────────

  async function request(path, method = "GET", body = null) {
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${CONFIG.PROXY_URL}${path}`, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API error ${res.status}`);
    }
    return res.json();
  }

  async function getTasks(date) {
    if (CONFIG.DEMO_MODE) return mockGetTasks(date);

    const data = await request(
      `/databases/${CONFIG.DB_ID}/query`,
      "POST",
      {
        filter: {
          property: "Date",
          date: { equals: date },
        },
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
      }
    );

    const tasks = [];
    let dailyLog = { notes: "", bedtime: "", wakeup: "" };

    for (const page of data.results) {
      const title = page.properties.Task.title[0]?.plain_text ?? "";
      if (title === "__DAILY_LOG__") {
        dailyLog = {
          notes: page.properties.Notes?.rich_text[0]?.plain_text ?? "",
          bedtime: page.properties.Bedtime?.rich_text[0]?.plain_text ?? "",
          wakeup: page.properties.WakeUp?.rich_text[0]?.plain_text ?? "",
        };
      } else {
        tasks.push({
          id: page.id,
          text: title,
          done: page.properties.Done.checkbox,
          date: page.properties.Date.date?.start ?? date,
        });
      }
    }

    return { tasks, dailyLog };
  }

  async function saveTask(date, text) {
    if (CONFIG.DEMO_MODE) return mockSaveTask(date, text);

    const data = await request("/pages", "POST", {
      parent: { database_id: CONFIG.DB_ID },
      properties: {
        Task: { title: [{ text: { content: text } }] },
        Date: { date: { start: date } },
        Done: { checkbox: false },
      },
    });

    return { id: data.id, text, done: false, date };
  }

  async function updateTask(id, done) {
    if (CONFIG.DEMO_MODE) return mockUpdateTask(id, done);

    await request(`/pages/${id}`, "PATCH", {
      properties: { Done: { checkbox: done } },
    });
  }

  async function deleteTask(id) {
    if (CONFIG.DEMO_MODE) return mockDeleteTask(id);

    await request(`/pages/${id}`, "PATCH", { archived: true });
  }

  async function saveDailyLog(date, fields) {
    if (CONFIG.DEMO_MODE) {
      await delay(200);
      let log = mockDB.find((t) => t.date === date && t.text === "__DAILY_LOG__");
      if (!log) {
        log = { id: mockId(), text: "__DAILY_LOG__", date, notes: "", bedtime: "", wakeup: "" };
        mockDB.push(log);
      }
      if (fields.notes !== undefined) log.notes = fields.notes;
      if (fields.bedtime !== undefined) log.bedtime = fields.bedtime;
      if (fields.wakeup !== undefined) log.wakeup = fields.wakeup;
      return log;
    }

    // 1. Query for the existing __DAILY_LOG__ page for this date
    const data = await request(`/databases/${CONFIG.DB_ID}/query`, "POST", {
      filter: {
        and: [
          { property: "Date", date: { equals: date } },
          { property: "Task", title: { equals: "__DAILY_LOG__" } }
        ]
      }
    });

    const existingPage = data.results[0];

    const properties = {};
    if (fields.notes !== undefined) {
      properties.Notes = { rich_text: [{ text: { content: fields.notes } }] };
    }
    if (fields.bedtime !== undefined) {
      properties.Bedtime = { rich_text: [{ text: { content: fields.bedtime } }] };
    }
    if (fields.wakeup !== undefined) {
      properties.WakeUp = { rich_text: [{ text: { content: fields.wakeup } }] };
    }

    if (existingPage) {
      await request(`/pages/${existingPage.id}`, "PATCH", { properties });
    } else {
      properties.Task = { title: [{ text: { content: "__DAILY_LOG__" } }] };
      properties.Date = { date: { start: date } };
      properties.Done = { checkbox: false };
      await request("/pages", "POST", {
        parent: { database_id: CONFIG.DB_ID },
        properties
      });
    }
  }

  return { getTasks, saveTask, updateTask, deleteTask, saveDailyLog };
})();
