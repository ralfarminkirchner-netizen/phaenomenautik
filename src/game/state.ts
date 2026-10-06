// PHÄNOMENAUTIK — Weltlayout, Spielstand, Persistenz

import { PHENOMENA, levelForXp, maxPresence, maxStability } from "./data";

export interface IslandState {
  id: string;
  x: number;
  y: number;
  overcome: boolean;
  understood: boolean; // friedlich integriert
  seed: number;
}

export interface PlayerState {
  xp: number;
  level: number;
  stability: number;
  maxStability: number;
  presence: number;
  maxPresence: number;
  items: Record<string, number>;
}

export interface SaveGame {
  version: 1;
  player: PlayerState;
  islands: IslandState[];
  ship: { x: number; y: number };
  finalUnlocked: boolean;
  won: boolean;
}

const SAVE_KEY = "phaenomenautik-save-v1";

// Welt: 4200 × 4200 — Start im Süden, Archipele ringförmig, Sturmherd im Zentrum
export const WORLD = { w: 4200, h: 4200, startX: 2100, startY: 3560 };

const ISLAND_POS: Record<string, [number, number]> = {
  // Wiederkehr-Riff (NW)
  flashback: [760, 1020],
  albtraum: [1150, 640],
  // Alarm-Atoll (N)
  hypervigilanz: [2050, 520],
  herzrasen: [2520, 830],
  // Nebelbank (NO)
  vermeidung: [3330, 900],
  verdraengung: [3560, 1330],
  // Glaswelt (SO)
  dissoziation: [3450, 2520],
  erstarrung: [3120, 3030],
  // Trauer-Atoll (S)
  scham: [2140, 2560],
  leere: [1620, 2940],
  // Misstrauens-Riff (SW)
  misstrauen: [820, 2500],
  naehe: [1040, 3050],
  // Finale
  sturmherd: [2100, 1760],
};

export function newGame(): SaveGame {
  const islands: IslandState[] = PHENOMENA.map((p, i) => ({
    id: p.id,
    x: ISLAND_POS[p.id][0],
    y: ISLAND_POS[p.id][1],
    overcome: false,
    understood: false,
    seed: 1000 + i * 137,
  }));
  const player = freshPlayer(0);
  return {
    version: 1,
    player,
    islands,
    ship: { x: WORLD.startX, y: WORLD.startY },
    finalUnlocked: false,
    won: false,
  };
}

export function freshPlayer(xp: number): PlayerState {
  const level = levelForXp(xp);
  const maxS = maxStability(level);
  const maxP = maxPresence(level);
  return {
    xp,
    level,
    stability: maxS,
    maxStability: maxS,
    presence: maxP,
    maxPresence: maxP,
    items: { wasser: 3, karte: 1, anker: 2 },
  };
}

/** Einsicht gutschreiben; gibt ggf. das neue Level zurück */
export function grantXp(player: PlayerState, xp: number): { leveledUp: boolean; newLevel: number } {
  const before = player.level;
  player.xp += xp;
  player.level = levelForXp(player.xp);
  if (player.level > before) {
    const maxS = maxStability(player.level);
    const maxP = maxPresence(player.level);
    player.maxStability = maxS;
    player.maxPresence = maxP;
    player.stability = maxS; // Level-Up heilt voll
    player.presence = maxP;
    return { leveledUp: true, newLevel: player.level };
  }
  return { leveledUp: false, newLevel: player.level };
}

export function regularOvercome(islands: IslandState[]): number {
  return islands.filter((i) => i.id !== "sturmherd" && i.overcome).length;
}

export function checkFinalUnlock(s: SaveGame): boolean {
  if (!s.finalUnlocked && regularOvercome(s.islands) >= 12) {
    s.finalUnlocked = true;
  }
  return s.finalUnlocked;
}

export function loadSave(): SaveGame | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveGame;
    if (s.version !== 1 || !Array.isArray(s.islands) || s.islands.length !== PHENOMENA.length) return null;
    return s;
  } catch {
    return null;
  }
}

export function persistSave(s: SaveGame) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* ignorieren */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignorieren */
  }
}
