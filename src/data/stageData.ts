// ============ Stage Element Definitions ============

export interface PlatformDef {
  x: number; y: number; w: number; h: number;
}

export interface PointDef {
  x: number; y: number;
}

export interface RectDef {
  x: number; y: number; w: number; h: number;
}

// ---- Platforms (normal) ----
export const platforms: PlatformDef[] = [
  { x: 400, y: 3850, w: 300, h: 20 }, // Start
  { x: 200, y: 3400, w: 130, h: 16 },
  { x: 600, y: 3000, w: 130, h: 16 },
  { x: 350, y: 2550, w: 130, h: 16 },
  { x: 200, y: 2050, w: 150, h: 16 }, // Recovery 1
  { x: 600, y: 1550, w: 130, h: 16 },
  { x: 350, y: 1050, w: 150, h: 16 }, // Recovery 2
  { x: 550, y: 600, w: 130, h: 16 },
  { x: 400, y: 200, w: 300, h: 20 }, // Goal
];

// ---- Hook Points (normal) ----
export const hookPoints: PointDef[] = [
  // Section 1: Start → first rest
  { x: 300, y: 3650 },
  { x: 550, y: 3580 },
  // Section 2
  { x: 150, y: 3200 },
  { x: 450, y: 3150 },
  // Section 3
  { x: 650, y: 2800 },
  { x: 300, y: 2750 },
  // Section 4
  { x: 200, y: 2350 },
  { x: 550, y: 2300 },
  // Section 5
  { x: 500, y: 2100 },
  { x: 250, y: 1900 },
  // Section 6
  { x: 350, y: 1750 },
  { x: 600, y: 1650 },
  // Section 7
  { x: 150, y: 1350 },
  { x: 500, y: 1300 },
  // Section 8
  { x: 600, y: 1100 },
  { x: 250, y: 950 },
  // Section 9
  { x: 450, y: 800 },
  { x: 200, y: 700 },
  // Section 10: Near goal
  { x: 550, y: 480 },
  { x: 300, y: 380 },
  { x: 450, y: 280 },
];

// ---- Recovery Points ----
export const recoveryPoints: PointDef[] = [
  { x: 200, y: 2020 },
  { x: 350, y: 1020 },
];

// ---- Evolution Items (green glowing orbs, sensor) ----
export const evolutionItems: PointDef[] = [
  { x: 550, y: 3550 },  // Early: near start, easy to grab
  { x: 150, y: 2750 },  // Section 3 side path
  { x: 550, y: 2050 },  // Near recovery 1
  { x: 150, y: 1350 },  // Section 7 side
  { x: 450, y: 500 },   // Near top, risky
];

// ---- Fake Hook Points (look like normal hooks) ----
export const fakeHookPoints: PointDef[] = [
  { x: 400, y: 3350 },  // Early: learning opportunity
  { x: 350, y: 1900 },  // Mid: near real hooks, tricky
  { x: 400, y: 500 },   // Late: high-risk near top
];

// ---- Wind Zones ----
export interface WindZoneDef {
  x: number; y: number; w: number; h: number;
  period: number;    // seconds per cycle
  maxForce: number;  // peak horizontal force
}

export const windZones: WindZoneDef[] = [
  { x: 250, y: 1600, w: 300, h: 300, period: 3, maxForce: 0.004 },  // Mid
  { x: 400, y: 650, w: 350, h: 250, period: 4, maxForce: 0.005 },   // Upper
];

// ---- Breakable Platforms ----
export interface BreakablePlatformDef {
  x: number; y: number; w: number; h: number;
  respawn: boolean;
}

export const breakablePlatforms: BreakablePlatformDef[] = [
  { x: 400, y: 3200, w: 110, h: 14, respawn: true },  // Early
  { x: 250, y: 1750, w: 110, h: 14, respawn: true },  // Mid
  { x: 300, y: 450, w: 110, h: 14, respawn: false },   // Top (no respawn)
];
