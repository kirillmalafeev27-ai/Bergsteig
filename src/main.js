import { createScene } from "./scene.js";
import { createUI } from "./ui.js";
import { createGame } from "./game.js";
import { bindInput } from "./input.js";

const canvas = document.getElementById("scene");
const sceneApi = createScene(canvas);

let game; // forward ref для UI-колбэков
const ui = createUI({
  onAnswer: (i) => game?.answerQuestion(i),
  onStart: () => game?.start(),
});

game = createGame({ sceneApi, ui });

bindInput({
  pull: (dir, kind) => game.pull(dir, kind),
  clearSnow: () => game.clearSnow(),
  snowWall: () => game.deploySnowWall(),
  answer: (i) => game.answerQuestion(i),
});

ui.showStart();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); // cap для стабильности
  last = now;
  game.update(dt);
  sceneApi.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
