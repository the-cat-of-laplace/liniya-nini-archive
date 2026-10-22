const searchInput = document.querySelector('#entry-search');
const clearSearchButton = document.querySelector('#clear-search');
const searchStatus = document.querySelector('#search-status');
const sections = [...document.querySelectorAll('[data-search-section]')];
const noResults = document.querySelector('#no-results');
const themeToggle = document.querySelector('#theme-toggle');
const copyButton = document.querySelector('#copy-link');
const toast = document.querySelector('#toast');
const progressBar = document.querySelector('#progress-bar');
const tocLinks = [...document.querySelectorAll('.toc a')];

const themeKey = 'liniya-nini-theme';

function readTheme() {
  try {
    return localStorage.getItem(themeKey) || 'light';
  } catch {
    return 'light';
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(themeKey, theme);
  } catch {
    // Theme preference is optional when storage is unavailable.
  }
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark', isDark);
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? '切换至浅色主题' : '切换至深色主题');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', isDark ? '#181b1b' : '#f3f5f1');
}

applyTheme(readTheme());

themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
  applyTheme(nextTheme);
  saveTheme(nextTheme);
});

function runSearch() {
  const query = searchInput.value.trim().toLocaleLowerCase('zh-CN');
  let matches = 0;

  sections.forEach((section) => {
    const match = !query || section.textContent.toLocaleLowerCase('zh-CN').includes(query);
    section.classList.toggle('search-hidden', !match);
    if (match) matches += 1;
  });

  noResults.hidden = matches > 0;
  if (clearSearchButton) clearSearchButton.hidden = !searchInput.value;
  if (searchStatus) {
    searchStatus.hidden = !query;
    searchStatus.textContent = query ? (matches ? matches + ' 个匹配章节' : '没有匹配章节') : '';
  }
  updateActiveToc();
  scheduleReadingUpdate();
}

searchInput.addEventListener('input', runSearch);

function clearSearch({ focus = true } = {}) {
  searchInput.value = '';
  runSearch();
  if (focus) searchInput.focus({ preventScroll: true });
}

if (clearSearchButton) clearSearchButton.addEventListener('click', () => clearSearch());

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
  }

  if (event.key === 'Escape' && document.activeElement === searchInput) {
    clearSearch();
  }
});

function targetFromHash(hash = window.location.hash) {
  try {
    const id = decodeURIComponent(hash.slice(1));
    return id ? document.getElementById(id) : null;
  } catch {
    return null;
  }
}

function revealTarget(target) {
  const section = target.closest('[data-search-section]');
  if (section && section.classList.contains('search-hidden')) clearSearch({ focus: false });
  return section;
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.target === '_blank') return;
  const target = targetFromHash(link.getAttribute('href'));
  if (target) revealTarget(target);
});

function navigateToHash() {
  const target = targetFromHash();
  if (!target) {
    scheduleReadingUpdate();
    return;
  }
  const section = revealTarget(target);
  requestAnimationFrame(() => {
    target.scrollIntoView({ block: 'start' });
    if (section) activateToc(section.id);
    scheduleReadingUpdate();
  });
}

window.addEventListener('hashchange', navigateToHash);

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
  const previousLink = tocLinks.find((link) => link.classList.contains('active'));
  let activeLink = null;
  tocLinks.forEach((link) => {
    const target = targetFromHash(link.getAttribute('href'));
    const isActive = link.getAttribute('href') === '#' + targetId && target && !target.classList.contains('search-hidden');
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'location');
      activeLink = link;
    } else {
      link.removeAttribute('aria-current');
    }
  });

  if (activeLink && activeLink !== previousLink && window.matchMedia('(max-width: 760px)').matches) {
    const toc = activeLink.closest('.toc');
    const offset = activeLink.getBoundingClientRect().left - toc.getBoundingClientRect().left;
    toc.scrollLeft += offset - (toc.clientWidth - activeLink.offsetWidth) / 2;
  }
}

function updateActiveToc() {
  const visibleSections = sections.filter((section) => !section.classList.contains('search-hidden'));
  const marker = Math.max(112, window.innerHeight * 0.16);
  const currentSection = [...visibleSections].reverse().find((section) => section.getBoundingClientRect().top <= marker) || visibleSections[0];
  activateToc(currentSection ? currentSection.id : null);
}

const sectionObserver = new IntersectionObserver(() => {
  updateActiveToc();
}, { rootMargin: '-16% 0px -72% 0px', threshold: 0 });

sections.forEach((section) => sectionObserver.observe(section));

let progressQueued = false;
function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
  progressBar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, progress)) + ')';
  progressQueued = false;
  updateActiveToc();
}

function scheduleReadingUpdate() {
  if (progressQueued) return;
  progressQueued = true;
  requestAnimationFrame(updateProgress);
}

document.addEventListener('scroll', scheduleReadingUpdate, { passive: true });
window.addEventListener('resize', scheduleReadingUpdate);

if (typeof ResizeObserver !== 'undefined') {
  const layoutObserver = new ResizeObserver(scheduleReadingUpdate);
  layoutObserver.observe(document.body);
}

updateProgress();

window.addEventListener('load', navigateToHash);
