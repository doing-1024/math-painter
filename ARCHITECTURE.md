# Architecture

极简、冷启动快、可扩展的几何绘图内核。当前实现保持最小功能集，但通过三个注册表把“加图形 / 加工具 / 加命令”变成开放扩展点。

## 功能清单（当前实现）

- Canvas 2D 冷启动画布，Vim 风格冷峻方正 UI（工具栏 + 状态行）
- 无限画布：滚轮缩放、空格 / 中键 / Alt 拖拽平移、`V` 模式空白拖拽平移
- 工具：`V` 选择、`P` 点、`L` 线段、`C` 圆、`G` 多边形
- 几何对象生成后显示明确结构点（端点 / 圆心 / 顶点方块）
- 画线 / 圆 / 多边形时自动吸附已有结构点，多边形可吸附起点闭合
- 选择：命中检测、单选 / Shift 多选切换、拖拽移动（含 4px 阈值，避免误记 undo）
- 删除：`X / Delete / Backspace`
- 撤销 / 重做：`U / R` 与 `Ctrl+Z / Ctrl+Y`
- JSON 导出 / 导入：校验、id 防冲突、错误安全处理
- 指针事件清理：`pointercancel / lostpointercapture` 不再卡状态
- 状态行显示工具 / 数量 / 缩放 / 撤销状态

## 分层

```text
main.ts                 组装入口：构建 registry、editor、renderer、input、toolbar
core/                  纯数据与算法（无 DOM 依赖，可单测）
  types.ts             Vec / Style / Shape / Scene
  style.ts             DEFAULT_STYLE
  util.ts              cloneShape
  geometry.ts          距离、点到线段距离、平移、相等
  ids.ts               IdGenerator（含导入后 advance）
  commands.ts          Command / CommandStack / 增删改命令
  shapes/              ShapeDefinition 注册表 + 各图形定义
io/                    scene-file.ts 解析 / 校验 / 序列化
render/                renderer.ts CanvasRenderer（实现 Overlay）
app/                   editor / viewport / selection / input / toolbar
tools/                 Tool 接口 / ToolRegistry / 各工具实现
```

依赖方向：`tools` 与 `render` 依赖 `core`；`app` 依赖 `core / tools / render / io`；`core` 不反向依赖上层。

## 核心接口

### ShapeDefinition（图形注册）

```ts
interface ShapeDefinition<T extends Shape = Shape> {
  type: T['type'];
  anchors(shape: T): Vec[];
  hit(shape: T, world: Vec, tolerance: number): boolean;
  draw(ctx: CanvasRenderingContext2D, shape: T, opts: { scale: number; active: boolean }): void;
}
registerShape(def); // 注册即生效，渲染 / 命中 / 吸附自动支持
```

### Tool（工具注册）

```ts
interface Tool {
  id: string;
  cursor?: string;
  activate?(ctx): void;
  deactivate?(ctx): void;
  pointerDown(ctx, e): void;
  pointerMove?(ctx, e): void;
  pointerUp?(ctx, e): void;
  pointerCancel?(ctx): void;
  dblClick?(ctx, e): void;
  cancel?(ctx): void;
  drawOverlay?(overlay: Overlay): void;
}
```

工具自身持有临时状态（预览点、拖拽状态），与全局状态解耦。

### EditorContext（工具可用的编辑器 API）

工具通过 `EditorContext` 读写场景、选择、视口、命令栈、吸附与重绘，不直接接触 DOM。

### Command / CommandStack

所有会修改场景的操作都封装为 `Command`，进入 `CommandStack` 后天然支持 undo/redo。

### Overlay（预览绘制）

工具在 `drawOverlay` 中通过 `Overlay` 绘制虚线预览、锚点、吸附标记，渲染细节由 `CanvasRenderer` 统一处理。

## 扩展方式

### 新增图形类型

1. 在 `core/types.ts` 增加 `MyShape` 与联合类型
2. 在 `core/shapes/` 新建 `my-shape.ts` 调用 `registerShape`
3. 在 `core/shapes/index.ts` 引入该模块

渲染、命中、吸附自动生效，无需改动 editor / renderer。

### 新增工具

1. 新建 `tools/my-tool.ts` 实现 `Tool` 接口
2. 在 `tools/index.ts` 的 `registerCoreTools` 注册

工具栏会从 `ToolRegistry` 自动列出，快捷键在 `app/input.ts` 按需映射。

### 新增动作 / 导出格式

- 动作：在 `Editor` 增加方法，并在 `app/toolbar.ts` 或快捷键中绑定
- 导入 / 导出：扩展 `io/scene-file.ts` 的解析与序列化

## 运行

```text
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite 生产构建
```
