let originalHtml = '';
let doc = null;
let posts = [];
let nameColorMap = new Map();
let tabs = new Set();

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

fileInput.addEventListener('change', handleFile);
downloadBtn.addEventListener('click', downloadEditedHtml);
addPostBtn.addEventListener('click', addPost);

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

  const pList = Array.from(doc.body.querySelectorAll('p'));

  posts = pList.map((p, index) => {
    const spans = p.querySelectorAll('span');

    const color = getColorFromStyle(p.getAttribute('style') || '');
    const tab = cleanTab(spans[0]?.textContent || '');
    const name = (spans[1]?.textContent || '').trim();
    const text = htmlToTextareaText(spans[2]?.innerHTML || '');

    if (name && color && !nameColorMap.has(name)) {
      nameColorMap.set(name, color);
    }

    if (tab) tabs.add(tab);

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + index,
      color,
      tab,
      name,
      text,
      deleted: false
    };
  });

  if (!tabs.size) {
    tabs.add('main');
    tabs.add('other');
    tabs.add('info');
  }

  downloadBtn.disabled = false;
  addPostBtn.disabled = false;
}

function renderAll() {
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
  Array.from(tabs).forEach(tab => {
    const option = document.createElement('option');
    option.value = tab;
    option.textContent = '[' + tab + ']';
    newTab.appendChild(option);
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

  posts.forEach((post, index) => {
    const card = document.createElement('article');
    card.className = 'post-card';
    if (post.deleted) card.classList.add('is-deleted');

    card.innerHTML = `
      <div class="post-head">
        <span class="post-index">#${index + 1}</span>
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
    `;

    card.querySelector('.delete-check').addEventListener('change', e => {
      post.deleted = e.target.checked;
      card.classList.toggle('is-deleted', post.deleted);
    });

    card.querySelector('.tab-input').addEventListener('input', e => {
      post.tab = e.target.value.trim();
      if (post.tab) tabs.add(post.tab);
    });

    card.querySelector('.name-input').addEventListener('input', e => {
      post.name = e.target.value;
    });

    card.querySelector('.color-input').addEventListener('input', e => {
      post.color = e.target.value.trim();
    });

    card.querySelector('.text-input').addEventListener('input', e => {
      post.text = e.target.value;
    });

    postsEl.appendChild(card);
  });
}

function addPost() {
  const name = newName.value.trim();
  const tab = newTab.value.trim() || 'main';
  const color = newColor.value.trim() || '#888888';
  const text = newText.value;

  if (!name && !text) return;

  const post = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    tab,
    name: name || 'KP',
    color,
    text,
    deleted: false
  };

  nameColorMap.set(post.name, post.color);
  tabs.add(post.tab);

  if (insertPosition.value === 'top') {
    posts.unshift(post);
  } else {
    posts.push(post);
  }

  newText.value = '';
  renderAll();
}

function downloadEditedHtml() {
  const clonedDoc = doc.cloneNode(true);

  const body = clonedDoc.body;
  body.innerHTML = '\n\n' + posts
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