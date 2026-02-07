/**
 * Stage layout for Proto 1: 7 sections, 1600x3000 world.
 *
 * Section 1: 始まりの平地   (Y 2800-3000) — roll only, Dust rich
 * Section 2: 低い段差       (Y 2400-2800) — needs stretch_1
 * Section 3: 高い段差       (Y 2000-2400) — needs stretch_2
 * Section 4: 最初のギャップ (Y 1600-2000) — needs jump_1
 * Section 5: 大ギャップ+G1  (Y 1200-1600) — jump_1 + stretch
 * Section 6: グラップル領域 (Y 600-1200)  — needs traction_1
 * Section 7: 遠ゴール(G2)   (Y 200-600)   — traction_1
 */

import { FoodTypeId } from './foodTypes';

// ============ Type Definitions ============

export interface PlatformDef {
  x: number; y: number; w: number; h: number;
}

export interface PointDef {
  x: number; y: number;
}

export interface FoodItemDef {
  x: number; y: number;
  type: FoodTypeId;
}

export interface GoalDef {
  x: number; y: number; w: number; h: number;
  label: string;
  name: string;
  stars: number;
}

// ============ Platforms ============

export const platforms: PlatformDef[] = [
  // Section 1: 始まりの平地 (Y 2800-3000) — flat ground only
  { x: 800, y: 2980, w: 1600, h: 40 },   // Ground floor (full width)

  // Section 2: 低い段差 (Y 2400-2800) — gentle slopes, wide platforms
  { x: 400, y: 2820, w: 350, h: 16 },     // Ramp from ground
  { x: 1000, y: 2780, w: 400, h: 16 },
  { x: 500, y: 2720, w: 350, h: 16 },
  { x: 1200, y: 2660, w: 350, h: 16 },
  { x: 700, y: 2600, w: 400, h: 16 },
  { x: 300, y: 2530, w: 350, h: 16 },
  { x: 1100, y: 2470, w: 350, h: 16 },
  { x: 700, y: 2410, w: 400, h: 16 },

  // Section 3: 高い段差 (Y 2000-2400) — 40-50px steps
  { x: 350, y: 2350, w: 180, h: 16 },
  { x: 800, y: 2300, w: 200, h: 16 },
  { x: 1200, y: 2240, w: 200, h: 16 },
  { x: 600, y: 2180, w: 180, h: 16 },
  { x: 1000, y: 2120, w: 220, h: 16 },
  { x: 400, y: 2050, w: 200, h: 16 },

  // Section 4: 最初のギャップ (Y 1600-2000) — gaps require jumping
  { x: 300, y: 1960, w: 160, h: 16 },
  { x: 700, y: 1900, w: 140, h: 16 },
  { x: 1100, y: 1840, w: 160, h: 16 },
  { x: 500, y: 1760, w: 140, h: 16 },
  { x: 900, y: 1700, w: 160, h: 16 },
  { x: 1300, y: 1640, w: 140, h: 16 },

  // Section 5: 大ギャップ+G1 (Y 1200-1600)
  { x: 600, y: 1560, w: 160, h: 16 },
  { x: 200, y: 1480, w: 140, h: 16 },
  { x: 800, y: 1400, w: 160, h: 16 },
  { x: 1200, y: 1350, w: 160, h: 16 },

  // Section 6: グラップル領域 (Y 600-1200)
  { x: 400, y: 1150, w: 140, h: 16 },
  { x: 900, y: 1050, w: 160, h: 16 },
  { x: 300, y: 900, w: 140, h: 16 },
  { x: 1100, y: 800, w: 160, h: 16 },
  { x: 600, y: 700, w: 140, h: 16 },

  // Section 7: 遠ゴール (Y 200-600)
  { x: 1000, y: 550, w: 140, h: 16 },
  { x: 500, y: 450, w: 160, h: 16 },
  { x: 1200, y: 350, w: 160, h: 16 },
];

// ============ Hook Points (grapple targets, section 6-7 only) ============

export const hookPoints: PointDef[] = [
  // Section 6 hooks
  { x: 600, y: 1100 },
  { x: 1100, y: 1050 },
  { x: 200, y: 950 },
  { x: 800, y: 880 },
  { x: 1300, y: 820 },
  { x: 450, y: 750 },
  { x: 950, y: 680 },

  // Section 7 hooks
  { x: 700, y: 580 },
  { x: 1200, y: 500 },
  { x: 400, y: 420 },
  { x: 900, y: 350 },
  { x: 1100, y: 280 },
];

// ============ Food Items ============

export const foodItems: FoodItemDef[] = [
  // Section 1: Dust-rich (12 dust, 2 sap)
  { x: 200, y: 2950, type: 'dust' },
  { x: 350, y: 2940, type: 'dust' },
  { x: 500, y: 2950, type: 'dust' },
  { x: 650, y: 2940, type: 'dust' },
  { x: 800, y: 2950, type: 'dust' },
  { x: 950, y: 2940, type: 'dust' },
  { x: 1100, y: 2950, type: 'dust' },
  { x: 1250, y: 2940, type: 'dust' },
  { x: 1400, y: 2950, type: 'dust' },
  { x: 550, y: 2900, type: 'dust' },
  { x: 1050, y: 2880, type: 'dust' },
  { x: 1450, y: 2860, type: 'dust' },
  { x: 300, y: 2910, type: 'sap' },
  { x: 1200, y: 2890, type: 'sap' },

  // Section 2: More dust + some sap (10 dust, 4 sap)
  { x: 400, y: 2730, type: 'dust' },
  { x: 750, y: 2700, type: 'dust' },
  { x: 1100, y: 2660, type: 'dust' },
  { x: 500, y: 2660, type: 'dust' },
  { x: 850, y: 2560, type: 'dust' },
  { x: 1250, y: 2620, type: 'dust' },
  { x: 350, y: 2500, type: 'dust' },
  { x: 900, y: 2460, type: 'dust' },
  { x: 600, y: 2410, type: 'dust' },
  { x: 1200, y: 2460, type: 'dust' },
  { x: 550, y: 2700, type: 'sap' },
  { x: 950, y: 2650, type: 'sap' },
  { x: 300, y: 2580, type: 'sap' },
  { x: 1150, y: 2500, type: 'sap' },

  // Section 3: Dust + more sap (8 dust, 6 sap)
  { x: 450, y: 2330, type: 'dust' },
  { x: 900, y: 2280, type: 'dust' },
  { x: 1300, y: 2220, type: 'dust' },
  { x: 700, y: 2160, type: 'dust' },
  { x: 1100, y: 2100, type: 'dust' },
  { x: 500, y: 2030, type: 'dust' },
  { x: 250, y: 2280, type: 'dust' },
  { x: 1400, y: 2150, type: 'dust' },
  { x: 350, y: 2330, type: 'sap' },
  { x: 750, y: 2270, type: 'sap' },
  { x: 1150, y: 2210, type: 'sap' },
  { x: 550, y: 2150, type: 'sap' },
  { x: 950, y: 2090, type: 'sap' },
  { x: 350, y: 2030, type: 'sap' },

  // Section 4: Sap-heavy (4 dust, 8 sap)
  { x: 400, y: 1940, type: 'dust' },
  { x: 800, y: 1820, type: 'dust' },
  { x: 1200, y: 1720, type: 'dust' },
  { x: 600, y: 1620, type: 'dust' },
  { x: 300, y: 1940, type: 'sap' },
  { x: 600, y: 1880, type: 'sap' },
  { x: 1000, y: 1820, type: 'sap' },
  { x: 400, y: 1740, type: 'sap' },
  { x: 800, y: 1680, type: 'sap' },
  { x: 1200, y: 1620, type: 'sap' },
  { x: 500, y: 1780, type: 'sap' },
  { x: 1100, y: 1700, type: 'sap' },

  // Section 5: Mixed (6 dust, 6 sap)
  { x: 500, y: 1540, type: 'dust' },
  { x: 300, y: 1460, type: 'dust' },
  { x: 700, y: 1380, type: 'dust' },
  { x: 1100, y: 1330, type: 'dust' },
  { x: 900, y: 1460, type: 'dust' },
  { x: 1300, y: 1400, type: 'dust' },
  { x: 700, y: 1540, type: 'sap' },
  { x: 200, y: 1460, type: 'sap' },
  { x: 900, y: 1380, type: 'sap' },
  { x: 1300, y: 1330, type: 'sap' },
  { x: 500, y: 1400, type: 'sap' },
  { x: 1100, y: 1500, type: 'sap' },

  // Section 6: Sap-heavy for traction (2 dust, 6 sap)
  { x: 500, y: 1130, type: 'dust' },
  { x: 800, y: 880, type: 'dust' },
  { x: 400, y: 1100, type: 'sap' },
  { x: 1000, y: 1030, type: 'sap' },
  { x: 300, y: 880, type: 'sap' },
  { x: 1200, y: 780, type: 'sap' },
  { x: 700, y: 680, type: 'sap' },
  { x: 500, y: 780, type: 'sap' },
];

// ============ Recovery Points ============

export const recoveryPoints: PointDef[] = [
  { x: 800, y: 2380 },    // Section 3 start
  { x: 600, y: 1540 },    // Section 5 start
];

// ============ Goals ============

export const goals: GoalDef[] = [
  {
    x: 400, y: 1300,
    w: 120, h: 60,
    label: 'goal_near',
    name: 'GOAL 1',
    stars: 2,
  },
  {
    x: 800, y: 300,
    w: 120, h: 60,
    label: 'goal_far',
    name: 'GOAL 2',
    stars: 3,
  },
];
