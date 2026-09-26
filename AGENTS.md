# AGENTS.md — Autonomous Agent Directives for blender-mcp

This document defines the operational boundaries, mathematical specifications, and architectural constraints governing any autonomous AI agent (Claude, Codex, Antigravity, Cursor) operating on this repository.

---

## 1. Project Mission & Domain Invariants

- **Domain Scope**: Model Context Protocol (MCP) server connecting AI clients to Blender 3.6 to 5.2+ LTS for generating stylized 2:1 dimetric isometric 2D assets, spritesheets, and collision manifests.
- **Strict Non-Goals**:
  - No 3D runtime mesh exports (GLTF, FBX, OBJ). Blender serves solely as an offline parametric modeling and 2D rendering engine.
  - No photorealistic ray-tracing (Cycles). All rendering uses EEVEE Next or EEVEE Classic NPR Cel-Shading.
  - No conical or perspective cameras. Projection is exclusively orthographic dimetric 2:1.
- **Mathematical Invariants**:
  - Dimetric slope: exactly 2 horizontal pixels per 1 vertical pixel ($\arctan(0.5) \approx 26.565^\circ$).
  - Camera Euler rotation: $X = 60.0^\circ, Y = 0.0^\circ, Z = 45.0^\circ$ (yaw increments: multiples of $45^\circ$ or $90^\circ$).
  - Orthographic scale: $\text{ortho\_scale} = \sqrt{2} \cdot \text{unit\_size}$.
  - Dimetric resolution ratio: $\text{tile\_height} = \lfloor \text{tile\_width} / 2 \rfloor$.

---

## 2. Layer Boundaries & Clean Architecture

Code must maintain strict architectural separation:

- `server/domain/`: Pure business logic, 2:1 math, entities, value objects, and contracts. ZERO external dependencies.
- `server/infrastructure/`: Adapters, WebSocket client (`WsBlenderClient`), safe path sanitizer, multi-engine exporters (`IAssetExportAdapter`), process daemon management, and multi-source config (`AppConfig`).
- `server/presentation/`: MCP server transport (stdio), Zod validation schemas, and declarative tool handlers.
- `addon/`: Native Blender extension/addon running an asyncio WebSocket server (`127.0.0.1`), toon shaders, and procedural engines.
- `tests/`: Automated unit, integration, and E2E Blender test suites.
- `scripts/`: Platform-agnostic execution scripts.
- `examples/`: Standalone interactive web demonstrations and engine integrations.

---

## 3. Non-Negotiable Coding Rules

1. **Zero Comments in Source Code**:
   - Absolutely NO comments (`//`, `/* */`, `#`, or decorative docstrings) inside production or test code across all languages (TypeScript, JavaScript, Python, JSON, TOML).
   - Code must be entirely self-documenting via surgical identifier naming, small functions, and exhaustive type definitions.
2. **Strict TypeScript**:
   - `tsconfig.json` runs in strict mode (`strict: true`). The use of `any` is strictly prohibited.
   - Enforce Generics, Utility Types, Readonly structures, and Type Guards.
3. **Cognitive Complexity & Immutability**:
   - Maximum nesting depth: 2 levels.
   - Mandatory early returns (guard clauses) for validations and communication failures.
   - Value Objects must be immutable and sealed via `Object.freeze`.
4. **Dynamic Path Resolution**:
   - NEVER hardcode machine or user paths (`C:\Users\...`, `/home/...`).
   - Blender binary resolution: evaluate `process.env['BLENDER_PATH']` first, then dynamic cross-platform auto-detection, then system `PATH`.
   - File paths must be resolved via `path.resolve` or module URLs (`import.meta.url`).

---

## 4. Cyber-Security & OWASP Defenses

1. **Path Traversal Defense**: All input paths, filenames, and output directories MUST pass through `SafePathSanitizer`. Sequences with `..`, null bytes (`\0`), or escaped roots trigger an immediate `SecurityError`.
2. **Network Isolation**: The Blender WebSocket server listens exclusively on loopback `127.0.0.1` with optional shared-secret token authentication.
3. **Timeout Protection**: All RPC socket operations enforce an explicit timeout (default 15,000ms) to prevent hanging AI agent tool calls.

---

## 5. Canonical Package Manager & Verification

- **Package Manager**: **`pnpm`** (v10+) is the authoritative package manager.
- **Verification Commands**:
  - Build TypeScript: `pnpm run build`
  - Unit Tests: `pnpm run test:unit`
  - Full Test Suite: `pnpm test`
  - Real Blender Integration: `pnpm run test:blender`
  - Clean Build: `pnpm run clean && pnpm run build`
- **Zero-Comments Audit**:
  Agents must verify 0 comments across `server/`, `addon/`, `scripts/`, and `tests/` before committing.

---

## 6. Versioning & Git Protocol

- Current SemVer: **`0.9.0`**. Synchronized across `package.json`, `addon/blender_manifest.toml`, and `addon/__init__.py`.
- Patch increments (`0.9.x`): bug fixes, refactoring, test improvements.
- Minor increments (`0.x.0`): new MCP tools, new engine export adapters, or geometry archetypes.
- Major increments (`1.0.0`+): prohibited without explicit user instruction.
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`.
