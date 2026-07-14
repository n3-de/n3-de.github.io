let posts = JSON.parse(localStorage.getItem('archive-posts') || '[]');
let currentTab = 'popular';
let nextId = posts.length > 0 ? Math.max(...posts.map(p => p.id)) + 1 : 1;
let pendingFiles = [];
let lastKnownPostCount = posts.length;
let activeQuoteId = null;

function savePosts() {
    try {
        localStorage.setItem('archive-posts', JSON.stringify(posts));
    } catch (e) {
        showToast('⚠️ Память браузера переполнена!');
    }
}

const themeToggle = document.getElementById('themeToggle');
function initTheme() {
    if (localStorage.getItem('archive-theme') === 'light') {
        document.body.classList.add('light');
        themeToggle.textContent = '☀️';
    }
}
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    themeToggle.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('archive-theme', isLight ? 'light' : 'dark');
});

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        switchTab(tab.dataset.tab);
    });
});

function switchTab(tabId) {
    const tabEl = document.querySelector(`.tab[data-tab="${tabId}"]`);
    if (!tabEl) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
    currentTab = tabId;
    moveTabIndicator(tabEl);
    if (currentTab === 'new') {
        lastKnownPostCount = posts.length;
        const badge = tabEl.querySelector('.new-badge');
        if (badge) badge.remove();
    }
    renderFeed();
}

function moveTabIndicator(tabEl) {
    const indicator = document.getElementById('tabIndicator');
    if (!indicator || !tabEl) return;
    indicator.style.left = tabEl.offsetLeft + 'px';
    indicator.style.width = tabEl.offsetWidth + 'px';
}

window.addEventListener('resize', () => {
    moveTabIndicator(document.querySelector('.tab.active'));
});

document.getElementById('fileInput').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(ev) {
            pendingFiles.push({ data: ev.target.result, type: file.type, name: file.name });
            renderPreviews();
        };
        reader.readAsDataURL(file);
    });
    this.value = '';
});

function renderPreviews() {
    const grid = document.getElementById('previewGrid');
    grid.innerHTML = pendingFiles.map((f, i) => `
        <div class="preview-item">
            ${f.type.startsWith('video') ? `<video src="${f.data}"></video>` : `<img src="${f.data}">`}
            <button class="remove-btn" onclick="removeFile(${i})">✕</button>
        </div>
    `).join('');
}

function removeFile(index) { pendingFiles.splice(index, 1); renderPreviews(); }

function getAvatar(author) {
    return (author || '?')[0].toUpperCase();
}

function getAvatarColor(author) {
    let hash = 0;
    for (let i = 0; i < author.length; i++) {
        hash = author.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 55%, 43%)`;
}

function timeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 30) return new Date(timestamp).toLocaleDateString('ru-RU');
    if (days > 0) return days === 1 ? 'Вчера' : `${days} дн. назад`;
    if (hours > 0) return `${hours} ч. назад`;
    if (minutes > 0) return `${minutes} мин. назад`;
    return 'Только что';
}

function catalogNumber(id) {
    return '№ ' + String(id).padStart(4, '0');
}

function getFilteredPosts() {
    let filtered = [...posts];
    if (currentTab === 'popular') filtered.sort((a, b) => b.likes - a.likes);
    else if (currentTab === 'new') filtered.sort((a, b) => b.timestamp - a.timestamp);
    else if (currentTab === 'date') filtered.sort((a, b) => a.timestamp - b.timestamp);
    else if (currentTab === 'my') {
        const myNick = localStorage.getItem('archive-mynick') || '';
        filtered = filtered.filter(p => p.author === myNick);
    }
    filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return filtered;
}

function renderFeed() {
    const feed = document.getElementById('feed');
    const filtered = getFilteredPosts();
    if (filtered.length === 0) {
        feed.innerHTML = `
            <div class="empty-state">
                <div class="emoji">📝</div>
                <p>Пока нет ни одного поста</p>
                <p class="hint">Нажимай ✚ чтобы добавить первую запись!</p>
            </div>`;
        return;
    }
    feed.innerHTML = '';
    filtered.forEach((post, i) => {
        const el = createPostElement(post);
        el.style.animationDelay = (Math.min(i, 8) * 45) + 'ms';
        feed.appendChild(el);
    });
    document.querySelectorAll('.gallery-slides').forEach(initGallery);
    updateNewBadge();
}

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'post' + (post.pinned ?