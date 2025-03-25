import { vec3 } from "gl-matrix";
import { Component } from "../types";

export class TransformComponent implements Component {
  readonly type = "Transform";

  constructor(
    public position: vec3,
    public rotation: vec3,
    public scale: vec3 = vec3.fromValues(1, 1, 1)
  ) {}
}
