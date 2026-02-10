# Landing Page Improvement Eval Baseline

This repository is a testbed for evaluating AI agent capabilities on frontend design tasks.

The starting point (`index.html` + `styles.css`) is intentionally bad:
- weak visual hierarchy and inconsistent typography
- dated/unpolished UI decisions
- accessibility issues
- fixed-width layout and poor responsive behavior (`min-width: 1460px`)

The goal is to use this baseline to compare how different models/agents improve the same page under the same constraints.

## Why This Repo Exists

Use this repo to benchmark model behavior on practical frontend redesign work:
- taking a low-quality landing page to production-level quality
- preserving product message while improving UX and conversion structure
- making the page responsive and more accessible
- comparing design quality differences between models from a shared baseline

## Baseline Files

- `index.html`: intentionally weak landing page structure/content
- `styles.css`: intentionally poor styling and non-responsive CSS

## Suggested Evaluation Flow

1. Start from the repo as-is.
2. Run the same prompt (or prompt set) against multiple models.
3. Compare outputs on:
   - visual design quality
   - responsive behavior
   - accessibility and semantics
   - conversion-focused structure (hero, CTA, pricing, trust)
4. Record qualitative notes and any measurable differences.

## Prompt Examples And Model Behavior

These are prompts already tested in this repo, with observed behavior:

### Prompt 1

```text
/frontend-design improve the design of this website
```

- Claude: works well
- Codex (gpt5.3, gpt5.2): works poorly; output feels too dull

### Prompt 2

```text
improve the design of this website. use a similar design system to airbnb.
```

- Claude: works well
- Codex: works okay, but still too dull

### Prompt 3 (more constrained)

```text
Improve an existing SaaS landing page into a production-quality, conversion-focused page while keeping the same core product message.

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

Observed result:
- Claude Code (Opus 4.5/4.6): still much better and more professional

Note: Codex performs marginally better on front-end tasks when instructed to use tailwind. Stlags far behind Opus 4.5/4.6 in quality, though. 
