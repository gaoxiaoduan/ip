# Issue 跟踪器：GitHub

本仓库的 Issue 和 PRD 均记录为 GitHub Issue。所有操作均使用 `gh` CLI。

## 操作约定

- **创建 Issue**：`gh issue create --title "..." --body "..."`。多行正文使用 heredoc。
- **读取 Issue**：`gh issue view <number> --comments`，使用 `jq` 筛选评论，同时获取标签。
- **列出 Issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，并按需要使用 `--label` 和 `--state` 过滤。
- **评论 Issue**：`gh issue comment <number> --body "..."`
- **添加或移除标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭 Issue**：`gh issue close <number> --comment "..."`

从 `git remote -v` 推断仓库；在克隆的仓库目录中运行时，`gh` 会自动完成此操作。

## 将 Pull Request 作为 triage 入口

**PRs as a request surface: no.**  
（如果本仓库将外部 PR 视为功能请求，可改成 `yes`；`/triage` 会读取此标志。）

设为 `yes` 后，PR 将使用与 Issue 相同的标签和状态流程，并使用对应的 `gh pr` 命令：

- **读取 PR**：使用 `gh pr view <number> --comments` 查看详情和评论，使用 `gh pr diff <number>` 查看变更。
- **列出待 triage 的外部 PR**：运行 `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，仅保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的 PR；排除 `OWNER`、`MEMBER` 和 `COLLABORATOR`。
- **评论、添加标签或关闭**：使用 `gh pr comment`、`gh pr edit --add-label` / `--remove-label` 和 `gh pr close`。

GitHub 的 Issue 和 PR 共用同一个编号空间，因此单独的 `#42` 可能是 Issue，也可能是 PR。先运行 `gh pr view 42`；如果失败，再运行 `gh issue view 42`。

## 当技能要求“发布到 Issue 跟踪器”时

创建一个 GitHub Issue。

## 当技能要求“获取相关工单”时

运行 `gh issue view <number> --comments`。

## Wayfinding 操作

供 `/wayfinder` 使用。一个 **map** 是包含多个子 Issue 工单的单个 Issue。

- **Map**：一个带有 `wayfinder:map` 标签的 Issue，其正文保存 Notes、Decisions-so-far 和 Fog。使用 `gh issue create --label wayfinder:map` 创建。
- **子工单**：作为 GitHub 子 Issue 与 map 关联，通过子 Issue API 使用 `gh api` 操作。如果仓库未启用子 Issue，则把子工单加入 map 正文中的任务列表，并在子工单正文顶部写入 `Part of #<map>`。标签使用 `wayfinder:<type>`，其中类型为 `research`、`prototype`、`grilling` 或 `task`。工单被认领后，将其分配给负责推进的开发者。
- **阻塞关系**：使用 GitHub 原生 Issue 依赖关系，作为权威且在界面中可见的表示。运行 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` 添加依赖边。`<blocker-db-id>` 必须是阻塞 Issue 的数字数据库 ID，通过 `gh api repos/<owner>/<repo>/issues/<n> --jq .id` 获取；不能使用 `#number` 或 `node_id`。GitHub 的 `issue_dependencies_summary.blocked_by` 只报告仍未关闭的阻塞项，它是当前是否可执行的判断依据。如果原生依赖不可用，则在子工单正文顶部使用 `Blocked by: #<n>, #<n>`。所有阻塞 Issue 关闭后，该工单即解除阻塞。
- **Frontier 查询**：列出 map 下仍处于打开状态的子工单；范围限定为该 map 的子 Issue 或任务列表。剔除存在未关闭阻塞项或已有负责人认领的工单，按 map 中的顺序选择第一个剩余工单。
- **认领**：运行 `gh issue edit <n> --add-assignee @me`。这是会话中的第一次写操作。
- **解决**：先运行 `gh issue comment <n> --body "<answer>"`，再运行 `gh issue close <n>`，最后将上下文指针（gist 和链接）追加到 map 的 Decisions-so-far 中。
