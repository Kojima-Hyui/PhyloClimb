/**
 * Evolution Tree:
 *
 *              [root: 原初適応]
 *              /               \
 *    [forelimb: 前肢強化]   [trunk: 体幹発達]
 *      /         \                |
 * [tendon: 腱の伸長] [grip: 把握力]  [shell: 外皮硬化]
 *                                    |
 *                              [sticky: 粘着器官]
 *
 * Left branch (forelimb) = offensive/skill-dependent
 * Right branch (trunk) = defensive/stability
 */

export type EvolutionNodeId = 'root' | 'forelimb' | 'trunk' | 'tendon' | 'grip' | 'shell' | 'sticky';

export interface EvolutionEffects {
  grappleRange?: number;
  maxHp?: number;
  reelSpeed?: number;
  airControl?: number;
  momentumRetention?: number;  // fraction: 0.3 = 30%
  fallDamageReduction?: number; // fraction: 0.3 = 30%
  stickyWalls?: boolean;
}

export interface EvolutionNode {
  id: EvolutionNodeId;
  name: string;
  description: string;
  parent: EvolutionNodeId | null;
  effects: EvolutionEffects;
  color: number;
}

export type EvolutionTree = Record<EvolutionNodeId, EvolutionNode>;

export const evolutionTree: EvolutionTree = {
  root: {
    id: 'root',
    name: '原初適応',
    description: '射程+50, HP+10',
    parent: null,
    effects: { grappleRange: 50, maxHp: 10 },
    color: 0x88ff88,
  },
  forelimb: {
    id: 'forelimb',
    name: '前肢強化',
    description: 'リール速度+1.5',
    parent: 'root',
    effects: { reelSpeed: 1.5 },
    color: 0xff8844,
  },
  trunk: {
    id: 'trunk',
    name: '体幹発達',
    description: '空中制御+0.002',
    parent: 'root',
    effects: { airControl: 0.002 },
    color: 0x4488ff,
  },
  tendon: {
    id: 'tendon',
    name: '腱の伸長',
    description: '射程+100',
    parent: 'forelimb',
    effects: { grappleRange: 100 },
    color: 0xffaa44,
  },
  grip: {
    id: 'grip',
    name: '把握力',
    description: '運動量維持+30%',
    parent: 'forelimb',
    effects: { momentumRetention: 0.3 },
    color: 0xff6644,
  },
  shell: {
    id: 'shell',
    name: '外皮硬化',
    description: '落下ダメージ-30%, HP+15',
    parent: 'trunk',
    effects: { fallDamageReduction: 0.3, maxHp: 15 },
    color: 0x6688ff,
  },
  sticky: {
    id: 'sticky',
    name: '粘着器官',
    description: '壁張り付き強化',
    parent: 'shell',
    effects: { stickyWalls: true },
    color: 0x44aaff,
  },
};

export const ALL_NODE_IDS: EvolutionNodeId[] = ['root', 'forelimb', 'trunk', 'tendon', 'grip', 'shell', 'sticky'];
