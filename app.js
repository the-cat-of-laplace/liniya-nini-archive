const searchInput = document.querySelector('#entry-search');
const sections = [...document.querySelectorAll('[data-search-section]')];
const noResults = document.querySelector('#no-results');
const themeToggle = document.querySelector('#theme-toggle');
const copyButton = document.querySelector('#copy-link');
const toast = document.querySelector('#toast');
const progressBar = document.querySelector('#progress-bar');
const tocLinks = [...document.querySelectorAll('.toc a')];
const dialog = document.querySelector('#contribution-dialog');
const contributionButton = document.querySelector('#contribute-button');
const closeDialogButton = document.querySelector('#close-dialog');
const cancelDialogButton = document.querySelector('#cancel-dialog');
const contributionForm = document.querySelector('#contribution-form');
const draftsSection = document.querySelector('#drafts');
const draftsNav = document.querySelector('.drafts-nav');
const draftList = document.querySelector('#draft-list');
const draftCount = document.querySelector('#draft-count');
const exportDraftsButton = document.querySelector('#export-drafts');
const clearDraftsButton = document.querySelector('#clear-drafts');

const themeKey = 'liniya-nini-theme';
const draftsKey = 'liniya-nini-drafts-v1';

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? '切换至浅色主题' : '切换至深色主题');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', isDark ? '#181b1b' : '#f3f5f1');
}

applyTheme(readStorage(themeKey, 'light'));

themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
  applyTheme(nextTheme);
  writeStorage(themeKey, nextTheme);
});

function runSearch() {
  const query = searchInput.value.trim().toLocaleLowerCase('zh-CN');
  let matches = 0;

  sections.forEach((section) => {
    if (section.hidden) return;
    const match = !query || section.textContent.toLocaleLowerCase('zh-CN').includes(query);
    section.classList.toggle('search-hidden', !match);
    if (match) matches += 1;
  });

  noResults.hidden = matches > 0;
}

searchInput.addEventListener('input', runSearch);

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
  }

  if (event.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.value = '';
    searchInput.blur();
    runSearch();
  }
});

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('copy failed');
}

copyButton.addEventListener('click', async () => {
  try {
    await copyText(window.location.href);
    showToast('条目链接已复制');
  } catch {
    showToast('当前浏览器未开放剪贴板权限');
  }
});

function activateToc(targetId) {
  let activeLink = null;
  tocLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${targetId}`;
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'location');
    } else {
      link.removeAttribute('aria-current');
    }
    if (isActive) activeLink = link;
  });

  if (activeLink && window.matchMedia('(max-width: 760px)').matches) {
    activeLink.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}

const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting && !entry.target.classList.contains('search-hidden'))
    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

  if (!visible) return;
  activateToc(visible.target.id);
}, { rootMargin: '-16% 0px -72% 0px', threshold: 0 });

sections.forEach((section) => sectionObserver.observe(section));

let progressQueued = false;
function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
  progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
  progressQueued = false;
}

document.addEventListener('scroll', () => {
  if (progressQueued) return;
  progressQueued = true;
  requestAnimationFrame(updateProgress);
}, { passive: true });

updateProgress();

window.addEventListener('load', () => {
  const targetId = decodeURIComponent(window.location.hash.slice(1));
  if (!targetId) return;
  const target = document.getElementById(targetId);
  if (!target) return;
  window.setTimeout(() => {
    target.scrollIntoView({ block: 'start' });
    activateToc(targetId);
    updateProgress();
  }, 80);
});

function openContributionDialog() {
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  document.querySelector('#draft-content').focus();
}

function closeContributionDialog() {
  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

contributionButton.addEventListener('click', openContributionDialog);
closeDialogButton.addEventListener('click', closeContributionDialog);
cancelDialogButton.addEventListener('click', closeContributionDialog);

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeContributionDialog();
});

function loadDrafts() {
  const drafts = readStorage(draftsKey, []);
  return Array.isArray(drafts) ? drafts : [];
}

function formatDraftDate(isoDate) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(isoDate));
}

function renderDrafts() {
  const drafts = loadDrafts();
  const hasDrafts = drafts.length > 0;
  draftsSection.hidden = !hasDrafts;
  draftsNav.hidden = !hasDrafts;
  draftCount.textContent = String(drafts.length);
  draftList.replaceChildren();

  drafts.forEach((draft) => {
    const item = document.createElement('li');
    const meta = document.createElement('span');
    const content = document.createElement('p');
    const source = document.createElement('small');
    const removeButton = document.createElement('button');

    meta.textContent = `${draft.category} · ${formatDraftDate(draft.createdAt)}`;
    content.textContent = draft.content;
    source.textContent = draft.source ? `来源：${draft.source}` : '来源：未填写';
    removeButton.type = 'button';
    removeButton.className = 'draft-delete';
    removeButton.setAttribute('aria-label', '删除这条草稿');
    removeButton.title = '删除草稿';
    removeButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"></path></svg>';
    removeButton.addEventListener('click', () => {
      const nextDrafts = loadDrafts().filter((entry) => entry.id !== draft.id);
      if (!writeStorage(draftsKey, nextDrafts)) {
        showToast('无法删除当前浏览器中的草稿');
        return;
      }
      renderDrafts();
      runSearch();
      showToast('草稿已删除');
    });

    item.append(meta, content, source, removeButton);
    draftList.appendChild(item);
  });
}

contributionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const category = document.querySelector('#draft-category').value;
  const content = document.querySelector('#draft-content').value.trim();
  const source = document.querySelector('#draft-source').value.trim();
  if (!content) return;

  const drafts = loadDrafts();
  drafts.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    category,
    content,
    source,
    createdAt: new Date().toISOString()
  });

  if (!writeStorage(draftsKey, drafts)) {
    showToast('无法保存到当前浏览器');
    return;
  }

  contributionForm.reset();
  closeContributionDialog();
  renderDrafts();
  runSearch();
  showToast('资料草稿已保存');
});

exportDraftsButton.addEventListener('click', () => {
  const drafts = loadDrafts();
  const payload = {
    entry: '栗妮亚_nini',
    uid: '3537105286334825',
    exportedAt: new Date().toISOString(),
    drafts
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `liniya-nini-drafts-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('草稿已导出');
});

clearDraftsButton.addEventListener('click', () => {
  if (!window.confirm('确定清空全部本地草稿吗？')) return;
  if (!writeStorage(draftsKey, [])) {
    showToast('无法清空当前浏览器中的草稿');
    return;
  }
  renderDrafts();
  runSearch();
  showToast('本地草稿已清空');
});

renderDrafts();
