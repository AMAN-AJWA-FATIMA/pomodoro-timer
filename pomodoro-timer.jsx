import { useState, useEffect, useRef, useCallback } from "react";

// ─── Utility ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "pomodoro_history_v1";

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-05-21"
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const { date, sessions } = JSON.parse(raw);
    if (date !== todayKey()) return [];
    return sessions;
  } catch {
    return [];
  }
}

function saveHistory(sessions) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ date: todayKey(), sessions })
  );
}

function fmt(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ─── Audio ───────────────────────────────────────────────────────────────────
function playChime(ctx, type = "focus") {
  if (!ctx) return;
  const freqs = type === "focus" ? [523, 659, 784, 1047] : [784, 659, 523, 392];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + i * 0.18 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.45);
    osc.start(ctx.currentTime + i * 0.18);
    osc.stop(ctx.currentTime + i * 0.18 + 0.5);
  });
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Unbounded:wght@200;400;700;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --focus-bg:    #0d0d10;
    --focus-fg:    #e8e0d5;
    --focus-acc:   #e85d3a;
    --focus-mid:   #2a1a16;
    --focus-ring:  #e85d3a;

    --break-bg:    #07100d;
    --break-fg:    #d5e8de;
    --break-acc:   #3acea8;
    --break-mid:   #0d2a22;
    --break-ring:  #3acea8;

    --pause-acc:   #c9a84c;

    --bg:    var(--focus-bg);
    --fg:    var(--focus-fg);
    --acc:   var(--focus-acc);
    --mid:   var(--focus-mid);
    --ring:  var(--focus-ring);

    --font-display: 'Unbounded', sans-serif;
    --font-mono:    'DM Mono', monospace;

    transition: background 0.8s, color 0.8s;
  }
  :root.break-mode {
    --bg:  var(--break-bg);
    --fg:  var(--break-fg);
    --acc: var(--break-acc);
    --mid: var(--break-mid);
    --ring: var(--break-ring);
  }

  html, body, #root {
    height: 100%;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font-mono);
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 2rem 1rem 4rem;
    gap: 0;
    background: var(--bg);
    transition: background 0.8s;
    position: relative;
    overflow: hidden;
  }

  /* Atmospheric noise grain */
  .app::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 180px 180px;
    pointer-events: none;
    opacity: 0.5;
    z-index: 0;
  }

  .app > * { position: relative; z-index: 1; }

  /* ── Header ── */
  .header {
    width: 100%;
    max-width: 520px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 3rem;
    padding-top: 0.5rem;
  }
  .logo {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: clamp(1rem, 3vw, 1.2rem);
    letter-spacing: -0.02em;
    color: var(--acc);
    text-transform: uppercase;
  }
  .mode-badge {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 500;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--acc);
    opacity: 0.7;
    transition: color 0.8s, opacity 0.3s;
  }

  /* ── Timer Ring ── */
  .timer-wrap {
    position: relative;
    width: min(64vw, 300px);
    aspect-ratio: 1;
    margin-bottom: 2.8rem;
  }
  .ring-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    overflow: visible;
  }
  .ring-bg {
    fill: none;
    stroke: var(--mid);
    stroke-width: 3;
    transition: stroke 0.8s;
  }
  .ring-prog {
    fill: none;
    stroke: var(--ring);
    stroke-width: 3;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.95s cubic-bezier(.4,0,.2,1), stroke 0.8s;
    filter: drop-shadow(0 0 6px var(--ring));
  }
  .ring-prog.paused {
    stroke: var(--pause-acc);
    filter: drop-shadow(0 0 6px var(--pause-acc));
    stroke-dasharray: 6 6;
  }

  .timer-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
  }
  .timer-display {
    font-family: var(--font-display);
    font-weight: 200;
    font-size: clamp(2.8rem, 11vw, 4.4rem);
    letter-spacing: -0.04em;
    line-height: 1;
    color: var(--fg);
    transition: color 0.5s;
    font-variant-numeric: tabular-nums;
  }
  .timer-display.paused {
    color: var(--pause-acc);
  }
  .timer-label {
    font-size: 0.62rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    opacity: 0.45;
  }

  /* flash on complete */
  @keyframes ring-pulse {
    0%, 100% { opacity: 1; }
    40%       { opacity: 0.15; }
  }
  .timer-wrap.done .ring-prog { animation: ring-pulse 0.5s ease 3; }

  /* ── Controls ── */
  .controls {
    display: flex;
    align-items: center;
    gap: 1.1rem;
    margin-bottom: 2.5rem;
  }
  .btn {
    border: none;
    cursor: pointer;
    font-family: var(--font-mono);
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: transform 0.12s, background 0.2s, color 0.2s, box-shadow 0.2s;
    outline: none;
  }
  .btn:focus-visible {
    outline: 2px solid var(--acc);
    outline-offset: 3px;
  }
  .btn:active { transform: scale(0.95); }

  .btn-main {
    background: var(--acc);
    color: var(--bg);
    font-size: 0.8rem;
    padding: 0.85rem 2.4rem;
    border-radius: 100px;
    min-width: 120px;
    box-shadow: 0 0 20px -4px var(--acc);
    transition: background 0.8s, color 0.3s, box-shadow 0.8s, transform 0.12s;
  }
  .btn-main:hover {
    box-shadow: 0 0 32px -2px var(--acc);
    transform: scale(1.04);
  }
  .btn-ghost {
    background: transparent;
    color: var(--fg);
    font-size: 0.72rem;
    padding: 0.7rem 1.2rem;
    border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.12);
    opacity: 0.6;
  }
  .btn-ghost:hover { opacity: 1; border-color: var(--acc); color: var(--acc); }

  /* ── Settings ── */
  .settings-row {
    display: flex;
    gap: 2rem;
    margin-bottom: 2.8rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  .setting {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
  }
  .setting label {
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.4;
  }
  .setting-inner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--mid);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px;
    padding: 0.3rem 0.5rem;
    transition: background 0.8s;
  }
  .setting-inner button {
    background: none;
    border: none;
    color: var(--acc);
    cursor: pointer;
    font-size: 1rem;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.15s;
    font-family: var(--font-mono);
  }
  .setting-inner button:hover { background: rgba(255,255,255,0.08); }
  .setting-inner button:focus-visible { outline: 2px solid var(--acc); outline-offset: 1px; }
  .setting-val {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 700;
    min-width: 2.2ch;
    text-align: center;
    color: var(--fg);
  }

  /* ── History ── */
  .history-section {
    width: 100%;
    max-width: 520px;
  }
  .history-header {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    margin-bottom: 1rem;
  }
  .history-title {
    font-size: 0.62rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    opacity: 0.35;
  }
  .history-count {
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    background: var(--acc);
    color: var(--bg);
    padding: 0.15rem 0.55rem;
    border-radius: 100px;
    opacity: 0.85;
    font-weight: 500;
    transition: background 0.8s, color 0.8s;
  }
  .history-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .history-item {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.7rem 0.9rem;
    background: var(--mid);
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.05);
    font-size: 0.78rem;
    animation: fadeSlideIn 0.35s cubic-bezier(.22,1,.36,1) both;
    transition: background 0.8s;
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .history-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--acc);
    flex-shrink: 0;
    box-shadow: 0 0 6px var(--acc);
    transition: background 0.8s, box-shadow 0.8s;
  }
  .history-dur { font-weight: 500; color: var(--fg); }
  .history-sep { opacity: 0.2; }
  .history-type { opacity: 0.45; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.68rem; }
  .history-time { margin-left: auto; opacity: 0.3; font-size: 0.68rem; }

  .history-empty {
    text-align: center;
    font-size: 0.72rem;
    opacity: 0.2;
    padding: 1.5rem 0;
    letter-spacing: 0.1em;
  }

  /* ── Completion flash overlay ── */
  @keyframes flash-overlay {
    0%   { opacity: 0; }
    15%  { opacity: 0.18; }
    100% { opacity: 0; }
  }
  .flash {
    position: fixed;
    inset: 0;
    background: var(--acc);
    pointer-events: none;
    animation: flash-overlay 0.9s ease-out both;
    z-index: 10;
  }

  /* ── Responsive ── */
  @media (max-width: 400px) {
    .header { margin-bottom: 2rem; }
    .timer-wrap { width: min(78vw, 260px); margin-bottom: 2rem; }
    .controls { gap: 0.8rem; }
    .btn-main { padding: 0.75rem 1.8rem; font-size: 0.75rem; }
    .settings-row { gap: 1.2rem; }
  }
  @media (min-width: 1024px) {
    .app { justify-content: center; padding: 2rem 2rem 3rem; }
    .timer-wrap { width: min(38vw, 320px); }
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────
export default function PomodoroApp() {
  const [focusMins, setFocusMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [phase, setPhase]   = useState("focus"); // "focus" | "break"
  const [status, setStatus] = useState("idle");  // "idle" | "running" | "paused"
  const [seconds, setSeconds] = useState(25 * 60);
  const [history, setHistory] = useState(loadHistory);
  const [flash, setFlash]     = useState(false);
  const [doneAnim, setDoneAnim] = useState(false);

  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);
  const totalRef    = useRef(focusMins * 60);

  // Sync document class for CSS theme
  useEffect(() => {
    document.documentElement.classList.toggle("break-mode", phase === "break");
  }, [phase]);

  // Keep total in sync when settings change (only if idle)
  useEffect(() => {
    if (status === "idle") {
      const t = phase === "focus" ? focusMins * 60 : breakMins * 60;
      totalRef.current = t;
      setSeconds(t);
    }
  }, [focusMins, breakMins, phase, status]);

  // Inject CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const handleComplete = useCallback((completedPhase) => {
    clearTimer();
    const ctx = getAudioCtx();
    playChime(ctx, completedPhase);
    setFlash(true);
    setDoneAnim(true);
    setTimeout(() => { setFlash(false); setDoneAnim(false); }, 900);

    if (completedPhase === "focus") {
      const entry = {
        id: Date.now(),
        duration: fmt(focusMins * 60),
        mins: focusMins,
        ts: Date.now(),
      };
      setHistory(prev => {
        const next = [entry, ...prev];
        saveHistory(next);
        return next;
      });
      // Transition to break
      const breakTotal = breakMins * 60;
      totalRef.current = breakTotal;
      setPhase("break");
      setSeconds(breakTotal);
    } else {
      // Transition back to focus
      const focusTotal = focusMins * 60;
      totalRef.current = focusTotal;
      setPhase("focus");
      setSeconds(focusTotal);
    }
    setStatus("idle");
  }, [clearTimer, getAudioCtx, focusMins, breakMins]);

  const startTimer = useCallback((overrideSecs) => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setStatus("running");
  }, [clearTimer]);

  // Watch for zero
  const completingRef = useRef(false);
  useEffect(() => {
    if (seconds === 0 && status === "running" && !completingRef.current) {
      completingRef.current = true;
      handleComplete(phase);
      setTimeout(() => { completingRef.current = false; }, 500);
    }
  }, [seconds, status, phase, handleComplete]);

  const handleStart = () => {
    getAudioCtx(); // unlock audio on user gesture
    if (status === "idle") {
      totalRef.current = seconds;
      startTimer();
    } else if (status === "paused") {
      startTimer();
    }
  };

  const handlePause = () => {
    clearTimer();
    setStatus("paused");
  };

  const handleReset = () => {
    clearTimer();
    setStatus("idle");
    setPhase("focus");
    const t = focusMins * 60;
    totalRef.current = t;
    setSeconds(t);
    document.documentElement.classList.remove("break-mode");
  };

  const changeFocus = (delta) => {
    if (status !== "idle") return;
    setFocusMins(v => Math.max(1, Math.min(60, v + delta)));
  };
  const changeBreak = (delta) => {
    if (status !== "idle") return;
    setBreakMins(v => Math.max(1, Math.min(30, v + delta)));
  };

  // Progress
  const total    = totalRef.current || 1;
  const progress = Math.max(0, Math.min(1, seconds / total));
  const R        = 46; // radius in SVG units (viewBox 0 0 100 100)
  const circ     = 2 * Math.PI * R;
  const offset   = circ * (1 - progress);

  const mainLabel = status === "running" ? "Pause"
                  : status === "paused"  ? "Resume"
                  : "Start";

  const phaseLabel = phase === "focus"
    ? (status === "paused" ? "Paused · Focus" : status === "running" ? "Focusing" : "Ready")
    : (status === "paused" ? "Paused · Break" : status === "running" ? "On Break" : "Break");

  return (
    <div className="app" role="main">
      {flash && <div className="flash" aria-hidden="true" />}

      <header className="header">
        <span className="logo">Pomo</span>
        <span className="mode-badge" aria-live="polite">{phaseLabel}</span>
      </header>

      {/* Timer Ring */}
      <div className={`timer-wrap${doneAnim ? " done" : ""}`} aria-label={`Timer: ${fmt(seconds)} remaining`}>
        <svg className="ring-svg" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="ring-bg" cx="50" cy="50" r={R} />
          <circle
            className={`ring-prog${status === "paused" ? " paused" : ""}`}
            cx="50" cy="50" r={R}
            strokeDasharray={status === "paused" ? undefined : `${circ}`}
            strokeDashoffset={status === "paused" ? undefined : offset}
          />
        </svg>
        <div className="timer-center">
          <div
            className={`timer-display${status === "paused" ? " paused" : ""}`}
            aria-live="off"
          >
            {fmt(seconds)}
          </div>
          <div className="timer-label">{phase === "focus" ? "focus" : "break"}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls" role="group" aria-label="Timer controls">
        {status === "running" ? (
          <button className="btn btn-main" onClick={handlePause} aria-label="Pause timer">
            Pause
          </button>
        ) : (
          <button className="btn btn-main" onClick={handleStart} aria-label={mainLabel + " timer"}>
            {mainLabel}
          </button>
        )}
        <button
          className="btn btn-ghost"
          onClick={handleReset}
          aria-label="Reset timer"
          disabled={status === "idle" && phase === "focus" && seconds === focusMins * 60}
        >
          Reset
        </button>
      </div>

      {/* Settings — only active when idle */}
      <div className="settings-row" aria-label="Timer settings" role="group">
        <div className="setting">
          <label id="focus-label">Focus</label>
          <div className="setting-inner">
            <button
              onClick={() => changeFocus(-1)}
              aria-label="Decrease focus minutes"
              aria-describedby="focus-label"
              disabled={status !== "idle"}
            >−</button>
            <span className="setting-val" aria-live="polite">{focusMins}</span>
            <button
              onClick={() => changeFocus(1)}
              aria-label="Increase focus minutes"
              aria-describedby="focus-label"
              disabled={status !== "idle"}
            >+</button>
          </div>
        </div>
        <div className="setting">
          <label id="break-label">Break</label>
          <div className="setting-inner">
            <button
              onClick={() => changeBreak(-1)}
              aria-label="Decrease break minutes"
              aria-describedby="break-label"
              disabled={status !== "idle"}
            >−</button>
            <span className="setting-val" aria-live="polite">{breakMins}</span>
            <button
              onClick={() => changeBreak(1)}
              aria-label="Increase break minutes"
              aria-describedby="break-label"
              disabled={status !== "idle"}
            >+</button>
          </div>
        </div>
      </div>

      {/* Session History */}
      <section className="history-section" aria-label="Today's session history">
        <div className="history-header">
          <span className="history-title">Today</span>
          {history.length > 0 && (
            <span className="history-count" aria-label={`${history.length} sessions completed`}>
              {history.length} {history.length === 1 ? "session" : "sessions"}
            </span>
          )}
        </div>
        {history.length === 0 ? (
          <p className="history-empty">No sessions yet — start your first focus block</p>
        ) : (
          <ul className="history-list">
            {history.map((s) => (
              <li key={s.id} className="history-item">
                <span className="history-dot" aria-hidden="true" />
                <span className="history-dur">{s.duration}</span>
                <span className="history-sep" aria-hidden="true">·</span>
                <span className="history-type">Focus</span>
                <span className="history-time">{fmtTime(s.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
