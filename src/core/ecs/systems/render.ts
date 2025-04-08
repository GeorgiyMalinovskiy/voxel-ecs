import { System } from "../types";
import { World } from "../world";
import { TransformComponent } from "../components/transform";
import { CameraComponent } from "../components/camera";
import { WebGPURenderer } from "../../renderer/webgpu";
import { vec3, mat4 } from "gl-matrix";
import { Logger } from "../../utils/logger";
import { VoxelOctree } from "../../voxel/octree";

export class RenderSystem implements System {
  private logger: Logger;
  private renderer: WebGPURenderer;

  constructor(canvas: HTMLCanvasElement, private octree: VoxelOctree) {
    this.logger = new Logger("RenderSystem");
    this.renderer = new WebGPURenderer(canvas);
  }

  async initialize(): Promise<void> {
    await this.renderer.initialize();
    this.renderer.updateVoxelData(this.octree);
    this.logger.info("Render system initialized");
  }

  update(world: World, deltaTime: number): void {
    // Get camera data for rendering
    const cameraEntity = world.getEntitiesWith(
      TransformComponent,
      CameraComponent
    )[0];

    if (!cameraEntity) {
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

    // Render the scene
    this.renderer.render(viewMatrix, projectionMatrix);
  }

  dispose(): void {
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  getStatus(): string {
    return this.renderer.getStatus();
  }
}
