# 今日任务 · 桌面任务小工具

一款轻量、专注的 Windows 桌面待办任务工具。支持多行批量输入任务、勾选任务后平滑的删除线动画、本地自动持久化、一周自动过期清理，以及窗口一键置顶。

> 基于 Electron 30 构建的纯离线桌面应用。不依赖任何后端服务，所有任务数据只保存在你自己的电脑上。

***

## ✨ 功能亮点

| 功能             | 说明                                                |
| -------------- | ------------------------------------------------- |
| 🧩 **多行批量输入**  | 每行一个任务，按 **Enter** 一键添加；**Shift+Enter** 在输入框内换行   |
| ✅ **删除线动画**    | 勾选复选框后文字平滑变灰，删除线从左到右 0.45s 展开；取消勾选则反向收回           |
| 🎯 **勾选弹跳反馈**  | 每次完成勾选任务卡片会有轻微的呼吸弹跳动画                             |
| 📌 **桌面置顶**    | 点击右上角图钉按钮，窗口固定在所有应用之上；再次点击取消                      |
| 💾 **本地持久化**   | 所有任务保存到 Electron 应用用户数据目录的 `localStorage`，关闭软件不丢失 |
| ⏰ **一周自动过期**   | 每条任务从创建起算 7 天后自动删除，并在卡片上显示"还剩 N 天/即将过期"标签         |
| 🧹 **批量清理已完成** | 底部按钮一键清除所有已勾选完成的任务，带滑出动画                          |
| 🔒 **固定窗口尺寸**  | 420×600 像素的紧凑尺寸，不可拖拽调整大小，适合放在桌面边角                 |
| ⌨️ **无菜单栏**    | 移除 Electron 默认菜单栏，界面纯净                            |
| 🎨 **紫蓝渐变主题**  | 柔和渐变背景，圆角卡片设计，视觉上清爽无负担                            |

***

## 🛠 技术栈

### 运行时与框架

| 层级   | 技术                          | 版本    | 作用                                              |
| ---- | --------------------------- | ----- | ----------------------------------------------- |
| 运行时  | **Node.js**                 | 24.x  | 主进程与构建过程的宿主环境                                   |
| 桌面框架 | **Electron**                | 30.x  | 提供原生窗口、桌面系统 API（置顶、打包），基于 Chromium + Node 双进程模型 |
| 前端核心 | **Chromium**（随 Electron 提供） | V124+ | 渲染 HTML/CSS/JS 的浏览器内核                           |
| 包管理  | **npm**                     | 10.x  | 依赖安装与脚本调度                                       |

### 前端技术（渲染层，零框架）

| 技术                       | 说明                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| **HTML5**                | 语义化结构：header / input-section / task-list / footer                                        |
| **CSS3**                 | 自定义动画（slideIn / completedBounce / slideOut / checkPop）、渐变主题、Flex 布局、`cubic-bezier` 删除线过渡 |
| **原生 JavaScript (ES6+)** | 纯 IIFE 封装的渲染逻辑，无第三方库依赖（无 React/Vue/jQuery）                                               |
| **Storage API**          | `window.localStorage` 作为任务持久化存储                                                          |

### 构建与打包工具链

| 工具                                            | 版本                               | 作用                                                                |
| --------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| **electron-builder**                          | 24.x                             | 打包为 Windows 安装器（NSIS）与 Portable 单文件便携版，内置 asar 打包、7z 解压、NSIS 资源下载 |
| **asar**                                      | 随 electron-builder               | 打包源码为单 `app.asar`，提升加载速度并保护源码                                     |
| **NSIS (Nullsoft Scriptable Install System)** | 3.0.4.1（由 electron-builder 自动下载） | 生成 Windows `.exe` 安装包向导                                           |

***

## 🏗 软件架构

### 整体进程模型

项目严格遵循 Electron 推荐的 **双进程 + Preload 桥接** 安全模型：

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron 应用                          │
├──────────────────────────────┬──────────────────────────────┤
│  主进程 (Main Process)       │  渲染进程 (Renderer)         │
│  ─────────────────────────   │  ─────────────────────────   │
│  • Node.js 全能力            │  • Chromium 页面             │
│  • BrowserWindow 管理        │  • index.html                │
│  • 置顶 IPC handle           │  • style.css                 │
│  • Menu 移除                 │  • renderer.js (任务逻辑)    │
│                              │                              │
│           👆 ────────────── │  nodeIntegration: false ✅    │
│           │  仅暴露3个方法   │  contextIsolation: true ✅    │
├───────────┴──────────────────┴──────────────────────────────┤
│                      preload.js (ContextBridge)             │
│                      ─────────────────                      │
│   window.electronAPI = {                                    │
│     toggleAlwaysOnTop()                                     │
│     getAlwaysOnTop()                                        │
│     onAlwaysOnTopChanged(callback)                          │
│   }                                                        │
└─────────────────────────────────────────────────────────────┘
```

### 安全设计

- **`contextIsolation: true`**：渲染进程无法直接访问 Node 原生 API，彻底隔离页面脚本与 Electron 内部对象

- **`nodeIntegration: false`**：页面 DOM 环境没有 `require()`，避免 XSS 被放大为系统级漏洞

- **最小 IPC 暴露面**：只暴露 3 个窗口控制方法，没有任何文件系统/子进程能力

- **任务持久化使用 localStorage**：不需要主进程读写磁盘，减少攻击面

### 目录结构

```
desktop-todo-widget/
├── main.js              # 主进程：窗口创建、置顶IPC、菜单移除
├── preload.js           # 预加载：ContextBridge 暴露安全API
├── index.html           # 前端结构：顶部栏 / 输入区 / 列表 / 空状态 / 底部
├── style.css            # 样式：渐变主题、动画、卡片、删除线过渡
├── renderer.js          # 渲染逻辑：任务CRUD、键盘映射、过期清理、置顶按钮联动
├── package.json         # 依赖 + electron-builder 打包配置
├── icon.png             # （可选）应用图标，未提供时使用 Electron 默认
│
├── build-release/       # 打包输出（npm run dist 后生成）
│   ├── 今日任务 Setup 1.0.0.exe   # NSIS 安装包
│   ├── 今日任务 1.0.0.exe         # Portable 单文件便携版
│   └── win-unpacked/              # 绿色解包目录（含 今日任务.exe）
│
├── .npm-cache/          # （本地）npm 依赖缓存
├── .electron-cache/     # （本地）Electron 二进制缓存
├── .electron-builder-cache/  # （本地）NSIS / winCodeSign 等二进制缓存
└── node_modules/        # 依赖安装目录
```

### 模块职责对照

| 文件              | 关键模块                                                         | 负责事项                                                   |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| **main.js**     | `createWindow()`                                             | 420×600 固定尺寸窗口、禁用菜单栏、窗口置顶状态事件                          |
| <br />          | `ipcMain.handle('toggle-always-on-top')`                     | 调用 `BrowserWindow.setAlwaysOnTop` 切换置顶并返回新状态           |
| <br />          | `ipcMain.handle('get-always-on-top')`                        | 初始化渲染进程图钉按钮高亮状态                                        |
| **preload.js**  | `contextBridge.exposeInMainWorld`                            | 将 3 个安全 API 注入到 `window.electronAPI`                   |
| **index.html**  | `.input-wrapper > textarea + button`                         | 多行输入框 + 添加按钮                                           |
| <br />          | `#taskList`                                                  | 任务列表 `<ul>` 容器，滚动条独立美化                                 |
| <br />          | `#pinBtn`                                                    | 置顶图钉按钮                                                 |
| **style.css**   | `.strikethrough-line` + `transition: width`                  | 删除线从 0 → 100% 的展开动画（`cubic-bezier(0.4,0,0.2,1)`，450ms） |
| <br />          | `@keyframes slideIn / slideOut / completedBounce / checkPop` | 新任务滑入、删除滑出、完成弹跳、复选框勾选动画                                |
| <br />          | `.expire-tag.near / .expiring`                               | 过期临近三色标签（绿→黄→红）                                        |
| **renderer.js** | `addTasks(text)`                                             | 文本按 `\n` 拆分、空行过滤、批量创建；多条插入时错开 `animationDelay` 形成错落滑入  |
| <br />          | `toggleTask(id)`                                             | 切换完成状态时只重绘 `.completed` 类（不重建 DOM，确保动画流畅）              |
| <br />          | `removeTask()`                                               | 添加 `.removing` 类播放滑出动画后再从数组和 DOM 中移除                   |
| <br />          | `cleanupExpired()`                                           | 启动时 + 每小时巡检一次，`Date.now() - createdAt >= 7天` 的任务自动清理   |
| <br />          | `saveTasks() / loadTasks()`                                  | JSON 序列化写入 `localStorage['desktop_todo_tasks_v1']`     |
| <br />          | `bindEvents()`                                               | Enter=提交、Shift+Enter=换行、Esc=清空；textarea 自动增高；批量清除已完成   |
| <br />          | `initPinBtn()`                                               | 启动时同步置顶状态 + 点击触发 IPC + 监听主进程置顶变化回写高亮                   |

### 数据存储结构

任务数据以 **JSON** 存入 `localStorage`，键名：`desktop_todo_tasks_v1`：

```js
// localStorage["desktop_todo_tasks_v1"]
[
  {
    "id": "lwk1xabc7u",                 // 时间戳+随机串 唯一ID
    "text": "写周报",                    // 任务正文（会被 escapeHtml 转义后展示）
    "completed": false,                  // 复选框状态
    "createdAt": 1756879800000           // 创建时间戳（ms），用于7天过期判定
  },
  ...
]
```

**过期逻辑**：`Date.now() - task.createdAt >= 7 * 24 * 60 * 60 * 1000` 时视为过期，从数组中移除并 `saveTasks()`。卡片展示时计算 `remainDays` 显示「还剩 N 天 / 即将过期」。

### 置顶交互 IPC 时序

```
渲染进程 (pinBtn click)
        │
        ├── ipcRenderer.invoke('toggle-always-on-top')  ──▶  主进程
        │                                                     │
        │                                                     ├── isOnTop = win.isAlwaysOnTop()
        │                                                     ├── win.setAlwaysOnTop(!isOnTop, 'floating')
        │                                                     │
        │◀── 返回 !isOnTop ◀─────────────────────────────────┘
        │
        ├── pinBtn.classList.toggle('active', !isOnTop)
        │
主进程还会额外触发：
        │
        win.on('always-on-top-changed')  ──▶  webContents.send(...)  ──▶  渲染进程二次同步
                                                             （防止系统快捷键改变置顶时UI不同步）
```

### 任务生成与渲染流程

```
用户输入"任务A\n任务B\n任务C" + 按 Enter
        │
        ▼
keydown 拦截（Enter && !shiftKey）→ e.preventDefault()
        │
        ▼
addTasks(text):
  1) split(/\r?\n/) → ["任务A","任务B","任务C"]
  2) map(trim) + filter(Boolean) → 去掉空行
  3) 倒序构建 tasks.unshift({id,text,completed:false,createdAt: now-i})
     （每条 createdAt 差 1ms → 排序顺序稳定）
  4) saveTasks() → localStorage 写入
  5) forEach createTaskElement + 每个 el.style.animationDelay = idx*40ms
  6) DocumentFragment 一次性插入到 taskList 顶部
  7) updateTaskCount() / showEmptyIfNeeded()
        │
        ▼
 用户看到 3 条新任务按 40ms/条 错落滑入列表顶部
```

***

## 🚀 快速开始

### 环境要求

| 依赖      | 最低版本                | 说明                   |
| ------- | ------------------- | -------------------- |
| Node.js | ≥ 18                | 推荐 20 / 22 LTS       |
| npm     | ≥ 9                 | 随 Node 官方发行版一起提供     |
| 操作系统    | Windows 10 / 11 x64 | 打包产物仅支持 64 位 Windows |

### 本地开发运行

```powershell
# 1. 进入项目目录
cd desktop-todo-widget

# 2. 设置缓存目录到本地（避免全局目录权限问题；国内镜像加速）
$env:NPM_CONFIG_CACHE = "$PWD\.npm-cache"
$env:ELECTRON_CACHE = "$PWD\.electron-cache"
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"

# 3. 安装依赖（首次）
npm install --no-audit --no-fund

# 4. 启动开发模式（自动刷新窗口内页面即可热更新 HTML/CSS/JS）
npm start
```

### 打包发布

```powershell
# 设置构建时需要的额外缓存与镜像环境变量
$env:ELECTRON_BUILDER_CACHE = "$PWD\.electron-builder-cache"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"   # 没有代码签名证书时必须关闭

# 打包 → 输出到 build-release/
npm run dist
```

**打包产物**（`build-release/` 目录）：

| 文件                     | 大小（约）  | 用途                            |
| ---------------------- | ------ | ----------------------------- |
| `今日任务 1.0.0.exe`       | 110 MB | Portable 单文件版：双击即运行，结束后不留系统残留 |
| `今日任务 Setup 1.0.0.exe` | 70 MB  | NSIS 安装包：向导式安装，创建桌面与开始菜单快捷方式  |
| `win-unpacked/` 目录     | 360 MB | 绿色文件夹版：整目录拷贝即可运行              |

***

## ⌨️ 快捷键汇总

| 作用区域      | 快捷键             | 行为                        |
| --------- | --------------- | ------------------------- |
| **任务输入框** | `Enter`         | 按每行拆分，批量添加任务              |
| <br />    | `Shift + Enter` | 在当前位置插入换行（输入下一个任务）        |
| <br />    | `Esc`           | 清空输入框所有内容                 |
| **软件全局**  | 点击右上角 `图钉` 按钮   | 切换窗口是否置顶在所有应用之上           |
| **任务卡片**  | 点击复选框           | 勾选 → 删除线动画展开；取消勾选 → 删除线收回 |
| **底部**    | 点击「清除已完成」       | 批量移除所有勾选已完成的任务            |

***

## ⚙️ 关键可调参数

在 `renderer.js` 顶部可直接修改的常量：

```js
const STORAGE_KEY  = 'desktop_todo_tasks_v1';  // localStorage 键名，修改可实现多套任务集
const EXPIRE_DAYS  = 7;                         // 任务过期天数，默认一周
const ONE_DAY_MS   = 24 * 60 * 60 * 1000;      // 一天毫秒数（可调整）
```

窗口尺寸、置顶行为等在 `main.js` 的 `BrowserWindow` 构造参数里调整：

```js
{
  width: 420, height: 600,       // 固定窗口大小
  resizable: false,             // false = 不可拖拽调整
  maximizable: false,           // false = 禁用最大化按钮
  alwaysOnTop: false,           // 改为 true 则默认启动就置顶
  autoHideMenuBar: true         // 若恢复菜单栏，改 false 并删除 Menu.setApplicationMenu(null)
}
```

自定义图标：把一张 **512×512 PNG** 保存为项目根目录的 `icon.png`，electron-builder 打包时会自动拾取（`main.js` 已经在 `icon: path.join(__dirname, 'icon.png')` 配置好路径）。

***

## 🧭 常见问题

### ❓ 打包提示 "winCodeSign 解压失败 / 符号链接创建失败"

**原因**：当前用户没有 Windows 创建符号链接权限，且国内镜像下载的 winCodeSign 中带有 macOS 相关符号链接。\
**解决**：本项目默认已开启 `CSC_IDENTITY_AUTO_DISCOVERY=false` + `"signAndEditExecutable": false`，已跳过签名流程，不会再下载 winCodeSign。如果你改了配置，可以重新加上这两行。

### ❓ 任务数据存储在电脑的哪个位置？

Electron 应用数据目录下：

```
%APPDATA%\今日任务\Local Storage\leveldb\
```

任务数据以 Chromium localStorage（leveldb 底层）形式保存在里面。卸载软件时若要彻底清除任务，手动删除该目录下的文件即可。

### ❓ Portable 版和安装版有什么区别？

- **Portable**：只有一个 exe，运行时会把用户数据解压到系统临时目录（关闭后用户数据仍保存在 `%APPDATA%` 内）。适合随身带、临时用。

- **Setup 安装版**：安装到 `Program Files`，创建桌面快捷方式，和普通软件体验一致。适合长期放在自己电脑上用。

### ❓ 可以改成 macOS / Linux 版本吗？

可以。技术栈是跨平台的（Electron）。只需在 `package.json` 的 `build` 里增加 `mac` / `linux` target，并在对应系统上执行 `npm run dist` 即可。

***

## 📝 版本历史

| 版本    | 日期         | 主要变更                                      |
| ----- | ---------- | ----------------------------------------- |
| 1.0.0 | 2026-09-03 | 首个版本发布：多行批量任务、删除线动画、7天自动过期、桌面置顶、固定尺寸、无菜单栏 |

***

> © 桌面任务小工具 · 基于 MIT 协议开源，欢迎修改和分发。

