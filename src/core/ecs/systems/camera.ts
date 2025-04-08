import { System } from "../types";
import { World } from "../world";
import { TransformComponent } from "../components/transform";
import { CameraComponent } from "../components/camera";
import { vec3 } from "gl-matrix";
import { Logger } from "../../utils/logger";

export class CameraSystem implements System {
  private logger: Logger;
  private lastLogTime: number = 0;
  private readonly LOG_INTERVAL: number = 1000; // Log every 1 second
  private keyStates: Map<string, boolean> = new Map();
  private boundKeydownHandler: (event: KeyboardEvent) => void;
  private boundKeyupHandler: (event: KeyboardEvent) => void;
  private boundMouseMoveHandler: (event: MouseEvent) => void;
  private boundPointerLockChange: () => void;
  private world: World | null = null;
  private canvas!: HTMLCanvasElement; // Using definite assignment assertion

  constructor() {
    this.logger = new Logger("CameraSystem");

    // Bind event handlers
    this.boundKeydownHandler = this.handleKeyDown.bind(this);
    this.boundKeyupHandler = this.handleKeyUp.bind(this);
    this.boundMouseMoveHandler = this.handleMouseMove.bind(this);
    this.boundPointerLockChange = this.handlePointerLockChange.bind(this);

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

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    // Add event listeners
    window.addEventListener("keydown", this.boundKeydownHandler);
    window.addEventListener("keyup", this.boundKeyupHandler);
    this.canvas.addEventListener("mousemove", this.boundMouseMoveHandler);
    document.addEventListener("pointerlockchange", this.boundPointerLockChange);
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

      // Handle mouse movement for camera rotation
      if (camera.isMouseLocked) {
        const rotX = event.movementY * camera.mouseSensitivity;
        const rotY = -event.movementX * camera.mouseSensitivity;

        // Update rotation with clamping for X (vertical) rotation
        transform.rotation[0] = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, transform.rotation[0] + rotX)
        );
        transform.rotation[1] = (transform.rotation[1] + rotY) % (2 * Math.PI);
      }
    }
  }

  private handlePointerLockChange(): void {
    const entities =
      this.world?.getEntitiesWith(TransformComponent, CameraComponent) ?? [];
    for (const entity of entities) {
      const camera = this.world!.getComponent(entity, CameraComponent)!;
      camera.isMouseLocked = document.pointerLockElement === this.canvas;
    }
  }

  private toggleMouseLock(): void {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    } else {
      this.canvas.requestPointerLock();
    }
  }

  update(world: World, deltaTime: number): void {
    this.world = world;
    const entities = world.getEntitiesWith(TransformComponent, CameraComponent);
    const currentTime = performance.now();

    for (const entity of entities) {
      const transform = world.getComponent(entity, TransformComponent)!;
      const camera = world.getComponent(entity, CameraComponent)!;

      // Calculate movement direction based on camera rotation
      const moveDir = vec3.create();
      const forward = vec3.fromValues(
        Math.sin(transform.rotation[1]),
        0,
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
        vec3.scaleAndAdd(moveDir, moveDir, right, -1);
      }
      if (this.keyStates.get("a") || this.keyStates.get("arrowleft")) {
        vec3.scaleAndAdd(moveDir, moveDir, right, 1);
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
    window.removeEventListener("keydown", this.boundKeydownHandler);
    window.removeEventListener("keyup", this.boundKeyupHandler);
    this.canvas.removeEventListener("mousemove", this.boundMouseMoveHandler);
    document.removeEventListener(
      "pointerlockchange",
      this.boundPointerLockChange
    );
  }
}
