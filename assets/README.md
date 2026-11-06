# Virtual Office — Midnight Studio assets

Hand-authored SVG kit for Greg’s Grok Bot team virtual office (Tesla car browser / landscape touchscreen). Dark-mode, high-contrast, flat top-down rooms + round badge avatars.

## Palette (`palette.json`)

Theme name: **Midnight Studio**

| Role | Name | Hex | Use |
|------|------|-----|-----|
| background | Midnight Void | `#0B1220` | App chrome / page bg |
| floor | Warm Slate | `#1A2332` | Room floors |
| walls | Steel Shadow | `#2A3548` | Room walls, desk tops |
| surface | Soft Panel | `#243044` | Panels, rug inlays |
| accent | Electric Teal | `#2DD4BF` | Primary accent, rings default |
| accent2 | Soft Gold | `#FBBF24` | Secondary highlight |
| text | Porcelain | `#F1F5F9` | Labels, outlines |
| idle | Quiet Steel | `#64748B` | Status: idle |
| working | Amber Signal | `#F59E0B` | Status: working |
| meeting | Violet Pulse | `#A78BFA` | Status: in meeting |
| review | Mint Ready | `#34D399` | Status: ready for review |

Status colors are distinct by hue + brightness (slate / amber / violet / mint) for colorblind-friendlier pairing than red–green alone.

## Rooms (viewBox `0 0 800 500`)

Tileable top-down floor plans:

- `room-work-floor.svg` — open floor with 7 dashed desk pads + plant
- `room-lounge.svg` — U-sectional, rug, round table, whiteboard, lamp
- `room-greg-office.svg` — private office: desk, chair, window, plant, rug, lamp
- `room-lobby.svg` — entrance door, welcome mat, reception desk
- `room-review.svg` — review table, large wall screen, 3 chairs, ready-for-review inbox tray (mint `#34D399` accent)

## Desk & status

- `desk.svg` — single desk unit (~120×100): top-down desk, monitor slab, keyboard, mouse, chair
- `desk-status-ring.svg` — dashed ellipse; **recolor `stroke` to the status hex** (idle/working/meeting/review)
- `status-dot-{idle,working,meeting,review}.svg` — 24×24 dots

## Avatars (viewBox `0 0 64 64`)

Round badges, designed for **48–64 px**. Thin porcelain outline, bold silhouette, distinct fill.

| File | Bot | Symbol |
|------|-----|--------|
| `avatar-greg.svg` | Greg | Stylized person + golf cap (no likeness) |
| `avatar-gary-general.svg` | Gary General | Peaked cap + stars |
| `avatar-randy-resume-builder.svg` | Randy | Résumé page |
| `avatar-opportunity-agent.svg` | Opportunity Agent | Target |
| `avatar-harry-doorway-lead.svg` | Harry | Open doorway |
| `avatar-apply-ops.svg` | Apply Ops | Paper plane |
| `avatar-cover-writer.svg` | Cover Writer | Envelope + pen |
| `avatar-mcr-storyteller.svg` | MCR Storyteller | Open book |
| `avatar-larry-logo.svg` | Larry Logo | Pen nib / bézier |
| `avatar-logo-lab.svg` | Logo Lab | Flask + palette dots |
| `avatar-distill-anyone.svg` | Distill anyone | Alembic / retort + drop |
| `avatar-distilled-roon.svg` | Distilled roon | Abstract droplet character |
| `avatar-distilled-chris-bakke.svg` | Distilled Chris Bakke | Abstract droplet (alt color) |
| `avatar-ludovico-di-varthema.svg` | Ludovico | Compass rose |
| `avatar-viral-tweet-crafter.svg` | Viral Tweet Crafter | Speech + lightning (no X mark) |
| `avatar-juice-lord.svg` | Juice Lord | Juice glass + crown |
| `avatar-general-bot.svg` | general bot | Friendly robot head |
| `avatar-gamer.svg` | Gamer | Controller |
| `avatar-golf-economy-expert.svg` | Golf Economy… | Golf ball on tee + chart |

## Preview

`preview-sheet.png` — contact sheet of avatars @ 48 & 128 px, rooms scaled, desk + status.

## Usage notes

1. Prefer SVG in the web app; scale with CSS `width`/`height`. No external fonts, no rasters.
2. Avatars: display at 48–64 px; they stay legible down to ~40 px.
3. Status: tint `desk-status-ring.svg` stroke, or overlay a `status-dot-*`.
4. Rooms share the same 800×500 frame so they can be abutted or scaled uniformly.
5. Do not treat any mark as a trademark clone — originals only.

## Generator

Source script (optional regenerate): `/workspace/virtual-office/generate_assets.py`  
Some assets were hand-patched after the first pass for 48 px legibility.
