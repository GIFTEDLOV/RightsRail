# Frontend architecture

The web app is a Vite + React + TypeScript client on port 3001. It is split
into a small API adapter, reusable presentation primitives, route-level views,
and a single design-token stylesheet.

## Boundaries

- `src/api.ts` owns typed API envelopes and semantic labels.
- `src/components.tsx` owns reusable shell, status, media, evidence, matrix,
  ledger, and audit primitives.
- `src/main.tsx` owns route composition and local workflow behavior.
- `src/styles.css` owns responsive tokens, layout, focus states, and reduced
  motion behavior.

The client never invents canonical values. Provider provenance is displayed at
the shell level and in high-risk detail surfaces. The current local workflow
can prepare a draft or request locally; it never simulates a contract freeze or
broadcast.

## Responsive/accessibility contract

The comparison is two columns on wide screens and stacks protected media before
proposed media below 768px. Hashes wrap in `code` blocks, no content requires
horizontal scrolling, focus rings are visible, controls have labels, headings
are semantic, and result status has text plus color. Reduced motion disables
the decorative scan animation.
