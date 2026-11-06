/**
 * Text-based renderer v0 — ASCII floor map + roster panel + event log.
 */
(function (global) {
  const ROOM_TITLE = {
    "gregs-office": "GREG'S OFFICE",
    "desk-floor": "DESK FLOOR",
    lounge: "LOUNGE",
    review: "REVIEW",
  };

  let lastSnap = null;
  let assetOk = {};

  function $(sel) { return document.querySelector(sel); }

  function stateColor(snap, state) {
    const p = (snap && snap.palette) || {};
    if (state === "walking") return p.accent || "#2DD4BF";
    return p[state] || p.idle || "#64748B";
  }

  function probeAsset(rel) {
    if (!rel) return Promise.resolve(false);
    if (Object.prototype.hasOwnProperty.call(assetOk, rel)) return Promise.resolve(assetOk[rel]);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { assetOk[rel] = true; resolve(true); };
      img.onerror = () => { assetOk[rel] = false; resolve(false); };
      img.src = "./assets/" + rel;
    });
  }

  function avatarPath(snap, slug) {
    const m = snap.manifest || {};
    return (m.avatars && m.avatars[slug]) || ("avatar-" + slug + ".svg");
  }

  function pad(s, n) {
    s = String(s);
    if (s.length > n) return s.slice(0, n);
    return s + " ".repeat(n - s.length);
  }

  function buildAscii(snap) {
    const byRoom = {
      "gregs-office": [], "desk-floor": [], lounge: [], review: [], walking: [],
    };
    for (const a of snap.agents) {
      const loc = a.location || "desk-floor";
      if (!byRoom[loc]) byRoom[loc] = [];
      byRoom[loc].push(a);
    }

    function cellTags(list, width) {
      if (!list.length) return pad("(empty)", width);
      const tags = list.map((a) => {
        const mark =
          a.state === "working" ? "*" :
          a.state === "meeting" ? "@" :
          a.state === "review" ? "!" :
          (a.walking || a.state === "walking") ? "~" : " ";
        return "[" + a.short + mark + "]";
      });
      let line = tags.join(" ");
      if (line.length > width) line = line.slice(0, width - 1) + "\u2026";
      return pad(line, width);
    }

    const W = 34;
    const topL = byRoom["gregs-office"];
    const topR = byRoom["desk-floor"];
    const botL = byRoom.lounge;
    const botR = byRoom.review;
    const walk = byRoom.walking || [];

    const lines = [];
    lines.push("+" + "-".repeat(W) + "+" + "-".repeat(W) + "+");
    lines.push("|" + pad(" " + ROOM_TITLE["gregs-office"], W) + "|" + pad(" " + ROOM_TITLE["desk-floor"], W) + "|");
    lines.push("|" + pad("", W) + "|" + pad("", W) + "|");
    lines.push("|" + cellTags(topL, W) + "|" + cellTags(topR.slice(0, 6), W) + "|");
    lines.push("|" + pad("", W) + "|" + cellTags(topR.slice(6, 12), W) + "|");
    lines.push("|" + pad("", W) + "|" + cellTags(topR.slice(12, 18), W) + "|");
    lines.push("+" + "-".repeat(W) + "+" + "-".repeat(W) + "+");
    lines.push("|" + pad(" " + ROOM_TITLE.lounge, W) + "|" + pad(" " + ROOM_TITLE.review, W) + "|");
    lines.push("|" + pad("", W) + "|" + pad("", W) + "|");
    lines.push("|" + cellTags(botL, W) + "|" + cellTags(botR, W) + "|");
    lines.push("|" + pad("", W) + "|" + pad("", W) + "|");
    lines.push("+" + "-".repeat(W) + "+" + "-".repeat(W) + "+");
    if (walk.length) lines.push(" hallway: " + walk.map((a) => a.short + "~").join(" "));
    lines.push("");
    lines.push(" legend: [TAG ] idle  [TAG*] working  [TAG@] meeting  [TAG!] review  [TAG~] walking");
    return lines.join("\n");
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function rowHTML(a, snap, isGreg) {
    const color = stateColor(snap, a.state === "walking" ? "walking" : a.state);
    const av = avatarPath(snap, a.slug);
    const hasAv = assetOk[av];
    const img = hasAv
      ? '<img class="avatar" src="assets/' + av + '" width="48" height="48" alt="" />'
      : '<div class="avatar avatar-fallback" style="border-color:' + color + '">' + a.short.slice(0, 2) + "</div>";
    const task = a.deliverable ? ("\u2192 " + escapeHtml(a.deliverable)) : a.task ? escapeHtml(a.task) : "\u2014";
    return (
      '<div class="roster-row' + (isGreg ? " is-greg" : "") + '" data-slug="' + a.slug + '">' +
      img +
      '<div class="roster-meta">' +
      '<div class="roster-name">' + escapeHtml(a.name) + ' <span class="role">' + escapeHtml(a.role || "") + "</span></div>" +
      '<div class="roster-state"><i class="dot" style="background:' + color + '"></i>' +
      escapeHtml(a.state) + " · " + escapeHtml(a.location) + "</div>" +
      '<div class="roster-task">' + task + "</div>" +
      "</div></div>"
    );
  }

  function renderRoster(snap) {
    const el = $("#roster-panel");
    if (!el) return;
    const bots = snap.agents.filter((a) => !a.isHuman);
    const greg = snap.agents.find((a) => a.isHuman);
    let html = "";
    if (greg) html += rowHTML(greg, snap, true);
    for (const a of bots) html += rowHTML(a, snap, false);
    el.innerHTML = html;
  }

  function renderLog(snap) {
    const el = $("#event-log");
    if (!el) return;
    el.innerHTML = (snap.events || [])
      .map((e) => '<div class="log-line"><span class="t">' + escapeHtml(e.t) + "</span> " + escapeHtml(e.msg) + "</div>")
      .join("");
  }

  function renderMap(snap) {
    const pre = $("#office-map");
    if (pre) pre.textContent = buildAscii(snap);
  }

  function applyChrome(snap) {
    const p = snap.palette || {};
    const root = document.documentElement.style;
    root.setProperty("--bg", p.background || "#0B1220");
    root.setProperty("--floor", p.floor || "#1A2332");
    root.setProperty("--surface", p.surface || "#243044");
    root.setProperty("--text", p.text || "#F1F5F9");
    root.setProperty("--accent", p.accent || "#2DD4BF");
    root.setProperty("--idle", p.idle || "#64748B");
    root.setProperty("--working", p.working || "#F59E0B");
    root.setProperty("--meeting", p.meeting || "#A78BFA");
    root.setProperty("--review", p.review || "#34D399");
  }

  function render(snap) {
    lastSnap = snap;
    applyChrome(snap);
    renderMap(snap);
    renderRoster(snap);
    renderLog(snap);
    const clock = $("#clock");
    if (clock) {
      clock.textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
  }

  async function prefetchAvatars(snap) {
    const m = snap.manifest || {};
    await Promise.all(Object.values(m.avatars || {}).map(probeAsset));
    if (m.desk) await probeAsset(m.desk);
    for (const r of Object.values(m.rooms || {})) await probeAsset(r);
    if (lastSnap) render(lastSnap);
  }

  function mount() {
    global.office.on((evt, payload) => {
      if (evt === "ready" || evt === "change" || evt === "tick" || evt === "log") {
        const snap = evt === "log" ? global.office.snapshot() : payload || global.office.snapshot();
        if (evt === "ready") prefetchAvatars(snap);
        render(snap);
      }
    });

    const demoBtn = $("#demo-btn");
    if (demoBtn) demoBtn.addEventListener("click", () => { if (global.OfficeDemo) global.OfficeDemo.run(); });
    const resetBtn = $("#reset-btn");
    if (resetBtn) resetBtn.addEventListener("click", () => global.office.reset());

    document.addEventListener("office:ready", (e) => {
      const snap = e.detail;
      const botSel = $("#bot-select");
      if (!botSel) return;
      botSel.innerHTML = snap.agents
        .filter((a) => !a.isHuman)
        .map((a) => '<option value="' + a.slug + '">' + a.name + "</option>")
        .join("");
      const meetA = $("#meet-a");
      const meetB = $("#meet-b");
      if (meetA) meetA.innerHTML = botSel.innerHTML;
      if (meetB) meetB.innerHTML = botSel.innerHTML;
    });

    const assignBtn = $("#assign-btn");
    if (assignBtn) assignBtn.addEventListener("click", () => {
      global.office.assignTask($("#bot-select").value, $("#task-input").value || "Task");
    });
    const meetBtn = $("#meet-btn");
    if (meetBtn) meetBtn.addEventListener("click", () => {
      global.office.startMeeting([$("#meet-a").value, $("#meet-b").value], $("#meet-topic").value || "Sync");
    });
    const finishBtn = $("#finish-btn");
    if (finishBtn) finishBtn.addEventListener("click", () => {
      global.office.finishWork($("#bot-select").value, $("#task-input").value || "Deliverable");
    });
  }

  global.OfficeRenderer = { mount, render, buildAscii };
})(window);
