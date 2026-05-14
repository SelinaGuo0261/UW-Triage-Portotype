# File2Flow 与 Chat2Flow 算法说明（当前原型）

本文描述本仓库 **当前实现** 中：从「上传文件」和/或「描述/粘贴文本」生成工作流图（nodes + edges）的完整路径。二者共用 **同一套后端算法**；区别仅在于 **浏览器侧如何拼出 `sourceText`**。

---

## 1. 总览

| 模式 | 用户操作 | `sourceText` 构成 | 入口 |
|------|-----------|-------------------|------|
| **Chat2Flow**（纯文本） | 在「创建新流程」里填写描述/政策正文，可不传文件 | 仅 `desc`（描述框内容） | `public/js/admin/components.js` → `NewFlowModal.startAnalysis` |
| **File2Flow** | 上传 `.docx` / `.txt`（可选仍填描述、链接） | `desc` 与 `fileText` 用两个换行拼接 | 同上 |
| **混合** | 既有描述又有文件 | `desc\n\nfileText` | 同上 |

服务端入口均为 **`POST /api/flows`**（`server.mjs`），请求体 JSON 字段：

- `name`：流程名（前端用描述首行或文件名截断生成）
- `sourceUrl`：可选来源链接
- `sourceFile`：可选原始文件名（元数据，写入 flow）
- `sourceText`：交给模型的**主上下文**（上述合并结果）

**不存在**单独的「chat 意图分类」或第二条 API：自然语言与文件正文在进入模型前已统一为一段 `sourceText`。

---

## 2. 前端：输入准备（File2Flow / Chat2Flow）

**文件**：`public/js/admin/components.js`（`NewFlowModal`）、`public/js/admin/helpers.js`（`extractUploadTextForAi`）。

### 2.1 校验

- 合并后 `sourceText.trim()` 为空则报错：须至少提供 **描述**、**上传文件正文** 或 **粘贴正文** 之一。

### 2.2 文件 → 纯文本（仅 File2Flow 分支）

`extractUploadTextForAi(file)`：

- **`.txt`**：`File.text()`，UTF-8 文本。
- **`.docx`**：`arrayBuffer` → **Mammoth** `extractRawText`（在 `public/admin.html` 中通过 CDN 加载 `mammoth.browser.min.js`）。**禁止**对 docx 使用 `File.text()`（会得到 zip 二进制乱码）。
- **`.doc`**：不支持，提示另存为 docx 或粘贴到描述。
- **`.pdf`**：当前不在浏览器抽取，提示改用 docx/txt 或粘贴正文。

### 2.3 合并规则

```text
sourceText = [desc, fileText].filter(Boolean).join("\n\n")
```

- 仅有描述 → **Chat2Flow** 等价路径。
- 仅有文件 → **File2Flow**（`desc` 为空字符串，不参与拼接）。
- 两者都有 → 描述在前，全文在后，中间空一行分隔。

### 2.4 请求与 UI 反馈

- `fetch("POST", /api/flows)`，JSON body 含 `name`, `sourceUrl`, `sourceFile`, `sourceText`。
- 分析过程中分步 toast / 进度文案；长请求阶段 toast 延长显示（避免过早消失）。
- 成功：`onGenerated(data.flow)` 注入画布并关闭弹窗；失败：错误留在弹窗内（符合「AI 错误不只用一闪 toast」的产品约定）。

---

## 3. 后端：源文本预处理 + LLM 生成图

**文件**：`server.mjs`（`analyzeSourceTextStructure`、`buildSourceTextAnalysisPrompt`、`formatPreprocessDossier`、`generateGraph`、`buildGraphPrompt`、`callAi`、`normalizeAiGraph`；`POST /api/flows` 路由）。

### 3.1 流程串联

1. **`requireAiConfig()`**  
   使用启动时配置的 `openai` / `claude` / `kimi` 及 API Key、模型名。

2. **（可选）源结构预处理 — 第一次 `callAi`**  
   - 当环境变量 **`AI_SKIP_SOURCE_PREPROCESS=1`** 未设置时，先调用 **`analyzeSourceTextStructure`**。若 `sourceText.trim().length < 64`，函数直接返回 `null`（不发起 LLM）。否则提示模型只做 **文档级分析**（不分叉构图），输出严格 JSON：`segmentation`（分段）、`candidatePoints`（链式前驱/类型推断）、`earlyForks`（早述分支与后文段落归属）、`decisionOutgoingAudit`（每条分支的「下一节点」是否在全文任意位置有据）、`graphBuilderBrief`（给第二步的浓缩指令）。  
   - 解析失败时返回空 dossier，**不阻断**主流程；单次预处理异常仅 `console.warn`。  
   - **`formatPreprocessDossier`** 将上述字段裁剪拼接（总长约 ≤14k 字符）供主提示词注入。

3. **`buildGraphPrompt(input, preprocessDossier)`**  
   拼装 **第二次** `callAi` 所用的长提示词，包含：
   - JSON schema 说明（`flowName`, `description`, `nodes[]`, `edges[]`）。
   - 业务规则：唯一 `DEFINITION`、DEFINITION 单出边、`DECISION` 每个答案须有出边、`materials` 须为数组等。
   - **`ACTION` 出边**：每条 `ACTION` **最多 1 条**出边（0 = 路径终点，1 = 继续到下一节点）。边上 **`sourceAnswerTempId` 应为 `null`**（与 `DEFINITION` 一致）。允许 **`ACTION→ACTION`**、**`ACTION→DECISION`**、**`ACTION→PEOPLE`**。
   - **`DECISION` 出边**：每个选项一条出边；**真正分支**时至少 **2 个答案**（即 2 条及以上出边）；**单答案** 仅用作线性「过门 / 继续」步骤。允许 **`DECISION→ACTION`**、**`DECISION→DECISION`**、**`DECISION→PEOPLE`** 等。
   - **带圈数字清单（可选增强）**：`extractCircledStepInventory(sourceText)` 从正文解析 `①` 单独成行、下一非空行为标题 等 UW 文档常见版式；若解析到步骤，在提示词末尾追加 **Mandatory checklist** 段落，要求模型按文档分支落实、不合并行。
   - **结构化分析块**：若预处理成功，在正文与 checklist 之后追加 **`Structured document analysis`** 段落，明确要求构图模型按 **全文位置** 为每条 `DECISION` 出边寻找合理解释（避免「分支在前、对应 ACTION 描述在后」时误接错边）。

4. **`callAi(prompt, config)`**（主图生成）  
   - **Claude**：`messages` API，`max_tokens` 由环境变量或默认值控制；可选 `anthropic-beta: output-128k-2025-02-19`（当未关闭长输出 beta 且 `max_tokens > 8192`）。
   - **OpenAI / Kimi**：兼容 `chat/completions`，`temperature: 0`；OpenAI 使用 `response_format: json_object`。

5. **抽取与解析 JSON**  
   - `extractJsonCandidate`：优先 ```json 围栏；否则从首 `{` 到末 `}` 截取。
   - `JSON.parse` → 失败则 **`repairJsonWithAi`**（再调一次模型修 JSON）→ 再失败则 **`repairCommonJsonIssues`** 本地正则修补 → 仍失败则抛错（错误信息中带返回片段前缀）。

6. **`normalizeAiGraph(parsed, input)`**  
   - 为每个节点、答案分配持久 `id`；用 `tempId` / 旧字段建立 **节点与答案的引用映射**，解析 `edges` 上的 `sourceNodeTempId`、`sourceAnswerTempId`、`targetNodeTempId`。
   - `ACTION` 的 `materials` 统一为数组并规范化字段。
   - `DECISION` 若缺 `content.question`，用 `label` / `title` 兜底（便于 Researcher 向导展示）。
   - 丢弃无法解析端点的边（无匹配 tempId 的边被过滤）。
   - 生成画布初始 `posX`/`posY`（简单网格）。

7. **落库**  
   `POST /api/flows` 将 `normalizeAiGraph` 结果写入新 `flow`，并返回 `validateFlow` 的 **issues**（errors / warnings），不阻塞 201 创建。

### 3.2 与「两阶段 / 操作流」类方案的差异

构图主干仍是 **单次 JSON 生成 + 解析修复 + 归一化**；在 `sourceText` 与主提示词之间增加了 **可选的「源结构」预处理 LLM**（分析 JSON，非操作流），用于分段、链式与分支—后文归属提示。本原型 **未** 实现参考项目中的：intent 分流、`INSERT_NODE`/`ADD_BRANCH` 操作列表、`ensureNodesMatchEdges` 式占位补节点、独立 `jsonrepair` 依赖等。

### 3.3 未使用的代码路径

`server.mjs` 中的 **`generateFallbackGraph`** 为本地种子图生成函数；**当前 `POST /api/flows` 成功路径不会**在缺少 API 时静默替换为 fallback（与产品约定一致：AI 失败应显式报错）。

---

## 4. 校验、画布与 Researcher 行为

### 4.1 `validateFlow`（`server.mjs`）

- 唯一 `DEFINITION`、DEFINITION 入/出边约束、孤立节点、`DECISION` 死分支、从 DEFINITION 出发是否可达至少一个 `ACTION` 等。
- **`ACTION`**：出边数量 **> 1** 时报错（仅允许 0 或 1）。
- **`DECISION`**：若 **≥2 个答案** 但从该节点出发的边 **少于 2 条**，给出 **warning**（提示检查连线）；每个答案仍须有独占出边（否则原有 dead branch **error**）。

### 4.2 Admin 画布（`FlowCanvas` / `NodeView`）

- `ACTION` 节点右侧仅 **`out`** 一条出边桩；`finishConn` 对同一 `fromPort` 会先删后加，因此画布上 **同一 Action 只会保留一条出边**。

### 4.3 Researcher 向导与静态快照

- **`GraphDocWizard`**（`public/js/researcher/components.js`）：若路径上出现 **带出边的 `ACTION`**，先展示该步骤的标题/说明/材料摘要，用户点击 **「继续」** 沿 `sourceAnswerId` 为空的出边前进；仅当到达 **无出边的 `ACTION`** 时结束并进入结果态。`Back` 在 `ACTION→ACTION` 链内使用 `actionTrail` 回退。
- **`findAllTerminalPaths`**：DFS 时 **`ACTION` 若有出边则继续向下**，只有 **无出边的 `ACTION`** 才记为一条终端路径的 `actionNode`。
- **`snapshotToDoc` → `flow.compute`**（`public/js/researcher/helpers.js`）：沿用户所选路径遍历时，遇到 `ACTION` 会压入一步；若该 `ACTION` 仍有出边，则继续跟随后继边（优先 `sourceAnswerId == null`），以支持多段 `ACTION` 泳道式预览。

### 4.4 后续编辑

- Admin 画布可继续手工改节点与边，再 `PUT /api/flows/:id` 保存。

---

## 5. 限制与注意事项

1. **Chat 与 File 同源**：没有单独「只聊天不改图」的后端分支；所有 `sourceText` 都会触发整图生成。
2. **PDF**：未接入文本抽取，需用户自行粘贴或换格式。
3. **模型与配额**：长文档 + 大 `max_tokens` 仍受供应商上下文与速率限制；Claude 长输出依赖 beta 头与账号权限。
4. **边准确度**：完全依赖单次模型输出 + `normalizeAiGraph` 解析；错误边在 `validateFlow` 中可见，需 Admin 手动调整。
5. **带圈清单**：仅对 **可解析的 circled 版式** 追加 checklist；其它编号或表格结构仍主要靠模型与通用规则。

---

## 6. 关键文件索引

| 环节 | 路径 |
|------|------|
| 弹窗与请求 | `public/js/admin/components.js`（`NewFlowModal`） |
| 文件抽取 | `public/js/admin/helpers.js`（`extractUploadTextForAi`） |
| Mammoth 脚本 | `public/admin.html` |
| HTTP + 生成 + 校验 | `server.mjs` |

文档版本：与仓库内实现同步描述；若改 `generateGraph` 或 `NewFlowModal` 契约，请同步更新本文。
