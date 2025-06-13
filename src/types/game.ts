export interface Player {
    x: number;
    y: number;
    dir: number;
    fov: number;
    health: number;
    maxHealth: number;
    ammo: number;
    maxAmmo: number;
    moving: {
        forward: boolean;
        backward: boolean;
        left: boolean;
        right: boolean;
    };
    speed: number;
    rotSpeed: number;
    attackCooldown: number;
}

export interface Enemy {
    x: number;
    y: number;
    radius: number;
    alive: boolean;
    health: number;
    maxHealth: number;
    attackCooldown: number;
    speed: number;
}

export interface GameState {
    player: Player;
    enemies: Enemy[];
    pointerLocked: boolean;
    reloading: boolean;
}

export interface GameConfig {
    WIDTH: number;
    HEIGHT: number;
    MAP_W: number;
    MAP_H: number;
    TILE_SIZE: number;
    MINIMAP_SCALE: number;
    RAY_COUNT: number;
    MAX_DEPTH: number;
    ENEMY_COUNT: number;
} 