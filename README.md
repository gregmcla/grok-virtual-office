# Grok Virtual Office

Text-map **v0** of Greg McLaughlin’s AI bot team as office workers. Built for the Tesla in-car browser (Chromium, landscape ~1920×1200). No build step, no CDN.

## Run

```bash
python3 -m http.server 8765
# open http://127.0.0.1:8765/index.html
# or http://127.0.0.1:8765/index.html?demo=1
```

## Rooms & states

Rooms: **Greg’s Office** · **Desk Floor** · **Lounge** · **Review**  
States: `idle` · `working` · `meeting` · `review` (+ `walking` while moving)

Roster lives in `roster.json` (18 bots + Greg). Edit there.

## `window.office` API

```js
office.assignTask("harry", "Verify JD for Anthropic role");
office.startMeeting(["harry", "randy"], "Résumé angle");
office.finishWork("randy", "Anthropic résumé v1");
office.reset();
office.runDemo();          // or tap ▶ Demo day
office.snapshot();         // current agents + events
```

Bots resolve by slug, short tag, id, or first name (`harry`, `randy`, …).

## Assets

`assets/manifest.json` maps each bot slug → avatar SVG and room art. Missing files fall back to text tags + Midnight Studio palette colors. Avatars are 64×64, display at 48–64px.

## Demo

**Demo day** runs: Harry verifies a JD → Opportunity scores → Harry+Randy lounge sync → Randy drafts & delivers via Review to Greg → Cover Writer delivers too.
