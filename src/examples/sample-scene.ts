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
  private keyStates: Map<string, boolean> = new Map();
  private boundKeydownHandler: (event: KeyboardEvent) => void;
  private boundKeyupHandler: (event: KeyboardEvent) => void;
  private boundMouseMoveHandler: (event: MouseEvent) => void;
  private boundPointerLockChange: () => void;
  private world: World | null = null;

  constructor() {
    this.logger = new Logger("CameraSystem");

    // Bind event handlers
    this.boundKeydownHandler = this.handleKeyDown.bind(this);
    this.boundKeyupHandler = this.handleKeyUp.bind(this);
    this.boundMouseMoveHandler = this.handleMouseMove.bind(this);
    this.boundPointerLockChange = this.handlePointerLockChange.bind(this);

    // Add event listeners
    document.addEventListener("keydown", this.boundKeydownHandler);
    document.addEventListener("keyup", this.boundKeyupHandler);
    document.addEventListener("mousemove", this.boundMouseMoveHandler);
    document.addEventListener("pointerlockchange", this.boundPointerLockChange);

    // Initialize key states for WASD and arrow keys
    [
      "w",
      "a",
      "s",
      "d",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].forEach((key) => {
      this.keyStates.set(key, false);
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keyStates.set(key, true);

    // Toggle mouse lock on 'C' key
    if (key === "c") {
      this.toggleMouseLock();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keyStates.set(key, false);
  }

  private handleMouseMove(event: MouseEvent): void {
    const entities =
      this.world?.getEntitiesWith(TransformComponent, CameraComponent) ?? [];
    for (const entity of entities) {
      const camera = this.world!.getComponent(entity, CameraComponent)!;
      const transform = this.world!.getComponent(entity, TransformComponent)!;

      if (camera.isMouseLocked) {
        // Update camera rotation based on mouse movement
        const rotX = -event.movementY * camera.mouseSensitivity; // Inverted Y axis
        const rotY = event.movementX * camera.mouseSensitivity;

        vec3.add(
          camera.targetRotation,
          camera.targetRotation,
          vec3.fromValues(rotX, rotY, 0)
        );

        // Clamp vertical rotation to prevent camera flipping
        camera.targetRotation[0] = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, camera.targetRotation[0])
        );
      }
    }
  }

  private handlePointerLockChange(): void {
    const entities =
      this.world?.getEntitiesWith(TransformComponent, CameraComponent) ?? [];
    for (const entity of entities) {
      const camera = this.world!.getComponent(entity, CameraComponent)!;
      camera.isMouseLocked = document.pointerLockElement !== null;
    }
  }

  private toggleMouseLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    } else {
      document.body.requestPointerLock();
    }
  }

  update(world: World, deltaTime: number): void {
    this.world = world;
    const entities = world.getEntitiesWith(TransformComponent, CameraComponent);
    const currentTime = performance.now();

    for (const entity of entities) {
      const transform = world.getComponent(entity, TransformComponent)!;
      const camera = world.getComponent(entity, CameraComponent)!;

      // Update rotation with smoothing
      vec3.lerp(
        transform.rotation,
        transform.rotation,
        camera.targetRotation,
        camera.smoothing
      );

      // Calculate movement direction based on camera rotation
      const moveDir = vec3.create();
      const forward = vec3.fromValues(
        Math.sin(transform.rotation[1]),
        0, // Keep Y movement at 0 for now
        Math.cos(transform.rotation[1])
      );
      const right = vec3.fromValues(
        Math.cos(transform.rotation[1]),
        0,
        -Math.sin(transform.rotation[1])
      );

      // Apply movement based on key states
      if (this.keyStates.get("w") || this.keyStates.get("arrowup")) {
        vec3.scaleAndAdd(moveDir, moveDir, forward, 1);
      }
      if (this.keyStates.get("s") || this.keyStates.get("arrowdown")) {
        vec3.scaleAndAdd(moveDir, moveDir, forward, -1);
      }
      if (this.keyStates.get("d") || this.keyStates.get("arrowright")) {
        vec3.scaleAndAdd(moveDir, moveDir, right, 1);
      }
      if (this.keyStates.get("a") || this.keyStates.get("arrowleft")) {
        vec3.scaleAndAdd(moveDir, moveDir, right, -1);
      }

      // Normalize and scale movement
      if (vec3.length(moveDir) > 0) {
        vec3.normalize(moveDir, moveDir);
        vec3.scale(moveDir, moveDir, camera.moveSpeed * deltaTime);
        vec3.add(camera.targetPosition, transform.position, moveDir);
      } else {
        vec3.copy(camera.targetPosition, transform.position);
      }

      // Update position with smoothing
      vec3.lerp(
        transform.position,
        transform.position,
        camera.targetPosition,
        camera.smoothing
      );

      // Log camera position periodically
      if (currentTime - this.lastLogTime >= this.LOG_INTERVAL) {
        this.logger.debug(`Camera position: ${vec3.str(transform.position)}`);
        this.lastLogTime = currentTime;
      }
    }
  }

  dispose(): void {
    // Remove event listeners
    document.removeEventListener("keydown", this.boundKeydownHandler);
    document.removeEventListener("keyup", this.boundKeyupHandler);
    document.removeEventListener("mousemove", this.boundMouseMoveHandler);
    document.removeEventListener(
      "pointerlockchange",
      this.boundPointerLockChange
    );
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
  private animationFrameId: number | null = null;
  private boundKeydownHandler: (event: KeyboardEvent) => void;

  constructor(canvas: HTMLCanvasElement) {
    // Set log level to INFO by default, only show debug when needed
    Logger.setLogLevel(LogLevel.INFO);

    this.world = new World();
    this.octree = new VoxelOctree(32, 5); // 32 units size, 5 levels deep
    this.renderer = new WebGPURenderer(canvas);
    this.logger = new Logger("SampleScene");

    // Initialize camera
    const cameraEntity = this.world.createEntity();
    const initialPosition = vec3.fromValues(0, 8, 20); // Higher and further back
    const initialRotation = vec3.fromValues(-0.3, 0, 0); // Slight downward tilt

    this.world.addComponent(
      cameraEntity,
      new TransformComponent(initialPosition, initialRotation)
    );
    this.world.addComponent(
      cameraEntity,
      new CameraComponent(
        60, // Wider FOV
        0.1,
        200.0, // Increased far plane
        0.15,
        initialPosition,
        initialRotation
      )
    );

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
    this.logger.info(`Status: ${this.renderer.getStatus()}`);

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
      this.logger.info(
        "=== End Snapshot at " + new Date().toISOString() + " ===\n"
      );
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
    const forward = vec3.fromValues(
      Math.sin(cameraTransform.rotation[1]) *
        Math.cos(cameraTransform.rotation[0]),
      -Math.sin(cameraTransform.rotation[0]),
      Math.cos(cameraTransform.rotation[1]) *
        Math.cos(cameraTransform.rotation[0])
    );
    const lookAtPoint = vec3.create();
    vec3.add(lookAtPoint, cameraTransform.position, forward);

    mat4.lookAt(
      viewMatrix,
      cameraTransform.position,
      lookAtPoint,
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
