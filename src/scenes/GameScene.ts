import Phaser from 'phaser';
import * as C from '../constants';
import * as Stage from '../data/stageData';
import { foodTypes, FoodTypeId } from '../data/foodTypes';
import { evolutionTree, ALL_NODE_IDS, EvolutionNodeId } from '../data/evolutionTree';
import { FeedingSystem } from '../systems/FeedingSystem';
import { PlayerStats } from '../systems/PlayerStats';
import { EncyclopediaSystem } from '../systems/EncyclopediaSystem';
import { EncyclopediaUI } from '../ui/EncyclopediaUI';

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

interface FoodItem {
  x: number;
  y: number;
  type: FoodTypeId;
  graphics: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  collected: boolean;
  sensorBody: MatterJS.BodyType;
}

export class GameScene extends Phaser.Scene {
  // Systems
  private feeding!: FeedingSystem;
  private stats!: PlayerStats;

  // Player
  private player!: Phaser.Physics.Matter.Sprite;
  private playerHP: number = C.MAX_HP;
  private isDead: boolean = false;
  private currentStretchFactor: number = 1.0;

  // Fall tracking
  private peakY: number = 0;
  private groundContacts: number = 0;
  private wasGrounded: boolean = true;

  // Charged jump
  private isChargingJump: boolean = false;
  private jumpChargeStart: number = 0;

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
  private foodItemObjs: FoodItem[] = [];

  // UI
  private encyclopediaSystem!: EncyclopediaSystem;
  private encyclopediaUI!: EncyclopediaUI;

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
  private feedingHUD!: Phaser.GameObjects.Graphics;
  private feedingText!: Phaser.GameObjects.Text;

  // Victory state
  private goalReached: string = '';

  // Dust respawn
  private dustSpawnTimer: number = 0;
  private readonly DUST_SPAWN_INTERVAL = 2000;  // ms between spawns
  private readonly DUST_SPAWN_Y_MIN = 2880;     // ground area
  private readonly DUST_SPAWN_Y_MAX = 2960;
  private readonly DUST_SPAWN_X_MIN = 80;
  private readonly DUST_SPAWN_X_MAX = 1520;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Systems
    this.feeding = new FeedingSystem();
    this.stats = new PlayerStats(this.feeding);

    // Evolution callback
    this.feeding.onEvolve((nodeId) => this.onEvolutionGained(nodeId));

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
    this.foodItemObjs = [];
    this.isChargingJump = false;
    this.jumpChargeStart = 0;
    this.currentStretchFactor = 1.0;
    this.goalReached = '';
    this.dustSpawnTimer = 0;

    this.encyclopediaSystem = new EncyclopediaSystem();

    // Background
    this.createBackground();

    // Stage elements
    this.createWalls();
    this.createPlatforms();
    this.createHookPoints();
    this.createRecoveryPoints();
    this.createFoodItems();
    this.createGoals();
    this.createDeathZone();

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

    // Cursor: default until grapple unlocked
    this.input.setDefaultCursor('default');
  }

  update(time: number, _delta: number) {
    if (this.keyR.isDown) {
      this.restartGame();
      return;
    }
    if (this.isDead) return;
    if (this.encyclopediaUI.isVisible()) return;

    this.handleSpaceKey(time);
    this.handleMovement();
    this.handleGrappleReel(_delta);
    this.spawnDustTick(time);
    this.drawGrappleLine();
    this.drawAimIndicator();
    this.updateHookVisuals();
    this.trackFalling();
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

      gfx.fillStyle(C.COLOR_PLATFORM, 1);
      gfx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      gfx.fillStyle(0x8888aa, 1);
      gfx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, 2);
    }
  }

  private createHookPoints() {
    for (const h of Stage.hookPoints) {
      const glow = this.add.circle(h.x, h.y, 14, C.COLOR_HOOK, 0.15).setDepth(4);
      const circle = this.add.circle(h.x, h.y, 8, C.COLOR_HOOK, 0.7).setDepth(5);

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
      gfx.fillStyle(C.COLOR_RECOVERY, 0.8);
      gfx.fillRect(r.x - 3, r.y - 10, 6, 20);
      gfx.fillRect(r.x - 10, r.y - 3, 20, 6);
      gfx.fillStyle(C.COLOR_RECOVERY, 0.12);
      gfx.fillCircle(r.x, r.y, 22);

      this.matter.add.rectangle(r.x, r.y, 40, 40, {
        isStatic: true,
        isSensor: true,
        label: 'recovery',
      });

      this.recoveryPoints.push({ x: r.x, y: r.y, graphics: gfx, used: false });
    }
  }

  private createFoodItems() {
    for (const f of Stage.foodItems) {
      const ft = foodTypes[f.type];
      const glow = this.add.circle(f.x, f.y, ft.radius * 2.5, ft.glowColor, 0.12).setDepth(4);
      const circle = this.add.circle(f.x, f.y, ft.radius, ft.color, 0.85).setDepth(5);

      // Float animation
      this.tweens.add({
        targets: [circle, glow],
        y: f.y - 4,
        duration: 1200 + Math.random() * 600,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });

      // Glow pulse
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.08, to: 0.25 },
        duration: 900,
        yoyo: true,
        repeat: -1,
      });

      const sensorBody = this.matter.add.rectangle(f.x, f.y, ft.radius * 4, ft.radius * 4, {
        isStatic: true,
        isSensor: true,
        label: 'food',
      }) as unknown as MatterJS.BodyType;

      this.foodItemObjs.push({
        x: f.x,
        y: f.y,
        type: f.type,
        graphics: circle,
        glow,
        collected: false,
        sensorBody,
      });
    }
  }

  /** Periodically spawn dust on the ground floor so the player can always progress. */
  private spawnDustTick(time: number) {
    if (this.dustSpawnTimer === 0) {
      this.dustSpawnTimer = time;
      return;
    }
    if (time - this.dustSpawnTimer < this.DUST_SPAWN_INTERVAL) return;
    this.dustSpawnTimer = time;

    const ft = foodTypes['dust'];
    const x = this.DUST_SPAWN_X_MIN + Math.random() * (this.DUST_SPAWN_X_MAX - this.DUST_SPAWN_X_MIN);
    const y = this.DUST_SPAWN_Y_MIN + Math.random() * (this.DUST_SPAWN_Y_MAX - this.DUST_SPAWN_Y_MIN);

    const glow = this.add.circle(x, y, ft.radius * 2.5, ft.glowColor, 0).setDepth(4);
    const circle = this.add.circle(x, y, ft.radius, ft.color, 0).setDepth(5);

    // Fade in
    this.tweens.add({
      targets: [circle],
      alpha: 0.85,
      duration: 400,
    });
    this.tweens.add({
      targets: [glow],
      alpha: 0.12,
      duration: 400,
    });

    // Float animation
    this.tweens.add({
      targets: [circle, glow],
      y: y - 4,
      duration: 1200 + Math.random() * 600,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Glow pulse
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.08, to: 0.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      delay: 400,
    });

    const sensorBody = this.matter.add.rectangle(x, y, ft.radius * 4, ft.radius * 4, {
      isStatic: true,
      isSensor: true,
      label: 'food',
    }) as unknown as MatterJS.BodyType;

    this.foodItemObjs.push({
      x, y,
      type: 'dust',
      graphics: circle,
      glow,
      collected: false,
      sensorBody,
    });
  }

  private createGoals() {
    for (const goal of Stage.goals) {
      const color = goal.label === 'goal_near' ? C.COLOR_GOAL : C.COLOR_GOAL_FAR;

      const gfx = this.add.graphics().setDepth(5);
      gfx.fillStyle(color, 0.3);
      gfx.fillRect(goal.x - goal.w / 2, goal.y - goal.h / 2, goal.w, goal.h);
      gfx.lineStyle(2, color, 0.8);
      gfx.strokeRect(goal.x - goal.w / 2, goal.y - goal.h / 2, goal.w, goal.h);

      const stars = '★'.repeat(goal.stars);
      this.add
        .text(goal.x, goal.y - 8, goal.name, {
          fontSize: '16px',
          color: goal.label === 'goal_near' ? '#ffd700' : '#ff8800',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(6);

      this.add
        .text(goal.x, goal.y + 12, stars, {
          fontSize: '14px',
          color: goal.label === 'goal_near' ? '#ffd700' : '#ff8800',
        })
        .setOrigin(0.5)
        .setDepth(6);

      this.matter.add.rectangle(goal.x, goal.y, goal.w, goal.h, {
        isStatic: true,
        isSensor: true,
        label: goal.label,
      });
    }
  }

  private createDeathZone() {
    this.matter.add.rectangle(C.WORLD_WIDTH / 2, C.WORLD_HEIGHT + 200, C.WORLD_WIDTH + 500, 400, {
      isStatic: true,
      isSensor: true,
      label: 'deathzone',
    });
  }

  private createPlayer() {
    this.generatePlayerTexture('player', 1.0);

    this.player = this.matter.add.sprite(800, 2900, 'player');
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

  private generatePlayerTexture(key: string, stretchFactor: number) {
    const w = C.PLAYER_RADIUS * 2;
    const h = Math.round(C.PLAYER_RADIUS * 2 * stretchFactor);

    // Destroy existing texture if it exists
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }

    const gfx = this.add.graphics();

    if (stretchFactor <= 1.05) {
      // Circle
      gfx.fillStyle(C.COLOR_PLAYER, 1);
      gfx.fillCircle(w / 2, h / 2, C.PLAYER_RADIUS);
      gfx.lineStyle(2, 0x22aa22, 1);
      gfx.strokeCircle(w / 2, h / 2, C.PLAYER_RADIUS);
    } else {
      // Pill shape
      const radius = C.PLAYER_RADIUS;
      gfx.fillStyle(C.COLOR_PLAYER, 1);
      gfx.fillRoundedRect(0, 0, w, h, radius);
      gfx.lineStyle(2, 0x22aa22, 1);
      gfx.strokeRoundedRect(0, 0, w, h, radius);
    }

    // Eyes
    gfx.fillStyle(0x000000, 1);
    const eyeY = Math.round(h * 0.35);
    gfx.fillCircle(w / 2 - 5, eyeY, 2);
    gfx.fillCircle(w / 2 + 5, eyeY, 2);

    gfx.generateTexture(key, w, h);
    gfx.destroy();
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
      if (this.encyclopediaUI.isVisible()) return;

      if (this.isDead) {
        this.restartGame();
        return;
      }

      if (pointer.leftButtonDown()) {
        if (!this.stats.canGrapple) return;

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

        if (other.label === 'platform') {
          if (playerBody.position.y < other.position.y) {
            this.groundContacts++;
          }
        }
        if (other.label === 'recovery') {
          this.handleRecoveryPickup(other);
        }
        if (other.label === 'food') {
          this.handleFoodPickup(other);
        }
        if (other.label === 'goal_near' || other.label === 'goal_far') {
          this.handleVictory(other.label);
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

        if (other.label === 'platform') {
          this.groundContacts = Math.max(0, this.groundContacts - 1);
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

  private handleSpaceKey(time: number) {
    const grounded = this.groundContacts > 0;

    // Grapple release with space
    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      if (this.grappleState === 'attached') {
        const body = this.player.body as MatterJS.BodyType;
        this.player.applyForce(new Phaser.Math.Vector2(
          body.velocity.x * 0.01,
          -0.025
        ));
        this.releaseGrapple();
        return;
      }
    }

    // Jump/charged jump logic
    if (!this.stats.canJump) return;

    if (this.stats.canChargedJump && grounded && this.keySpace.isDown) {
      // Start or continue charging
      if (!this.isChargingJump) {
        this.isChargingJump = true;
        this.jumpChargeStart = time;
      }
    }

    // Release charged jump
    if (this.isChargingJump && !this.keySpace.isDown) {
      const chargeTime = Math.min(time - this.jumpChargeStart, C.JUMP_CHARGE_MAX_MS);
      const chargeRatio = chargeTime / C.JUMP_CHARGE_MAX_MS;
      const multiplier = 1.0 + chargeRatio * C.JUMP_CHARGE_MULTIPLIER;

      const body = this.player.body as MatterJS.BodyType;
      MatterLib.Body.setVelocity(body, {
        x: body.velocity.x,
        y: C.PLAYER_JUMP_VELOCITY * multiplier,
      });

      this.isChargingJump = false;
      this.jumpChargeStart = 0;
      return;
    }

    // Regular jump (no charged jump ability or not charging)
    if (!this.stats.canChargedJump && Phaser.Input.Keyboard.JustDown(this.keySpace) && grounded) {
      const body = this.player.body as MatterJS.BodyType;
      MatterLib.Body.setVelocity(body, {
        x: body.velocity.x,
        y: C.PLAYER_JUMP_VELOCITY,
      });
    }

    // Cancel charge if left ground
    if (this.isChargingJump && !grounded) {
      this.isChargingJump = false;
      this.jumpChargeStart = 0;
    }
  }

  // ======================== Grapple ========================

  private findBestHook(aimX: number, aimY: number): HookPoint | null {
    if (!this.stats.canGrapple) return null;

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
  }

  private releaseGrapple() {
    if (this.grappleConstraint) {
      MatterLib.Composite.remove(this.matter.world.engine.world as any, this.grappleConstraint);
      this.grappleConstraint = null;
    }
    this.grappleTarget = null;
    this.grappleState = 'idle';
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

      this.grappleLine.fillStyle(0xffffff, 1);
      this.grappleLine.fillCircle(this.grappleTarget.x, this.grappleTarget.y, 5);
    }
  }

  private drawAimIndicator() {
    this.aimLine.clear();
    if (!this.stats.canGrapple) return;
    if (this.grappleState !== 'idle') return;

    const pointer = this.input.activePointer;
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

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
    const range = this.stats.grappleRange;
    const grappleUnlocked = this.stats.canGrapple;

    for (const hook of this.hookPoints) {
      if (!grappleUnlocked) {
        // Hide hooks until grapple is unlocked
        hook.graphics.setAlpha(0.15);
        hook.glow.setAlpha(0.05);
        continue;
      }

      const dist = Phaser.Math.Distance.Between(px, py, hook.x, hook.y);
      if (dist <= range) {
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

  // ======================== Food & Evolution ========================

  private handleFoodPickup(sensorBody: MatterJS.BodyType) {
    for (const fi of this.foodItemObjs) {
      if (fi.collected) continue;
      // Match by sensor body reference
      const dist = Phaser.Math.Distance.Between(
        sensorBody.position.x, sensorBody.position.y, fi.x, fi.y
      );
      if (dist > 40) continue;

      fi.collected = true;

      // Absorption particle effect
      const ft = foodTypes[fi.type];
      this.tweens.add({
        targets: [fi.graphics, fi.glow],
        x: this.player.x,
        y: this.player.y,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          fi.graphics.destroy();
          fi.glow.destroy();
        },
      });

      // Add points
      this.feeding.consume(fi.type, ft.points);

      // Show floating text
      const color = fi.type === 'dust' ? '#ccccbb' : '#ddaa44';
      this.spawnFloatingText(this.player.x, this.player.y - 20, `+${ft.points} ${ft.name}`, color);

      break;
    }
  }

  private onEvolutionGained(nodeId: EvolutionNodeId) {
    const node = evolutionTree[nodeId];

    // Screen flash
    this.cameras.main.flash(300, 255, 255, 200, false);

    // Floating text
    this.spawnFloatingText(
      this.player.x,
      this.player.y - 50,
      `${node.name} 解禁!`,
      '#88ff88'
    );

    // Brief pause
    this.matter.world.pause();
    this.time.delayedCall(300, () => {
      if (!this.isDead) {
        this.matter.world.resume();
      }
    });

    // Apply evolution effects
    this.applyEvolutionEffects(nodeId);

    // Update cursor if grapple gained
    if (nodeId === 'traction_1') {
      this.input.setDefaultCursor('crosshair');
    }

    // Update controls text
    this.updateControlsText();
  }

  private applyEvolutionEffects(nodeId: EvolutionNodeId) {
    if (nodeId === 'stretch_1' || nodeId === 'stretch_2') {
      this.applyStretchEvolution();
    }

    if (nodeId === 'sticky_1') {
      const body = this.player.body as MatterJS.BodyType;
      body.friction = 0.95;
    }
  }

  private applyStretchEvolution() {
    const newStretch = this.stats.bodyStretchFactor;
    if (newStretch === this.currentStretchFactor) return;

    const body = this.player.body as MatterJS.BodyType;
    const oldX = body.position.x;
    const oldY = body.position.y;
    const oldVx = body.velocity.x;
    const oldVy = body.velocity.y;

    // Generate new texture
    this.generatePlayerTexture('player', newStretch);
    this.player.setTexture('player');

    // Replace physics body: pill shape using rectangle with chamfer
    const w = C.PLAYER_RADIUS * 2;
    const h = Math.round(C.PLAYER_RADIUS * 2 * newStretch);
    const chamfer = C.PLAYER_RADIUS * 0.8;

    // Lift player up so the taller body doesn't clip into the ground
    const heightDiff = (h - C.PLAYER_RADIUS * 2 * this.currentStretchFactor) / 2;
    const newY = oldY - heightDiff - 2;

    // Remove old body and create new one
    this.matter.world.remove(body);

    const newBody = MatterLib.Bodies.rectangle(oldX, newY, w, h, {
      chamfer: { radius: chamfer },
      label: 'player',
      friction: this.stats.friction,
      frictionAir: 0.02,
      restitution: 0.05,
    });

    this.player.setExistingBody(newBody as any);
    this.player.setFixedRotation();
    this.player.setPosition(oldX, newY);
    MatterLib.Body.setVelocity(newBody, { x: oldVx, y: oldVy });

    this.currentStretchFactor = newStretch;

    // Re-attach grapple constraint if active
    if (this.grappleState === 'attached' && this.grappleTarget) {
      if (this.grappleConstraint) {
        MatterLib.Composite.remove(this.matter.world.engine.world as any, this.grappleConstraint);
      }
      this.grappleConstraint = MatterLib.Constraint.create({
        bodyA: newBody,
        pointB: { x: this.grappleTarget.x, y: this.grappleTarget.y },
        length: this.ropeLength,
        stiffness: C.GRAPPLE_STIFFNESS,
        damping: C.GRAPPLE_DAMPING,
        render: { visible: false },
      } as any);
      MatterLib.Composite.add(this.matter.world.engine.world as any, this.grappleConstraint);
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
      if (fallDistance > C.FALL_THRESHOLD_SMALL) {
        this.applyFallDamage(fallDistance);
      }
    }

    if (!grounded && this.wasGrounded) {
      this.peakY = this.player.y;
    }

    this.wasGrounded = grounded;
  }

  private applyFallDamage(fallPixels: number) {
    let damage: number;

    if (fallPixels < C.FALL_THRESHOLD_MEDIUM) {
      const t = (fallPixels - C.FALL_THRESHOLD_SMALL) / (C.FALL_THRESHOLD_MEDIUM - C.FALL_THRESHOLD_SMALL);
      damage = 5 + t * 5;
    } else if (fallPixels < C.FALL_THRESHOLD_LARGE) {
      const t = (fallPixels - C.FALL_THRESHOLD_MEDIUM) / (C.FALL_THRESHOLD_LARGE - C.FALL_THRESHOLD_MEDIUM);
      damage = 10 + t * 25;
    } else {
      const t = Math.min(1, (fallPixels - C.FALL_THRESHOLD_LARGE) / 400);
      damage = 35 + t * 65;
    }

    damage = Math.round(damage * this.stats.fallDamageMultiplier);
    this.playerHP = Math.max(0, this.playerHP - damage);

    this.cameras.main.shake(80 + damage * 2, 0.003 + damage * 0.0002);

    this.player.setTint(0xff0000);
    this.time.delayedCall(200, () => {
      if (!this.isDead) this.player.clearTint();
    });

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
    this.encyclopediaSystem.recordRun(this.feeding.getActiveEvolutions(), false, 0);

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

  private handleVictory(goalLabel: string) {
    if (this.isDead) return;
    this.isDead = true;
    this.goalReached = goalLabel;
    this.releaseGrapple();
    this.encyclopediaSystem.recordRun(this.feeding.getActiveEvolutions(), true, this.playerHP);

    const isNear = goalLabel === 'goal_near';
    const title = isNear ? 'CLEAR!' : 'TRUE CLEAR!';
    const color = isNear ? '#ffd700' : '#ff8800';
    const stars = isNear ? '★★' : '★★★';

    this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT / 2 - 60, title, {
        fontSize: '56px',
        color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT / 2 - 5, stars, {
        fontSize: '32px',
        color,
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT / 2 + 30, `HP remaining: ${this.playerHP}/${this.stats.maxHp}`, {
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT / 2 + 65, 'Click or press R to restart', {
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

    this.feedingHUD = this.add.graphics().setScrollFactor(0).setDepth(90);
    this.feedingText = this.add
      .text(15, 38, '', { fontSize: '11px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(91);

    this.controlsText = this.add
      .text(C.GAME_WIDTH / 2, C.GAME_HEIGHT - 12, '', {
        fontSize: '11px',
        color: '#ffffff',
      })
      .setAlpha(0.4)
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(91);

    this.updateControlsText();
  }

  private updateControlsText() {
    const parts: string[] = ['A/D: Move'];
    if (this.stats.canJump) {
      parts.push(this.stats.canChargedJump ? 'Space: Jump (hold to charge)' : 'Space: Jump');
    }
    if (this.stats.canGrapple) {
      parts.push('Click: Grapple | W/S: Reel');
    }
    parts.push('Tab: 図鑑 | R: Restart');
    this.controlsText.setText(parts.join(' | '));
  }

  private updateHUD() {
    // HP Bar
    this.hpBar.clear();
    const barW = 200;
    const barH = 14;
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

    // Feeding HUD
    this.feedingHUD.clear();
    const fhX = 15;
    const fhY = 38;
    const fhW = 200;
    const fhH = 10;
    const maxPts = 50;

    // Dust gauge
    const dustPts = this.feeding.getPoints('dust');
    const dustRatio = Math.min(1, dustPts / maxPts);
    this.feedingHUD.fillStyle(0x000000, 0.4);
    this.feedingHUD.fillRect(fhX + 16, fhY, fhW - 16, fhH);
    this.feedingHUD.fillStyle(C.COLOR_DUST, 0.7);
    this.feedingHUD.fillRect(fhX + 16, fhY, (fhW - 16) * dustRatio, fhH);
    this.feedingHUD.lineStyle(1, 0xffffff, 0.2);
    this.feedingHUD.strokeRect(fhX + 16, fhY, fhW - 16, fhH);

    // Dust threshold markers
    const thresholds = [10, 25, 50];
    for (const t of thresholds) {
      const tx = fhX + 16 + (fhW - 16) * (t / maxPts);
      this.feedingHUD.lineStyle(1, 0xffffff, 0.4);
      this.feedingHUD.beginPath();
      this.feedingHUD.moveTo(tx, fhY);
      this.feedingHUD.lineTo(tx, fhY + fhH);
      this.feedingHUD.strokePath();
    }

    // Dust evolution indicators
    const dustNodes: EvolutionNodeId[] = ['stretch_1', 'stretch_2', 'sticky_1'];
    let indicatorX = fhX + fhW + 4;
    for (const nid of dustNodes) {
      const active = this.feeding.isActive(nid);
      const node = evolutionTree[nid];
      if (active) {
        this.feedingHUD.fillStyle(node.color, 0.9);
        this.feedingHUD.fillCircle(indicatorX, fhY + fhH / 2, 4);
      } else {
        this.feedingHUD.lineStyle(1, 0x555555, 0.5);
        this.feedingHUD.strokeCircle(indicatorX, fhY + fhH / 2, 4);
      }
      indicatorX += 12;
    }

    // Sap gauge
    const sapY = fhY + fhH + 4;
    const sapPts = this.feeding.getPoints('sap');
    const sapRatio = Math.min(1, sapPts / maxPts);
    this.feedingHUD.fillStyle(0x000000, 0.4);
    this.feedingHUD.fillRect(fhX + 16, sapY, fhW - 16, fhH);
    this.feedingHUD.fillStyle(C.COLOR_SAP, 0.7);
    this.feedingHUD.fillRect(fhX + 16, sapY, (fhW - 16) * sapRatio, fhH);
    this.feedingHUD.lineStyle(1, 0xffffff, 0.2);
    this.feedingHUD.strokeRect(fhX + 16, sapY, fhW - 16, fhH);

    // Sap threshold markers
    for (const t of thresholds) {
      const tx = fhX + 16 + (fhW - 16) * (t / maxPts);
      this.feedingHUD.lineStyle(1, 0xffffff, 0.4);
      this.feedingHUD.beginPath();
      this.feedingHUD.moveTo(tx, sapY);
      this.feedingHUD.lineTo(tx, sapY + fhH);
      this.feedingHUD.strokePath();
    }

    // Sap evolution indicators
    const sapNodes: EvolutionNodeId[] = ['jump_1', 'jump_2', 'traction_1'];
    indicatorX = fhX + fhW + 4;
    for (const nid of sapNodes) {
      const active = this.feeding.isActive(nid);
      const node = evolutionTree[nid];
      if (active) {
        this.feedingHUD.fillStyle(node.color, 0.9);
        this.feedingHUD.fillCircle(indicatorX, sapY + fhH / 2, 4);
      } else {
        this.feedingHUD.lineStyle(1, 0x555555, 0.5);
        this.feedingHUD.strokeCircle(indicatorX, sapY + fhH / 2, 4);
      }
      indicatorX += 12;
    }

    // Feeding text labels
    this.feedingText.setText(`塵 ${dustPts}\n液 ${sapPts}`);

    // Charge indicator
    if (this.isChargingJump) {
      const chargeTime = Math.min(this.time.now - this.jumpChargeStart, C.JUMP_CHARGE_MAX_MS);
      const chargeRatio = chargeTime / C.JUMP_CHARGE_MAX_MS;
      const chargeBarW = 40;
      const chargeBarH = 6;
      const cbx = this.player.x - chargeBarW / 2;
      const cby = this.player.y + C.PLAYER_RADIUS * this.currentStretchFactor + 8;

      // Draw in world space via grappleLine (reuse graphics)
      this.grappleLine.fillStyle(0x000000, 0.5);
      this.grappleLine.fillRect(cbx, cby, chargeBarW, chargeBarH);
      this.grappleLine.fillStyle(0xffff44, 0.9);
      this.grappleLine.fillRect(cbx, cby, chargeBarW * chargeRatio, chargeBarH);
    }

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

    this.heightBar.fillStyle(0xffffff, 1);
    this.heightBar.fillRect(hx - 2, hy + hh * (1 - hRatio) - 1, hw + 4, 3);

    this.heightText.setText(`${Math.round(height)}m`);
    this.heightText.setY(Math.max(hy + 15, hy + hh * (1 - hRatio) - 8));
  }
}
