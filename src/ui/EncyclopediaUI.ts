import Phaser from 'phaser';
import { EncyclopediaSystem } from '../systems/EncyclopediaSystem';
import { evolutionTree, EvolutionNodeId } from '../data/evolutionTree';
import * as C from '../constants';

/**
 * Encyclopedia overlay toggled with Tab key.
 * Shows 2-branch x 3-node evolution tree and run statistics.
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

    // Draw 2-branch tree
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

    const gfx = this.scene.add.graphics();
    this.container.add(gfx);

    // Branch layout: two horizontal rows
    const dustBranch: EvolutionNodeId[] = ['stretch_1', 'stretch_2', 'sticky_1'];
    const sapBranch: EvolutionNodeId[] = ['jump_1', 'jump_2', 'traction_1'];

    const branchStartX = 180;
    const nodeSpacing = 160;
    const dustY = 180;
    const sapY = 340;
    const nodeRadius = 24;

    // Branch labels
    this.container.add(
      this.scene.add.text(80, dustY, '塵\n(Dust)', {
        fontSize: '14px', color: '#ccccbb', align: 'center',
      }).setOrigin(0.5)
    );
    this.container.add(
      this.scene.add.text(80, sapY, '液\n(Sap)', {
        fontSize: '14px', color: '#ddaa44', align: 'center',
      }).setOrigin(0.5)
    );

    // Draw branches
    this.drawBranch(gfx, dustBranch, discovered, branchStartX, dustY, nodeSpacing, nodeRadius);
    this.drawBranch(gfx, sapBranch, discovered, branchStartX, sapY, nodeSpacing, nodeRadius);
  }

  private drawBranch(
    gfx: Phaser.GameObjects.Graphics,
    nodes: EvolutionNodeId[],
    discovered: EvolutionNodeId[],
    startX: number,
    y: number,
    spacing: number,
    radius: number,
  ): void {
    for (let i = 0; i < nodes.length; i++) {
      const nodeId = nodes[i];
      const node = evolutionTree[nodeId];
      const x = startX + i * spacing;
      const isDiscovered = discovered.includes(nodeId);

      // Edge to next node
      if (i < nodes.length - 1) {
        const nextX = startX + (i + 1) * spacing;
        const nextDiscovered = discovered.includes(nodes[i + 1]);
        const bothDiscovered = isDiscovered && nextDiscovered;
        gfx.lineStyle(2, bothDiscovered ? 0x88ff88 : 0x444444, bothDiscovered ? 0.6 : 0.3);
        gfx.beginPath();
        gfx.moveTo(x + radius, y);
        gfx.lineTo(nextX - radius, y);
        gfx.strokePath();
      }

      // Node circle
      const color = isDiscovered ? node.color : 0x333333;
      const alpha = isDiscovered ? 0.9 : 0.4;
      gfx.fillStyle(color, alpha);
      gfx.fillCircle(x, y, radius);
      gfx.lineStyle(2, isDiscovered ? 0xffffff : 0x555555, 0.5);
      gfx.strokeCircle(x, y, radius);

      // Threshold text inside circle
      this.container!.add(
        this.scene.add.text(x, y - 2, `${node.threshold}`, {
          fontSize: '11px',
          color: isDiscovered ? '#ffffff' : '#888888',
          fontStyle: 'bold',
        }).setOrigin(0.5)
      );

      // Name below
      const nameText = isDiscovered ? node.name : '???';
      this.container!.add(
        this.scene.add.text(x, y + radius + 12, nameText, {
          fontSize: '13px',
          color: isDiscovered ? '#ffffff' : '#666666',
        }).setOrigin(0.5)
      );

      // Description
      if (isDiscovered) {
        this.container!.add(
          this.scene.add.text(x, y + radius + 28, node.description, {
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
