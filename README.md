# Grok Virtual Office

Greg McLaughlin’s AI bot team as a live office floor. Tesla in-car browser ready (Chromium, ~1920×1200 landscape). No build step, no CDN.

## Run

```bash
cd /workspace/virtual-office
python3 -m http.server 8765
# http://127.0.0.1:8765/index.html
# http://127.0.0.1:8765/index.html?demo=1
```

## Views

- **Visual (default):** illustrated SVG floor plan with Larry Logo Midnight Studio room art, glowing status rings, task bubbles, lounge glow, delivery FX
- **ASCII:** tap **ASCII** in the header for the original text-map

## `window.office` API

```js
office.assignTask("harry", "Verify JD for Anthropic role");
office.startMeeting(["harry", "randy"], "Résumé angle");
office.finishWork("randy", "Anthropic résumé v1");
office.reset();
office.runDemo();
office.snapshot();
```

Roster: `roster.json` (18 bots + Greg). Assets: `assets/manifest.json`.

## Screenshots

- `screenshot-v1.png` — idle visual floor
- `screenshot-v1-demo.png` — mid-demo (lounge meeting + working)
- v0 snapshot: `/workspace/virtual-office-v0/`
