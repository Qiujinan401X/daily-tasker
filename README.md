# 今日任务 · 桌面任务小工具

一款轻量、专注的 Windows 桌面待办任务工具。支持多行批量输入、双击编辑、任务置顶、工作/生活/购物标签分类（长按拖排）、已完成分组、勾选删除线动画、本地持久化、默认 7 天有效并可按天延长、窗口一键置顶，以及基于 GitHub Releases 的自动更新。

> 基于 Electron 30 构建。任务数据只保存在本机；安装版启动先进入加载页检测 [GitHub Releases](https://github.com/Qiujinan401X/daily-tasker/releases)，非最新则自动下载并安装，完成后自动重新打开。

***

## ✨ 功能亮点

| 功能 | 说明 |
| --- | --- |
| 🧩 **多行批量输入** | 每行一个任务，按 **Enter** 一键添加；**Shift+Enter** 在输入框内换行 |
| ✏️ **双击编辑** | 双击任务卡片进入内联编辑；**Enter** 保存、**Esc** 取消、失焦保存 |
| 📌 **任务置顶** | 悬停卡片右侧图钉置顶；**每个分类（含未分类）同时只能有一条置顶**，新置顶会顶替同组旧置顶 |
| ⚙️ **完成接力置顶** | 勾选完成置顶任务时，自动取消其置顶并将同分类下一条未完成任务置顶 |
| 🏷️ **标签分类** | 内置「工作 / 生活 / 购物」三标签；列表按标签分组，无标签在「未分类」，勾选完成的任务归入末尾「已完成」 |
| 🔀 **标签拖排** | 输入区下方标签芯片：**点击**选择新建标签，**长按约 0.4s 后拖动**调整分组顺序 |
| ✅ **删除线动画** | 勾选后文字变灰，删除线从左到右 0.45s 展开；取消勾选反向收回 |
| 🎯 **勾选弹跳反馈** | 完成勾选时卡片轻微呼吸弹跳 |
| 🌓 **白天 / 夜间模式** | 打开时按本地时间自动选择（19:00–04:00 夜间，其余白天）；设置中可手动切换 |
| 🪟 **窗口置顶** | 右上角图钉将窗口固定在所有应用之上 |
| 💾 **本地持久化** | 任务、标签顺序与设置写入 `localStorage`，关闭软件不丢失 |
| ⏰ **有效期可延长** | 新建默认 7 天；卡片上点「+1天」按天延长（最长 365 天），过期后自动删除 |
| 🧹 **批量清理已完成** | 底部一键清除已勾选任务，带滑出动画 |
| 🔒 **固定窗口尺寸** | 420×600，不可调整大小，适合放在桌面边角 |
| ⌨️ **无菜单栏** | 移除 Electron 默认菜单栏 |
| 🔄 **自动更新** | 启动加载页检测版本；非最新则自动下载，完成后自动安装并重新打开 |
| 🎨 **白天 / 夜间主题** | 柔和渐变背景与圆角卡片；支持夜间模式 |

***

## 🛠 技术栈

### 运行时与框架

| 层级 | 技术 | 版本 | 作用 |
| --- | --- | --- | --- |
| 运行时 | **Node.js** | 18+ / 22.x | 主进程与构建宿主 |
| 桌面框架 | **Electron** | 30.x | 原生窗口、置顶、打包 |
| 前端核心 | **Chromium**（随 Electron） | V124+ | 渲染 HTML/CSS/JS |
| 包管理 | **npm** | 10.x | 依赖与脚本 |

### 前端技术（渲染层，零框架）

| 技术 | 说明 |
| --- | --- |
| **HTML5** | header / 输入区 / 标签栏 / 分组列表 / footer |
| **CSS3** | 删除线过渡、分组样式、标签菜单层级、拖拽幽灵样式 |
| **原生 JavaScript (ES6+)** | IIFE 封装，无 React/Vue/jQuery |
| **Storage API** | `localStorage` 持久化任务、标签顺序与设置 |
| **Pointer Events** | 标签芯片长按拖拽排序 |

### 构建与开发工具链

| 工具 | 版本 | 作用 |
| --- | --- | --- |
| **electronmon** | 2.x | 开发态监听源码变更并自动重启应用（`npm start`） |
| **electron-builder** | 24.x | 打包 NSIS 安装包与 Portable 便携版，并可发布到 GitHub Releases |
| **electron-updater** | 6.x | 安装版运行时检测 / 下载 / 安装更新 |
| **asar** | 随 electron-builder | 打包为 `app.asar` |
| **NSIS** | 由 electron-builder 下载 | 生成 Windows 安装向导 |

***

## 🏗 软件架构

### 整体进程模型

项目遵循 Electron **双进程 + Preload 桥接** 安全模型：

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron 应用                          │
├──────────────────────────────┬──────────────────────────────┤
│  主进程 (Main Process)       │  渲染进程 (Renderer)         │
│  ─────────────────────────   │  ─────────────────────────   │
│  • Node.js                   │  • index.html / style.css    │
│  • BrowserWindow 管理        │  • renderer.js               │
│  • 窗口置顶 IPC              │    任务 CRUD / 编辑 / 置顶   │
│  • Menu 移除                 │    标签分类 / 长按拖排       │
│  • electron-updater 检测更新 │  • 启动加载页 / 进度 / 进主界面 │
│                              │                              │
│           👆 ────────────── │  nodeIntegration: false      │
│           │  置顶 + 更新 API │  contextIsolation: true      │
├───────────┴──────────────────┴──────────────────────────────┤
│                      preload.js (ContextBridge)             │
│   window.electronAPI = {                                    │
│     toggleAlwaysOnTop() / getAlwaysOnTop()                  │
│     onAlwaysOnTopChanged(callback)                          │
│     getStartupInfo() / checkForUpdates() / installUpdate()  │
│     onUpdateStatus(callback)                                │
│   }                                                        │
└─────────────────────────────────────────────────────────────┘
```

### 安全设计

- **`contextIsolation: true`**：隔离页面脚本与 Electron 内部对象
- **`nodeIntegration: false`**：页面无 `require()`，降低 XSS 放大风险
- **最小 IPC 暴露面**：窗口置顶 + 更新检测 / 安装
- **数据存 localStorage**：无需主进程读写磁盘

### 目录结构

```
daily-tasker/
├── main.js              # 主进程：窗口、置顶 IPC、自动更新并重启
├── preload.js           # ContextBridge 安全 API
├── index.html           # 启动加载页 / 顶部栏 / 输入区 / 标签栏 / 列表 / 底部
├── style.css            # 主题、动画、标签、分组、启动加载页
├── renderer.js          # 任务逻辑、标签、拖排、编辑、过期清理、启动更新流程
├── package.json         # 依赖、electronmon、electron-builder、publish
├── icon.png             # （可选）应用图标
│
├── build-release/       # npm run dist 输出
│   ├── 今日任务 Setup 1.2.1.exe
│   ├── 今日任务 1.2.1.exe
│   ├── latest.yml       # 更新清单（发布到 Releases 必需）
│   └── win-unpacked/
│
└── node_modules/
```

### 模块职责对照

| 文件 | 关键模块 | 负责事项 |
| --- | --- | --- |
| `main.js` | 窗口 / IPC / 更新 | 创建窗口、置顶、检测下载、下载完成后 `quitAndInstall` 自动重启 |
| `preload.js` | ContextBridge | 向渲染进程暴露置顶与更新 API |
| `renderer.js` | 业务逻辑 | 任务 CRUD、标签、编辑、过期、启动加载页状态机 |
| `index.html` / `style.css` | UI | 布局与视觉（含启动加载页） |
| **main.js** | `createWindow()` | 420×600 固定窗口、去菜单栏 |
| | `toggle-always-on-top` / `get-always-on-top` | 窗口置顶 IPC |
| | `setupAutoUpdater` / 更新 IPC | 检测、下载进度、自动安装并重新打开 |
| **preload.js** | `contextBridge` | 注入 `window.electronAPI` |
| **index.html** | `#bootSplash` / `#tagBar` / `#taskList` | 启动加载页、标签栏、分组列表 |
| **style.css** | `.boot-splash` / `.tag-chip` / `.tag-group` | 加载页、标签、分组样式 |
| **renderer.js** | `addTasks` / `startEditTask` | 批量添加、双击内联编辑 |
| | `togglePinTask` / `sortTasks` | 任务置顶与组内排序；每分类仅一条置顶 |
| | `promoteNextPinAfterComplete` / `toggleTask` | 完成置顶任务时自动接力置顶；完成后归入「已完成」 |
| | `setTaskTag` / `render` | 打标签；按 `tagOrder` 分组，未分类在后，「已完成」置底 |
| | `bindTagChipInteractions` | 点击选标签；长按拖动改 `tagOrder` |
| | `initSettings` / `applyTheme` / `themeFromSystemTime` | 打开时按时间选主题；设置面板可手动切换白天 / 夜间 |
| | `cleanupExpired` / `saveTasks` | 7 天过期与持久化 |
| | `initPinBtn` / `runBootSequence` | 窗口置顶与启动检测 / 更新流程 |

### 数据存储结构

**任务** — 键名 `desktop_todo_tasks_v1`：

```js
// localStorage["desktop_todo_tasks_v1"]
[
  {
    "id": "lwk1xabc7u",
    "text": "写周报",
    "completed": false,
    "pinned": false,                 // 是否置顶（已完成任务不会保持置顶）
    "pinnedAt": 1756880000000,       // 置顶时间（用于置顶区内排序）
    "tag": "work",                   // work | life | shopping | null/缺省=未分类
    "durationDays": 7,               // 有效天数（默认 7，可 +1 天延长，上限 365）
    "createdAt": 1756879800000
  }
]
```

**标签顺序** — 键名 `desktop_todo_tag_order_v1`：

```js
// localStorage["desktop_todo_tag_order_v1"]
["work", "life", "shopping"]   // 决定分组展示顺序；未分类在标签之后；「已完成」始终最末
```

**设置** — 键名 `desktop_todo_settings_v1`：

```js
// localStorage["desktop_todo_settings_v1"]
{
  "theme": "light"  // light | dark；每次打开会按本地时间重写默认值
}
```

启动时主题规则：本地时间 **19:00–04:00** → 夜间，其余时间 → 白天。设置面板仍可手动切换（当次会话有效，下次打开仍按时间重置）。

| 标签 id | 显示名 | 说明 |
| --- | --- | --- |
| `work` | 工作 | 可新建 / 可手动选择 |
| `life` | 生活 | 可新建 / 可手动选择 |
| `shopping` | 购物 | 可新建 / 可手动选择 |
| （无） | 未分类 | `tag` 为空；不可在标签栏选「未分类」芯片，不选标签即为此类 |
| （虚拟） | 已完成 | 仅勾选复选框后出现；不可新建时选择、不可在标签菜单中设为「已完成」 |

**组内排序**：置顶优先（每分类最多 1 条）→ 未完成优先 → 其余按 `createdAt` 倒序。置顶另一条任务时，同分类原置顶自动取消。

**过期逻辑**：`Date.now() - createdAt >= durationDays 天` 时删除（缺省 `durationDays=7`）；启动时清理，之后每小时巡检。可在卡片上点「+1天」延长有效期。

### 标签与列表渲染流程

```
新建任务：
  标签栏选中 draftTag（可空；不含「已完成」）→ Enter 添加 → task.tag = draftTag → render()

改标签：
  点击卡片标签按钮 → 下拉选择工作/生活/购物/无标签 → setTaskTag → render()
  （打开菜单时给卡片加 .tag-menu-open，避免被下方卡片遮挡）

勾选完成：
  toggleTask →（若置顶）promoteNextPinAfterComplete → completed=true
  → 短暂动画后 render()，任务进入末尾「已完成」分组
  取消勾选 → 按原 tag 回到对应分组（不恢复置顶）

分组展示：
  for tagId of tagOrder:
    渲染该标签下未完成任务组
  渲染「未分类」（仅当有无标签的未完成任务时）
  最后渲染「已完成」（仅当有已勾选任务时）

标签拖排：
  pointerdown → 约 420ms 长按就绪 → 拖动交换 tagOrder
  → saveTagOrder() → renderTagBar() + render()
```

### 窗口置顶 IPC 时序

```
渲染进程 (右上角 pinBtn)
  → invoke('toggle-always-on-top') → 主进程 setAlwaysOnTop
  ← 返回新状态 → 按钮高亮
主进程 always-on-top-changed → send → 渲染进程二次同步
```

### 自动更新时序（仅安装版 `app.isPackaged`）

```
打开软件 → 显示启动加载页
  → checkForUpdates() 对比 GitHub Releases
已是最新
  → 关闭加载页，进入主界面
有新版本
  → 加载页显示下载进度
  → 下载完成 → quitAndInstall(强制重新打开)
  → 安装后自动启动新版本 → 再次检测为最新 → 进入主界面
检查失败（网络等）
  → 短暂提示后仍进入主界面（不阻断使用）
```

***

## 🚀 快速开始

### 环境要求

| 依赖 | 最低版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 18 | 推荐 20 / 22 LTS |
| npm | ≥ 9 | 随 Node 提供 |
| 操作系统 | Windows 10 / 11 x64 | 打包产物为 64 位 Windows |

### 本地开发运行

```powershell
# 1. 进入项目目录
cd daily-tasker

# 2. 国内环境建议设置 Electron 镜像（首次安装依赖时）
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"

# 3. 安装依赖
npm install

# 4. 启动（electronmon：修改源码后自动重启）
npm start
```

监听文件：`main.js`、`preload.js`、`renderer.js`、`index.html`、`style.css`、`package.json`。

仅启动一次、不监听：

```powershell
npm run start:once
```

### 打包发布

仅本地打包（不上传）：

```powershell
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

npm run dist
```

打包并发布到 GitHub Releases（自动更新依赖此步骤）：

```powershell
# 需有 repo 权限的 GitHub Token（classic: repo 范围）
$env:GH_TOKEN = "ghp_xxxxxxxx"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

# 先把 package.json 的 version 升到新版本，再执行：
npm run dist:publish
```

发布成功后，[Releases](https://github.com/Qiujinan401X/daily-tasker/releases) 中应包含：

- `今日任务 Setup x.y.z.exe`（NSIS，支持自动更新）
- `latest.yml`（更新清单，缺一不可）
- 可选：Portable 便携版 exe

**打包产物**（`build-release/`）：

| 文件 | 用途 |
| --- | --- |
| `今日任务 Setup x.y.z.exe` | NSIS 安装包（**支持自动更新**） |
| `今日任务 x.y.z.exe` | Portable 便携版（**不走自动更新**，需手动换包） |
| `latest.yml` | electron-updater 版本清单 |
| `win-unpacked/` | 绿色解包目录 |

***

## ⌨️ 操作与快捷键

| 作用区域 | 操作 | 行为 |
| --- | --- | --- |
| **任务输入框** | `Enter` | 按行批量添加（带当前选中标签） |
| | `Shift + Enter` | 输入框内换行 |
| | `Esc` | 清空输入框 |
| **标签栏** | 短按芯片 | 选中/取消新建任务的标签 |
| | 长按后拖动 | 调整标签分组顺序 |
| **任务卡片** | 双击 | 内联编辑文本 |
| | 编辑中 `Enter` / `Esc` | 保存 / 取消 |
| | 点击标签按钮 | 修改标签或设为无标签（不可设为「已完成」） |
| | 右侧图钉 | 任务置顶 / 取消置顶（同分类仅保留一条；已完成任务无图钉） |
| | 复选框 | 完成 / 取消完成；完成后进入「已完成」分组 |
| | 「+1天」 | 将该任务有效期延长 1 天（最长 365 天） |
| **窗口** | 右上角齿轮 | 打开设置：白天 / 夜间模式切换（打开软件时已按系统时间自动选择） |
| | 右上角图钉 | 窗口始终置顶 |
| **启动加载页** | （自动） | 检测版本；下载更新；完成后自动安装并重新打开 |
| **底部** | 「清除已完成」 | 批量移除已完成任务 |

***

## ⚙️ 关键可调参数

`renderer.js` 顶部：

```js
const STORAGE_KEY   = 'desktop_todo_tasks_v1';
const TAG_ORDER_KEY = 'desktop_todo_tag_order_v1';
const SETTINGS_KEY  = 'desktop_todo_settings_v1';
const EXPIRE_DAYS   = 7;     // 新建任务默认有效天数
const EXTEND_DAYS   = 1;     // 每次延长天数
const MAX_DURATION_DAYS = 365;
const LONG_PRESS_MS = 420;   // 标签长按触发拖拽的毫秒
```

内置标签定义：

```js
const TAG_DEFS = {
  work: { id: 'work', name: '工作' },
  life: { id: 'life', name: '生活' },
  shopping: { id: 'shopping', name: '购物' }
};
// 「已完成」为虚拟分组 DONE_GROUP_ID，不在 TAG_DEFS / 标签栏中
```

默认设置：

```js
const DEFAULT_SETTINGS = {
  theme: 'light'  // 打开时由 themeFromSystemTime() 覆盖：19–4 点为 dark
};
```

`main.js` 窗口参数：

```js
{
  width: 420, height: 600,
  resizable: false,
  maximizable: false,
  alwaysOnTop: false,       // true = 启动即窗口置顶
  autoHideMenuBar: true
}
```

`package.json` 中 `electronmon.patterns` 可调整开发监听范围；`build.publish` 指向 GitHub 仓库 `Qiujinan401X/daily-tasker`。

自定义图标：根目录放置 **512×512 PNG** 命名为 `icon.png`。

***

## 🧭 常见问题

### ❓ `npm install` 时 Electron 下载失败（ECONNRESET）

国内网络访问官方源不稳定时，先设置镜像再安装：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm install
```

### ❓ 打包提示 "winCodeSign 解压失败 / 符号链接创建失败"

项目已配置 `"signAndEditExecutable": false`，并建议 `CSC_IDENTITY_AUTO_DISCOVERY=false`，跳过签名与 winCodeSign 下载。

### ❓ 自动更新不生效？

1. 必须使用 **Setup 安装版**（NSIS），Portable 与 `npm start` 开发态不会走更新
2. GitHub Releases 需包含对应版本的 `latest.yml` 与 Setup 安装包
3. 本机需能访问 `github.com`（必要时配置代理）
4. 新版本号必须高于当前安装版本（修改 `package.json` 的 `version` 后再 `dist:publish`）

### ❓ `dist:publish` 报 401 / 权限错误？

设置有效的 `GH_TOKEN`（对 `Qiujinan401X/daily-tasker` 有写 Releases 权限），再执行 `npm run dist:publish`。

### ❓ 任务数据存在哪？

```
%APPDATA%\今日任务\Local Storage\leveldb\
```

卸载后若要清空任务，删除该目录相关数据即可。

### ❓ Portable 版和安装版有什么区别？

- **Portable**：单 exe，适合临时使用；用户数据仍在 `%APPDATA%`；**不支持自动更新**
- **Setup**：安装到本机，带桌面与开始菜单快捷方式；**支持自动更新**

### ❓ 改代码后窗口没有自动重启？

确认使用的是 `npm start`（electronmon），而不是 `npm run start:once`。仅上述 `patterns` 内文件变更会触发重启。

### ❓ 可以做成 macOS / Linux 版吗？

可以。在 `package.json` 的 `build` 中增加对应 target，在目标系统执行 `npm run dist`。

***

## 📝 版本历史

| 版本 | 日期 | 主要变更 |
| --- | --- | --- |
| 1.3.0 | 2026-09-09 | 任务有效期可按天延长：卡片「+1天」按钮；新增 `durationDays` 字段（默认 7，上限 365） |
| 1.2.4 | 2026-09-04 | 打开软件时按系统时间自动选择白天 / 夜间（19:00–04:00 夜间） |
| 1.2.3 | 2026-09-04 | 完成置顶接力改为默认行为；设置改为白天 / 夜间模式切换 |
| 1.2.2 | 2026-09-04 | 设置：完成置顶任务时可自动置顶下一条；新增「已完成」分组（勾选后出现、列表最末、不可新建时选择） |
| 1.2.1 | 2026-09-03 | 启动加载页检测版本；非最新自动下载，完成后自动安装并重新打开主界面 |
| 1.2.0 | 2026-09-03 | 接入 electron-updater：GitHub Releases 检测、自动下载、横幅提示与重启安装；新增 `dist:publish` |
| 1.1.1 | 2026-09-03 | 每个标签分类（含未分类）同时仅允许一条置顶；换分类时自动互斥 |
| 1.1.0 | 2026-09-03 | 双击编辑；任务置顶；工作/生活/购物标签与分组展示；标签长按拖排；标签菜单层级修复；`npm start` 接入 electronmon 热重启 |
| 1.0.0 | 2026-09-03 | 首发：多行批量任务、删除线动画、7 天过期、窗口置顶、固定尺寸、无菜单栏 |

***

> © 桌面任务小工具 · 基于 MIT 协议开源，欢迎修改和分发。
