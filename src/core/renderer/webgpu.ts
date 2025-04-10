import { Logger } from "../utils/logger";
import { VoxelOctree, OctreeNode } from "../voxel/octree";
import { vec3, mat4 } from "gl-matrix";

export class WebGPURenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private logger: Logger;
  private lastRenderLogTime: number = 0;
  private readonly RENDER_LOG_INTERVAL: number = 1000; // Log every 1 second
  private frameCount: number = 0;
  private lastFrameTime: number = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.logger = new Logger("WebGPURenderer");
  }

  getStatus(): string {
    const fps =
      this.frameCount > 0
        ? Math.round(
            (1000 * this.frameCount) / (performance.now() - this.lastFrameTime)
          )
        : 0;

    return (
      `FPS: ${fps}, Canvas: ${this.canvas.width}x${this.canvas.height}, ` +
      `Buffers: ${this.vertexBuffer ? "Active" : "None"}`
    );
  }

  async initialize(): Promise<void> {
    try {
      if (!navigator.gpu) {
        throw new Error("WebGPU not supported");
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("No appropriate GPUAdapter found");
      }

      this.device = await adapter.requestDevice();
      this.context = this.canvas.getContext("webgpu");

      if (!this.context) {
        throw new Error("Failed to get WebGPU context");
      }

      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: "premultiplied",
      });

      await this.createPipeline(canvasFormat);
      this.logger.info("WebGPU renderer initialized successfully");
    } catch (error) {
      this.logger.error(`Failed to initialize WebGPU: ${error}`);
      throw error;
    }
  }

  private async createPipeline(canvasFormat: GPUTextureFormat): Promise<void> {
    const shaderModule = this.device!.createShaderModule({
      code: `
                struct Uniforms {
                    viewProjectionMatrix: mat4x4<f32>,
                };

                @binding(0) @group(0) var<uniform> uniforms: Uniforms;

                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                    @location(0) color: vec4<f32>,
                };

                @vertex
                fn vertexMain(@location(0) position: vec3<f32>,
                            @location(1) color: vec4<f32>) -> VertexOutput {
                    var output: VertexOutput;
                    output.position = uniforms.viewProjectionMatrix * vec4<f32>(position, 1.0);
                    output.color = color;
                    return output;
                }

                @fragment
                fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
                    return input.color;
                }
            `,
    });

    const uniformBufferSize = 4 * 16; // 4x4 matrix
    this.uniformBuffer = this.device!.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = this.device!.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    this.bindGroup = this.device!.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });

    const pipelineLayout = this.device!.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.pipeline = this.device!.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
        buffers: [
          {
            arrayStride: 28, // 3 floats for position + 4 floats for color
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
              {
                shaderLocation: 1,
                offset: 12,
                format: "float32x4",
              },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: canvasFormat,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    this.logger.debug("Created WebGPU pipeline");
  }

  updateVoxelData(octree: VoxelOctree): void {
    const vertices: number[] = [];

    octree.traverse((node: OctreeNode) => {
      const voxel = node.getVoxel(node.position);
      if (voxel && voxel.active) {
        this.generateCubeVertices(node, vertices);
      }
    });

    this.vertexBuffer = this.device!.createBuffer({
      size: vertices.length * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();

    this.logger.info(
      `Updated vertex buffer with ${vertices.length / 7} vertices`
    );
  }

  private generateCubeVertices(node: OctreeNode, vertices: number[]): void {
    const pos = node.position;
    const size = node.size;
    const voxel = node.getVoxel(pos)!;
    const color = voxel.color;

    // Define the 8 corners of the cube
    const corners = [
      [pos[0], pos[1], pos[2]],
      [pos[0] + size, pos[1], pos[2]],
      [pos[0], pos[1] + size, pos[2]],
      [pos[0] + size, pos[1] + size, pos[2]],
      [pos[0], pos[1], pos[2] + size],
      [pos[0] + size, pos[1], pos[2] + size],
      [pos[0], pos[1] + size, pos[2] + size],
      [pos[0] + size, pos[1] + size, pos[2] + size],
    ];

    // Define the 6 faces of the cube (2 triangles per face)
    const indices = [
      // Front face
      0, 1, 2, 2, 1, 3,
      // Back face
      4, 6, 5, 5, 6, 7,
      // Top face
      2, 3, 6, 6, 3, 7,
      // Bottom face
      0, 4, 1, 1, 4, 5,
      // Right face
      1, 5, 3, 3, 5, 7,
      // Left face
      0, 2, 4, 4, 2, 6,
    ];

    for (const idx of indices) {
      const corner = corners[idx];
      vertices.push(
        corner[0],
        corner[1],
        corner[2], // position
        color[0],
        color[1],
        color[2],
        color[3] // color
      );
    }
  }

  render(viewMatrix: mat4, projectionMatrix: mat4): void {
    if (!this.device || !this.context || !this.pipeline || !this.vertexBuffer) {
      return;
    }

    // Update frame statistics
    this.frameCount++;
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = performance.now();
    }

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const depthTexture = this.device.createTexture({
      size: {
        width: this.canvas.width,
        height: this.canvas.height,
        depthOrArrayLayers: 1,
      },
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.1, g: 0.2, b: 0.3, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    };

    // Update uniform buffer with new view-projection matrix
    const viewProjectionMatrix = mat4.create();
    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);
    this.device.queue.writeBuffer(
      this.uniformBuffer!,
      0,
      viewProjectionMatrix as Float32Array
    );

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup!);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    const totalVertices = this.vertexBuffer.size / (7 * 4); // 7 floats per vertex (3 for position, 4 for color), 4 bytes per float
    passEncoder.draw(totalVertices, 1, 0, 0);
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
    depthTexture.destroy();

    // Only log render frame every RENDER_LOG_INTERVAL milliseconds
    const currentTime = performance.now();
    if (currentTime - this.lastRenderLogTime >= this.RENDER_LOG_INTERVAL) {
      this.logger.debug("Frame statistics: WebGPU render completed");
      this.lastRenderLogTime = currentTime;
    }
  }

  dispose(): void {
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = null;
    }
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }
    // Clear other WebGPU resources
    this.pipeline = null;
    this.bindGroup = null;
    this.context = null;
    this.device = null;
    this.logger.warn("WebGPU renderer disposed - all resources cleaned up");
  }
}
