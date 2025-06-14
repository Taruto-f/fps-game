import { Player, Enemy, GameState } from '../types/game';
import { gameConfig, MAP } from '../config/gameConfig';

export const distance = (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

export const isWall = (x: number, y: number): boolean => {
    const mapX = Math.floor(x / gameConfig.TILE_SIZE);
    const mapY = Math.floor(y / gameConfig.TILE_SIZE);

    if (mapX < 0 || mapX >= gameConfig.MAP_W || mapY < 0 || mapY >= gameConfig.MAP_H) {
        return true;
    }

    return MAP[mapY * gameConfig.MAP_W + mapX] !== 0;
};

export const updatePlayer = (player: Player, deltaTime: number): Player => {
    const newPlayer = { ...player };
    const moveSpeed = player.speed * deltaTime;
    const rotSpeed = player.rotSpeed * deltaTime;

    if (player.moving.left) {
        newPlayer.dir -= rotSpeed;
    }
    if (player.moving.right) {
        newPlayer.dir += rotSpeed;
    }

    if (player.moving.forward) {
        const newX = player.x + Math.cos(player.dir) * moveSpeed;
        const newY = player.y + Math.sin(player.dir) * moveSpeed;
        if (!isWall(newX, player.y)) newPlayer.x = newX;
        if (!isWall(player.x, newY)) newPlayer.y = newY;
    }
    if (player.moving.backward) {
        const newX = player.x - Math.cos(player.dir) * moveSpeed;
        const newY = player.y - Math.sin(player.dir) * moveSpeed;
        if (!isWall(newX, player.y)) newPlayer.x = newX;
        if (!isWall(player.x, newY)) newPlayer.y = newY;
    }

    return newPlayer;
};

export const spawnEnemies = (player: Player): Enemy[] => {
    const enemies: Enemy[] = [];
    const { INITIAL_X, INITIAL_Y, INITIAL_HEALTH, RADIUS, SPEED } = gameConfig.ENEMY;

    for (let i = 0; i < gameConfig.ENEMY_COUNT; i++) {
        let x: number, y: number;
        do {
            x = Math.random() * (gameConfig.MAP_W - 2) * gameConfig.TILE_SIZE + gameConfig.TILE_SIZE;
            y = Math.random() * (gameConfig.MAP_H - 2) * gameConfig.TILE_SIZE + gameConfig.TILE_SIZE;
        } while (
            isWall(x, y) ||
            distance(x, y, player.x, player.y) < gameConfig.TILE_SIZE * 3 ||
            enemies.some(e => distance(x, y, e.x, e.y) < gameConfig.TILE_SIZE)
        );

        enemies.push({
            x,
            y,
            radius: RADIUS,
            alive: true,
            health: INITIAL_HEALTH,
            maxHealth: INITIAL_HEALTH,
            attackCooldown: 0,
            speed: SPEED,
        });
    }

    return enemies;
};

export const shoot = (player: Player, enemies: Enemy[]): { player: Player; enemies: Enemy[] } => {
    if (player.ammo <= 0 || player.attackCooldown > 0) {
        return { player, enemies };
    }

    const newPlayer = { ...player, ammo: player.ammo - 1, attackCooldown: 500 };
    const newEnemies = [...enemies];
    let closestEnemy: Enemy | null = null;
    let closestDistance = Infinity;

    for (const enemy of newEnemies) {
        if (!enemy.alive) continue;

        const dist = distance(player.x, player.y, enemy.x, enemy.y);
        if (dist < closestDistance && dist < gameConfig.SHOOTING.MAX_DISTANCE) {
            const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
            const angleDiff = Math.abs(angle - player.dir);
            if (angleDiff < gameConfig.PLAYER.FOV / 2) {
                closestEnemy = enemy;
                closestDistance = dist;
            }
        }
    }

    if (closestEnemy) {
        closestEnemy.health -= gameConfig.SHOOTING.DAMAGE;
        if (closestEnemy.health <= 0) {
            closestEnemy.alive = false;
        }
    }

    return { player: newPlayer, enemies: newEnemies };
};

export const updateEnemies = (
    enemies: Enemy[],
    player: Player,
    deltaTime: number
): { enemies: Enemy[]; player: Player } => {
    const newEnemies = [...enemies];
    const newPlayer = { ...player };

    for (const enemy of newEnemies) {
        if (!enemy.alive) continue;

        const dist = distance(enemy.x, enemy.y, player.x, player.y);
        if (dist < gameConfig.TILE_SIZE * 2) {
            if (enemy.attackCooldown <= 0) {
                newPlayer.health -= gameConfig.ENEMY.ATTACK_DAMAGE;
                enemy.attackCooldown = gameConfig.ENEMY.ATTACK_COOLDOWN;
            }
        } else {
            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            const newX = enemy.x + Math.cos(angle) * enemy.speed * deltaTime;
            const newY = enemy.y + Math.sin(angle) * enemy.speed * deltaTime;

            if (!isWall(newX, enemy.y)) enemy.x = newX;
            if (!isWall(enemy.x, newY)) enemy.y = newY;
        }

        if (enemy.attackCooldown > 0) {
            enemy.attackCooldown -= deltaTime;
        }
    }

    return { enemies: newEnemies, player: newPlayer };
};

export const castRays = (player: Player): { distance: number; wall: boolean; angle: number }[] => {
    const rays: { distance: number; wall: boolean; angle: number }[] = [];
    const rayAngle = player.fov / gameConfig.RAY_COUNT;

    for (let i = 0; i < gameConfig.RAY_COUNT; i++) {
        const angle = player.dir - player.fov / 2 + rayAngle * i;
        let rayX = player.x;
        let rayY = player.y;
        let distance = 0;
        let wall = false;

        while (distance < gameConfig.MAX_DEPTH && !wall) {
            distance += gameConfig.SHOOTING.STEP;
            rayX = player.x + Math.cos(angle) * distance;
            rayY = player.y + Math.sin(angle) * distance;
            wall = isWall(rayX, rayY);
        }

        rays.push({ distance, wall, angle });
    }

    return rays;
}; 