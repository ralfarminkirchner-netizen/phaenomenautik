// PHÄNOMENAUTIK — Generative Grafik: Schiff, Inseln, Phänomen-Sprites,
// psychedelische Kampf-Hintergründe (alles Canvas 2D, keine Assets)

import type { PhenomenonDef } from "./data";

export function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;
}

// ─── Schiff ────────────────────────────────────────────────────────

export function drawShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  t: number,
  scale = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading + Math.PI / 2); // 0 = nach oben
  const bob = Math.sin(t * 2.2) * 2 * scale;
  ctx.translate(0, bob);
  ctx.rotate(Math.sin(t * 1.7) * 0.04);
  ctx.scale(scale, scale);

  // Rumpf
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.quadraticCurveTo(11, -8, 9, 12);
  ctx.quadraticCurveTo(0, 20, -9, 12);
  ctx.quadraticCurveTo(-11, -8, 0, -18);
  ctx.closePath();
  const hull = ctx.createLinearGradient(-10, 0, 10, 0);
  hull.addColorStop(0, "#5a3a22");
  hull.addColorStop(0.5, "#8a5a32");
  hull.addColorStop(1, "#4a2e1a");
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.strokeStyle = "#2c1a0e";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Mast + Segel
  ctx.strokeStyle = "#3a2412";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(0, -14);
  ctx.stroke();

  const billow = 3 + Math.sin(t * 1.3) * 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.quadraticCurveTo(billow + 8, -6, 0, 3);
  ctx.closePath();
  const sail = ctx.createLinearGradient(0, -13, billow + 8, 3);
  sail.addColorStop(0, "#f3e9d2");
  sail.addColorStop(1, "#d9c9a3");
  ctx.fillStyle = sail;
  ctx.fill();
  ctx.strokeStyle = "#a8946f";
  ctx.lineWidth = 1;
  ctx.stroke();

  // kleine Flagge (Fenster-Symbol: ein Quadrat im Quadrat)
  ctx.fillStyle = "#c9a24b";
  ctx.fillRect(0, -20, 7, 5);
  ctx.fillStyle = "#274a5e";
  ctx.fillRect(2, -18.5, 3, 2);

  ctx.restore();
}

// Kielwasser
export function drawWake(
  ctx: CanvasRenderingContext2D,
  trail: { x: number; y: number; age: number }[],
) {
  for (const p of trail) {
    const a = Math.max(0, 1 - p.age / 2.4);
    if (a <= 0) continue;
    const r = 4 + p.age * 9;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(230, 244, 250, ${a * 0.35})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// ─── Inseln ────────────────────────────────────────────────────────

export interface IslandDrawOpts {
  t: number;
  overcome: boolean;
  isFinal: boolean;
  locked: boolean; // Finale noch nicht offen
}

/** Pseudo-Zufall mit Seed (stabile Inselform) */
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function drawIsland(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  def: PhenomenonDef,
  seed: number,
  opts: IslandDrawOpts,
) {
  const { t, overcome, isFinal, locked } = opts;
  const rand = seededRand(seed);
  const pts: { x: number; y: number }[] = [];
  const n = 9;
  const baseR = isFinal ? 52 : 34 + rand() * 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = baseR * (0.72 + rand() * 0.5);
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.82 });
  }

  ctx.save();
  ctx.translate(x, y);

  // Aura / Wetterkreis
  const pulse = 1 + Math.sin(t * (overcome ? 0.8 : 2.4)) * 0.06;
  ctx.beginPath();
  ctx.arc(0, 0, baseR * 1.9 * pulse, 0, Math.PI * 2);
  if (locked) {
    ctx.fillStyle = "rgba(20, 8, 30, 0.35)";
  } else if (overcome) {
    ctx.fillStyle = hsl(140, 45, 55, 0.10);
  } else {
    ctx.fillStyle = hsl(def.hue, 70, 50, 0.14);
  }
  ctx.fill();

  if (!overcome && !locked) {
    // unruhiger Rand
    ctx.beginPath();
    ctx.arc(0, 0, baseR * 1.9 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = hsl(def.hue, 80, 60, 0.35 + 0.15 * Math.sin(t * 3));
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -t * 18;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Sandring
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * 1.12, p.y * 1.12) : ctx.lineTo(p.x * 1.12, p.y * 1.12)));
  ctx.closePath();
  ctx.fillStyle = overcome ? "#b9c79a" : "#c2b393";
  ctx.fill();

  // Landmasse
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  const g = ctx.createRadialGradient(0, -8, 4, 0, 0, baseR);
  if (locked) {
    g.addColorStop(0, "#241432");
    g.addColorStop(1, "#120a1c");
  } else if (overcome) {
    g.addColorStop(0, "#8fb56e");
    g.addColorStop(1, "#557a41");
  } else {
    g.addColorStop(0, hsl(def.hue, 38, 42));
    g.addColorStop(1, hsl(def.hue, 45, 24));
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(30, 25, 15, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Insel-Merkmal: Phänomen-Marker (kleiner Geist über der Insel)
  if (!locked) {
    const hoverY = -baseR - 14 + Math.sin(t * 1.6 + seed) * 4;
    drawPhenomenonShape(ctx, def, 0, hoverY, 0.28, t, overcome ? 0.45 : 1);
  } else {
    // verschlossenes Zentrum: dunkler Wirbel
    ctx.save();
    ctx.rotate(t * 0.6);
    ctx.strokeStyle = "rgba(160, 90, 220, 0.5)";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 12 + i * 9, i, i + Math.PI * 1.2);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

// ─── Phänomen-Sprites (generativ, 8 Formen) ────────────────────────

export function drawPhenomenonShape(
  ctx: CanvasRenderingContext2D,
  def: PhenomenonDef,
  x: number,
  y: number,
  scale: number,
  t: number,
  alpha = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  const h = def.hue;
  const breathe = 1 + Math.sin(t * 2.1) * 0.05;
  ctx.scale(breathe, breathe);

  // Glühen
  const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 90);
  glow.addColorStop(0, hsl(h, 80, 60, 0.28));
  glow.addColorStop(1, hsl(h, 80, 50, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 90, 0, Math.PI * 2);
  ctx.fill();

  switch (def.shape) {
    case "eye": {
      // Riesenauge mit Flügeln (Falter)
      const flap = Math.sin(t * 6) * 0.5;
      ctx.fillStyle = hsl(h, 55, 45);
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.rotate(s * (0.7 + flap * 0.5));
        ctx.beginPath();
        ctx.ellipse(s * 55, 0, 45, 26, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hsl(h, 70, 25);
        ctx.lineWidth = 3;
        ctx.stroke();
        // Flügel-„Fotos“
        ctx.fillStyle = hsl(h + 40, 40, 70, 0.7);
        ctx.beginPath();
        ctx.ellipse(s * 55, 0, 22, 12, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Auge
      ctx.beginPath();
      ctx.ellipse(0, 0, 34, 24, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#f2ead8";
      ctx.fill();
      ctx.strokeStyle = hsl(h, 60, 20);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.sin(t * 1.3) * 8, Math.cos(t * 0.9) * 5, 11, 0, Math.PI * 2);
      ctx.fillStyle = hsl(h, 70, 30);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(Math.sin(t * 1.3) * 8, Math.cos(t * 0.9) * 5, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#0c0a08";
      ctx.fill();
      break;
    }
    case "bird": {
      // Vogel mit vielen Augen im Gefieder
      ctx.fillStyle = hsl(h, 50, 32);
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      const wing = Math.sin(t * 5) * 0.6;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * 30, -6);
        ctx.rotate(s * (-0.3 - wing));
        ctx.beginPath();
        ctx.ellipse(s * 34, 0, 38, 15, 0, 0, Math.PI * 2);
        ctx.fillStyle = hsl(h, 55, 40);
        ctx.fill();
        ctx.restore();
      }
      // Augen im Gefieder
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.5;
        const ex = Math.cos(a) * 20;
        const ey = Math.sin(a) * 13;
        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#e9e2cf";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "#141210";
        ctx.fill();
      }
      // Kopf + Schnabel
      ctx.beginPath();
      ctx.arc(0, -30, 16, 0, Math.PI * 2);
      ctx.fillStyle = hsl(h, 50, 38);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(12, -22);
      ctx.lineTo(0, -18);
      ctx.closePath();
      ctx.fillStyle = "#d8b13c";
      ctx.fill();
      break;
    }
    case "golem": {
      // steinerner Klotz aus „Urteils-Ziegeln“
      ctx.fillStyle = hsl(h, 20, 38);
      const wob = Math.sin(t * 1.8) * 3;
      const bricks: [number, number, number, number][] = [
        [-34, -10 + wob, 30, 22],
        [4, -12 - wob, 32, 24],
        [-28, -36, 26, 22],
        [0, -38 + wob, 28, 22],
        [-14, 12, 30, 22],
      ];
      for (const [bx, by, bw, bh] of bricks) {
        ctx.fillStyle = hsl(h + bx, 18 + Math.abs(bx) / 3, 34 + ((bx * 7) % 10));
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = hsl(h, 15, 18);
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bx, by, bw, bh);
      }
      // glühender Riss (das Warme darunter)
      ctx.beginPath();
      ctx.moveTo(-6, -30);
      ctx.lineTo(4, -16);
      ctx.lineTo(-4, -2);
      ctx.lineTo(6, 14);
      ctx.strokeStyle = hsl(30, 90, 60, 0.9);
      ctx.lineWidth = 3;
      ctx.stroke();
      // Arme
      ctx.fillStyle = hsl(h, 20, 30);
      ctx.fillRect(-52, -6, 16, 30);
      ctx.fillRect(38, -8, 16, 30);
      break;
    }
    case "ghost": {
      // schwebender Geist, welliger Saum
      ctx.beginPath();
      ctx.moveTo(-34, 30);
      ctx.lineTo(-34, -6);
      ctx.quadraticCurveTo(-34, -42, 0, -42);
      ctx.quadraticCurveTo(34, -42, 34, -6);
      ctx.lineTo(34, 30);
      for (let i = 0; i < 4; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        ctx.quadraticCurveTo(34 - (i * 2 + 1) * 8.5, 30 + dir * 12 + Math.sin(t * 3 + i) * 3, 34 - (i + 1) * 17, 30);
      }
      ctx.closePath();
      const gg = ctx.createLinearGradient(0, -42, 0, 34);
      gg.addColorStop(0, hsl(h, 45, 68, 0.9));
      gg.addColorStop(1, hsl(h, 50, 40, 0.55));
      ctx.fillStyle = gg;
      ctx.fill();
      ctx.strokeStyle = hsl(h, 50, 30, 0.8);
      ctx.lineWidth = 3;
      ctx.stroke();
      // traurige Augen
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 12, -16, 6, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#12100e";
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 2, 7, 0.15, Math.PI - 0.15, false);
      ctx.strokeStyle = "#12100e";
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case "void": {
      // Loch mit Sog
      ctx.save();
      ctx.rotate(t * 0.8);
      for (let i = 4; i >= 0; i--) {
        ctx.beginPath();
        ctx.arc(0, 0, 10 + i * 11, i * 0.9, i * 0.9 + Math.PI * 1.45);
        ctx.strokeStyle = hsl(h, 60 - i * 6, 22 + i * 9, 0.85);
        ctx.lineWidth = 7 - i;
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, 12 + Math.sin(t * 2.6) * 2, 0, Math.PI * 2);
      ctx.fillStyle = "#050308";
      ctx.fill();
      break;
    }
    case "fish": {
      // Lotsenfisch mit Misstrauen-Augenbrauen
      ctx.fillStyle = hsl(h, 45, 40);
      ctx.beginPath();
      ctx.ellipse(0, 0, 44, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hsl(h, 50, 22);
      ctx.lineWidth = 3;
      ctx.stroke();
      // Schwanz
      const tail = Math.sin(t * 4) * 8;
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.lineTo(-62, -14 + tail);
      ctx.lineTo(-62, 14 + tail);
      ctx.closePath();
      ctx.fill();
      // Flosse
      ctx.beginPath();
      ctx.moveTo(-4, -20);
      ctx.lineTo(10, -36);
      ctx.lineTo(18, -18);
      ctx.closePath();
      ctx.fill();
      // argwöhnisches Auge
      ctx.beginPath();
      ctx.arc(24, -4, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#efe8d5";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(26, -4, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#0e0c0a";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(14, -16);
      ctx.lineTo(34, -12);
      ctx.strokeStyle = hsl(h, 40, 18);
      ctx.lineWidth = 3.5;
      ctx.stroke();
      break;
    }
    case "crystal": {
      // vielkantiger Wächterkristall
      ctx.save();
      ctx.rotate(Math.sin(t * 1.2) * 0.08);
      const facets = 7;
      ctx.beginPath();
      for (let i = 0; i < facets; i++) {
        const a = (i / facets) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 46 : 30;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      const cg = ctx.createLinearGradient(-40, -40, 40, 40);
      cg.addColorStop(0, hsl(h, 60, 65));
      cg.addColorStop(0.5, hsl(h, 55, 42));
      cg.addColorStop(1, hsl(h, 60, 28));
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.strokeStyle = hsl(h, 70, 80, 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
      // Kern-Auge
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fillStyle = hsl(h + 180, 70, 55, 0.9);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#0b0908";
      ctx.fill();
      ctx.restore();
      break;
    }
    case "storm": {
      // finaler Wirbel mit Gesicht
      ctx.save();
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(t * (0.7 + i * 0.35) * (i % 2 ? -1 : 1));
        ctx.strokeStyle = hsl(h + i * 30, 65, 40 + i * 12, 0.75);
        ctx.lineWidth = 6 - i;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(0, 0, 26 + i * 16, k * 2.1, k * 2.1 + Math.PI * 0.9);
          ctx.stroke();
        }
        ctx.restore();
      }
      // Gesicht im Zentrum
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fillStyle = hsl(h, 35, 18);
      ctx.fill();
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 8, -4, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = hsl(h + 60, 90, 70);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 8, 6, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = hsl(h + 60, 80, 65);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
      break;
    }
  }
  ctx.restore();
}

// ─── Kampf-Hintergrund (psychedelisch, à la Earthbound) ────────────

export function drawBattleBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hue: number,
  t: number,
  intensity: number, // 0..1: Rest-Intensität des Gegners (mehr Chaos am Anfang)
) {
  const chaos = 0.5 + intensity * 0.8;
  const bandH = 14;
  for (let y = 0; y < h; y += bandH) {
    const wave1 = Math.sin(y * 0.018 + t * 1.4) * 60 * chaos;
    const wave2 = Math.sin(y * 0.045 - t * 2.1) * 30 * chaos;
    const bandHue = hue + Math.sin(y * 0.02 + t * 0.7) * 40;
    const light = 16 + 12 * Math.sin(y * 0.013 + t * 1.1);
    ctx.fillStyle = hsl(bandHue, 62, light);
    ctx.fillRect(0, y, w, bandH + 1);
    // versetzte Überlagerung
    ctx.fillStyle = hsl(bandHue + 30, 55, light + 8, 0.35);
    const off = ((wave1 + wave2 + w) % w) - w / 2;
    ctx.fillRect(off, y, w / 2, bandH + 1);
  }
  // pulsierende Spiralen
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < 3; i++) {
    const cx = w * (0.25 + 0.25 * i) + Math.sin(t * 0.6 + i * 2) * 40;
    const cy = h * 0.4 + Math.cos(t * 0.5 + i * 1.7) * 60;
    const r = 60 + Math.sin(t * 1.3 + i) * 25;
    const rg = ctx.createRadialGradient(cx, cy, 4, cx, cy, r * 2.2);
    rg.addColorStop(0, hsl(hue + 90 + i * 40, 80, 55, 0.5));
    rg.addColorStop(1, hsl(hue + 90 + i * 40, 80, 50, 0));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Meer (Tile-basierte Wellenmuster + Wetter) ────────────────────

export function drawSeaTile(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  w: number,
  h: number,
  t: number,
  storm: number, // 0..1
) {
  // Grundwasser
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const calmTop: [number, number] = [205, 45];
  const stormTop: [number, number] = [215, 22];
  const lerp = (a: number, b: number) => a + (b - a) * storm;
  g.addColorStop(0, hsl(lerp(calmTop[0], stormTop[0]), lerp(55, 30), lerp(calmTop[1], stormTop[1])));
  g.addColorStop(1, hsl(lerp(215, 225), lerp(60, 35), lerp(30, 14)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Wellenlinien-Raster (welt-gebunden)
  const spacing = 46;
  const amp = 3 + storm * 7;
  ctx.lineWidth = 1.6;
  const startY = Math.floor(camY / spacing) * spacing;
  const startX = Math.floor(camX / spacing) * spacing;
  for (let wy = startY; wy < camY + h + spacing; wy += spacing) {
    ctx.beginPath();
    const sy = wy - camY;
    for (let wx = startX; wx < camX + w + spacing; wx += 8) {
      const sx = wx - camX;
      const yOff =
        Math.sin(wx * 0.02 + t * (1 + storm * 1.6) + wy * 0.011) * amp +
        Math.sin(wx * 0.043 - t * 0.7 + wy * 0.02) * amp * 0.5;
      if (wx === startX) ctx.moveTo(sx, sy + yOff);
      else ctx.lineTo(sx, sy + yOff);
    }
    const rowPhase = Math.sin(wy * 0.05 + t * 0.5);
    ctx.strokeStyle = `rgba(235, 248, 252, ${0.05 + storm * 0.04 + Math.max(0, rowPhase) * 0.05})`;
    ctx.stroke();
  }

  // Schaumflecken (driften mit Weltzeit)
  const foamN = Math.floor((w * h) / 26000) + Math.floor(storm * 30);
  for (let i = 0; i < foamN; i++) {
    const fx = ((i * 733.7 + t * (12 + storm * 40)) % (w + 80)) - 40;
    const fy = ((i * 389.3 + Math.sin(t * 0.3 + i) * 30) % (h + 80)) - 40;
    const flick = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
    ctx.fillStyle = `rgba(240, 250, 253, ${0.05 + flick * (0.05 + storm * 0.08)})`;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 6 + storm * 6, 2 + storm * 2, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}
