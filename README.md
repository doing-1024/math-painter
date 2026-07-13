# math-painter

Math Painter is a lightweight geometry drawing tool designed for fast, keyboard-driven diagram creation. It keeps the interface minimal and Vim-like, while focusing on precise construction, annotation, and clean export for math and geometry problems.

The project is intentionally small: TypeScript, Vite, Canvas 2D, native DOM, a JSON scene graph, and a registry-based shape system. There is no UI framework and no heavy runtime dependency, so the app starts quickly and stays easy to extend.

## Features

- Point, segment, circle, polygon, arc, angle label, tick mark, and text label tools
- Anchor and edge snapping for precise construction
- Keyboard-first controls with left-hand-friendly shortcuts
- Undo/redo command stack
- JSON import/export for editable scenes
- Clean SVG export for publishing diagrams
- Extensible `ShapeDefinition` registry for adding new geometry types
- Plugin system: official plugins one-click installable from the in-app **Plugins** panel (`EXT` button / `` ` `` key); third-party plugins importable by URL

## Links

- [Linux Do](https://linux.do/)
- [Plugin guide (EXTENSIONS.md)](./EXTENSIONS.md)
- [Official plugins repo](https://github.com/doing-1024/math-painter-ext)

## Development

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:5173
```

## Build

```bash
npm run build
npm run preview
```
