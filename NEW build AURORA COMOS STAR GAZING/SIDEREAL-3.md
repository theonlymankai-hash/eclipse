# SIDEREAL

**Stargazing extension to [UMBRA](https://eclipse.mankai.art) — the sky view generalised from two objects to everything.**

Working name. Alternatives: NOCTURNE, ORIENT, or simply UMBRA · NIGHT.

---

## The premise

UMBRA already renders **two discs at correct altitude and azimuth, at a chosen time, from a chosen place.**

Stars are the same problem with a bigger input file.

The engine is built. The projection is built. The time scrubber, the FOV control, the location picker, the horizon line, the "moments" snapping — all built and shipping. This extension adds a data layer and a rendering mode. It does not add an architecture.

That is the entire reason this is worth doing: the expensive half already exists.

---

## What you already have vs what's new

| Component | Status |
|---|---|
| alt/az → screen projection | ✅ built (SKY view) |
| FOV control | ✅ built |
| Time scrubber + LIVE mode | ✅ built (extend range from ±3h to any date) |
| Location picker + fine-tune lat/lon | ✅ built |
| Horizon line + obstruction mask | ✅ built — **and it becomes more useful here, not less** |
| Camera / focal length / sensor framing | ✅ built |
| Espenak exposure | ✅ built — needs a night table alongside it |
| Star catalogue | ⬜ new |
| Constellation lines | ⬜ new |
| Deep-sky objects | ⬜ new |
| Object labels + search | ⬜ new |
| Night (red) mode | ⬜ new |
| Camera alignment / plate solve | ⬜ new, hardest |

Roughly six new things, one of which is genuinely difficult. The rest is data plumbing into a renderer that already works.

---

## Data — all of it is free

Nobody owns the sky. Every layer below is public domain or open licence.

| Layer | Source | Notes |
|---|---|---|
| Stars | **HYG database** (v3/v4) | Compiled from Hipparcos, Yale BSC, Gliese. ~120k stars. CSV. Includes proper names, magnitude, colour index, RA/Dec. The standard choice for exactly this. |
| Stars (deep) | **Gaia DR3** | ESA, >1 billion sources. Overkill unless you go telescopic. |
| Deep sky | **Messier**, **NGC/IC** (OpenNGC) | Public domain. ~14k objects. |
| Planets, Sun, Moon | **astronomy-engine** | Already in the project. Nothing to add. |
| Constellation lines | **Stellarium** (GPL) or **Sky & Telescope** figures | See licence note below. |
| Constellation boundaries | **IAU** (Delporte 1930) | Public domain. |

### The single-file constraint decides your catalogue cut

UMBRA's promise is *"runs entirely offline in one file."* Don't break that.

- **Magnitude 6.5** = naked-eye limit = **~9,000 stars**. Trimmed to RA/Dec/mag/colour/name, that's a few hundred KB. Embeds fine.
- **Magnitude 8** ≈ 40,000 stars — binocular territory, still plausible.
- **Magnitude 10+** ≈ 340,000 — needs lazy loading, breaks the single file.

Ship mag 6.5. It matches what a person standing outside can actually see, which is the entire point of a stargazing guide. Deeper catalogues are a "load more" toggle later, not v1.

### Licence caution

Constellation **artwork** — the illustrated figures in Star Walk and Stellarium's skycultures — is copyrighted. Star Walk's moat is precisely that artwork plus the UX, not the data.

Draw **lines**, not illustrations. Stick-figure asterisms from open line data, IAU boundaries as thin polygons. It suits UMBRA's existing visual register better anyway — thin type, dark ground, no decoration.

---

## Night mode — a physiology problem, not a styling one

Dark adaptation takes **20–30 minutes**. Any bright overlay resets it instantly. Every astronomy app handles this; most AR sky concepts ignore it and are useless in the field as a result.

Requirements:

- **Deep red UI**, toggled globally. Not a tint over white — actually recolour to red, with white reserved for nothing at all.
- **Aggressive minimum brightness**, below what feels comfortable indoors.
- **Sparse by default.** Labels fade after a few seconds. The sky should be mostly empty most of the time. Constant labelling is what makes these apps unusable outdoors.
- **No white flashes ever** — page transitions, loading states, error toasts. Audit every one.

This should be a first-class mode, not a filter. Get it right and it's a differentiator against every AR-glasses sky demo that exists.

---

## Alignment — the actual hard part

**GPS solves the easy half.** Stars are effectively at infinity, so position barely matters; the Moon has real parallax (up to ~1°) and eclipse timings need coordinates, but 10m accuracy is already far more than enough.

**Heading is the problem.** The magnetometer is typically **5–15° off**, worse near cars, railings, scaffolding, anything ferrous. That wobble is why every phone sky app feels slightly wrong.

### Calibrate once, then coast

**Don't solve continuously. Solve once from a photo or a short video, then propagate with the gyroscope.**

This is the key architectural decision, and it collapses the difficulty:

- **Gyro drift is slow** — roughly 1–2°/minute, and it accumulates gradually.
- **Compass error is constant** — 5–15°, always, and it jumps unpredictably near metal.

So a single accurate solve plus gyro tracking beats the compass from the first second and stays better for many minutes. Re-calibrate every few minutes, or whenever the user notices drift and taps a button. This is exactly how spacecraft star trackers and ARKit/ARCore visual-inertial odometry work — vision fixes the frame, the IMU carries it forward.

It also removes the real-time constraint entirely. A one-shot solve can take two or three seconds, use a heavier algorithm, and reject noise across multiple video frames. Nothing has to run at 60fps.

### The calibration ladder

1. **Tap one star.** Gravity from the accelerometer already fixes pitch and roll — it's reliable and drift-free. That leaves only yaw unknown. Point roughly, tap the star you recognise ("that's Vega"), and the orientation is fully solved. **No image processing at all.** This is the cheapest complete solution and should ship first.
2. **Sun-solve (daytime).** Brightest blob in frame, known angular size. Trivial to detect, no catalogue matching needed. **This is the one that matters for eclipse work** — and combined with gravity it's a complete solve from a single frame.
3. **Photo auto-solve (night).** Detect the brightest points in a still, match the triangle pattern against the ~200 brightest catalogue stars, derive orientation to sub-degree. Much more tractable than full astrometry because the search space is tiny and gravity has already constrained two axes.
4. **Video solve.** Same as 3, but across frames — rejects aircraft, satellites, hot pixels, and noise.

Note that the app already knows the camera's field of view: photographer mode has focal length and sensor size, and phone EXIF supplies both. That's usually the missing input for plate solving, and here it's free.

Rungs 1 and 2 need no computer vision whatsoever, and together they cover both the eclipse case and the casual stargazing case. Rungs 3 and 4 are polish.

---

## MR / glasses

The right long-term target, with real caveats worth designing around now rather than waiting out.

**What works:** outdoors, hands-free, look up, labels overlay in place. This is one of the genuinely good use cases for the form factor — unlike most AR demos, the subject is *actually* at infinity, so there's no depth-conflict problem and no occlusion to solve.

**What doesn't, yet:**

- **Waveguide luminance floors.** Many displays can't go dim enough for a dark sky, and they leak light at the edges. Red UI helps; it may not be sufficient on current hardware.
- **SLAM needs visual features, and the sky has none.** Tracking must anchor to the ground and horizon, then project upward. Conveniently, that's already how the planar ring view works.
- **Session length.** Stargazing is a 30–60 minute activity. Most glasses aren't.

**Design consequence:** build the projection layer renderer-agnostic. Same alt/az maths, three output targets — 2D canvas (now), WebXR passthrough (when hardware is ready), glasses SDK (later). Don't couple the astronomy to the display.

---

## Where the money actually is

An eclipse tool is spiky. A **sky planner is year-round**, and this is what turns the eclipse hook into something that retains.

Same engine, generalised from "when is the eclipse" to "when is *anything* where I want it":

- **Moonrise behind a specific building** — the Petronas-style shot. Full moon, low altitude, long lens, compressed against a landmark.
- **Golden hour down a specific street** — sun azimuth aligned to a road bearing.
- **Milky Way core alignment** — season, hour, azimuth, and whether the core clears the treeline.
- **ISS and satellite passes** — timed, bright, predictable.
- **Conjunctions and occultations** — planets close together, moon passing a bright star.

Every one of these is: *pick a subject, pick an object, find when the geometry aligns from where you can stand.* Which is UMBRA's existing engine with the search direction reversed — solve for **time** given a desired **alt/az**, instead of solving for alt/az given time.

That inversion is the single highest-value piece of work in this document. It's a solver over the existing maths, not a new system.

And it pairs directly with the on-demand planar/map view: subject-first, then geometry tells you where to stand.

---

## AURORA

The one layer that isn't geometry.

Everything else in UMBRA is deterministic — you can compute it for any date in the next thousand years, offline, from first principles. Aurora is **space weather**: probabilistic, live, forecast an hour ahead at best. It requires a network call, and therefore it must be an **online-only mode**. Same call already made for the on-demand planar view. Consistent, not a compromise.

Everything *around* the aurora, though, is exactly what the engine already computes.

### Why it fits

The question is identical in shape: *where do I look, how high will it be, is my horizon clear, is it dark enough, will the moon ruin it?*

- **Direction and altitude** — from UK latitudes the aurora sits low on the northern horizon. The **horizon obstruction slider becomes the single most important control in the app.** A treeline at 10° north kills the entire event. Nobody else models this.
- **Darkness** — you already have sun altitude. Aurora needs astronomical twilight (sun below −18°) for the faint stuff, nautical (−12°) at minimum for strong displays.
- **Moon** — already computed. A bright moon above the horizon washes out everything but a substorm.

### The seasonal constraint your engine reveals for free

At London's latitude there is **no astronomical darkness from roughly mid-May to late July** — the sun never drops 18° below the horizon. Further north it's worse and lasts longer.

So the aurora season is effectively **September to March**, and the tool can state this as a computed fact rather than folklore. That's a genuinely useful thing to tell someone in June who just saw an alert fire.

Nicely, this is the exact inverse of eclipse season interest — the two modes cover opposite halves of the year.

### Data — free, no key required

**NOAA SWPC** (`services.swpc.noaa.gov`) publishes everything as open JSON, public domain, no registration:

| Feed | What it gives |
|---|---|
| **OVATION aurora forecast** | Gridded aurora probability by lat/lon, ~30 minutes ahead |
| **Planetary K-index (Kp)** | Current and 3-hour values, plus 3-day forecast |
| **DSCOVR real-time solar wind — mag** | **Bz**, Bt — interplanetary magnetic field |
| **DSCOVR real-time solar wind — plasma** | Speed, density |

Verify exact endpoint paths against SWPC's current service listing before wiring anything up.

### The insight worth building the mode around

**Kp is a lagging indicator. Bz is the leading one.**

Kp is a three-hour planetary average — by the time it rises, the substorm may be over. Almost every consumer aurora app alerts on Kp alone, which is why their alerts feel simultaneously late and unreliable.

**Bz is the trigger.** The interplanetary magnetic field must point *south* (Bz negative) to couple with Earth's magnetosphere. If Bz is northward, nothing happens no matter how high Kp climbs. Solar wind speed and density then set the intensity.

Surfacing Bz prominently — with a plain-English reading of what it means right now — is the same class of differentiator as the horizon obstruction slider. It's the thing an experienced chaser watches and a casual app ignores.

### Visibility

Aurora ovals are centred on the **geomagnetic** pole, not the geographic one. Use corrected geomagnetic latitude for the visibility calculation, not raw latitude — this is why the required Kp for a given place doesn't track its position on a normal map.

Rough Kp thresholds by location exist (Scotland at lower Kp than southern England, and so on) but the numbers vary by source. Derive from the OVATION grid where possible rather than hardcoding a table, and treat any published thresholds as approximate.

### Alerts — the actual product

This is what makes it more than a dashboard, and it's the piece nobody does properly.

Most aurora alerts fire on a Kp threshold alone. They go off at midday. They go off under a full moon. They go off in June when it never gets dark. They go off when your northern horizon is a building. Users mute them within a week.

**A useful alert fires only when every condition is true at once:**

- Bz southward, and sustained
- Kp above your location's geomagnetic threshold
- Sun below −12° at **your** coordinates
- Moon below the horizon, or a thin enough phase
- Aurora altitude clears **your** stated horizon obstruction

Every one of those except the space weather is already computed by the existing engine. The alert logic is a conjunction over data you have.

That combination doesn't exist elsewhere, and it's the strongest argument in this document for the paid tier.

### Photography

The exposure module needs a second table alongside Espenak — aurora is a wholly different regime:

- Fast wide lens, roughly 14–24mm at f/1.4–2.8
- ISO 1600–6400
- **2–5s during an active substorm**, 10–15s when faint. Aurora moves fast; long exposures smear the curtain structure into a green fog. This is the mistake most first-timers make.
- Manual focus at infinity, set before dark
- Star-trail limits become relevant at these focal lengths — the NPF rule is worth surfacing alongside the shutter suggestion

Same framing preview, same shot plan generator, different numbers.

---

## ORBITAL — passes and re-entries

Two features that look like one and behave nothing alike. Keep them separate in the UI or the second will make the first look broken.

### Tier 1 — passes (deterministic, plannable)

Bright satellites are **precisely predictable days ahead**. ISS, Tiangong, freshly-launched Starlink trains, the brighter rocket bodies. Position to the second, from a TLE and an SGP4 propagator.

- **Data:** CelesTrak publishes TLEs with no account required. Space-Track has more but wants a free login.
- **Propagation:** `satellite.js` — SGP4 in the browser, small, no dependencies. Feeds the same alt/az projection everything else uses.
- **Visibility condition:** the satellite must be **sunlit while the observer is in darkness**. That's a sun-altitude test at the observer and an illumination test at the object's altitude — the engine already computes the first half.

This is a proper planner feature. "ISS crosses at 63° above your southern horizon at 21:14 on Thursday, magnitude −3.4, clears your obstruction" is a sentence the app can say with confidence.

### Tier 2 — re-entries (opportunistic, alert-only)

What that August 12th video shows: multiple fragments in parallel, orange embers shedding forward, still burning after twenty seconds. Not a meteor — a meteor at 11–72 km/s is over in a blink. Re-entering debris has already been slowed by drag, so it drifts across for 30 seconds to several minutes and comes apart as it goes.

**Be honest in the UI about what can and cannot be predicted.**

- Around **10–20 tracked objects re-enter each week**, and the rate is climbing as Starlink deorbits at end of life.
- The 18th Space Defense Squadron issues **TIP messages** for objects expected down within seven days.
- But **along-track timing is not predictable in advance.** Drag depends on solar activity and the object's tumbling attitude. Uncertainty runs to a meaningful fraction of the remaining time — and at orbital speed, ±20 minutes of timing error is a ground track spanning most of a continent.
- Roughly 71% of the planet is ocean. Most re-entries are seen by nobody.

So the honest feature is a **watchlist and a short-notice alert**, not a countdown you can book a trip around:

> *Object decaying within 24h · predicted track passes within 500km · you'd be in darkness · your northern sightline is clear. Low confidence — go outside if you're already up.*

Controlled deorbits are the exception and worth flagging separately when announced, since those are targeted rather than uncertain.

### Photography

Different regime again from both eclipse and aurora:

- Bright, **moving**, at dusk or dawn against a not-fully-dark sky
- Wide-ish and fast: 24–50mm, f/1.8–2.8, ISO 800–3200
- **Short exposures (1/60–1/4s) freeze fragment structure; long exposures render it as a single smear.** The August 12th footage works precisely because the individual fragments stay separate.
- Video often beats stills here — the event has duration, and duration is the whole character of it
- No time to set up. Focus at infinity, settings pre-dialled, or it's over

### Why this is the easiest alert to get right

Aurora is weather — probabilistic even hours out. Passes are **orbital mechanics** — deterministic to the second. Nobody has built pass alerts that account for a photographer's actual horizon obstruction and framing, and that's the same engine that already exists here.

Build Tier 1 first. It works every clear night, everywhere on Earth, forever.

---

## Build order

**Phase 1 — stars in the existing SKY view**
Load mag 6.5 HYG. Render as points, size and colour by magnitude and B–V index. Constellation lines toggle. Extend the time scrubber beyond ±3h to arbitrary dates. Night mode.

*This alone is a complete, useful, shippable thing.*

**Phase 2 — labels, search, planets**
Named stars, Messier objects, planets from astronomy-engine (already present). Tap to identify. Search to locate. Labels fade.

**Phase 3 — the calibration ladder**
Tap-one-star solve → sun-solve → photo auto-solve → video solve. Gyro propagation from the first rung onward.

**Phase 4 — the planner inversion**
Solve for time given a target alt/az. Moonrise-behind-landmark, golden hour, Milky Way. This is the retention feature and the paid feature.

**Phase 4b — aurora (online mode)**
SWPC feeds, Bz-forward dashboard, darkness and moon gating, conditional alerts. Independent of Phase 4 — can ship earlier if a good display season arrives first.

**Phase 4c — orbital passes (online mode)**
CelesTrak TLEs, `satellite.js` propagation, sunlit-object/dark-observer test, pass alerts against the user's obstruction. Re-entry watchlist bolts on after, clearly labelled as low-confidence.

**Phase 5 — MR**
WebXR passthrough when the display hardware justifies it.

---

## Scope discipline

**Cut without hesitation:** atmospheric refraction below 5° (nice, not necessary), light-pollution modelling, telescope control, satellite catalogues beyond ISS, meteor shower radiants, star hopping routes, anything requiring a server.

**Protect at all costs:** the offline single-file property for everything deterministic, and the horizon obstruction feature. Both are differentiators. Neither is common. Aurora is the one sanctioned exception to offline — quarantine it as an online mode so the core never depends on a network.

---

## Open questions

- Separate site, or a mode inside UMBRA? The eclipse framing is strong and dated; a night-sky tool is permanent. Possibly `sky.mankai.art` sharing the engine.
- Does the star layer justify breaking single-file, or does mag 6.5 hold the line permanently?
- Do cached planner locations share a schema with the Location Index LOC cards? If yes, every sky lookup quietly feeds the location library.
- Free/paid boundary: is the planner inversion the paid tier, with viewing always free?
- Constellation line style — astronomical convention, or something closer to the lab-tool visual language?
