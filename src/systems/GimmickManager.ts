import Phaser from 'phaser';
import { FakeHookManager } from '../gimmicks/FakeHook';
import { BreakablePlatformManager } from '../gimmicks/BreakablePlatform';
import { PeriodicWindManager } from '../gimmicks/PeriodicWind';
import * as Stage from '../data/stageData';

/**
 * Central manager for all gimmicks.
 * Handles creation, updates, and provides unified hooks for GameScene.
 */
export class GimmickManager {
  readonly fakeHooks: FakeHookManager;
  readonly breakables: BreakablePlatformManager;
  readonly wind: PeriodicWindManager;

  constructor(scene: Phaser.Scene, onFakeHookDetach: () => void) {
    this.fakeHooks = new FakeHookManager(scene, Stage.fakeHookPoints, onFakeHookDetach);
    this.breakables = new BreakablePlatformManager(scene, Stage.breakablePlatforms);
    this.wind = new PeriodicWindManager(scene, Stage.windZones);
  }

  update(time: number, playerBody: MatterJS.BodyType, playerX: number, playerY: number): {
    fakeHookDetached: boolean;
  } {
    const fakeHookDetached = this.fakeHooks.update();
    this.breakables.update();
    this.wind.update(time, playerBody, playerX, playerY);
    return { fakeHookDetached };
  }

  updateVisuals(playerX: number, playerY: number, grappleRange: number): void {
    this.fakeHooks.updateVisuals(playerX, playerY, grappleRange);
  }
}
