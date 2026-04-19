import * as THREE from "three";
import { CONFIG } from "./config.js";

// Препятствия живут в относительной системе координат скрина.
// Их worldY мы не трекаем — они просто движутся вниз по Z, пока не уйдут за игрока.
// Это упрощает прототип: «подъём» мира происходит через визуальный скролл (чуть ниже),
// а коллизия — по позиции obstacle.position.z приближающегося к z≈0 (позиция игрока).

export class Rock {
  constructor(laneIndex) {
    this.laneIndex = laneIndex;
    this.x = CONFIG.lanes[laneIndex];
    const geom = new THREE.DodecahedronGeometry(CONFIG.obstacles.rock.size, 0);
    const mat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.rock, roughness: 0.9, flatShading: true });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.castShadow = true;
    this.mesh.position.set(this.x, CONFIG.obstacles.rock.size, -CONFIG.obstacles.rock.spawnAheadY);
    this.dead = false;
    this.rotAxis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
  }
  update(dt) {
    this.mesh.position.z += CONFIG.obstacles.rock.speed * dt;
    this.mesh.rotateOnAxis(this.rotAxis, dt * 3);
    if (this.mesh.position.z > 6) this.dead = true;
  }
  // True если opened hitbox игрока (x=playerX, z≈0) перекрыт этим камнем
  checkHit(playerX) {
    if (Math.abs(this.mesh.position.z) > 1.2) return false;
    return Math.abs(this.mesh.position.x - playerX) < CONFIG.obstacles.rock.killDistance;
  }
}

export class Avalanche {
  constructor() {
    const w = CONFIG.lanes[2] - CONFIG.lanes[0] + 2.5; // перекрывает все полосы + запас
    const h = 1.6, d = CONFIG.obstacles.avalanche.thickness;
    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.avalanche, roughness: 1, opacity: 0.92, transparent: true });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.position.set(0, h / 2, -CONFIG.obstacles.avalanche.spawnAheadY);
    this.dead = false;
  }
  update(dt) {
    this.mesh.position.z += CONFIG.obstacles.avalanche.speed * dt;
    if (this.mesh.position.z > 8) this.dead = true;
  }
  checkHit(_playerX) {
    // Лавина покрывает все X — проверяем только Z-перекрытие с игроком (z=0)
    const halfD = CONFIG.obstacles.avalanche.thickness / 2;
    return this.mesh.position.z + halfD > -0.5 && this.mesh.position.z - halfD < 0.5;
  }
}

export class ObstacleSpawner {
  constructor(sceneApi) {
    this.sceneApi = sceneApi;
    this.rocks = [];
    this.avalanches = [];
    this.nextSpawnIn = 1.5;
    this.avalancheCooldown = 0;
  }

  update(dt, gameState) {
    // Обновить существующие
    for (const r of this.rocks) r.update(dt);
    for (const a of this.avalanches) a.update(dt);

    // Удалить мёртвые
    this.rocks = this.rocks.filter(r => {
      if (r.dead) this.sceneApi.obstacleGroup.remove(r.mesh);
      return !r.dead;
    });
    this.avalanches = this.avalanches.filter(a => {
      if (a.dead) this.sceneApi.obstacleGroup.remove(a.mesh);
      return !a.dead;
    });

    // Таймер спавна
    this.nextSpawnIn -= dt;
    this.avalancheCooldown = Math.max(0, this.avalancheCooldown - dt);

    if (this.nextSpawnIn <= 0) {
      this.spawn(gameState);
      const { spawnIntervalMin, spawnIntervalMax } = CONFIG.obstacles.rock;
      // Ускорение по высоте: чем выше, тем плотнее
      const difficultyScale = Math.max(0.55, 1 - gameState.worldY / 400);
      this.nextSpawnIn = (spawnIntervalMin + Math.random() * (spawnIntervalMax - spawnIntervalMin)) * difficultyScale;
    }
  }

  spawn(gameState) {
    const roll = Math.random();
    if (roll < CONFIG.obstacles.avalanche.chance && this.avalancheCooldown <= 0) {
      const a = new Avalanche();
      this.sceneApi.obstacleGroup.add(a.mesh);
      this.avalanches.push(a);
      this.avalancheCooldown = CONFIG.obstacles.avalanche.minIntervalAfter;
      gameState.warn?.("Лавина! Сильный рывок → карниз");
      return;
    }
    // Камни: 1 или 2 полосы
    const lanes = [0, 1, 2];
    const first = lanes.splice(Math.floor(Math.random() * 3), 1)[0];
    this.addRock(first);
    if (Math.random() < CONFIG.obstacles.rock.doubleRockChance) {
      const second = lanes[Math.floor(Math.random() * lanes.length)];
      this.addRock(second);
    }
  }

  addRock(laneIndex) {
    const r = new Rock(laneIndex);
    this.sceneApi.obstacleGroup.add(r.mesh);
    this.rocks.push(r);
  }

  checkHits(playerX) {
    const hits = { rock: null, avalanche: null };
    for (const r of this.rocks) {
      if (!r.dead && r.checkHit(playerX)) { hits.rock = r; break; }
    }
    for (const a of this.avalanches) {
      if (!a.dead && a.checkHit(playerX)) { hits.avalanche = a; break; }
    }
    return hits;
  }
}
