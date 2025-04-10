import { System } from "../types";
import { World } from "../world";
import { TransformComponent } from "../components/transform";
import { CameraComponent } from "../components/camera";
import { VoxelComponent } from "../components/voxel";
import { WebGPURenderer } from "../../renderer/webgpu";
import { vec3, mat4 } from "gl-matrix";
import { Logger } from "../../utils/logger";

export class RenderSystem implements System {
  private logger: Logger;
  private renderer: WebGPURenderer;
  private lastLogTime: number = 0;
  private readonly LOG_INTERVAL: number = 1000; // Log every second

  constructor(canvas: HTMLCanvasElement) {
    this.logger = new Logger("RenderSystem");
    this.renderer = new WebGPURenderer(canvas);
  }

  async initialize(): Promise<void> {
    await this.renderer.initialize();
    this.logger.info("Render system initialized");
  }

  update(world: World, deltaTime: number): void {
    // Get camera data for rendering
    const cameraEntity = world.getEntitiesWith(
      TransformComponent,
      CameraComponent
    )[0];

    if (!cameraEntity) {
      this.logger.warn("No camera entity found for rendering");
      return;
    }

    const cameraTransform = world.getComponent(
      cameraEntity,
      TransformComponent
    )!;
    const camera = world.getComponent(cameraEntity, CameraComponent)!;

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

    // Get all voxel entities
    const voxelEntities = world.getEntitiesWith(VoxelComponent);

    // Update vertex data for all voxel entities
    for (const entity of voxelEntities) {
      const voxelComponent = world.getComponent(entity, VoxelComponent)!;
      this.renderer.updateVoxelData(voxelComponent.getOctree());
    }

    // Log camera and rendering state periodically
    const currentTime = performance.now();
    if (currentTime - this.lastLogTime >= this.LOG_INTERVAL) {
      this.logger.debug(
        `Camera: pos=${vec3.str(cameraTransform.position)}, rot=${vec3.str(
          cameraTransform.rotation
        )}, fov=${camera.fov}, Voxel Entities: ${voxelEntities.length}`
      );
      this.lastLogTime = currentTime;
    }

    // Render the scene
    this.renderer.render(viewMatrix, projectionMatrix);
  }

  getStatus(): string {
    return this.renderer.getStatus();
  }

  dispose(): void {
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
