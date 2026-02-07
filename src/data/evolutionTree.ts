/**
 * Evolution Tree (Food-driven, 2 branches x 3 tiers):
 *
 *  Dust branch (伸長系):
 *    stretch_1 (伸長I, 10pt) → stretch_2 (伸長II, 25pt) → sticky_1 (粘着I, 50pt)
 *
 *  Sap branch (跳躍系):
 *    jump_1 (跳躍I, 10pt) → jump_2 (跳躍II, 25pt) → traction_1 (牽引I, 50pt)
 */

import { FoodTypeId } from './foodTypes';

export type EvolutionNodeId =
  | 'stretch_1' | 'stretch_2' | 'sticky_1'
  | 'jump_1' | 'jump_2' | 'traction_1';

export interface EvolutionEffects {
  bodyStretchFactor?: number;   // multiplier for body height
  friction?: number;            // surface friction override
  canJump?: boolean;            // unlocks basic jump
  canChargedJump?: boolean;     // unlocks charged jump
  canGrapple?: boolean;         // unlocks grapple
  grappleRange?: number;        // grapple range in px
}

export interface EvolutionNode {
  id: EvolutionNodeId;
  name: string;
  description: string;
  branch: FoodTypeId;
  tier: number;                 // 1, 2, or 3
  threshold: number;            // food points required
  effects: EvolutionEffects;
  color: number;
  prev: EvolutionNodeId | null; // previous tier in same branch
}

export type EvolutionTree = Record<EvolutionNodeId, EvolutionNode>;

export const evolutionTree: EvolutionTree = {
  // ---- Dust branch ----
  stretch_1: {
    id: 'stretch_1',
    name: '伸長I',
    description: '体が1.5倍に伸びる',
    branch: 'dust',
    tier: 1,
    threshold: 10,
    effects: { bodyStretchFactor: 1.5 },
    color: 0xccccbb,
    prev: null,
  },
  stretch_2: {
    id: 'stretch_2',
    name: '伸長II',
    description: '体が2.0倍に伸びる',
    branch: 'dust',
    tier: 2,
    threshold: 25,
    effects: { bodyStretchFactor: 2.0 },
    color: 0xaabb99,
    prev: 'stretch_1',
  },
  sticky_1: {
    id: 'sticky_1',
    name: '粘着I',
    description: '摩擦力が大幅に上がる',
    branch: 'dust',
    tier: 3,
    threshold: 50,
    effects: { friction: 0.95 },
    color: 0x88aa77,
    prev: 'stretch_2',
  },

  // ---- Sap branch ----
  jump_1: {
    id: 'jump_1',
    name: '跳躍I',
    description: 'ジャンプが可能になる',
    branch: 'sap',
    tier: 1,
    threshold: 10,
    effects: { canJump: true },
    color: 0xddaa44,
    prev: null,
  },
  jump_2: {
    id: 'jump_2',
    name: '跳躍II',
    description: '溜めジャンプが可能になる',
    branch: 'sap',
    tier: 2,
    threshold: 25,
    effects: { canChargedJump: true },
    color: 0xcc8833,
    prev: 'jump_1',
  },
  traction_1: {
    id: 'traction_1',
    name: '牽引I',
    description: 'グラップル発射が可能になる',
    branch: 'sap',
    tier: 3,
    threshold: 50,
    effects: { canGrapple: true, grappleRange: 200 },
    color: 0xbb6622,
    prev: 'jump_2',
  },
};

export const ALL_NODE_IDS: EvolutionNodeId[] = [
  'stretch_1', 'stretch_2', 'sticky_1',
  'jump_1', 'jump_2', 'traction_1',
];
