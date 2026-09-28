# Codex Orchestration Starter — GPT-6 Sol update

This starter implements a token-conscious MAIN / SCOUT / MAKER / REVIEWER pattern, with an optional PLANNER for exceptional large-scale work.

## Current model IDs

The official GPT-6 Sol model ID is `gpt-6-sol`.
The reviewer remains `gpt-6-astra` with low reasoning (Astra Light).

Recommended mapping:
- MAIN: `gpt-6-sol` / Medium by default; High only for genuinely difficult primary-thread reasoning
- SCOUT: `gpt-6-sol` / low
- MAKER: `gpt-6-sol` / low
- REVIEWER: `gpt-6-astra` / low
- Optional PLANNER: `gpt-6-sol` / high

## New project

1. Extract this archive.
2. Copy `AGENTS.md` and `.codex/` into the root of the new project.
3. Open the project in Codex.
4. Set the primary/main Codex session to GPT-6 Sol with Medium reasoning.
5. Start a new session so project instructions are loaded cleanly.

Expected layout:

```
my-project/
├─ AGENTS.md
├─ .codex/
│  ├─ config.toml
│  └─ agents/
│     ├─ scout.toml
│     ├─ maker.toml
│     ├─ reviewer.toml
│     └─ optional_planner.toml
└─ ...project files...
```

## Existing project

If the repository already has `AGENTS.md`, merge the orchestration rules instead of overwriting existing build/test/style instructions.
If `.codex/config.toml` already exists, merge the `[agents]` settings instead of replacing unrelated project configuration.
Copy the four agent TOML files into `.codex/agents/`.
Then start a new Codex session.

## Workflow

TRIVIAL:
`MAIN -> direct implementation -> verify`

MEDIUM:
`MAIN -> SCOUT -> MAIN plans -> MAKER -> MAIN verifies`

LARGE:
`MAIN/Orchestrator -> selected SCOUTs -> MAIN integrates/plans -> selected MAKERs -> REVIEWER only if needed -> MAIN`

The optional PLANNER is not part of the normal path. Use it only for large migrations, architecture-heavy work, conflicting scout findings, or complicated multi-maker dependency planning.

## Token-efficiency rules

The point is not to maximize agent count. The point is to keep expensive and persistent context away from agents that do not need it.

- Keep MAIN on GPT-6 Sol rather than Astra.
- Keep SCOUT and MAKER at low reasoning by default.
- Use Astra Reviewer only for escalation.
- Do not pass raw exploration logs to downstream agents.
- Pass compact summaries, plans, relevant files/diffs, and test results only.
- Parallelize only independent work.

## Main-session recommendation

Use:
- Model: GPT-6 Sol (`gpt-6-sol`)
- Reasoning: Medium

Temporarily raise MAIN to High for unusually difficult architecture, debugging, or repository-wide reasoning. Return to Medium afterward.
