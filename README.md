# Voxel ECS Engine

A robust sparse voxel octree game engine using TypeScript, WebAssembly, and WebGPU.

## Features

- Entity Component System (ECS) architecture
- Sparse Voxel Octree for efficient voxel storage
- WebGPU rendering pipeline
- WebAssembly-powered physics and collision detection
- Extensive logging system
- Sample scene demonstration

## Prerequisites

- Node.js 16+
- Rust and cargo (for WebAssembly compilation)
- A browser with WebGPU support (Chrome Canary or Edge Canary with appropriate flags)

## Installation

1. Install Node.js dependencies:

```bash
npm install
```

2. Build the WebAssembly module:

```bash
npm run build:wasm
```

3. Build the TypeScript code:

```bash
npm run build
```

## Development

Start the development server:

```bash
npm run dev
```

This will start a development server at http://localhost:9000.

## Project Structure

- `/src/core/` - Core engine components
  - `/ecs/` - Entity Component System implementation
  - `/voxel/` - Voxel and Octree implementation
  - `/renderer/` - WebGPU renderer
  - `/utils/` - Utility functions and logging
- `/src/examples/` - Example scenes and demos
- `/wasm/` - WebAssembly module for physics and collision detection
- `/public/` - Static assets and HTML files

## Usage

The sample scene demonstrates basic usage of the engine. Press 'L' to dump the scene logs to the console.

### Creating a New Scene

```typescript
import { World } from "../core/ecs/world";
import { VoxelOctree } from "../core/voxel/octree";
import { WebGPURenderer } from "../core/renderer/webgpu";

class MyScene {
  constructor(canvas: HTMLCanvasElement) {
    const world = new World();
    const octree = new VoxelOctree(32, 5);
    const renderer = new WebGPURenderer(canvas);

    // Add components and systems
    // Set up your scene...
  }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the LICENSE file for details
