import { Component } from "../types";
import { vec3 } from "gl-matrix";

export class CameraComponent implements Component {
  readonly type = "Camera";

  // Movement settings
  public moveSpeed: number = 15.0;
  public rotationSpeed: number = 0.002;
  public mouseSensitivity: number = 0.003;

  // Camera state
  public targetPosition: vec3;
  public isMouseLocked: boolean = false;

  constructor(
    public fov: number = 45,
    public near: number = 0.1,
    public far: number = 100.0,
    public smoothing: number = 0.15,
    initialPosition?: vec3,
    initialRotation?: vec3
  ) {
    this.targetPosition = initialPosition
      ? vec3.clone(initialPosition)
      : vec3.create();
  }
}
