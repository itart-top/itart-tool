# payload v1 · `.ease-ops/onboarding.yaml`

`ease_ops_plan_onboarding` 与 `ease_ops_apply_onboarding` 的**唯一输入**。Skill 写它，平台读它，人审它。

## 三条铁律

违反任意一条，plan 直接返回错误，不会"尽力而为"：

| # | 规则 | 错误码 |
|---|---|---|
| 1 | 未知字段不忽略，直接报错 | `unknown_field` |
| 2 | 密钥的值永远不出现，只出现 key + `secret: true` | `secret_in_payload` |
| 3 | 平台内部 ID 永远不出现，只用 code / name / 逻辑名 | `platform_id_forbidden` |

另有一条形态约束：**不写 `null`**。未设置就用空字符串 `""` 或省略字段。

---

## 1. 顶层

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `version` | int | ✅ | — | 固定 `1` |
| `mode` | enum | | `auto` | `auto` / `new_project` / `add_component` |
| `project` | object | | — | 见 §2；`mode=add_component` 时必填 |
| `repos` | array | ✅ | — | 见 §3，至少 1 项 |
| `components` | array | ✅ | — | 见 §4，至少 1 项 |
| `checkout_mode` | enum | | `shared` | `shared` / `separate` |
| `configs` | array | | `[]` | 环境变量，见 §5 |
| `resources` | array | | `[]` | 配置模板文件，见 §6 |
| `flows` | array | | `[]` | 流程插入，见 §7 |
| `acknowledge` | string[] | | `[]` | 回填 plan 的 `acknowledge_required[].code` |
| `verify` | object | | `{build:false,env:test}` | `build`(bool) / `env`(string) |

`mode` 的取值由**阶段 0 的事实**决定，不由用户措辞决定：直接采用 `resolve_repo` 返回的 `mode`（`new_project` / `add_component` / `ambiguous`）；只有 `ambiguous` 时等用户选完（或选"新建项目"）才定。

---

## 2. `project`

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `strategy` | enum | | `auto` | `auto` / `create` / `use` |
| `name` | string | `create` 时 ✅ | — | 展示名，中文可 |
| `code` | string | | 由仓库名 slug 化 | `^[a-z][a-z0-9-]{1,31}$`，项目内唯一 |

- `strategy: use` 表示"接进已有项目"，此时 `code` 必填，且必须能命中；命中失败 → `project_not_found`。
- 环境树（`default` 根 + `test` / `prod`）与 share flow 由平台在建项目时自动初始化，**payload 不描述环境**。

---

## 3. `repos[]`

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `key` | string | ✅ | — | `^[a-z][a-z0-9-]{0,31}$`，组件用它引用；不用 URL 当键 |
| `url` | string | ✅ | — | 归一化后的 git URL（去 `.git`、ssh/https 等价） |
| `branch` | string | | 见下 | 检出节点使用的分支；本地仓库（`file://` / 绝对路径）必填，否则被 `repo_branch_required` 阻断 |
| `credential_ref` | string | | — | `platform:<name>` / `project:<name>` / `<name>` |
| `checkout_dir` | string | | 由 URL 末段派生 | 工作区下的检出目录名 |
| `origin` | enum | | `root` | `root` / `submodule` / `nested` |

**`branch` 的取值**：优先填 `ease_ops_probe_repo` 返回的 `repos[].default_branch`，其次本地 `git branch --show-current`。未填时：复用仓库继承其 `default_branch`；远端仓库（含自建 Git）按 `main` 处理并给出 `repo_branch_defaulted` 警告；本地仓库没有远端默认分支，直接被 `repo_branch_required` 阻断。分支不存在 → `branch_not_found`。

**仓库类型由平台推断**：`github.com` / `gitlab` / `gitee` 按域名归类，自建 Git（如 `git.company.com`）归通用 `git`，本地路径或 `file://` 归 `local`。类型只影响仓库元数据与默认分支策略，检出统一按 URL 走；payload 不提供 type 字段。

**`origin` 的语义**：`root` 是当前工作目录所在仓库；`submodule` / `nested` 只在用户明确要求接入时才出现，否则应写进 plan 的 `nested.detected_but_skipped`，不进 payload。

`credential_ref` 只写引用，不写用户名密码。解析顺序：

| 写法 | 解析范围 |
|---|---|
| `platform:<name>` | 只在平台级凭证里找，找不到 → `credential_not_found` |
| `project:<name>` | 只在目标项目里找 |
| `<name>` | 先项目级、再平台级；两处同名同时命中 → 报 `code_conflict`，要求加前缀 |

purpose 只有三类：`git_https` / `git_ssh` / `deploy`。用错 purpose → `credential_purpose_mismatch`。凭证还没建也能继续：留空即可，plan 会把它记进 `secret_requirements`，apply 后落在 `pre_build_blockers`。

---

## 4. `components[]`

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `code` | string | ✅ | — | `^[a-z][a-z0-9-]{2,47}$`，项目内唯一 |
| `name` | string | ✅ | — | 展示名 |
| `repo_refs` | string[] | ✅ | — | `repos[].key`，第 1 项是**主仓库** |
| `work_dir` | string | | `.` | 相对**主仓库根**的构建目录 |
| `languages` | string[] | | `[unknown]` | 见下方枚举 |
| `build` | object | ✅ | — | 见 §4.1 |
| `deploy` | object | | `{enabled:false}` | 见 §4.2 |

`languages` 合法值（平台枚举，照抄，别自造）：`java` `go` `python` `javascript` `typescript` `ruby` `php` `c` `swift` `rust` `react` `vue` `node` `unknown`。

### 4.1 `build`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `kind` | enum | ✅ | `script` / `docker` |
| `runtime` | string | `kind=script` 时 ✅ | 逻辑名，如 `go-1.23` / `node-20` |
| `script` | string | `kind=script` 时 ✅ | 在 `work_dir` 下执行的 shell |
| `dockerfile` | string | `kind=docker` 时 | 相对 `work_dir`，默认 `./Dockerfile` |
| `artifacts` | array | ✅ | 构建产物声明，至少 1 项 |

`artifacts[]`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | ✅ | 产物标识，如 `dist` / `api-binary` |
| `required` | bool | | 默认 `true`；缺失时构建判失败 |
| `rules` | array | ✅ | `[{ work_dir: ".", patterns: ["dist/**"] }]` |

`runtime` 的解析规则（详见设计文档 §4.7）：

1. 只写逻辑名或白名单内的完整镜像名；不写 `image_version_id`、不写 registry 前缀（除非兜底）。
2. 解析顺序：全局目录 → 项目目录 → 未命中则**新建项目级 Ref 镜像**（纯 DB 写，不触发构建）。
3. `kind=docker` 不需要 `runtime`——Dockerfile 自带 `FROM`。

### 4.2 `deploy`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `enabled` | bool | ✅ | 默认 `false`；用户没提部署就别开 |
| `credential_ref` | string | `enabled=true` 时 ✅ | 主机凭证 |
| `start_command` | string | | 启动命令 |
| `stop_command` | string | | 停止命令 |
| `status_command` | string | | 健康检查命令 |
| `targets` | array | | `[{ host_ref: "prod-11", port: 22 }]`，`host_ref` 是主机可读名 |

---

## 5. `configs[]`（环境变量）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `key` | string | ✅ | 变量名，如 `DB_HOST` |
| `scope` | enum | ✅ | `project` / `component` |
| `component` | string | `scope=component` 时 ✅ | 组件 `code` |
| `values` | map | | `{ test: "...", prod: "" }`，键是环境节点 code |
| `secret` | bool | | 默认 `false` |
| `required` | string[] | | 如 `["prod"]`，表示这些环境必须由人填 |

规则：

- **`secret: true` 时禁止出现 `values`**，连空字符串都不行——出现即 `secret_in_payload`。只留 key，值走 intake。
- `values` 的空字符串 = "未设置"，不是"设为空"。平台据此区分"没配"和"配成空串"。
- `test` 可写非密默认值；`prod` 一律留空 + `required: ["prod"]`。
- 同一 key 在同一 scope 下重复 → `code_conflict`。

---

## 6. `resources[]`（配置模板）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `rel_path` | string | ✅ | 环境内唯一路径，如 `config/app.yaml` |
| `kind` | enum | ✅ | `yaml` / `properties` / `compose` / `shell` / `other` |
| `component` | string | | 组件级资源才填；省略即项目级 |
| `from` | string | | 仓库内来源路径，仅用于溯源与审计 |
| `content` | string | ✅ | **模板正文**，占位符写成 `${VAR}` |
| `placeholders` | string[] | ✅ | 正文里出现的 `${VAR}`，平台据此校验 |
| `values` | map | | `{ test: true, prod: true }`，哪些环境下发 |

- `content` 由 Skill 读取仓库文件后内联；平台不 clone 仓库，别写"参考仓库里的 xxx"。
- `placeholders` 与实际 `${VAR}` 不一致 → `placeholders_unresolved`。
- `content` 里出现疑似真实密钥 → `secret_in_config_file`，**先整改仓库**，不要试图脱敏后上传。

---

## 7. `flows[]`

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `env` | string | ✅ | — | 只能是环境树已有节点：`test` / `prod` |
| `target` | enum | ✅ | — | `existing`（插入已有流程）/ `new`（新建） |
| `name` | string | ✅ | — | 流程名，`existing` 时必须精确命中 |
| `action` | enum | ✅ | — | `insert` / `skip` |
| `strategy` | enum | | `deploy_sequence` | `deploy_sequence` / `deploy_parallel` |
| `template` | string | | `null` | 仅 `target=new` 时可覆盖模板名 |

- `env: staging` 之类 → `warning: env_unsupported`，降级为 `test`，plan 里明说。
- `target=existing` 但流程不存在 → `flow_not_found`（可自愈：改 `target: new`）。
- v1 只做"追加一条并行分支 + 检出复用"，**不改既有节点**。

---

## 8. `acknowledge` / `verify`

`acknowledge` 必须覆盖 plan 返回的全部 `acknowledge_required[].code`，缺一个 → `ack_missing`，apply 拒绝。

已知的 ack code：

| code | 触发 |
|---|---|
| `shared_repo` | 该 git 已被其他项目使用，用户仍要新建项目接入 |
| `config_value_changed:<KEY>` | 覆盖已有非密值 |

`verify.build: true` 时 apply 成功后会先发布流程快照、再触发一次构建，返回 `verify: {env, flow, flow_id, flow_run_id, status, hint}` 与顶层 `flow_run_id`。

- `verify.env` 只能是 `test` / `prod`，缺省 `test`；`flows[]` 里必须有该环境的流程，否则 `verify.status=skipped`；
- `pre_build_blockers` 非空时不会触发（先把凭证 / 密钥补齐）；
- `verify.status=failed` 不影响 `status=applied`，接入结果不回滚；处置见 `references/verify.md`。

默认 `false`，构建验证交给 `/ease-ops:verify`。

---

## 9. 完整 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ease-ops onboarding payload v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "repos", "components"],
  "properties": {
    "version": { "const": 1 },
    "mode": { "enum": ["auto", "new_project", "add_component"], "default": "auto" },
    "project": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "strategy": { "enum": ["auto", "create", "use"], "default": "auto" },
        "name": { "type": "string", "minLength": 1 },
        "code": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,31}$" }
      }
    },
    "repos": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["key", "url"],
        "properties": {
          "key": { "type": "string", "pattern": "^[a-z][a-z0-9-]{0,31}$" },
          "url": { "type": "string", "minLength": 1 },
          "branch": { "type": "string" },
          "credential_ref": { "type": "string" },
          "checkout_dir": { "type": "string" },
          "origin": { "enum": ["root", "submodule", "nested"], "default": "root" }
        }
      }
    },
    "components": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["code", "name", "repo_refs", "build"],
        "properties": {
          "code": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,47}$" },
          "name": { "type": "string", "minLength": 1 },
          "repo_refs": { "type": "array", "minItems": 1, "items": { "type": "string" } },
          "work_dir": { "type": "string", "default": "." },
          "languages": {
            "type": "array",
            "items": {
              "enum": ["java", "go", "python", "javascript", "typescript", "ruby",
                       "php", "c", "swift", "rust", "react", "vue", "node", "unknown"]
            }
          },
          "build": {
            "type": "object", "additionalProperties": false,
            "required": ["kind", "artifacts"],
            "properties": {
              "kind": { "enum": ["script", "docker"] },
              "runtime": { "type": "string" },
              "script": { "type": "string" },
              "dockerfile": { "type": "string", "default": "./Dockerfile" },
              "artifacts": {
                "type": "array", "minItems": 1,
                "items": {
                  "type": "object", "additionalProperties": false,
                  "required": ["name", "rules"],
                  "properties": {
                    "name": { "type": "string" },
                    "required": { "type": "boolean", "default": true },
                    "rules": {
                      "type": "array", "minItems": 1,
                      "items": {
                        "type": "object", "additionalProperties": false,
                        "required": ["patterns"],
                        "properties": {
                          "work_dir": { "type": "string", "default": "." },
                          "patterns": { "type": "array", "minItems": 1, "items": { "type": "string" } }
                        }
                      }
                    }
                  }
                }
              }
            },
            "allOf": [
              {
                "if": { "properties": { "kind": { "const": "script" } } },
                "then": { "required": ["runtime", "script"] }
              }
            ]
          },
          "deploy": {
            "type": "object", "additionalProperties": false,
            "required": ["enabled"],
            "properties": {
              "enabled": { "type": "boolean", "default": false },
              "credential_ref": { "type": "string" },
              "start_command": { "type": "string" },
              "stop_command": { "type": "string" },
              "status_command": { "type": "string" },
              "targets": {
                "type": "array",
                "items": {
                  "type": "object", "additionalProperties": false,
                  "required": ["host_ref"],
                  "properties": {
                    "host_ref": { "type": "string" },
                    "port": { "type": "integer", "minimum": 1, "maximum": 65535 }
                  }
                }
              }
            }
          }
        }
      }
    },
    "checkout_mode": { "enum": ["shared", "separate"], "default": "shared" },
    "configs": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["key", "scope"],
        "properties": {
          "key": { "type": "string", "pattern": "^[A-Z][A-Z0-9_]*$" },
          "scope": { "enum": ["project", "component"] },
          "component": { "type": "string" },
          "values": { "type": "object", "additionalProperties": { "type": "string" } },
          "secret": { "type": "boolean", "default": false },
          "required": { "type": "array", "items": { "type": "string" } }
        },
        "allOf": [
          {
            "if": { "properties": { "secret": { "const": true } }, "required": ["secret"] },
            "then": { "not": { "required": ["values"] } }
          }
        ]
      }
    },
    "resources": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["rel_path", "kind", "content", "placeholders"],
        "properties": {
          "rel_path": { "type": "string" },
          "kind": { "enum": ["yaml", "properties", "compose", "shell", "other"] },
          "component": { "type": "string" },
          "from": { "type": "string" },
          "content": { "type": "string" },
          "placeholders": { "type": "array", "items": { "type": "string" } },
          "values": { "type": "object", "additionalProperties": { "type": "boolean" } }
        }
      }
    },
    "flows": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["env", "target", "name", "action"],
        "properties": {
          "env": { "type": "string" },
          "target": { "enum": ["existing", "new"] },
          "name": { "type": "string", "minLength": 1 },
          "action": { "enum": ["insert", "skip"] },
          "strategy": { "enum": ["deploy_sequence", "deploy_parallel"], "default": "deploy_sequence" },
          "template": { "type": ["string", "null"] }
        }
      }
    },
    "acknowledge": { "type": "array", "items": { "type": "string" } },
    "verify": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "build": { "type": "boolean", "default": false },
        "env": { "type": "string", "default": "test" }
      }
    }
  }
}
```

---

## 10. 正例

### 10.1 场景 1：前后端同仓（monorepo → 两个组件共用一次检出）

```yaml
version: 1
mode: new_project
project: { strategy: create, name: 商城, code: shop }
repos:
  - { key: shop, url: git@github.com:acme/shop.git, branch: main,
      credential_ref: platform:git-acme-ro, checkout_dir: shop, origin: root }
components:
  - code: shop-web
    name: 商城前端
    repo_refs: [shop]
    work_dir: ./web
    languages: [typescript]
    build:
      kind: script
      runtime: node-20
      script: npm ci && npm run build
      artifacts:
        - { name: dist, required: true, rules: [{ work_dir: ".", patterns: ["dist/**"] }] }
  - code: shop-api
    name: 商城后端
    repo_refs: [shop]
    work_dir: ./api
    languages: [go]
    build:
      kind: script
      runtime: go-1.23
      script: go build -o bin/api ./cmd/api
      artifacts:
        - { name: api-binary, required: true, rules: [{ work_dir: ".", patterns: ["bin/api"] }] }
checkout_mode: shared
configs:
  - { key: DB_HOST, scope: project, values: { test: 10.0.0.5 } }
  - { key: DB_PASSWORD, scope: project, secret: true, required: [prod] }
  - { key: VITE_API_BASE, scope: component, component: shop-web,
      values: { test: "http://test-api", prod: "https://api" } }
resources:
  - rel_path: config/app.yaml
    kind: yaml
    component: shop-api
    from: ./api/config/app.yaml
    content: |
      db:
        host: ${DB_HOST}
        password: ${DB_PASSWORD}
    placeholders: [DB_HOST, DB_PASSWORD]
    values: { test: true, prod: true }
flows:
  - { env: test, target: existing, name: 商城测试流水线, action: insert, strategy: deploy_sequence }
acknowledge: []
verify: { build: false, env: test }
```

### 10.2 场景 2：已有项目加一个组件并插入流程

```yaml
version: 1
mode: add_component
project: { strategy: use, code: shop }
repos:
  - { key: shop, url: git@github.com:acme/shop.git, branch: main,
      credential_ref: platform:git-acme-ro }
components:
  - code: shop-worker
    name: 商城任务worker
    repo_refs: [shop]
    work_dir: ./services/worker
    languages: [go]
    build:
      kind: script
      runtime: go-1.23
      script: go build -o bin/worker ./cmd/worker
      artifacts:
        - { name: worker-binary, required: true, rules: [{ work_dir: ".", patterns: ["bin/worker"] }] }
checkout_mode: shared
flows:
  - { env: test, target: existing, name: 商城测试流水线, action: insert, strategy: deploy_parallel }
acknowledge: []
```

### 10.3 多仓：后端 + 独立前端仓库

```yaml
version: 1
mode: new_project
project: { strategy: create, name: 商城, code: shop }
repos:
  - { key: api, url: git@github.com:acme/shop-api.git, branch: main, credential_ref: platform:git-acme-ro }
  - { key: web, url: git@github.com:acme/shop-web.git, branch: main, credential_ref: platform:git-acme-ro }
components:
  - code: shop-api
    name: 商城后端
    repo_refs: [api]
    work_dir: .
    languages: [go]
    build:
      kind: script
      runtime: go-1.23
      script: go build -o bin/api ./cmd/api
      artifacts: [{ name: api-binary, rules: [{ patterns: ["bin/api"] }] }]
  - code: shop-web
    name: 商城前端
    repo_refs: [web]
    work_dir: .
    languages: [node]
    build:
      kind: script
      runtime: node-20
      script: npm ci && npm run build
      artifacts: [{ name: dist, rules: [{ patterns: ["dist/**"] }] }]
checkout_mode: separate
```

### 10.4 最小 payload：只接组件，不碰流程和配置

```yaml
version: 1
repos:
  - { key: demo, url: git@github.com:acme/demo.git }
components:
  - code: demo-api
    name: Demo
    repo_refs: [demo]
    build:
      kind: docker
      dockerfile: ./Dockerfile
      artifacts: [{ name: image, rules: [{ patterns: ["Dockerfile"] }] }]
```

---

## 11. 反例（平台会拒绝）

| 反例 | 错误码 | 正确写法 |
|---|---|---|
| `configs: [{key: DB_PASSWORD, secret: true, values: {prod: "hunter2"}}]` | `secret_in_payload` | 删掉 `values`，留 `required: [prod]` |
| `runtime: 12`（镜像是数字 ID） | `platform_id_forbidden` | `runtime: go-1.23` |
| `targets: [{host_id: 7}]` | `platform_id_forbidden` | `targets: [{host_ref: "prod-11", port: 22}]` |
| `work_dir: ../shop-web`（指向非主仓库） | `work_dir_not_found` | 组件只在自己主仓库内取目录 |
| `flows: [{env: staging, ...}]` | `warning: env_unsupported` | `env: test` |
| `build: {kind: script, script: "make build"}`（缺 runtime） | `runtime_required` | 补 `runtime: <逻辑名>` |
| `languages: [cpp]` | `schema_invalid`（枚举不匹配） | `c`（C/C++ 统一记 `c`） |
| `configs: [{key: db.host, scope: project}]` | `config_key_invalid`（格式不符） | `DB_HOST` |
| `repos: [{url: ...}]`（缺 key） | `schema_invalid`（缺必填） | 补 `key` |

---

## 12. 幂等

| 对象 | 幂等键 |
|---|---|
| 仓库 | `repos[].url` 归一化值 |
| 项目 | `project.code` |
| 组件 | `project.code` + `component.code` |
| 运行时镜像 | 逻辑名 + `scope` |
| 环境变量 | `env` + `scope` + `component` + `key` |
| 配置资源 | `env` + `rel_path` |
| 流程插入 | `env` + `flow.name` |

同一份 payload 连续 plan 两次，第二次只应产出 `reuse` / `update` / `skip`；出现新的 `create` 说明幂等键没对上，要查 payload 而不是重跑 apply。

---

## 13. 四个容易判断错的点

| 场景 | 判断 |
|---|---|
| 前后端同仓、同一个 `package.json` 顶层 | 仍是两个组件：`work_dir` 分别是 `./web` `./api`，`checkout_mode: shared` |
| 前端仓 + 后端仓，业务上是一个系统 | 两个 `repos`，两个组件，各自 `repo_refs`，`checkout_mode: separate` |
| 仓库里有 `docker-compose.yml` 但没有 Dockerfile | 不是 docker 构建；按 `script` 构建，compose 只作为 `resources[]` 的模板素材 |
| 用户说"用最新版 node" | 不写 `node`（无 tag），写 `node-20` 这类逻辑名；无法判断时先 `list_runtime_images` 查目录 |
