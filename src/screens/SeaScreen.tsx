// PHÄNOMENAUTIK — Seekarte: dynamisches Meer, Wetter, Sturmzellen, Anlanden

import { useEffect, useRef, useState, useCallback } from "react";
import { PHENOMENA } from "../game/data";
import type { PhenomenonDef } from "../game/data";
import { drawIsland, drawSeaTile, drawShip, drawWake, hsl } from "../game/sprites";
import { audio } from "../game/audio";
import { WORLD, type SaveGame } from "../game/state";

interface StormCell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  strength: number;
}

interface SeaScreenProps {
  save: SaveGame;
  onDock: (islandId: string) => void;
  onOpenJournal: () => void;
  onBackToTitle: () => void;
}

const DOCK_RADIUS = 150;
const ISLAND_SOLID = 60;

export function SeaScreen({ save, onDock, onOpenJournal, onBackToTitle }: SeaScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const [nearIsland, setNearIsland] = useState<PhenomenonDef | null>(null);
  const [weatherLabel, setWeatherLabel] = useState("Ruhige See");
  const [muted, setMuted] = useState(audio.isMuted);
  const [hud, setHud] = useState({ s: save.player.stability, p: save.player.presence });
  const saveRef = useRef(save);
  saveRef.current = save;

  const phenById = useCallback((id: string) => PHENOMENA.find((p) => p.id === id)!, []);

  const dock = useCallback(() => {
    if (!nearIsland) return;
    const st = saveRef.current.islands.find((i) => i.id === nearIsland.id)!;
    if (st.overcome) return;
    if (nearIsland.final && !saveRef.current.finalUnlocked) return;
    audio.dock();
    onDock(nearIsland.id);
  }, [nearIsland, onDock]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let running = true;

    // Schiffzustand
    const ship = {
      x: saveRef.current.ship.x,
      y: saveRef.current.ship.y,
      vx: 0,
      vy: 0,
      heading: -Math.PI / 2,
    };
    const trail: { x: number; y: number; age: number }[] = [];

    // Wetter
    let globalWeather = 0; // Ziel-Sturmintensität 0..0.6
    let weatherTimer = 6;
    const cells: StormCell[] = [
      { x: 900, y: 1800, vx: 14, vy: 6, r: 420, strength: 0.9 },
      { x: 3100, y: 1900, vx: -10, vy: 11, r: 360, strength: 0.75 },
      { x: 2100, y: 700, vx: 7, vy: 13, r: 300, strength: 0.65 },
    ];
    const rain: { x: number; y: number; l: number; v: number }[] = [];
    let lightning = 0; // Blitzhelligkeit 0..1
    let nextBolt = 5 + Math.random() * 6;
    let stormSmoothed = 0;

    const resize = () => {
      const parent = canvas.parentElement!;
      canvas.width = parent.clientWidth * devicePixelRatio;
      canvas.height = parent.clientHeight * devicePixelRatio;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      keysRef.current[e.key.toLowerCase()] = down;
      if (down && (e.key === "e" || e.key === "Enter" || e.key === " ")) {
        const near = lastNearRef.current;
        if (near) {
          const st = saveRef.current.islands.find((i) => i.id === near.id)!;
          if (!st.overcome && (!near.final || saveRef.current.finalUnlocked)) {
            audio.dock();
            onDockRef.current(near.id);
          }
        }
      }
      if (down && e.key.toLowerCase() === "j") onOpenJournalRef.current();
    };
    const kd = onKey(true);
    const ku = onKey(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    let last = performance.now();
    let hudTimer = 0;
    let t = 0;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // ── Wettermaschine ──
      weatherTimer -= dt;
      if (weatherTimer <= 0) {
        const roll = Math.random();
        globalWeather = roll < 0.45 ? 0 : roll < 0.8 ? 0.25 : 0.55;
        weatherTimer = 18 + Math.random() * 22;
      }
      for (const c of cells) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.x < -c.r) c.x = WORLD.w + c.r;
        if (c.x > WORLD.w + c.r) c.x = -c.r;
        if (c.y < -c.r) c.y = WORLD.h + c.r;
        if (c.y > WORLD.h + c.r) c.y = -c.r;
      }
      // lokale Sturmintensität am Schiff
      let localStorm = globalWeather;
      for (const c of cells) {
        const d = Math.hypot(ship.x - c.x, ship.y - c.y);
        if (d < c.r) localStorm = Math.max(localStorm, c.strength * (1 - d / c.r) * 1.3);
      }
      localStorm = Math.min(1, localStorm);
      stormSmoothed += (localStorm - stormSmoothed) * dt * 0.8;
      audio.setStormIntensity(stormSmoothed);

      // Blitze im Sturm
      if (stormSmoothed > 0.45) {
        nextBolt -= dt;
        if (nextBolt <= 0) {
          lightning = 1;
          nextBolt = 3 + Math.random() * 7 * (1.2 - stormSmoothed);
          audio.thunder();
        }
      }
      lightning = Math.max(0, lightning - dt * 2.2);

      // ── Schiffsphysik ──
      const k = keysRef.current;
      const thrust = (k["arrowup"] || k["w"] ? 1 : 0) - (k["arrowdown"] || k["s"] ? 0.5 : 0);
      const turn = (k["arrowright"] || k["d"] ? 1 : 0) - (k["arrowleft"] || k["a"] ? 1 : 0);
      ship.heading += turn * dt * 2.4;
      const power = 130 * (1 - stormSmoothed * 0.25);
      ship.vx += Math.cos(ship.heading) * thrust * power * dt;
      ship.vy += Math.sin(ship.heading) * thrust * power * dt;
      // Winddrift im Sturm
      ship.vx += Math.sin(t * 0.7) * stormSmoothed * 26 * dt;
      ship.vy += Math.cos(t * 0.5) * stormSmoothed * 26 * dt;
      // Reibung
      const drag = Math.pow(0.14, dt);
      ship.vx *= drag;
      ship.vy *= drag;
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      // Weltgrenzen
      ship.x = Math.max(40, Math.min(WORLD.w - 40, ship.x));
      ship.y = Math.max(40, Math.min(WORLD.h - 40, ship.y));

      // Kielwasser
      const speed = Math.hypot(ship.vx, ship.vy);
      if (speed > 20 && (trail.length === 0 || Math.hypot(ship.x - trail[trail.length - 1].x, ship.y - trail[trail.length - 1].y) > 12)) {
        trail.push({ x: ship.x, y: ship.y, age: 0 });
      }
      for (const p of trail) p.age += dt;
      while (trail.length && trail[0].age > 2.4) trail.shift();

      // Insel-Kollision + Nähe
      let near: PhenomenonDef | null = null;
      let nearDist = Infinity;
      for (const isl of saveRef.current.islands) {
        const d = Math.hypot(ship.x - isl.x, ship.y - isl.y);
        const def = phenById(isl.id);
        const solidR = def.final ? ISLAND_SOLID + 26 : ISLAND_SOLID;
        if (d < solidR) {
          // rausdrücken
          const nx = (ship.x - isl.x) / (d || 1);
          const ny = (ship.y - isl.y) / (d || 1);
          ship.x = isl.x + nx * solidR;
          ship.y = isl.y + ny * solidR;
          ship.vx *= -0.3;
          ship.vy *= -0.3;
        }
        if (d < DOCK_RADIUS && d < nearDist) {
          near = def;
          nearDist = d;
        }
      }
      if (near?.id !== lastNearRef.current?.id) {
        lastNearRef.current = near;
        setNearIsland(near);
      }

      // Schiffsposition im Save mitführen (alle paar Sekunden)
      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 1.2;
        saveRef.current.ship.x = Math.round(ship.x);
        saveRef.current.ship.y = Math.round(ship.y);
        setHud({ s: saveRef.current.player.stability, p: saveRef.current.player.presence });
        setWeatherLabel(
          stormSmoothed > 0.65 ? "Sturm!" : stormSmoothed > 0.35 ? "Schwere See" : stormSmoothed > 0.12 ? "Frischer Wind" : "Ruhige See",
        );
      }

      // ── Rendern ──
      const camX = ship.x - w / 2;
      const camY = ship.y - h / 2;

      drawSeaTile(ctx, camX, camY, w, h, t, stormSmoothed);

      ctx.save();
      ctx.translate(-camX, -camY);

      // Sturmzellen (dunkle Wolkenfelder in Weltkoordinaten)
      for (const c of cells) {
        const cg = ctx.createRadialGradient(c.x, c.y, c.r * 0.2, c.x, c.y, c.r);
        cg.addColorStop(0, `rgba(18, 22, 40, ${0.35 * c.strength})`);
        cg.addColorStop(1, "rgba(18, 22, 40, 0)");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Inseln
      for (const isl of saveRef.current.islands) {
        const def = phenById(isl.id);
        if (isl.x < camX - 160 || isl.x > camX + w + 160 || isl.y < camY - 200 || isl.y > camY + h + 200) continue;
        drawIsland(ctx, isl.x, isl.y, def, isl.seed, {
          t,
          overcome: isl.overcome,
          isFinal: !!def.final,
          locked: !!def.final && !saveRef.current.finalUnlocked,
        });
        // Name, wenn nah oder befriedet
        if (Math.hypot(ship.x - isl.x, ship.y - isl.y) < 320) {
          ctx.font = "600 14px ui-monospace, 'Courier New', monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(8, 12, 20, 0.65)";
          const label = isl.overcome ? `${def.name} ✓` : def.final && !saveRef.current.finalUnlocked ? "???" : def.name;
          const tw = ctx.measureText(label).width;
          ctx.fillRect(isl.x - tw / 2 - 8, isl.y + 78, tw + 16, 22);
          ctx.fillStyle = isl.overcome ? "#b9e6a0" : "#f3ead2";
          ctx.fillText(label, isl.x, isl.y + 93);
        }
      }

      drawWake(ctx, trail);
      drawShip(ctx, ship.x, ship.y, ship.heading, t, 1.15);

      ctx.restore();

      // ── Regen (Bildschirmraum) ──
      if (stormSmoothed > 0.3) {
        const targetRain = Math.floor(stormSmoothed * 120);
        while (rain.length < targetRain) rain.push({ x: Math.random() * w, y: Math.random() * h, l: 12 + Math.random() * 14, v: 500 + Math.random() * 300 });
        ctx.strokeStyle = `rgba(200, 220, 235, ${0.25 * stormSmoothed})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const windX = 90 * stormSmoothed;
        for (const r of rain) {
          r.y += r.v * dt;
          r.x += windX * dt;
          if (r.y > h) { r.y = -r.l; r.x = Math.random() * w; }
          if (r.x > w) r.x = 0;
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x - windX * 0.02, r.y - r.l);
        }
        ctx.stroke();
      }

      // ── Blitz ──
      if (lightning > 0) {
        ctx.fillStyle = `rgba(235, 240, 255, ${lightning * 0.45})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Sturm-Vignette ──
      if (stormSmoothed > 0.15) {
        const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
        vg.addColorStop(0, "rgba(6, 8, 18, 0)");
        vg.addColorStop(1, `rgba(6, 8, 18, ${stormSmoothed * 0.55})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Kompass zum nächsten unbesiegten Phänomen ──
      const target = saveRef.current.islands
        .filter((i) => !i.overcome && (phenById(i.id).final ? saveRef.current.finalUnlocked : true))
        .sort((a, b) => Math.hypot(ship.x - a.x, ship.y - a.y) - Math.hypot(ship.x - b.x, ship.y - b.y))[0];
      if (target) {
        const ang = Math.atan2(target.y - ship.y, target.x - ship.x);
        const cx = w / 2 + Math.cos(ang) * 120;
        const cy = h / 2 + Math.sin(ang) * 120;
        const offscreen = target.x < camX - 20 || target.x > camX + w + 20 || target.y < camY - 20 || target.y > camY + h + 20;
        if (offscreen) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(ang);
          ctx.globalAlpha = 0.6 + Math.sin(t * 3) * 0.2;
          ctx.fillStyle = "#e8d28a";
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(-6, -8);
          ctx.lineTo(-6, 8);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // ── Minimap ──
      const mm = minimapRef.current;
      if (mm) {
        const mctx = mm.getContext("2d")!;
        const mw = mm.width;
        const mh = mm.height;
        const sx = mw / WORLD.w;
        const sy = mh / WORLD.h;
        mctx.fillStyle = "rgba(10, 18, 32, 0.85)";
        mctx.fillRect(0, 0, mw, mh);
        for (const c of cells) {
          mctx.fillStyle = "rgba(120, 130, 170, 0.25)";
          mctx.beginPath();
          mctx.arc(c.x * sx, c.y * sy, c.r * sx, 0, Math.PI * 2);
          mctx.fill();
        }
        for (const isl of saveRef.current.islands) {
          const def = phenById(isl.id);
          mctx.fillStyle = isl.overcome ? "#7fbf6a" : def.final && !saveRef.current.finalUnlocked ? "#403050" : hsl(def.hue, 65, 55);
          mctx.beginPath();
          mctx.arc(isl.x * sx, isl.y * sy, def.final ? 4 : 2.6, 0, Math.PI * 2);
          mctx.fill();
        }
        mctx.fillStyle = "#f6e9c8";
        mctx.beginPath();
        mctx.arc(ship.x * sx, ship.y * sy, 3, 0, Math.PI * 2);
        mctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastNearRef = useRef<PhenomenonDef | null>(null);
  const onDockRef = useRef(onDock);
  onDockRef.current = onDock;
  const onOpenJournalRef = useRef(onOpenJournal);
  onOpenJournalRef.current = onOpenJournal;

  const p = save.player;
  const nearState = nearIsland ? save.islands.find((i) => i.id === nearIsland.id) : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a1522]">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* HUD oben */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between p-3">
        <div className="eb-panel px-3 py-2 text-xs">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-bold tracking-widest text-amber-200">MS TOLERANZ</span>
            <span className="text-sky-200/80">Stufe {p.level}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-emerald-200/90">Stabilität</span>
            <div className="h-2 w-24 overflow-hidden rounded bg-black/50">
              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(hud.s / p.maxStability) * 100}%` }} />
            </div>
            <span className="w-12 text-right">{hud.s}/{p.maxStability}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="w-14 text-sky-200/90">Präsenz</span>
            <div className="h-2 w-24 overflow-hidden rounded bg-black/50">
              <div className="h-full bg-sky-400 transition-all" style={{ width: `${(hud.p / p.maxPresence) * 100}%` }} />
            </div>
            <span className="w-12 text-right">{hud.p}/{p.maxPresence}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="eb-panel px-3 py-2 text-xs text-sky-100">{weatherLabel}</div>
          <button
            className="eb-btn px-3 py-2 text-xs"
            onClick={() => {
              const m = !muted;
              setMuted(m);
              audio.setMuted(m);
            }}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button className="eb-btn px-3 py-2 text-xs" onClick={onOpenJournal}>
            Journal [J]
          </button>
          <button className="eb-btn px-3 py-2 text-xs" onClick={onBackToTitle}>
            Titel
          </button>
        </div>
      </div>

      {/* Minimap */}
      <canvas ref={minimapRef} width={150} height={150} className="absolute bottom-3 right-3 rounded-md border-2 border-sky-200/30 opacity-90" />

      {/* Steuerungshinweis */}
      <div className="pointer-events-none absolute bottom-3 left-3 eb-panel px-3 py-2 text-[11px] leading-relaxed text-sky-100/80">
        <span className="text-amber-200/90">WASD / Pfeile</span> steuern · <span className="text-amber-200/90">E</span> anlanden ·{" "}
        <span className="text-amber-200/90">J</span> Journal
      </div>

      {/* Anlande-Prompt */}
      {nearIsland && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
          <div className="eb-panel px-5 py-3 text-center">
            {nearState?.overcome ? (
              <div className="text-sm text-emerald-200">
                {nearIsland.name} ist befriedet. Die Insel ruht. ✓
              </div>
            ) : nearIsland.final && !save.finalUnlocked ? (
              <div className="text-sm text-purple-200">
                Ein wirbelnder Abgrund. Erst wenn alle 12 Phänomene überwunden sind, öffnet sich das Auge …
                <div className="mt-1 text-xs text-purple-200/60">
                  {save.islands.filter((i) => i.id !== "sturmherd" && i.overcome).length} / 12
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm font-bold tracking-wide text-amber-100">{nearIsland.name}</div>
                <div className="text-xs italic text-sky-200/80">{nearIsland.epithet}</div>
                <button className="eb-btn mt-2 px-4 py-1.5 text-sm" onClick={dock}>
                  Anlanden [E]
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
