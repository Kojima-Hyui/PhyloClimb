import * as C from '../constants';
import { FeedingSystem } from './FeedingSystem';

/**
 * Derives effective player stats from FeedingSystem evolution state.
 */
export class PlayerStats {
  constructor(private feeding: FeedingSystem) {}

  /** Body stretch multiplier (1.0 = normal sphere). */
  get bodyStretchFactor(): number {
    if (this.feeding.isActive('stretch_2')) return 2.0;
    if (this.feeding.isActive('stretch_1')) return 1.5;
    return 1.0;
  }

  /** Surface friction. */
  get friction(): number {
    if (this.feeding.isActive('sticky_1')) return 0.95;
    return 0.1;
  }

  /** Whether basic jump is unlocked. */
  get canJump(): boolean {
    return this.feeding.isActive('jump_1');
  }

  /** Whether charged jump is unlocked. */
  get canChargedJump(): boolean {
    return this.feeding.isActive('jump_2');
  }

  /** Whether grapple is unlocked. */
  get canGrapple(): boolean {
    return this.feeding.isActive('traction_1');
  }

  /** Grapple range (0 if not unlocked). */
  get grappleRange(): number {
    if (!this.canGrapple) return 0;
    return C.GRAPPLE_RANGE;
  }

  get maxHp(): number {
    return C.MAX_HP;
  }

  get fallDamageMultiplier(): number {
    return 1.0;
  }

  get airControl(): number {
    return C.PLAYER_AIR_CONTROL;
  }

  get reelSpeed(): number {
    return C.REEL_SPEED;
  }
}
