'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './page.module.css';
import { gameConfig, MAP } from '../config/gameConfig';
import { Player, Enemy } from '../types/game';
import { updatePlayer, spawnEnemies, updateEnemies, castRays, shoot } from '../utils/gameLogic';

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<Player>({
    x: gameConfig.TILE_SIZE * 3,
    y: gameConfig.TILE_SIZE * 3,
    dir: 0,
    fov: Math.PI / 3,
    health: 100,
    maxHealth: 100,
    ammo: 50,
    maxAmmo: 50,
    moving: {
      forward: false,
      backward: false,
      left: false,
      right: false,
    },
    speed: 2.5,
    rotSpeed: 0.01,
    attackCooldown: 0,
  });
  const enemiesRef = useRef<Enemy[]>([]);
  const [player, setPlayer] = useState<Player>(playerRef.current);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [gameState, setGameState] = useState<'playing' | 'gameOver' | 'gameClear'>('playing');
  const [hitMarker, setHitMarker] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const minimap = minimapRef.current;
    if (!canvas || !minimap) return;

    const ctx = canvas.getContext('2d');
    const mapCtx = minimap.getContext('2d');
    if (!ctx || !mapCtx) return;

    enemiesRef.current = spawnEnemies(playerRef.current);
    setEnemies(enemiesRef.current);

    const handleCanvasClick = () => {
      canvas.requestPointerLock();
    };

    canvas.addEventListener('click', handleCanvasClick);

    let lastTime = performance.now();
    function gameLoop(time: number) {
      const dt = (time - lastTime) / 16.6667;
      lastTime = time;

      const updatedPlayer = updatePlayer(playerRef.current, dt);
      playerRef.current = updatedPlayer;
      setPlayer(updatedPlayer);

      const { enemies: updatedEnemies, player: newPlayer } = updateEnemies(enemiesRef.current, playerRef.current, dt);
      enemiesRef.current = updatedEnemies;
      playerRef.current = newPlayer;
      setEnemies(updatedEnemies);
      setPlayer(newPlayer);

      if (ctx) {
        draw(ctx);
      }

      if (mapCtx) {
        drawMinimap(mapCtx);
      }

      requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyW':
          playerRef.current.moving.forward = true;
          setPlayer(p => ({ ...p, moving: { ...p.moving, forward: true } }));
          break;
        case 'KeyS':
          playerRef.current.moving.backward = true;
          setPlayer(p => ({ ...p, moving: { ...p.moving, backward: true } }));
          break;
        case 'KeyA':
          playerRef.current.moving.left = true;
          setPlayer(p => ({ ...p, moving: { ...p.moving, left: true } }));
          break;
        case 'KeyD':
          playerRef.current.moving.right = true;
          setPlayer(p => ({ ...p, moving: { ...p.moving, right: true } }));
          break;
        case 'Space':
          handleShoot();
          break;
        case 'KeyR':
          handleReload();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
          playerRef.current.moving.forward = false;
          setPlayer(p => ({ ...p, moving: { ...p.moving, forward: false } }));
          break;
        case 'KeyS':
          playerRef.current.moving.backward = false;
          setPlayer(p => ({ ...p, moving: { ...p.moving, backward: false } }));
          break;
        case 'KeyA':
          playerRef.current.moving.left = false;
          setPlayer(p => ({ ...p, moving: { ...p.moving, left: false } }));
          break;
        case 'KeyD':
          playerRef.current.moving.right = false;
          setPlayer(p => ({ ...p, moving: { ...p.moving, right: false } }));
          break;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (pointerLocked) {
        const newDir = (playerRef.current.dir + e.movementX * playerRef.current.rotSpeed) % (2 * Math.PI);
        playerRef.current.dir = newDir;
        setPlayer(p => ({ ...p, dir: newDir }));
      }
    };

    const handlePointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === canvas);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [pointerLocked]);

  const handleShoot = () => {
    if (playerRef.current.ammo <= 0 || reloading || gameState !== 'playing') return;

    const { player: newPlayer, enemies: newEnemies } = shoot(playerRef.current, enemiesRef.current);
    playerRef.current = newPlayer;
    enemiesRef.current = newEnemies;
    setPlayer(newPlayer);
    setEnemies(newEnemies);
    setHitMarker(true);

    setTimeout(() => setHitMarker(false), 100);
  };

  const handleReload = () => {
    if (reloading || playerRef.current.ammo === playerRef.current.maxAmmo || gameState !== 'playing') return;

    setReloading(true);
    setTimeout(() => {
      const newPlayer = { ...playerRef.current, ammo: playerRef.current.maxAmmo };
      playerRef.current = newPlayer;
      setPlayer(newPlayer);
      setReloading(false);
    }, 2000);
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, gameConfig.WIDTH, gameConfig.HEIGHT);
    // Shadowed sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, gameConfig.HEIGHT / 2);
    skyGradient.addColorStop(0, '#061529');
    skyGradient.addColorStop(1, '#0b203d');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, gameConfig.WIDTH, gameConfig.HEIGHT / 2);

    // Floor
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(0, gameConfig.HEIGHT / 2, gameConfig.WIDTH, gameConfig.HEIGHT / 2);

    // Walls
    const rays = castRays(playerRef.current);
    const stripWidth = gameConfig.WIDTH / gameConfig.RAY_COUNT;
    for (let i = 0; i < rays.length; i++) {
      const ray = rays[i];
      const correctedDist = ray.distance * Math.cos(ray.angle - playerRef.current.dir);
      let lineHeight = (gameConfig.TILE_SIZE * gameConfig.HEIGHT) / correctedDist;
      if (lineHeight > gameConfig.HEIGHT) lineHeight = gameConfig.HEIGHT;
      let shade = 255 - Math.min(255, correctedDist * 3);
      shade = Math.max(shade, 50);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(i * stripWidth, gameConfig.HEIGHT / 2 - lineHeight / 2, stripWidth + 1, lineHeight);
    }

    // Draw enemies using billboarding
    enemiesRef.current.forEach(enemy => {
      if (!enemy.alive) return;
      const dx = enemy.x - playerRef.current.x;
      const dy = enemy.y - playerRef.current.y;
      const dist = Math.hypot(dx, dy);
      let angleToEnemy = Math.atan2(dy, dx) - playerRef.current.dir;
      if (angleToEnemy > Math.PI) angleToEnemy -= 2 * Math.PI;
      else if (angleToEnemy < -Math.PI) angleToEnemy += 2 * Math.PI;
      if (Math.abs(angleToEnemy) < playerRef.current.fov / 2 && dist < gameConfig.MAX_DEPTH) {
        const screenX =
          gameConfig.WIDTH / 2 + (Math.tan(angleToEnemy) * (gameConfig.WIDTH / 2)) / Math.tan(playerRef.current.fov / 2);
        let size = (gameConfig.TILE_SIZE * gameConfig.HEIGHT) / dist;
        if (size > gameConfig.HEIGHT) size = gameConfig.HEIGHT;
        ctx.save();
        ctx.beginPath();
        ctx.arc(screenX, gameConfig.HEIGHT / 2, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
        ctx.shadowBlur = 10;
        ctx.fill();

        // Health bar
        const healthWidth = size;
        const barHeight = 8;
        const healthRatio = enemy.health / enemy.maxHealth;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(screenX - healthWidth / 2, gameConfig.HEIGHT / 2 + size / 2 + 8, healthWidth, barHeight);
        ctx.fillStyle = 'rgba(239, 68, 68, 1)';
        ctx.fillRect(
          screenX - healthWidth / 2,
          gameConfig.HEIGHT / 2 + size / 2 + 8,
          healthWidth * healthRatio,
          barHeight
        );

        ctx.restore();
      }
    });
  };

  const drawMinimap = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, minimapRef.current?.width || 0, minimapRef.current?.height || 0);
    // Draw map grid
    for (let y = 0; y < gameConfig.MAP_H; y++) {
      for (let x = 0; x < gameConfig.MAP_W; x++) {
        const tile = MAP[y * gameConfig.MAP_W + x];
        ctx.fillStyle = tile === 1 ? '#06b6d4' : 'rgba(6,182,212,0.1)';
        ctx.fillRect(x * gameConfig.MINIMAP_SCALE, y * gameConfig.MINIMAP_SCALE, gameConfig.MINIMAP_SCALE, gameConfig.MINIMAP_SCALE);
      }
    }
    // Draw enemies on map
    enemiesRef.current.forEach(enemy => {
      if (!enemy.alive) return;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(
        (enemy.x / gameConfig.TILE_SIZE) * gameConfig.MINIMAP_SCALE,
        (enemy.y / gameConfig.TILE_SIZE) * gameConfig.MINIMAP_SCALE,
        gameConfig.MINIMAP_SCALE / 3,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });
    // Draw player on map
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(
      (playerRef.current.x / gameConfig.TILE_SIZE) * gameConfig.MINIMAP_SCALE,
      (playerRef.current.y / gameConfig.TILE_SIZE) * gameConfig.MINIMAP_SCALE,
      gameConfig.MINIMAP_SCALE / 2,
      0,
      2 * Math.PI
    );
    ctx.fill();

    // Draw player facing direction line
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const px = (playerRef.current.x / gameConfig.TILE_SIZE) * gameConfig.MINIMAP_SCALE;
    const py = (playerRef.current.y / gameConfig.TILE_SIZE) * gameConfig.MINIMAP_SCALE;
    const dx = Math.cos(playerRef.current.dir) * gameConfig.MINIMAP_SCALE * 2;
    const dy = Math.sin(playerRef.current.dir) * gameConfig.MINIMAP_SCALE * 2;
    ctx.moveTo(px, py);
    ctx.lineTo(px + dx, py + dy);
    ctx.stroke();
  };

  return (
    <div className={styles.gameContainer} role="main" aria-label="First Person Shooter Game">
      <div className={styles.gameWrapper}>
        <canvas
          ref={canvasRef}
          className={styles.gameCanvas}
          width={gameConfig.WIDTH}
          height={gameConfig.HEIGHT}
          tabIndex={0}
          aria-label="Game display area"
        />
        <div className={`${styles.crosshair} ${hitMarker ? styles.shoot : ''}`} aria-hidden="true">
          <div className={`${styles.crosshairLine} ${styles.top}`} />
          <div className={`${styles.crosshairLine} ${styles.bottom}`} />
          <div className={`${styles.crosshairLine} ${styles.left}`} />
          <div className={`${styles.crosshairLine} ${styles.right}`} />
        </div>
        <div className={styles.hud} aria-live="polite" aria-atomic="true">
          <div className={styles.health} role="region" aria-label="Health status">
            Health
            <div className={styles.healthBarContainer} aria-hidden="true">
              <div
                className={styles.healthBar}
                style={{ width: `${(player.health / player.maxHealth) * 100}%` }}
              />
            </div>
            <span>{player.health}</span>
          </div>
          <div className={styles.ammo} role="region" aria-label="Ammunition count">
            Ammo <span className={styles.ammoCount}>{player.ammo}</span>
          </div>
        </div>
      </div>
      <canvas
        ref={minimapRef}
        className={styles.minimap}
        width={gameConfig.MAP_W * gameConfig.MINIMAP_SCALE}
        height={gameConfig.MAP_H * gameConfig.MINIMAP_SCALE}
        aria-label="Mini map display"
      />
      <div className={`${styles.touchControls} ${pointerLocked ? styles.active : ''}`} aria-label="Touch controls">
        <div className={styles.joystickContainer} aria-label="Virtual movement joystick" tabIndex={0}>
          <div className={styles.joystickThumb} />
        </div>
        <button className={styles.shootButton} onClick={handleShoot} aria-label="Shoot button" role="button">
          Shoot
        </button>
      </div>
    </div>
  );
}