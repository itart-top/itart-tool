# 验证构建与自动诊断

接入完成后验证一次真实构建，把"能接上"和"能跑通"区分开。验证失败**不等于**接入失败：已落地的项目 / 仓库 / 组件 / 流程都不回滚。

## 1. 触发方式

| 方式 | 前置 | 结果 |
|---|---|---|
| 自动 | `payload.verify.build: true` | apply 成功后自动发布流程快照并触发一次构建，返回 `verify` 与 `flow_run_id` |
| 手动 | 无 | 调 `ease_ops_trigger_flow_run { project?, flow, components }`，版本默认当前时间戳 |

- `verify.env` 只能是 `test` / `prod`，缺省 `test`；`flows[]` 里必须有该环境的流程，否则 `verify.status=skipped`（plan 阶段会先给 `verify_flow_missing` warning）。
- 只有 `pre_build_blockers` 为空才会自动触发；凭证/密钥没补好时直接跑构建没有意义。
- 自动触发需要 `pipeline:run` 权限；手动触发同样需要。

## 2. `verify.status` 处置

| status | 含义 | 你要做的 |
|---|---|---|
| `triggered` | 已发布并触发，`flow_run_id` 可用 | 进入第 3 节的轮询 |
| `skipped` | 前置条件不满足（有 blocker / 没有对应流程 / 未配置 FlowRuns） | 把 `verify.hint` 翻成一句话；不阻断交接，提示用户可手动触发 |
| `failed` | 发布快照或触发失败 | 把 `verify.hint` 翻成一句话；说明接入已完成、只是没有自动验证，并给出手动验证入口 |

`verify.failed` 不要求重跑 apply。只有用户明确要求时才重跑 plan + apply。

## 3. 轮询构建

```
ease_ops_get_flow_run { flow_run_id }
```

- 返回字段与流水线列表一致：`status` / `run_no` / `version` / `detail_url` 等；`detail_url` 直接给用户。
- 每隔几秒轮询一次，状态进入终态（success / failed / ...）就停；不要无间隔刷。
- 也可以用 `ease_ops_list_flow_runs { project?, flow }` 看历史，但验证只关心本次 `flow_run_id`。

## 4. 失败后自动诊断

```
ease_ops_diagnose_flow_run { project?, flow, run_no }
```

`flow` / `run_no` 从上一步的 `get_flow_run` 结果里取。诊断返回 `conclusion`（AI 生成的定位与建议），按下面的优先级转述并给出修复动作：

| 现象 | 常见根因 | 修复 |
|---|---|---|
| 检出失败 | 分支 / 凭证不可用（plan 给过 `repo_branch_defaulted` 而仓库默认分支不是 `main` 是最典型的一种） | 把 `repos[].branch` 改成真实分支（`probe_repo` 的 `default_branch` 或 `git branch -r`）；凭证问题走 `credential_ref` / `request_secret` 补 |
| 找不到 `work_dir` | 组件切分错误 | 改 payload 的 `work_dir`，重跑 plan |
| 构建命令失败 | `script` 与实际项目不符 | 改 `build.script`；对照仓库里的 Makefile / package.json scripts |
| 产物为空 | `artifacts[].rules` 路径不对 | 对齐真实产物路径；`work_dir` 相对的 patterns |
| 镜像拉取失败 | `runtime` 未解析或 registry 不可用 | 换逻辑名或白名单内的完整镜像名 |
| 部署失败 | 启动/停止命令、主机或端口不可用 | 检查 `deploy.*`；未启用部署时忽略 |

规则：

1. 一次只改一个变量，改完重跑 plan + apply（`plan_id` 必须重新签发）。
2. 修复后的重跑同样遵守"apply 不自动重试"：先给用户结论与建议，用户确认后再执行。
3. 诊断内容可能含内部路径 / URL，转述时去掉 token、内网地址等敏感片段。

## 5. 交接口径

- `triggered`：告诉用户"已触发 test 构建，结果页在 `<detail_url>`；失败我会继续诊断"。
- `skipped`：告诉用户"接入已完成，没有自动跑构建，原因是 <hint 翻译>"。
- `failed`：告诉用户"接入已完成，但自动验证没发出去，原因是 <hint 翻译>；可以手动触发"。
- 任何情况下都不要把 `verify` 的失败说成"接入失败"。
