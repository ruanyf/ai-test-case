# Relativity Sandbox

A browser-based, interactive 3D n-body gravity playground. It is **visually inspired** by general/special relativity but uses a deliberately simplified Newtonian gravity model so it stays stable, responsive, and easy to explore.

## Running it

Because modern browsers treat `file://` URLs as unique security origins, some browsers (especially Safari and some Chrome configurations) block local subresources when you simply double-click `index.html`.

The recommended way is to use the included tiny local server:

```bash
python3 serve.py
```

Then open `http://localhost:8765/` in your browser.

Or run any static server you already have, for example:

```bash
python3 -m http.server 8765
npx serve .
```

No build step or package manager is required.

---

## What it does

- Runs a real-time 3D n-body simulation with up to ~10–20 bodies smoothly on a typical laptop.
- Lets you add, remove, and observe bodies orbiting, colliding, and merging under mutual gravity.
- Visualizes a dynamic "spacetime curvature" grid that deforms around mass.
- Draws trails and optional velocity vectors.
- Maps body color to local gravitational depth (gravitational redshift / time-dilation inspired).

---

## File overview

| File | Purpose |
|------|---------|
| `index.html` | UI shell and control panel |
| `styles.css` | Dark, responsive styling |
| `script.js` | Simulation, rendering, and UI logic (ES modules, Three.js via CDN) |

---

## Physics: approximations, simplifications, and stability

### Core dynamics

The simulation uses **Newtonian gravity** in 3D:

```
a_i = G · Σ  m_j · (r_j − r_i) / (|r_j − r_i|² + ε²)^(3/2)
```

- `G` is the gravity-strength slider.
- `ε` (softening length) prevents the denominator from blowing up during close encounters. It is a numerical fudge, not a physical effect.
- Integration is a simple **semi-implicit (symplectic) Euler** scheme: velocities are updated first, then positions.
- Each rendered frame is broken into `CONFIG.substeps` smaller substeps so the integrator stays stable when speeds increase.
- A maximum speed clamp keeps things from exploding if bodies sling-shot too hard.

### What is accurate vs. simplified

- **Accurate-ish**: Newtonian inverse-square attraction, conservation of momentum on merger, 3D positions/velocities.
- **Simplified**:
  - No relativistic field equations (no Einstein equations).
  - No relativistic velocity addition or Lorentz transforms.
  - No tidal forces, frame dragging, or event horizons.
  - Collisions are instantaneous mergers; no tidal disruption or accretion.
  - Softening artificially smooths point-mass singularities.
  - The integration is first-order and energy is not exactly conserved over long runs.

### Mergers

When two bodies overlap by more than `mergeThreshold` (90%) of their combined radii:

1. Their masses add.
2. New position = center of mass.
3. New velocity = momentum-conserving weighted average.
4. Radius scales as `∛mass`.
5. Color blends toward the more massive body.

---

## Rendering & curvature visualization

### Scene

Built with [Three.js](https://threejs.org/) loaded from a CDN:

- Perspective camera with `OrbitControls` (left-drag orbit, right-drag pan, scroll zoom).
- `MeshStandardMaterial` spheres for bodies with emissive coloring.
- Starfield background for depth/parallax.
- Line trails and `ArrowHelper` velocity vectors.

### Relativity-inspired visual effect

The chosen effect is **gravitational redshift / time-dilation color mapping**:

- Each body computes the local Newtonian gravitational potential from every other body.
- In a deep potential well the body glows red; in nearly flat space it glows blue/white.
- This is a qualitative illustration of the idea that clocks run slower and light is redshifted near massive objects. It is **not** a quantitative GR calculation.

### Curvature grid

A 64×64 wireframe plane lies across the scene. Each vertex is displaced vertically by the gravitational potential at that point:

```
y = − Σ  G · m_i / √(distance² + ε²)
```

The grid color also shifts from blue (flat) to red/purple (deep well). It is a 2D “rubber sheet” embedded in 3D, so it gives an intuitive picture of how mass curves space without solving the full Einstein field equations.

---

## How to add a new body

1. Fill in the **Add Body** panel on the right.
2. Set mass, position (`x, y, z`), and velocity (`vx, vy, vz`).
3. Click **Add Body**.
4. The new body appears in the list and immediately participates in gravity.

You can also click **Add Random** to drop in a body on a loosely circular orbit around the origin.

### Tweak parameters

| Control | Effect |
|---------|--------|
| Gravity G | Overall strength of attraction |
| Sim speed | Multiplies the simulation timestep (pause/resume with the button) |
| Trail length | How many historical positions each trail remembers |
| Softening ε | Smoothing length; larger = softer, less violent close encounters |
| Curvature grid | Toggle the deforming spacetime mesh |
| Trails / Vectors | Toggle trajectory lines and velocity arrows |

---

## Tips

- The demo starts with a heavy central mass and a few orbiting bodies.
- Zoom and orbit the camera to see 3D depth and parallax.
- Increase softening if orbits become jittery or bodies pass very close to each other.
- Lower sim speed to watch mergers in slow motion.
- Reset returns to the initial demo state.
