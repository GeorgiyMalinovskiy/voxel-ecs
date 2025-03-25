export type Entity = number;
export type ComponentType<T> = new (...args: any[]) => T;

export interface Component {
  readonly type: string;
}

export interface System {
  update(world: World, deltaTime: number): void;
}

export interface World {
  createEntity(): Entity;
  destroyEntity(entity: Entity): void;
  addComponent<T extends Component>(entity: Entity, component: T): void;
  getComponent<T extends Component>(
    entity: Entity,
    componentType: ComponentType<T>
  ): T | undefined;
  removeComponent<T extends Component>(
    entity: Entity,
    componentType: ComponentType<T>
  ): void;
  getEntitiesWith(...componentTypes: ComponentType<Component>[]): Entity[];
  addSystem(system: System): void;
  update(deltaTime: number): void;
}
