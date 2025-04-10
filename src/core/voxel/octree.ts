import { Logger } from "../utils/logger";
import { vec3 } from "gl-matrix";

export interface Voxel {
  material: number;
  color: [number, number, number, number];
  active: boolean; // Whether this voxel should be considered for rendering/physics
}

export class OctreeNode {
  private static readonly CHILD_COUNT = 8;
  private children: (OctreeNode | null)[] | null = null;
  private voxel: Voxel | null = null;
  private logger: Logger;

  constructor(
    public readonly position: vec3,
    public readonly size: number,
    public readonly depth: number,
    public readonly maxDepth: number
  ) {
    this.logger = new Logger(`OctreeNode-${depth}`);
  }

  getVoxel(position: vec3): Voxel | null {
    // Check if position is within this node's bounds
    if (!this.containsPoint(position)) {
      return null;
    }

    // If this is a leaf node or we have a voxel, return the voxel
    if (this.depth === this.maxDepth || this.voxel !== null) {
      return this.voxel;
    }

    // If we have children, delegate to the appropriate child
    if (this.children) {
      const childIndex = this.getChildIndexForPosition(position);
      return this.children[childIndex]?.getVoxel(position) ?? null;
    }

    return null;
  }

  // Check if a voxel has any exposed faces (adjacent to empty space)
  hasExposedFaces(position: vec3): boolean {
    const offsets = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    for (const [dx, dy, dz] of offsets) {
      const neighborPos = vec3.fromValues(
        position[0] + dx,
        position[1] + dy,
        position[2] + dz
      );
      const neighbor = this.getVoxel(neighborPos);
      if (!neighbor) {
        return true; // Found an empty neighbor, so this voxel has an exposed face
      }
    }

    return false; // No exposed faces found
  }

  setVoxel(position: vec3, voxel: Voxel | null): void {
    // Check if position is within this node's bounds
    if (!this.containsPoint(position)) {
      return;
    }

    // If this is a leaf node, set the voxel directly
    if (this.depth === this.maxDepth) {
      this.voxel = voxel;
      return;
    }

    // If we don't have children and we're setting a voxel, subdivide
    if (!this.children && voxel !== null) {
      this.subdivide();
    }

    // If we have children, delegate to the appropriate child
    if (this.children) {
      const childIndex = this.getChildIndexForPosition(position);
      this.children[childIndex]?.setVoxel(position, voxel);
    } else {
      // If we're clearing a voxel (voxel === null) and have no children, just set it
      this.voxel = voxel;
    }
  }

  // Update the active state of a voxel
  updateVoxelActive(position: vec3, active: boolean): void {
    const voxel = this.getVoxel(position);
    if (voxel) {
      voxel.active = active;
    }
  }

  private subdivide(): void {
    this.children = new Array(OctreeNode.CHILD_COUNT).fill(null);
    const halfSize = this.size / 2;

    for (let i = 0; i < OctreeNode.CHILD_COUNT; i++) {
      const childPos = vec3.create();
      childPos[0] = this.position[0] + (i & 1 ? halfSize : 0);
      childPos[1] = this.position[1] + (i & 2 ? halfSize : 0);
      childPos[2] = this.position[2] + (i & 4 ? halfSize : 0);

      this.children[i] = new OctreeNode(
        childPos,
        halfSize,
        this.depth + 1,
        this.maxDepth
      );
    }
    this.logger.debug(`Subdivided node at depth ${this.depth}`);
  }

  private getChildIndexForPosition(position: vec3): number {
    const halfSize = this.size / 2;
    let index = 0;

    if (position[0] >= this.position[0] + halfSize) index |= 1;
    if (position[1] >= this.position[1] + halfSize) index |= 2;
    if (position[2] >= this.position[2] + halfSize) index |= 4;

    return index;
  }

  private containsPoint(position: vec3): boolean {
    const halfSize = this.size / 2;
    return (
      position[0] >= this.position[0] &&
      position[0] < this.position[0] + this.size &&
      position[1] >= this.position[1] &&
      position[1] < this.position[1] + this.size &&
      position[2] >= this.position[2] &&
      position[2] < this.position[2] + this.size
    );
  }

  traverse(callback: (node: OctreeNode) => void): void {
    // Only process this node if:
    // 1. It's a leaf node (at max depth) OR
    // 2. It has a voxel but no children (partially filled space)
    if (
      this.depth === this.maxDepth ||
      (this.voxel !== null && !this.children)
    ) {
      callback(this);
    }

    // Continue traversing children if they exist
    if (this.children) {
      for (const child of this.children) {
        if (child) {
          child.traverse(callback);
        }
      }
    }
  }
}

export class VoxelOctree {
  private root: OctreeNode;
  private logger: Logger;

  constructor(size: number, maxDepth: number) {
    this.root = new OctreeNode(
      vec3.fromValues(-size / 2, -size / 2, -size / 2),
      size,
      0,
      maxDepth
    );
    this.logger = new Logger("VoxelOctree");
    this.logger.info(
      `Created VoxelOctree with size ${size} and max depth ${maxDepth}`
    );
  }

  getSize(): number {
    return this.root.size;
  }

  getMaxDepth(): number {
    return this.root.maxDepth;
  }

  setVoxel(position: vec3, voxel: Voxel | null): void {
    this.root.setVoxel(position, voxel);
    this.logger.debug(`Set voxel at position ${vec3.str(position)}`);
  }

  getVoxel(position: vec3): Voxel | null {
    return this.root.getVoxel(position);
  }

  // Update visibility of all voxels based on exposure
  updateActiveStates(): void {
    let activeCount = 0;
    let totalCount = 0;

    this.traverse((node: OctreeNode) => {
      totalCount++;
      const voxel = node.getVoxel(node.position);
      if (voxel) {
        const wasActive = voxel.active;
        voxel.active = node.hasExposedFaces(node.position);
        if (voxel.active) {
          activeCount++;
        }
        if (wasActive !== voxel.active) {
          this.logger.debug(
            `Voxel at ${vec3.str(
              node.position
            )} active state changed from ${wasActive} to ${voxel.active}`
          );
        }
      }
    });

    this.logger.info(
      `Updated voxel active states: ${activeCount} active out of ${totalCount} total voxels`
    );
  }

  traverse(callback: (node: OctreeNode) => void): void {
    this.root.traverse(callback);
  }

  clear(): void {
    // Create a new root node with the same parameters
    const size = this.root.size;
    const maxDepth = this.root.maxDepth;
    this.root = new OctreeNode(
      vec3.fromValues(-size / 2, -size / 2, -size / 2),
      size,
      0,
      maxDepth
    );
    this.logger.info("Octree cleared");
  }

  getVertices(): Float32Array {
    const vertices: number[] = [];

    this.traverse((node: OctreeNode) => {
      const voxel = node.getVoxel(node.position);
      if (voxel && voxel.active) {
        const size = node.size;
        const [x, y, z] = node.position;

        // Check each face's visibility
        const faces = [
          {
            // Front face (-Z)
            visible: !this.getVoxel(vec3.fromValues(x, y, z - 1)),
            vertices: [
              [x, y, z],
              [x + size, y, z],
              [x + size, y + size, z],
              [x, y + size, z],
            ],
          },
          {
            // Back face (+Z)
            visible: !this.getVoxel(vec3.fromValues(x, y, z + size)),
            vertices: [
              [x + size, y, z + size],
              [x, y, z + size],
              [x, y + size, z + size],
              [x + size, y + size, z + size],
            ],
          },
          {
            // Top face (+Y)
            visible: !this.getVoxel(vec3.fromValues(x, y + size, z)),
            vertices: [
              [x, y + size, z],
              [x + size, y + size, z],
              [x + size, y + size, z + size],
              [x, y + size, z + size],
            ],
          },
          {
            // Bottom face (-Y)
            visible: !this.getVoxel(vec3.fromValues(x, y - 1, z)),
            vertices: [
              [x, y, z + size],
              [x + size, y, z + size],
              [x + size, y, z],
              [x, y, z],
            ],
          },
          {
            // Right face (+X)
            visible: !this.getVoxel(vec3.fromValues(x + size, y, z)),
            vertices: [
              [x + size, y, z],
              [x + size, y, z + size],
              [x + size, y + size, z + size],
              [x + size, y + size, z],
            ],
          },
          {
            // Left face (-X)
            visible: !this.getVoxel(vec3.fromValues(x - 1, y, z)),
            vertices: [
              [x, y, z + size],
              [x, y, z],
              [x, y + size, z],
              [x, y + size, z + size],
            ],
          },
        ];

        // Add vertices for visible faces only
        for (const face of faces) {
          if (face.visible) {
            // First triangle
            vertices.push(
              ...face.vertices[0],
              ...voxel.color,
              ...face.vertices[1],
              ...voxel.color,
              ...face.vertices[2],
              ...voxel.color
            );
            // Second triangle
            vertices.push(
              ...face.vertices[0],
              ...voxel.color,
              ...face.vertices[2],
              ...voxel.color,
              ...face.vertices[3],
              ...voxel.color
            );
          }
        }
      }
    });

    return new Float32Array(vertices);
  }
}
