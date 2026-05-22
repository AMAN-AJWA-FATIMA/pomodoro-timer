# Pomodoro Timer

A focused, production-grade Pomodoro timer with daily session history.

## Live Demo

> Deploy to Vercel : see deployment steps below.

---

## Run Locally

### Prerequisites
- Node.js 18+ (`node -v` to check)
- npm 9+

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/AMAN-AJWA-FATIMA/pomodoro-timer.git
cd pomodoro-timer

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
npm run preview   # preview the production build locally
```

### Deploy to Vercel (one command)

```bash
npx vercel --prod
```

---

## Tech Stack

- **React 18** + **Vite** : fast dev experience, minimal config
- **Vanilla CSS** via a style injection pattern  no CSS-in-JS overhead
- **Web Audio API** : no external audio dependencies
- `localStorage` : session history persists across reloads, auto-resets on new day

---

## Features

- ⏱ Configurable focus (1–60 min) and break (1–30 min) durations
- ▶ Start / Pause / Resume / Reset controls
- 🔔 Audible chime on cycle completion (ascending for focus end, descending for break end)
- 🔄 Auto-transition focus → break → focus
- 📋 Daily session history with timestamps, persisted in localStorage
- 🎨 Live color theme switch between focus (warm red) and break (cool teal) modes
- ♿ Keyboard navigable, ARIA-labeled, focus-visible rings throughout
