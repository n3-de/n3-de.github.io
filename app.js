let posts = JSON.parse(localStorage.getItem('kogama-posts') || '[]');
let currentTab = 'new';
let nextId = posts.length > 0 ? Math.max(...posts.map(p => p.id)) + 1 : 1;
const POSTS_PER_PAGE = 5;
let visibleCount = POSTS_PER_PAGE;
let pendingFiles = [];

function savePosts() {
    localStorage.setItem('kogama-posts', JSON.stringify(posts));
}

// Тема
const themeToggle = document.getElementById('themeToggle');
function initTheme() {
    if (localStorage.getItem('kogama-theme') === 'light') {
        document.body.classList.add('light');
        themeToggle.textContent = '☀️';
    }
}
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    themeToggle.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('kogama-theme', isLight ? 'light' : 'dark');
});

// Табы
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        visibleCount = POSTS_PER_PAGE;
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

// Посты
function getFilteredPosts() {
    let filtered = [...posts];
    if (currentTab === 'popular') filtered.sort((a, b) => b.likes - a.likes);
    else if (currentTab === 'new') filtered.sort((a, b) => b.timestamp - a.timestamp);
    else if (currentTab === 'my') {
        const myNick = localStorage.getItem('kogama-mynick') || '';
        filtered = filtered.filter(p => p.author === myNick);
    }
    return filtered;
}

function renderFeed() {
    const feed = document.getElementById('feed');
    const filtered = getFilteredPosts();

    if (filtered.length === 0) {
        feed.innerHTML = `
            <div class="empty-state">
                <div class="emoji">🎮</div>
                <p>Пока нет ни одного поста</p>
                <p class="hint">Нажми ✚ чтобы добавить первый пост!</p>
            </div>`;
        document.getElementById('loadMore').style.display = 'none';
        return;
    }

    const toShow = filtered.slice(0, visibleCount);
    feed.innerHTML = '';
    toShow.forEach(post => feed.appendChild(createPostElement(post)));
    document.getElementById('loadMore').style.display = visibleCount < filtered.length ? 'block' : 'none';
    document.querySelectorAll('.gallery-slides').forEach(initGallery);
}

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'post';
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

    div.innerHTML = `
        <div class="post-header">
            <div class="post-avatar">🦊</div>
            <div>
                <a class="post-author" href="javascript:void(0)" onclick="openProfile('${escapeHtml(post.author).replace(/'/g, "\\'")}')">${escapeHtml(post.author)}</a>
                <div class="post-time">${post.time}</div>
            </div>
        </div>
        ${mediaHTML}
        <div class="post-text">${escapeHtml(post.text)}</div>
        <div class="post-tags">${tagsHTML}</div>
        <div class="post-actions">
            <button class="action-btn ${post.liked ? 'liked' : ''}" onclick="toggleLike(${post.id})">❤️ <span>${post.likes}</span></button>
            <span class="action-btn">💬 0</span>
            <span class="action-btn" onclick="sharePost(${post.id})">🔗</span>
        </div>
    `;
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

function sharePost(postId) {
    const url = `${window.location.origin}${window.location.pathname}#/post/${postId}`;
    if (navigator.share) {
        navigator.share({ title: 'Kogama Archive', url });
    } else {
        navigator.clipboard.writeText(url).then(() => alert('🔗 Ссылка скопирована!'));
    }
}

function openNewPost() { 
    document.getElementById('newPostModal').classList.add('open'); 
    pendingFiles = [];
    renderPreviews();
}
function closeNewPost() { document.getElementById('newPostModal').classList.remove('open'); }

function publishPost() {
    const author = document.getElementById('newPostAuthor').value.trim();
    const text = document.getElementById('newPostText').value.trim();
    const tagsRaw = document.getElementById('newPostTags').value.trim();

    if (!author) { alert('Укажи ник!'); return; }
    if (!text && pendingFiles.length === 0) { alert('Напиши текст или добавь скриншот!'); return; }

    const media = pendingFiles.map(f => f.data);
    const tags = tagsRaw ? tagsRaw.split(/\s+/).filter(t => t).map(t => t.replace(/^#/, '')) : [];

    const post = {
        id: nextId++,
        author,
        text: text || '',
        media,
        tags,
        likes: 0,
        liked: false,
        time: 'Только что',
        timestamp: Date.now()
    };

    posts.unshift(post);
    savePosts();
    localStorage.setItem('kogama-mynick', author);
    closeNewPost();
    document.getElementById('newPostAuthor').value = '';
    document.getElementById('newPostText').value = '';
    document.getElementById('newPostTags').value = '';
    pendingFiles = [];
    renderPreviews();
    currentTab = 'new';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab[data-tab="new"]').classList.add('active');
    visibleCount = POSTS_PER_PAGE;
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
                <div style="color:var(--text2);font-size:12px;">${p.time}</div>
                <div class="text">${escapeHtml(p.text.substring(0, 120))}</div>
                <div class="meta">❤️ ${p.likes} • ${p.tags.map(t => '#' + t).join(' ')}</div>
            </div>
        `).join('');

    modal.classList.add('open');
}

function closeProfile() { document.getElementById('profileModal').classList.remove('open'); }

document.getElementById('loadMore').addEventListener('click', () => {
    visibleCount += POSTS_PER_PAGE;
    renderFeed();
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

initTheme();
renderFeed();
