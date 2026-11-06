/**
 * Virtual Office v0 — model + public API
 * window.office.assignTask / startMeeting / finishWork / reset / runDemo
 */
(function (global) {
  const TICK_MS = 500;
  const WALK_STEPS = 4;

  const ROOM_ANCHORS = {
    "gregs-office": { x: 1, y: 1 },
    "desk-floor": { x: 6, y: 1 },
    lounge: { x: 1, y: 4 },
    review: { x: 6, y: 4 },
  };

  const DEFAULT_PALETTE = {
    idle: "#64748B",
    working: "#F59E0B",
    meeting: "#A78BFA",
    review: "#34D399",
    background: "#0B1220",
    floor: "#1A2332",
    walls: "#2A3548",
    surface: "#243044",
    accent: "#2DD4BF",
    accent2: "#FBBF24",
    text: "#F1F5F9",
  };

  let roster = null;
  let manifest = null;
  let agents = {};
  let eventLog = [];
  let tickTimer = null;
  let listeners = [];
  let deskSlots = {};

  function nowLabel() {
    const d = new Date();
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  function log(msg) {
    eventLog.unshift({ t: nowLabel(), msg });
    if (eventLog.length > 15) eventLog.length = 15;
    emit("log", { msg });
  }

  function emit(evt, payload) {
    for (const fn of listeners) {
      try { fn(evt, payload); } catch (e) {}
    }
    document.dispatchEvent(new CustomEvent("office:" + evt, { detail: payload }));
  }

  function resolveKey(botOrSlug) {
    if (!botOrSlug) return null;
    const s = String(botOrSlug).toLowerCase().trim();
    if (agents[s]) return s;
    for (const [slug, a] of Object.entries(agents)) {
      if (a.isHuman) continue;
      if (
        slug === s ||
        a.id === botOrSlug ||
        a.short.toLowerCase() === s ||
        a.name.toLowerCase() === s ||
        a.name.toLowerCase().startsWith(s) ||
        slug.startsWith(s) ||
        slug.split("-")[0] === s
      ) {
        return slug;
      }
    }
    return null;
  }

  function pathBetween(from, to) {
    const pts = [];
    let x = from.x;
    let y = from.y;
    const midY = from.y === to.y ? from.y : 2;
    while (y !== midY) {
      y += y < midY ? 1 : -1;
      pts.push({ x, y });
    }
    while (x !== to.x) {
      x += x < to.x ? 1 : -1;
      pts.push({ x, y });
    }
    while (y !== to.y) {
      y += y < to.y ? 1 : -1;
      pts.push({ x, y });
    }
    if (!pts.length) pts.push({ x: to.x, y: to.y });
    if (pts.length > WALK_STEPS) {
      const out = [];
      for (let i = 1; i <= WALK_STEPS; i++) {
        const idx = Math.round((i / WALK_STEPS) * (pts.length - 1));
        out.push(pts[idx]);
      }
      return out;
    }
    while (pts.length < WALK_STEPS) pts.push({ x: to.x, y: to.y });
    return pts;
  }

  function startWalk(slug, destRoom, destXY, arriveState, onArrive) {
    const a = agents[slug];
    if (!a || a.isHuman) return;
    const from = { x: a.x, y: a.y };
    const to = destXY || ROOM_ANCHORS[destRoom] || { x: 3, y: 2 };
    a.path = pathBetween(from, to);
    a.pathIndex = 0;
    a.walking = true;
    a.destRoom = destRoom;
    a.arriveState = arriveState;
    a._onArrive = onArrive || null;
    a.location = "walking";
    emit("walk", { slug, destRoom });
  }

  function seatOnDeskFloor(slug, index) {
    const col = index % 6;
    const row = Math.floor(index / 6);
    return { x: 4 + col, y: 0 + row };
  }

  function loungeSeat(i) {
    return { x: 0 + (i % 3), y: 3 + Math.floor(i / 3) };
  }

  function reviewSeat(i) {
    return { x: 5 + (i % 3), y: 3 + Math.floor(i / 3) };
  }

  function officeSeat() {
    return { x: 1, y: 1 };
  }

  function tick() {
    let moved = false;
    for (const a of Object.values(agents)) {
      if (!a.walking || !a.path || !a.path.length) continue;
      const step = a.path[a.pathIndex];
      if (step) {
        a.x = step.x;
        a.y = step.y;
        a.pathIndex += 1;
        moved = true;
      }
      if (a.pathIndex >= a.path.length) {
        a.walking = false;
        a.path = null;
        a.location = a.destRoom;
        a.state = a.arriveState || a.state;
        const cb = a._onArrive;
        a._onArrive = null;
        if (cb) {
          try { cb(a); } catch (e) { console.error(e); }
        }
        moved = true;
      }
    }
    if (moved) emit("tick", snapshot());
  }

  function snapshot() {
    return {
      agents: Object.values(agents).map((a) => ({
        slug: a.slug,
        id: a.id,
        name: a.name,
        short: a.short,
        role: a.role,
        isHuman: !!a.isHuman,
        state: a.walking ? "walking" : a.state,
        location: a.walking ? "walking" : a.location,
        destRoom: a.destRoom || null,
        task: a.task || "",
        deliverable: a.deliverable || "",
        x: a.x,
        y: a.y,
        walking: !!a.walking,
      })),
      events: eventLog.slice(),
      palette: (manifest && manifest.palette) || DEFAULT_PALETTE,
      manifest: manifest,
      rooms: (roster && roster.rooms) || [],
    };
  }

  function assignTask(bot, task) {
    const slug = resolveKey(bot);
    if (!slug) { log("assignTask failed: unknown bot " + bot); return false; }
    const a = agents[slug];
    if (a.isHuman) return false;
    a.task = String(task || "Untitled task");
    a.deliverable = "";
    const desk = deskSlots[slug] || ROOM_ANCHORS["desk-floor"];
    log(a.short + " assigned → " + a.task);
    startWalk(slug, "desk-floor", desk, "working", () => {
      a.state = "working";
      a.location = "desk-floor";
      a.x = desk.x;
      a.y = desk.y;
      log(a.short + " at desk · working");
      emit("change", snapshot());
    });
    emit("change", snapshot());
    return true;
  }

  function startMeeting(bots, topic) {
    const list = Array.isArray(bots) ? bots : [bots];
    const slugs = list.map(resolveKey).filter(Boolean);
    if (!slugs.length) { log("startMeeting failed: no bots"); return false; }
    const topicStr = String(topic || "Sync");
    log("Meeting: " + topicStr + " (" + slugs.map((s) => agents[s].short).join(", ") + ")");
    slugs.forEach((slug, i) => {
      const a = agents[slug];
      a.task = topicStr;
      const seat = loungeSeat(i);
      startWalk(slug, "lounge", seat, "meeting", () => {
        a.state = "meeting";
        a.location = "lounge";
        a.x = seat.x;
        a.y = seat.y;
        log(a.short + " in lounge");
        emit("change", snapshot());
      });
    });
    emit("change", snapshot());
    return true;
  }

  function finishWork(bot, deliverable) {
    const slug = resolveKey(bot);
    if (!slug) { log("finishWork failed: unknown bot " + bot); return false; }
    const a = agents[slug];
    if (a.isHuman) return false;
    const del = String(deliverable || a.task || "Deliverable");
    a.deliverable = del;
    log(a.short + " finished → " + del);
    const rSeat = reviewSeat(0);
    startWalk(slug, "review", rSeat, "review", () => {
      a.state = "review";
      a.location = "review";
      a.x = rSeat.x;
      a.y = rSeat.y;
      log(a.short + " in Review");
      emit("change", snapshot());
      const gSeat = officeSeat();
      startWalk(slug, "gregs-office", gSeat, "review", () => {
        log(a.short + " handed to Greg: " + del);
        emit("delivered", { slug, deliverable: del });
        emit("change", snapshot());
        const desk = deskSlots[slug] || ROOM_ANCHORS["desk-floor"];
        startWalk(slug, "desk-floor", desk, "idle", () => {
          a.state = "idle";
          a.location = "desk-floor";
          a.task = "";
          a.deliverable = "";
          a.x = desk.x;
          a.y = desk.y;
          log(a.short + " back at desk · idle");
          emit("change", snapshot());
        });
      });
    });
    emit("change", snapshot());
    return true;
  }

  function reset() {
    if (roster) initAgents(roster);
    log("Office reset");
    emit("change", snapshot());
  }

  function initAgents(data) {
    agents = {};
    deskSlots = {};
    const owner = data.owner;
    agents.greg = {
      slug: "greg",
      id: owner.id || "greg",
      name: owner.name,
      short: owner.short || "GREG",
      role: owner.role || "Owner",
      isHuman: true,
      state: "idle",
      location: "gregs-office",
      task: "",
      deliverable: "",
      x: 1,
      y: 1,
      walking: false,
    };
    data.bots.forEach((b, i) => {
      const seat = seatOnDeskFloor(b.slug, i);
      deskSlots[b.slug] = seat;
      agents[b.slug] = {
        slug: b.slug,
        id: b.id,
        name: b.name,
        short: b.short || b.name.slice(0, 5).toUpperCase(),
        role: b.role || "",
        isHuman: false,
        state: "idle",
        location: "desk-floor",
        task: "",
        deliverable: "",
        x: seat.x,
        y: seat.y,
        walking: false,
      };
    });
  }

  async function loadJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load " + url + ": " + res.status);
    return res.json();
  }

  async function boot() {
    roster = await loadJSON("./roster.json");
    try {
      manifest = await loadJSON("./assets/manifest.json");
    } catch (e) {
      console.warn("manifest missing, using defaults", e);
      manifest = { palette: DEFAULT_PALETTE, avatars: {}, rooms: {} };
    }
    try {
      const pal = await loadJSON("./assets/palette.json");
      if (pal && pal.colors) {
        const flat = {};
        for (const [k, v] of Object.entries(pal.colors)) flat[k] = v.hex || v;
        manifest.palette = Object.assign({}, DEFAULT_PALETTE, flat, manifest.palette || {});
      }
    } catch (e) {}

    initAgents(roster);
    log("Office online · " + roster.bots.length + " bots + Greg");

    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, TICK_MS);

    emit("ready", snapshot());
    emit("change", snapshot());
    return snapshot();
  }

  function on(fn) {
    listeners.push(fn);
    return () => { listeners = listeners.filter((f) => f !== fn); };
  }

  global.office = {
    boot,
    assignTask,
    startMeeting,
    finishWork,
    reset,
    snapshot,
    on,
    getAgent: (bot) => { const s = resolveKey(bot); return s ? agents[s] : null; },
    listAgents: () => Object.values(agents),
    runDemo: function () {
      if (global.OfficeDemo && global.OfficeDemo.run) return global.OfficeDemo.run();
    },
    _tick: tick,
    TICK_MS,
  };
})(window);
