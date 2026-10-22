import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

// Offline checks: no Bilibili requests and no build dependencies.
const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const errors = [];
let resourceCount = 0;
let anchorCount = 0;

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)]
    .map((match) => [match[1].toLowerCase(), match[2]]));
}

const ids = new Set();
for (const match of html.matchAll(/<[a-z][^>]*>/gi)) {
  const id = attributes(match[0]).id;
  if (!id) continue;
  if (ids.has(id)) errors.push('Duplicate id: ' + id);
  ids.add(id);
}

function checkLocalReference(value, fromFile) {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return;
  const reference = value.replace(/&amp;/g, '&');
  const [pathAndQuery, fragment] = reference.split('#');
  let path;
  let decodedFragment;
  try {
    path = decodeURIComponent(pathAndQuery.split('?')[0]);
    decodedFragment = fragment ? decodeURIComponent(fragment) : '';
  } catch {
    errors.push('Malformed local URL: ' + value);
    return;
  }
  const sourceFile = resolve(root, fromFile);
  const target = path ? resolve(dirname(sourceFile), path) : sourceFile;
  if (decodedFragment && target === resolve(root, 'index.html')) {
    anchorCount += 1;
    if (!ids.has(decodedFragment)) errors.push('Missing anchor: ' + value);
  }
  if (!path) return;
  const insideRoot = relative(root, target);
  if (insideRoot.split(/[\\/]/)[0] === '..' || isAbsolute(insideRoot)) {
    errors.push('Resource outside the site: ' + value);
  } else if (!existsSync(target)) {
    errors.push('Missing resource: ' + value);
  }
  resourceCount += 1;
}

for (const match of html.matchAll(/<(?:a|img|script|link)\b[^>]*>/gi)) {
  const tag = match[0];
  const attrs = attributes(tag);
  for (const name of ['href', 'src']) {
    if (attrs[name]) checkLocalReference(attrs[name], 'index.html');
  }
  if (/^<img\b/i.test(tag) && (!attrs.alt || !attrs.alt.trim())) {
    errors.push('Image missing descriptive alt: ' + attrs.src);
  }
  if (attrs.target === '_blank' && !/\b(?:noopener|noreferrer)\b/.test(attrs.rel || '')) {
    errors.push('External tab missing rel protection: ' + attrs.href);
  }
}

for (const match of readFileSync(resolve(root, 'styles.css'), 'utf8')
  .matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
  checkLocalReference(match[1], 'styles.css');
}

for (const match of html.matchAll(/<time\b[^>]*>/gi)) {
  const value = attributes(match[0]).datetime;
  const normalized = value?.length === 7 ? value + '-01' : value;
  const date = new Date(normalized + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value || '') || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, normalized.length) !== normalized) {
    errors.push('Invalid time datetime: ' + value);
  }
}

const toc = html.match(/<aside\b[^>]*class="toc"[\s\S]*?<\/aside>/)?.[0] || '';
const tocTargets = new Set([...toc.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]));
const searchable = [...html.matchAll(/<section\b[^>]*data-search-section[^>]*>/g)]
  .map((match) => attributes(match[0]).id);
for (const id of searchable) {
  if (!tocTargets.has(id)) errors.push('Searchable section missing from TOC: ' + id);
}

try {
  new Script(readFileSync(resolve(root, 'app.js'), 'utf8'), { filename: 'app.js' });
} catch (error) {
  errors.push('JavaScript syntax: ' + error.message);
}

if (errors.length) {
  console.error(errors.map((error) => '- ' + error).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Site checks passed: ${resourceCount} local references, ${anchorCount} anchors, ${searchable.length} sections, image alt text, dates and JavaScript syntax.`);
}
