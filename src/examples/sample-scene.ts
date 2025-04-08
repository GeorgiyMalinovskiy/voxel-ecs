import { World } from "../core/ecs/world";
import { System } from "../core/ecs/types";
import { TransformComponent } from "../core/ecs/components/transform";
import { CameraComponent } from "../core/ecs/components/camera";
import { VoxelOctree } from "../core/voxel/octree";
import { vec3 } from "gl-matrix";
import { Logger, LogLevel } from "../core/utils/logger";
import { CameraSystem } from "../core/ecs/systems/camera";
import { RenderSystem } from "../core/ecs/systems/render";

export class SampleScene {
  private world: World;
  private octree: VoxelOctree;
  private logger: Logger;
  private lastTime: number = 0;
  private lastSnapshotTime: number = 0;
  private readonly SNAPSHOT_INTERVAL: number = 1000; // Take snapshot every second
  private cleanup: () => void;
  private isDisposed: boolean = false;
  private animationFrameId: number | null = null;
  private boundKeydownHandler: (event: KeyboardEvent) => void;
  private cameraSystem: CameraSystem;
  private renderSystem: RenderSystem;

  constructor(canvas: HTMLCanvasElement) {
    // Set log level to INFO by default, only show debug when needed
    Logger.setLogLevel(LogLevel.INFO);

    this.world = new World();
    this.octree = new VoxelOctree(32, 5); // 32 units size, 5 levels deep
    this.logger = new Logger("SampleScene");

    // Initialize camera
    const cameraEntity = this.world.createEntity();
    const initialPosition = vec3.fromValues(15, 15, -25); // Higher and further back
    const initialRotation = vec3.fromValues(0, 0, 0); // Slight downward tilt

    this.world.addComponent(
      cameraEntity,
      new TransformComponent(initialPosition, initialRotation)
    );
    this.world.addComponent(
      cameraEntity,
      new CameraComponent(
        60, // Wider FOV
        0.1,
        100, // Increased far plane
        0.15,
        initialPosition
      )
    );

    // Add systems
    this.cameraSystem = new CameraSystem();
    this.cameraSystem.initialize(canvas);
    this.world.addSystem(this.cameraSystem);

    this.renderSystem = new RenderSystem(canvas, this.octree);
    this.world.addSystem(this.renderSystem);

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
    for (let x = -16; x < 16; x++) {
      for (let z = -16; z < 16; z++) {
        const height = Math.floor(
          Math.sin(x * 0.3) * 4 + Math.cos(z * 0.3) * 4 + 4 // Increased amplitude and added offset
        );

        for (let y = -2; y <= height; y++) {
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
    // Log scene summary with clear section headers
    this.logger.info("=== Scene Summary ===");
    this.logger.info(
      `Total Active Entities: ${this.world.getEntitiesWith().length}`
    );

    // Log camera state
    this.logger.info("\n=== Camera State ===");
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
      this.logger.info(`Position: ${vec3.str(cameraTransform.position)}`);
      this.logger.info(`Rotation: ${vec3.str(cameraTransform.rotation)}`);
      this.logger.info(`FOV: ${camera.fov}°`);
      this.logger.info(`Near/Far: ${camera.near}/${camera.far}`);
      this.logger.info(`Mouse Locked: ${camera.isMouseLocked}`);
    }

    // Log renderer state
    this.logger.info("\n=== Renderer State ===");
    this.logger.info(`Status: ${this.renderSystem.getStatus()}`);

    // Log octree state
    this.logger.info("\n=== Octree State ===");
    this.logger.info(
      `Size: ${this.octree.getSize()}, Max Depth: ${this.octree.getMaxDepth()}`
    );

    // Log system state
    this.logger.info("\n=== Active Systems ===");
    const systems = this.world.getSystems();
    this.logger.info(`Count: ${systems.length}`);
    systems.forEach((system: System) => {
      this.logger.info(`- ${system.constructor.name}`);
    });
  }

  async initialize(): Promise<void> {
    await this.renderSystem.initialize();
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
      this.logger.info(
        "=== End Snapshot at " + new Date().toISOString() + " ===\n"
      );
      this.lastSnapshotTime = currentTime;
    }
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
