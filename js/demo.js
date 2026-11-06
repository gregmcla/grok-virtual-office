/**
 * Scripted office day demo.
 */
(function (global) {
  let running = false;
  let timers = [];

  function later(ms, fn) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearAll() {
    timers.forEach(clearTimeout);
    timers = [];
    running = false;
  }

  function status(msg) {
    const el = document.getElementById("demo-log");
    if (el) el.textContent = msg;
  }

  function run() {
    if (running) {
      clearAll();
      global.office.reset();
    }
    running = true;
    status("Demo running\u2026");
    global.office.reset();

    later(500, () => {
      global.office.assignTask("harry", "Verify JD for Anthropic Applied AI role");
      status("Harry \u2192 desk (verify JD)");
    });
    later(3000, () => {
      global.office.assignTask("opportunity-agent", "Score Anthropic Applied AI fit");
      status("Opportunity Agent \u2192 scoring");
    });
    later(6000, () => {
      global.office.startMeeting(["harry", "randy"], "Anthropic r\u00e9sum\u00e9 angle");
      status("Lounge: Harry + Randy sync");
    });
    later(11000, () => {
      global.office.assignTask("randy", "Draft Anthropic r\u00e9sum\u00e9 v1");
      status("Randy \u2192 drafting r\u00e9sum\u00e9");
    });
    later(15000, () => {
      global.office.assignTask("cover-writer", "Cover letter for Anthropic");
      status("Cover Writer \u2192 letter");
    });
    later(19000, () => {
      global.office.finishWork("randy", "Anthropic r\u00e9sum\u00e9 v1");
      status("Randy delivering to Greg");
    });
    later(28000, () => {
      global.office.finishWork("cover-writer", "Anthropic cover letter");
      status("Cover Writer delivering");
    });
    later(38000, () => {
      status("Demo complete \u2014 office still live");
      running = false;
    });
  }

  global.OfficeDemo = { run, stop: clearAll };
})(window);
