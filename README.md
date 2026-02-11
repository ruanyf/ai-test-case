这里收集 AI 编程的测试用例，用来评估 AI 模型的代码生成能力。

## 目录

1. [网页设计测试](#Case01)
1. [3D 沙盒测试](#Case02)
1. [网页游戏测试](#Case03)
1. [Laravel 迁移 Next.js](#Case04)
1. [网页动画：麦克斯韦小恶魔](#Case05)

## Case01

目录`case01`是一个简陋的网页，将其重构为一个美观易用的登陆页。

提示词

```markdown
Improve the existing SaaS landing page into a production-quality, conversion-focused page while keeping the same core product message. 

Constraints:
- Use plain HTML/CSS/JS (no framework build step).
- Keep it easy to run locally by opening index.html.
- Preserve semantic HTML and accessibility.
- Mobile-first responsive behavior.
- Keep load lightweight (no heavy animation libraries).

Required improvements:
1. Visual hierarchy and typography system.
2. Better color system and contrast compliance.
3. Stronger hero section with clear CTA hierarchy.
4. Features section redesign (cards, spacing, icons/visual cues).
5. Social proof/testimonial or trust strip.
6. Pricing/CTA block with clear user flow.
7. Accessible navigation and footer.
```

Credits: [Landingpage-frontend-eval](https://github.com/alejandro-ao/landingpage-frontend-eval)

## Case02

生成一个网页上的 3D 沙盒，以动画形式模拟太阳系的天体运动，能够调节质量、位置、速度等参数，并能添加新的天体。

提示词

```markdown
You are building an interactive 3D educational sandbox in the browser that *visually* evokes special/general relativity, but uses a simplified n-body gravity approximation. Favor stability, clarity, and smooth interactivity over physical completeness.

## Outcome

- A real-time 3D simulation where users can add/remove multiple bodies and see:
  1) bodies moving in 3D under mutual attraction,
  2) a visible "spacetime/curvature" visualization affected by mass,
  3) trajectories/trails,
  4) collisions and mergers.

## Hard constraints

- Frontend only (no backend).
- No build step / no package manager. CDN libraries allowed.
- Must be true 3D: camera orbit/pan/zoom shows parallax and depth; bodies exist in 3D space.
- Smooth for ~10-20 bodies on a typical laptop.

## Minimum feature checklist (must ship)

1) 3D scene + camera controls (orbit/pan/zoom).

2) Bodies:
  - Create/delete at runtime.
  - Each body has: mass, position (x,y,z), velocity (vx,vy,vz).

3) Dynamics:
  - N-body gravitational acceleration in 3D (Newtonian), with numerical-stability measures (e.g., softening epsilon, timestep strategy, optional max accel/speed clamp).
  - Add ONE clearly-defined "relativity-inspired" visual effect (choose one):
    A) time dilation / gravitational redshift color mapping,
    B) velocity-based trail distortion,
    C) curvature intensity scaling / lensing-like distortion.

4) Collisions:
  - Detect when bodies overlap (radius-based).
  - Merge with approximate conservation of momentum; mass adds; radius updates.

5) Interactivity:
  - Pause/resume, reset.
  - Toggle overlays: curvature viz, trails, vectors.
  - sliders: gravity strength, simulation speed, trail length(or similar).

6) Curvature visualization:
  - Represent "curvature" however you think best (mesh surface, layered grids, field lines, voxel-xish points, instanced planes). It just needs to be clearly visible and respond to mass.

## Deliverables

- index.html, styles.css, script.js
- README section explaining:
  - physics approximations and stability tricks used,
  - what is accurate vs intentionally simplified,
  - how rendering + curvature visualization works,
  - how to add a new body and tweak parameters.

## Design guidance (non-binding)

- Prefer a simple UI: "Add body" panel + list of bodies with edit/delete.
- Keep code modular (renderer, simulation, UI, utils).
```

## Case03

生成网页游戏“愤怒的小鸟”。

提示词

```markdown
Create a one-level Angry Birds style browser game with slingshot projectile physics.

## Requirements:

- Drag-to-aim slingshot mechanic.
- Projectile trajectory arc based on launch force and angle.
- Stack of destructible blocks.
- Score system and level reset.
- Runs without build tools in browser.
```

## Case04

目录`case04/starter`是一个基于 PHP 语言 Laravel 框架的 Web 应用，将其改为基于 JavaScript 语言 Next.js 框架。

提示词

```markdown
Migrate this Laravel app to Next.js.

The source Laravel app is in ../starter

Create your Next.js app in this directory.

## Requirements:

1. Keep same functionality:
  - CRUD operations (create, read, update, delete)
  - Search/filter contacts
  - Toggle favorites
  - Contact detail panel
2. Keep same visual design (copy Tailwind classes from Angular templates)
3. Proper state management (Context API or useState)
4. Preserve all animations and responsive design

The Next.js app should work identically - same features, same look, same behavior.

Start by analyzing the Laravel app structure, then create the Next.js equivalent.
```

Credits: [laravel-to-nextjs-migration-eval](https://github.com/alejandro-ao/laravel-to-nextjs-migration-eval)

## Case05

生成“[麦克斯韦小恶魔](https://zh.wikipedia.org/wiki/%E9%BA%A6%E5%85%8B%E6%96%AF%E9%9F%A6%E5%A6%96)”实验的网页模拟器。

提示词

```markdown
# Maxwell Demon HTML Simulation: two chambers, particles, real-time temps, entropy, chart

- Two chambers separated by a wall with a small gate
- 100+ particles bouncing with elastic collisions
- Particle color = velocity (blue=slow/cold, red=fast/hot)
- Initially: both chambers have mixed temperatures

## The Demon:
- Guards the gate between chambers
- Opens gate to let FAST particles move RIGHT
- Opens gate to let SLOW particles move LEFT
- Visualize the demon (small sprite or icon at the gate)

## Display:
- Real-time temperature (avg velocity) for each chamber
- Live chart showing temperature divergence over time
- Particle count per chamber
- Entropy indicator (decreasing = "violation")

## Controls:
- Start/Pause
- Reset
- Toggle demon ON/OFF (to show natural equilibrium vs demon)
- Speed slider

Style: Dark background, glowing particles, smooth animations.
Use vanilla JS + Canvas, no libraries except Chart.js for the graph.
```

## 来源

- Alejandro AO, [GPT-5.3 Codex vs Claude Opus 4.6: Real Coding Tasks](https://www.youtube.com/watch?v=c31Ow23mErE)
- Alejandro AO, [Kimi Code vs Claude Code vs Codex - NEW Best For Coding?](https://www.youtube.com/watch?v=IjjMsfhJEcE)

