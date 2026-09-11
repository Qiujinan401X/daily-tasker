/* ===== 桌面任务小工具 - 渲染进程逻辑 ===== */
(function () {
  'use strict';

  // ---------- 常量 ----------
  const STORAGE_KEY = 'desktop_todo_tasks_v1';
  const TAG_ORDER_KEY = 'desktop_todo_tag_order_v1';
  const SETTINGS_KEY = 'desktop_todo_settings_v1';
  const EXPIRE_DAYS = 7;
  const EXTEND_DAYS = 1;
  const MAX_DURATION_DAYS = 365;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const LONG_PRESS_MS = 420;
  const DRAG_MOVE_CANCEL_PX = 8;
  /** 已完成分组占位 id（非真实 tag，不可新建/手动选择） */
  const DONE_GROUP_ID = 'done';

  const TAG_DEFS = {
    work: { id: 'work', name: '工作' },
    life: { id: 'life', name: '生活' },
    shopping: { id: 'shopping', name: '购物' }
  };
  const DEFAULT_TAG_ORDER = ['work', 'life', 'shopping'];
  const DEFAULT_SETTINGS = {
    /** light | dark */
    theme: 'light'
  };

  // ---------- DOM 元素 ----------
  const taskInput = document.getElementById('taskInput');
  const addBtn = document.getElementById('addBtn');
  const taskList = document.getElementById('taskList');
  const emptyState = document.getElementById('emptyState');
  const taskCount = document.getElementById('taskCount');
  const pinBtn = document.getElementById('pinBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const dateTag = document.getElementById('dateTag');
  const clearDoneBtn = document.getElementById('clearDoneBtn');
  const tagBar = document.getElementById('tagBar');
  const bootSplash = document.getElementById('bootSplash');
  const bootVersion = document.getElementById('bootVersion');
  const bootStatus = document.getElementById('bootStatus');
  const bootHint = document.getElementById('bootHint');
  const bootProgressTrack = document.getElementById('bootProgressTrack');
  const bootProgressBar = document.getElementById('bootProgressBar');
  const appRoot = document.getElementById('appRoot');

  // ---------- 数据 ----------
  let tasks = [];
  let tagOrder = [...DEFAULT_TAG_ORDER];
  let settings = { ...DEFAULT_SETTINGS };
  /** 新建任务时选中的标签；null 表示未分类 */
  let draftTag = null;
  let appEntered = false;
  let updateInProgress = false;

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

  function normalizeDurationDays(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return EXPIRE_DAYS;
    return Math.min(MAX_DURATION_DAYS, Math.max(1, Math.floor(n)));
  }

  function getTaskDurationDays(task) {
    return normalizeDurationDays(task && task.durationDays);
  }

  function getExpireInfo(task) {
    const createdAt = task.createdAt;
    const durationDays = getTaskDurationDays(task);
    const now = Date.now();
    const remainMs = createdAt + durationDays * ONE_DAY_MS - now;
    const remainDays = remainMs / ONE_DAY_MS;
    let label = `${durationDays}天内有效`;
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
    return {
      label,
      cls,
      expired: remainMs <= 0,
      durationDays,
      canExtend: durationDays < MAX_DURATION_DAYS
    };
  }

  function normalizeTag(tag) {
    return TAG_DEFS[tag] ? tag : null;
  }

  function tagName(tag) {
    const id = normalizeTag(tag);
    return id ? TAG_DEFS[id].name : '无标签';
  }

  function categoryKey(tag) {
    return normalizeTag(tag) || '';
  }

  /** 同一分类（含未分类）仅保留 keepId 这一条置顶 */
  function clearOtherPinsInCategory(keepId, tag) {
    const key = categoryKey(tag);
    tasks.forEach((t) => {
      if (t.id === keepId || !t.pinned) return;
      if (categoryKey(t.tag) === key) {
        t.pinned = false;
        t.pinnedAt = undefined;
      }
    });
  }

  /** 启动时纠偏：每个分类最多一条置顶（保留 pinnedAt 最新的）；已完成任务不允许置顶 */
  function enforceSinglePinPerCategory() {
    let changed = false;
    tasks.forEach((t) => {
      if (t.completed && t.pinned) {
        t.pinned = false;
        t.pinnedAt = undefined;
        changed = true;
      }
    });

    const winners = new Map();
    tasks.forEach((t) => {
      if (!t.pinned || t.completed) return;
      const key = categoryKey(t.tag);
      const prev = winners.get(key);
      if (!prev || (t.pinnedAt || 0) > (prev.pinnedAt || 0)) {
        winners.set(key, t);
      }
    });
    tasks.forEach((t) => {
      if (!t.pinned || t.completed) return;
      const key = categoryKey(t.tag);
      if (winners.get(key) !== t) {
        t.pinned = false;
        t.pinnedAt = undefined;
        changed = true;
      }
    });
    return changed;
  }

  // ---------- 存储 ----------
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.map((t) => ({
        ...t,
        tag: normalizeTag(t.tag),
        pinned: !!t.pinned,
        durationDays: normalizeDurationDays(t.durationDays)
      }));
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

  function loadTagOrder() {
    try {
      const raw = localStorage.getItem(TAG_ORDER_KEY);
      if (!raw) return [...DEFAULT_TAG_ORDER];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [...DEFAULT_TAG_ORDER];
      const cleaned = arr.filter((id) => TAG_DEFS[id]);
      DEFAULT_TAG_ORDER.forEach((id) => {
        if (!cleaned.includes(id)) cleaned.push(id);
      });
      return cleaned;
    } catch (e) {
      return [...DEFAULT_TAG_ORDER];
    }
  }

  function saveTagOrder() {
    try {
      localStorage.setItem(TAG_ORDER_KEY, JSON.stringify(tagOrder));
    } catch (e) {
      console.error('保存标签顺序失败', e);
    }
  }

  function normalizeTheme(theme) {
    return theme === 'dark' ? 'dark' : 'light';
  }

  /** 按本地时间：19:00–04:00 夜间，其余白天 */
  function themeFromSystemTime(date) {
    const h = (date || new Date()).getHours();
    return h >= 19 || h < 4 ? 'dark' : 'light';
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return { ...DEFAULT_SETTINGS };
      return {
        ...DEFAULT_SETTINGS,
        theme: normalizeTheme(obj.theme)
      };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('保存设置失败', e);
    }
  }

  /** 清理过期任务（按各自 durationDays） */
  function cleanupExpired() {
    const now = Date.now();
    const before = tasks.length;
    tasks = tasks.filter((t) => now - t.createdAt < getTaskDurationDays(t) * ONE_DAY_MS);
    if (tasks.length !== before) {
      saveTasks();
    }
  }

  // ---------- 标签栏（选择 + 长按拖排） ----------
  function renderTagBar() {
    tagBar.innerHTML = '';
    tagOrder.forEach((id) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tag-chip' + (draftTag === id ? ' selected' : '');
      chip.dataset.tag = id;
      chip.textContent = TAG_DEFS[id].name;
      chip.title = '点击选择 · 长按拖动排序';
      bindTagChipInteractions(chip);
      tagBar.appendChild(chip);
    });

    const hint = document.createElement('span');
    hint.className = 'tag-bar-hint';
    hint.textContent = draftTag ? `将添加为「${tagName(draftTag)}」` : '未选标签 · 长按可排序';
    tagBar.appendChild(hint);
  }

  function setDraftTag(tagId) {
    const next = normalizeTag(tagId);
    draftTag = draftTag === next ? null : next;
    renderTagBar();
  }

  function bindTagChipInteractions(chip) {
    let pressTimer = null;
    let startX = 0;
    let startY = 0;
    let longPressed = false;
    let dragging = false;
    let ghost = null;
    let pointerId = null;

    const clearPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const cleanupDrag = () => {
      clearPress();
      longPressed = false;
      dragging = false;
      pointerId = null;
      chip.classList.remove('drag-ready', 'dragging');
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    const onMove = (e) => {
      if (pointerId !== null && e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!longPressed) {
        if (Math.hypot(dx, dy) > DRAG_MOVE_CANCEL_PX) clearPress();
        return;
      }

      if (!dragging) {
        dragging = true;
        chip.classList.add('dragging');
        chip.classList.remove('drag-ready');
        ghost = chip.cloneNode(true);
        ghost.classList.add('tag-chip-ghost');
        ghost.classList.remove('dragging', 'drag-ready', 'selected');
        document.body.appendChild(ghost);
      }

      if (ghost) {
        ghost.style.left = e.clientX - ghost.offsetWidth / 2 + 'px';
        ghost.style.top = e.clientY - ghost.offsetHeight / 2 + 'px';
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const over = el && el.closest('.tag-chip');
      if (!over || over === chip || !tagBar.contains(over)) return;

      const fromId = chip.dataset.tag;
      const toId = over.dataset.tag;
      const fromIdx = tagOrder.indexOf(fromId);
      const toIdx = tagOrder.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

      tagOrder.splice(fromIdx, 1);
      tagOrder.splice(toIdx, 0, fromId);
      // 保持当前拖拽 chip 引用：重排 DOM 但不销毁当前 chip
      const chips = [...tagBar.querySelectorAll('.tag-chip')];
      const target = chips.find((c) => c.dataset.tag === toId);
      if (!target) return;
      if (fromIdx < toIdx) {
        tagBar.insertBefore(chip, target.nextSibling);
      } else {
        tagBar.insertBefore(chip, target);
      }
    };

    const onUp = (e) => {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      const wasDragging = dragging;
      const wasLong = longPressed;
      cleanupDrag();

      if (wasDragging) {
        saveTagOrder();
        renderTagBar();
        render();
        return;
      }
      // 短按选择标签（未触发长按）
      if (!wasLong) {
        setDraftTag(chip.dataset.tag);
      }
    };

    chip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      longPressed = false;
      dragging = false;
      clearPress();
      pressTimer = setTimeout(() => {
        longPressed = true;
        chip.classList.add('drag-ready');
        try {
          if (navigator.vibrate) navigator.vibrate(12);
        } catch (_) {}
      }, LONG_PRESS_MS);

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });
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
      taskList.style.display = 'none';
    } else {
      emptyState.classList.remove('show');
      taskList.style.display = '';
    }
  }

  function sortTasks(list) {
    return [...list].sort((a, b) => {
      const ap = !!a.pinned;
      const bp = !!b.pinned;
      if (ap !== bp) return ap ? -1 : 1;
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (ap && bp) return (b.pinnedAt || 0) - (a.pinnedAt || 0);
      return b.createdAt - a.createdAt;
    });
  }

  function render() {
    closeAllTagMenus();
    taskList.innerHTML = '';

    // 未完成任务按标签分组；已完成统一归入末尾「已完成」分组
    tagOrder.forEach((tagId) => {
      const groupTasks = sortTasks(tasks.filter((t) => !t.completed && t.tag === tagId));
      if (groupTasks.length === 0) return;
      taskList.appendChild(createTagGroup(tagId, TAG_DEFS[tagId].name, groupTasks));
    });

    const untagged = sortTasks(tasks.filter((t) => !t.completed && !t.tag));
    if (untagged.length > 0) {
      taskList.appendChild(createTagGroup('', '未分类', untagged));
    }

    const doneTasks = sortTasks(tasks.filter((t) => t.completed));
    if (doneTasks.length > 0) {
      taskList.appendChild(createTagGroup(DONE_GROUP_ID, '已完成', doneTasks));
    }

    updateTaskCount();
    showEmptyIfNeeded();
  }

  function createTagGroup(tagId, title, groupTasks) {
    const section = document.createElement('section');
    section.className = 'tag-group';
    section.dataset.tag = tagId;

    const header = document.createElement('div');
    header.className = 'tag-group-header';
    header.innerHTML = `
      <span class="tag-dot"></span>
      <span>${escapeHtml(title)}</span>
      <span class="tag-group-count">${groupTasks.length}</span>
    `;
    section.appendChild(header);

    const ul = document.createElement('ul');
    ul.className = 'tag-group-list';
    groupTasks.forEach((task) => ul.appendChild(createTaskElement(task)));
    section.appendChild(ul);
    return section;
  }

  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className =
      'task-item' +
      (task.completed ? ' completed' : '') +
      (task.pinned ? ' pinned' : '');
    li.dataset.id = task.id;

    const expire = getExpireInfo(task);
    const tagId = normalizeTag(task.tag);
    const extendDisabled = !expire.canExtend;
    const extendTitle = extendDisabled
      ? `最长 ${MAX_DURATION_DAYS} 天`
      : `延长 ${EXTEND_DAYS} 天（当前有效期 ${expire.durationDays} 天）`;

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
          <span class="task-tag-picker">
            <button type="button" class="task-tag-btn" data-tag="${tagId || ''}" title="修改标签">
              ${escapeHtml(tagName(tagId))}
            </button>
          </span>
          <span class="task-time">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${formatTime(task.createdAt)}
          </span>
          <span class="expire-actions">
            <span class="expire-tag ${expire.cls}" title="有效期 ${expire.durationDays} 天">${expire.label}</span>
            <button type="button" class="extend-btn" title="${escapeHtml(extendTitle)}" ${extendDisabled ? 'disabled' : ''}>+${EXTEND_DAYS}天</button>
          </span>
        </div>
      </div>
      ${
        task.completed
          ? ''
          : `<button type="button" class="task-pin-btn${task.pinned ? ' active' : ''}" title="${task.pinned ? '取消置顶' : '置顶任务'}">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="17" x2="12" y2="22"></line>
          <path d="M5 17h14l-2-5V7l-5-3-5 3v5l-2 5z"></path>
        </svg>
      </button>`
      }
    `;

    const checkbox = li.querySelector('.task-checkbox');
    checkbox.addEventListener('change', () => toggleTask(task.id));

    const pinTaskBtn = li.querySelector('.task-pin-btn');
    if (pinTaskBtn) {
      pinTaskBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePinTask(task.id);
      });
      pinTaskBtn.addEventListener('dblclick', (e) => e.stopPropagation());
    }

    const extendBtn = li.querySelector('.extend-btn');
    if (extendBtn) {
      extendBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        extendTaskDuration(task.id, EXTEND_DAYS);
      });
      extendBtn.addEventListener('dblclick', (e) => e.stopPropagation());
    }

    const tagBtn = li.querySelector('.task-tag-btn');
    const picker = li.querySelector('.task-tag-picker');
    tagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTagMenu(picker, task.id, task.tag);
    });
    tagBtn.addEventListener('dblclick', (e) => e.stopPropagation());

    li.addEventListener('dblclick', (e) => {
      if (
        e.target.closest('.checkbox-wrapper') ||
        e.target.closest('.task-pin-btn') ||
        e.target.closest('.task-tag-picker') ||
        e.target.closest('.extend-btn')
      ) {
        return;
      }
      if (li.classList.contains('editing')) return;
      startEditTask(task.id, li);
    });

    return li;
  }

  function closeAllTagMenus() {
    document.querySelectorAll('.task-tag-menu').forEach((m) => m.remove());
    document.querySelectorAll('.task-item.tag-menu-open').forEach((el) => {
      el.classList.remove('tag-menu-open');
    });
  }

  function toggleTagMenu(picker, taskId, currentTag) {
    const existing = picker.querySelector('.task-tag-menu');
    closeAllTagMenus();
    if (existing) return;

    const li = picker.closest('.task-item');
    if (li) li.classList.add('tag-menu-open');

    const menu = document.createElement('div');
    menu.className = 'task-tag-menu';

    const options = [
      { id: 'work', name: '工作' },
      { id: 'life', name: '生活' },
      { id: 'shopping', name: '购物' },
      { id: null, name: '无标签' }
    ];

    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt.name;
      if ((opt.id || null) === (currentTag || null)) btn.classList.add('active');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setTaskTag(taskId, opt.id);
      });
      menu.appendChild(btn);
    });

    picker.appendChild(menu);
  }

  function setTaskTag(id, tag) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.tag = normalizeTag(tag);
    // 置顶任务换分类时，目标分类已有置顶则让本条成为唯一置顶
    if (task.pinned) {
      clearOtherPinsInCategory(task.id, task.tag);
      task.pinnedAt = Date.now();
    }
    saveTasks();
    render();
  }

  /** 双击后内联编辑任务文本 */
  function startEditTask(id, liEl) {
    const task = tasks.find((t) => t.id === id);
    const li = liEl || taskList.querySelector(`.task-item[data-id="${id}"]`);
    if (!task || !li || li.classList.contains('editing')) return;

    const existing = taskList.querySelector('.task-item.editing');
    if (existing && existing !== li) {
      const editInput = existing.querySelector('.task-edit-input');
      if (editInput) editInput.blur();
    }

    const textEl = li.querySelector('.task-text');
    if (!textEl) return;

    li.classList.add('editing');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = task.text;
    input.maxLength = 500;
    input.setAttribute('aria-label', '编辑任务');

    textEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;

    const finish = (save) => {
      if (finished) return;
      finished = true;
      if (save) {
        const next = input.value.trim();
        if (next && next !== task.text) {
          task.text = next;
          saveTasks();
        }
      }
      const span = document.createElement('span');
      span.className = 'task-text';
      span.textContent = task.text;
      input.replaceWith(span);
      li.classList.remove('editing');
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
      e.stopPropagation();
    });

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
  }

  // ---------- 业务操作 ----------
  function addTasks(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return 0;

    const now = Date.now();
    for (let i = lines.length - 1; i >= 0; i--) {
      const task = {
        id: uid(),
        text: lines[i],
        completed: false,
        pinned: false,
        tag: draftTag,
        durationDays: EXPIRE_DAYS,
        createdAt: now - i
      };
      tasks.unshift(task);
    }
    saveTasks();
    render();
    return lines.length;
  }

  function updateTaskExpireUi(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const li = taskList.querySelector(`.task-item[data-id="${id}"]`);
    if (!li) return;

    const expire = getExpireInfo(task);
    const tagEl = li.querySelector('.expire-tag');
    const extendBtn = li.querySelector('.extend-btn');
    if (!tagEl || !extendBtn) return;

    tagEl.className = 'expire-tag' + (expire.cls ? ` ${expire.cls}` : '');
    tagEl.title = `有效期 ${expire.durationDays} 天`;
    tagEl.textContent = expire.label;

    extendBtn.disabled = !expire.canExtend;
    extendBtn.title = expire.canExtend
      ? `延长 ${EXTEND_DAYS} 天（当前有效期 ${expire.durationDays} 天）`
      : `最长 ${MAX_DURATION_DAYS} 天`;
  }

  function extendTaskDuration(id, days) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const add = Math.max(1, Math.floor(Number(days) || EXTEND_DAYS));
    const current = getTaskDurationDays(task);
    if (current >= MAX_DURATION_DAYS) return;
    task.durationDays = normalizeDurationDays(current + add);
    saveTasks();
    updateTaskExpireUi(id);
  }

  function togglePinTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.completed) return;
    task.pinned = !task.pinned;
    if (task.pinned) {
      clearOtherPinsInCategory(task.id, task.tag);
      task.pinnedAt = Date.now();
    } else {
      task.pinnedAt = undefined;
    }
    saveTasks();
    render();
  }

  /**
   * 完成置顶任务时：取消本条置顶，并将同分类下一条未完成任务置顶。
   * 「下一条」取完成前组内排序中紧随其后的任务。
   */
  function promoteNextPinAfterComplete(doneTask) {
    const key = categoryKey(doneTask.tag);
    const ordered = sortTasks(
      tasks.filter((t) => !t.completed && categoryKey(t.tag) === key)
    );
    const idx = ordered.findIndex((t) => t.id === doneTask.id);
    const next = idx >= 0 ? ordered[idx + 1] : null;

    doneTask.pinned = false;
    doneTask.pinnedAt = undefined;

    if (next) {
      next.pinned = true;
      next.pinnedAt = Date.now();
      clearOtherPinsInCategory(next.id, next.tag);
    }
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const becomingDone = !task.completed;

    if (becomingDone && task.pinned) {
      promoteNextPinAfterComplete(task);
    }

    task.completed = becomingDone;
    saveTasks();

    const li = taskList.querySelector(`.task-item[data-id="${id}"]`);
    if (li && becomingDone) {
      li.classList.remove('completed');
      void li.offsetWidth;
      li.classList.add('completed');
      // 等删除线/弹跳动画后再重排到「已完成」分组
      setTimeout(() => render(), 420);
    } else {
      render();
    }
    updateTaskCount();
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

  // ---------- 窗口置顶 ----------
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
      pinBtn.disabled = true;
      pinBtn.style.opacity = '0.4';
      pinBtn.title = '置顶功能需要在桌面客户端中使用';
    }
  }

  // ---------- 设置面板 / 主题 ----------
  function applyTheme(theme) {
    const next = normalizeTheme(theme);
    settings.theme = next;
    document.documentElement.setAttribute('data-theme', next);
    if (settingsPanel) {
      settingsPanel.querySelectorAll('.theme-tab').forEach((btn) => {
        const active = btn.dataset.theme === next;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
  }

  function closeSettingsPanel() {
    if (!settingsPanel || settingsPanel.hidden) return;
    settingsPanel.hidden = true;
    if (settingsBtn) {
      settingsBtn.classList.remove('active');
      settingsBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleSettingsPanel() {
    if (!settingsPanel || !settingsBtn) return;
    const open = settingsPanel.hidden;
    settingsPanel.hidden = !open;
    settingsBtn.classList.toggle('active', open);
    settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function initSettings() {
    // 每次打开按系统时间决定默认主题；设置里仍可手动切换（当次会话）
    applyTheme(themeFromSystemTime());
    saveSettings();
    if (!settingsBtn || !settingsPanel) return;

    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettingsPanel();
    });

    settingsPanel.querySelectorAll('.theme-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyTheme(btn.dataset.theme);
        saveSettings();
      });
    });

    settingsPanel.addEventListener('click', (e) => e.stopPropagation());
  }

  // ---------- 启动加载 / 自动更新 ----------
  function setBootStatus(text, hint) {
    if (bootStatus) bootStatus.textContent = text || '';
    if (bootHint) bootHint.textContent = hint || '';
  }

  function setBootProgress(percent) {
    if (!bootProgressTrack || !bootProgressBar) return;
    bootProgressTrack.hidden = false;
    bootProgressBar.style.width = Math.max(0, Math.min(100, percent)) + '%';
  }

  function enterApp() {
    if (appEntered) return;
    appEntered = true;
    if (bootSplash) {
      bootSplash.classList.add('is-done');
      bootSplash.hidden = true;
    }
    if (appRoot) appRoot.hidden = false;
    if (taskInput) taskInput.focus();
  }

  function handleUpdateStatus(payload) {
    if (!payload || appEntered) return;
    const type = payload.type;

    if (type === 'checking') {
      setBootStatus('正在检查更新…', '请稍候');
      return;
    }

    if (type === 'available') {
      updateInProgress = true;
      setBootStatus(
        `发现新版本 ${payload.version || ''}，正在下载…`,
        '下载完成后将自动安装并重新打开'
      );
      setBootProgress(0);
      return;
    }

    if (type === 'progress') {
      updateInProgress = true;
      const p = payload.percent || 0;
      setBootStatus(`正在下载更新… ${p}%`, '下载完成后将自动安装并重新打开');
      setBootProgress(p);
      return;
    }

    if (type === 'downloaded') {
      updateInProgress = true;
      if (bootProgressTrack) bootProgressTrack.hidden = true;
      setBootStatus(
        `新版本 ${payload.version || ''} 已下载完成`,
        '正在安装并重新打开应用…'
      );
      return;
    }

    if (type === 'not-available') {
      if (updateInProgress) return;
      setBootStatus('已是最新版本', '');
      setTimeout(enterApp, 350);
      return;
    }

    if (type === 'error') {
      if (updateInProgress) {
        setBootStatus('更新失败', '请检查网络后重新打开软件');
        return;
      }
      setBootStatus('检查更新失败，进入应用…', '可稍后重新打开以重试');
      setTimeout(enterApp, 900);
    }
  }

  async function runBootSequence() {
    const hasApi = !!(window.electronAPI && window.electronAPI.onUpdateStatus);

    if (!hasApi) {
      setBootStatus('正在进入…', '');
      setTimeout(enterApp, 200);
      return;
    }

    window.electronAPI.onUpdateStatus(handleUpdateStatus);

    let info = { version: '', isPackaged: false };
    try {
      info = (await window.electronAPI.getStartupInfo()) || info;
    } catch (e) {
      console.warn('获取启动信息失败', e);
    }

    if (bootVersion && info.version) {
      bootVersion.textContent = `v${info.version}`;
    }

    if (!info.isPackaged) {
      setBootStatus('开发模式，跳过更新检测', '');
      setTimeout(enterApp, 280);
      return;
    }

    setBootStatus('正在检查更新…', '请稍候');
    try {
      const result = await window.electronAPI.checkForUpdates();
      if (!result || !result.ok) {
        if (!updateInProgress && !appEntered) {
          setBootStatus('检查更新失败，进入应用…', result && result.reason ? String(result.reason) : '');
          setTimeout(enterApp, 900);
        }
      }
      // 成功时由 update-status 事件驱动：not-available → 进主界面；available → 下载安装
    } catch (e) {
      console.warn('检查更新异常', e);
      if (!updateInProgress && !appEntered) {
        setBootStatus('检查更新失败，进入应用…', '');
        setTimeout(enterApp, 900);
      }
    }
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    addBtn.addEventListener('click', () => {
      const added = addTasks(taskInput.value);
      if (added > 0) {
        taskInput.value = '';
        taskInput.style.height = 'auto';
      }
      taskInput.focus();
    });

    taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
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
    });

    taskInput.addEventListener('input', () => {
      taskInput.style.height = 'auto';
      taskInput.style.height = Math.min(taskInput.scrollHeight, 160) + 'px';
    });

    clearDoneBtn.addEventListener('click', clearCompleted);

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.task-tag-picker')) closeAllTagMenus();
      if (!e.target.closest('.settings-wrap')) closeSettingsPanel();
    });
  }

  // ---------- 初始化 ----------
  function init() {
    dateTag.textContent = todayStr();
    tasks = loadTasks();
    tagOrder = loadTagOrder();
    settings = loadSettings();
    cleanupExpired();
    if (enforceSinglePinPerCategory()) saveTasks();
    renderTagBar();
    render();
    bindEvents();
    initPinBtn();
    initSettings();
    runBootSequence();

    setInterval(() => {
      const beforeCount = tasks.length;
      cleanupExpired();
      if (tasks.length !== beforeCount) render();
    }, 60 * 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
