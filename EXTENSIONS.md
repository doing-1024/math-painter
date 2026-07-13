# Extensions

math-painter keeps a deliberately minimal kernel. Everything beyond the core
shapes/tools lives in **plugins**, loaded on demand so the cold start stays
fast. There is no built-in plugin marketplace — instead:

- **Official plugins** are developed here, hosted on Cloudflare Pages, and
  listed in a `plugins.json` index. The in-app **Plugins** panel (`EXT` button
  or the `` ` `` key) fetches that list automatically and installs with one
  click. They live in a separate repo: <https://github.com/doing-1024/math-painter-ext>.
- **Third-party plugins** are imported by URL from anywhere. The app does not
  curate or host them; importing shows a clear warning that third-party code
  runs with full page privileges.

Both kinds are cached in the browser (Cache Storage) and re-activated on the
next launch, so installed plugins work offline.

## The frozen API

A plugin is an ES module whose **default export** is called with the stable
`MathPainter` facade:

```ts
import type { MathPainter } from 'math-painter'; // (types; see below)

export default function activate(mp: MathPainter): void {
  mp.registerShape(arrowShapeDef);
  mp.registerTool(new ArrowTool());
  mp.bindKey('y', 'arrow'); // free left-half key
}
```

`MathPainter` (from `src/core/extension.ts`) is the *only* contract a plugin
depends on:

```ts
export const API_VERSION = 1;

export interface MathPainter {
  readonly apiVersion: number;
  registerShape<T extends Shape>(definition: ShapeDefinition<T>): void;
  registerTool(tool: Tool): void;
  bindKey(key: string, toolId: string): void;
}
```

The core may refactor its internals freely; as long as this surface is
preserved (and `API_VERSION` only bumps on breaking change), published plugins
keep working. A plugin declares the minimum API it needs via `minApi` in its
`mp.config.json`; the loader refuses to install one that needs a newer API.

## Writing a plugin

See <https://github.com/doing-1024/math-painter-ext> for the canonical layout
and a worked `arrow` example. In short:

```
plugins/<name>/
  mp.config.json        # { name, title, description, version, minApi, entry, author }
  src/
    index.ts            # export default function activate(mp: MathPainter)
    <shape>.ts          # a ShapeDefinition
    <tool>.ts           # a Tool
```

- A **shape** implements `ShapeDefinition` — `anchors`, `hit`, `draw`,
  `translate`, `nearest`, `bbox`, `toSVG`, `parse`. The shape *owns* all of its
  behaviour; there is no central `switch` to edit.
- A **tool** implements `Tool` — `pointerDown/Move/Up`, `drawOverlay`, etc. It
  gets an `EditorContext` (`scene`, `selection`, `add`, `replace`, `snap`,
  `promptText`, `promptChoice`, `draw`, `setStatus`…) and routes every point
  pick through `ctx.snap`.
- The entry `mp.config.json` `entry` path is relative to the plugin base, e.g.
  `plugins/arrow/index.js`.

### Types

`math-painter` is not published to npm, so a plugin references the contract
types from the ext repo's `shared/types.d.ts` (a vendored copy of the frozen
`MathPainter`, `ShapeDefinition`, `Tool`, `EditorContext`, …). When the core is
published, switch to `import type { … } from 'math-painter'`.

## Official list & hosting

`plugins.json` at the root of `math-painter-ext` is deployed to Cloudflare
Pages and fetched from `https://ext.math-painter.pages.dev/plugins.json`. The
base URL is stored in `localStorage` under `math-painter:plugin-base`; users
behind a slow network can repoint it to a mirror.

```json
[
  {
    "name": "arrow",
    "title": "Arrow",
    "description": "Directed arrow / vector tool.",
    "version": "1.0.0",
    "minApi": 1,
    "entry": "plugins/arrow/index.js",
    "author": "doing-1024"
  }
]
```
