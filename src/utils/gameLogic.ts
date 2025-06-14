import { Player, Enemy, GameState } from '../types/game';
import { gameConfig, MAP } from '../config/gameConfig';

export function distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function isWall(x: number, y: number): boolean {
    const mapX = Math.floor(x / gameConfig.TILE_SIZE);
    const mapY = Math.floor(y / gameConfig.TILE_SIZE);

    if (mapX < 0 || mapX >= gameConfig.MAP_W || mapY < 0 || mapY >= gameConfig.MAP_H) {
        return true;
    }

    return MAP[mapY * gameConfig.MAP_W + mapX] !== 0;
}

export function updatePlayer(player: Player): Player {
    const { moving, speed } = player;
    let newX = player.x;
    let newY = player.y;

    if (moving.forward) {
        newX += Math.cos(player.dir) * speed;
        newY += Math.sin(player.dir) * speed;
    }
    if (moving.backward) {
        newX -= Math.cos(player.dir) * speed;
        newY -= Math.sin(player.dir) * speed;
    }
    if (moving.left) {
        newX += Math.cos(player.dir - Math.PI / 2) * speed;
        newY += Math.sin(player.dir - Math.PI / 2) * speed;
    }
    if (moving.right) {
        newX += Math.cos(player.dir + Math.PI / 2) * speed;
        newY += Math.sin(player.dir + Math.PI / 2) * speed;
    }

    if (!isWall(newX, newY)) {
        return { ...player, x: newX, y: newY };
    }
    return player;
}

export function spawnEnemies(player: Player): Enemy[] {
    const enemies: Enemy[] = [];
    const minDistance = gameConfig.TILE_SIZE * 5;

    for (let i = 0; i < gameConfig.ENEMY_COUNT; i++) {
        let x: number, y: number;
        let validPosition = false;

        while (!validPosition) {
            x = Math.random() * (gameConfig.MAP_W * gameConfig.TILE_SIZE);
            y = Math.random() * (gameConfig.MAP_H * gameConfig.TILE_SIZE);

            // 壁との衝突チェック
            if (isWall(x, y)) continue;

            // 他の敵との衝突チェック
            const tooClose = enemies.some(enemy =>
                distance(x, y, enemy.x, enemy.y) < gameConfig.TILE_SIZE * 2
            );
            if (tooClose) continue;

            // プレイヤーとの距離チェック
            if (distance(x, y, player.x, player.y) < minDistance) continue;

            validPosition = true;
            enemies.push({
                x,
                y,
                radius: gameConfig.TILE_SIZE / 2,
                alive: true,
                health: 100, // 敵のHPを100に設定
                maxHealth: 100,
                attackCooldown: 0,
                speed: 0.3, // 敵の移動速度を0.3に設定
            });
        }
    }

    return enemies;
}

export function shoot(player: Player, enemies: Enemy[]): { player: Player, enemies: Enemy[], hitEnemy: boolean } {
    if (player.ammo <= 0) return { player, enemies, hitEnemy: false };

    const updatedPlayer = { ...player, ammo: player.ammo - 1 };
    let hitEnemy = false;
    let closestEnemy: Enemy | null = null;
    let closestDistance = Infinity;

    // プレイヤーの視野内の敵を探す
    enemies.forEach(enemy => {
        if (!enemy.alive) return;

        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const angle = Math.atan2(dy, dx);
        const angleDiff = Math.abs(angle - player.dir);

        // プレイヤーの視野内（FOV）に敵がいるかチェック
        if (angleDiff < player.fov / 2) {
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 壁との衝突チェック
            let rayX = player.x;
            let rayY = player.y;
            let hitWall = false;

            while (!hitWall && distance > Math.sqrt((rayX - player.x) ** 2 + (rayY - player.y) ** 2)) {
                rayX += Math.cos(angle) * 0.1;
                rayY += Math.sin(angle) * 0.1;

                if (isWall(rayX, rayY)) {
                    hitWall = true;
                    break;
                }
            }

            // 壁に当たらず、かつ最も近い敵を記録
            if (!hitWall && distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        }
    });

    // 最も近い敵にダメージを与える
    const updatedEnemies = enemies.map(enemy => {
        if (enemy === closestEnemy && closestDistance < 8 * gameConfig.TILE_SIZE) {
            hitEnemy = true;
            return { ...enemy, health: enemy.health - 35 };
        }
        return enemy;
    });

    return { player: updatedPlayer, enemies: updatedEnemies, hitEnemy };
}

export function updateEnemies(enemies: Enemy[], player: Player, dt: number): { enemies: Enemy[], player: Player } {
    const updatedEnemies = enemies.map(enemy => {
        if (!enemy.alive) return enemy;

        // 敵が死んだ場合の処理
        if (enemy.health <= 0) {
            return { ...enemy, alive: false };
        }

        // プレイヤーとの距離を計算
        const dist = distance(enemy.x, enemy.y, player.x, player.y);
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const angle = Math.atan2(dy, dx);

        // プレイヤーに向かって移動
        const newX = enemy.x + Math.cos(angle) * enemy.speed * dt;
        const newY = enemy.y + Math.sin(angle) * enemy.speed * dt;

        // 壁との衝突チェック
        if (!isWall(newX, newY)) {
            enemy.x = newX;
            enemy.y = newY;
        }

        // 攻撃クールダウンの更新
        if (enemy.attackCooldown > 0) {
            enemy.attackCooldown -= dt;
        }

        // プレイヤーが近くにいる場合の攻撃
        if (dist < gameConfig.TILE_SIZE * 1.5 && enemy.attackCooldown <= 0) {
            // 壁との衝突チェック
            let rayX = enemy.x;
            let rayY = enemy.y;
            let hitWall = false;

            while (!hitWall && dist > Math.sqrt((rayX - enemy.x) ** 2 + (rayY - enemy.y) ** 2)) {
                rayX += Math.cos(angle) * 0.1;
                rayY += Math.sin(angle) * 0.1;

                if (isWall(rayX, rayY)) {
                    hitWall = true;
                    break;
                }
            }

            // 壁に当たらず、プレイヤーに当たる場合のみダメージを与える
            if (!hitWall) {
                player.health = Math.max(0, player.health - 10);
                enemy.attackCooldown = 60; // 1秒のクールダウン
            }
        }

        return enemy;
    });

    return { enemies: updatedEnemies, player };
}

export function checkGameState(player: Player, enemies: Enemy[]): 'playing' | 'gameOver' | 'gameClear' {
    // ゲームオーバー条件：プレイヤーのHPが0
    if (player.health <= 0) {
        return 'gameOver';
    }

    // ゲームクリア条件：すべての敵が倒されている
    const allEnemiesDefeated = enemies.every(enemy => !enemy.alive);
    if (allEnemiesDefeated) {
        return 'gameClear';
    }

    return 'playing';
}

export function castRays(player: Player): { distance: number; angle: number }[] {
    const rays: { distance: number; angle: number }[] = [];
    const rayAngle = player.fov / gameConfig.RAY_COUNT;

    for (let i = 0; i < gameConfig.RAY_COUNT; i++) {
        const angle = player.dir - player.fov / 2 + rayAngle * i;
        let rayX = player.x;
        let rayY = player.y;
        let distance = 0;

        while (distance < gameConfig.MAX_DEPTH) {
            rayX += Math.cos(angle) * 0.1;
            rayY += Math.sin(angle) * 0.1;
            distance += 0.1;

            if (isWall(rayX, rayY)) {
                break;
            }
        }

        rays.push({ distance, angle });
    }

    return rays;
} 