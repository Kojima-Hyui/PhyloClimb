import Phaser from 'phaser';
import * as C from '../constants';
import { BreakablePlatformDef } from '../data/stageData';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MatterLib = (Phaser.Physics.Matter as any).Matter as typeof MatterJS;

interface BreakableInstance {
  def: BreakablePlatformDef;
  body: MatterJS.BodyType;
  graphics: Phaser.GameObjects.Graphics;
  state: 'solid' | 'warning' | 'collapsed' | 'respawning';
  stateTime: number;  // timestamp when entered current state
  playerOnIt: boolean;
}

/**
 * Breakable platforms collapse ~0.8s after player stands on them.
 * Warning: shake + color change at 0.4s.
 * Respawn after 5s (configurable per platform).
 */
export class BreakablePlatformManager {
  private scene: Phaser.Scene;
  private platforms: BreakableInstance[] = [];

  constructor(scene: Phaser.Scene, defs: BreakablePlatformDef[]) {
    this.scene = scene;

    for (const def of defs) {
      const body = scene.matter.add.rectangle(def.x, def.y, def.w, def.h, {
        isStatic: true,
        label: 'breakable',
        friction: 0.8,
      }) as unknown as MatterJS.BodyType;

      const gfx = scene.add.graphics().setDepth(1);
      this.drawPlatform(gfx, def, C.COLOR_BREAKABLE, false);

      this.platforms.push({
        def, body, graphics: gfx,
        state: 'solid',
        stateTime: 0,
        playerOnIt: false,
      });
    }
  }

  /** Get all bodies for collision detection. */
  getBodies(): MatterJS.BodyType[] {
    return this.platforms.map(p => p.body);
  }

  /** Called from collision start — player touched a breakable. */
  onPlayerContact(otherBody: MatterJS.BodyType): void {
    for (const p of this.platforms) {
      if (p.body === otherBody && p.state === 'solid') {
        p.playerOnIt = true;
        p.state = 'warning';
        p.stateTime = this.scene.time.now;
      }
    }
  }

  /** Called from collision end — player left a breakable. */
  onPlayerLeave(otherBody: MatterJS.BodyType): void {
    for (const p of this.platforms) {
      if (p.body === otherBody) {
        p.playerOnIt = false;
        // Don't cancel warning — once triggered, it collapses
      }
    }
  }

  update(): void {
    const now = this.scene.time.now;

    for (const p of this.platforms) {
      if (p.state === 'warning') {
        const elapsed = now - p.stateTime;

        // Shake effect
        const shake = Math.sin(elapsed * 0.04) * 2;
        p.graphics.clear();

        if (elapsed >= C.BREAKABLE_WARN_TIME) {
          // Getting worse
          this.drawPlatform(p.graphics, p.def, C.COLOR_BREAKABLE_WARN, true, shake);
        } else {
          this.drawPlatform(p.graphics, p.def, C.COLOR_BREAKABLE, false, shake);
        }

        // Collapse
        if (elapsed >= C.BREAKABLE_COLLAPSE_TIME) {
          p.state = 'collapsed';
          p.stateTime = now;
          p.graphics.clear();

          // Disable physics body
          MatterLib.Body.setPosition(p.body, { x: -9999, y: -9999 });

          // Particle-like break effect
          this.spawnBreakParticles(p.def);
        }
      }

      if (p.state === 'collapsed') {
        const elapsed = now - p.stateTime;
        if (p.def.respawn && elapsed >= C.BREAKABLE_RESPAWN_TIME) {
          p.state = 'respawning';
          p.stateTime = now;
        }
      }

      if (p.state === 'respawning') {
        // Fade back in
        const elapsed = now - p.stateTime;
        const fadeTime = 500;
        const alpha = Math.min(1, elapsed / fadeTime);

        p.graphics.clear();
        this.drawPlatform(p.graphics, p.def, C.COLOR_BREAKABLE, false, 0, alpha);

        if (elapsed >= fadeTime) {
          p.state = 'solid';
          MatterLib.Body.setPosition(p.body, { x: p.def.x, y: p.def.y });
        }
      }
    }
  }

  private drawPlatform(
    gfx: Phaser.GameObjects.Graphics,
    def: BreakablePlatformDef,
    color: number,
    cracks: boolean,
    shakeX = 0,
    alpha = 1,
  ): void {
    const x = def.x - def.w / 2 + shakeX;
    const y = def.y - def.h / 2;

    gfx.fillStyle(color, 0.9 * alpha);
    gfx.fillRect(x, y, def.w, def.h);

    // Dashed top highlight
    gfx.fillStyle(0xaa9988, alpha);
    gfx.fillRect(x, y, def.w, 2);

    if (cracks) {
      // Visual crack lines
      gfx.lineStyle(1, 0x000000, 0.4 * alpha);
      const mid = x + def.w / 2;
      gfx.beginPath();
      gfx.moveTo(mid - 10, y);
      gfx.lineTo(mid - 5, y + def.h);
      gfx.strokePath();
      gfx.beginPath();
      gfx.moveTo(mid + 15, y);
      gfx.lineTo(mid + 8, y + def.h);
      gfx.strokePath();
    }
  }

  private spawnBreakParticles(def: BreakablePlatformDef): void {
    for (let i = 0; i < 6; i++) {
      const px = def.x + (Math.random() - 0.5) * def.w;
      const py = def.y;
      const particle = this.scene.add.rectangle(px, py, 6, 6, C.COLOR_BREAKABLE, 0.8).setDepth(15);

      this.scene.tweens.add({
        targets: particle,
        x: px + (Math.random() - 0.5) * 40,
        y: py + 30 + Math.random() * 40,
        alpha: 0,
        duration: 600,
        onComplete: () => particle.destroy(),
      });
    }
  }
}
