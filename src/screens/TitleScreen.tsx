// PHÄNOMENAUTIK — Titelbildschirm + Intro-Sequenz

import { useEffect, useRef, useState } from "react";
import { DISCLAIMER, INTRO_TEXT } from "../game/data";
import { drawSeaTile, drawShip } from "../game/sprites";
import { audio } from "../game/audio";

interface TitleScreenProps {
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: () => void;
}

export function TitleScreen({ hasSave, onContinue, onNewGame }: TitleScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [introLine, setIntroLine] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const w = (canvas.width = canvas.clientWidth);
      const h = (canvas.height = canvas.clientHeight);
      const storm = 0.25 + Math.sin(t * 0.11) * 0.2;
      drawSeaTile(ctx, t * 30, t * 12, w, h, t, Math.max(0, storm));
      // einsames Schiff, das über den Titel schippert
      const sx = ((t * 40) % (w + 300)) - 150;
      drawShip(ctx, sx, h * 0.72 + Math.sin(t * 0.8) * 10, Math.PI / 2 + Math.sin(t * 0.5) * 0.1, t, 1.6);
      // Nebel-Vignette
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h);
      vg.addColorStop(0, "rgba(8, 12, 24, 0)");
      vg.addColorStop(1, "rgba(8, 12, 24, 0.6)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const advanceIntro = () => {
    audio.select();
    if (introLine + 1 < INTRO_TEXT.length) setIntroLine(introLine + 1);
    else onNewGame();
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {!showIntro ? (
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-8 p-6">
          <div className="text-center">
            <div className="mb-2 text-xs tracking-[0.5em] text-sky-200/70">EIN TRAUMAATLAS-SPIEL</div>
            <h1 className="title-logo text-5xl sm:text-7xl">PHÄNOMENAUTIK</h1>
            <div className="mt-3 text-sm italic text-sky-100/80 sm:text-base">
              Die Phänomene sind Inseln. Du hast ein Schiff.
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            {hasSave && (
              <button
                className="eb-btn px-8 py-3 text-lg tracking-wider"
                onClick={() => {
                  audio.startSea();
                  audio.confirm();
                  onContinue();
                }}
              >
                ⛵ Weiterreisen
              </button>
            )}
            <button
              className="eb-btn px-8 py-3 text-lg tracking-wider"
              onClick={() => {
                audio.startSea();
                audio.confirm();
                setShowIntro(true);
              }}
            >
              🌊 Neue Reise
            </button>
          </div>

          <p className="max-w-md text-center text-[11px] leading-relaxed text-sky-200/50">{DISCLAIMER}</p>
        </div>
      ) : (
        <button className="relative z-10 flex h-full w-full cursor-pointer items-center justify-center p-6" onClick={advanceIntro}>
          <div className="eb-panel max-w-xl px-8 py-6">
            <div className="min-h-[120px] text-center text-base leading-relaxed text-sky-50 sm:text-lg">
              {INTRO_TEXT.slice(0, introLine + 1).map((l, i) => (
                <div key={i} className={i === introLine ? "text-amber-100" : "text-sky-200/50"}>
                  {l || " "}
                </div>
              ))}
            </div>
            <div className="mt-4 text-center text-xs text-sky-300/60">
              {introLine + 1 < INTRO_TEXT.length ? "Klicken zum Weiterlesen ▼" : "Klicken zum Ablegen ⛵"}
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
