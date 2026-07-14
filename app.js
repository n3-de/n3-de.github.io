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

    const quotesCount = posts.filter(p => p.quotedPostId === post.id).length;

    const heartIcon = post.liked 
        ? `<svg viewBox="0 0 24 24" class="action-icon"><g><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></g></svg>`
        : `<svg viewBox="0 0 24 24" class="action-icon"><g><path d="M16.697 5.5c-1.222-.06-2.679.69-3.894 2.04L12 8.4l-.803-.86C9.982 6.19 8.525 5.44 7.303 5.5 5.14 5.6 3 7.53 3 11c0 3.82 4.29 8.27 8.53 11.53.27.21.67.21.94 0C16.71 19.27 21 14.82 21 11c0-3.47-2.14-5.4-4.303-5.5zM12 20.17C8.19 17.17 5 13.25 5 11c0-2.13 1.15-3.5 2.53-3.56.65-.03 1.57.41 2.53 1.49l1.94 2.1 1.94-2.1c.96-1.08 1.88-1.52 2.53-1.49C17.85 7.5 19 8.87 19 11c0 2.25-3.19 6.17-7 9.17z"></path></g></svg>`;

    const actionsHTML = `
        <div class="post-actions">
            <button class="action-btn btn-comment" onclick="toggleComments(${post.id})" title="Комментарии">
                <svg viewBox="0 0 24 24" class="action-icon"><g><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.49c4.419 0 8.005 3.58 8.005 8 0 4.42-3.586 8-8.005 8h-2.296l-3.903 3.756c-.43.413-1.125.386-1.52-.062-.157-.179-.245-.412-.245-.654v-3.04c-4.421 0-8.005-3.58-8.005-8zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.31 2.688 6 6.005 6h.997c.552 0 1 .45 1 1v1.817l2.818-2.71c.187-.18.437-.28.697-.28h2.983c3.317 0 6.005-2.69 6.005-6s-2.688-6-6.005-6h-4.49z"></path></g></svg>
                <span>${(post.comments || []).length}</span>
            </button>
            <button class="action-btn btn-quote" onclick="quotePost(${post.id})" title="Цитата">
                <svg viewBox="0 0 24 24" class="action-icon"><g><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></g></svg>
                <span>${quotesCount}</span>
            </button>
            <button class="action-btn btn-like ${post.liked ? 'liked' : ''}" onclick="toggleLike(${post.id})" title="Нравится">
                <span class="reaction-glyph">${heartIcon}</span>
                <span>${post.likes}</span>
            </button>
            <span class="action-btn btn-views" title="Просмотры">
                <svg viewBox="0 0 24 24" class="action-icon"><g><path d="M8.75 21V3h2v18h-2zM3.5 21V11h2v10h-2zM19.25 21V7h2v14h-2zM14 21V10h2v11h-2z"></path></g></svg>
                <span>${post.views || 0}</span>
            </span>
            <button class="action-btn btn-share" onclick="sharePost(${post.id})" title="Поделиться">
                <svg viewBox="0 0 24 24" class="action-icon"><g><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 5.92c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"></path></g></svg>
            </button>
            ${isMyPost ? `
            <button class="action-btn btn-edit" onclick="editPost(${post.id})" title="Редактировать">
                <svg viewBox="0 0 24 24" class="action-icon"><g><path d="M14.06 9l.94.94L5.92 19H5v-.92L14.06 9zm3.6-3.6c-.2-.2-.51-.2-.71 0l-1.68 1.68 3.09 3.09 1.68-1.68c.2-.2.2-.51 0-.71L17.66 5.4zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"></path></g></svg>
            </button>
            <button class="action-btn btn-delete" onclick="deletePost(${post.id})" title="Удалить">
                <svg viewBox="0 0 24 24" class="action-icon"><g><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"></path></g></svg>
            </button>
            ` : ''}
        </div>
    `;

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
        ${actionsHTML}
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
    const countBtn = document.querySelector(`#post-${postId} .btn-comment`);
    if (countBtn) countBtn.querySelector('span').textContent = post.comments.length;
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
    const btn = document.querySelector(`#post-${postId} .btn-like`);
    if (btn) {
        btn.classList.toggle('liked', post.liked);
        btn.querySelector('span').textContent = post.likes;
        const glyph = btn.querySelector('.reaction-glyph');
        if (glyph) {
            glyph.innerHTML = post.liked 
                ? `<svg viewBox="0 0 24 24" class="action-icon"><g><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></g></svg>`
                : `<svg viewBox="0 0 24 24" class="action-icon"><g><path d="M16.697 5.5c-1.222-.06-2.679.69-3.894 2.04L12 8.4l-.803-.86C9.982 6.19 8.525 5.44 7.303 5.5 5.14 5.6 3 7.5 3 11c0 3.82 4.29 8.27 8.53 11.53.27.21.67.21.94 0C16.71 19.27 21 14.82 21 11c0-3.47-2.14-5.4-4.303-5.5zM12 20.17C8.19 17.17 5 13.25 5 11c0-2.13 1.15-3.5 2.53-3.56.65-.03 1.57.41 2.53 1.49l1.94 2.1 1.94-2.1c.96-1.08 1.88-1.52 2.53-1.49C17.85 7.5 19 8.87 19 11c0 2.25-3.19 6.17-7 9.17z"></path></g></svg>`;
        }
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

function toggleLangMenu() {
    const menu = document.getElementById('langMenu');
    menu.classList.toggle('open');
}

document.addEventListener('click', function(e) {
    const selector = document.getElementById('langSelector');
    if (!selector.contains(e.target)) {
        document.getElementById('langMenu').classList.remove('open');
    }
});

function setLanguage(lang, flag) {
    document.getElementById('currentFlag').textContent = flag;
    document.getElementById('langMenu').classList.remove('open');
    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.remove('active');
        if (opt.querySelector('span').textContent === flag) {
            opt.classList.add('active');
        }
    });
    showToast(lang === 'ru' ? 'Язык изменён на Русский' : 'Language changed to English');
}

initTheme();
renderFeed();
moveTabIndicator(document.querySelector('.tab.active'));