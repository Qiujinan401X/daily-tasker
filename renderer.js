/* ===== 桌面任务小工具 - 渲染进程逻辑 ===== */
(function () {
  'use strict';

  // ---------- 常量 ----------
  const STORAGE_KEY = 'desktop_todo_tasks_v1';
  const EXPIRE_DAYS = 7; // 7 天后自动删除
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // ---------- DOM 元素 ----------
  const taskInput = document.getElementById('taskInput');
  const addBtn = document.getElementById('addBtn');
  const taskList = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');
  const taskCount = document.getElementById('taskCount');
  const pinBtn = document.getElementById('pinBtn');
  const dateTag = document.getElementById('dateTag');
  const clearDoneBtn = document.getElementById('clearDoneBtn');

  // ---------- 数据 ----------
  let tasks = [];

  // ---------- 工具函数 ----------
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function todayStr() {
    const d = new Date();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${d.getMonth() + 1}月${d.getDate()}日 · ${weekDays[d.getDay()]}`;
  }

  function getExpireInfo(createdAt) {
    const now = Date.now();
    const remainMs = createdAt + EXPIRE_DAYS * ONE_DAY_MS - now;
    const remainDays = remainMs / ONE_DAY_MS;
    let label = '7天内有效';
    let cls = '';
    if (remainDays <= 1) {
      label = '即将过期';
      cls = 'expiring';
    } else if (remainDays <= 3) {
      label = `还剩 ${Math.ceil(remainDays)} 天`;
      cls = 'near';
    } else {
      label = `还剩 ${Math.ceil(remainDays)} 天`;
    }
    return { label, cls, expired: remainMs <= 0 };
  }

  // ---------- 存储 ----------
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr;
    } catch (e) {
      console.error('读取任务失败', e);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('保存任务失败', e);
    }
  }

  /** 清理过期任务（超过 7 天） */
  function cleanupExpired() {
    const now = Date.now();
    const before = tasks.length;
    tasks = tasks.filter((t) => now - t.createdAt < EXPIRE_DAYS * ONE_DAY_MS);
    if (tasks.length !== before) {
      saveTasks();
    }
  }

  // ---------- 渲染 ----------
  function updateTaskCount() {
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed).length;
    taskCount.textContent = total === 0 ? '0 项' : done ? `${done}/${total}` : `${total} 项`;
  }

  function showEmptyIfNeeded() {
    if (tasks.length === 0) {
      emptyState.classList.add('show');
    } else {
      emptyState.classList.remove('show');
    }
  }

  function render() {
    taskList.innerHTML = '';
    // 未完成在前，已完成在后；同类按创建时间倒序
    const sorted = [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return b.createdAt - a.createdAt;
    });

    sorted.forEach((task) => {
      taskList.appendChild(createTaskElement(task));
    });
    updateTaskCount();
    showEmptyIfNeeded();
  }

  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.dataset.id = task.id;

    const expire = getExpireInfo(task.createdAt);

    li.innerHTML = `
      <label class="checkbox-wrapper">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} />
      </label>
      <div class="task-content">
        <div class="task-text-wrapper">
          <span class="task-text">${escapeHtml(task.text)}</span>
          <span class="strikethrough-line"></span>
        </div>
        <div class="task-meta">
          <span class="task-time">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${formatTime(task.createdAt)}
          </span>
          <span class="expire-tag ${expire.cls}">${expire.label}</span>
        </div>
      </div>
    `;

    // 绑定事件：复选框切换
    const checkbox = li.querySelector('.task-checkbox');
    checkbox.addEventListener('change', () => toggleTask(task.id));

    return li;
  }

  // ---------- 业务操作 ----------
  /**
   * 批量添加任务：按换行拆分成多条
   * 空行会被过滤，多余前后空白会被 trim
   * 返回成功添加的条数
   */
  function addTasks(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return 0;

    const now = Date.now();
    // 倒序插入，保持输入顺序（最后一行插在最上面的话会导致顺序反，所以从后往前 unshift）
    const created = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const task = {
        id: uid(),
        text: lines[i],
        completed: false,
        // 多条同时添加时，给每一条分配细微时间差，保证排序稳定
        createdAt: now - i
      };
      tasks.unshift(task);
      created.push(task);
    }
    saveTasks();

    // 依次插入 DOM，间隔短延时形成错落的滑入动画
    const fragment = document.createDocumentFragment();
    created.forEach((task, idx) => {
      const el = createTaskElement(task);
      // 动画错开
      el.style.animationDelay = `${idx * 40}ms`;
      fragment.appendChild(el);
    });
    if (taskList.firstChild) {
      taskList.insertBefore(fragment, taskList.firstChild);
    } else {
      taskList.appendChild(fragment);
    }

    updateTaskCount();
    showEmptyIfNeeded();
    return lines.length;
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();

    // 更新 DOM 类（避免全量重绘，保持动画流畅）
    const li = taskList.querySelector(`.task-item[data-id="${id}"]`);
    if (li) {
      // 先去掉动画类，再添加以重启动画
      li.classList.remove('completed');
      // 强制 reflow 触发重新播放动画
      if (task.completed) {
        void li.offsetWidth;
        li.classList.add('completed');
      }
    }
    updateTaskCount();
  }

  function removeTask(id, liEl) {
    const li = liEl || taskList.querySelector(`.task-item[data-id="${id}"]`);
    const doRemove = () => {
      tasks = tasks.filter((t) => t.id !== id);
      saveTasks();
      if (li && li.parentNode) li.parentNode.removeChild(li);
      updateTaskCount();
      showEmptyIfNeeded();
    };
    if (li) {
      li.classList.add('removing');
      setTimeout(doRemove, 280);
    } else {
      doRemove();
    }
  }

  function clearCompleted() {
    const completedIds = tasks.filter((t) => t.completed).map((t) => t.id);
    if (completedIds.length === 0) return;
    completedIds.forEach((id) => {
      const li = taskList.querySelector(`.task-item[data-id="${id}"]`);
      if (li) li.classList.add('removing');
    });
    setTimeout(() => {
      tasks = tasks.filter((t) => !t.completed);
      saveTasks();
      render();
    }, 280);
  }

  // ---------- 置顶功能 ----------
  async function initPinBtn() {
    if (window.electronAPI) {
      try {
        const onTop = await window.electronAPI.getAlwaysOnTop();
        pinBtn.classList.toggle('active', onTop);
        window.electronAPI.onAlwaysOnTopChanged((isOnTop) => {
          pinBtn.classList.toggle('active', isOnTop);
        });
      } catch (e) {
        console.warn('获取置顶状态失败', e);
      }
      pinBtn.addEventListener('click', async () => {
        try {
          const nowOnTop = await window.electronAPI.toggleAlwaysOnTop();
          pinBtn.classList.toggle('active', nowOnTop);
        } catch (e) {
          console.warn('切换置顶失败', e);
        }
      });
    } else {
      // 非 Electron 环境（如直接浏览器打开）禁用置顶按钮
      pinBtn.disabled = true;
      pinBtn.style.opacity = '0.4';
      pinBtn.title = '置顶功能需要在桌面客户端中使用';
    }
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    // 添加任务（按钮点击 -> 批量添加）
    addBtn.addEventListener('click', () => {
      const added = addTasks(taskInput.value);
      if (added > 0) {
        taskInput.value = '';
        // 清空后重置 textarea 高度
        taskInput.style.height = 'auto';
      }
      taskInput.focus();
    });

    // 键盘：Enter（无 Shift）= 按换行拆分后批量提交；Shift+Enter = 换行；Esc 清空
    taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        // 纯 Enter 提交
        e.preventDefault();
        const added = addTasks(taskInput.value);
        if (added > 0) {
          taskInput.value = '';
          taskInput.style.height = 'auto';
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        taskInput.value = '';
        taskInput.style.height = 'auto';
      }
      // Shift+Enter 不拦截，由浏览器默认行为在 textarea 中插入换行
    });

    // textarea 自动增高（最多 max-height）
    taskInput.addEventListener('input', () => {
      taskInput.style.height = 'auto';
      taskInput.style.height = Math.min(taskInput.scrollHeight, 160) + 'px';
    });

    // 清除已完成
    clearDoneBtn.addEventListener('click', clearCompleted);
  }

  // ---------- 初始化 ----------
  function init() {
    dateTag.textContent = todayStr();
    tasks = loadTasks();
    cleanupExpired(); // 启动时清理过期
    render();
    bindEvents();
    initPinBtn();

    // 每小时检查一次过期
    setInterval(() => {
      const beforeCount = tasks.length;
      cleanupExpired();
      if (tasks.length !== beforeCount) render();
    }, 60 * 60 * 1000);

    taskInput.focus();
  }

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
