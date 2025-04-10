import { Component } from "../types";
import { VoxelOctree } from "../../voxel/octree";
import { vec3 } from "gl-matrix";

export class VoxelComponent implements Component {
  readonly type = "Voxel";
  private octree: VoxelOctree;

  constructor(
    public readonly size: number,
    public readonly maxDepth: number,
    public readonly position: vec3 = vec3.create(),
    public readonly scale: vec3 = vec3.fromValues(1, 1, 1)
  ) {
    this.octree = new VoxelOctree(size, maxDepth);
  }

  getOctree(): VoxelOctree {
    return this.octree;
  }

  // Helper method to transform a world position to local octree space
  worldToLocal(worldPos: vec3): vec3 {
    const local = vec3.create();
    vec3.sub(local, worldPos, this.position);
    vec3.div(local, local, this.scale);
    return local;
  }

  // Helper method to transform a local position to world space
  localToWorld(localPos: vec3): vec3 {
    const world = vec3.create();
    vec3.mul(world, localPos, this.scale);
    vec3.add(world, world, this.position);
    return world;
  }
}
