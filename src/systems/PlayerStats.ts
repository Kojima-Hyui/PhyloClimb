import * as C from '../constants';
import { EvolutionSystem } from './EvolutionSystem';
import { evolutionTree } from '../data/evolutionTree';

/**
 * Resolves effective player stats by layering evolution bonuses on top of base constants.
 * Read stats from here instead of constants directly so evolution effects apply.
 */
export class PlayerStats {
  constructor(private evo: EvolutionSystem) {}

  get grappleRange(): number {
    let v = C.GRAPPLE_RANGE;
    if (this.evo.isUnlocked('root')) v += evolutionTree.root.effects.grappleRange!;
    if (this.evo.isUnlocked('tendon')) v += evolutionTree.tendon.effects.grappleRange!;
    return v;
  }

  get airControl(): number {
    let v = C.PLAYER_AIR_CONTROL;
    if (this.evo.isUnlocked('trunk')) v += evolutionTree.trunk.effects.airControl!;
    return v;
  }

  get reelSpeed(): number {
    let v = C.REEL_SPEED;
    if (this.evo.isUnlocked('forelimb')) v += evolutionTree.forelimb.effects.reelSpeed!;
    return v;
  }

  get maxHp(): number {
    let v = C.MAX_HP;
    if (this.evo.isUnlocked('root')) v += evolutionTree.root.effects.maxHp!;
    if (this.evo.isUnlocked('shell')) v += evolutionTree.shell.effects.maxHp!;
    return v;
  }

  get fallThresholdSmall(): number {
    return C.FALL_THRESHOLD_SMALL;
  }

  get fallThresholdMedium(): number {
    return C.FALL_THRESHOLD_MEDIUM;
  }

  get fallThresholdLarge(): number {
    return C.FALL_THRESHOLD_LARGE;
  }

  /** Fall damage multiplier (1.0 = normal, 0.7 = 30% reduction) */
  get fallDamageMultiplier(): number {
    let v = 1.0;
    if (this.evo.isUnlocked('shell')) v *= (1 - evolutionTree.shell.effects.fallDamageReduction!);
    return v;
  }

  /** Momentum retention on grapple release (0 = none, 0.3 = 30% bonus) */
  get momentumRetention(): number {
    let v = 0;
    if (this.evo.isUnlocked('grip')) v += evolutionTree.grip.effects.momentumRetention!;
    return v;
  }

  /** Whether sticky wall-cling is active */
  get stickyWalls(): boolean {
    return this.evo.isUnlocked('sticky');
  }
}
