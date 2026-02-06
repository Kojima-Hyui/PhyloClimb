import Phaser from 'phaser';
import { EvolutionNodeId, evolutionTree } from '../data/evolutionTree';
import { EvolutionSystem } from '../systems/EvolutionSystem';
import * as C from '../constants';

interface CardInfo {
  nodeId: EvolutionNodeId;
  cx: number;
  cy: number;
  w: number;
  h: number;
  gfx: Phaser.GameObjects.Graphics;
  color: number;
}

/**
 * Card-based evolution selection overlay.
 * A/D: navigate, E: confirm, Esc: skip
 */
export class EvolutionSelectUI {
  private scene: Phaser.Scene;
  private evo: EvolutionSystem;
  private container: Phaser.GameObjects.Container | null = null;
  private onComplete: (() => void) | null = null;
  private cards: CardInfo[] = [];
  private selectedIndex = 0;
  private keys: Phaser.Input.Keyboard.Key[] = [];

  constructor(scene: Phaser.Scene, evo: EvolutionSystem) {
    this.scene = scene;
    this.evo = evo;
  }

  show(onComplete: () => void): void {
    if (this.container) return;
    this.onComplete = onComplete;
    this.cards = [];
    this.selectedIndex = 0;

    // Pause physics
    this.scene.matter.world.pause();

    const available = this.evo.getAvailable(evolutionTree);
    if (available.length === 0) {
      this.close();
      return;
    }

    const choices = this.shuffle(available).slice(0, 3);

    this.container = this.scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    // Dimmed background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, C.GAME_WIDTH, C.GAME_HEIGHT);
    this.container.add(bg);

    // Title
    this.container.add(
      this.scene.add.text(C.GAME_WIDTH / 2, 70, '進化を選べ', {
        fontSize: '28px', color: '#88ff88', fontStyle: 'bold',
      }).setOrigin(0.5)
    );

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

    // Controls hint
    this.container.add(
      this.scene.add.text(C.GAME_WIDTH / 2, C.GAME_HEIGHT - 50, 'A/D: 選択  E: 決定  Esc: スキップ', {
        fontSize: '14px', color: '#aaaaaa',
      }).setOrigin(0.5)
    );

    // Draw initial selection highlight
    this.updateSelection();

    // Keyboard input
    const kb = this.scene.input.keyboard!;
    const keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    const keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    const keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    const keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    const keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    keyA.on('down', this.onLeft);
    keyD.on('down', this.onRight);
    keyLeft.on('down', this.onLeft);
    keyRight.on('down', this.onRight);
    keyE.on('down', this.onConfirm);
    keyEsc.on('down', this.onSkip);

    this.keys = [keyA, keyD, keyLeft, keyRight, keyE, keyEsc];
  }

  private onLeft = () => {
    if (this.cards.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.cards.length) % this.cards.length;
    this.updateSelection();
  };

  private onRight = () => {
    if (this.cards.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.cards.length;
    this.updateSelection();
  };

  private onConfirm = () => {
    if (this.cards.length === 0) return;
    const card = this.cards[this.selectedIndex];
    this.evo.unlock(card.nodeId);
    this.close();
  };

  private onSkip = () => {
    this.close();
  };

  private updateSelection(): void {
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const selected = i === this.selectedIndex;
      card.gfx.clear();

      if (selected) {
        card.gfx.fillStyle(0x2a2a4e, 0.95);
        card.gfx.fillRoundedRect(card.cx - card.w / 2, card.cy - card.h / 2, card.w, card.h, 12);
        card.gfx.lineStyle(3, card.color, 1);
        card.gfx.strokeRoundedRect(card.cx - card.w / 2, card.cy - card.h / 2, card.w, card.h, 12);
        // Selection arrow
        card.gfx.fillStyle(0xffffff, 0.9);
        card.gfx.fillTriangle(
          card.cx, card.cy - card.h / 2 - 18,
          card.cx - 8, card.cy - card.h / 2 - 28,
          card.cx + 8, card.cy - card.h / 2 - 28,
        );
      } else {
        card.gfx.fillStyle(0x1a1a2e, 0.95);
        card.gfx.fillRoundedRect(card.cx - card.w / 2, card.cy - card.h / 2, card.w, card.h, 12);
        card.gfx.lineStyle(2, card.color, 0.5);
        card.gfx.strokeRoundedRect(card.cx - card.w / 2, card.cy - card.h / 2, card.w, card.h, 12);
      }
    }
  }

  private createCard(cx: number, cy: number, w: number, h: number, node: typeof evolutionTree[EvolutionNodeId], nodeId: EvolutionNodeId): void {
    if (!this.container) return;

    const gfx = this.scene.add.graphics();
    this.container.add(gfx);

    // Color orb
    const orb = this.scene.add.circle(cx, cy - h / 2 + 40, 20, node.color, 0.8);
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

    this.cards.push({ nodeId, cx, cy, w, h, gfx, color: node.color });
  }

  private close(): void {
    // Remove key listeners
    for (const key of this.keys) {
      key.off('down', this.onLeft);
      key.off('down', this.onRight);
      key.off('down', this.onConfirm);
      key.off('down', this.onSkip);
    }
    this.keys = [];

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
