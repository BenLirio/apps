// Shared constants. Tweak only the named export — every importer reads
// from this file, so values stay consistent across the app.

export const CELL = 3;
export const SLUG = 'gravity-doodle';
export const AI_ENDPOINT = 'https://uy3l6suz07.execute-api.us-east-1.amazonaws.com/ai';
export const FEEDBACK_ENDPOINT = 'https://5c99bazuj0.execute-api.us-east-1.amazonaws.com/feedback';

export const KIND_EMPTY    = 0;
export const KIND_STATIC   = 1;
export const KIND_POWDER   = 2;
export const KIND_LIQUID   = 3;
export const KIND_GAS      = 4;
export const KIND_CELLULAR = 5;

export const DISCOVERY_INTERVAL = 60;

// Built-in element ids. Order is load-bearing — these get baked into the
// engine textures by id, so do not renumber. Append new ids only.
export const WALL_ID      = 1;
export const SAND_ID      = 2;
export const WATER_ID     = 3;
export const EXPLOSIVE_ID = 4;
export const SMOKE_ID     = 5;
export const PLANT_ID     = 6;
export const SPARK_ID     = 7;
export const ICE_ID       = 8;
export const STEAM_ID     = 9;
export const LAVA_ID      = 10;
export const FIRE_ID      = 11;
export const ACID_ID      = 12;
export const HONEY_ID     = 13;
export const GRAVEL_ID    = 14;
export const STONE_ID     = 15;
export const MOLD_ID      = 16;
export const WOOD_ID      = 17;
export const OIL_ID       = 18;
export const MERCURY_ID   = 19;
export const DUST_ID      = 20;
export const COPPER_ID    = 21;
export const BATTERY_ID   = 22;
export const LIGHTNING_ID = 23;
export const FAN_ID       = 24;
export const BALLOON_ID   = 25;
export const URANIUM_ID   = 26;
export const TAR_ID       = 27;
export const VINE_ID      = 28;
