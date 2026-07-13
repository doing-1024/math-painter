# TODO

## Now
- [x] Initialize git repository
- [x] Create minimal Vite + TypeScript project
- [x] Build cold-start canvas shell
- [x] Implement square, Vim-like interface
- [x] Add viewport pan and zoom
- [x] Add point, segment, circle, polygon tools
- [x] Add selection, drag move, and delete
- [x] Add undo and redo command stack
- [x] Add JSON import and export
- [x] Add keyboard shortcuts and command/status line
- [x] Run local verification
- [x] Debug segment tool creating preview points instead of lines
- [x] Render persistent anchor points for generated geometry
- [x] Add automatic point snapping while drawing segments, circles, and polygons
- [x] Fix polygon closure snapping to the starting preview point
- [x] Allow select tool to pan the viewport from empty canvas drag
- [x] Fix import id collision by advancing id sequence
- [x] Validate JSON import and report import errors safely
- [x] Add move threshold before recording drag undo commands
- [x] Handle pointer cancel/lost capture cleanup
- [x] Remove Ctrl/Cmd+R and Ctrl/Cmd+U shortcut conflicts
- [x] Refactor into layered architecture (core/render/app/tools/io)
- [x] Introduce ShapeDefinition registry for extensible shape types
- [x] Introduce Tool + ToolRegistry for self-contained tools
- [x] Document architecture and feature list in ARCHITECTURE.md

## 9. 解耦重构（代码审查，进行中）
> 审查结论：工具注册达标，但图形的 anchors/hit/draw 之外的所有行为（平移 / 最近点 / 包围盒 / SVG导出 / JSON解析 / 级联删除 / 直角处理）仍集中在 core/io/app 的 `switch(shape.type)`，违反“图形自己实现并向图形表注册”的架构承诺。

- [x] 9.1 新增 `core/constants.ts` 统一魔法数（命中8 / 锚点吸附10 / 边吸附14 / 角弧半径26 / 直角方块16 / 刻度长10·间距5 / 字号13 / 采样24 / 最大杠数8）
- [x] 9.2 新增 `core/parse.ts` 抽出 `isRecord/isFiniteNumber/parseVec/parseStyle`（core 与 io 共用，避免 core→io 反向依赖）
- [x] 9.3 扩展 `ShapeDefinition<T>` 接口：`translate/nearest/bbox/toSVG/parse` 必选，`edgeAt?/cascadeIds?` 可选；registry 提供 `translateShape/shapeEdgeAt/nearestOnShape` 委托
- [x] 9.4 八种图形各自实现 `translate/nearest/bbox/toSVG/parse`（polygon 加 `edgeAt`，angleLabel 加 `cascadeIds`）
- [x] 9.5 删除 `angle.ts` 死代码 `rayFromShape/commonVertex/intersectSegments` 与重复常量；`snapToEdge` 改走 `registry.nearest`
- [x] 9.6 `svg.ts` 删除 `shapePoints/shapeSVG` 两个 switch，改走 `registry.toSVG/bbox`
- [x] 9.7 `scene-file.ts` 的 `parseShape` 改走 registry（保留 `measure`→`label` 旧兼容与 `hidden` 处理）
- [x] 9.8 `editor.deleteShapes` 级联删除改走 `registry.cascadeIds`（不再 switch angleLabel）
- [x] 9.9 修复 B1：arc/angleLabel/tick 现在可拖动（实现各自的 `translate`）
- [x] 9.10 `geometry.ts` 删除 `translateShape/shapeEdgeAt`（迁至 registry），`projectOnSegment` 迁入 geometry
- [x] 9.11 `select.ts`/`tick.ts` 改从 registry 导入 `translateShape/shapeEdgeAt`
- [x] 9.12 修复 B2：`parseScene` 原型污染 → `Object.create(null)` + 拒绝 `__proto__/constructor/prototype`
- [x] 9.13 统一直角方块尺寸（画布16 ↔ SVG14 → 统一16）
- [x] 9.14 E1：导入错误返回首个具体校验原因（抛出 `ParseError(id, reason)`）
- [x] 9.15 B3：`promptChoice` 打开时任意未匹配键也关闭选择框
- [x] 9.16 同步更新单测（geometry/angle/scene-file/svg）+ typecheck/test/build 全绿

## Roadmap (prioritized)

### 1. 质量与稳定性（基础，先做）
- [x] 单元测试：geometry / commands / io 校验 / snapping（vitest，纯逻辑无需 DOM）
- [x] 错误边界：工具与渲染异常隔离，单点报错不冻结画布（InputController.safe + Editor.draw 逐图形 try/catch）
- [x] 坐标防护：NaN / 超大坐标 / 除零（finiteVec、MIN_RADIUS 半径下限）兜底
- [x] 全量 tsc --noEmit 作为 typecheck 脚本（pre-commit）

### 2. 绘图能力（用扩展架构验证，低成本）
- [ ] 吸附控制：开关 + 吸附半径调节（细化原 snapping controls）
- [ ] 新图形：矩形、椭圆（注册 ShapeDefinition，验证扩展性）
- [x] 圆弧工具：选圆心 + 两点，选定圆心与第一点后第二点自动约束在圆上（验证 Shape/Tool 扩展）
- [x] 点标签：画点时弹入文本框，标记文字随点渲染（PointShape.label + 轻量 promptText）
- [x] 标角工具（N）：三点法（点顶点→点第一边上的点→点第二边上的点），弹入文本，渲染夹角弧+标签+实时预览（AngleLabelShape + AngleLabelTool）
- [ ] 多段线工具（复用 Tool 接口）
- [x] 文本标签工具：M 工具即纯标签（label 形状），点位置→输入任意文本，轻量纯 Canvas

### 2b. 出题级短期四件套（已完成，内核保持精简）
- [x] 标注记号：直角记号（Q 工具，rightAngle ShapeDefinition）+ 等长记号（T 工具，tick，多次点击 1→2→3 循环）
- [x] M 工具改为纯标签（label 形状）：点位置→手输文本，不再测绘；删除 measure 形状与面积/周长几何辅助（intersectPolygons / polygonArea / circleArea / fmt），内核更精简
- [x] 隐藏辅助线：BaseShape.hidden 标志；屏幕上淡显（alpha 0.22），选中后按 H 切换
- [x] 干净 SVG 导出：纯函数 sceneToSVG（无网格/UI，白底深色墨，自动裁边，省略 hidden），工具栏 S 按钮 + exportSVG()
- [x] 全量单测覆盖新增类型解析、hidden 往返、SVG 输出、几何辅助（regularPolygon / midpoint / pointInPolygon / shapeEdgeAt）
- [x] 正多边形：G 弹出子选项（1 正多边形 / 2 普通多边形）；正多边形先定第一条边（两点），再输入边数 n，按规则 n 边形生成（regularPolygon 纯函数 + 单测）
- [x] 统一吸附（抽象选点）：core/snap.pickPoint（锚点优先 10px + 边回退 14px），所有选点工具（点/线/圆/多边形/弧/角/直角/测量/等长）及拖动均经 ctx.snap；新增 exclude 防自吸附；单测覆盖锚点/边/自由/排除

### 3. 编辑效率
- [x] 框选（rubber-band 多选，复用 Selection + Tool；V 工具空画布拖拽=框选，Ctrl/Shift 拖拽=叠加；Alt/空格/中键仍可平移）
- [x] Ctrl/Shift+点击 多选/切换（PointerInput.ctrl + Selection.toggle）
- [ ] 复制 / 粘贴（内部剪贴板，走 Command）
- [ ] 极简样式微调：颜色 / 线宽（复用 Tool 机制，非重 Inspector）
- [ ] 对齐 / 等距辅助（吸附增强）

### 4. 测量与几何分析
- [ ] 测量覆盖层：距离 / 角度 / 半径（原 measurement overlay）
- [ ] 坐标 / 尺寸 HUD（状态行或角落读数）
- [ ] 多边形面积读数

### 5. 约束与依赖（较大，后置）
- [ ] 约束模型：点依附、等长、垂直（原 constraint/dependency model）
- [ ] 轻量求解器

### 6. 极客交互
- [ ] Vim 式命令面板（`:` 触发，命令即字符串，暴露 Editor API）
- [ ] 宏 / 脚本（调用 Editor API 录制回放）
- [ ] 状态行增强：实时坐标、选中数、模式提示

### 7. 持久化与输出
- [x] 自动保存（localStorage，debounce 400ms；scene + viewport 一并持久化，启动恢复；beforeunload 兜底写盘）
- [ ] 导出 PNG / SVG
- [ ] 云同步 / 协作（最重，最后考虑）

### 8. 扩展生态
- [ ] 扩展注册 API 文档（原 extension docs，已部分在 ARCHITECTURE.md）
- [ ] 用户插件入口：动态加载外部 Tool / Shape 模块
- [ ] 示例插件（如网格吸附、刻度尺）
