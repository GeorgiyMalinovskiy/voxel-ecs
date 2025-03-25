import { SampleScene } from "./examples/sample-scene";

async function init() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const scene = new SampleScene(canvas);
  await scene.initialize();
  scene.start();

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

init().catch(console.error);
