---
name: ease-ops-onboard
description: 把当前仓库接入 ease-ops 平台。用于"接入这个项目""把这个服务接进 ease-ops""在已有项目里加一个组件""把这个组件插进流水线""把 .env 接到环境里"等诉求。会探测仓库、生成接入计划、经用户确认后执行。
version: 1.1.0
---

# ease-ops-onboard

把当前工作目录接入 ease-ops 平台。你负责探测与推断，平台负责校验与执行，人负责选择、确认与填密钥。

## 三条硬规则

违反任意一条视为本次任务失败：

1. **没有 plan_id 不 apply**。apply 必须携带 `ease_ops_plan_onboarding` 返回的 `plan_id`；`blockers` 非空、或 `acknowledge_required` 未全部回填时，禁止 apply。
2. **secret 不进入你的上下文**。密码、私钥、Token 一律不写入 `.ease-ops/onboarding.yaml`、不写进命令、不在回复里复述；只通过 `ease_ops_request_secret` 生成的一次性页面由人填写。
3. **确认必须是显式的**。"看着可以""应该没问题""你先做着"都不算；只有"执行 / apply / 确认 / 可以"这类明确同意才能进入阶段 3。拿不准就问一句"确认执行吗？"。

## 工具与用途

| tool | 用途 | 阶段 |
|---|---|---|
| `ease_ops_whoami` | 身份、权限码、skill / payload 版本要求、控制台地址 | 0 |
| `ease_ops_resolve_repo` | 该 git 已被哪些项目使用 | 0 |
| `ease_ops_probe_repo` / `ease_ops_get_probe` | 平台侧探测（语言、模块；不扫配置与子模块） | 1 |
| `ease_ops_list_credentials` | 可用凭证（按 purpose） | 1 |
| `ease_ops_list_runtime_images` | 可用运行时镜像 | 1 |
| `ease_ops_plan_onboarding` | 校验并返回计划 | 2 |
| `ease_ops_apply_onboarding` | 幂等执行 | 3 |
| `ease_ops_request_secret` / `ease_ops_get_secret_request` | 一次性密钥填写 | 3 |
| `ease_ops_trigger_flow_run` / `ease_ops_get_flow_run` / `ease_ops_diagnose_flow_run` | 可选：验证构建与自动诊断 | 4 |

---

## 阶段 0 · 自检

1. 调 `ease_ops_whoami`。若 `min_skill_version` 高于本文 `version`，**停止**，提示用户重跑安装器升级 skill。
2. 在仓库根执行 `git remote get-url origin`，把原样输出传给工具，**不要**自己改写 URL（归一化由服务端负责）。
3. 调 `ease_ops_resolve_repo { url }`，直接采用返回的 `mode`：

| mode | 动作 |
|---|---|
| `new_project` | 直接进入阶段 1，按新建项目走 |
| `add_component` | 预选 `recommended` 项目，用一句话告知 |
| `ambiguous` | 列出 `matches[].project.code / name / 已接入组件`，加一个"新建项目"选项，**等用户选** |

4. `hidden_matches > 0` 表示该 git 还被当前账号无权访问的项目使用：即使用户选"新建"也要记下 `acknowledge: ["shared_repo"]`，并在摘要中说明共用代价。

> `last_used_at` 是仓库记录的最近更新时间，只能当"最近被改过"的参考，不代表最近一次构建。

> 连不上 / `401` / 工具列表为空：查 `references/clients.md` 的排障表，**不要**自行改 MCP 配置后重试。

退出条件：`mode` 已确定；命中 ≥2 时用户已完成选择。

---

## 阶段 1 · 探测

先本地读，再让平台复核；两者冲突以代码为准，并把差异写进 `notes`。

**本地读**（用 Read / Grep / shell，不要猜）：

- 仓库：`git remote -v`、`git branch --show-current`、`git submodule status`
- 语言与构建：`go.mod` / `package.json` / `pom.xml` / `requirements.txt` / `pyproject.toml` / `Cargo.toml`
- 容器：`Dockerfile`、`compose*.yml`
- 配置：`.env.example`、`.env.*.example`、`application*.yml|properties`、`config*.yaml`

**平台复核**：`ease_ops_probe_repo { url, branch, credential_ref, project? }`。

- 已有目标项目（`add_component` 或用户已选）时传 `project`；新建项目场景不传，平台自动走平台级 runner 与平台凭证；
- `repos[].default_branch` 就是 payload 里 `repos[].branch` 的取值来源；本地仓库（`file://`）没有远端默认分支，必须显式写 `branch`，否则 plan 会以 `repo_branch_required` 阻断；
- `status=done` 时用 `modules[]` 校准组件切分；`pending` 时每几秒调 `ease_ops_get_probe` 轮询（结果保留 30 分钟、仅本人可读）；超过 60s 仍 pending 就先按本地结果继续，把差异写入 `notes`；
- `status=failed` 读 `error` 原样转述，不要连续重试；`warnings` 里的 `configs_not_scanned` / `nested_git_not_scanned` 表示这两类信息本版不扫，必须由你在本地读取确认。

**组件切分**（默认按"可独立构建的最小单元"）：

- 满足任意一条即可作为独立组件：独立 lockfile、独立 Dockerfile、独立 main 包 / cmd、workspaces 成员目录
- 同仓多组件：`repo_refs` 相同、`work_dir` 各自指向子目录、`checkout_mode: shared`
- 多 `.git`：只接 `origin=root`；submodule / 嵌套仓库写入 `detected_but_skipped` 并向用户说明
- 用户说"它只是一个服务"但仓库里明显有前后端两份 → 以代码为准，列出两个候选并说明理由

**配置识别**：

- `.env*` / `application*` → 环境变量；含 `${VAR}` 的 `config*.yaml` → 资源模板
- 密钥判定：显式 `secret: true`，或 key 命中 `*_PASSWORD|*_TOKEN|*_SECRET|*_KEY|*_DSN|*_PRIVATE`
- 配置文件里出现**疑似真实密钥值** → `blocker: secret_in_config_file`，要求先改成 `${VAR}` 模板，停止
- `test` 只自动填非密默认值；`prod` 一律不填，标 `required: [prod]`

**运行时镜像**：`build.kind=script` 时写逻辑名（`go-1.23`、`node-20`），不写镜像 ID；`kind=docker` 不需要 `runtime`。

**凭证检查**：用 `ease_ops_list_credentials { purpose: "git_https" }` 确认 `credential_ref` 可解析；没有可用凭证时不要在 payload 里写任何密钥，留空交给阶段 3 的 intake。

**payload 最小形态**（完整 schema 见 `references/payload.md`）：

```yaml
version: 1
mode: new_project
project: { strategy: create, name: 商城, code: shop }
repos:
  - { key: shop, url: git@github.com:acme/shop.git, branch: main,
      credential_ref: platform:git-acme-ro, checkout_dir: shop, origin: root }
components:
  - code: shop-api
    name: 商城后端
    repo_refs: [shop]
    work_dir: ./api
    languages: [go]
    build: { kind: script, runtime: go-1.23, script: "go build -o bin/api ./cmd/api",
             artifacts: [{ name: api-binary, required: true,
                           rules: [{ work_dir: ".", patterns: ["bin/api"] }] }] }
checkout_mode: shared
flows:
  - { env: test, target: existing, name: 商城测试流水线, action: insert, strategy: deploy_sequence }
acknowledge: []
verify: { build: false, env: test }
```

退出条件：`repos[]`、`components[]`、`configs[]`、`resources[]` 已齐；差异已写入 notes。

---

## 阶段 2 · 规划

1. 写入 `.ease-ops/onboarding.yaml`。
2. 调 `ease_ops_plan_onboarding { payload }`。
3. 按四块渲染摘要，**不要贴整份 YAML**：

```
① 仓库与项目
   新建项目 shop（default ← test/prod 自动就绪）
   仓库 shop（复用凭证 platform:git-acme-ro）；2 个组件共用一次检出

② 组件与构建
   shop-web   typescript / ./web   node-20（复用全局镜像）
   shop-api   go / ./api           go-1.23（平台无，将新建项目级镜像）

③ 配置与密钥
   test 写入 5 个变量；app.yaml 以模板上传（2 个占位符）
   DB_PASSWORD 仅建 key，prod 必填 → 需你填写

④ 流程插入
   test / 商城测试流水线：现有 4 节点 → 新增 2 节点（检出复用 → 构建 → 部署）
```

4. 逐条处理 `acknowledge_required`：每条都要用户明确回答；即使说"不用管"也要记为明确否定 → 移除对应变更或直接停止。
5. `blockers` 非空 → 逐条给整改建议并**停止**，不要"先 apply 一部分"。
6. `warnings` 非空 → 逐条一句话告知，不阻断 apply（典型：`verify_flow_missing` 表示没有可自动验证的流程）。
7. plan 有效期 30 分钟（`expires_at`），过期必须重跑。`acknowledge` 是 plan 之后才回填的，不参与指纹；除它以外任何 payload 改动都要重跑 plan。
8. 最后问一句"确认执行吗？"。

退出条件：用户显式确认 + `acknowledge` 已回填 + `blockers` 为空。

---

## 阶段 3 · 执行

1. 调 `ease_ops_apply_onboarding { plan_id, payload }`。
2. `status: applied` → 进入阶段 4。
3. `pre_build_blockers` 非空 → 按 `code` 分流（已落地项不回滚，也不影响手工构建）：
   - `credential_not_found` / `credential_purpose_mismatch` / `credential_disabled`：调 `ease_ops_request_secret { project, name, purpose }`，把返回的 `url` 原样给用户，说明这项凭证的用途与影响哪些环境，然后**等待**；用户说填好后调 `ease_ops_get_secret_request { project, request_id }`，`filled` 就用返回的 `credential_ref` 重跑 plan + apply（resume）。
   - 其他密钥类：v1 还没有环境变量 intake，提示用户到项目环境设置里手工添加，再重跑 plan；**不要**把值写进 payload，也不要调 `request_secret`。
4. `status: partial` → 展示 `applied[]` 与 `failed_at`，**不要自动重试**；给出 resume 或人工介入建议。
5. `permission_denied` → 说明缺哪个权限、找谁开，停止。
6. `verify` 出现时看 `verify.status`：`triggered` 拿 `flow_run_id` 进入阶段 4 的验证；`skipped` / `failed` 把 `verify.hint` 翻译给用户（跳过不代表接入失败，只是没有自动验证）。

退出条件：applied，或 partial 且有明确下一步。

---

## 阶段 4 · 交接

必须给出四件东西：

1. **深链**：项目、流水线；优先用返回的 `links`，为空时调 `ease_ops_console_links`，不要自己拼 URL。
2. **状态文件**：把 `state` 原样写入 `.ease-ops/onboarding.json`（只含 id / code，禁止 secret）。
3. **待复核清单**：所有"由平台或你推断、用户尚未确认"的项——产物路径、启动命令、`runtime`、`checkout_mode`。
4. **下一步**：可选验证。`payload.verify.build=true` 且 apply 返回 `verify.status=triggered` 时，按 `references/verify.md` 的循环轮询 `ease_ops_get_flow_run`，失败用 `ease_ops_diagnose_flow_run` 定位；没有自动验证时，用 `ease_ops_trigger_flow_run` 在 `test` 环境手动触发一次（即 `/ease-ops:verify`）。

---

## 失败处置

完整码表、逐码话术与 `apply_partial` 报告模板见 `references/errors.md`。三条铁律不变：

- `fixable: true` 的错误只允许在**阶段 2** 修正 payload 后重跑 plan，最多一次。
- 阶段 3 的任何失败都不得自动重试。
- 连续两次 plan 失败 → 停下来向用户说明卡点，不要继续猜。

---

## 不要做

- 不创建 Local 定制镜像（需要构建，超出接入范围）。
- 不创建环境（`default` / `test` / `prod` 由平台在创建项目时自动初始化）。
- 不修改既有流程拓扑（只做"追加一条并行分支 + 检出复用"）。
- 不在用户未提及部署时启用 `deploy`。
- 不在 payload 里写平台内部 ID（镜像版本 / registry / host）；状态文件只存 apply 返回的 `state`。
