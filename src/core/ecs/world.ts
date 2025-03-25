import { Logger } from "../utils/logger";
import {
  Entity,
  Component,
  ComponentType,
  System,
  World as IWorld,
} from "./types";

export class World implements IWorld {
  private nextEntityId: Entity = 1;
  private entities: Set<Entity> = new Set();
  private components: Map<string, Map<Entity, Component>> = new Map();
  private systems: System[] = [];
  private logger: Logger;

  constructor() {
    this.logger = new Logger("World");
  }

  createEntity(): Entity {
    const entity = this.nextEntityId++;
    this.entities.add(entity);
    this.logger.debug(`Created entity ${entity}`);
    return entity;
  }

  destroyEntity(entity: Entity): void {
    this.entities.delete(entity);
    for (const components of this.components.values()) {
      components.delete(entity);
    }
    this.logger.debug(`Destroyed entity ${entity}`);
  }

  addComponent<T extends Component>(entity: Entity, component: T): void {
    const componentName = component.type;
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map());
    }
    this.components.get(componentName)!.set(entity, component);
    this.logger.debug(`Added component ${componentName} to entity ${entity}`);
  }

  getComponent<T extends Component>(
    entity: Entity,
    componentType: ComponentType<T>
  ): T | undefined {
    const componentName = new componentType().type;
    return this.components.get(componentName)?.get(entity) as T | undefined;
  }

  removeComponent<T extends Component>(
    entity: Entity,
    componentType: ComponentType<T>
  ): void {
    const componentName = new componentType().type;
    this.components.get(componentName)?.delete(entity);
    this.logger.debug(
      `Removed component ${componentName} from entity ${entity}`
    );
  }

  getEntitiesWith(...componentTypes: ComponentType<Component>[]): Entity[] {
    const componentNames = componentTypes.map((type) => new type().type);
    const entities: Entity[] = [];

    for (const entity of this.entities) {
      if (
        componentNames.every((name) => this.components.get(name)?.has(entity))
      ) {
        entities.push(entity);
      }
    }

    return entities;
  }

  addSystem(system: System): void {
    this.systems.push(system);
    this.logger.debug(`Added system ${system.constructor.name}`);
  }

  update(deltaTime: number): void {
    for (const system of this.systems) {
      system.update(this, deltaTime);
    }
  }
}
