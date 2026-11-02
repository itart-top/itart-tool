# 错误码与处置

平台返回的每个错误都带 `code` / `stage` / `field` / `hint` / `fixable`。**`fixable` 只决定"能不能在阶段 2 改 payload 重跑 plan"，与"能不能重试 apply"无关——apply 永不自动重试。**

## 1. 错误形状

```jsonc
{
  "error": {
    "code": "work_dir_not_found",
    "stage": "plan",                  // plan | apply | probe
    "field": "components[0].work_dir", // 指回 payload 的路径，可直接引用
    "hint": "仓库 acme/shop 的 main 分支下不存在 web/ 目录",
    "fixable": true,
    "remediation_url": null            // 需要人操作的场景才会有
  }
}
```

`field` 是**唯一**可以拿来跟用户对话的定位信息。不要向用户复述 `hint` 里的英文原文，翻成一句话。

同一个阶段可能一次返回多个问题：此时信封形状不变，`code` 取第一条，完整列表在 `issues[]`（每项仍带 `code` / `field` / `hint` / `fixable`）。逐条处理，不要只看首条就重跑。

## 2. 处置总则

| 阶段 | 允许的动作 |
|---|---|
| plan · `fixable: true` | 改 payload → 重跑 plan。**整份任务最多一次** |
| plan · `fixable: false` | 停下，把 `hint` 翻成人话 + 给整改建议，等用户处理后重来 |
| probe · `pending` | 不算错误，每几秒轮询 `ease_ops_get_probe`（结果保留 30 分钟，仅创建者可读） |
| apply · 任何错误 | 停下，报告已落地项与失败点，给 resume 或人工介入建议 |

连续两次 plan 失败 → 停止猜测，明确说"卡在 X，需要你先处理 Y"。

---

## 3. 码表

### 3.1 payload 结构类（plan，全部 `fixable: true`）

| code | 触发 | 修复 |
|---|---|---|
| `schema_invalid` | 不符合 schema：必填缺失、类型不对、枚举不匹配、出现 `null` | 按 `references/payload.md` 改正；别"猜一个相近的" |
| `unknown_field` | 出现 schema 之外的字段（典型：照抄设计文档的 JSON 示例） | 删字段或改成 schema 里的名字 |
| `secret_in_payload` | `secret: true` 的项带 `values`，或任何字段出现疑似密钥 | 删值，只留 key；值走 intake |
| `platform_id_forbidden` | 出现 `*_id` 形态（`image_version_id`、`host_id`） | 换成 code / 逻辑名 / 可读名 |
| `code_conflict` | 同一 payload 内 `code` / `key` / `rel_path` 重复 | 改名；`rel_path` 在同一环境内必须唯一 |
| `component_code_duplicated` | 组件 code 在目标项目中已存在且内容不同 | 改 code，或把该组件从 payload 移除（已存在就不必再接） |

### 3.2 仓库与项目类（plan）

| code | fixable | 触发 | 修复 |
|---|---|---|---|
| `project_not_found` | ✅ | `project.strategy: use` 但 `code` 命中不到 | 让用户在项目列表里选，或改 `strategy: create` |
| `project_exists` | ✅ | `strategy: create` 但同名 code 已存在 | 改 `strategy: use`（多半是用户以为没有） |
| `branch_not_found` | ✅ | `repos[].branch` 在远端不存在 | 用实际分支名；不确定就问用户 |
| `repo_branch_required` | ✅ | 本地仓库（`file://` / 绝对路径）没填 `branch`，且没有可继承的默认分支 | 填分支名（可用 `probe_repo` 的 `repos[].default_branch`）；远端仓库不填会按 `main` 处理并给 `repo_branch_defaulted` 警告 |
| `work_dir_not_found` | ✅ | `work_dir` 目录不存在，或指向主仓库之外 | 只在 `repo_refs[0]` 内取目录 |
| `repo_unbound` | ✅ | 组件引用了 `repos[]` 里没有的 key | 补 `repos[]` 项或改 `repo_refs` |
| `repo_not_a_git_repo` | ❌ | 当前目录不是 git 仓库 | 用户需先 `git init` 或换目录 |
| `checkout_mode_conflict` | ✅ | `shared` 但组件分散在多个 `repos` | 跨仓必须 `separate` |

### 3.3 构建与镜像类（plan）

| code | fixable | 触发 | 修复 |
|---|---|---|---|
| `runtime_required` | ✅ | `kind: script` 但没写 `runtime` | 补逻辑名 |
| `runtime_unmapped` | ✅ | 逻辑名不在映射表 | 从 `ease_ops_list_runtime_images` 的候选里选 |
| `runtime_unknown` | ✅ | 无法从逻辑名推出镜像 | 写白名单内的完整镜像名兜底 |
| `untrusted_registry` | ❌ | 指的 registry 不在白名单 | 需管理员加白名单，停下 |
| `artifact_empty` | ✅ | `artifacts` 为空 | 至少声明一项产物 |

### 3.4 配置与密钥类（plan）

| code | fixable | 触发 | 修复 |
|---|---|---|---|
| `secret_in_config_file` | ❌ | `resources[].content` 里出现疑似真实密钥值 | **先改仓库**为 `${VAR}` 模板，再重跑 plan。不要在 payload 里脱敏 |
| `placeholders_unresolved` | ✅ | `content` 里的 `${VAR}` 与 `placeholders` 不一致 | 补齐 `placeholders`，或给缺的 key 建 `configs[]` |
| `config_key_invalid` | ✅ | 变量名不合 `^[A-Z][A-Z0-9_]*$` | 改成大写蛇形 |
| `config_env_unknown` | ✅ | `values` / `required` 里出现环境树没有的节点 | 只能用 `test` / `prod` |

### 3.5 凭证与密钥类（plan）

| code | fixable | 触发 | 修复 |
|---|---|---|---|
| `credential_not_found` | ⚠️ | `credential_ref` 解析不到 | 走 `ease_ops_request_secret` 建一份，或换 ref；也可先留空，由 intake 补 |
| `credential_purpose_mismatch` | ⚠️ | 凭证存在但 purpose 不符（用 deploy 凭证去 clone） | 按 purpose 重新 `list_credentials` 挑一个 |
| `credential_disabled` | ⚠️ | 凭证被禁用 | 让管理员启用，或换一份 |

`⚠️` = 不改 payload 也可能继续（deferred credential）：plan 会把它记进 `secret_requirements`，apply 后落在 `pre_build_blockers`，构建前必须补齐。

**intake 运行时**（`ease_ops_request_secret` / `ease_ops_get_secret_request` 返回）：

| code | 触发 | 修复 |
|---|---|---|
| `secret_request_unsupported` | `target_kind: env_var`；v1 只支持凭证补录 | 让用户到项目环境设置里手工添加变量，再重跑 plan；不要把值写进 payload |
| `secret_request_expired` | 链接超过 TTL | 重新 `request_secret`，换新链接 |
| `secret_request_consumed` | 已被填写 / 取消 | 先 `get_secret_request` 拿 `credential_ref`；拿不到就重新发起 |
| `secret_request_not_found` | token 或 `request_id` 不存在，或不属于当前项目 | 核对链接是否完整；重新发起 |
| `credential_name_duplicate` | 填写时项目内已存在同名凭证（可能上一次已填过了） | 先 `list_credentials` 确认；能用就用现有 `project:name`，否则换个名字重新发起 |
| `credential_exists` | `request_secret` 发现同名同用途凭证已存在 | 不要再让人填，直接用返回的 `credential_ref` |

### 3.6 流程类（plan）

| code | fixable | 触发 | 修复 |
|---|---|---|---|
| `flow_not_found` | ✅ | `target: existing` 但流程名命中不到 | 改成 `target: new`，或让用户确认流程名 |
| `flow_not_insertable` | ❌ | 目标流程结构不支持追加（如已被并发修改） | 人工在控制台处理 |
| `env_unsupported` | ✅ | `flows[].env` / `verify.env` 不在环境树（如 `staging`） | 降级到 `test`；这是 **warning** 不是 error |
| `verify_flow_missing` | ✅ | `verify.build=true` 但 `flows[]` 里没有该环境的流程 | 补 `flows[]`，或接受 apply 后 `verify.status=skipped`；这是 **warning** 不是 error |

### 3.7 apply 类（全部 `fixable: false`）

| code | 触发 | 处置 |
|---|---|---|
| `plan_stale` | 传入的 `payload` 与签发 `plan_id` 时的指纹不一致 | 回阶段 2 重跑 plan；**不要**自行改 payload 后硬 apply |
| `plan_blocked` | plan 里还有 `blockers` 就想 apply | 回阶段 2 逐条清掉 |
| `ack_missing` | `acknowledge_required` 没全部回填 | 回阶段 2 逐条问用户 |
| `plan_expired` | `plan_id` 不存在或已过期（30 分钟） | 重跑 plan；不存在的 id 也按此处理 |
| `apply_partial` | 部分资源已落地后失败 | 展示 `applied[]` + `failed_at`，给 resume 或人工介入建议 |
| `permission_denied` | 当前身份缺权限（如非 `platform-admin` 建平台级凭证） | 说明缺哪个权限、找谁开 |

### 3.8 连接与版本类

| code | 阶段 | 触发 | 处置 |
|---|---|---|---|
| `unauthorized` | 任意 | MCP Key 无效 / 过期 / 未带 `Authorization` | 停下，让用户重跑 `npx @ease-ops/onboard init` 或重新生成 Key |
| `skill_version_too_old` | 0 | `whoami.min_skill_version` 高于本文 `version` | 停下，提示升级 skill，**不要**用旧流程硬跑 |
| `probe_timeout` | probe | 探测超过 60s | 转 `pending`，用 `get_probe` 轮询；再超时就按本地结果继续并把差异写进 `notes` |
| `repo_probe_unavailable` | probe | 服务端未配置探测派发（503） | 报给用户：平台未启用仓库探测，改用本地结果继续 |
| `repo_probe_not_found` | probe | `probe_id` 不存在、已过期（30 分钟）或由其他账号创建 | 重新跑 `ease_ops_probe_repo`，不要反复用旧 id |
| `mcp_unreachable` | 0 | 连不上 `/mcp` | 报错原文给用户，附 `console_base_url` 供核对 |

---

### 3.9 警告类（不阻断，但必须向用户开口）

warnings 不是错误：plan / apply 仍会往下走，但你**不能默默略过**——每一条都要在摘要里用一句人话说明，并给出可选动作。

| code | 来源 | 含义 | 处置 |
|---|---|---|---|
| `repo_branch_defaulted` | plan | `repos[].branch` 未填且无可继承默认分支，远端仓库（含自建 Git）按 `main` 处理 | 告知用户“默认当 `main`”；仓库默认分支不是 `main` 时回头填真实分支（`probe_repo` 的 `default_branch`） |
| `env_unsupported` | plan | `flows[].env` / `verify.env` 不是 `test` / `prod`，已降级到 `test` | 列出降级后的环境，让用户确认要不要改成已有环境 |
| `verify_flow_missing` | plan | `verify.build: true` 但 `flows[]` 里没有该环境的流程，apply 会跳过验证构建 | 让用户选：补一条 `flows[]` 项，或明确接受“本次不验证” |
| `schema_invalid`（带 `failed to …` 文案） | plan | 平台侧查环境树 / 仓库复用 / 主机列表失败，部分判定只能降级 | 原样转述并说明“该部分结果可能不准”，不要当作 blocker |
| `configs_not_scanned` | probe | 本版探测不扫配置文件 | 必须在本地读 `.env.example` / `application*.yaml` 并归入 `configs[]` |
| `nested_git_not_scanned` | probe | 本版探测不遍历子模块 / 嵌套仓库 | 本地确认 `.gitmodules` 与多个 `.git`，默认只接根仓并说明跳过了什么 |

---

## 4. 逐码话术

用户看到的应该是一句"哪里不对 + 怎么办"，不是错误码。下面是可以直接照抄的表达方式。

**`work_dir_not_found`**
> 仓库 `acme/shop` 的 `main` 分支里没有 `web/` 这个目录，我按 `./web` 推断的前端可能位置不对。你希望接的是哪个目录？

**`project_exists`**
> 平台上已经有 code 为 `shop` 的项目了。是接进这个已有项目（推荐），还是你想用另一个 code 新建？

**`branch_not_found`**
> `main` 分支在远端不存在，当前可用的是 `master` / `develop`。用哪个？

**`secret_in_payload`**（自查阶段就该发现）
> 我不会把密码写进配置文件。这里只登记 key，值由你在页面上填。

**`secret_in_config_file`**
> `api/config/app.yaml` 里像是写了真实密码。建议先把它改成 `${DB_PASSWORD}` 占位符并提交，我再继续——否则这个密码会跟着配置模板进平台。改好告诉我。

**`runtime_unmapped`**
> `go-1.23` 在平台的镜像目录里没有映射。可选：`go-1.22`（已有）、`golang:1.23-alpine`（写全名）。用哪个？

**`untrusted_registry`**
> 这个镜像来自 `registry.example.com`，不在平台允许的源里。需要管理员先加白名单，我这边做不了。

**`env_unsupported`**
> 平台只有 `test` 和 `prod` 两个环境，没有 `staging`。我按 `test` 接了，需要的话你再手动调。

**`ack_missing`**
> 上一轮有一项确认没答：这个 git 已被项目 `payment` 用着，新建项目接入会让两边共用同一份代码和凭证。确认还是要新建吗？

**`apply_partial`**
> 落了 7 项：项目、仓库、两个组件、构建步骤、3 个变量。卡在"插入流水线"——目标流程在这一分钟里被改过。已落地的不回滚（都还能用），要我把插入重跑一次吗？

**`permission_denied`**
> 你的账号没有 `platform-admin`，建不了平台级凭证。找平台管理员开权限，或者改用项目级凭证（项目内可见）。

**`skill_version_too_old`**
> 这套 skill 是 1.0.0，平台要求至少 1.2.0（payload 有变化）。先跑 `npx @ease-ops/onboard init` 升级，再继续。

**`unauthorized`**
> MCP 连接被拒了，多半是 Key 失效。重跑安装器换一个 Key 再试。

---

## 5. apply 失败的报告模板

```markdown
已落地（不回滚）：
- 项目 shop
- 仓库 shop
- 组件 shop-web / shop-api
- 共享步骤 shop-api/build
- 环境变量 test/DB_HOST 等 3 个

失败点：插入流水线（test/商城测试流水线）
原因：目标流程当前被修改，节点版本不一致
影响：组件和构建都可用，只是还没进流水线；手动跑构建不受影响

下一步（二选一）：
1. 我重跑一次插入（只重做这一步）
2. 你在控制台确认流程状态后告诉我再来
```

规则：

- `applied[]` 有多少列多少，别概括成"大部分成功"。
- 明确说"不回滚"以及为什么（项目/仓库/组件天然可复用且有审计价值）。
- 只给 1–2 个具体选项，不要开放式提问。

---

## 6. 禁止行为

| 禁止 | 原因 |
|---|---|
| apply 失败后自动重试 | 写操作不幂等于会造重复组件/重复节点 |
| 把 `plan_stale` 当成"重新 plan 一下就好"就静默重跑 | 指纹不一致说明 payload 变了，用户审过的那份已经失效 |
| 为了绕过 `fixable: false` 而删掉配置/流程块 | 用户会以为接好了，实际缺一半 |
| 把错误原文（含 URL、内部路径、token 片段）整段贴给用户 | 泄露内部信息，且用户读不懂 |
| 用 `ease_ops_delete_*` 清理失败痕迹 | 删除是破坏性的，必须由人在控制台确认 |
| 在回复里复述 `hint` 中出现的任何密钥值 | 违反硬规则 2 |

---

## 7. 快速对照

| 症状 | 先查 |
|---|---|
| apply 报 `plan_stale` | 是不是手改过 `.ease-ops/onboarding.yaml` 却没重跑 plan |
| apply 报 `ack_missing` | plan 返回的 `acknowledge_required` 是否逐条问过并回填 |
| plan 反复报 `unknown_field` | 是不是把设计文档里的 JSON 示例当 payload 抄了（`repos[].credential_ref` 之类字段名要对齐 schema） |
| 构建步骤空了 / 跑不起来 | `runtime` 是否解析到了默认版本；`work_dir` 是否相对主仓库根 |
| `verify.status=skipped` | `pre_build_blockers` 是否非空；`flows[]` 里有没有 `verify.env` 对应的流程 |
| `verify.status=failed` | 发布快照是否被并发修改；当前账号是否有 `pipeline:run` |
| 两个组件只检出一次 | 这是预期行为（`checkout_mode: shared`），不是 bug |
| 流程里出现两条检出 | `checkout_mode: separate` 或组件分散在不同 `repos` |
