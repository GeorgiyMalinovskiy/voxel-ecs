import { Component } from "../types";

export class CameraComponent implements Component {
  readonly type = "Camera";

  constructor(public fov: number, public near: number, public far: number) {}
}
