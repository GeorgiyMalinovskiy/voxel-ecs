import { World } from "./world";

export interface System {
  update(world: World, deltaTime: number): void;
}
