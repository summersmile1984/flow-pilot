<p align="center">
  <strong>Flow Pilot</strong>
</p>

<p align="center">
  One cockpit for every AI coding agent — <em>orchestrate</em>, don't just switch.
</p>

<p align="center">
  <a href="https://github.com/summersmile1984/flow-pilot/releases"><img alt="Release" src="https://img.shields.io/github/v/release/summersmile1984/flow-pilot?style=flat-square&color=1677ff" /></a>
  <a href="https://github.com/summersmile1984/flow-pilot/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/summersmile1984/flow-pilot?style=flat-square" /></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen?style=flat-square" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-40-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#简体中文">简体中文</a>
</p>

---

## English

**Flow Pilot** is a cross-platform desktop app that puts Claude Code, Codex, and any ACP-compatible agent behind a single window — and adds an orchestration layer on top so a supervisor can route work across them automatically. Run agents side by side without losing context, sessions, or tool state.

### What makes it different

Most "AI coding" tools let you talk to **one** agent. Flow Pilot is built around running **many** — and coordinating them.

- **🧭 Pilot — a supervisor that orchestrates agents, not just switches them.**
  The Pilot engine is a [Mastra](https://mastra.ai)-powered supervisor: it wraps every configured ACP agent as a callable tool, then **routes each task to the best agent by its declared strengths** — and can delegate several subtasks **in parallel**. A cheap model does the dispatching; specialized agents (Claude Code, Codex, OpenCode, or your own) do the heavy lifting. Configure the roster in `.pilot/config.yaml`; no other tool ships this.

- **🔀 One app, every agent.** Claude Code (Anthropic Agent SDK), Codex (app-server), and any Agent Client Protocol agent run in parallel, each with its own history and context. Switch instantly, nothing resets.

- **📚 Skills — reusable playbooks.** Drop a `SKILL.md` under `.pilot/skills/<name>/` (per-project) or `~/.pilot/skills` (global). The supervisor and agents load the relevant skill on demand and fold its steps into the work — version-controlled, shareable know-how instead of copy-pasted prompts.

- **🔍 See what the AI is actually doing.** Every tool call renders as an interactive card — word-level diffs with syntax highlighting, inline bash output, nested subagent progress, and a per-turn Changes panel. Not raw JSON.

- **🛒 Agent Store + local detection.** Browse and one-click-install agents from the community [ACP registry](https://agentclientprotocol.com/get-started/registry), *and* have Flow Pilot auto-detect agents already installed on your machine (PATH binaries and known app bundles) — surfaced right in the store with one-click add.

- **🖥️ A real workspace, not a chat box.** Built-in multi-tab terminal, embedded browser, full git integration, and MCP servers — all scoped per project, all staying mounted while you work.

- **🌏 Bilingual, local-first.** Full English / 简体中文 UI with runtime switching. It's a desktop app: your projects and sessions live on your disk.

### Engines

| Engine | What it does | Requirements |
|--------|--------------|--------------|
| **Pilot** (Mastra supervisor) | Orchestrates multiple ACP agents — routes and delegates tasks by strength | A supervisor LLM (e.g. DeepSeek) + at least one subagent |
| **Claude Code** | Direct 1:1 chat over the Anthropic Agent SDK | Claude account (subscription or API key) |
| **Codex** | Direct 1:1 chat over the Codex app-server | Codex CLI in PATH + OpenAI/ChatGPT |
| **ACP agents** | Any Agent Client Protocol agent, as a direct engine or a Pilot subagent | Agent-specific |

Claude Code and Codex are built in. ACP agents install from the in-app store or a manual command definition (**Settings → Agents**). Configure Pilot's subagent roster in `.pilot/config.yaml`.

### Feature highlights

- **Multi-engine sessions** running in parallel, each with isolated state
- **Rich tool visualization** — diffs, syntax highlighting, nested subagents, Changes panel
- **MCP servers** per project (stdio / SSE / HTTP) with in-app OAuth
- **Git** — stage, commit, push, branches, worktrees, AI commit messages
- **Terminal & browser** panels, mounted per project
- **Projects & Spaces** — organize folders into named, color-coded groups
- **Plan mode & permissions** — Ask First / Accept Edits / Allow All
- **Background task agents** tracked in a dedicated panel
- **Image attachment & annotation**, **voice input** (native or on-device Whisper)
- **Full-text session search**; import & resume Claude Code CLI conversations
- **Jira / Confluence** and other MCP integrations with dedicated UIs

### Quick start

1. **Download** the latest build for your platform from [Releases](https://github.com/summersmile1984/flow-pilot/releases/latest)
2. **Open a project** — point Flow Pilot at any folder on disk
3. **Pick an engine** — Pilot, Claude Code, Codex, or any installed ACP agent — and start working

> Pre-built binaries are **unsigned**. On macOS, right-click the app → **Open** on first launch (or `xattr -dr com.apple.quarantine "Flow Pilot.app"`).

### Development

```bash
git clone https://github.com/summersmile1984/flow-pilot.git
cd flow-pilot
pnpm install
pnpm dev
```

Build installers:

```bash
pnpm dist:mac      # macOS DMG (arm64 + x64)
pnpm dist:win      # Windows NSIS installer
pnpm dist:linux    # Linux AppImage + deb
```

**Stack:** Electron 40 · React 19 · Vite 7 · TypeScript · [Mastra](https://mastra.ai) · [Agent Client Protocol](https://agentclientprotocol.com) · Tailwind CSS v4 · ShadCN · Zustand · i18next.

---

## 简体中文

**Flow Pilot** 是一款跨平台桌面应用：把 Claude Code、Codex 以及任意兼容 ACP 的智能体收进同一个窗口，并在其上加一层**编排能力**——让一个 supervisor 自动在多个智能体之间分派任务。多个智能体并排运行，切换不丢上下文、会话与工具状态。

### 与众不同之处

大多数「AI 编程」工具只让你对话**一个**智能体。Flow Pilot 从设计之初就是为了同时驾驭**多个**——并让它们协作。

- **🧭 Pilot——会编排智能体的 supervisor，而不只是切换。**
  Pilot 引擎是一个基于 [Mastra](https://mastra.ai) 的 supervisor：它把每个配置好的 ACP 智能体包装成可调用的工具，然后**按各智能体声明的擅长领域，把任务路由给最合适的那个**——还能把相互独立的子任务**并行委派**。用一个便宜的模型做调度，让专业智能体（Claude Code、Codex、OpenCode，或你自己的）干重活。在 `.pilot/config.yaml` 里配置这套阵容——这是别的工具没有的能力。

- **🔀 一个应用，所有智能体。** Claude Code（Anthropic Agent SDK）、Codex（app-server）、以及任意 Agent Client Protocol 智能体并行运行，各自拥有独立的历史与上下文。瞬间切换，什么都不重置。

- **📚 Skills——可复用的「剧本」。** 在 `.pilot/skills/<名字>/` （项目级）或 `~/.pilot/skills`（全局）放一个 `SKILL.md`，supervisor 与智能体会按需加载对应技能、把步骤融进工作里。是纳入版本管理、可分享的经验沉淀，而不是反复粘贴的提示词。

- **🔍 看得见 AI 到底在做什么。** 每一次工具调用都渲染成交互卡片——词级别 diff、语法高亮、内联 bash 输出、嵌套子智能体进度、以及每轮的「改动」面板。而不是一堆原始 JSON。

- **🛒 智能体市场 + 本机检测。** 从社区 [ACP registry](https://agentclientprotocol.com/get-started/registry) 浏览并一键安装智能体；同时 Flow Pilot 会**自动检测你本机已装的智能体**（PATH 里的可执行文件和已知 app），直接在市场顶部列出、一键加入。

- **🖥️ 是工作台，不是聊天框。** 内置多标签终端、内嵌浏览器、完整 git 集成、MCP 服务器——全部按项目隔离，工作时一直挂着不重载。

- **🌏 中英双语，本地优先。** 完整的中文 / English 界面，运行时切换。它是桌面应用：你的项目和会话都在你自己的磁盘上。

### 引擎

| 引擎 | 作用 | 前提 |
|------|------|------|
| **Pilot**（Mastra supervisor） | 编排多个 ACP 智能体——按擅长领域路由并委派任务 | 一个 supervisor 模型（如 DeepSeek）+ 至少一个子智能体 |
| **Claude Code** | 基于 Anthropic Agent SDK 的一对一直连 | Claude 账号（订阅或 API key） |
| **Codex** | 基于 Codex app-server 的一对一直连 | PATH 里的 Codex CLI + OpenAI/ChatGPT |
| **ACP 智能体** | 任意 Agent Client Protocol 智能体，可作独立引擎或 Pilot 的子智能体 | 视具体智能体而定 |

Claude Code 与 Codex 内置。ACP 智能体可从应用内市场安装，或手动填写命令定义（**设置 → 智能体**）。Pilot 的子智能体阵容在 `.pilot/config.yaml` 配置。

### 功能一览

- **多引擎会话**并行运行，各自状态隔离
- **丰富的工具可视化**——diff、语法高亮、嵌套子智能体、改动面板
- **MCP 服务器**按项目配置（stdio / SSE / HTTP），应用内完成 OAuth
- **Git**——暂存、提交、推送、分支、worktree、AI 生成 commit 信息
- **终端与浏览器**面板，按项目挂载
- **项目与空间（Spaces）**——把文件夹归入带图标配色的命名分组
- **计划模式与权限**——先问 / 接受编辑 / 全部允许
- **后台任务智能体**，独立面板追踪
- **图片附件与标注**、**语音输入**（系统原生或本地 Whisper）
- **会话全文搜索**；导入并续接 Claude Code CLI 的历史会话
- **Jira / Confluence** 等 MCP 集成，配有专属 UI

### 快速开始

1. 从 [Releases](https://github.com/summersmile1984/flow-pilot/releases/latest) **下载**对应平台的构建
2. **打开一个项目**——把 Flow Pilot 指向磁盘上任意文件夹
3. **选一个引擎**——Pilot、Claude Code、Codex 或任意已装 ACP 智能体——开始工作

> 预构建包**未签名**。macOS 首次启动请右键 app → **打开**（或执行 `xattr -dr com.apple.quarantine "Flow Pilot.app"`）。

### 开发

```bash
git clone https://github.com/summersmile1984/flow-pilot.git
cd flow-pilot
pnpm install
pnpm dev
```

构建安装包：

```bash
pnpm dist:mac      # macOS DMG（arm64 + x64）
pnpm dist:win      # Windows NSIS 安装包
pnpm dist:linux    # Linux AppImage + deb
```

**技术栈：** Electron 40 · React 19 · Vite 7 · TypeScript · [Mastra](https://mastra.ai) · [Agent Client Protocol](https://agentclientprotocol.com) · Tailwind CSS v4 · ShadCN · Zustand · i18next。

---

## License

MIT

<p align="center">
  Built on the <a href="https://agentclientprotocol.com">Agent Client Protocol</a>
</p>
