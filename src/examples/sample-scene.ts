import { World } from "../core/ecs/world";
import { System } from "../core/ecs/types";
import { TransformComponent } from "../core/ecs/components/transform";
import { CameraComponent } from "../core/ecs/components/camera";
import { VoxelOctree } from "../core/voxel/octree";
import { WebGPURenderer } from "../core/renderer/webgpu";
import { vec3, mat4 } from "gl-matrix";
import { Logger, LogLevel } from "../core/utils/logger";

// Systems
class CameraSystem implements System {
  private logger: Logger;

  constructor() {
    this.logger = new Logger("CameraSystem");
  }

  update(world: World, deltaTime: number): void {
    const entities = world.getEntitiesWith(TransformComponent, CameraComponent);

    for (const entity of entities) {
      const transform = world.getComponent(entity, TransformComponent)!;
      this.logger.debug(`Camera position: ${vec3.str(transform.position)}`);
    }
  }
}

export class SampleScene {
  private world: World;
  private octree: VoxelOctree;
  private renderer: WebGPURenderer;
  private logger: Logger;
  private lastTime: number = 0;
  private cleanup: () => void;

  constructor(canvas: HTMLCanvasElement) {
    // Set log level to include debug messages
    Logger.setLogLevel(LogLevel.DEBUG);

    this.world = new World();
    this.octree = new VoxelOctree(32, 5); // 32 units size, 5 levels deep
    this.renderer = new WebGPURenderer(canvas);
    this.logger = new Logger("SampleScene");

    // Initialize camera
    const cameraEntity = this.world.createEntity();
    this.world.addComponent(
      cameraEntity,
      new TransformComponent(
        vec3.fromValues(0, 5, 10), // position
        vec3.fromValues(0, 0, 0) // rotation
      )
    );
    this.world.addComponent(cameraEntity, new CameraComponent(45, 0.1, 100.0));

    // Add systems
    this.world.addSystem(new CameraSystem());

    // Create sample voxel data
    this.createSampleVoxels();

    // Setup logging on 'L' key press
    document.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "l") {
        this.downloadLogs();
      }
    });

    // Setup cleanup
    this.cleanup = () => {
      Logger.cleanup();
      this.logger.info("Scene cleanup completed");
    };

    window.addEventListener("beforeunload", this.cleanup);
  }

  private createSampleVoxels(): void {
    // Create a simple terrain with different colors
    for (let x = -8; x < 8; x++) {
      for (let z = -8; z < 8; z++) {
        const height = Math.floor(
          Math.sin(x * 0.5) * 2 + Math.cos(z * 0.5) * 2
        );

        for (let y = -4; y <= height; y++) {
          const color: [number, number, number, number] = [
            0.2 + Math.random() * 0.2,
            0.5 + Math.random() * 0.2,
            0.2 + Math.random() * 0.2,
            1.0,
          ];

          this.octree.setVoxel(vec3.fromValues(x, y, z), {
            material: 1,
            color,
          });
        }
      }
    }

    this.logger.info("Created sample voxel terrain");
  }

  private downloadLogs(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    Logger.downloadLogs(`scene-logs-${timestamp}.txt`);
    this.logger.info("Logs downloaded");
  }

  async initialize(): Promise<void> {
    await this.renderer.initialize();
    this.renderer.updateVoxelData(this.octree);
    this.logger.info("Scene initialized");
  }

  update(currentTime: number): void {
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Update world systems
    this.world.update(deltaTime);

    // Get camera data for rendering
    const cameraEntity = this.world.getEntitiesWith(
      TransformComponent,
      CameraComponent
    )[0];
    const cameraTransform = this.world.getComponent(
      cameraEntity,
      TransformComponent
    )!;
    const camera = this.world.getComponent(cameraEntity, CameraComponent)!;

    // Create view matrix
    const viewMatrix = mat4.create();
    mat4.lookAt(
      viewMatrix,
      cameraTransform.position,
      vec3.fromValues(0, 0, 0), // Look at center
      vec3.fromValues(0, 1, 0) // Up vector
    );

    // Create projection matrix
    const projectionMatrix = mat4.create();
    const aspect =
      this.renderer["canvas"].width / this.renderer["canvas"].height;
    mat4.perspective(
      projectionMatrix,
      camera.fov * (Math.PI / 180),
      aspect,
      camera.near,
      camera.far
    );

    // Render the scene
    this.renderer.render(viewMatrix, projectionMatrix);
  }

  start(): void {
    const animate = (time: number) => {
      this.update(time);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    this.logger.info("Scene animation started");
  }

  dispose(): void {
    window.removeEventListener("beforeunload", this.cleanup);
    this.cleanup();
  }
}
