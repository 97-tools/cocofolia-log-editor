let originalHtml = '';
let doc = null;
let posts = [];
let nameColorMap = new Map();
let tabs = new Set();
let currentPage = 1;

const fileInput = document.getElementById('fileInput');
const postsEl = document.getElementById('posts');
const downloadBtn = document.getElementById('downloadBtn');
const addPostBtn = document.getElementById('addPostBtn');
const summaryEl = document.getElementById('summary');

const newTab = document.getElementById('newTab');
const newName = document.getElementById('newName');
const newColor = document.getElementById('newColor');
const newText = document.getElementById('newText');
const insertPosition = document.getElementById('insertPosition');

const searchInput = document.getElementById('searchInput');
const tabFilter = document.getElementById('tabFilter');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const saveWorkBtn = document.getElementById('saveWorkBtn');
const workFileInput = document.getElementById('workFileInput');

fileInput.addEventListener('change', handleFile);
downloadBtn.addEventListener('click', downloadEditedHtml);
addPostBtn.addEventListener('click', addPost);

searchInput.addEventListener('input', () => {
  currentPage = 1;
  renderPosts();
});

tabFilter.addEventListener('change', () => {
  currentPage = 1;
  renderPosts();
});

pageSizeSelect.addEventListener('change', () => {
  currentPage = 1;
  renderPosts();
});

prevPageBtn.addEventListener('click', () => {
  currentPage--;
  renderPosts();
});

nextPageBtn.addEventListener('click', () => {
  currentPage++;
  renderPosts();
});

saveWorkBtn.addEventListener('click', saveWorkJson);
workFileInput.addEventListener('change', loadWorkJson);

newName.addEventListener('change', () => {
  const color = nameColorMap.get(newName.value);
  if (color) newColor.value = color;
});

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    originalHtml = reader.result;
    parseHtml(originalHtml);
    renderAll();
  };

  reader.readAsText(file);
}

function parseHtml(html) {
  const parser = new DOMParser();
  doc = parser.parseFromString(html, 'text/html');

  nameColorMap = new Map();
  tabs = new Set();

  const pList = Array.from(doc.body.querySelectorAll('p'));

  posts = pList.map((p, index) => {
    const spans = p.querySelectorAll('span');

    const color = getColorFromStyle(p.getAttribute('style') || '');
    const tab = cleanTab(spans[0]?.textContent || '');
    const name = (spans[1]?.textContent || '').trim();
    const text = htmlToTextareaText(spans[2]?.innerHTML || '');

    if (name && color && !nameColorMap.has(name)) nameColorMap.set(name, color);
    if (tab) tabs.add(tab);

    return {
      id: makeId(index),
      color,
      tab,
      name,
      text,
      deleted: false
    };
  });

  ensureDefaults();

  downloadBtn.disabled = false;
  addPostBtn.disabled = false;
  saveWorkBtn.disabled = false;
}

function renderAll() {
  rebuildMaps();
  renderSummary();
  renderSelectors();
  renderPosts();
}

function renderSummary() {
  summaryEl.textContent =
    `投稿 ${posts.length} 件 / 名前 ${nameColorMap.size} 種 / タブ ${tabs.size} 種`;
}

function renderSelectors() {
  newTab.innerHTML = '';
  tabFilter.innerHTML = '<option value="">すべてのタブ</option>';

  Array.from(tabs).forEach(tab => {
    const option1 = document.createElement('option');
    option1.value = tab;
    option1.textContent = '[' + tab + ']';
    newTab.appendChild(option1);

    const option2 = document.createElement('option');
    option2.value = tab;
    option2.textContent = '[' + tab + ']';
    tabFilter.appendChild(option2);
  });

  newName.innerHTML = '';
  Array.from(nameColorMap.keys()).forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    newName.appendChild(option);
  });

  if (newName.value) {
    newColor.value = nameColorMap.get(newName.value) || '#888888';
  }
}

function renderPosts() {
  postsEl.innerHTML = '';

  const filtered = getFilteredPosts();
  const pageSize = Number(pageSizeSelect.value);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  pageInfo.textContent = `${currentPage} / ${totalPages}（${filtered.length}件）`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;

  pageItems.forEach(({ post, realIndex }) => {
    const card = document.createElement('article');
    card.className = 'post-card';
    if (post.deleted) card.classList.add('is-deleted');

    card.innerHTML = `
      <div class="post-head">
        <span class="post-index">#${realIndex + 1}</span>
        <label>
          <input type="checkbox" class="delete-check" ${post.deleted ? 'checked' : ''}>
          削除
        </label>
      </div>

      <div class="post-grid">
        <label>タブ
          <input class="tab-input" value="${escapeAttr(post.tab)}">
        </label>

        <label>名前
          <input class="name-input" value="${escapeAttr(post.name)}">
        </label>

        <label>色
          <input class="color-input" value="${escapeAttr(post.color)}">
        </label>
      </div>

      <textarea class="text-input" rows="5">${escapeText(post.text)}</textarea>

      <div class="inline-actions">
        <button type="button" class="insert-after">この下に追加</button>
        <button type="button" class="move-up">↑ 上へ</button>
        <button type="button" class="move-down">↓ 下へ</button>
      </div>
    `;

    card.querySelector('.delete-check').addEventListener('change', e => {
      post.deleted = e.target.checked;
      card.classList.toggle('is-deleted', post.deleted);
    });

    card.querySelector('.tab-input').addEventListener('input', e => {
      post.tab = e.target.value.trim();
      rebuildMaps();
      renderSummary();
    });

    card.querySelector('.name-input').addEventListener('input', e => {
      post.name = e.target.value;
      rebuildMaps();
      renderSummary();
    });

    card.querySelector('.color-input').addEventListener('input', e => {
      post.color = e.target.value.trim();
      rebuildMaps();
      renderSummary();
    });

    card.querySelector('.text-input').addEventListener('input', e => {
      post.text = e.target.value;
    });

    card.querySelector('.insert-after').addEventListener('click', () => {
      insertPostAfter(realIndex);
    });

    card.querySelector('.move-up').addEventListener('click', () => {
      movePost(realIndex, -1);
    });

    card.querySelector('.move-down').addEventListener('click', () => {
      movePost(realIndex, 1);
    });

    postsEl.appendChild(card);
  });
}

function getFilteredPosts() {
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedTab = tabFilter.value;

  return posts
    .map((post, realIndex) => ({ post, realIndex }))
    .filter(({ post }) => {
      if (selectedTab && post.tab !== selectedTab) return false;

      if (keyword) {
        const target = `${post.tab} ${post.name} ${post.text}`.toLowerCase();
        if (!target.includes(keyword)) return false;
      }

      return true;
    });
}

function addPost() {
  const name = newName.value.trim();
  const tab = newTab.value.trim() || 'main';
  const color = newColor.value.trim() || '#888888';
  const text = newText.value;

  if (!name && !text) return;

  const post = {
    id: makeId(Date.now()),
    tab,
    name: name || 'KP',
    color,
    text,
    deleted: false
  };

  if (insertPosition.value === 'top') {
    posts.unshift(post);
  } else {
    posts.push(post);
  }

  newText.value = '';
  renderAll();
}

function insertPostAfter(index) {
  const base = posts[index];

  const post = {
    id: makeId(Date.now()),
    tab: base.tab || 'main',
    name: base.name || 'KP',
    color: base.color || '#888888',
    text: '',
    deleted: false
  };

  posts.splice(index + 1, 0, post);
  renderAll();
}

function movePost(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= posts.length) return;

  const item = posts.splice(index, 1)[0];
  posts.splice(newIndex, 0, item);

  renderPosts();
}

function saveWorkJson() {
  const data = {
    version: 1,
    originalHtml,
    posts
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'ccfolia-log-work.json';
  a.click();

  URL.revokeObjectURL(url);
}

function loadWorkJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    const data = JSON.parse(reader.result);

    originalHtml = data.originalHtml || '';
    posts = data.posts || [];

    if (originalHtml) {
      const parser = new DOMParser();
      doc = parser.parseFromString(originalHtml, 'text/html');
    } else {
      doc = document.implementation.createHTMLDocument('ccfolia-log');
    }

    ensureDefaults();

    downloadBtn.disabled = false;
    addPostBtn.disabled = false;
    saveWorkBtn.disabled = false;

    renderAll();
  };

  reader.readAsText(file);
}

function downloadEditedHtml() {
  const clonedDoc = doc.cloneNode(true);

  clonedDoc.body.innerHTML = '\n\n' + posts
    .filter(post => !post.deleted)
    .map(postToHtml)
    .join('\n\n') + '\n\n';

  const result = '<!DOCTYPE html>\n' + clonedDoc.documentElement.outerHTML;

  const blob = new Blob([result], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'ccfolia-log-edited.html';
  a.click();

  URL.revokeObjectURL(url);
}

function postToHtml(post) {
  const color = normalizeColor(post.color);
  const tab = post.tab || 'main';
  const name = post.name || 'KP';
  const textHtml = textareaTextToHtml(post.text);

  return `<p style="color:${escapeAttr(color)};">
  <span> [${escapeHtml(tab)}]</span>
  <span>${escapeHtml(name)}</span> :
  <span>
    ${textHtml}
  </span>
</p>`;
}

function rebuildMaps() {
  nameColorMap = new Map();
  tabs = new Set();

  posts.forEach(post => {
    if (post.name && post.color && !nameColorMap.has(post.name)) {
      nameColorMap.set(post.name, post.color);
    }
    if (post.tab) tabs.add(post.tab);
  });

  ensureDefaults();
}

function ensureDefaults() {
  if (!tabs.size) {
    tabs.add('main');
    tabs.add('other');
    tabs.add('info');
  }

  if (!nameColorMap.size) {
    nameColorMap.set('KP', '#888888');
  }
}

function getColorFromStyle(style) {
  const match = style.match(/color\s*:\s*([^;]+)\s*;?/i);
  return match ? match[1].trim() : '#888888';
}

function normalizeColor(color) {
  if (!color) return '#888888';
  return color.startsWith('#') ? color : '#' + color;
}

function cleanTab(text) {
  return text.replace('[', '').replace(']', '').trim();
}

function htmlToTextareaText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function textareaTextToHtml(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

function escapeText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function makeId(seed) {
  if (crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + '-' + seed + '-' + Math.random();
}
