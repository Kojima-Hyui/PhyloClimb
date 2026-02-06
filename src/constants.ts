// Display
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

// World
export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 4000;

// Player
export const PLAYER_RADIUS = 15;
export const PLAYER_MOVE_FORCE = 0.005;
export const PLAYER_AIR_CONTROL = 0.003;
export const PLAYER_MAX_VELOCITY = 8;
export const PLAYER_JUMP_VELOCITY = -10;

// Grapple
export const GRAPPLE_RANGE = 400;
export const GRAPPLE_AIM_CONE = Math.PI / 3; // 60 degrees
export const GRAPPLE_STIFFNESS = 0.04;
export const GRAPPLE_DAMPING = 0.01;
export const REEL_SPEED = 3;
export const MIN_ROPE_LENGTH = 30;

// Health
export const MAX_HP = 100;
export const RECOVERY_AMOUNT = 25;
export const FALL_THRESHOLD_SMALL = 100;
export const FALL_THRESHOLD_MEDIUM = 300;
export const FALL_THRESHOLD_LARGE = 600;

// Colors
export const COLOR_PLAYER = 0x44ff44;
export const COLOR_PLATFORM = 0x666688;
export const COLOR_HOOK = 0xffdd44;
export const COLOR_HOOK_IN_RANGE = 0xffff88;
export const COLOR_WALL = 0x333355;
export const COLOR_GRAPPLE_LINE = 0xffffff;
export const COLOR_RECOVERY = 0xff4444;
export const COLOR_GOAL = 0xffd700;
