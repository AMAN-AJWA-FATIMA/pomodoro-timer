# ANSWERS.md

---

## 1. How to run

**Prerequisites:** Node.js 18+, npm 9+

```bash
git clone https://github.com/your-username/pomodoro-timer.git
cd pomodoro-timer
npm install
npm run dev
# → http://localhost:5173
```

**Production build:**
```bash
npm run build && npm run preview
```

**Deploy:**
```bash
npx vercel --prod
```

Deployed URL: *(add after deploying)*

---

## 2. Stack & design choices

**Stack: React 18 + Vite + Vanilla CSS (injected)**

React was the right call here because the timer has multiple layers of interdependent state — phase (focus/break), status (idle/running/paused), seconds remaining, and the history list — that all need to react to each other. `useEffect` and `useRef` let me handle the interval lifecycle cleanly without leaks, which matters a lot for a timer where one stale closure kills accuracy. Vite gives instant HMR so I could feel the timer in real-time while building.

I deliberately avoided any CSS framework. CSS custom properties let me hot-swap the entire color palette in one line (`document.documentElement.classList.toggle("break-mode", ...)`) with smooth transitions on every element simultaneously. A framework would have made that harder, not easier.

**Visual decision 1 — The SVG ring at 60% of the smaller viewport dimension**

The ring is sized with `min(64vw, 300px)`. I wanted the timer to feel like the main event on any screen, not a small widget in a corner. At 64vw on a 360px phone it's 230px — large enough to read across a desk. The progress arc drains from the top (via `rotate(-90deg)`) so the empty arc empties clockwise, which is how every clock on earth works. The dashed stroke on pause was a deliberate choice: it communicates "paused" through texture alone, without needing a label change.

**Visual decision 2 — Warm red for focus, cool teal for break, full-screen theme swap**

I assigned two complete color palettes (CSS variables for bg, fg, accent, mid, ring) and transition them all simultaneously over 0.8s when the phase changes. This affects the header badge, ring glow, history dots, button shadow, settings background, and body — everything shifts at once. The idea is that you don't just see a timer tick; you *feel* the mode change. The specific colors were chosen for contrast (both pass WCAG AA against their dark backgrounds) and psychological association — red/orange raises alertness, green/teal signals rest.

---

## 3. Responsive & accessibility

**Responsive behavior:**

On a 360px phone, the timer ring uses `min(64vw, 300px)` = ~230px, the controls stack comfortably in a single row because I used `gap` not margin, and the settings row wraps gracefully with `flex-wrap: wrap`. I tested at 360px and the layout doesn't scroll horizontally or clip anything.

On a 1440px laptop, `justify-content: center` kicks in via a media query (≥1024px) so the timer sits in the vertical middle of the viewport rather than flush to the top. The ring caps at 320px so it doesn't balloon into an unusable size.

**Accessibility consideration I handled:**

All interactive elements have `:focus-visible` rings in the accent color — they're suppressed on mouse click (using the `focus-visible` pseudo-class, not `focus`) but appear clearly for keyboard users. The timer countdown carries `aria-live="polite"` on the mode badge so screen readers announce phase changes without reading every second tick. The timer display itself is `aria-live="off"` (announcing every second would be maddening) but the `aria-label` on the wrapper provides the current time on focus. Settings buttons use `aria-label` + `aria-describedby` to produce "Decrease focus minutes, Focus" rather than just "−".

**Accessibility I knowingly skipped:**

I did not add a visual text alternative for the ring's progress percentage (e.g., "72% remaining" in a visually hidden span). The `aria-label` on the timer wrapper gives the raw time, which is equivalent information — but a screen reader user navigating with arrow keys would benefit from a progress readout. I skipped it to avoid cluttering the DOM and because the time value is more actionable than a percentage. Given another day I'd add a `<progress>` element visually hidden that updates every 10% threshold.

---

## 4. AI usage

**Tool used: Claude (Anthropic)**

**Where I used it:**

1. **Audio chime design** — I asked for a simple beep using the Web Audio API. The AI gave me a single oscillator with a linear gain ramp. I changed it to a 4-note ascending arpeggio for focus-end and a 4-note descending sequence for break-end, with each note offset by 180ms and an exponential decay. The original single beep felt harsh and binary; the arpeggio gives a satisfying "done" moment that varies by type.

2. **CSS variable theme swap** — I asked how to switch a full color theme on a `<body>` tag. The AI suggested toggling a `data-theme` attribute. I switched to `classList.toggle("break-mode")` on `document.documentElement` instead, because CSS custom property inheritance flows from `:root`, and I wanted `var()` references in every nested element to update automatically without any selector specificity games.

3. **`useEffect` timer interval** — The AI's first draft used `setInterval` inside `useEffect` without cleaning up correctly, which would have caused the interval to double-fire after hot reload. I added `clearInterval` in the cleanup return and moved the `intervalRef` to a `useRef` so it persists without triggering re-renders. This is a classic React pitfall and the AI's first attempt would have caused a drifting timer in development.

---

## 5. Honest gap

The settings controls (focus/break minutes) disable during a running or paused session, which is correct behavior — but there's no tooltip or visual explanation for *why* they're disabled. A user who tries to tap "+" during a focus block just sees nothing happen, with no feedback. The `disabled` attribute prevents interaction but the browser's default greying is subtle against the dark background.

With another day, I'd add a small tooltip on hover/focus of a disabled setting button — something like "Reset the timer to change duration" — using a CSS `::after` pseudo-element on the `.setting-inner` when it has a `[data-disabled]` attribute. I'd also consider allowing live duration changes that extend or shorten the current session, updating `totalRef` and recalculating the ring progress in place, which would be genuinely useful behavior.
