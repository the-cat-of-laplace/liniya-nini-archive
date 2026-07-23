const searchInput = document.querySelector('#entry-search');
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
    const isActive = link.getAttribute('href') === '#' + targetId;
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'location');
      activeLink = link;
    } else {
      link.removeAttribute('aria-current');
    }
  });

  if (activeLink && window.matchMedia('(max-width: 760px)').matches) {
    activeLink.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}

const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting && !entry.target.classList.contains('search-hidden'))
    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

  if (visible) activateToc(visible.target.id);
}, { rootMargin: '-16% 0px -72% 0px', threshold: 0 });

sections.forEach((section) => sectionObserver.observe(section));

let progressQueued = false;
function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
  progressBar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, progress)) + ')';
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
