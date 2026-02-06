import Phaser from 'phaser';
import * as C from '../constants';
import { PointDef } from '../data/stageData';

interface FakeHookInstance {
  x: number;
  y: number;
  graphics: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  attachedTime: number;  // 0 = not attached, >0 = timestamp of attachment
  isTarget: boolean;     // currently grappled to this fake hook
}

/**
 * Fake hooks look like normal hooks but detach ~1s after grapple connection.
 * Warning animation at 0.6s: shake + red color change.
 */
export class FakeHookManager {
  private scene: Phaser.Scene;
  private hooks: FakeHookInstance[] = [];
  private onDetach: (() => void) | null = null;

  constructor(scene: Phaser.Scene, positions: PointDef[], onDetach: () => void) {
    this.scene = scene;
    this.onDetach = onDetach;

    for (const p of positions) {
      const glow = scene.add.circle(p.x, p.y, 14, C.COLOR_FAKE_HOOK, 0.15).setDepth(4);
      const circle = scene.add.circle(p.x, p.y, 8, C.COLOR_FAKE_HOOK, 0.7).setDepth(5);

      // Same pulse as real hooks
      scene.tweens.add({
        targets: circle,
        alpha: { from: 0.5, to: 0.9 },
        duration: 1200,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 1000,
      });

      this.hooks.push({
        x: p.x, y: p.y,
        graphics: circle, glow,
        attachedTime: 0,
        isTarget: false,
      });
    }
  }

  /** Returns hook points in the format expected by findBestHook. */
  getHookPoints(): { x: number; y: number; graphics: Phaser.GameObjects.Arc; glow: Phaser.GameObjects.Arc }[] {
    return this.hooks;
  }

  /** Called when player grapples onto a point — checks if it's a fake. */
  onGrappleAttach(targetX: number, targetY: number): void {
    for (const h of this.hooks) {
      if (Math.abs(h.x - targetX) < 2 && Math.abs(h.y - targetY) < 2) {
        h.attachedTime = this.scene.time.now;
        h.isTarget = true;
        return;
      }
    }
  }

  /** Called when grapple is released (any hook). */
  onGrappleRelease(): void {
    for (const h of this.hooks) {
      if (h.isTarget) {
        h.isTarget = false;
        h.attachedTime = 0;
        // Reset visuals
        h.graphics.setFillStyle(C.COLOR_FAKE_HOOK, 0.7);
        h.graphics.x = h.x;
        h.graphics.y = h.y;
      }
    }
  }

  /** Call from update(). Returns true if a fake hook triggered detachment this frame. */
  update(): boolean {
    const now = this.scene.time.now;

    for (const h of this.hooks) {
      if (!h.isTarget || h.attachedTime === 0) continue;

      const elapsed = now - h.attachedTime;

      // Warning phase: shake + turn red
      if (elapsed >= C.FAKE_HOOK_WARN_TIME && elapsed < C.FAKE_HOOK_DETACH_TIME) {
        const shake = Math.sin(elapsed * 0.05) * 3;
        h.graphics.x = h.x + shake;
        const warnProgress = (elapsed - C.FAKE_HOOK_WARN_TIME) / (C.FAKE_HOOK_DETACH_TIME - C.FAKE_HOOK_WARN_TIME);
        const r = Math.floor(0xee + warnProgress * (0xff - 0xee));
        const g = Math.floor(0xdd * (1 - warnProgress));
        const b = Math.floor(0x44 * (1 - warnProgress));
        h.graphics.setFillStyle((r << 16) | (g << 8) | b, 1);
      }

      // Detach!
      if (elapsed >= C.FAKE_HOOK_DETACH_TIME) {
        h.isTarget = false;
        h.attachedTime = 0;
        h.graphics.setFillStyle(C.COLOR_FAKE_HOOK, 0.3);
        h.graphics.x = h.x;

        // Flash effect
        this.scene.tweens.add({
          targets: h.graphics,
          alpha: { from: 0.1, to: 0.7 },
          duration: 2000,
        });

        if (this.onDetach) this.onDetach();
        return true;
      }
    }
    return false;
  }

  /** Update fake hook range visuals like real hooks. */
  updateVisuals(playerX: number, playerY: number, grappleRange: number): void {
    for (const h of this.hooks) {
      const dist = Phaser.Math.Distance.Between(playerX, playerY, h.x, h.y);
      if (h.isTarget) continue; // Don't override warning visuals
      if (dist <= grappleRange) {
        h.graphics.setFillStyle(C.COLOR_FAKE_HOOK, 1);
        h.graphics.setScale(1.3);
        h.glow.setAlpha(0.3);
      } else {
        h.graphics.setFillStyle(C.COLOR_FAKE_HOOK, 0.5);
        h.graphics.setScale(1);
        h.glow.setAlpha(0.1);
      }
    }
  }
}
