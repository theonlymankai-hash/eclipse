# UMBRA

**Interactive eclipse previsualisation — cosmos view + ground view, any location, any time.**

Working name. Alternatives: PENUMBRA, TOTALITY, CONTACT.

---

## What it is

A web tool that answers one question precisely: *what will this eclipse look like from where I'm standing, and when?*

Two linked views of the same event:

- **COSMOS** — sun, moon, earth and the umbra cone sweeping the globe. The thing you watch.
- **GROUND** — sun and moon discs at correct altitude and azimuth above a horizon line, from a chosen lat/long. The thing you use.

Both driven by one clock and one location pin.

## Why it matters for this eclipse specifically

12 Aug 2026, the sun sits **2–12° above the horizon** across the path of totality. That is unusually low. It means the difference between seeing totality and seeing a roofline is a matter of a few degrees of clear western sightline.

No existing tool answers that well. timeanddate has a flat 2D map. NASA has a pre-rendered video. Nobody lets you stand somewhere and look west.

## Ship strategy

Live **before** 12 Aug 2026 or it's pointless. Roughly two weeks.

1. **v1 — GROUND view + PHOTOGRAPHER MODE.** Time scrubber, location input, readout panel, horizon obstruction slider, framing preview, drift warning, shot plan. This is the useful half, it answers what people are searching for right now, and photographers are the audience most likely to share it.
2. **v2 — COSMOS view.** Umbra cone geometry, path of totality on the globe, orbiting camera.
3. **v3 — the transition between them.** The portfolio moment.

If time runs out, v1 alone is a complete product.

**Don't hardcode the date.** Parameterise it and the tool survives past August — the Iberian eclipse triad continues with 2 Aug 2027 (total, southern Spain) and 26 Jan 2028 (annular). Same engine, new query string.

---

## Architecture

One shared state object. Two renderers. That's the whole design.

```
state = {
  t:   Date          // current simulation time (UTC)
  obs: { lat, lon, elevation }
}
```

Everything else is derived per frame. Move the scrubber → both views update. Move the pin → both views update. No duplicated logic, no sync bugs.

```
        ┌─────────────────────┐
        │  state { t, obs }   │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │   astronomy-engine  │
        │  (derive positions) │
        └─────┬─────────┬─────┘
              │         │
   geocentric │         │ topocentric
   vectors    │         │ alt/az + angular size
              ▼         ▼
        ┌─────────┐ ┌─────────┐
        │ COSMOS  │ │ GROUND  │
        └─────────┘ └─────────┘
```

### Data layer — `astronomy-engine`

Don Cross, MIT, pure JS, no backend, no API key, runs client-side. Single dependency.

```
npm install astronomy-engine
```

Functions to use (verify exact signatures against the docs — API surface is stable but check):

| Need | Call |
|---|---|
| Define observer | `Observer(lat, lon, elevationMetres)` |
| Local eclipse circumstances | `SearchLocalSolarEclipse(startTime, observer)` |
| Global eclipse / greatest eclipse point | `SearchGlobalSolarEclipse(startTime)` |
| Equatorial coords of a body | `Equator(body, date, observer, ofdate, aberration)` |
| → convert to alt/az | `Horizon(date, observer, ra, dec, refraction)` |
| Geocentric position vector | `GeoVector(body, date, aberration)` |

`SearchLocalSolarEclipse` returns the whole timeline for a location: partial begin, total begin, peak, total end, partial end — each with a time **and the sun's altitude at that moment**. Plus obscuration fraction and eclipse kind (total / annular / partial / none). That single call populates most of the readout panel.

**Angular diameters** — compute directly rather than hunting for a helper:

```
angularDiameter = 2 * atan(bodyRadius / distance)

sunRadius  = 695_700 km
moonRadius =   1_737.4 km
```

Distance = magnitude of the topocentric vector. This matters: the 2026 eclipse falls ~2.2 days after perigee, so the moon is visibly larger than average — that's *why* totality is comparatively long. Getting this from real distance rather than a constant is what makes the disc overlap look right.

---

## GROUND view

**Do not build a to-scale solar system and put a camera on it.** Sun at 1.5×10⁸ km, moon at 3.8×10⁵ km, earth radius 6.4×10³ km — seven orders of magnitude. The depth buffer dies long before you get there.

An eclipse from the ground is two circles at known angular positions. Build exactly that.

### Rendering

- Skydome or a simple angular projection. Sun and moon as discs placed at correct alt/az with correct apparent angular size.
- Sun disc ≈ 0.53°, moon disc ≈ 0.52–0.55° depending on distance. The overlap of these two is the entire visual.
- **Horizon line with cardinal markers.** Non-negotiable given how low this sits. Label W and WNW clearly.
- Corona render during totality — soft radial bloom, slight asymmetry, not a clean ring.
- Sky gradient driven by `obscuration` and sun altitude. The colour shift toward totality is the atmospheric part people remember: a bruised, desaturated blue-grey that isn't the same as sunset. Worth getting close.
- Optional: Baily's beads at 2nd and 3rd contact. Nice-to-have, cut freely.

### The feature that makes this tool

**Horizon obstruction slider.** User sets "my western horizon is blocked to N degrees" — a building, a ridge, a treeline. The tool draws that as a mask and says plainly whether the eclipse clears it.

For a 4° sun this is the difference between a trip that works and one that doesn't. It's also the thing no other eclipse site does.

Stretch: let the user upload a photo of their actual western horizon and place it as the mask silhouette.

---

## PHOTOGRAPHER MODE

This is what turns UMBRA from a nice viewer into a tool people bookmark, share and come back to. Every input it needs is already in `state` — sun altitude, azimuth, angular diameter, obscuration, contact times. The photography layer is pure derivation on top of data you already have.

It's also the same underlying pattern as the gear-picker idea: describe your situation, get a specific recommendation with the reasoning shown.

### 1. Framing preview

User enters focal length + sensor size (FF / APS-C / MFT / user-defined). Tool overlays the resulting frame box on the ground view, so they see *exactly* how big the sun will be.

```js
// horizontal field of view for a given focal length
fovDeg = 2 * atan(sensorWidth / (2 * focalLength)) * 180/PI

// sun as a fraction of frame height
sunFraction = sunAngularDiameter / vFovDeg
```

Rough guide the tool should reproduce (full frame, 24mm sensor height):

| Focal length | Sun disc height | Verdict |
|---|---|---|
| 200mm | ~8% | context shot only |
| 400mm | ~15% | workable, crop later |
| 600mm | ~23% | disc + corona fills half frame |
| 800mm | ~31% | tight corona detail |

Add a **crop-mode toggle** — APS-C crop is a free 1.5× and worth surfacing explicitly, since most people forget they have it.

### 2. Drift warning — the feature that saves shoots

The sun moves **15°/hour, or 0.25°/minute**. Nobody accounts for this and it wrecks unattended sequences.

```js
frameWidthDeg = 2 * atan(sensorWidth / (2 * focalLength)) * 180/PI
minutesToExit = (frameWidthDeg / 2) / 0.25   // from centred
```

At 600mm on full frame that's a ~3.4° frame — **the sun leaves the frame roughly 7 minutes after you centre it**. Across a 90-minute partial phase you'd need to recentre a dozen times, or use a tracking mount.

Output should be blunt: *"At 600mm your sun exits frame in 6.8 minutes. For unattended timelapse across the partial phases you need an equatorial tracker (Star Adventurer class) or you will lose the sun."*

### 3. Exposure calculator

Standard solar exposure formula (Espenak):

```
t = f² / (ISO × 2^Q)
```

where `t` is shutter in seconds, `f` is the f-number, and `Q` is a brightness exponent per subject. Approximate Q values — **verify against Espenak's published exposure table before shipping**, don't trust these from memory:

| Subject | Q (approx) |
|---|---|
| Partial phase, ND5 solar filter | 11–12 |
| Baily's beads / diamond ring | 11 |
| Corona, 0.1 solar radii | 11 |
| Corona, 0.5 Rs | 9 |
| Corona, 1 Rs | 8 |
| Corona, 2 Rs | 7 |
| Corona, 4 Rs | 6 |
| Corona, 8 Rs | 5 |

User picks aperture and ISO; tool outputs the full bracket ladder. Corona spans an enormous dynamic range, so the honest answer is always "bracket wide and merge later" — the tool should say that and then give the actual ladder.

### 4. Shot plan generator

The output people will actually save. Time-coded to *their* location's real contact times:

```
19:14  C1 — first contact. Filter ON. Start interval sequence.
20:26  C2 −20s — remove filter NOW. Switch to bracket.
20:27  C2 — totality begins. Diamond ring bracket.
20:28  MAX — widest bracket, longest exposures for outer corona.
20:29  C3 — diamond ring returns. Filter back ON immediately.
20:29+ resume interval sequence.
21:0x  C4 — last contact (may be below horizon).
```

Exportable as text or a printable card. Nobody reads a webpage in the field.

### 5. Filter advisor

From the chosen lens: front thread diameter → what's available, what it costs, and whether solar-grade is actually required.

Key distinction the tool should make explicit: **solar-grade filtration is mandatory on long lenses, but a standard ND is acceptable on a wide-angle**, where the sun isn't being concentrated. Most guidance online blurs this and people either endanger gear or buy filters they don't need.

For large front threads (95mm+), flag that Baader AstroSolar film in a DIY cell is the standard practical answer — cheap, optically excellent, and often the only realistic option at that diameter.

### 6. Low-sun warnings

Specific to this eclipse and computable from the sun's altitude at the user's location:

- **Atmospheric extinction** — several stops of dimming at low altitude. Affects exposure calculations.
- **Refraction** — the disc visibly flattens near the horizon. The simulation should render this, not just warn about it.
- **Seeing** — long focal lengths shooting through that much atmosphere lose sharpness to turbulence. Below ~5°, a 600mm shot may resolve no better than a 400mm one.

Practical conclusion the tool should be willing to state: *at very low sun altitude, the wide environmental shot is more likely to succeed than the tight corona shot.* That's useful advice precisely because it's the opposite of what people plan.

---

## COSMOS view

Illustrative scale, not true scale. True scale is useless — the moon would be sub-pixel. Compress it like the classic BBC shadow diagram, but in 3D and running live.

- Sun as light source and disc. Earth as textured globe, correctly oriented for `t` (day/night terminator matters and is nearly free).
- **Umbra cone** — real geometry. Cone from the sun's tangent lines past the moon, apex beyond the earth's surface (that's what makes it total rather than annular). Render it as a semi-transparent dark cone intersecting the globe.
- **Penumbra cone** — wider, lighter, surrounding it.
- **Shadow ellipse on the globe surface** where the umbra intersects — the actual dark patch, elongated because the shadow strikes at a shallow angle near the terminator. For this eclipse it's very elongated. Don't draw it as a circle.
- **Path of totality** traced as a line on the globe, drawn ahead of and behind the current shadow position.
- Orbiting camera, user-controllable. Pin location visible as a marker on the globe so the connection between views is obvious.

Scrubbing time sweeps the shadow across the surface at ~1,000 km/h ground speed. That motion is the whole appeal of this view.

---

## The transition

The showpiece. Camera pulls from the umbra cone in space, down through the atmosphere, to standing at the pin — eclipse clock running continuously throughout.

Because the two views use different scales, this can't be one true continuous camera move. It doesn't need to be:

- Dolly the cosmos camera toward the globe, framing tightening on the pin
- Atmospheric haze / blue shift builds as you "descend"
- Crossfade at peak haze into the ground scene, matched on the sun's screen position and roll angle
- Ground camera settles to horizon level

Done properly nobody notices the cut. This is the same scroll-driven camera grammar the portfolio site already uses, so it should sit naturally alongside the rest of the page.

---

## Controls & UI

**Time**
- Scrubber across the full eclipse window (first contact → last contact) for the current location
- Snap buttons: C1 / C2 / MAX / C3 / C4
- Play / pause with speed multiplier (1×, 60×, 600×)
- Both UTC and local time displayed

**Location**
- Search box with geocode
- Draggable pin on a small map or directly on the globe
- "Use my location"
- Preset shortlist: Zaragoza, Oviedo, Burgos, Palma / Port de Pollença, Valencia, London (for the partial), Reykjavík

**Readout panel**
- Eclipse kind at this location (total / partial / none) + obscuration %
- Totality duration, or "no totality — X% partial"
- Sun altitude and azimuth at maximum
- Local times for each contact
- Distance to the centreline

Keep it dark, thin type, minimal chrome — same register as the lab tools. The data density is the design.

---

## Stack

### Start in 2D. Skip Three.js entirely for the mockup.

The ground view is **two circles and a horizon line**. That is not a 3D problem. Plain Canvas 2D does it in about a hundred lines, no dependencies beyond astronomy-engine, and you'll know within an evening whether the thing feels right.

The whole projection is:

```js
const FOV = 60;                          // degrees across the canvas width
const pxPerDeg = canvas.width / FOV;

// centre the view on the sun's azimuth, horizon at 75% height
const x = canvas.width/2  + (az - centreAz) * pxPerDeg;
const y = horizonY        - alt * pxPerDeg;

// disc radius from apparent angular diameter
const r = (angularDiameter / 2) * pxPerDeg;
```

Draw the sun disc, draw the moon disc over it, draw a horizon line at `alt = 0`, add cardinal tick marks. That's a working eclipse simulator. Everything after that — corona bloom, sky gradient, obstruction mask — is compositing on the same 2D canvas, which is *easier* in 2D than in 3D.

**p5.js** if you want the sketch-loop workflow and don't mind the dependency. Plain canvas if you want zero.

### Then decide

If the 2D ground view feels good, **keep it in 2D permanently**. There is no reason to rewrite it into Three.js for consistency — the two views are genuinely different problems and can legitimately use different renderers:

| View | Renderer | Why |
|---|---|---|
| GROUND | Canvas 2D | Two discs at angular positions. Flat by nature. |
| COSMOS | Three.js | Umbra cone geometry, textured globe, orbiting camera. Needs real 3D. |

Three.js only enters the project when you build the cosmos view. If v1 ships and v2 never happens, you never install it.

### Shipping shape

Single self-contained HTML file, same as the lab tools. Embeds anywhere, mounts into the Next.js site as a route later without a rewrite.

Mobile matters here — people will check this standing outside. The ground view especially needs to work one-handed on a phone.

---

## Scope discipline

**v1 must have:** ground view, time scrubber, location input, readout panel, horizon obstruction slider, framing preview, drift warning, shot plan generator.

**Cut without hesitation:** Baily's beads, atmospheric scattering accuracy, earth cloud layer, shadow bands, corona detail beyond a convincing bloom, the transition, sound.

**Only after v1 is live:** cosmos view, path-of-totality line, transition, other eclipse dates.

---

## Open questions

- Name — UMBRA, or something in the reactor family?
- Standalone page or a section within the existing portfolio scroll?
- Does the location pin sync with the Location Index app's card system, or stay independent?
- Ground view: literal photographic realism, or stylised to match the lab tool aesthetic? Realism is more useful; stylisation is more *yours*. Possibly a toggle.
