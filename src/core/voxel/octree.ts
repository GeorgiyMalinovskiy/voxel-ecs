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

  setVoxel(position: vec3, voxel: Voxel): void {
    if (this.depth === this.maxDepth) {
      this.voxel = voxel;
      this.logger.debug(`Set voxel at position ${vec3.str(position)}`);
      return;
    }

    const childIndex = this.getChildIndex(position);
    if (!this.children) {
      this.subdivide();
    }

    const child = this.children![childIndex];
    if (child) {
      child.setVoxel(position, voxel);
    }
  }

  getVoxel(position: vec3): Voxel | null {
    if (this.depth === this.maxDepth) {
      return this.voxel;
    }

    const childIndex = this.getChildIndex(position);
    if (!this.children || !this.children[childIndex]) {
      return null;
    }

    return this.children[childIndex]!.getVoxel(position);
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

  setVoxel(position: vec3, voxel: Voxel): void {
    this.root.setVoxel(position, voxel);
  }

  getVoxel(position: vec3): Voxel | null {
    return this.root.getVoxel(position);
  }

  traverse(callback: (node: OctreeNode) => void): void {
    this.root.traverse(callback);
  }
}
