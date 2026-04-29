# Figma 设计稿渲染工具 — 原始实施计划

> 本文档为项目立项时的原始计划存档,并标注当前已实现/未实现状态。
>
> 状态图例:**[x]** 已完成 · **[~]** 部分完成 · **[ ]** 未开始

## Context

仓库 `figma-render` 当前为空(branch `claude/figma-renderer-tool-CZPLC`,无任何提交)。目标是从零搭建一个 **Figma 设计稿渲染工具**:输入是 Figma 文件(REST API 拉取或本地导出 JSON 任意一种),输出是浏览器中可交互、近似所见即所得的 HTML/CSS 预览。需求要求 **全量覆盖** Figma 节点类型(Frame/Group/Vector/Text/Component/Instance/Boolean Op/Effects/Constraints/Auto Layout 等)。

技术栈:**Node.js + TypeScript + Vite + React**(前端 React 渲染节点树,Node 后端代理 Figma API)。

## 总体架构

monorepo(pnpm workspaces),四个包职责清晰、可独立测试:

```
figma-render/
├── package.json              # pnpm workspaces root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── packages/
│   ├── core/      # Figma 类型、抓取器、节点树规范化
│   ├── renderer/  # React 组件:把节点树渲染成 HTML/CSS
│   ├── server/    # Express 后端,代理 Figma REST API + 缓存
│   └── web/       # Vite + React 预览应用(用户界面)
```

依赖关系:`web` → `renderer` + `core`;`server` → `core`;`renderer` → `core`。

**实现状态:[x]** 四个包按设计落地,依赖关系符合预期。

## packages/core — 数据层

| 状态 | 任务 | 落地位置 |
|---|---|---|
| [x] | `types/index.ts` 复用 `@figma/rest-api-spec` 官方类型 + 内部 `FigmaBundle` 类型 | `packages/core/src/types/index.ts` |
| [x] | `getFile` / `getImageFills` / `exportNodes` REST 客户端 | `packages/core/src/fetcher/api.ts` |
| [x] | `parseFigmaJson` 浏览器安全的 JSON 解析 | `packages/core/src/fetcher/parse.ts` |
| [x] | `loadFromJsonFile` Node 端文件读取(隔离至 `core/node` 子入口避免污染浏览器) | `packages/core/src/fetcher/file.ts` |
| [x] | `indexDocument` 节点扁平化、parentMap、page 收集 | `packages/core/src/normalize/tree.ts` |
| [x] | `surveyAssets` 收集 imageRefs 与 vector 导出候选 | `packages/core/src/normalize/assets.ts` |
| [x] | Component/Instance 主组件引用与 overrides 合并 | `packages/core/src/normalize/instances.ts` `resolveInstance()`:无 children 时按 `componentId` 找 master 并克隆子树(id 重映射),并把 `componentProperties`(TEXT / BOOLEAN)沿 `componentPropertyReferences` 应用到后代 |

**注意**:Figma API token 仅在后端使用,不出现在前端代码或 bundle。**[x] 已落实**(token 走 `/api/figma/load`,服务端透传给 `api.figma.com`,不存储)。

## packages/renderer — 渲染层

### 节点组件 (`packages/renderer/src/nodes/`)

| Figma 类型 | 组件 | 状态 | 备注 |
|---|---|---|---|
| `DOCUMENT` / `CANVAS` | 由 `NodeRenderer` 派发到 `FrameNode` | [x] | CANVAS 视为 root 渲染 |
| `FRAME` / `GROUP` / `SECTION` | `<FrameNode>` | [x] | Auto Layout → flex;否则绝对定位 |
| `RECTANGLE` / `ELLIPSE` | `<ShapeNode>` | [x] | ELLIPSE 强制 `border-radius: 50%` |
| `LINE` / `REGULAR_POLYGON` / `STAR` | `<VectorNode>` | [x] | 走 SVG/导出回退路径 |
| `VECTOR` / `BOOLEAN_OPERATION` | `<VectorNode>` | [x] | `fillGeometry` → 内联 SVG;否则用 `/v1/images` 导出的 SVG |
| `TEXT` | `<TextNode>` | [x] | 含混合样式 span 拆分 |
| `COMPONENT` / `COMPONENT_SET` | `<FrameNode>` | [x] | 等同 Frame |
| `INSTANCE` | `<InstanceNode>` | [x] | 通过 `resolveInstance` 处理:无 children 时克隆 master 子树并按 `componentProperties` 合并 overrides,然后走 Frame 渲染 |
| FigJam (`STICKY` 等) | `<ShapeNode>` 兜底 | [~] | 走默认分支不崩,但样式简化 |
| `SLICE` | `null` | [x] | 不渲染 |

### 样式转换器 (`packages/renderer/src/style/`)

| 转换器 | 状态 | 文件 | 已覆盖要点 |
|---|---|---|---|
| `paint.ts` (`paintsToBackground`) | [x] | `style/paint.ts` | SOLID;LINEAR/RADIAL/ANGULAR/DIAMOND 渐变(DIAMOND 用 radial 近似);IMAGE 的 FILL/FIT/TILE/STRETCH;多 paint 多层合成 |
| `stroke.ts` (`strokeToCss`) | [~] | `style/stroke.ts` | 实线、虚线、`strokeAlign` (INSIDE→border / OUTSIDE→box-shadow / CENTER→border)、`individualStrokeWeights`。**虚线 dashPattern 未细分**(只切换 dashed) |
| `effect.ts` (`effectsToCss`) | [x] | `style/effect.ts` | DROP/INNER_SHADOW、LAYER_BLUR、BACKGROUND_BLUR(→ `backdrop-filter`) |
| `layout.ts` (`autoLayoutToCss` / `autoLayoutChildToCss` / `absolutePositionToCss`) | [x] | `style/layout.ts` | Auto Layout(direction/align/padding/gap/wrap/grow/stretch);`constraints` (LEFT/RIGHT/CENTER/LEFT_RIGHT/SCALE × TOP/BOTTOM/CENTER/TOP_BOTTOM/SCALE) → CSS top/right/bottom/left + calc(50%+offset) / 百分比，锁定父容器缩放时的锚点;旋转/镜像节点回退到 `relativeTransform` matrix() |
| `transform.ts` | [x] | 合并到 `layout.ts` 的 `absolutePositionToCss` | `relativeTransform` 2x3 → CSS `matrix()` + `transform-origin: 0 0` |
| `text.ts` (`textStyleToCss`, `verticalAlignToCss`) | [x] | `style/text.ts` | font-family/weight/italic/size,line-height (PIXELS/PERCENT),letterSpacing,textAlign(含 JUSTIFIED),textCase(UPPER/LOWER/TITLE/SMALL_CAPS),textDecoration(UNDERLINE/STRIKETHROUGH),vertical align,字体降级回退到系统栈 |
| `cornerRadius.ts` | [x] | `style/cornerRadius.ts` | uniform `cornerRadius` 与 per-corner `rectangleCornerRadii` |
| `blend.ts` | [x] | `style/blend.ts` | 全部 16 种 blendMode 映射到 `mix-blend-mode` |
| `mask.ts` | [x] | `style/mask.ts` | `isMask` → 用 SVG `mask-image` 包裹后续兄弟节点;支持 RECTANGLE(含 cornerRadius)、ELLIPSE、VECTOR/BOOLEAN_OPERATION(`fillGeometry`)。Auto Layout 父容器下回退到普通渲染避免破坏 flex 流 |

混合文本样式:**[x]** `<TextNode>` 用 `characterStyleOverrides` + `styleOverrideTable` 把同样式的相邻字符合并为一个 span。

### 入口

**[x]** `FigmaRenderer.tsx` 接收 `{ bundle, pageId? }`,按 page 渲染;`NodeRenderer.tsx` 负责单节点派发并被递归调用。

## packages/server — 后端代理

Express + TypeScript,小而薄。

| 状态 | 任务 | 文件 |
|---|---|---|
| [x] | `POST /api/figma/load` 拉文件 + 解析 imageFills + 预导出 vector SVG | `packages/server/src/routes/figma.ts` |
| [x] | `POST /api/figma/export` 按需导出节点 | 同上 |
| [x] | LRU 缓存(16 文件 / 10 分钟 TTL) | `packages/server/src/cache.ts` |
| [x] | token 透传不持久化 | `routes/figma.ts` |
| [x] | `GET /api/health` 健康检查 | `packages/server/src/index.ts` |

## packages/web — 预览界面

Vite + React,职责:让用户输入来源、加载文档、把数据交给 `<FigmaRenderer>`。

| 状态 | 任务 | 文件 |
|---|---|---|
| [x] | 顶层 layout(左侧来源面板 + 中间画布 + 顶部 page 选择器) | `packages/web/src/App.tsx` |
| [x] | 平移 + 缩放画布(⌘/Ctrl+滚轮缩放、拖拽平移) | `packages/web/src/components/Canvas.tsx` |
| [x] | 来源面板(API 表单 + JSON 文件上传) | `packages/web/src/components/SourcePanel.tsx` |
| [x] | 页面切换器 | `packages/web/src/components/PageSelector.tsx` |
| [x] | Zustand 全局状态(bundle / pageId / zoom / loading / error) | `packages/web/src/state/store.ts` |
| [ ] | 节点 hover 高亮 / 节点检查器 | 计划保留为后续扩展 |
| [ ] | "对比模式":Figma `/v1/images` PNG 与渲染结果并排比对 | 未实现 |

## 增量推进顺序(里程碑)

| 里程碑 | 状态 | 备注 |
|---|---|---|
| **M1** 脚手架(workspace + TS + Vite + Express) | [x] | `pnpm install` / typecheck / build 全绿 |
| **M2** 数据通路(fetcher + server/load + web 表单) | [x] | API 与本地 JSON 两路均通 |
| **M3** 基础节点(Frame/Rectangle/Text + paint/stroke/cornerRadius) | [x] | 全部上述类型可渲染 |
| **M4** Auto Layout(flexbox) | [x] | 含 grow / stretch / wrap |
| **M5** 矢量与图像(Vector/BooleanOp + Image fill) | [x] | 内联 SVG + 导出 SVG 两策略 |
| **M6** 文本细节(混合样式、字体降级) | [x] | run 拆分 + Helvetica/系统降级栈 |
| **M7** Component/Instance | [x] | `resolveInstance` 处理 master 克隆 + `componentProperties`(TEXT / BOOLEAN)合并;`INSTANCE_SWAP` / `VARIANT` 留作后续 |
| **M8** Effects/Mask/Blend | [x] | Effects + Blend + Mask(SVG mask-image)完成 |
| **M9** 画布交互(平移缩放 + page) | [x] | 节点 hover/选中未做 |
| **M10** 打磨与样例 | [~] | README 与 plan 文档存在;**真实 Figma 文件回归未做** |

## 第三方依赖(关键)

| 状态 | 包 | 用途 |
|---|---|---|
| [x] | `@figma/rest-api-spec` | 官方类型 |
| [x] | `react`, `react-dom`, `vite`, `@vitejs/plugin-react` | 前端 |
| [x] | `express`, `cors`, `zod`, `lru-cache` | 后端 |
| [x] | `zustand` | 前端状态 |
| [x] | `vitest` | 单测 |
| [ ] | `@testing-library/react` | 计划但未引入(暂未写组件渲染测试) |

## 验证(端到端)

| 状态 | 验证项 | 实际情况 |
|---|---|---|
| [x] | 单元测试 vitest 覆盖每个样式转换器 | **24 个测试通过**;覆盖 paint(含 4 种渐变)、stroke、effect、autoLayout、cornerRadius、text 主分支、constraints (5 种水平 × 5 种垂直 + 旋转回退)、mask、core 解析与节点索引 |
| [ ] | 集成测试:`fixtures/sample.json` jsdom 渲染断言 | 未编写 |
| [ ] | 手工视觉回归:真实文件 + Figma PNG 对比 | 因环境无 token 未执行,需用户在本地完成 |
| [x] | 冒烟:`pnpm -r typecheck && pnpm -r test && pnpm build` | 全绿;web bundle ~165 kB |
| [x] | server `/api/health` 启动验证 | 通过 |

## 不在本计划范围(明确不做)

- 双向编辑(改回 Figma)
- 协作 / 多人光标
- 动画与 Smart Animate / Prototype 跳转
- 设计稿导出为 React 组件源码(可作为后续扩展)

## 当前已知缺口(后续工作)

1. **Stroke dashPattern** 仅切换 `dashed` 样式,未根据 `[dash, gap]` 自定义。
2. **Component / Instance overrides** — TEXT / BOOLEAN 通过 `componentProperties` 已合并;**`INSTANCE_SWAP`** 与 **`VARIANT`** 属性未实现(需要在解析时替换 master 节点本身)。
3. **节点交互**(hover 高亮、选中、节点检查器)未做。
4. **真实 Figma 文件视觉回归**未在本仓库环境内执行。
5. **集成测试**(jsdom + 完整 fixture 渲染)未编写。

## 待修改的关键文件汇总

新建(已全部落地):

- 根:`package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、`.gitignore`、`README.md`
- `packages/core/src/{types,fetcher/{api,parse,file},normalize/{tree,assets}}/*.ts`
- `packages/renderer/src/{FigmaRenderer.tsx, NodeRenderer.tsx, context.tsx, nodes/*, style/*}`
- `packages/server/src/{index.ts, routes/figma.ts, cache.ts}`
- `packages/web/src/{main.tsx, App.tsx, api.ts, components/*, state/store.ts}`
- 各包的 `package.json`、`tsconfig.json`、`vite.config.ts`(仅 web)

无既有文件需要修改(空仓库)。
