export const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;
export const MAX_CATCH = 8;
export const TAU = Math.PI * 2;

// Canonical rack order. Single source of truth — do not redefine inline.
export const RACK_TYPES = ["turret", "high", "med", "low"] as const;
export type RackId = (typeof RACK_TYPES)[number];

export const CAM_VEL_LEAD = 0.11;
export const GATE_RANGE = 60;
export const DOCK_RANGE = 75;
export const CAP_FIRE_SURCHARGE = 0.38;
export const AMMO_START_HYBRID = 2600;
export const AMMO_START_MISSILE = 140;
export const BRAKE_VEL_RETENTION_PER_SEC = 0.35;
export const STATION_SAFE_ZONE_PX = 220;
export const ENEMY_MIN_DIST_HOME_STATION = 900;
export const ENEMY_MIN_DIST_NONHOME_STATION = 675;
export const XP_PER_KILL = 50;
export const XP_PER_MINE = 10;
export const LEVEL_XP_BASE = 350;
export const RESPAWN_S = 45;
export const WARP_TIME = 4.8;
export const TURRET_POWER_CYCLE_S = 3.0;
export const PLAYER_PARTICIPATION_WINDOW_MS = 8000;

export const ACCEL = 950;
export const FRICTION = 0.975;
export const ANG_ACCEL = 6.5;
export const ANG_FRICTION = 0.94;
export const AST_SPIN_RANGE = 0.4;

export const HUD_MINIMAP_SIZE = 102;
export const HUD_SIDE_W = 0;
export const HUD_BOTTOM_H = 56;
export const LOCK_RAIL_H = 72;
export const LOCK_TIME_BASE = 5.0;
export const SHIP_MASS_REF = 680000; // scout hull mass — baseline for agility scaling

export const SAVE_KEY = "ss2-sim-v1";

export const PLAYER_MASS = 800;
export const ASTEROID_DENSITY = 1.8;
export const ENEMY_MASS = 450;
export const COLLISION_RESTITUTION = 0.28;
export const COLLISION_DMG_THRESHOLD = 70;
export const COLLISION_DMG_SCALE = 0.055;
export const COLLISION_COOLDOWN = 0.35;
export const ASTEROID_VEL_DECAY = 0.12;
export const WRECK_PIECE_LINEAR_DRAG = 0.42;
export const WRECK_PIECE_ANGULAR_DRAG = 0.55;
export const SALVAGE_PICKUP_DRAG = 0.55;
export const ENEMY_AMBIENT_DRAG = 0.04;

export const MODULE_HP_MAX = 100;
export const MODULE_DAMAGE_CHANCE = 0.4;
export const MODULE_DAMAGE_RATIO = 0.25;
export const MIN_THRUST_PCT = 0.3;

export const STATION_TURRET_ORBIT_MIN = 140;
export const STATION_TURRET_ORBIT_MAX = 200;
export const STATION_TURRET_RANGE = 500;
export const STATION_TURRET_DAMAGE = 12;
export const STATION_TURRET_RELOAD = 1.5;
export const STATION_TURRET_ALIGN_TOLERANCE = 0.26;

// Title screen baseline resolution for responsive scaling in title-nav.ts
export const TITLE_BASE_W = 1920;
export const TITLE_BASE_H = 1080;
