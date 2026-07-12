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
    div.className = 'post' + (post.pinned ? ' pinned' : '');
    div.id = `post-${post.id}`;

    let mediaHTML = '';
    if (post.media && post.media.length > 0) {
        const slides = post.media.map(url => {
            const isVideo = url.startsWith('data:video') || url.includes('mp4');
            return isVideo
                ? `<div class="gallery-slide"><video src="${url}" controls preload="metadata" playsinline></video></div>`
                : `<div class="gallery-slide"><img src="${url}" loading="lazy"></div>`;
        }).join('');
        const dots = post.media.map((_, i) => `<span class="gallery-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`).join('');
        mediaHTML = `<div class="post-gallery"><div class="gallery-slides">${slides}</div>${post.media.length > 1 ? `<div class="gallery-dots">${dots}</div>` : ''}</div>`;
    }

    let quotedHTML = '';
    if (post.quotedPostId) {
        const quotedPost = posts.find(p => p.id === post.quotedPostId);
        if (quotedPost) {
            const qAvatarLetter = getAvatar(quotedPost.author);
            const qAvatarColor = getAvatarColor(quotedPost.author);
            quotedHTML = `
                <div class="quoted-card" onclick="event.stopPropagation(); navigateToPost(${quotedPost.id})">
                    <div class="quoted-header">
                        <div class="quoted-avatar" style="background:${qAvatarColor};">${qAvatarLetter}</div>
                        <span class="quoted-author">${escapeHtml(quotedPost.author)}</span>
                        <span class="quoted-time">• ${timeAgo(quotedPost.timestamp)}</span>
                    </div>
                    <div class="quoted-text">${escapeHtml(quotedPost.text)}</div>
                </div>
            `;
        } else {
            quotedHTML = `
                <div class="quoted-card" style="opacity:0.6; pointer-events:none;">
                    <div class="quoted-text"><i>🚫 Запись удалена.</i></div>
                </div>
            `;
        }
    }

    const tagsHTML = post.tags.map(t => `<span class="tag" onclick="searchTag('${t.replace(/'/g, "\\'")}')">${escapeHtml(t)}</span>`).join('');
    const commentsHTML = (post.comments || []).map((c) => `
        <div class="comment">
            <strong>${escapeHtml(c.author)}</strong> ${escapeHtml(c.text)}
            <span style="color:var(--text3);font-size:11px;margin-left:8px;">${timeAgo(c.timestamp)}</span>
        </div>`).join('');

    const isMyPost = post.author === (localStorage.getItem('archive-mynick') || '');
    const avatarLetter = getAvatar(post.author);
    const avatarColor = getAvatarColor(post.author);

    div.innerHTML = `
        ${post.pinned ? '<div class="pin-badge">📌 Закреп.</div>' : `<div class="catalog-no">${catalogNumber(post.id)}</div>`}
        <div class="post-header">
            <div class="post-avatar" style="background:${avatarColor};">${avatarLetter}</div>
            <div>
                <span class="post-author" onclick="openProfile('${escapeHtml(post.author).replace(/'/g, "\\'")}')">${escapeHtml(post.author)}</span>
                <div class="post-time">${timeAgo(post.timestamp)}</div>
            </div>
        </div>
        ${mediaHTML}
        <div class="post-text">${escapeHtml(post.text)}</div>
        ${quotedHTML}
        <div class="post-tags">${tagsHTML}</div>
        <div class="post-actions">
            <button class="action-btn ${post.liked ? 'liked' : ''}" onclick="toggleLike(${post.id})">
                <span class="reaction-glyph">👍</span> <span>${post.likes}</span>
            </button>
            <button class="action-btn" onclick="toggleComments(${post.id})">💬 ${(post.comments || []).length}</button>
            <span class="action-btn">👁 ${post.views || 0}</span>
            <button class="action-btn" onclick="quotePost(${post.id})">🔁</button>
            <button class="action-btn" onclick="sharePost(${post.id})">🔗</button>
            ${isMyPost ? `<button class="action-btn" onclick="editPost(${post.id})">✏️</button>` : ''}
            ${isMyPost ? `<button class="action-btn delete-btn" onclick="deletePost(${post.id})">🗑</button>` : ''}
        </div>
        <div class="comments-section" id="comments-${post.id}" style="display:none;">
            <div class="comments-list" id="comments-list-${post.id}">${commentsHTML || '<div style="color:var(--text3);font-size:13px;">Пока нет комментариев</div>'}</div>
            <div class="comment-input-row">
                <input class="comment-input" id="comment-input-${post.id}" placeholder="Написать комментарий...">
                <button class="comment-submit" onclick="addComment(${post.id})">Отпр.</button>
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

function navigateToPost(postId) {
    const targetPost = posts.find(p => p.id === postId);
    if (!targetPost) return;
    let el = document.getElementById(`post-${postId}`);
    if (!el) {
        switchTab('new');
        el = document.getElementById(`post-${postId}`);
    }
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.borderColor = 'var(--accent)';
        setTimeout(() => {
            el.style.borderColor = targetPost.pinned ? 'var(--accent-dim)' : 'var(--border-soft)';
        }, 2000);
    }
}

function quotePost(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    activeQuoteId = postId;
    openNewPost();
    const previewArea = document.getElementById('quotedPreviewArea');
    const previewContent = document.getElementById('quotedPreviewContent');
    const quotedIdInput = document.getElementById('quotedPostIdInput');
    if (previewArea && previewContent && quotedIdInput) {
        previewArea.classList.add('show');
        previewContent.innerHTML = `<strong>@${escapeHtml(post.author)}</strong>: "${escapeHtml(post.text.substring(0, 100))}${post.text.length > 100 ? '...' : ''}"`;
        quotedIdInput.value = postId;
    }
}

function removeQuoteFromNewPost() {
    activeQuoteId = null;
    const previewArea = document.getElementById('quotedPreviewArea');
    const quotedIdInput = document.getElementById('quotedPostIdInput');
    if (previewArea) previewArea.classList.remove('show');
    if (quotedIdInput) quotedIdInput.value = '';
}

function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (section) {
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
        if (section.style.display === 'block') {
            document.getElementById(`comment-input-${postId}`)?.focus();
        }
    }
}

function addComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const author = localStorage.getItem('archive-mynick') || 'Аноним';
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (!post.comments) post.comments = [];
    post.comments.push({ author, text, timestamp: Date.now() });
    savePosts();
    input.value = '';
    const list = document.getElementById(`comments-list-${postId}`);
    if (list) {
        const c = post.comments[post.comments.length - 1];
        const empty = list.querySelector('div');
        if (empty && empty.textContent === 'Пока нет комментариев') list.innerHTML = '';
        list.innerHTML += `
            <div class="comment">
                <strong>${escapeHtml(c.author)}</strong> ${escapeHtml(c.text)}
                <span style="color:var(--text3);font-size:11px;margin-left:8px;">${timeAgo(c.timestamp)}</span>
            </div>`;
    }
    const countBtn = document.querySelector(`#post-${postId} .action-btn:nth-child(2)`);
    if (countBtn) countBtn.innerHTML = `💬 ${post.comments.length}`;
    updateNewBadge();
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
    const btn = document.querySelector(`#post-${postId} .action-btn:first-child`);
    if (btn) {
        btn.classList.toggle('liked', post.liked);
        btn.querySelector('span').textContent = post.likes;
    }
}

function sharePost(postId) {
    const url = `${window.location.origin}${window.location.pathname}#/post/${postId}`;
    if (navigator.share) {
        navigator.share({ title: 'Archive', url });
    } else {
        navigator.clipboard.writeText(url).then(() => showToast('🔗 Ссылка скопирована'));
    }
}

function handleHashRoute() {
    const hash = window.location.hash;
    if (hash.startsWith('#/post/')) {
        const id = parseInt(hash.replace('#/post/', ''));
        if (!isNaN(id)) {
            setTimeout(() => navigateToPost(id), 400);
        }
    }
}
window.addEventListener('hashchange', handleHashRoute);
window.addEventListener('load', handleHashRoute);

function deletePost(postId) {
    if (!confirm('Удалить эту запись?')) return;
    posts = posts.filter(p => p.id !== postId);
    savePosts();
    updateNewBadge();
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
    document.getElementById('quotedPostIdInput').value = post.quotedPostId || '';
    if (post.quotedPostId) {
        const quotedPost = posts.find(p => p.id === post.quotedPostId);
        if (quotedPost) {
            document.getElementById('quotedPreviewArea').classList.add('show');
            document.getElementById('quotedPreviewContent').innerHTML = `<strong>@${escapeHtml(quotedPost.author)}</strong>: "${escapeHtml(quotedPost.text.substring(0, 100))}${quotedPost.text.length > 100 ? '...' : ''}"`;
        }
    } else {
        removeQuoteFromNewPost();
    }
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
    removeQuoteFromNewPost();
    document.getElementById('newPostModal').classList.add('open');
}
function closeNewPost() { document.getElementById('newPostModal').classList.remove('open'); }

function publishPost() {
    const editId = document.getElementById('editPostId').value;
    const quotedId = document.getElementById('quotedPostIdInput').value;
    const author = document.getElementById('newPostAuthor').value.trim();
    const text = document.getElementById('newPostText').value.trim();
    const tagsRaw = document.getElementById('newPostTags').value.trim();
    const pinned = document.getElementById('newPostPinned').checked;

    if (!author) { showToast('Укажи ник'); return; }
    if (!text && pendingFiles.length === 0 && !quotedId) { showToast('Напиши текст, загрузи медиа или процитируй кого-то'); return; }

    const media = pendingFiles.map(f => f.data);
    const tags = tagsRaw ? tagsRaw.split(/\s+/).filter(t => t).map(t => t.replace(/^#/, '')) : [];

    if (editId) {
        const post = posts.find(p => p.id === parseInt(editId));
        if (post) { post.author = author; post.text = text || ''; post.tags = tags; post.pinned = pinned; if (media.length > 0) post.media = media; }
    } else {
        posts.unshift({ id: nextId++, author, text: text || '', media, tags, pinned, likes: 0, liked: false, views: 0, comments: [], timestamp: Date.now(), quotedPostId: quotedId ? parseInt(quotedId) : null });
    }

    savePosts();
    localStorage.setItem('archive-mynick', author);
    closeNewPost();
    pendingFiles = [];
    renderPreviews();
    removeQuoteFromNewPost();
    switchTab('new');
}

function openSearch() { document.getElementById('searchModal').classList.add('open'); document.getElementById('searchInput').focus(); }
function closeSearch() { document.getElementById('searchModal').classList.remove('open'); }

function doSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const results = document.getElementById('searchResults');
    if (!query) { results.innerHTML = 'Начни вводить запрос...'; return; }
    const found = posts.filter(p => p.text.toLowerCase().includes(query) || p.author.toLowerCase().includes(query) || p.tags.some(t => t.toLowerCase().includes(query)));
    if (!found.length) { results.innerHTML = '😕 Ничего не найдено'; return; }
    results.innerHTML = `<p style="color:var(--text2);margin-bottom:10px;font-family:var(--font-mono);font-size:12px;">Найдено: ${found.length}</p>` + found.map(p => `
        <div class="search-result" onclick="closeSearch(); navigateToPost(${p.id})">
            <div class="author">👤 ${escapeHtml(p.author)}</div>
            <div class="text">${escapeHtml(p.text.substring(0, 100))}${p.text.length > 100 ? '...' : ''}</div>
            <div class="tags">${p.tags.map(t => '#' + t).join(' ')}</div>
        </div>`).join('');
}

function searchTag(tag) { openSearch(); document.getElementById('searchInput').value = tag; doSearch(); }

function openProfile(author) {
    const modal = document.getElementById('profileModal');
    const userPosts = posts.filter(p => p.author === author);
    const totalLikes = userPosts.reduce((sum, p) => sum + p.likes, 0);
    const avatarLetter = getAvatar(author);
    const avatarColor = getAvatarColor(author);
    document.getElementById('profileHeader').innerHTML = `
        <div class="profile-avatar" style="background:${avatarColor};">${avatarLetter}</div>
        <div class="profile-info">
            <h2>👤 ${escapeHtml(author)}</h2>
            <p>📝 Постов: ${userPosts.length} | ❤️ Лайков: ${totalLikes}</p>
        </div>`;
    document.getElementById('profilePosts').innerHTML = userPosts.length === 0
        ? '<p style="color:var(--text2);text-align:center;padding:20px;">Пока пусто...</p>'
        : userPosts.map(p => `
            <div class="profile-post" onclick="closeProfile(); navigateToPost(${p.id})">
                <div style="color:var(--text3);font-size:11px;font-family:var(--font-mono);">${timeAgo(p.timestamp)}</div>
                <div class="text">${escapeHtml(p.text.substring(0, 120))}${p.text.length > 120 ? '...' : ''}</div>
            </div>`).join('');
    modal.classList.add('open');
}
function closeProfile() { document.getElementById('profileModal').classList.remove('open'); }

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const scrollTopBtn = document.createElement('button');
scrollTopBtn.className = 'scroll-top';
scrollTopBtn.innerHTML = '↑';
scrollTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
document.body.appendChild(scrollTopBtn);

window.addEventListener('scroll', () => {
    scrollTopBtn.classList.toggle('visible', window.scrollY > 500);
});

let toastTimer;
function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

function updateNewBadge() {
    const newTab = document.querySelector('.tab[data-tab="new"]');
    if (!newTab) return;
    const existing = newTab.querySelector('.new-badge');
    if (currentTab === 'new') {
        lastKnownPostCount = posts.length;
        if (existing) existing.remove();
        return;
    }
    const diff = posts.length - lastKnownPostCount;
    if (diff > 0) {
        if (existing) {
            existing.textContent = diff;
        } else {
            const badge = document.createElement('span');
            badge.className = 'new-badge';
            badge.textContent = diff;
            newTab.appendChild(badge);
        }
    }
}

initTheme();
renderFeed();
moveTabIndicator(document.querySelector('.tab.active'));