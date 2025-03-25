import { Logger } from "../utils/logger";
import { vec3 } from "gl-matrix";

export interface Voxel {
  material: number;
  color: [number, number, number, number];
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

  private getChildIndex(position: vec3): number {
    const halfSize = this.size / 2;
    let index = 0;

    if (position[0] >= this.position[0] + halfSize) index |= 1;
    if (position[1] >= this.position[1] + halfSize) index |= 2;
    if (position[2] >= this.position[2] + halfSize) index |= 4;

    return index;
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
    callback(this);
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
    this.root = new OctreeNode(vec3.fromValues(0, 0, 0), size, 0, maxDepth);
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

  traverse(callback: (node: OctreeNode) => void): void {
    this.root.traverse(callback);
  }

  clear(): void {
    // Create a new root node with the same parameters
    const size = this.root.size;
    const maxDepth = this.root.maxDepth;
    this.root = new OctreeNode(vec3.fromValues(0, 0, 0), size, 0, maxDepth);
    this.logger.info("Octree cleared");
  }
}
