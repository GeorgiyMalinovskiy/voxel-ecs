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
  private lastLogTime: number = 0;
  private readonly LOG_INTERVAL: number = 1000; // Log every 1 second

  constructor() {
    this.logger = new Logger("CameraSystem");
  }

  update(world: World, deltaTime: number): void {
    const entities = world.getEntitiesWith(TransformComponent, CameraComponent);
    const currentTime = performance.now();

    // Only log camera position every LOG_INTERVAL milliseconds
    if (currentTime - this.lastLogTime >= this.LOG_INTERVAL) {
      for (const entity of entities) {
        const transform = world.getComponent(entity, TransformComponent)!;
        this.logger.debug(`Camera position: ${vec3.str(transform.position)}`);
      }
      this.lastLogTime = currentTime;
    }
  }
}

export class SampleScene {
  private world: World;
  private octree: VoxelOctree;
  private renderer: WebGPURenderer;
  private logger: Logger;
  private lastTime: number = 0;
  private lastSnapshotTime: number = 0;
  private readonly SNAPSHOT_INTERVAL: number = 1000; // Take snapshot every second
  private cleanup: () => void;
  private isDisposed: boolean = false;
  private boundKeydownHandler: (event: KeyboardEvent) => void;
  private animationFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // Set log level to INFO by default, only show debug when needed
    Logger.setLogLevel(LogLevel.INFO);

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

    // Setup logging on 'L' key press with proper binding for removal
    this.boundKeydownHandler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "l") {
        this.logger.info("\n=== Final Scene State ===");
        this.captureSnapshot();
        this.logger.info("=== End Scene State ===\n");
        this.downloadLogs();
      }
    };
    document.addEventListener("keydown", this.boundKeydownHandler);

    // Setup cleanup
    this.cleanup = () => {
      this.dispose();
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

  private captureSnapshot(): void {
    // Log scene summary
    this.logger.info(`Active entities: ${this.world.getEntitiesWith().length}`);

    // Log camera state
    const cameraEntity = this.world.getEntitiesWith(
      TransformComponent,
      CameraComponent
    )[0];
    if (cameraEntity) {
      const cameraTransform = this.world.getComponent(
        cameraEntity,
        TransformComponent
      )!;
      const camera = this.world.getComponent(cameraEntity, CameraComponent)!;
      this.logger.info(
        `Camera position: ${vec3.str(cameraTransform.position)}`
      );
      this.logger.info(`Camera FOV: ${camera.fov}°`);
    }

    // Log renderer state
    this.logger.info(`Renderer status: ${this.renderer.getStatus()}`);

    // Log octree state
    this.logger.info(
      `Octree size: ${this.octree.getSize()}, depth: ${this.octree.getMaxDepth()}`
    );

    // Log system state
    const systems = this.world.getSystems();
    this.logger.info(`Active systems: ${systems.length}`);
    systems.forEach((system: System) => {
      this.logger.info(`- ${system.constructor.name}`);
    });
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

    // Take periodic snapshots
    if (currentTime - this.lastSnapshotTime >= this.SNAPSHOT_INTERVAL) {
      this.logger.info("\n=== Scene State Snapshot ===");
      this.captureSnapshot();
      this.logger.info(`=== End Snapshot at ${new Date().toISOString()} ===\n`);
      this.lastSnapshotTime = currentTime;
    }

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
    if (this.isDisposed) {
      this.logger.warn("Attempting to start a disposed scene");
      return;
    }

    const animate = (time: number) => {
      if (this.isDisposed) {
        return;
      }
      this.update(time);
      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
    this.logger.info("Scene animation started");
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;

    // Cancel animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Remove event listeners
    window.removeEventListener("beforeunload", this.cleanup);
    document.removeEventListener("keydown", this.boundKeydownHandler);

    // Cleanup WebGPU resources
    if (this.renderer) {
      this.renderer.dispose();
    }

    // Clear world entities
    const entities = this.world.getEntitiesWith();
    for (const entity of entities) {
      this.world.destroyEntity(entity);
    }

    // Clear octree
    this.octree.clear();

    // Cleanup logger
    Logger.cleanup();
    this.logger.info("Scene cleanup completed");
  }
}
