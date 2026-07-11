let posts = JSON.parse(localStorage.getItem('archive-posts') || '[]');
let currentTab = 'popular';
let nextId = posts.length > 0 ? Math.max(...posts.map(p => p.id)) + 1 : 1;
let pendingFiles = [];

function savePosts() {
    localStorage.setItem('archive-posts', JSON.stringify(posts));
}

// Тема
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

// Табы
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        renderFeed();
    });
});

// Загрузка файлов
document.getElementById('fileInput').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(ev) {
            pendingFiles.push({
                data: ev.target.result,
                type: file.type,
                name: file.name
            });
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
            ${f.type.startsWith('video') 
                ? `<video src="${f.data}"></video>`
                : `<img src="${f.data}">`
            }
            <button class="remove-btn" onclick="removeFile(${i})">✕</button>
        </div>
    `).join('');
}

function removeFile(index) {
    pendingFiles.splice(index, 1);
    renderPreviews();
}

// Время
function timeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) {
        return new Date(timestamp).toLocaleDateString('ru-RU');
    } else if (days > 0) {
        return days === 1 ? 'Вчера' : `${days} дн. назад`;
    } else if (hours > 0) {
        return `${hours} ч. назад`;
    } else if (minutes > 0) {
        return `${minutes} мин. назад`;
    } else {
        return 'Только что';
    }
}

// Посты
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
                <p class="hint">Нажми ✚ чтобы добавить первый пост!</p>
            </div>`;
        return;
    }

    feed.innerHTML = '';
    filtered.forEach(post => feed.appendChild(createPostElement(post)));
    document.querySelectorAll('.gallery-slides').forEach(initGallery);
}

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'post' + (post.pinned ? ' pinned' : '');
    div.id = `post-${post.id}`;

    let mediaHTML = '';
    if (post.media && post.media.length > 0) {
        const slides = post.media.map(url => {
            const isVideo = url.startsWith('data:video');
            return isVideo
                ? `<div class="gallery-slide"><video src="${url}" controls preload="metadata" playsinline></video></div>`
                : `<div class="gallery-slide"><img src="${url}" loading="lazy"></div>`;
        }).join('');

        const dots = post.media.map((_, i) => 
            `<span class="gallery-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`
        ).join('');

        mediaHTML = `
            <div class="post-gallery">
                <div class="gallery-slides">${slides}</div>
                ${post.media.length > 1 ? `<div class="gallery-dots">${dots}</div>` : ''}
            </div>`;
    }

    const tagsHTML = post.tags.map(t => 
        `<span class="tag" onclick="searchTag('${t.replace(/'/g, "\\'")}')">${escapeHtml(t)}</span>`
    ).join('');

    const commentsHTML = (post.comments || []).map(c => 
        `<div class="comment"><strong>${escapeHtml(c.author)}</strong> ${escapeHtml(c.text)}</div>`
    ).join('');

    const isMyPost = post.author === (localStorage.getItem('archive-mynick') || '');

    div.innerHTML = `
        ${post.pinned ? '<div class="pin-badge">📌</div>' : ''}
        <div class="post-header">
            <div class="post-avatar">🦊</div>
            <div>
                <span class="post-author" onclick="openProfile('${escapeHtml(post.author).replace(/'/g, "\\'")}')">${escapeHtml(post.author)}</span>
                <div class="post-time">${timeAgo(post.timestamp)}</div>
            </div>
            <span class="post-views">👁 ${post.views || 0}</span>
        </div>
        ${mediaHTML}
        <div class="post-text">${escapeHtml(post.text)}</div>
        <div class="post-tags">${tagsHTML}</div>
        <div class="post-actions">
            <button class="action-btn ${post.liked ? 'liked' : ''}" onclick="toggleLike(${post.id})">❤️ <span>${post.likes}</span></button>
            <span class="action-btn" onclick="this.parentElement.parentElement.querySelector('.comments-section').classList.toggle('open')">💬 ${(post.comments || []).length}</span>
            <span class="action-btn" onclick="sharePost(${post.id})">🔗</span>
            ${isMyPost ? `<button class="action-btn" onclick="editPost(${post.id})">✏️</button>` : ''}
            ${isMyPost ? `<button class="action-btn delete-btn" onclick="deletePost(${post.id})">🗑</button>` : ''}
        </div>
        <div class="comments-section" style="display:none;">
            <div class="comments-list">${commentsHTML || '<div style="color:var(--text3);font-size:13px;">Нет комментариев</div>'}</div>
            <div class="comment-input-row">
                <input class="comment-input" placeholder="Добавить комментарий..." onkeypress="if(event.key==='Enter')addComment(${post.id}, this)">
                <button class="comment-submit" onclick="addComment(${post.id}, this.previousElementSibling)">Отпр.</button>
            </div>
        </div>
    `;

    if (!post._viewed) {
        post.views = (post.views || 0) + 1;
        post._viewed = true;
        savePosts();
    }

    return div;
}

function initGallery(slidesContainer) {
    const dots = slidesContainer.parentElement.querySelectorAll('.gallery-dot');
    if (!dots.length) return;

    slidesContainer.addEventListener('scroll', () => {
        const index = Math.round(slidesContainer.scrollLeft / slidesContainer.clientWidth);
        dots.forEach((d, i) => d.classList.toggle('active', i === index));
    });

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.dataset.index);
            slidesContainer.scrollTo({ left: index * slidesContainer.clientWidth, behavior: 'smooth' });
        });
    });
}

function toggleLike(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    post.liked = !post.liked;
    post.likes += post.liked ? 1 : -1;
    savePosts();
    renderFeed();
}

function addComment(postId, input) {
    const text = input.value.trim();
    if (!text) return;
    const author = localStorage.getItem('archive-mynick') || 'Аноним';
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (!post.comments) post.comments = [];
    post.comments.push({ author, text, timestamp: Date.now() });
    savePosts();
    renderFeed();
}

function sharePost(postId) {
    const url = `${window.location.origin}${window.location.pathname}#/post/${postId}`;
    if (navigator.share) {
        navigator.share({ title: 'Archive', url });
    } else {
        navigator.clipboard.writeText(url).then(() => alert('🔗 Ссылка скопирована!'));
    }
}

function deletePost(postId) {
    if (!confirm('Точно удалить этот пост?')) return;
    posts = posts.filter(p => p.id !== postId);
    savePosts();
    renderFeed();
}

function editPost(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    document.getElementById('modalTitle').textContent = '✏️ Редактировать пост';
    document.getElementById('editPostId').value = postId;
    document.getElementById('newPostAuthor').value = post.author;
    document.getElementById('newPostText').value = post.text;
    document.getElementById('newPostTags').value = post.tags.join(' ');
    document.getElementById('newPostPinned').checked = post.pinned || false;
    document.getElementById('publishBtn').textContent = '💾 Сохранить';
    pendingFiles = [];
    renderPreviews();
    document.getElementById('newPostModal').classList.add('open');
}

function openNewPost() { 
    document.getElementById('modalTitle').textContent = '✚ Новый пост';
    document.getElementById('editPostId').value = '';
    document.getElementById('newPostAuthor').value = localStorage.getItem('archive-mynick') || '';
    document.getElementById('newPostText').value = '';
    document.getElementById('newPostTags').value = '';
    document.getElementById('newPostPinned').checked = false;
    document.getElementById('publishBtn').textContent = '📤 Опубликовать';
    pendingFiles = [];
    renderPreviews();
    document.getElementById('newPostModal').classList.add('open'); 
}
function closeNewPost() { document.getElementById('newPostModal').classList.remove('open'); }

function publishPost() {
    const editId = document.getElementById('editPostId').value;
    const author = document.getElementById('newPostAuthor').value.trim();
    const text = document.getElementById('newPostText').value.trim();
    const tagsRaw = document.getElementById('newPostTags').value.trim();
    const pinned = document.getElementById('newPostPinned').checked;

    if (!author) { alert('Укажи ник!'); return; }
    if (!text && pendingFiles.length === 0) { alert('Напиши текст или добавь скриншот!'); return; }

    const media = pendingFiles.map(f => f.data);
    const tags = tagsRaw ? tagsRaw.split(/\s+/).filter(t => t).map(t => t.replace(/^#/, '')) : [];

    if (editId) {
        const post = posts.find(p => p.id === parseInt(editId));
        if (post) {
            post.author = author;
            post.text = text || '';
            post.tags = tags;
            post.pinned = pinned;
            if (media.length > 0) post.media = media;
        }
    } else {
        const post = {
            id: nextId++,
            author,
            text: text || '',
            media,
            tags,
            pinned,
            likes: 0,
            liked: false,
            views: 0,
            comments: [],
            timestamp: Date.now()
        };
        posts.unshift(post);
    }

    savePosts();
    localStorage.setItem('archive-mynick', author);
    closeNewPost();
    pendingFiles = [];
    renderPreviews();
    currentTab = 'new';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab[data-tab="new"]').classList.add('active');
    renderFeed();
}

function openSearch() { document.getElementById('searchModal').classList.add('open'); document.getElementById('searchInput').focus(); }
function closeSearch() { document.getElementById('searchModal').classList.remove('open'); }

function doSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const results = document.getElementById('searchResults');
    if (!query) { results.innerHTML = 'Начни вводить запрос...'; return; }

    const found = posts.filter(p =>
        p.text.toLowerCase().includes(query) ||
        p.author.toLowerCase().includes(query) ||
        p.tags.some(t => t.toLowerCase().includes(query))
    );

    if (!found.length) { results.innerHTML = '😕 Ничего не найдено'; return; }

    results.innerHTML = `<p style="color:var(--text2);margin-bottom:10px;">Найдено: ${found.length} постов</p>` +
        found.map(p => `
            <div class="search-result" onclick="closeSearch();document.getElementById('post-${p.id}')?.scrollIntoView({behavior:'smooth'})">
                <div class="author">👤 ${escapeHtml(p.author)}</div>
                <div class="text">${escapeHtml(p.text.substring(0, 100))}</div>
                <div class="tags">${p.tags.map(t => '#' + t).join(' ')}</div>
            </div>
        `).join('');
}

function searchTag(tag) {
    document.getElementById('searchModal').classList.add('open');
    document.getElementById('searchInput').value = tag;
    doSearch();
}

function openProfile(author) {
    const modal = document.getElementById('profileModal');
    const header = document.getElementById('profileHeader');
    const postsContainer = document.getElementById('profilePosts');
    const userPosts = posts.filter(p => p.author === author);
    const totalLikes = userPosts.reduce((sum, p) => sum + p.likes, 0);

    header.innerHTML = `
        <div class="profile-avatar">🦊</div>
        <div class="profile-info">
            <h2>👤 ${escapeHtml(author)}</h2>
            <p>📝 Постов: ${userPosts.length}</p>
            <p>❤️ Лайков: ${totalLikes}</p>
        </div>
    `;

    postsContainer.innerHTML = userPosts.length === 0 
        ? '<p style="color:var(--text2);text-align:center;padding:20px;">У этого автора пока нет постов</p>'
        : userPosts.map(p => `
            <div class="profile-post" onclick="closeProfile();document.getElementById('post-${p.id}')?.scrollIntoView({behavior:'smooth'})">
                <div style="color:var(--text2);font-size:12px;">${timeAgo(p.timestamp)}</div>
                <div class="text">${escapeHtml(p.text.substring(0, 120))}</div>
                <div class="meta">❤️ ${p.likes} • 👁 ${p.views || 0} • ${p.tags.map(t => '#' + t).join(' ')}</div>
            </div>
        `).join('');

    modal.classList.add('open');
}

function closeProfile() { document.getElementById('profileModal').classList.remove('open'); }

// Экспорт/импорт
function exportData() {
    const data = JSON.stringify(posts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'archive-backup.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                if (confirm(`Загружено ${imported.length} постов. Объединить с текущими? (OK - добавить, Отмена - заменить)`)) {
                    const existingIds = new Set(posts.map(p => p.id));
                    const newPosts = imported.filter(p => !existingIds.has(p.id));
                    posts = [...posts, ...newPosts];
                } else {
                    posts = imported;
                }
                nextId = Math.max(...posts.map(p => p.id), 0) + 1;
                savePosts();
                renderFeed();
                alert('✅ Готово!');
            }
        } catch(err) {
            alert('❌ Ошибка: неверный формат файла');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

initTheme();
renderFeed();