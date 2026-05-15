# File2Flow 提示词模板（`prompts/file2flow/`）

服务端在 `POST /api/flows` 生成图时，会**每次请求**从本目录读取下列 `.md` 文件（去掉其中的 HTML 注释 `<!-- ... -->` 后作为模板），再将占位符替换为实际内容后发给模型。

| 文件 | 用途 |
|------|------|
| `01-source-restatement.md` | **自然语言转述**（固定正文，不修改；服务端在末尾追加 `---` + 原始 `sourceText`） |
| `01b-flow-title-from-restatement.md` | 根据**转述全文**生成简洁流程标题（含文书类型关键词） |
| `02-source-preprocess.md` | 对**转述全文**提取 candidatePoints / dossier（**无**服务端字符分段） |
| `03-complete-candidate-points.md` | 用**原始** `sourceText` 补全 `predecessorId`（可新增候选点） |
| `04-graph-from-source.md` | 输出 flow JSON（nodes/edges） |
| `05-json-repair.md` | JSON 解析失败时的修复 |

`00-source-segmentation*.md` 为旧版分段提示，**当前主链路不再调用**。

## 流水线顺序

1. 前端拼接 `sourceText`（文件 + 描述）
2. **`01-source-restatement.md`** → Document Definition + Signing Process
3. **`01b-flow-title-from-restatement.md`** → 建议流程名（注入后续 `{{FLOW_NAME}}`，并覆盖最终 `flowName` / DEFINITION 节点标题）
4. **`02-source-preprocess.md`** → 节点候选 / dossier（输入 = 转述全文）
5. **`03-complete-candidate-points.md`** → 补全 candidate 前置关系（输入 = 原文 + 转述 + candidatePoints）
6. **`04-graph-from-source.md`** → 构图 → `normalizeAiGraph`

## 占位符

- **01**：服务端在文件后追加原文（无占位符）
- **01b**：`{{DRAFT_TITLE}}`、`{{SOURCE_FILE}}`、`{{RESTATED_TEXT}}`（转述全文截断至模型可承受长度）
- **02**：`{{FLOW_NAME}}`、`{{SOURCE_URL}}`、`{{SOURCE_FILE}}`、`{{SOURCE_TEXT}}`（转述后全文）
- **03**：`{{FLOW_NAME}}`、`{{SOURCE_FILE}}`、`{{ORIGINAL_SOURCE_TEXT}}`、`{{RESTATED_SOURCE_TEXT}}`、`{{CANDIDATE_POINTS_JSON}}`
- **04**：`{{FLOW_NAME}}`、`{{SOURCE_URL}}`、`{{SOURCE_FILE}}`、`{{SOURCE_TEXT}}`、`{{PREPROCESS_DOSSIER_SECTION}}`
- **05**：`{{SCHEMA_HINT}}`、`{{PARSE_ERROR}}`、`{{BAD_JSON}}`

## 环境变量

- **`AI_SKIP_SOURCE_RESTATEMENT=1`**：跳过转述
- **`AI_SKIP_SOURCE_PREPROCESS=1`**：跳过预处理 LLM
- **`AI_SKIP_FLOW_TITLE_FROM_RESTATEMENT=1`**：跳过标题 LLM（沿用前端 `name`）
- **`AI_SKIP_CANDIDATE_POINT_COMPLETION=1`**：跳过 candidate 前置补全 LLM
