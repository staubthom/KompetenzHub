'use client';

import { useEffect, useMemo } from 'react';

/**
 * Vollbild-Motivationsanimation nach erfolgreicher Einreichung.
 * 10 zufällige Effekte – welcher erscheint, ist zufällig. Reines CSS/JS.
 */
export const EFFECT_COUNT = 10;

export function randomEffect(): number {
  return Math.floor(Math.random() * EFFECT_COUNT);
}

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0d9488', '#e11d48'];
const rnd = (min: number, max: number) => min + Math.random() * (max - min);

export default function Celebration({ effect, onDone }: { effect: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="celebrate" aria-hidden="true">
      {renderEffect(effect)}
    </div>
  );
}

function renderEffect(effect: number) {
  switch (effect) {
    case 0:
      return <Confetti />;
    case 1:
      return <Rocket />;
    case 2:
      return <ShootingStars />;
    case 3:
      return <Balloons />;
    case 4:
      return <EmojiRain emoji="🎉" />;
    case 5:
      return <Fireworks />;
    case 6:
      return <BigEmoji emoji="👍" />;
    case 7:
      return <Hearts />;
    case 8:
      return <Trophy />;
    default:
      return <SuperText />;
  }
}

/* 0 – Konfetti */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 120 }, (_, i) => ({
        id: i,
        left: rnd(0, 100),
        delay: rnd(0, 0.8),
        dur: rnd(1.8, 3),
        color: COLORS[i % COLORS.length],
        rot: rnd(0, 360),
      })),
    [],
  );
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="cf-piece"
          style={{
            left: `${p.left}vw`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </>
  );
}

/* 1 – Rakete fliegt durch */
function Rocket() {
  return (
    <div className="cl-rocket">
      🚀
      <span className="cl-rocket-trail" />
    </div>
  );
}

/* 2 – Sternschnuppen */
function ShootingStars() {
  const stars = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({ id: i, top: rnd(0, 60), delay: rnd(0, 1.2) })),
    [],
  );
  return (
    <>
      {stars.map((s) => (
        <span
          key={s.id}
          className="cl-star"
          style={{ top: `${s.top}vh`, animationDelay: `${s.delay}s` }}
        />
      ))}
    </>
  );
}

/* 3 – Ballons steigen */
function Balloons() {
  const balloons = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: rnd(0, 100),
        delay: rnd(0, 1),
        dur: rnd(2.5, 4),
        emoji: ['🎈', '🎈', '🎈'][i % 3],
      })),
    [],
  );
  return (
    <>
      {balloons.map((b) => (
        <span
          key={b.id}
          className="cl-balloon"
          style={{
            left: `${b.left}vw`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
          }}
        >
          {b.emoji}
        </span>
      ))}
    </>
  );
}

/* 4 / via prop – Emoji-Regen */
function EmojiRain({ emoji }: { emoji: string }) {
  const drops = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: rnd(0, 100),
        delay: rnd(0, 1.5),
        dur: rnd(2, 3.5),
        size: rnd(18, 40),
      })),
    [],
  );
  return (
    <>
      {drops.map((d) => (
        <span
          key={d.id}
          className="cl-emoji-drop"
          style={{
            left: `${d.left}vw`,
            fontSize: `${d.size}px`,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.dur}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </>
  );
}

/* 5 – Feuerwerk */
function Fireworks() {
  const bursts = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        left: rnd(15, 85),
        top: rnd(15, 55),
        delay: rnd(0, 1.6),
        color: COLORS[i % COLORS.length],
      })),
    [],
  );
  return (
    <>
      {bursts.map((b) => (
        <div
          key={b.id}
          className="cl-firework"
          style={{ left: `${b.left}vw`, top: `${b.top}vh`, animationDelay: `${b.delay}s` }}
        >
          {Array.from({ length: 12 }, (_, j) => (
            <span
              key={j}
              className="cl-spark"
              style={{ background: b.color, transform: `rotate(${j * 30}deg) translateY(-40px)` }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

/* 6 / via prop – grosses Emoji */
function BigEmoji({ emoji }: { emoji: string }) {
  return <div className="cl-big-emoji">{emoji}</div>;
}

/* 7 – Herzen */
function Hearts() {
  const hearts = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: rnd(0, 100),
        delay: rnd(0, 1.5),
        dur: rnd(2.2, 3.6),
        size: rnd(16, 38),
      })),
    [],
  );
  return (
    <>
      {hearts.map((h) => (
        <span
          key={h.id}
          className="cl-heart"
          style={{
            left: `${h.left}vw`,
            fontSize: `${h.size}px`,
            animationDelay: `${h.delay}s`,
            animationDuration: `${h.dur}s`,
          }}
        >
          ❤️
        </span>
      ))}
    </>
  );
}

/* 8 – Trophäe mit Funkeln */
function Trophy() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: rnd(35, 65),
        top: rnd(30, 60),
        delay: rnd(0, 1),
      })),
    [],
  );
  return (
    <>
      <div className="cl-trophy">🏆</div>
      {sparks.map((s) => (
        <span
          key={s.id}
          className="cl-twinkle"
          style={{ left: `${s.left}vw`, top: `${s.top}vh`, animationDelay: `${s.delay}s` }}
        >
          ✨
        </span>
      ))}
    </>
  );
}

/* 9 – „Super!“ Text-Zoom mit Strahlen */
function SuperText() {
  return (
    <div className="cl-super">
      <div className="cl-super-rays" />
      <span className="cl-super-text">Super! 🎓</span>
    </div>
  );
}
