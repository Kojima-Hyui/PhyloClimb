import Phaser from 'phaser';
import * as C from '../constants';
import { WindZoneDef } from '../data/stageData';

interface WindZoneInstance {
  def: WindZoneDef;
  graphics: Phaser.GameObjects.Graphics;
  arrowLines: Phaser.GameObjects.Graphics;
}

/**
 * Periodic wind zones apply sin-wave horizontal force to the player.
 * Visual indicators show wind direction and strength.
 */
export class PeriodicWindManager {
  private scene: Phaser.Scene;
  private zones: WindZoneInstance[] = [];

  constructor(scene: Phaser.Scene, defs: WindZoneDef[]) {
    this.scene = scene;

    for (const def of defs) {
      const gfx = scene.add.graphics().setDepth(0);
      const arrows = scene.add.graphics().setDepth(1);

      // Static zone boundary
      gfx.fillStyle(C.COLOR_WIND_ZONE, 0.06);
      gfx.fillRect(def.x - def.w / 2, def.y - def.h / 2, def.w, def.h);
      gfx.lineStyle(1, C.COLOR_WIND_ZONE, 0.15);
      gfx.strokeRect(def.x - def.w / 2, def.y - def.h / 2, def.w, def.h);

      this.zones.push({ def, graphics: gfx, arrowLines: arrows });
    }
  }

  /**
   * Call from update().
   * Applies wind force to the player if inside a zone.
   * Returns the total wind force vector applied.
   */
  update(time: number, playerBody: MatterJS.BodyType, playerX: number, playerY: number): { fx: number; fy: number } {
    let totalFx = 0;
    let totalFy = 0;

    for (const zone of this.zones) {
      const def = zone.def;
      const left = def.x - def.w / 2;
      const right = def.x + def.w / 2;
      const top = def.y - def.h / 2;
      const bottom = def.y + def.h / 2;

      // Calculate current wind strength (sin wave)
      const timeSec = time / 1000;
      const windStrength = Math.sin((timeSec / def.period) * Math.PI * 2) * def.maxForce;

      // Draw wind arrows
      this.drawWindArrows(zone, windStrength);

      // Apply force if player is inside
      if (playerX >= left && playerX <= right && playerY >= top && playerY <= bottom) {
        const MatterLib = (Phaser.Physics.Matter as any).Matter as typeof MatterJS;
        MatterLib.Body.applyForce(playerBody, playerBody.position, {
          x: windStrength,
          y: 0,
        });
        totalFx += windStrength;
      }
    }

    return { fx: totalFx, fy: totalFy };
  }

  private drawWindArrows(zone: WindZoneInstance, windStrength: number): void {
    const gfx = zone.arrowLines;
    gfx.clear();

    const def = zone.def;
    const absStrength = Math.abs(windStrength);
    const dir = Math.sign(windStrength);

    if (absStrength < 0.0005) return; // Too weak to show

    const alpha = Math.min(0.6, absStrength / def.maxForce * 0.6);

    // Color shifts from blue (weak) to cyan (strong)
    const intensity = absStrength / def.maxForce;
    const r = Math.floor(0x44 * (1 - intensity));
    const g = Math.floor(0x88 + intensity * 0x77);
    const b = 0xcc;
    const color = (r << 16) | (g << 8) | b;

    gfx.lineStyle(2, color, alpha);

    // Draw arrow lines across the zone
    const left = def.x - def.w / 2;
    const top = def.y - def.h / 2;
    const rows = 4;
    const cols = 3;
    const rowSpacing = def.h / (rows + 1);
    const colSpacing = def.w / (cols + 1);
    const arrowLen = 20 * intensity;

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const ax = left + c * colSpacing;
        const ay = top + r * rowSpacing;

        // Arrow line
        gfx.beginPath();
        gfx.moveTo(ax - arrowLen * dir, ay);
        gfx.lineTo(ax + arrowLen * dir, ay);
        gfx.strokePath();

        // Arrowhead
        const headSize = 5 * intensity;
        gfx.beginPath();
        gfx.moveTo(ax + arrowLen * dir, ay);
        gfx.lineTo(ax + (arrowLen - headSize) * dir, ay - headSize);
        gfx.strokePath();
        gfx.beginPath();
        gfx.moveTo(ax + arrowLen * dir, ay);
        gfx.lineTo(ax + (arrowLen - headSize) * dir, ay + headSize);
        gfx.strokePath();
      }
    }
  }
}
