import Phaser from 'phaser';
import * as C from '../constants';
import * as Stage from '../data/stageData';
import { EvolutionSystem } from '../systems/EvolutionSystem';
import { PlayerStats } from '../systems/PlayerStats';
import { EvolutionSelectUI } from '../ui/EvolutionSelectUI';
import { EncyclopediaSystem } from '../systems/EncyclopediaSystem';
import { EncyclopediaUI } from '../ui/EncyclopediaUI';
import { GimmickManager } from '../systems/GimmickManager';
import { evolutionTree, ALL_NODE_IDS } from '../data/evolutionTree';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MatterLib = (Phaser.Physics.Matter as any).Matter as typeof MatterJS;

interface HookPoint {
  x: number;
  y: number;
  graphics: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
}

interface RecoveryPoint {
  x: number;
  y: number;
  graphics: Phaser.GameObjects.Graphics;
  used: boolean;
}

interface EvoItem {
  x: number;
  y: number;
  graphics: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  collected: boolean;
}

export class GameScene extends Phaser.Scene {
  // Systems
  private evo!: EvolutionSystem;
  private stats!: PlayerStats;

  // Player
  private player!: Phaser.Physics.Matter.Sprite;
  private playerHP: number = C.MAX_HP;
  private isDead: boolean = false;

  // Fall tracking
  private peakY: number = 0;
  private groundContacts: number = 0;
  private wasGrounded: boolean = true;

  // Grapple
  private grappleState: 'idle' | 'attached' = 'idle';
  private grappleConstraint: any = null;
  private grappleTarget: HookPoint | null = null;
  private ropeLength: number = 0;
  private grappleLine!: Phaser.GameObjects.Graphics;
  private aimLine!: Phaser.GameObjects.Graphics;

  // Stage
  private hookPoints: HookPoint[] = [];
  private recoveryPoints: RecoveryPoint[] = [];
  private evoItems: EvoItem[] = [];

  // UI
  private evoSelectUI!: EvolutionSelectUI;
  private encyclopediaSystem!: EncyclopediaSystem;
  private encyclopediaUI!: EncyclopediaUI;

  // Gimmicks
  private gimmicks!: GimmickManager;

  // Input
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // HUD
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private heightBar!: Phaser.GameObjects.Graphics;
  private heightText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private evoIcons!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Systems
    this.evo = new EvolutionSystem();
    this.stats = new PlayerStats(this.evo);

    // Reset state
    this.playerHP = this.stats.maxHp;
    this.isDead = false;
    this.grappleState = 'idle';
    this.grappleConstraint = null;
    this.grappleTarget = null;
    this.groundContacts = 0;
    this.wasGrounded = true;
    this.hookPoints = [];
    this.recoveryPoints = [];
    this.evoItems = [];
    this.evoSelectUI = new EvolutionSelectUI(this, this.evo);
    this.encyclopediaSystem = new EncyclopediaSystem();

    // Background
    this.createBackground();

    // Stage elements
    this.createWalls();
    this.createPlatforms();
    this.createHookPoints();
    this.createRecoveryPoints();
    this.createEvoItems();
    this.createGoal();
    this.createDeathZone();

    // Gimmicks
    this.gimmicks = new GimmickManager(this, () => this.releaseGrapple());

    // Add fake hooks to hookPoints so findBestHook finds them
    for (const fh of this.gimmicks.fakeHooks.getHookPoints()) {
      this.hookPoints.push(fh);
    }

    // Player
    this.createPlayer();

    // Graphics layers
    this.grappleLine = this.add.graphics().setDepth(10);
    this.aimLine = this.add.graphics().setDepth(9);

    // Input
    this.setupInput();

    // Camera
    this.cameras.main.setBounds(0, 0, C.WORLD_WIDTH, C.WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Collisions
    this.setupCollisions();

    // HUD
    this.createHUD();

    // Encyclopedia UI
    this.encyclopediaUI = new EncyclopediaUI(this, this.encyclopediaSystem);

    // Cursor
    this.input.setDefaultCursor('crosshair');
  }

  update(time: number, delta: number) {
    if (this.isDead) return;

    this.handleSpaceKey();
    this.handleMovement();
    this.handleGrappleReel(delta);
    this.drawGrappleLine();
    this.drawAimIndicator();
    this.updateHookVisuals();
    this.trackFalling();

    // Gimmick updates
    const body = this.player.body as MatterJS.BodyType;
    this.gimmicks.update(time, body, this.player.x, this.player.y);
    this.gimmicks.updateVisuals(this.player.x, this.player.y, this.stats.grappleRange);
    this.updateHUD();
  }

  // ======================== Creation ========================

  private createBackground() {
    const bg = this.add.graphics().setDepth(-10);
    const bandHeight = 200;
    for (let y = 0; y < C.WORLD_HEIGHT; y += bandHeight) {
      const progress = y / C.WORLD_HEIGHT;
      const r = Math.floor(10 + progress * 10);
      const g = Math.floor(10 + (1 - progress) * 50);
      const b = Math.floor(46 + (1 - progress) * 60);
      const color = (r << 16) | (g << 8) | b;
      bg.fillStyle(color, 1);
      bg.fillRect(0, y, C.WORLD_WIDTH, bandHeight);
    }

    // Height markers
    for (let h = 500; h < C.WORLD_HEIGHT; h += 500) {
      this.add
        .text(C.WORLD_WIDTH - 10, C.WORLD_HEIGHT - h, `${h}m`, {
          fontSize: '12px',
          color: '#ffffff',
        })
        .setAlpha(0.2)
        .setOrigin(1, 0.5)
        .setDepth(-5);
    }
  }

  private createWalls() {
    const thick = 40;
    // Left wall
    this.matter.add.rectangle(-thick / 2, C.WORLD_HEIGHT / 2, thick, C.WORLD_HEIGHT + 400, {
      isStatic: true,
      label: 'wall',
    });
    // Right wall
    this.matter.add.rectangle(C.WORLD_WIDTH + thick / 2, C.WORLD_HEIGHT / 2, thick, C.WORLD_HEIGHT + 400, {
      isStatic: true,
      label: 'wall',
    });
    // Ceiling
    this.matter.add.rectangle(C.WORLD_WIDTH / 2, -thick / 2, C.WORLD_WIDTH + 200, thick, {
      isStatic: true,
      label: 'wall',
    });

    // Visual walls
    const gfx = this.add.graphics().setDepth(-1);
    gfx.fillStyle(C.COLOR_WALL, 1);
    gfx.fillRect(-5, 0, 10, C.WORLD_HEIGHT);
    gfx.fillRect(C.WORLD_WIDTH - 5, 0, 10, C.WORLD_HEIGHT);
  }

  private createPlatforms() {
    const gfx = this.add.graphics().setDepth(1);

    for (const p of Stage.platforms) {
      this.matter.add.rectangle(p.x, p.y, p.w, p.h, {
        isStatic: true,
        label: 'platform',
        friction: 0.8,
      });

      // Platform visual
      gfx.fillStyle(C.COLOR_PLATFORM, 1);
      gfx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      // Top highlight
      gfx.fillStyle(0x8888aa, 1);
      gfx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, 2);
    }
  }

  private createHookPoints() {
    for (const h of Stage.hookPoints) {
      const glow = this.add.circle(h.x, h.y, 14, C.COLOR_HOOK, 0.15).setDepth(4);
      const circle = this.add.circle(h.x, h.y, 8, C.COLOR_HOOK, 0.7).setDepth(5);

      // Pulse animation
      this.tweens.add({
        targets: circle,
        alpha: { from: 0.5, to: 0.9 },
        duration: 1200,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 1000,
      });

      this.hookPoints.push({ x: h.x, y: h.y, graphics: circle, glow });
    }
  }

  private createRecoveryPoints() {
    for (const r of Stage.recoveryPoints) {
      const gfx = this.add.graphics().setDepth(5);
      // Cross icon
      gfx.fillStyle(C.COLOR_RECOVERY, 0.8);
      gfx.fillRect(r.x - 3, r.y - 10, 6, 20);
      gfx.fillRect(r.x - 10, r.y - 3, 20, 6);
      // Glow
      gfx.fillStyle(C.COLOR_RECOVERY, 0.12);
      gfx.fillCircle(r.x, r.y, 22);

      // Sensor for pickup
      this.matter.add.rectangle(r.x, r.y, 40, 40, {
        isStatic: true,
        isSensor: true,
        label: 'recovery',
      });

      this.recoveryPoints.push({ x: r.x, y: r.y, graphics: gfx, used: false });
    }
  }

  private createEvoItems() {
    for (const e of Stage.evolutionItems) {
      const glow = this.add.circle(e.x, e.y, 18, C.COLOR_EVO_ITEM, 0.15).setDepth(4);
      const circle = this.add.circle(e.x, e.y, 10, C.COLOR_EVO_ITEM, 0.8).setDepth(5);

      // Float animation
      this.tweens.add({
        targets: [circle, glow],
        y: e.y - 6,
        duration: 1500,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });

      // Glow pulse
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.1, to: 0.35 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
      });

      // Sensor
      this.matter.add.rectangle(e.x, e.y, 36, 36, {
        isStatic: true,
        isSensor: true,
        label: 'evoitem',
      });

      this.evoItems.push({ x: e.x, y: e.y, graphics: circle, glow, collected: false });
    }
  }

  private createGoal() {
    const gfx = this.add.graphics().setDepth(5);
    gfx.fillStyle(C.COLOR_GOAL, 0.3);
    gfx.fillRect(300, 140, 200, 60);
    gfx.lineStyle(2, C.COLOR_GOAL, 0.8);
    gfx.strokeRect(300, 140, 200, 60);

    this.add
      .text(400, 170, 'GOAL', {
        fontSize: '22px',
        color: '#ffd700',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.matter.add.rectangle(400, 170, 200, 60, {
      isStatic: true,
      isSensor: true,
      label: 'goal',
    });
  }

  private createDeathZone() {
    this.matter.add.rectangle(C.WORLD_WIDTH / 2, C.WORLD_HEIGHT + 200, C.WORLD_WIDTH + 500, 400, {
      isStatic: true,
      isSensor: true,
      label: 'deathzone',
    });
  }

  private createPlayer() {
    // Generate texture
    const gfx = this.add.graphics();
    gfx.fillStyle(C.COLOR_PLAYER, 1);
    gfx.fillCircle(C.PLAYER_RADIUS, C.PLAYER_RADIUS, C.PLAYER_RADIUS);
    gfx.lineStyle(2, 0x22aa22, 1);
    gfx.strokeCircle(C.PLAYER_RADIUS, C.PLAYER_RADIUS, C.PLAYER_RADIUS);
    // Eyes
    gfx.fillStyle(0x000000, 1);
    gfx.fillCircle(C.PLAYER_RADIUS - 5, C.PLAYER_RADIUS - 4, 2);
    gfx.fillCircle(C.PLAYER_RADIUS + 5, C.PLAYER_RADIUS - 4, 2);
    gfx.generateTexture('player', C.PLAYER_RADIUS * 2, C.PLAYER_RADIUS * 2);
    gfx.destroy();

    this.player = this.matter.add.sprite(400, 3800, 'player');
    this.player.setCircle(C.PLAYER_RADIUS);
    this.player.setFriction(0.1);
    this.player.setFrictionAir(0.02);
    this.player.setBounce(0.05);
    this.player.setDepth(20);
    this.player.setFixedRotation();

    const body = this.player.body as MatterJS.BodyType;
    body.label = 'player';

    this.peakY = this.player.y;
  }

  // ======================== Input ========================

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyR = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    // Mouse click: fire/release grapple
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isDead) {
        this.restartGame();
        return;
      }

      if (pointer.leftButtonDown()) {
        if (this.grappleState === 'attached') {
          this.releaseGrapple();
        } else {
          const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          this.fireGrapple(world.x, world.y);
        }
      }

      if (pointer.rightButtonDown()) {
        this.releaseGrapple();
      }
    });

    // Scroll: reel
    this.input.on('wheel', (_pointer: any, _go: any, _dx: number, deltaY: number) => {
      if (this.grappleState === 'attached') {
        if (deltaY < 0) this.reelIn(60);
        else if (deltaY > 0) this.reelOut(60);
      }
    });

    // Disable context menu
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private setupCollisions() {
    this.matter.world.on('collisionstart', (event: any) => {
      for (const pair of event.pairs) {
        const playerBody = this.player.body as MatterJS.BodyType;
        const isA = pair.bodyA === playerBody || pair.bodyA.parent === playerBody;
        const isB = pair.bodyB === playerBody || pair.bodyB.parent === playerBody;
        if (!isA && !isB) continue;

        const other = isA ? pair.bodyB : pair.bodyA;

        if (other.label === 'platform' || other.label === 'breakable') {
          // Only count as ground if player is above the platform
          if (playerBody.position.y < other.position.y) {
            this.groundContacts++;
          }
          if (other.label === 'breakable') {
            this.gimmicks.breakables.onPlayerContact(other);
          }
        }
        if (other.label === 'recovery') {
          this.handleRecoveryPickup(other);
        }
        if (other.label === 'evoitem') {
          this.handleEvoItemPickup(other);
        }
        if (other.label === 'goal') {
          this.handleVictory();
        }
        if (other.label === 'deathzone') {
          this.playerHP = 0;
          this.die();
        }
      }
    });

    this.matter.world.on('collisionend', (event: any) => {
      for (const pair of event.pairs) {
        const playerBody = this.player.body as MatterJS.BodyType;
        const isA = pair.bodyA === playerBody || pair.bodyA.parent === playerBody;
        const isB = pair.bodyB === playerBody || pair.bodyB.parent === playerBody;
        if (!isA && !isB) continue;

        const other = isA ? pair.bodyB : pair.bodyA;

        if (other.label === 'platform' || other.label === 'breakable') {
          this.groundContacts = Math.max(0, this.groundContacts - 1);
          if (other.label === 'breakable') {
            this.gimmicks.breakables.onPlayerLeave(other);
          }
        }
      }
    });
  }

  // ======================== Movement ========================

  private handleMovement() {
    const body = this.player.body as MatterJS.BodyType;
    const grounded = this.groundContacts > 0;
    const force = grounded ? C.PLAYER_MOVE_FORCE : this.stats.airControl;

    if (this.keyA.isDown || this.cursors.left.isDown) {
      this.player.applyForce(new Phaser.Math.Vector2(-force, 0));
    }
    if (this.keyD.isDown || this.cursors.right.isDown) {
      this.player.applyForce(new Phaser.Math.Vector2(force, 0));
    }

    // Limit horizontal speed
    if (Math.abs(body.velocity.x) > C.PLAYER_MAX_VELOCITY) {
      MatterLib.Body.setVelocity(body, {
        x: Math.sign(body.velocity.x) * C.PLAYER_MAX_VELOCITY,
        y: body.velocity.y,
      });
    }
  }

  private handleSpaceKey() {
    if (!Phaser.Input.Keyboard.JustDown(this.keySpace)) return;

    if (this.grappleState === 'attached') {
      // Release grapple with upward boost + momentum retention bonus
      const body = this.player.body as MatterJS.BodyType;
      const boostY = -0.025;
      const momentumBonus = this.stats.momentumRetention;
      this.player.applyForce(new Phaser.Math.Vector2(
        body.velocity.x * momentumBonus * 0.01,
        boostY
      ));
      this.releaseGrapple();
    } else if (this.groundContacts > 0) {
      // Jump
      const body = this.player.body as MatterJS.BodyType;
      MatterLib.Body.setVelocity(body, {
        x: body.velocity.x,
        y: C.PLAYER_JUMP_VELOCITY,
      });
    }
  }

  // ======================== Grapple ========================

  private findBestHook(aimX: number, aimY: number): HookPoint | null {
    const px = this.player.x;
    const py = this.player.y;
    const aimAngle = Math.atan2(aimY - py, aimX - px);

    let bestHook: HookPoint | null = null;
    let bestScore = Infinity;

    for (const hook of this.hookPoints) {
      const dist = Phaser.Math.Distance.Between(px, py, hook.x, hook.y);
      if (dist > this.stats.grappleRange) continue;

      const hookAngle = Math.atan2(hook.y - py, hook.x - px);
      let angleDiff = Math.abs(hookAngle - aimAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      if (angleDiff > C.GRAPPLE_AIM_CONE) continue;

      const score = angleDiff * 200 + dist * 0.5;
      if (score < bestScore) {
        bestScore = score;
        bestHook = hook;
      }
    }

    return bestHook;
  }

  private fireGrapple(worldX: number, worldY: number) {
    const best = this.findBestHook(worldX, worldY);
    if (best) this.attachGrapple(best);
  }

  private attachGrapple(hook: HookPoint) {
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, hook.x, hook.y);
    this.ropeLength = dist;
    this.grappleTarget = hook;
    this.grappleState = 'attached';

    const body = this.player.body as MatterJS.BodyType;

    this.grappleConstraint = MatterLib.Constraint.create({
      bodyA: body,
      pointB: { x: hook.x, y: hook.y },
      length: this.ropeLength,
      stiffness: C.GRAPPLE_STIFFNESS,
      damping: C.GRAPPLE_DAMPING,
      render: { visible: false },
    } as any);

    MatterLib.Composite.add(this.matter.world.engine.world as any, this.grappleConstraint);

    // Notify fake hook system
    this.gimmicks.fakeHooks.onGrappleAttach(hook.x, hook.y);
  }

  private releaseGrapple() {
    if (this.grappleConstraint) {
      MatterLib.Composite.remove(this.matter.world.engine.world as any, this.grappleConstraint);
      this.grappleConstraint = null;
    }
    this.grappleTarget = null;
    this.grappleState = 'idle';
    this.gimmicks?.fakeHooks.onGrappleRelease();
  }

  private reelIn(amount: number) {
    if (!this.grappleConstraint) return;
    this.ropeLength = Math.max(C.MIN_ROPE_LENGTH, this.ropeLength - amount);
    this.grappleConstraint.length = this.ropeLength;
  }

  private reelOut(amount: number) {
    if (!this.grappleConstraint) return;
    this.ropeLength = Math.min(this.stats.grappleRange, this.ropeLength + amount);
    this.grappleConstraint.length = this.ropeLength;
  }

  private handleGrappleReel(delta: number) {
    if (this.grappleState !== 'attached') return;

    const amount = this.stats.reelSpeed * (delta / 16.67);
    if (this.keyW.isDown || this.cursors.up.isDown) {
      this.reelIn(amount);
    }
    if (this.keyS.isDown || this.cursors.down.isDown) {
      this.reelOut(amount);
    }
  }

  // ======================== Drawing ========================

  private drawGrappleLine() {
    this.grappleLine.clear();

    if (this.grappleState === 'attached' && this.grappleTarget) {
      this.grappleLine.lineStyle(2, C.COLOR_GRAPPLE_LINE, 0.8);
      this.grappleLine.beginPath();
      this.grappleLine.moveTo(this.player.x, this.player.y);
      this.grappleLine.lineTo(this.grappleTarget.x, this.grappleTarget.y);
      this.grappleLine.strokePath();

      // Hook highlight
      this.grappleLine.fillStyle(0xffffff, 1);
      this.grappleLine.fillCircle(this.grappleTarget.x, this.grappleTarget.y, 5);
    }
  }

  private drawAimIndicator() {
    this.aimLine.clear();
    if (this.grappleState !== 'idle') return;

    const pointer = this.input.activePointer;
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    // Find and highlight target hook
    const target = this.findBestHook(worldPt.x, worldPt.y);
    if (target) {
      this.aimLine.lineStyle(1, C.COLOR_GRAPPLE_LINE, 0.25);
      this.aimLine.beginPath();
      this.aimLine.moveTo(this.player.x, this.player.y);
      this.aimLine.lineTo(target.x, target.y);
      this.aimLine.strokePath();

      this.aimLine.lineStyle(2, 0xffffff, 0.6);
      this.aimLine.strokeCircle(target.x, target.y, 14);
    }
  }

  private updateHookVisuals() {
    const px = this.player.x;
    const py = this.player.y;

    for (const hook of this.hookPoints) {
      const dist = Phaser.Math.Distance.Between(px, py, hook.x, hook.y);
      if (dist <= this.stats.grappleRange) {
        hook.graphics.setFillStyle(C.COLOR_HOOK_IN_RANGE, 1);
        hook.graphics.setScale(1.3);
        hook.glow.setAlpha(0.3);
      } else {
        hook.graphics.setFillStyle(C.COLOR_HOOK, 0.5);
        hook.graphics.setScale(1);
        hook.glow.setAlpha(0.1);
      }
    }
  }

  // ======================== Health & Damage ========================

  private trackFalling() {
    const grounded = this.groundContacts > 0;

    if (!grounded) {
      if (this.player.y < this.peakY) {
        this.peakY = this.player.y;
      }
    }

    if (grounded && !this.wasGrounded) {
      const fallDistance = this.player.y - this.peakY;
      if (fallDistance > this.stats.fallThresholdSmall) {
        this.applyFallDamage(fallDistance);
      }
    }

    if (!grounded && this.wasGrounded) {
      this.peakY = this.player.y;
    }

    this.wasGrounded = grounded;

    // Restart check (separate from update flow for when dead)
    if (this.isDead && this.keyR.isDown) {
      this.restartGame();
    }
  }

  private applyFallDamage(fallPixels: number) {
    let damage: number;

    if (fallPixels < this.stats.fallThresholdMedium) {
      const t = (fallPixels - this.stats.fallThresholdSmall) / (this.stats.fallThresholdMedium - this.stats.fallThresholdSmall);
      damage = 5 + t * 5;
    } else if (fallPixels < this.stats.fallThresholdLarge) {
      const t = (fallPixels - this.stats.fallThresholdMedium) / (this.stats.fallThresholdLarge - this.stats.fallThresholdMedium);
      damage = 10 + t * 25;
    } else {
      const t = Math.min(1, (fallPixels - this.stats.fallThresholdLarge) / 400);
      damage = 35 + t * 65;
    }

    damage = Math.round(damage * this.stats.fallDamageMultiplier);
    this.playerHP = Math.max(0, this.playerHP - damage);

    // Screen shake
    this.cameras.main.shake(80 + damage * 2, 0.003 + damage * 0.0002);

    // Flash red
    this.player.setTint(0xff0000);
    this.time.delayedCall(200, () => {
      if (!this.isDead) this.player.clearTint();
    });

    // Damage number
    this.spawnFloatingText(this.player.x, this.player.y - 30, `-${damage}`, '#ff4444');

    if (this.playerHP <= 0) {
      this.die();
    }
  }

  private handleRecoveryPickup(sensorBody: MatterJS.BodyType) {
    for (const rp of this.recoveryPoints) {
      if (rp.used) continue;
      const dist = Phaser.Math.Distance.Between(sensorBody.position.x, sensorBody.position.y, rp.x, rp.y);
      if (dist < 40) {
        rp.used = true;
        rp.graphics.setAlpha(0.15);

        const prev = this.playerHP;
        this.playerHP = Math.min(this.stats.maxHp, this.playerHP + C.RECOVERY_AMOUNT);
        const healed = this.playerHP - prev;

        if (healed > 0) {
          this.spawnFloatingText(this.player.x, this.player.y - 30, `+${healed}`, '#44ff44');
        }
        break;
      }
    }
  }

  private handleEvoItemPickup(sensorBody: MatterJS.BodyType) {
    for (const ei of this.evoItems) {
      if (ei.collected) continue;
      const dist = Phaser.Math.Distance.Between(sensorBody.position.x, sensorBody.position.y, ei.x, ei.y);
      if (dist < 40) {
        ei.collected = true;
        ei.graphics.setAlpha(0);
        ei.glow.setAlpha(0);

        // Show floating text
        this.spawnFloatingText(this.player.x, this.player.y - 30, '進化!', '#88ff88');

        // Open evolution selection UI
        this.evoSelectUI.show(() => {
          // After selection, clamp HP to new max
          this.playerHP = Math.min(this.playerHP, this.stats.maxHp);
        });
        break;
      }
    }
  }

  private spawnFloatingText(x: number, y: number, msg: string, color: string) {
    const txt = this.add
      .text(x, y, msg, { fontSize: '18px', color, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(30);

    this.tweens.add({
      targets: txt,
      y: y - 40,
      alpha: 0,
      duration: 800,
      onComplete: () => txt.destroy(),
    });
  }

  // ======================== Game State ========================

  private die() {
    if (this.isDead) return;
    this.isDead = true;
    this.releaseGrapple();
    this.encyclopediaSystem.recordRun(this.evo.getUnlocked(), false, 0);

    this.player.setTint(0xff0000);
    this.cameras.main.shake(300, 0.02);

    this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT / 2 - 40, 'DEAD', {
        fontSize: '48px',
        color: '#ff0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT / 2 + 10, 'Click or press R to restart', {
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);
  }

  private handleVictory() {
    if (this.isDead) return;
    this.isDead = true;
    this.releaseGrapple();
    this.encyclopediaSystem.recordRun(this.evo.getUnlocked(), true, this.playerHP);

    this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT / 2 - 50, 'CLEAR!', {
        fontSize: '56px',
        color: '#ffd700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT / 2 + 10, `HP remaining: ${this.playerHP}/${this.stats.maxHp}`, {
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT / 2 + 45, 'Click or press R to restart', {
        fontSize: '16px',
        color: '#ffffffaa',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);
  }

  private restartGame() {
    this.scene.restart();
  }

  // ======================== HUD ========================

  private createHUD() {
    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.hpText = this.add
      .text(22, 18, '', { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' })
      .setScrollFactor(0)
      .setDepth(91);

    this.heightBar = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.heightText = this.add
      .text(C.GAME_WIDTH - 40, 0, '', { fontSize: '11px', color: '#ffffff' })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(91);

    this.evoIcons = this.add.graphics().setScrollFactor(0).setDepth(90);

    this.controlsText = this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT - 12, 'Click: Grapple | W/S: Reel | A/D: Move | Space: Jump/Release | Tab: 図鑑 | R: Restart', {
        fontSize: '11px',
        color: '#ffffff',
      })
      .setAlpha(0.4)
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(91);
  }

  private updateHUD() {
    // HP Bar
    this.hpBar.clear();
    const barW = 200;
    const barH = 18;
    const barX = 15;
    const barY = 15;

    this.hpBar.fillStyle(0x000000, 0.5);
    this.hpBar.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    const ratio = this.playerHP / this.stats.maxHp;
    let color = 0x44ff44;
    if (ratio < 0.3) color = 0xff4444;
    else if (ratio < 0.6) color = 0xffaa44;

    this.hpBar.fillStyle(color, 0.85);
    this.hpBar.fillRect(barX, barY, barW * ratio, barH);

    this.hpBar.lineStyle(1, 0xffffff, 0.3);
    this.hpBar.strokeRect(barX, barY, barW, barH);

    this.hpText.setText(`HP ${this.playerHP}/${this.stats.maxHp}`);

    // Height bar
    this.heightBar.clear();
    const hx = C.GAME_WIDTH - 25;
    const hy = 40;
    const hw = 10;
    const hh = C.GAME_HEIGHT - 80;

    this.heightBar.fillStyle(0x000000, 0.4);
    this.heightBar.fillRect(hx - 1, hy - 1, hw + 2, hh + 2);

    const height = C.WORLD_HEIGHT - this.player.y;
    const hRatio = Math.max(0, Math.min(1, height / C.WORLD_HEIGHT));

    this.heightBar.fillStyle(0x4488ff, 0.6);
    this.heightBar.fillRect(hx, hy + hh * (1 - hRatio), hw, hh * hRatio);

    // Position marker
    this.heightBar.fillStyle(0xffffff, 1);
    this.heightBar.fillRect(hx - 2, hy + hh * (1 - hRatio) - 1, hw + 4, 3);

    this.heightText.setText(`${Math.round(height)}m`);
    this.heightText.setY(Math.max(hy + 15, hy + hh * (1 - hRatio) - 8));

    // Evolution icons
    this.evoIcons.clear();
    const iconY = 42;
    const iconStartX = 15;
    const iconSize = 7;
    const iconGap = 18;

    for (let i = 0; i < ALL_NODE_IDS.length; i++) {
      const nodeId = ALL_NODE_IDS[i];
      const node = evolutionTree[nodeId];
      const ix = iconStartX + i * iconGap;

      if (this.evo.isUnlocked(nodeId)) {
        this.evoIcons.fillStyle(node.color, 0.9);
        this.evoIcons.fillCircle(ix, iconY, iconSize);
      } else {
        this.evoIcons.lineStyle(1, 0x555555, 0.4);
        this.evoIcons.strokeCircle(ix, iconY, iconSize);
      }
    }
  }
}
