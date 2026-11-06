/**
 * Dual renderer: rich SVG floor plan (default) + ASCII map toggle.
 * Keeps office.assignTask / startMeeting / finishWork API intact.
 */
(function (global) {
  const ROOM_TITLE = {
    "gregs-office": "GREG'S OFFICE",
    "desk-floor": "DESK FLOOR",
    lounge: "LOUNGE",
    review: "REVIEW",
  };

  // Floor layout in SVG viewBox 1600x900
  const ROOMS = {
    "gregs-office": { x: 40, y: 40, w: 520, h: 380 },
    "desk-floor": { x: 600, y: 40, w: 960, h: 380 },
    lounge: { x: 40, y: 460, w: 760, h: 400 },
    review: { x: 840, y: 460, w: 720, h: 400 },
  };

  let lastSnap = null;
  let assetOk = {};
  let mode = "visual"; // visual | ascii
  let anim = {}; // slug -> {x,y,tx,ty,bubble,ring}
  let rafId = 0;
  let lastFrame = 0;
  let roomArt = {};
  let deskArt = null;

  function $(sel) { return document.querySelector(sel); }

  function stateColor(snap, state) {
    const p = (snap && snap.palette) || {};
    if (state === "walking") return p.accent || "#2DD4BF";
    return p[state] || p.idle || "#64748B";
  }

  function avatarPath(snap, slug) {
    const m = snap.manifest || {};
    return (m.avatars && m.avatars[slug]) || ("avatar-" + slug + ".svg");
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

  function pad(s, n) {
    s = String(s);
    if (s.length > n) return s.slice(0, n);
    return s + " ".repeat(n - s.length);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ---------- world mapping ---------- */
  function deskSlotXY(index) {
    const cols = 6;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const r = ROOMS["desk-floor"];
    const padX = 70, padY = 70;
    const cellW = (r.w - padX * 2) / cols;
    const cellH = (r.h - padY * 2) / 3;
    return {
      x: r.x + padX + col * cellW + cellW / 2,
      y: r.y + padY + row * cellH + cellH / 2,
    };
  }

  function roomSpot(room, index, total) {
    const r = ROOMS[room];
    if (!r) return { x: 800, y: 450 };
    if (room === "desk-floor") return deskSlotXY(index);
    if (room === "gregs-office") {
      return { x: r.x + r.w * 0.55, y: r.y + r.h * 0.55 };
    }
    if (room === "lounge") {
      const cx = r.x + r.w * 0.5;
      const cy = r.y + r.h * 0.55;
      const ang = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(ang) * 110, y: cy + Math.sin(ang) * 70 };
    }
    if (room === "review") {
      return { x: r.x + r.w * 0.4 + (index % 3) * 70, y: r.y + r.h * 0.5 + Math.floor(index / 3) * 50 };
    }
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  function targetForAgent(a, snap) {
    if (a.location === "walking" || a.walking) {
      // blend hallway path with destination room center for smooth walks
      const dest = a.destRoom || "desk-floor";
      const spot = roomSpot(dest, 0, 1);
      const gx = (a.x != null ? a.x : 3);
      const gy = (a.y != null ? a.y : 2);
      const hallX = 80 + gx * 140;
      const hallY = 200 + gy * 90;
      return {
        x: hallX * 0.35 + spot.x * 0.65,
        y: hallY * 0.35 + spot.y * 0.65,
      };
    }
    const bots = snap.agents.filter((x) => !x.isHuman && x.location === a.location);
    const idx = Math.max(0, bots.findIndex((x) => x.slug === a.slug));
    if (a.isHuman) return roomSpot("gregs-office", 0, 1);
    if (a.location === "desk-floor") {
      const all = snap.agents.filter((x) => !x.isHuman);
      const deskIdx = Math.max(0, all.findIndex((x) => x.slug === a.slug));
      return deskSlotXY(deskIdx);
    }
    return roomSpot(a.location, idx, bots.length || 1);
  }

  /* ---------- ASCII ---------- */
  function buildAscii(snap) {
    const byRoom = { "gregs-office": [], "desk-floor": [], lounge: [], review: [], walking: [] };
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

  /* ---------- SVG floor ---------- */
  function ensureSvgSkeleton(snap) {
    const svg = $("#office-svg");
    if (!svg || svg.dataset.ready === "1") return;
    svg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";
    function el(name, attrs) {
      const n = document.createElementNS(ns, name);
      for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
      return n;
    }
    // defs
    const defs = el("defs", {});
    defs.innerHTML = `
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="tinyGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="loungeGlowGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#A78BFA" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#A78BFA" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="hallGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#132033"/>
        <stop offset="100%" stop-color="#0B1220"/>
      </linearGradient>
    `;
    svg.appendChild(defs);

    // floor plate
    svg.appendChild(el("rect", { x: 0, y: 0, width: 1600, height: 900, fill: "#0B1220" }));
    svg.appendChild(el("rect", { x: 20, y: 20, width: 1560, height: 860, rx: 28, fill: "#101826", stroke: "#2A3548", "stroke-width": 2 }));

    // hallway cross
    svg.appendChild(el("rect", { x: 560, y: 40, width: 40, height: 820, fill: "url(#hallGrad)", opacity: "0.9" }));
    svg.appendChild(el("rect", { x: 40, y: 420, width: 1520, height: 40, fill: "url(#hallGrad)", opacity: "0.9" }));

    const roomsG = el("g", { id: "rooms-layer" });
    for (const [id, r] of Object.entries(ROOMS)) {
      const g = el("g", { "data-room": id, class: "room-group" });
      g.appendChild(el("rect", {
        x: r.x, y: r.y, width: r.w, height: r.h, rx: 18,
        class: "room-plate", fill: "#1A2332", stroke: "#2A3548", "stroke-width": 2,
      }));
      const artPath = (snap.manifest && snap.manifest.rooms && snap.manifest.rooms[id]) || null;
      if (artPath && assetOk[artPath]) {
        g.appendChild(el("image", {
          href: "assets/" + artPath,
          x: r.x + 8, y: r.y + 28, width: r.w - 16, height: r.h - 40,
          preserveAspectRatio: "xMidYMid slice", opacity: "0.92",
          class: "room-art",
        }));
      } else {
        // lightweight furniture fallbacks
        drawFallbackFurniture(g, el, id, r);
      }
      g.appendChild(el("text", {
        x: r.x + 18, y: r.y + 22, fill: "#94A3B8",
        "font-size": "14", "font-family": "system-ui,sans-serif", "font-weight": "700",
        "letter-spacing": "1.5", class: "room-label",
      })).textContent = ROOM_TITLE[id] || id;
      // lounge glow disc
      if (id === "lounge") {
        g.appendChild(el("ellipse", {
          id: "lounge-glow",
          cx: r.x + r.w * 0.5, cy: r.y + r.h * 0.55,
          rx: 180, ry: 110, fill: "url(#loungeGlowGrad)", opacity: "0",
          class: "lounge-glow",
        }));
      }
      roomsG.appendChild(g);
    }
    svg.appendChild(roomsG);

    svg.appendChild(el("g", { id: "agents-layer" }));
    svg.appendChild(el("g", { id: "bubbles-layer" }));
    svg.dataset.ready = "1";
  }

  function drawFallbackFurniture(g, el, id, r) {
    if (id === "desk-floor") {
      for (let i = 0; i < 18; i++) {
        const p = deskSlotXY(i);
        g.appendChild(el("rect", {
          x: p.x - 28, y: p.y - 16, width: 56, height: 32, rx: 4,
          fill: "#243044", stroke: "#2A3548", "stroke-width": 1, opacity: "0.85",
        }));
      }
    } else if (id === "lounge") {
      g.appendChild(el("ellipse", {
        cx: r.x + r.w * 0.5, cy: r.y + r.h * 0.55, rx: 120, ry: 50,
        fill: "#243044", stroke: "#A78BFA", "stroke-width": 2, opacity: "0.7",
      }));
    } else if (id === "gregs-office") {
      g.appendChild(el("rect", {
        x: r.x + r.w * 0.35, y: r.y + r.h * 0.4, width: 140, height: 70, rx: 8,
        fill: "#243044", stroke: "#FBBF24", "stroke-width": 2,
      }));
    } else if (id === "review") {
      g.appendChild(el("ellipse", {
        cx: r.x + r.w * 0.5, cy: r.y + r.h * 0.5, rx: 140, ry: 55,
        fill: "#243044", stroke: "#34D399", "stroke-width": 2,
      }));
    }
  }

  function syncAnimTargets(snap) {
    for (const a of snap.agents) {
      const t = targetForAgent(a, snap);
      if (!anim[a.slug]) {
        anim[a.slug] = { x: t.x, y: t.y, tx: t.x, ty: t.y };
      } else {
        anim[a.slug].tx = t.x;
        anim[a.slug].ty = t.y;
      }
    }
  }

  function renderAgentsSvg(snap) {
    const layer = document.getElementById("agents-layer");
    const bubbles = document.getElementById("bubbles-layer");
    if (!layer || !bubbles) return;
    const ns = "http://www.w3.org/2000/svg";
    const existing = new Set();

    // meeting glow
    const glow = document.getElementById("lounge-glow");
    const meeting = snap.agents.some((a) => a.state === "meeting" || (a.location === "lounge" && !a.isHuman));
    if (glow) glow.setAttribute("opacity", meeting ? "1" : "0");

    for (const a of snap.agents) {
      existing.add(a.slug);
      let g = layer.querySelector('[data-slug="' + a.slug + '"]');
      const color = stateColor(snap, a.state);
      const av = avatarPath(snap, a.slug);
      const hasAv = assetOk[av];
      const pos = anim[a.slug] || { x: 100, y: 100 };

      if (!g) {
        g = document.createElementNS(ns, "g");
        g.setAttribute("data-slug", a.slug);
        g.setAttribute("class", "agent");
        // status ring
        const ring = document.createElementNS(ns, "circle");
        ring.setAttribute("class", "status-ring");
        ring.setAttribute("r", "30");
        ring.setAttribute("fill", "none");
        ring.setAttribute("stroke-width", "3");
        ring.setAttribute("filter", "url(#tinyGlow)");
        g.appendChild(ring);
        if (hasAv) {
          const img = document.createElementNS(ns, "image");
          img.setAttribute("href", "assets/" + av);
          img.setAttribute("x", "-24");
          img.setAttribute("y", "-24");
          img.setAttribute("width", "48");
          img.setAttribute("height", "48");
          img.setAttribute("class", "agent-avatar");
          g.appendChild(img);
        } else {
          const circ = document.createElementNS(ns, "circle");
          circ.setAttribute("r", "22");
          circ.setAttribute("class", "agent-fallback");
          circ.setAttribute("stroke", "#F1F5F9");
          circ.setAttribute("stroke-width", "2");
          g.appendChild(circ);
          const tx = document.createElementNS(ns, "text");
          tx.setAttribute("text-anchor", "middle");
          tx.setAttribute("dominant-baseline", "central");
          tx.setAttribute("font-size", "11");
          tx.setAttribute("font-weight", "800");
          tx.setAttribute("fill", "#F1F5F9");
          tx.setAttribute("class", "agent-initials");
          tx.textContent = a.short.slice(0, 2);
          g.appendChild(tx);
        }
        const label = document.createElementNS(ns, "text");
        label.setAttribute("y", "40");
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "11");
        label.setAttribute("font-weight", "700");
        label.setAttribute("fill", "#E2E8F0");
        label.setAttribute("class", "agent-label");
        label.textContent = a.short;
        g.appendChild(label);
        layer.appendChild(g);
      }

      const ring = g.querySelector(".status-ring");
      if (ring) {
        ring.setAttribute("stroke", color);
        ring.setAttribute("opacity", a.state === "idle" ? "0.45" : "1");
        if (a.state === "working" || a.state === "meeting" || a.state === "review") {
          ring.classList.add("pulse");
        } else {
          ring.classList.remove("pulse");
        }
      }
      const fb = g.querySelector(".agent-fallback");
      if (fb) fb.setAttribute("fill", color);

      g.setAttribute("transform", "translate(" + pos.x.toFixed(1) + "," + pos.y.toFixed(1) + ")");
      g.dataset.state = a.state;

      // bubble
      let bub = bubbles.querySelector('[data-slug="' + a.slug + '"]');
      const text = a.deliverable || a.task;
      if (text && (a.state === "working" || a.location === "walking" || a.state === "meeting" || a.state === "review")) {
        if (!bub) {
          bub = document.createElementNS(ns, "g");
          bub.setAttribute("data-slug", a.slug);
          bub.setAttribute("class", "bubble");
          const rect = document.createElementNS(ns, "rect");
          rect.setAttribute("rx", "8");
          rect.setAttribute("class", "bubble-bg");
          rect.setAttribute("fill", "#243044");
          rect.setAttribute("stroke", color);
          rect.setAttribute("stroke-width", "1.5");
          rect.setAttribute("opacity", "0.95");
          bub.appendChild(rect);
          const tt = document.createElementNS(ns, "text");
          tt.setAttribute("class", "bubble-text");
          tt.setAttribute("fill", "#F1F5F9");
          tt.setAttribute("font-size", "11");
          tt.setAttribute("font-family", "system-ui,sans-serif");
          bub.appendChild(tt);
          bubbles.appendChild(bub);
        }
        const tt = bub.querySelector(".bubble-text");
        const short = text.length > 28 ? text.slice(0, 27) + "…" : text;
        tt.textContent = short;
        const w = Math.min(220, Math.max(60, short.length * 6.2 + 16));
        const rect = bub.querySelector(".bubble-bg");
        rect.setAttribute("x", (-w / 2).toFixed(1));
        rect.setAttribute("y", "-62");
        rect.setAttribute("width", w.toFixed(1));
        rect.setAttribute("height", "24");
        rect.setAttribute("stroke", color);
        tt.setAttribute("x", "0");
        tt.setAttribute("y", "-46");
        tt.setAttribute("text-anchor", "middle");
        bub.setAttribute("transform", "translate(" + pos.x.toFixed(1) + "," + pos.y.toFixed(1) + ")");
      } else if (bub) {
        bub.remove();
      }
    }

    // cleanup removed
    layer.querySelectorAll("[data-slug]").forEach((n) => {
      if (!existing.has(n.getAttribute("data-slug"))) n.remove();
    });
    bubbles.querySelectorAll("[data-slug]").forEach((n) => {
      if (!existing.has(n.getAttribute("data-slug"))) n.remove();
    });
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function tickAnim(ts) {
    if (document.hidden) {
      rafId = requestAnimationFrame(tickAnim);
      return;
    }
    const dt = Math.min(0.05, (ts - lastFrame) / 1000 || 0.016);
    lastFrame = ts;
    let moving = false;
    for (const a of Object.values(anim)) {
      const dx = a.tx - a.x;
      const dy = a.ty - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        // ease toward target (~smooth walk)
        const speed = Math.max(40, Math.min(220, dist * 3.2));
        const step = Math.min(dist, speed * dt);
        a.x += (dx / dist) * step;
        a.y += (dy / dist) * step;
        moving = true;
      } else {
        a.x = a.tx;
        a.y = a.ty;
      }
    }
    if (lastSnap && (moving || mode === "visual")) {
      renderAgentsSvg(lastSnap);
    }
    rafId = requestAnimationFrame(tickAnim);
  }

  /* ---------- roster / log / chrome ---------- */
  function rowHTML(a, snap, isGreg) {
    const color = stateColor(snap, a.state === "walking" ? "walking" : a.state);
    const av = avatarPath(snap, a.slug);
    const hasAv = assetOk[av];
    const img = hasAv
      ? '<img class="avatar" src="assets/' + av + '" width="48" height="48" alt="" />'
      : '<div class="avatar avatar-fallback" style="border-color:' + color + '">' + a.short.slice(0, 2) + "</div>";
    const task = a.deliverable ? ("→ " + escapeHtml(a.deliverable)) : a.task ? escapeHtml(a.task) : "—";
    return (
      '<div class="roster-row' + (isGreg ? " is-greg" : "") + '" data-slug="' + a.slug + '">' +
      '<div class="avatar-wrap" style="--ring:' + color + '">' + img + "</div>" +
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
    root.setProperty("--accent2", p.accent2 || "#FBBF24");
  }

  function setMode(next) {
    mode = next;
    const app = $("#app");
    const vis = $("#visual-stage");
    const ascii = $("#office-map");
    const btn = $("#view-toggle");
    if (app) app.classList.toggle("mode-visual", mode === "visual");
    if (app) app.classList.toggle("mode-ascii", mode === "ascii");
    if (vis) vis.hidden = mode !== "visual";
    if (ascii) ascii.hidden = mode !== "ascii";
    if (btn) btn.textContent = mode === "visual" ? "ASCII" : "Visual";
  }

  function spawnDeliveryFx(slug, deliverable) {
    const layer = $("#fx-layer");
    const pos = anim[slug];
    const greg = anim.greg;
    if (!layer || !pos || !greg) return;
    const doc = document.createElement("div");
    doc.className = "flying-doc";
    doc.textContent = "📄";
    doc.style.left = pos.x + "px";
    doc.style.top = pos.y + "px";
    layer.appendChild(doc);
    // map SVG coords roughly onto stage — use percentages via transform on overlay sized to svg
    const svg = $("#office-svg");
    const stage = $("#visual-stage");
    if (svg && stage) {
      const rect = svg.getBoundingClientRect();
      const srect = stage.getBoundingClientRect();
      const x0 = (pos.x / 1600) * rect.width + (rect.left - srect.left);
      const y0 = (pos.y / 900) * rect.height + (rect.top - srect.top);
      const x1 = (greg.x / 1600) * rect.width + (rect.left - srect.left);
      const y1 = (greg.y / 900) * rect.height + (rect.top - srect.top);
      doc.style.left = x0 + "px";
      doc.style.top = y0 + "px";
      requestAnimationFrame(() => {
        doc.style.transform = "translate(" + (x1 - x0) + "px," + (y1 - y0) + "px) scale(1.2)";
        doc.style.opacity = "0";
      });
    }
    sparkleBurst();
    setTimeout(() => doc.remove(), 900);
  }

  function sparkleBurst() {
    const layer = $("#sparkle-layer");
    if (!layer) return;
    for (let i = 0; i < 12; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      s.style.left = 50 + (Math.random() * 40 - 20) + "%";
      s.style.top = 30 + (Math.random() * 30 - 10) + "%";
      s.style.setProperty("--dx", (Math.random() * 80 - 40) + "px");
      s.style.setProperty("--dy", (Math.random() * -60 - 20) + "px");
      layer.appendChild(s);
      setTimeout(() => s.remove(), 800);
    }
  }

  function render(snap) {
    lastSnap = snap;
    applyChrome(snap);
    syncAnimTargets(snap);
    ensureSvgSkeleton(snap);
    // refresh room art if assets newly available
    refreshRoomArt(snap);
    renderAgentsSvg(snap);
    const ascii = $("#office-map");
    if (ascii) ascii.textContent = buildAscii(snap);
    renderRoster(snap);
    renderLog(snap);
    const clock = $("#clock");
    if (clock) {
      clock.textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
  }

  function refreshRoomArt(snap) {
    const svg = $("#office-svg");
    if (!svg || !snap.manifest) return;
    for (const [id, file] of Object.entries(snap.manifest.rooms || {})) {
      if (!assetOk[file]) continue;
      const g = svg.querySelector('[data-room="' + id + '"]');
      if (!g) continue;
      let img = g.querySelector("image.room-art");
      const r = ROOMS[id];
      if (!img && r) {
        const ns = "http://www.w3.org/2000/svg";
        img = document.createElementNS(ns, "image");
        img.setAttribute("class", "room-art");
        img.setAttribute("href", "assets/" + file);
        img.setAttribute("x", String(r.x + 8));
        img.setAttribute("y", String(r.y + 28));
        img.setAttribute("width", String(r.w - 16));
        img.setAttribute("height", String(r.h - 40));
        img.setAttribute("preserveAspectRatio", "xMidYMid slice");
        img.setAttribute("opacity", "0.92");
        const label = g.querySelector(".room-label");
        g.insertBefore(img, label || null);
      }
    }
  }

  async function prefetchAvatars(snap) {
    const m = snap.manifest || {};
    await Promise.all([
      ...Object.values(m.avatars || {}).map(probeAsset),
      ...Object.values(m.rooms || {}).map(probeAsset),
      probeAsset(m.desk),
    ]);
    // force rebuild skeleton with art
    const svg = $("#office-svg");
    if (svg) {
      svg.dataset.ready = "0";
      svg.innerHTML = "";
    }
    if (lastSnap) render(lastSnap);
  }

  function mount() {
    setMode("visual");
    global.office.on((evt, payload) => {
      if (evt === "ready" || evt === "change" || evt === "tick" || evt === "log" || evt === "walk" || evt === "delivered") {
        const snap = (evt === "log" || evt === "walk") ? global.office.snapshot() : payload || global.office.snapshot();
        if (evt === "ready") prefetchAvatars(snap);
        if (evt === "delivered" && payload) spawnDeliveryFx(payload.slug, payload.deliverable);
        render(typeof snap.agents !== "undefined" ? snap : global.office.snapshot());
      }
    });

    document.addEventListener("office:delivered", (e) => {
      if (e.detail && e.detail.slug) spawnDeliveryFx(e.detail.slug, e.detail.deliverable);
    });

    $("#demo-btn") && $("#demo-btn").addEventListener("click", () => global.OfficeDemo && global.OfficeDemo.run());
    $("#reset-btn") && $("#reset-btn").addEventListener("click", () => global.office.reset());
    $("#view-toggle") && $("#view-toggle").addEventListener("click", () => {
      setMode(mode === "visual" ? "ascii" : "visual");
      if (lastSnap) render(lastSnap);
    });

    document.addEventListener("office:ready", (e) => {
      const snap = e.detail;
      const botSel = $("#bot-select");
      if (!botSel) return;
      botSel.innerHTML = snap.agents.filter((a) => !a.isHuman)
        .map((a) => '<option value="' + a.slug + '">' + a.name + "</option>").join("");
      const meetA = $("#meet-a"), meetB = $("#meet-b");
      if (meetA) meetA.innerHTML = botSel.innerHTML;
      if (meetB) meetB.innerHTML = botSel.innerHTML;
    });

    $("#assign-btn") && $("#assign-btn").addEventListener("click", () => {
      global.office.assignTask($("#bot-select").value, $("#task-input").value || "Task");
    });
    $("#meet-btn") && $("#meet-btn").addEventListener("click", () => {
      global.office.startMeeting([$("#meet-a").value, $("#meet-b").value], $("#meet-topic").value || "Sync");
    });
    $("#finish-btn") && $("#finish-btn").addEventListener("click", () => {
      global.office.finishWork($("#bot-select").value, $("#task-input").value || "Deliverable");
    });

    if (!rafId) rafId = requestAnimationFrame(tickAnim);
  }

  global.OfficeRenderer = { mount, render, buildAscii, setMode };
})(window);
