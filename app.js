// ============================================================
//  app.js — UI Logic (matches new dark glassmorphism UI)
// ============================================================

// ── State ────────────────────────────────────────────────────
const State = {
  selectedDate: getTodayStr(),
  tasks: [],
  loading: false,
};

// ── Helpers ──────────────────────────────────────────────────
function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}
function isToday(d) { return d === getTodayStr(); }
function isEditable(d) { return d >= getTodayStr(); }
function isMobile() { return window.innerWidth <= 520 || !window.matchMedia('(hover: hover)').matches; }
function escapeHtml(s) {
  const el = document.createElement("div");
  el.textContent = s;
  return el.innerHTML;
}

// ── Safe localStorage (works inside Notion iframe) ────────────
// Some browsers block localStorage in 3rd-party iframes —
// this wrapper falls back to an in-memory Map silently.
const _memStore = new Map();
const safeStorage = {
  getItem(k)    { try { return localStorage.getItem(k); }    catch { return _memStore.get(k) ?? null; } },
  setItem(k, v) { try { localStorage.setItem(k, v); }        catch { _memStore.set(k, v); } },
  removeItem(k) { try { localStorage.removeItem(k); }        catch { _memStore.delete(k); } },
};

// ── Date Hero ─────────────────────────────────────────────────
function updateDateHero(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const year = d.getFullYear();

  document.getElementById("hero-day").textContent = dayName;
  document.getElementById("hero-monthyear").textContent = `${monthDay}, ${year}`;
  document.getElementById("selected-date").textContent =
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Progress Ring ─────────────────────────────────────────────
function injectRingGradient() {
  // Inject SVG gradient into the ring SVG
  const svg = document.querySelector(".ring-svg");
  if (!svg.querySelector("defs")) {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#06b6d4"/>
      </linearGradient>`;
    svg.prepend(defs);
  }
}

function updateProgress() {
  const done  = State.tasks.filter(t => t.done).length;
  const total = State.tasks.length;
  const left  = total - done;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  // Ring
  const circumference = 314; // 2π × r50
  const offset = circumference - (pct / 100) * circumference;
  const ring = document.getElementById("ring-fill");
  if (ring) {
    ring.style.stroke = "url(#ringGrad)";
    ring.style.strokeDashoffset = offset;
  }
  document.getElementById("ring-pct").textContent  = `${pct}%`;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-done").textContent  = done;
  document.getElementById("stat-left").textContent  = left;
}

// ── Render Tasks ──────────────────────────────────────────────
function renderTasks() {
  const list  = document.getElementById("task-list");
  const today = isToday(State.selectedDate);
  const editable = isEditable(State.selectedDate);

  // Badge
  const badge = document.getElementById("mode-badge");
  if (today) {
    badge.textContent = "Today";
    badge.className   = "badge badge-today";
  } else if (editable) {
    badge.textContent = "Planned";
    badge.className   = "badge badge-future";
  } else {
    badge.textContent = "View Only";
    badge.className   = "badge badge-view";
  }

  // Add row
  document.getElementById("add-task-row").style.display = editable ? "flex" : "none";

  updateProgress();

  // Empty
  list.innerHTML = "";
  if (!State.tasks.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${editable ? "✦" : "📭"}</span>
        <p>${editable ? "No tasks yet — what's the plan?" : "Nothing recorded for this day."}</p>
      </div>`;
    return;
  }

  State.tasks.forEach((task, i) => {
    const li = document.createElement("li");
    const delay = isMobile() ? 0 : i * 40;
    li.className = `task-item${task.done ? " done" : ""} slide-in`;
    li.style.animationDelay = `${delay}ms`;
    li.dataset.id = task.id;

    // Checkbox — clean circle with proportional check
    const checkBox = document.createElement("div");
    checkBox.className = "check-box";
    if (!today) checkBox.setAttribute("disabled", "true");
    checkBox.innerHTML = `
      <svg class="check-icon" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"/>
      </svg>`;

    // Text
    const textSpan = document.createElement("span");
    textSpan.className = "task-text";
    textSpan.textContent = task.text;

    li.append(checkBox, textSpan);

    // Delete — minimal × icon, not a trash can
    if (editable) {
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.title = "Remove";
      delBtn.setAttribute("aria-label", "Remove task");
      delBtn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      delBtn.addEventListener("click", () => handleDelete(task, li));
      li.append(delBtn);
    }

    // Toggle on checkbox click ONLY on today's date
    if (today) {
      checkBox.addEventListener("click", () => handleToggle(task, li, checkBox));
    }

    list.appendChild(li);
  });
}

// ── Toggle ────────────────────────────────────────────────────
async function handleToggle(task, li, checkBox) {
  const newDone = !task.done;
  task.done = newDone;
  li.classList.toggle("done", newDone);
  updateProgress();
  showToast(newDone ? "✅ Marked done!" : "↩️ Marked undone");
  try {
    await API.updateTask(task.id, newDone);
  } catch {
    task.done = !newDone;
    li.classList.toggle("done", !newDone);
    updateProgress();
    showToast("❌ Failed to update", "error");
  }
}

// ── Delete ────────────────────────────────────────────────────
async function handleDelete(task, li) {
  li.classList.add("removing");
  await new Promise(r => setTimeout(r, 280));
  const idx = State.tasks.findIndex(t => t.id === task.id);
  if (idx !== -1) State.tasks.splice(idx, 1);
  renderTasks();
  showToast("🗑 Task deleted");
  try {
    await API.deleteTask(task.id);
  } catch {
    State.tasks.splice(idx, 0, task);
    renderTasks();
    showToast("❌ Failed to delete", "error");
  }
}

// ── Add Task ──────────────────────────────────────────────────
async function addTask() {
  const input = document.getElementById("new-task-input");
  const btn   = document.getElementById("add-task-btn");
  const text  = input.value.trim();

  if (!text) {
    input.classList.add("shake");
    setTimeout(() => input.classList.remove("shake"), 400);
    return;
  }

  input.disabled = true;
  btn.disabled   = true;

  try {
    const newTask = await API.saveTask(State.selectedDate, text);
    State.tasks.push(newTask);
    input.value = "";
    renderTasks();
    showToast("✅ Task added!");
  } catch {
    showToast("❌ Failed to save task", "error");
  } finally {
    input.disabled = false;
    btn.disabled   = false;
    // Don't auto-focus on mobile — avoids unwanted keyboard pop-up
    if (!isMobile()) input.focus();
  }
}

// ── Load Tasks ────────────────────────────────────────────────
async function loadTasks(date) {
  if (State.loading) return;
  State.loading = true;
  State.selectedDate = date;

  updateDateHero(date);

  document.getElementById("task-list").innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading tasks…</p>
    </div>`;
  document.getElementById("add-task-row").style.display = "none";

  try {
    const res = await API.getTasks(date);
    State.tasks = res.tasks;
    renderTasks();
    loadNotes(date, res.dailyLog);
    loadPhoto(date);
    loadSleep(date, res.dailyLog);
  } catch (err) {
    document.getElementById("task-list").innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <p>Failed to load tasks</p>
        <p class="error-detail">${escapeHtml(err.message)}</p>
        <button class="retry-btn" onclick="loadTasks('${date}')">Retry</button>
      </div>`;
    loadNotes(date, null);
    loadPhoto(date);
    loadSleep(date, null);
  } finally {
    State.loading = false;
  }
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = `toast${type === "error" ? " toast-error" : ""}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("toast-show"));
  setTimeout(() => {
    t.classList.remove("toast-show");
    setTimeout(() => t.remove(), 300);
  }, 2400);
}

// ── Custom Premium Calendar ───────────────────────────────────
const CalState = {
  currentMonth: new Date().getMonth(), // 0-11
  currentYear: new Date().getFullYear(),
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function initDatePicker() {
  const btn = document.getElementById("date-btn");
  const modal = document.getElementById("calendar-modal");
  const backdrop = document.getElementById("calendar-backdrop");
  const closeBtn = document.getElementById("cal-close-btn");
  const todayBtn = document.getElementById("cal-today-btn");
  const prevBtn = document.getElementById("cal-prev-btn");
  const nextBtn = document.getElementById("cal-next-btn");

  // Open modal
  btn.addEventListener("click", () => {
    const d = new Date(State.selectedDate + "T00:00:00");
    CalState.currentMonth = d.getMonth();
    CalState.currentYear = d.getFullYear();
    renderCalendar();
    modal.style.display = "flex";
  });

  // Close modal
  const closeModal = () => { modal.style.display = "none"; };
  backdrop.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  // Navigate months
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    CalState.currentMonth--;
    if (CalState.currentMonth < 0) {
      CalState.currentMonth = 11;
      CalState.currentYear--;
    }
    renderCalendar();
  });

  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    CalState.currentMonth++;
    if (CalState.currentMonth > 11) {
      CalState.currentMonth = 0;
      CalState.currentYear++;
    }
    renderCalendar();
  });

  // Today button inside calendar
  todayBtn.addEventListener("click", () => {
    loadTasks(getTodayStr());
    closeModal();
  });

  // Also wire the original Today button in top-bar
  document.getElementById("today-btn").addEventListener("click", () => loadTasks(getTodayStr()));
}

function renderCalendar() {
  const monthYearLabel = document.getElementById("cal-month-year");
  const daysGrid = document.getElementById("calendar-days");
  
  monthYearLabel.textContent = `${MONTH_NAMES[CalState.currentMonth]} ${CalState.currentYear}`;
  daysGrid.innerHTML = "";

  // Get first day of month (0 = Sunday, ..., 6 = Saturday)
  const firstDayIndex = new Date(CalState.currentYear, CalState.currentMonth, 1).getDay();
  // Get total days in month
  const totalDays = new Date(CalState.currentYear, CalState.currentMonth + 1, 0).getDate();

  // Populate empty prefix cells
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "cal-day-cell empty";
    daysGrid.appendChild(emptyCell);
  }

  const todayStr = getTodayStr();
  const todayDate = new Date(todayStr + "T00:00:00");
  
  // Populate days of the month
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("div");
    cell.className = "cal-day-cell";
    cell.textContent = day;

    const mm = String(CalState.currentMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const cellDateStr = `${CalState.currentYear}-${mm}-${dd}`;

    if (cellDateStr === State.selectedDate) {
      cell.classList.add("selected");
    }
    if (cellDateStr === todayStr) {
      cell.classList.add("today");
    }

    cell.addEventListener("click", () => {
      loadTasks(cellDateStr);
      document.getElementById("calendar-modal").style.display = "none";
    });

    daysGrid.appendChild(cell);
  }
}

// ── Keyboard ──────────────────────────────────────────────────
function initKeyboard() {
  document.getElementById("new-task-input").addEventListener("keydown", e => {
    if (e.key === "Enter") addTask();
  });
  document.getElementById("add-task-btn").addEventListener("click", addTask);
}

// ── Photo Upload ──────────────────────────────────────────────
const MAX_RAW_BYTES  = 5 * 1024 * 1024;   // 5 MB — compress above this
const TARGET_BYTES   = 300 * 1024;         // target ≤ 300 KB stored
const MAX_DIMENSION  = 1600;               // max px on longest side

function photoKey(date) { return `taskflow-photo-${date}`; }
function photoMetaKey(date) { return `taskflow-photo-meta-${date}`; }

// ── Canvas compression ────────────────────────────────────────
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");

      // Scale down if needed
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) { height = Math.round(height * MAX_DIMENSION / width); width = MAX_DIMENSION; }
        else                { width = Math.round(width * MAX_DIMENSION / height);  height = MAX_DIMENSION; }
      }
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      // Try quality levels until under TARGET_BYTES
      const qualities = [0.85, 0.72, 0.60, 0.48, 0.36];
      let dataURL = "";
      for (const q of qualities) {
        dataURL = canvas.toDataURL("image/jpeg", q);
        const approxBytes = Math.round(dataURL.length * 0.75);
        if (approxBytes <= TARGET_BYTES) break;
      }
      resolve({ dataURL, width, height });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ── Show / Hide photo UI states ───────────────────────────────
function showPhotoDropzone()  {
  document.getElementById("photo-dropzone").style.display    = "block";
  document.getElementById("photo-preview").style.display     = "none";
  document.getElementById("photo-no-image-past").style.display = "none";
}
function showPhotoPreview(dataURL, meta) {
  document.getElementById("photo-dropzone").style.display    = "none";
  document.getElementById("photo-preview").style.display     = "block";
  document.getElementById("photo-no-image-past").style.display = "none";
  document.getElementById("photo-img").src = dataURL;
  document.getElementById("photo-meta").textContent = meta || "";
}
function showPhotoNone() {
  document.getElementById("photo-dropzone").style.display    = "none";
  document.getElementById("photo-preview").style.display     = "none";
  document.getElementById("photo-no-image-past").style.display = "block";
}

// ── Process file (validate → compress → store → display) ──────
async function processPhotoFile(file, date) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("⚠️ Please select an image file", "error"); return;
  }

  const zone      = document.getElementById("photo-dropzone");
  const statusEl  = document.getElementById("photo-status");

  // Show compression overlay
  zone.classList.add("compressing");
  const overlay = document.createElement("div");
  overlay.className = "compress-msg";
  const needsCompress = file.size > MAX_RAW_BYTES;
  overlay.innerHTML  = `<div class="spinner"></div><span>${needsCompress ? "Compressing…" : "Processing…"}</span>`;
  zone.appendChild(overlay);

  statusEl.textContent = needsCompress ? "⚙️ Compressing…" : "⚙️ Processing…";
  statusEl.classList.add("visible");

  try {
    const { dataURL, width, height } = await compressImage(file);
    const storedBytes = Math.round(dataURL.length * 0.75);
    const meta = `${width} × ${height} · ${formatBytes(storedBytes)}`;

    safeStorage.setItem(photoKey(date), dataURL);
    safeStorage.setItem(photoMetaKey(date), meta);

    showPhotoPreview(dataURL, meta);
    statusEl.textContent = "✓ Saved";
    setTimeout(() => statusEl.classList.remove("visible"), 2000);
    showToast(needsCompress ? "🗜 Compressed & saved!" : "📷 Photo saved!");
  } catch {
    showToast("❌ Failed to process image", "error");
    statusEl.classList.remove("visible");
    showPhotoDropzone();
  } finally {
    zone.classList.remove("compressing");
    overlay.remove();
  }
}

// ── Load photo for date ───────────────────────────────────────
function loadPhoto(date) {
  const editable = isEditable(date);
  const dataURL  = safeStorage.getItem(photoKey(date));
  const meta     = safeStorage.getItem(photoMetaKey(date)) || "";
  const removeBtn = document.getElementById("photo-remove-btn");
  const statusEl  = document.getElementById("photo-status");

  statusEl.textContent = "";
  statusEl.classList.remove("visible");

  if (dataURL) {
    showPhotoPreview(dataURL, meta);
    removeBtn.style.display = editable ? "flex" : "none";
  } else if (editable) {
    showPhotoDropzone();
  } else {
    showPhotoNone();
  }
}

// ── Init Photo ────────────────────────────────────────────────
function initPhoto() {
  const dropzone  = document.getElementById("photo-dropzone");
  const fileInput = document.getElementById("photo-input");
  const browseBtn = document.getElementById("photo-browse-btn");
  const removeBtn = document.getElementById("photo-remove-btn");

  // Browse click
  browseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // Dropzone click (anywhere except browse button)
  dropzone.addEventListener("click", () => fileInput.click());

  // File selected via input
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) processPhotoFile(fileInput.files[0], State.selectedDate);
    fileInput.value = ""; // reset so same file can be re-selected
  });

  // Drag & Drop
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) processPhotoFile(file, State.selectedDate);
  });

  // Remove photo
  removeBtn.addEventListener("click", () => {
    safeStorage.removeItem(photoKey(State.selectedDate));
    safeStorage.removeItem(photoMetaKey(State.selectedDate));
    showPhotoDropzone();
    showToast("🗑 Photo removed");
  });

  // Drag events — passive for scroll perf
  dropzone.addEventListener("dragover",  (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); }, { passive: false });
  dropzone.addEventListener("dragleave", ()  => dropzone.classList.remove("drag-over"), { passive: true });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) processPhotoFile(file, State.selectedDate);
  }, { passive: false });
}

// ── Sleep Tracker ─────────────────────────────────────────────
function sleepKey(date) { return `taskflow-sleep-${date}`; }
function wakeKey(date) { return `taskflow-wake-${date}`; }

function initSleep() {
  const sleepInput = document.getElementById("sleep-time-input");
  const wakeInput  = document.getElementById("wake-time-input");
  const saveStatus = document.getElementById("sleep-save-status");

  async function saveValue(field, value) {
    if (!isEditable(State.selectedDate)) return;
    
    saveStatus.textContent = "Saving…";
    saveStatus.classList.add("visible");
    
    const key = field === "bedtime" ? sleepKey(State.selectedDate) : wakeKey(State.selectedDate);
    safeStorage.setItem(key, value);
    updateSleepCalculation();
    
    try {
      await API.saveDailyLog(State.selectedDate, { [field]: value });
      saveStatus.textContent = "✓ Saved to Notion";
    } catch (err) {
      console.error(err);
      saveStatus.textContent = "✓ Saved (Local)";
    }
    
    setTimeout(() => {
      saveStatus.classList.remove("visible");
    }, 1800);
  }

  sleepInput.addEventListener("change", () => {
    saveValue("bedtime", sleepInput.value);
  });

  wakeInput.addEventListener("change", () => {
    saveValue("wakeup", wakeInput.value);
  });
}

function loadSleep(date, dailyLog) {
  const sleepInput = document.getElementById("sleep-time-input");
  const wakeInput  = document.getElementById("wake-time-input");
  const editable   = isEditable(date);

  const savedSleep = (dailyLog && dailyLog.bedtime) || safeStorage.getItem(sleepKey(date)) || "";
  const savedWake  = (dailyLog && dailyLog.wakeup) || safeStorage.getItem(wakeKey(date)) || "";

  if (savedSleep) safeStorage.setItem(sleepKey(date), savedSleep);
  if (savedWake) safeStorage.setItem(wakeKey(date), savedWake);

  sleepInput.value = savedSleep;
  wakeInput.value  = savedWake;

  sleepInput.disabled = !editable;
  wakeInput.disabled  = !editable;

  updateSleepCalculation();
}

function updateSleepCalculation() {
  const sleepInput = document.getElementById("sleep-time-input");
  const wakeInput  = document.getElementById("wake-time-input");
  const hoursVal   = document.getElementById("sleep-hours-val");
  const card       = document.getElementById("sleep-duration-card");
  const hint       = document.getElementById("sleep-suggestion");

  const sleepTime = sleepInput.value;
  const wakeTime  = wakeInput.value;

  if (!sleepTime || !wakeTime) {
    hoursVal.textContent = "—";
    card.className = "sleep-duration-card";
    hint.textContent = "Enter bedtime & wake up";
    return;
  }

  const [sH, sM] = sleepTime.split(":").map(Number);
  const [wH, wM] = wakeTime.split(":").map(Number);

  let sleepMin = sH * 60 + sM;
  let wakeMin  = wH * 60 + wM;

  let diffMin = wakeMin - sleepMin;
  if (diffMin < 0) {
    diffMin += 24 * 60; // sleep across midnight
  }

  const hours = diffMin / 60;
  hoursVal.textContent = hours.toFixed(1);

  if (hours >= 7 && hours <= 9) {
    card.className = "sleep-duration-card optimal";
    hint.textContent = "Optimal rest today ✨";
  } else if (hours < 6 || hours > 10) {
    card.className = "sleep-duration-card suboptimal";
    hint.textContent = hours < 6 ? "Rest is too short ☕" : "Slept a bit long 🛌";
  } else {
    card.className = "sleep-duration-card";
    hint.textContent = "Moderate rest session 👍";
  }
}

// ── Notes ─────────────────────────────────────────────────────
let _notesSaveTimer = null;

function notesKey(date) {
  return `taskflow-notes-${date}`;
}

function initNotes() {
  // nothing to set up globally — called per date load
}

function loadNotes(date, dailyLog) {
  const textarea   = document.getElementById("notes-textarea");
  const charCount  = document.getElementById("notes-char-count");
  const roLabel    = document.getElementById("notes-readonly-label");
  const saveStatus = document.getElementById("notes-save-status");
  const editable   = isEditable(date);

  const saved = (dailyLog && dailyLog.notes) || safeStorage.getItem(notesKey(date)) || "";
  if (saved) safeStorage.setItem(notesKey(date), saved);

  textarea.value = saved;
  updateCharCount(saved.length, charCount);

  // Read-only for past dates
  textarea.disabled = !editable;
  roLabel.style.display   = editable ? "none"  : "inline";
  saveStatus.textContent  = "";
  saveStatus.classList.remove("visible");

  // Remove previous listener by replacing the element
  const fresh = textarea.cloneNode(true);
  textarea.parentNode.replaceChild(fresh, textarea);

  if (editable) {
    fresh.addEventListener("input", () => {
      updateCharCount(fresh.value.length, charCount);
      saveStatus.textContent = "Saving…";
      saveStatus.classList.add("visible");

      clearTimeout(_notesSaveTimer);
      _notesSaveTimer = setTimeout(async () => {
        safeStorage.setItem(notesKey(date), fresh.value);
        
        try {
          await API.saveDailyLog(date, { notes: fresh.value });
          saveStatus.textContent = "✓ Saved to Notion";
        } catch (err) {
          console.error(err);
          saveStatus.textContent = "✓ Saved (Local)";
        }
        
        setTimeout(() => saveStatus.classList.remove("visible"), 1800);
      }, 700);
    });
  }
}

function updateCharCount(len, el) {
  el.textContent = `${len} / 2000`;
  el.classList.remove("near-limit", "at-limit");
  if (len >= 2000)       el.classList.add("at-limit");
  else if (len >= 1600)  el.classList.add("near-limit");
}

// ── Theme Toggle ──────────────────────────────────────────────
function initTheme() {
  const btn      = document.getElementById("theme-btn");
  const iconMoon = document.getElementById("theme-icon-moon");
  const iconSun  = document.getElementById("theme-icon-sun");
  const saved = safeStorage.getItem("taskflow-theme") || "dark";

  function applyTheme(theme) {
    if (theme === "light") {
      document.body.classList.add("light");
      iconMoon.style.display = "none";
      iconSun.style.display  = "block";
    } else {
      document.body.classList.remove("light");
      iconMoon.style.display = "block";
      iconSun.style.display  = "none";
    }
    safeStorage.setItem("taskflow-theme", theme);
  }

  applyTheme(saved);

  btn.addEventListener("click", () => {
    const isLight = document.body.classList.contains("light");
    applyTheme(isLight ? "dark" : "light");
  });
}

// ── Init ──────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  injectRingGradient();
  initTheme();
  initPhoto();
  initSleep();

  if (CONFIG.DEMO_MODE) {
    document.getElementById("demo-banner").style.display = "block";
  }

  initDatePicker();
  initKeyboard();
  loadTasks(getTodayStr());
});
