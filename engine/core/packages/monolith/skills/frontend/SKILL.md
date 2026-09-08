---
name: frontend
description: Build and change user interfaces - components, state, styling, forms, responsiveness, accessibility. Use for React, Vue, Svelte or plain DOM work, and for any request to build a page, screen, component or UI feature.
whenToUse: The task is user-facing interface code.
metadata:
  category: engineering
  version: 1.0.0
  license: MIT
---

# Frontend work

## Match the codebase before writing anything

Read two or three neighbouring components first. Copy their conventions:
file layout, naming, state approach, styling system, how they handle loading and
errors. A technically better component in a foreign style makes the codebase
worse.

Check for a design system - tokens, theme file, existing primitives - and use
it. Never hand-roll a button that already exists.

## What a finished component includes

A component is not done when the happy path renders.

| State | Must be handled |
|---|---|
| Loading | a skeleton or spinner, not a blank frame |
| Empty | says what would fill it and how |
| Error | what went wrong and what to do, not a raw message |
| Long content | wraps or scrolls in its own container, never clips |

## Accessibility is not a pass at the end

- Semantic elements first: `<button>` for actions, `<a>` for navigation. A
  clickable `<div>` is a bug - it breaks keyboard and screen readers.
- Every input has a label. Placeholder text is not a label.
- Visible focus state on everything interactive.
- Colour is never the only signal - pair it with text or an icon.
- Respect `prefers-reduced-motion`.

## State

Keep state as local as it can live. Lift it only when a second component
genuinely needs it. Reaching for global state early is the commonest cause of
components that cannot be reused or tested.

Server data is not UI state: cache it, key it, and handle its loading and error
cases as data, not as booleans scattered through the component.

## Styling

- Layout with flex or grid and `gap`, not per-element margins that collapse.
- Relative units and `max-width: 100%` on media.
- Wide content gets `overflow-x: auto` on its own container so the page never
  scrolls sideways.
- Watch specificity. Classes that silently cancel each other out are the hardest
  CSS bug to find.

## Verify it renders

Do not report a UI change as working without seeing it. Run the app, open the
route, look at it. A component that compiles is not a component that works.

## Related

- `ux-review` to critique a flow rather than build one
- `testing` for component and interaction tests
- `backend-api` for the endpoints behind it
