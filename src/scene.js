import * as THREE from "three";
import { CONFIG } from "./config.js";

// Создаёт всё, что относится к рендерингу:
// сцена, камера, свет, наклонная поверхность с тремя полосами, игрок, трос.
// Возвращает объект с методами для обновления из game.js.

export function createScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2332);
  scene.fog = new THREE.Fog(0x1a2332, 30, 90);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  // Камера чуть выше и позади игрока, смотрит вверх вдоль склона
  camera.position.set(0, 4, 12);
  camera.lookAt(0, 8, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Свет
  const hemi = new THREE.HemisphereLight(0xaac4e8, 0x1a1410, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 0.9);
  sun.position.set(10, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);

  // Склон — длинная полоса, слегка наклонённая к камере (по X плоская, «уходит» в даль по Z)
  const slopeGeom = new THREE.PlaneGeometry(18, 400, 2, 80);
  const slopeMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.snowSlope, roughness: 0.95, metalness: 0 });
  const slope = new THREE.Mesh(slopeGeom, slopeMat);
  slope.rotation.x = -Math.PI / 2;
  slope.position.set(0, 0, -180);
  slope.receiveShadow = true;
  scene.add(slope);

  // Линии полос — три тонких белых полосы
  const laneGroup = new THREE.Group();
  for (const x of CONFIG.lanes) {
    const g = new THREE.PlaneGeometry(0.1, 400);
    const m = new THREE.MeshBasicMaterial({ color: CONFIG.colors.laneLine, transparent: true, opacity: 0.4 });
    const line = new THREE.Mesh(g, m);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.02, -180);
    laneGroup.add(line);
  }
  scene.add(laneGroup);

  // Вершина горы — просто силуэт далеко на фоне
  const summitGeom = new THREE.ConeGeometry(30, 60, 6);
  const summitMat = new THREE.MeshStandardMaterial({ color: 0x2a3647, roughness: 1 });
  const summit = new THREE.Mesh(summitGeom, summitMat);
  summit.position.set(0, 30, -250);
  scene.add(summit);

  // Игрок: тело (капсула) + «голова» + группа
  const playerGroup = new THREE.Group();
  const bodyGeom = new THREE.CapsuleGeometry(0.4, 0.9, 4, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.player, roughness: 0.6 });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = 0.85;
  body.castShadow = true;
  playerGroup.add(body);

  const headGeom = new THREE.SphereGeometry(0.28, 12, 12);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf4d4a8, roughness: 0.7 });
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.y = 1.75;
  head.castShadow = true;
  playerGroup.add(head);

  // Ноги-отметки для визуального следа
  const feetLeft = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.35), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
  feetLeft.position.set(-0.2, 0.08, 0);
  playerGroup.add(feetLeft);
  const feetRight = feetLeft.clone();
  feetRight.position.x = 0.2;
  playerGroup.add(feetRight);

  playerGroup.position.set(0, 0, 0);
  scene.add(playerGroup);

  // Трос — линия от игрока вверх к якорю высоко над сценой
  const ropeMat = new THREE.LineBasicMaterial({ color: CONFIG.colors.rope, linewidth: 2 });
  const ropeGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 1.75, 0),
    new THREE.Vector3(0, 60, -30),
  ]);
  const rope = new THREE.Line(ropeGeom, ropeMat);
  scene.add(rope);

  // Группа для препятствий — game.js будет добавлять/удалять
  const obstacleGroup = new THREE.Group();
  scene.add(obstacleGroup);

  // Ресайз
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    scene, camera, renderer,
    playerGroup, rope,
    slope, slopeMat,
    obstacleGroup,
    // Обновление позиции игрока (X в мире, Y-прыжок при рывке)
    setPlayerX(x, hop = 0) {
      playerGroup.position.x = x;
      playerGroup.position.y = hop;
      // Трос следует за игроком снизу, якорь сверху смещается слабо (иллюзия длины)
      const pts = [
        new THREE.Vector3(x, 1.75 + hop, 0),
        new THREE.Vector3(x * 0.2, 60, -30),
      ];
      rope.geometry.setFromPoints(pts);
    },
    // Фаза горы: 0 = снежная, 1 = вулкан. Плавно меняем цвет склона.
    setBiome(t) {
      const c = new THREE.Color().lerpColors(
        new THREE.Color(CONFIG.colors.snowSlope),
        new THREE.Color(CONFIG.colors.lavaSlope),
        t
      );
      slopeMat.color.copy(c);
      // Фон неба темнеет
      const bg = new THREE.Color().lerpColors(new THREE.Color(0x1a2332), new THREE.Color(0x4a1a10), t);
      scene.background.copy(bg);
      scene.fog.color.copy(bg);
    },
    render() { renderer.render(scene, camera); },
  };
}
