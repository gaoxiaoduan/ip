# 领域文档

本文说明工程技能在探索代码库时应如何读取本仓库的领域文档。

## 开始探索前读取以下内容

- 仓库根目录中的 **`CONTEXT.md`**；或者
- 如果根目录中存在 **`CONTEXT-MAP.md`**，它会指向每个上下文对应的 `CONTEXT.md`。请读取与当前主题有关的所有上下文文档。
- **`docs/adr/`**：读取与即将处理的代码区域相关的 ADR。在多上下文仓库中，还应检查 `src/<context>/docs/adr/` 中特定上下文的决策。

如果其中任何文件不存在，请**直接继续，不要提示**。不要报告文件缺失，也不要预先建议创建这些文件。`/domain-modeling` 技能会在术语或决策真正确定时按需创建它们；该技能可以通过 `/grill-with-docs` 和 `/improve-codebase-architecture` 使用。

## 文件结构

单上下文仓库（适用于绝大多数仓库）：

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多上下文仓库（根目录中存在 `CONTEXT-MAP.md`）：

```text
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← 系统级决策
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← 特定上下文的决策
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## 使用术语表中定义的词汇

当输出内容需要命名某个领域概念时，例如 Issue 标题、重构建议、假设或测试名称，请使用 `CONTEXT.md` 中定义的术语。不要改用术语表明确排除的同义词。

如果术语表中还没有需要使用的概念，这是一个需要留意的信号：你可能正在创造项目并未使用的语言，此时应重新考虑；也可能确实存在领域模型缺口，此时应记录下来，交给 `/domain-modeling` 处理。

## 标明与 ADR 的冲突

如果输出内容与已有 ADR 冲突，请明确指出，而不是默默覆盖原有决策：

> _与 ADR-0007（事件溯源订单）冲突——但值得重新讨论，因为……_
