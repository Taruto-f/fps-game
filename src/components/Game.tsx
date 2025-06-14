import { useEffect, useRef, useState } from 'react';
import styles from '../styles/Game.module.css';
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
    moving: { forward: false, backward: false, left: false, right: false },
    speed: 0.8,
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

      const updatedPlayer = updatePlayer(playerRef.current);
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

    const { player: newPlayer, enemies: newEnemies, hitEnemy } = shoot(playerRef.current, enemiesRef.current);
    playerRef.current = newPlayer;
    enemiesRef.current = newEnemies;
    setPlayer(newPlayer);
    setEnemies(newEnemies);
    setHitMarker(hitEnemy);

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
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, gameConfig.WIDTH, gameConfig.HEIGHT);

    const rays = castRays(playerRef.current);
    const wallHeight = gameConfig.HEIGHT / 2;
    const wallWidth = gameConfig.WIDTH / gameConfig.RAY_COUNT;

    rays.forEach((ray, i) => {
      const height = (wallHeight * 1.5) / ray.distance;
      const brightness = Math.min(1, 1 / (ray.distance / 10));
      ctx.fillStyle = `rgb(${Math.floor(255 * brightness)}, ${Math.floor(255 * brightness)}, ${Math.floor(255 * brightness)})`;
      ctx.fillRect(
        i * wallWidth,
        (gameConfig.HEIGHT - height) / 2,
        wallWidth + 1,
        height
      );
    });

    enemiesRef.current.forEach(enemy => {
      if (!enemy.alive) return;

      const dx = enemy.x - playerRef.current.x;
      const dy = enemy.y - playerRef.current.y;
      const angle = Math.atan2(dy, dx);
      const angleDiff = Math.abs(angle - playerRef.current.dir);

      if (angleDiff < playerRef.current.fov / 2) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        const height = (wallHeight * 1.5) / distance;
        const x = (angleDiff / playerRef.current.fov) * gameConfig.WIDTH;
        const brightness = Math.min(1, 1 / (distance / 10));

        ctx.fillStyle = `rgb(${Math.floor(255 * brightness)}, 0, 0)`;
        ctx.fillRect(
          x - height / 4,
          (gameConfig.HEIGHT - height) / 2,
          height / 2,
          height
        );
      }
    });
  };

  const drawMinimap = (ctx: CanvasRenderingContext2D) => {
    const { MINIMAP_SCALE, MAP_W, MAP_H } = gameConfig;
    const minimap = minimapRef.current;
    if (!minimap) return;

    ctx.clearRect(0, 0, minimap.width, minimap.height);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = MAP[y * MAP_W + x];
        ctx.fillStyle = tile === 1 ? '#06b6d4' : 'rgba(6,182,212,0.1)';
        ctx.fillRect(x * MINIMAP_SCALE, y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE);
      }
    }

    enemiesRef.current.forEach(enemy => {
      if (!enemy.alive) return;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(
        (enemy.x / gameConfig.TILE_SIZE) * MINIMAP_SCALE,
        (enemy.y / gameConfig.TILE_SIZE) * MINIMAP_SCALE,
        MINIMAP_SCALE / 3,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });

    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(
      (playerRef.current.x / gameConfig.TILE_SIZE) * MINIMAP_SCALE,
      (playerRef.current.y / gameConfig.TILE_SIZE) * MINIMAP_SCALE,
      MINIMAP_SCALE / 2,
      0,
      2 * Math.PI
    );
    ctx.fill();

    ctx.strokeStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(
      (playerRef.current.x / gameConfig.TILE_SIZE) * MINIMAP_SCALE,
      (playerRef.current.y / gameConfig.TILE_SIZE) * MINIMAP_SCALE
    );
    ctx.lineTo(
      ((playerRef.current.x + Math.cos(playerRef.current.dir) * gameConfig.TILE_SIZE) / gameConfig.TILE_SIZE) * MINIMAP_SCALE,
      ((playerRef.current.y + Math.sin(playerRef.current.dir) * gameConfig.TILE_SIZE) / gameConfig.TILE_SIZE) * MINIMAP_SCALE
    );
    ctx.stroke();
  };

  return (
    <div className={styles.gameContainer}>
      <div className={styles.gameWrapper}>
        <canvas
          ref={canvasRef}
          className={styles.gameCanvas}
          width={gameConfig.WIDTH}
          height={gameConfig.HEIGHT}
        />
        <div className={`${styles.crosshair} ${hitMarker ? styles.shoot : ''}`}>
          <div className={`${styles.crosshairLine} ${styles.top}`} />
          <div className={`${styles.crosshairLine} ${styles.bottom}`} />
          <div className={`${styles.crosshairLine} ${styles.left}`} />
          <div className={`${styles.crosshairLine} ${styles.right}`} />
        </div>
        <div className={styles.hud}>
          <div className={styles.health}>
            Health
            <div className={styles.healthBarContainer}>
              <div
                className={styles.healthBar}
                style={{ width: `${(player.health / player.maxHealth) * 100}%` }}
              />
            </div>
            <span>{player.health}</span>
          </div>
          <div className={styles.ammo}>
            Ammo <span className={styles.ammoCount}>{player.ammo}</span>
          </div>
        </div>
      </div>
      <canvas
        ref={minimapRef}
        className={styles.minimap}
        width={gameConfig.MAP_W * gameConfig.MINIMAP_SCALE}
        height={gameConfig.MAP_H * gameConfig.MINIMAP_SCALE}
      />
      <div className={`${styles.touchControls} ${pointerLocked ? styles.active : ''}`}>
        <div className={styles.joystickContainer}>
          <div className={styles.joystickThumb} />
        </div>
        <button className={styles.shootButton} onClick={handleShoot}>
          Shoot
        </button>
      </div>
    </div>
  );
} 