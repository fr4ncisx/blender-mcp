# Contributing to blender-iso-mcp

Thank you for your interest in contributing to **`blender-iso-mcp`**! This project is an enterprise-grade MCP server connecting AI clients to Blender 3.6 to 5.2+ LTS for 2:1 dimetric game development.

To ensure consistency, security, and mathematical integrity across the codebase, all contributors must adhere to the engineering guidelines outlined below.

---

## 1. Domain & Mathematical Standards

1. **Exact 2:1 Dimetric Projection**:
   - The projection angle is strictly $\arctan(0.5) \approx 26.565^\circ$.
   - The orthographic camera rotation in Euler degrees is strictly $(60.0^\circ, 0.0^\circ, 45.0^\circ)$ with cardinal yaw increments of $45^\circ$ or $90^\circ$.
   - Scale factor is $\text{ortho\_scale} = \sqrt{2} \cdot \text{unit\_size}$.
   - Tile dimensions enforce: $\text{height} = \lfloor \text{width} / 2 \rfloor$.
2. **Non-Photorealistic Rendering (NPR)**:
   - The system is built for Cel-Shading, Toon shaders, Palette quantization, and 2D render passes.
   - Photorealistic ray-tracing (Cycles) and 3D runtime mesh exports (GLTF/FBX) are strictly outside project scope.

---

## 2. Code Quality & Architecture

1. **Clean Architecture**:
   - `server/domain/`: Pure business logic, mathematics, entities, and value objects. Zero external dependencies.
   - `server/infrastructure/`: Adapters, WebSocket client, headless process management, safe path sanitization, exporters, and multi-source config.
   - `server/presentation/`: MCP server transport, Zod schemas, and declarative tool handlers.
2. **TypeScript Strict Mode**:
   - Strict mode is enabled (`strict: true`). The use of `any` is strictly prohibited. Use Generics, Utility Types, and Type Guards.
3. **Zero Comments Rule**:
   - Production and test code (TypeScript, JavaScript, Python, JSON, TOML) must contain **zero comments** (`//`, `/* */`, `#`, or decorative docstrings).
   - Code must be self-documenting through precise identifier naming, small functions, and exhaustive type contracts.
4. **Cognitive Complexity**:
   - Maximum nesting depth of 2 levels.
   - Mandatory guard clauses and early returns for error handling.
   - Immutability enforced using `Object.freeze`.

---

## 3. Security (OWASP Top 10)

1. **Path Traversal Defense**: All input paths, filenames, and output directories must be validated through `SafePathSanitizer`. Sequences like `..`, null-byte injections (`\0`), and absolute path escapes are strictly rejected.
2. **Network Isolation**: WebSocket communication binds exclusively to the loopback interface (`127.0.0.1`).
3. **Timeouts**: All RPC operations enforce explicit timeouts (default 15,000ms) to prevent blocking MCP clients.

---

## 4. Development Workflow

### Prerequisites
- Node.js `>=20.0.0`
- pnpm `>=10.0.0` (preferred) or npm
- Blender `3.6 LTS` to `5.2+ LTS`

### Setup and Verification Commands

```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm run build

# Run unit test suite
pnpm run test:unit

# Run full test suite with Blender integration
pnpm test
```

---

## 5. Pull Request Checklist

Before submitting a Pull Request, verify:
- [ ] `pnpm run clean && pnpm run build` succeeds with exit code 0.
- [ ] `pnpm run test:unit` passes 100%.
- [ ] Code contains zero comments across all languages.
- [ ] No hardcoded machine paths (`C:\Users\...`, `/home/...`).
- [ ] SemVer is respected: patch for fixes, minor for new tools/exporters.
