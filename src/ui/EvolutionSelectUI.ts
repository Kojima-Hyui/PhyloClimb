import Phaser from 'phaser';
import { EvolutionNodeId, evolutionTree } from '../data/evolutionTree';
import { EvolutionSystem } from '../systems/EvolutionSystem';
import * as C from '../constants';

interface CardInfo {
  nodeId: EvolutionNodeId;
  left: number; top: number; right: number; bottom: number;
  gfx: Phaser.GameObjects.Graphics;
  color: number;
}

/**
 * Card-based evolution selection overlay.
 * Pauses physics, shows available evolution choices, applies selection, resumes.
 * Uses scene-level pointer events to avoid container+scrollFactor hit-test issues.
 */
export class EvolutionSelectUI {
  private scene: Phaser.Scene;
  private evo: EvolutionSystem;
  private container: Phaser.GameObjects.Container | null = null;
  private onComplete: (() => void) | null = null;
  private cards: CardInfo[] = [];
  private clickHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private escHandler: (() => void) | null = null;
  private escKey: Phaser.Input.Keyboard.Key | null = null;

  constructor(scene: Phaser.Scene, evo: EvolutionSystem) {
    this.scene = scene;
    this.evo = evo;
  }

  show(onComplete: () => void): void {
    if (this.container) return;
    this.onComplete = onComplete;
    this.cards = [];

    // Pause physics
    this.scene.matter.world.pause();

    const available = this.evo.getAvailable(evolutionTree);
    if (available.length === 0) {
      this.close();
      return;
    }

    // Pick up to 3 random choices
    const choices = this.shuffle(available).slice(0, 3);

    this.container = this.scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    // Dimmed background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, C.GAME_WIDTH, C.GAME_HEIGHT);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(C.GAME_WIDTH / 2, 80, '進化を選べ', {
      fontSize: '28px',
      color: '#88ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);

    // Cards
    const cardW = 180;
    const cardH = 220;
    const gap = 20;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (C.GAME_WIDTH - totalW) / 2;

    for (let i = 0; i < choices.length; i++) {
      const node = evolutionTree[choices[i]];
      const cx = startX + i * (cardW + gap) + cardW / 2;
      const cy = C.GAME_HEIGHT / 2;
      this.createCard(cx, cy, cardW, cardH, node, choices[i]);
    }

    // Skip hint
    const skip = this.scene.add.text(C.GAME_WIDTH / 2, C.GAME_HEIGHT - 50, 'Escでスキップ', {
      fontSize: '13px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    this.container.add(skip);

    // Scene-level click handler (uses screen coordinates, avoids container hit-test issues)
    this.clickHandler = (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const sx = pointer.x;
      const sy = pointer.y;

      for (const card of this.cards) {
        if (sx >= card.left && sx <= card.right && sy >= card.top && sy <= card.bottom) {
          this.evo.unlock(card.nodeId);
          this.close();
          return;
        }
      }
    };
    this.scene.input.on('pointerdown', this.clickHandler);

    // ESC to skip
    this.escKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escHandler = () => this.close();
    this.escKey.on('down', this.escHandler);
  }

  private createCard(cx: number, cy: number, w: number, h: number, node: typeof evolutionTree[EvolutionNodeId], nodeId: EvolutionNodeId): void {
    if (!this.container) return;

    const left = cx - w / 2;
    const top = cy - h / 2;

    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0x1a1a2e, 0.95);
    gfx.fillRoundedRect(left, top, w, h, 12);
    gfx.lineStyle(2, node.color, 0.8);
    gfx.strokeRoundedRect(left, top, w, h, 12);
    this.container.add(gfx);

    // Color orb
    const orb = this.scene.add.circle(cx, top + 40, 20, node.color, 0.8);
    this.container.add(orb);
    this.scene.tweens.add({
      targets: orb,
      scaleX: 1.2, scaleY: 1.2, alpha: 0.5,
      duration: 800, yoyo: true, repeat: -1,
    });

    // Name
    this.container.add(
      this.scene.add.text(cx, cy - 20, node.name, {
        fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    // Description
    this.container.add(
      this.scene.add.text(cx, cy + 15, node.description, {
        fontSize: '13px', color: '#cccccc',
        wordWrap: { width: w - 20 }, align: 'center',
      }).setOrigin(0.5)
    );

    // "Select" label (visual only, not interactive)
    this.container.add(
      this.scene.add.text(cx, cy + h / 2 - 30, '▶ 選択', {
        fontSize: '15px', color: '#88ff88', fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    // Register card hit area (screen coordinates)
    this.cards.push({
      nodeId, left, top, right: left + w, bottom: top + h,
      gfx, color: node.color,
    });
  }

  private close(): void {
    // Remove event listeners
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.escKey && this.escHandler) {
      this.escKey.off('down', this.escHandler);
      this.escHandler = null;
      this.escKey = null;
    }

    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
    this.cards = [];

    this.scene.matter.world.resume();
    if (this.onComplete) {
      this.onComplete();
      this.onComplete = null;
    }
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  isVisible(): boolean {
    return this.container !== null;
  }

  destroy(): void {
    this.close();
  }
}
