import Phaser from 'phaser';
import { EncyclopediaSystem } from '../systems/EncyclopediaSystem';
import { evolutionTree, ALL_NODE_IDS, EvolutionNodeId } from '../data/evolutionTree';
import * as C from '../constants';

/**
 * Encyclopedia overlay toggled with Tab key.
 * Shows discovered evolution nodes and run statistics.
 */
export class EncyclopediaUI {
  private scene: Phaser.Scene;
  private encyclopedia: EncyclopediaSystem;
  private container: Phaser.GameObjects.Container | null = null;
  private visible = false;

  constructor(scene: Phaser.Scene, encyclopedia: EncyclopediaSystem) {
    this.scene = scene;
    this.encyclopedia = encyclopedia;

    const tabKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    tabKey.on('down', () => this.toggle());

    // Prevent Tab from tabbing out of game
    scene.input.keyboard!.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
  }

  private toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  private show(): void {
    if (this.container) return;
    this.visible = true;

    this.container = this.scene.add.container(0, 0).setDepth(190).setScrollFactor(0);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, C.GAME_WIDTH, C.GAME_HEIGHT);
    this.container.add(bg);

    // Title
    this.container.add(
      this.scene.add.text(C.GAME_WIDTH / 2, 30, '図鑑', {
        fontSize: '28px', color: '#88ff88', fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    const data = this.encyclopedia.getData();

    // Stats row
    const statsY = 70;
    const statsText = `ラン: ${data.totalRuns}  クリア: ${data.totalClears}  最高残HP: ${data.bestRemainingHp}  発見率: ${Math.round(this.encyclopedia.getDiscoveryRate() * 100)}%`;
    this.container.add(
      this.scene.add.text(C.GAME_WIDTH / 2, statsY, statsText, {
        fontSize: '13px', color: '#aaaaaa',
      }).setOrigin(0.5)
    );

    // Evolution tree visualization
    this.drawTree(data.discoveredNodes);

    // Close hint
    this.container.add(
      this.scene.add.text(C.GAME_WIDTH / 2, C.GAME_HEIGHT - 20, 'Tabで閉じる', {
        fontSize: '12px', color: '#888888',
      }).setOrigin(0.5)
    );
  }

  private drawTree(discovered: EvolutionNodeId[]): void {
    if (!this.container) return;

    // Node positions in the tree layout
    const positions: Record<EvolutionNodeId, { x: number; y: number }> = {
      root:     { x: 400, y: 140 },
      forelimb: { x: 250, y: 230 },
      trunk:    { x: 550, y: 230 },
      tendon:   { x: 170, y: 320 },
      grip:     { x: 330, y: 320 },
      shell:    { x: 550, y: 320 },
      sticky:   { x: 550, y: 410 },
    };

    const gfx = this.scene.add.graphics();
    this.container.add(gfx);

    // Draw edges
    for (const id of ALL_NODE_IDS) {
      const node = evolutionTree[id];
      if (node.parent) {
        const from = positions[node.parent];
        const to = positions[id];
        const bothDiscovered = discovered.includes(id) && discovered.includes(node.parent);
        gfx.lineStyle(2, bothDiscovered ? 0x88ff88 : 0x444444, bothDiscovered ? 0.6 : 0.3);
        gfx.beginPath();
        gfx.moveTo(from.x, from.y);
        gfx.lineTo(to.x, to.y);
        gfx.strokePath();
      }
    }

    // Draw nodes
    for (const id of ALL_NODE_IDS) {
      const node = evolutionTree[id];
      const pos = positions[id];
      const isDiscovered = discovered.includes(id);

      // Circle
      const color = isDiscovered ? node.color : 0x333333;
      const alpha = isDiscovered ? 0.9 : 0.4;
      gfx.fillStyle(color, alpha);
      gfx.fillCircle(pos.x, pos.y, 22);
      gfx.lineStyle(2, isDiscovered ? 0xffffff : 0x555555, 0.5);
      gfx.strokeCircle(pos.x, pos.y, 22);

      // Name
      const nameText = isDiscovered ? node.name : '???';
      this.container!.add(
        this.scene.add.text(pos.x, pos.y + 30, nameText, {
          fontSize: '12px',
          color: isDiscovered ? '#ffffff' : '#666666',
        }).setOrigin(0.5)
      );

      // Description (only if discovered)
      if (isDiscovered) {
        this.container!.add(
          this.scene.add.text(pos.x, pos.y + 45, node.description, {
            fontSize: '10px',
            color: '#aaaaaa',
          }).setOrigin(0.5)
        );
      }
    }
  }

  private hide(): void {
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.hide();
  }
}
