# 客户端接入

同一份 skill，落到不同 AI 编码工具里的差别只有三件事：**skill 放哪、MCP 配置写哪、Key 怎么不出现在 git 里**。

## 1. 连接参数（全客户端通用）

| 项 | 值 |
|---|---|
| endpoint | `{console_base_url}/mcp`（Streamable HTTP，不是 SSE） |
| 鉴权头 | `Authorization: Bearer eops_<prefix>_<secret>` |
| 传输 | HTTP；仅 `localhost` 允许明文 `http://`，其余必须 `https://` |
| 自检 | 连上后第一个调用必须是 `ease_ops_whoami` |

`console_base_url` 由 `whoami` 返回，**不要让用户手填**；安装器只在首次引导时问一次（例：`http://127.0.0.1:8010`）。

本仓现成实例（可对照格式）：

```json
{
  "mcpServers": {
    "cicd-mcp": {
      "url": "http://127.0.0.1:8010/mcp",
      "headers": { "Authorization": "Bearer eops_xxx" }
    }
  }
}
```

## 2. 能力矩阵

| 客户端 | skill 目录 | MCP 配置 | Key 插值 | 显式触发 |
|---|---|---|---|---|
| Cursor | `.cursor/skills/<name>/`（项目级）<br>`~/.cursor/skills/<name>/`（全局） | `.cursor/mcp.json`（项目级）<br>`~/.cursor/mcp.json`（全局） | `${env:NAME}` ✅ | `/ease-ops:onboard` |
| Claude Code | `.claude/skills/<name>/` | `.mcp.json`（项目级）<br>`~/.claude.json`（用户级） | `${NAME}` ✅ | `/ease-ops:onboard` |
| CodeBuddy | `.codebuddy/skills/<name>/`<br>`~/.codebuddy/skills/` | 见 §3.3（安装器探测） | ❌ | `/ease-ops:onboard` |
| VS Code（Copilot） | 不支持 skills | `.vscode/mcp.json` | `${input:xxx}` + `inputs` 密码框 ✅ | 自然语言 |
| Trae / Windsurf / 其他 | 不支持 skills | 客户端 UI / 约定 json | ❌ | 自然语言 |

标注依据：Cursor 的目录与 `${env:NAME}` 插值、Claude Code 的 `.mcp.json` + `${VAR}`、CodeBuddy 的 `.codebuddy/skills/` 均来自各自官方文档；VS Code 的 `inputs` 密码框同理。**其余未验证项一律由安装器探测，探测不到就打印片段让用户手动粘，不猜路径。**

## 3. 各客户端最小配置

### 3.1 Cursor

项目级 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "ease-ops": {
      "url": "https://ops.example.com/mcp",
      "headers": { "Authorization": "Bearer ${env:EASE_OPS_TOKEN}" }
    }
  }
}
```

- Cursor **不需要** `type` 字段，按 URL 自动判断传输。
- `${env:EASE_OPS_TOKEN}` 在启动 Cursor 的 shell 里 `export` 才生效；GUI 启动时读的是系统环境变量，不是终端里的。装不出来就退回 §4 的 B 档。
- skill 放 `.cursor/skills/ease-ops-onboard/`，`references/` 必须是它的子目录。

### 3.2 Claude Code

项目级 `.mcp.json`（**必须写 `type: "http"`**）：

```json
{
  "mcpServers": {
    "ease-ops": {
      "type": "http",
      "url": "https://ops.example.com/mcp",
      "headers": { "Authorization": "Bearer ${EASE_OPS_TOKEN}" }
    }
  }
}
```

等价 CLI：

```bash
claude mcp add --transport http --scope project ease-ops https://ops.example.com/mcp \
  --header "Authorization: Bearer $EASE_OPS_TOKEN"
```

注意：`--header` 的值若写成 `$EASE_OPS_TOKEN` 且外层是双引号，**shell 会当场展开**，token 就直接落进文件了。要保留引用语义，用单引号写 `${EASE_OPS_TOKEN}`。

### 3.3 CodeBuddy

skill 目录（官方文档确认）：`.codebuddy/skills/ease-ops-onboard/SKILL.md`，用户级 `~/.codebuddy/skills/`。CodeBuddy 同时兼容 `.claude/skills/`，所以**同一套文件复制两个目录即可**，不必维护两份。

MCP 配置安装器按顺序探测（⚠ 待实测，逐个 `read` + `JSON.parse` 成功才写）：

1. `codebuddy mcp add --transport http ease-ops <url> --header 'Authorization: Bearer ${EASE_OPS_TOKEN}'`
2. `~/.codebuddy/.mcp.json` / `.codebuddy/mcp.json` 的 `mcpServers` 段
3. `.mcp.json`（与 Claude Code 共用）
4. 都不命中 → 打印 §1 的片段，让用户在客户端 UI 里贴

CodeBuddy 不做 `${env:}` 插值，因此**默认写 A 档不成立**，一律走 §4 的 B 档或 C 档。

### 3.4 VS Code（Copilot Chat）

`.vscode/mcp.json` 的字段叫 `servers`（不是 `mcpServers`），且支持密码输入框：

```json
{
  "inputs": [
    { "id": "ease-ops-token", "type": "promptString",
      "description": "ease-ops MCP Key", "password": true }
  ],
  "servers": {
    "ease-ops": {
      "type": "http",
      "url": "https://ops.example.com/mcp",
      "headers": { "Authorization": "Bearer ${input:ease-ops-token}" }
    }
  }
}
```

这是唯一把 Key 放在**编辑器密钥存储**而不是文件里的方式，有条件时优先推荐。

### 3.5 Trae / Windsurf / 其他

不支持 skills，只能靠 §6 的降级 rules + 客户端自己的 MCP 配置界面。安装器不做自动写入，输出两样东西：

1. 一段可粘贴的 `mcpServers` JSON；
2. 降级 rules 正文，让用户放进客户端的 rules 目录（Trae 是 `.trae/rules/`）。

## 4. Key 的三个档次

按安全性排序，安装器优先选 A，不可行退 B，再不可行退 C。

| 档 | 做法 | 适用 | 注意 |
|---|---|---|---|
| **A** | 配置里写变量引用（`${env:NAME}` / `${NAME}` / `${input:id}`） | Cursor、Claude Code、VS Code | 用户需自己 `export`；GUI 启动可能读不到 |
| **B** | 配置文件写明文，但**必须** `chmod 600` + 加进 `.gitignore` | CodeBuddy 等不支持插值的 | 一旦被 `git add` 就是泄露 |
| **C** | 用户自己在客户端 UI 里填 Key | 任何客户端 | 文件里根本不出现，最干净 |

### 硬要求：含明文 Key 的配置必须被 git 忽略

A 档（变量引用）和 C 档（客户端输入框）写进文件里的都不是 secret，**可以提交**——团队共享同一份配置本来就是好做法。真正危险的是 B 档。

本仓现状（已核实，workspace 根不是仓库，`ease-ops-api` / `ease-ops-web` 各自独立）：

| 文件 | 状态 |
|---|---|
| `ease-ops-api/.cursor/mcp.json` | **已提交**（`0d3ffa8 feat: 增加项目、组件、仓库的mcp`），内含明文 `eops_` Key → 已进历史 |
| `ease-ops-web/.cursor/mcp.json` | 未跟踪、未被忽略，含明文 Key → 下次 `git add -A` 就进历史 |

所以 B 档下安装器会在写完后：

```bash
git check-ignore -v .cursor/mcp.json || echo ".cursor/mcp.json" >> .gitignore
```

并复查 `git check-ignore` 真的生效。非 git 仓库时只警告，不阻断。

已进历史的那份不能靠 gitignore 补救，需要（1）**轮换 Key**（2）`git rm --cached` 取消跟踪（3）必要时清洗历史。这三步是人工动作，安装器不代劳。

## 5. 安装器行为契约

> 实现在 `skills/ease-ops-onboard/{bin/onboard.mjs,lib/*.mjs}`，零依赖、`engines: node >=18`。

```
npx @ease-ops/onboard init [--client cursor|claude|codebuddy|vscode|generic|all] [--url ...]
```

| 步骤 | 行为 | 失败时 |
|---|---|---|
| 1 探测 | 找 `.git` 根、已有 `.cursor/` `.claude/` `.codebuddy/` `.vscode/`、已有 mcp 配置 | 多个客户端命中 → 全装（幂等），不要求选 |
| 2 写 skill | 复制 `SKILL.md` + `references/` 到该客户端目录，**已存在则比对版本** | 版本更高则提示 `--force`，不静默覆盖 |
| 3 合并 MCP | 只改 `mcpServers.ease-ops` 一项；**缩进宽度与顶层键顺序保留**；含注释/无法解析 → 放弃写入并打印片段 | 不破坏用户已有配置 |
| 4 收 Key | A 档提示 `export`；B 档提示粘贴（不回显）并 `chmod 600` + 写 gitignore；C 档走 `inputs` 交互框 | 用户跳过则停在"待配置" |
| 5 验证 | 依次握手 → `tools/call ease_ops_whoami`，打印身份、项目数、`min_skill_version` | 401/404/超时按 §7 报 |
| 6 收尾 | 打印 skill 版本落位、配置文件路径、gitignore 状态 | — |

已知取舍：JSON 会被规范化（原文件里的行内对象展开成多行，如 `"headers": { "X": "y" }` → 多行）。**语义不变、其他 server 项不丢**，但会产生格式 diff；在意格式的仓应把该文件 gitignore（本来也应该）。

幂等：重复 `init` 应等价于"升级 skill + 校正配置"，不产生重复 server 项、不产生重复 skill 目录（实测第二次输出 `unchanged`）。

另两个命令：`doctor` 汇总各客户端安装状态 + gitignore 校验 + 连通性；`remove` 删 skill 与 `ease-ops` 配置项，删空的 mcp 配置文件，保留 `.ease-ops/`；`remove` 带 `--client` 时只清那一家，不带则全量。`init` / `doctor` 未给 `--url` 时会从已写入的 mcp 配置里取回 endpoint，重跑不必再记地址；`doctor` 在客户端目录存在但 skill 未安装时给 `未安装` 警告。

## 6. 降级 rules 正文

给不支持 skills 的客户端（Trae / Windsurf / 裸模型）。三行路由，够用且不会漂：

```markdown
# ease-ops 接入

当用户说"接入 ease-ops""把这个项目接进平台""加个组件进流水线"时：
1. 读 `.ease-ops/skill/SKILL.md`（安装器已落位），按其五阶段执行；
2. payload 字段只允许 `.ease-ops/skill/references/payload.md` 里的定义，未知字段直接报错；
3. 错误码与处置查 `.ease-ops/skill/references/errors.md`；不要把密钥写进任何文件或对话。
```

安装器为这类客户端把文件落到 `.ease-ops/skill/`（与 `.ease-ops/onboarding.yaml` 同级），路径固定，rules 才能引用到。

## 7. 验证与排障

`init` 结束时自检，以及用户自己排查时都走这张表：

| 现象 | 最可能原因 | 处理 |
|---|---|---|
| `404` | endpoint 少了 `/mcp`，或服务端未开 MCP | 核对 `{console_base_url}/mcp` |
| `401` | 没带 `Authorization`，或 Key 失效 | 重跑 `init` 换 Key |
| `401` 且 header 看着对 | 变量没展开（`${env:X}` 原样发出去） | 改 B/C 档，或确认变量在启动进程的环境里 |
| 工具列表为空 | 客户端缓存了旧连接 | 重启客户端（Cursor 热加载常失效） |
| 调工具报 `method not found` | 客户端与服务端 MCP 版本不匹配 | 升级客户端；`whoami` 里看 `min_skill_version` |
| skill 没被触发 | 目录层级错了（`SKILL.md` 必须在 `<name>/` 下） | `ls .cursor/skills/ease-ops-onboard/SKILL.md` |
| 触发后行为像旧版 | 多个目录各有一份 skill | 只保留一处；`init --force` 覆盖 |

agent 侧的处置原则：401/404 只报原文 + 一句人话建议，**不要**自行改配置重试；`skill_version_too_old` 必须停。

## 8. 升级与卸载

| 操作 | 命令 | 影响 |
|---|---|---|
| 升级 | `npx @ease-ops/onboard init --force` | 覆盖 skill 文件；MCP 配置只更新 server 项 |
| 检查 | `npx @ease-ops/onboard doctor` | 打印版本、连通性、gitignore 状态、payload 版本支持；endpoint 可省略，缺省从 mcp 配置读取 |
| 卸载 | `npx @ease-ops/onboard remove` | 删 skill 目录 + 删 `ease-ops` server 项（配置只剩空对象时连文件一起删）；**不动** `.ease-ops/onboarding.*` |

版本漂移由 `whoami.min_skill_version` 与 SKILL.md frontmatter 的 `version` 对比得出，不靠人记。

## 9. 不能做的事

| 禁止 | 原因 |
|---|---|
| 把 Key 写进 `.ease-ops/onboarding.yaml` / `.json` | 这两个文件是要提交的 |
| 在 skill 或 rules 正文里硬编码 `console_base_url` | 每个团队部署地址不同，必须从 `whoami` 拿 |
| 自动修改用户的其它 MCP server 条目 | 破坏他人的工作环境 |
| 把 skill 装到 `/tmp` 或用户没打开的工作区 | 客户端不会加载，等于没装 |
| 用 `http://` 连非 localhost | Key 会明文过网 |
