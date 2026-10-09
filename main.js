// main.js
// Page behavior for index.html: episode list rendering, playback, likes,
// background effects, and analytics. Depends on window.EPISODE_LIST
// (episode-list.js) and Plyr, both loaded before this script.

(function () {
  'use strict';

  /* ------------------------------ Release scheduling ------------------------------ */

  function parseReleaseAtToDate(s) {
    if (!s) return null;
    try {
      const d = new Date(s);
      if (!isNaN(d)) return d;
    } catch (e) {}
    // fallback: try yyyy/mm/dd or yyyy-mm-dd
    const parts = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (parts) return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 0, 0, 0);
    return null;
  }

  // Note: this is the browser's local time, not necessarily JST. Scheduling
  // relies on the client's clock (see EPISODE_README.md for the caveat).
  function getNow() {
    return new Date();
  }

  function computeReleased(ep, now) {
    const releaseDate = parseReleaseAtToDate(ep.release_at || ep.date || null);
    if (!releaseDate) return !!ep.released;
    return now.getTime() >= releaseDate.getTime();
  }

  function getLatestEpisode(list) {
    const releasedEpisodes = list.filter(ep => ep.released && ep.src);
    if (releasedEpisodes.length === 0) return null;

    releasedEpisodes.sort((a, b) => {
      const dateA = a.release_at ? new Date(a.release_at) : new Date(0);
      const dateB = b.release_at ? new Date(b.release_at) : new Date(0);
      if (dateA.getTime() !== dateB.getTime()) return dateB - dateA; // newest date first
      return (b.id || 0) - (a.id || 0); // fallback to id
    });

    return releasedEpisodes[0];
  }

  /* ------------------------------ Episode list rendering ------------------------------ */

  const rawEpisodes = window.EPISODE_LIST || [];
  const elList = document.getElementById('episodes-list');
  const now = getNow();
  const episodes = rawEpisodes.map(ep => Object.assign({}, ep, { released: computeReleased(ep, now) }));

  // REVERSE THE LIST
  episodes.slice().reverse().forEach(ep => {
    const div = document.createElement('div');
    div.className = 'episode' + (!ep.released ? ' disabled' : '');
    div.dataset.episode = `ep${ep.id}`;

    const meta = document.createElement('div');
    meta.className = 'meta';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = `#${ep.id} ${ep.title}`;

    const status = document.createElement('div');
    status.className = 'status';
    status.textContent = ep.desc;

    const date = document.createElement('div');
    date.className = 'date';
    date.textContent = ep.date || '';

    meta.appendChild(title);
    meta.appendChild(status);

    // place heart to the far right to avoid accidental play clicks
    const heartWrap = document.createElement('div');
    heartWrap.className = 'heart-wrap';
    const heart = document.createElement('button');
    heart.className = 'heart-btn' + (!ep.released ? ' disabled' : '');
    // store a concise key so now and list can reference same liked key
    const episodeKey = `ep${ep.id}`;
    heart.dataset.episode = episodeKey;
    heart.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12 21s-6.9-5.5-9.5-9.1C.9 9.6 1.2 6.3 3.6 4.4 5.7 2.8 8.6 3.1 10.3 5c.3.4.6.7.9 1 .3-.3.6-.6.9-1 1.7-1.9 4.6-2.2 6.7-.6 2.4 1.9 2.7 5.2 1.1 7.5C18.9 15.5 12 21 12 21z"/>
      </svg>
    `;

    heartWrap.appendChild(heart);

    div.appendChild(meta);
    div.appendChild(date);
    div.appendChild(heartWrap);

    // Only make clickable if released
    if (ep.released && ep.src) {
      div.addEventListener('click', () => loadEpisode(ep));
    }

    elList.appendChild(div);
  });

  const plyr = new Plyr('#audio-player', {
    controls: ['play', 'progress', 'current-time', 'mute', 'volume']
  });

  /* ------------------------------ ±15s seek buttons ------------------------------ */
  // custom circled "15" icons (shared visual language with the mini player),
  // used instead of Plyr's default rewind/fast-forward icons for consistency

  const REWIND_15_ICON = '<path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="16.5" font-size="8.5" font-weight="800" text-anchor="middle" fill="currentColor" stroke="none">15</text>';
  const FORWARD_15_ICON = '<path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="16.5" font-size="8.5" font-weight="800" text-anchor="middle" fill="currentColor" stroke="none">15</text>';

  function createSeekButton(iconInner, label, deltaSec) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'plyr__control';
    btn.setAttribute('aria-label', label);
    btn.innerHTML = `<svg viewBox="0 0 24 24">${iconInner}</svg>`;
    btn.addEventListener('click', () => {
      const audioEl = document.getElementById('audio-player');
      const max = audioEl.duration || Infinity;
      audioEl.currentTime = Math.min(max, Math.max(0, audioEl.currentTime + deltaSec));
    });
    return btn;
  }

  (function setupSeekButtons() {
    const controlsBar = document.querySelector('#player-wrap .plyr__controls');
    if (!controlsBar) return;
    const playBtn = controlsBar.querySelector('[data-plyr="play"]');
    const rewindBtn = createSeekButton(REWIND_15_ICON, '15秒戻る', -15);
    const forwardBtn = createSeekButton(FORWARD_15_ICON, '15秒進む', 15);
    if (playBtn) {
      playBtn.insertAdjacentElement('beforebegin', rewindBtn);
      playBtn.insertAdjacentElement('afterend', forwardBtn);
    } else {
      controlsBar.prepend(rewindBtn);
      controlsBar.appendChild(forwardBtn);
    }
  })();

  /* ------------------------------ Speed control ------------------------------ */

  const SPEEDS = [1, 1.5, 2];
  const speedUISyncs = [];

  function applySpeed(rate) {
    plyr.speed = rate;
    try { localStorage.setItem('playbackRate', String(rate)); } catch (e) {}
  }

  // turns an existing button into a speed-select control with a popover menu;
  // wraps it in a positioning container if its parent doesn't already provide one
  function attachSpeedMenu(btn) {
    let container = btn.parentElement;
    if (!container || !container.classList.contains('speed-control')) {
      container = document.createElement('div');
      container.className = 'speed-control';
      btn.parentNode.insertBefore(container, btn);
      container.appendChild(btn);
    }

    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'speed-menu';
    SPEEDS.forEach(rate => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.textContent = `${rate}x`;
      opt.dataset.speed = String(rate);
      if (rate === 1) opt.classList.add('active');
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        applySpeed(rate);
        closeMenu();
      });
      menu.appendChild(opt);
    });
    container.appendChild(menu);

    function openMenu() { menu.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    function closeMenu() { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.contains('open') ? closeMenu() : openMenu();
    });
    document.addEventListener('click', closeMenu);

    function syncUI(rate) {
      btn.textContent = `${rate}x`;
      menu.querySelectorAll('button').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.speed) === rate));
    }
    speedUISyncs.push(syncUI);
  }

  plyr.on('ratechange', () => speedUISyncs.forEach(sync => sync(plyr.speed)));

  (function setupSpeedControls() {
    const controlsBar = document.querySelector('#player-wrap .plyr__controls');
    if (controlsBar) {
      const mainBtn = document.createElement('button');
      mainBtn.type = 'button';
      mainBtn.className = 'speed-control-btn plyr__control';
      mainBtn.textContent = '1x';
      mainBtn.setAttribute('aria-label', '再生速度を変更');
      controlsBar.appendChild(mainBtn);
      attachSpeedMenu(mainBtn);
    }

    const miniBtn = document.getElementById('mini-player-speed');
    if (miniBtn) attachSpeedMenu(miniBtn);

    try {
      const savedRate = parseFloat(localStorage.getItem('playbackRate'));
      if (SPEEDS.includes(savedRate)) applySpeed(savedRate);
    } catch (e) {}
  })();

  /* ------------------------------ Likes ------------------------------ */

  // track currently playing row key so we can hide it from the list and tag analytics
  let currentPlayingKey = null;

  const sparklePool = [];

  function createSparkleNode() {
    const el = document.createElement('div');
    el.className = 'sparkle';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9999';
    document.body.appendChild(el);
    return el;
  }

  function getSparkleNode() {
    const POOL_MAX = 40;
    for (const n of sparklePool) if (!n.__inUse) { n.__inUse = true; return n; }
    if (sparklePool.length < POOL_MAX) {
      const n = createSparkleNode();
      n.__inUse = true;
      sparklePool.push(n);
      return n;
    }
    const n = sparklePool[Math.floor(Math.random() * sparklePool.length)];
    n.__inUse = true;
    return n;
  }

  function releaseSparkleNode(n) {
    // reset to neutral state so node can be reused safely
    n.className = 'sparkle';
    n.style.left = '';
    n.style.top = '';
    n.style.width = '';
    n.style.height = '';
    n.style.borderLeft = '';
    n.style.borderRight = '';
    n.style.borderBottom = '';
    n.style.background = '';
    n.innerHTML = '';
    n.style.animationDelay = '';
    n.style.animationDuration = '';
    n.style.transform = '';
    n.style.zIndex = '';
    n.classList.remove('sparkle-triangle');
    if (n.__releaseTimeout) { clearTimeout(n.__releaseTimeout); n.__releaseTimeout = null; }
    n.__inUse = false;
  }

  function emitSparkles(clickedBtn) {
    const rect = clickedBtn.getBoundingClientRect();
    const docOffsetX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const docOffsetY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const baseX = rect.left + rect.width / 2 + docOffsetX;
    const baseY = rect.top + rect.height / 2 + docOffsetY;

    const emitCount = 14;
    for (let i = 0; i < emitCount; i++) {
      const node = getSparkleNode();
      const isTriangle = Math.random() < 0.42;
      if (isTriangle) node.classList.add('sparkle-triangle'); else node.classList.add('sparkle-circle');

      // start near the heart center with a tiny jitter so particles overlap nicely
      const jitterX = (Math.random() - 0.5) * rect.width * 0.3;
      const jitterY = (Math.random() - 1.5) * rect.height * 0.3;
      node.style.left = (baseX + jitterX) + 'px';
      node.style.top = (baseY + jitterY) + 'px';

      const size = Math.random() * 12 + 3;
      if (isTriangle) {
        const variant = Math.random();
        const colors = [
          'rgba(107,227,255,0.96)',
          'rgba(159,223,255,0.92)',
          'rgba(255,180,255,0.92)'
        ];
        const fill = colors[Math.floor(Math.random() * colors.length)];

        const w = Math.round(size + 2);
        const h = Math.round(size + 2);
        node.style.width = `${w}px`;
        node.style.height = `${h}px`;
        node.style.background = 'transparent';

        const strokeW = Math.max(1, Math.round((size + 2) * 0.18));
        if (variant < 0.5) {
          node.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg"><polygon points="${w / 2},0 ${w},${h} 0,${h}" fill="none" stroke="${fill}" stroke-width="${strokeW}" stroke-linejoin="round" vector-effect="non-scaling-stroke" /></svg>`;
        } else {
          node.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 ${w},0 0,${h}" fill="none" stroke="${fill}" stroke-width="${strokeW}" stroke-linejoin="round" vector-effect="non-scaling-stroke" /></svg>`;
        }
      } else {
        // smaller, single-color round sparkles (soft warm white)
        const small = Math.max(2, size * 0.7);
        node.style.width = `${small}px`;
        node.style.height = `${small}px`;
        node.style.background = 'radial-gradient(circle, rgba(255,250,230,0.98) 0%, rgba(255,255,255,0.7) 48%, transparent 75%)';
      }

      // emit outward from the heart: pick an angle and distance, convert to x/y
      const angle = Math.random() * Math.PI * 2;
      const minDist = 28 + Math.random() * 8;
      const maxDist = 60 + Math.random() * 30;
      const dist = minDist + Math.random() * (maxDist - minDist);
      node.style.setProperty('--x', Math.cos(angle) * dist + 'px');
      node.style.setProperty('--y', Math.sin(angle) * dist + 'px');
      node.style.setProperty('--curve', (Math.random() * 56 - 28).toString());

      // slightly longer, more consistent durations so sparks linger
      const dur = 2.4 + Math.random() * 0.8; // 2.4 - 3.2s
      // Ensure animation restarts when node is reused: clear animation, force reflow, then set durations
      node.style.animation = 'none';
      void node.offsetWidth; // force reflow
      node.style.animationDuration = `${dur}s`;
      node.style.animationDelay = `${Math.random() * 0.35}s`;
      node.style.animation = ''; // allow CSS to pick up the base animation name again

      if (node.__releaseTimeout) clearTimeout(node.__releaseTimeout);
      node.__releaseTimeout = setTimeout(() => releaseSparkleNode(node), (dur + 0.6) * 1000 + Math.random() * 300);
    }
  }

  // helper: set visual state of all hearts for an episodeKey
  function syncHeartState(episodeKey, label) {
    const key = `liked_${episodeKey}`;
    const liked = localStorage.getItem(key) === 'true';
    document.querySelectorAll(`.heart-btn[data-episode="${episodeKey}"]`).forEach(b => {
      if (liked) b.classList.add('active'); else b.classList.remove('active');
      // expose pressed state for assistive tech
      try { b.setAttribute('aria-pressed', liked ? 'true' : 'false'); } catch (e) {}
      if (label && !b.getAttribute('aria-label')) b.setAttribute('aria-label', label + ' をいいね');
    });
  }

  // helper: toggle like state and sync UI + analytics + sparkles on the clicked button
  function toggleLike(episodeKey, label, clickedBtn) {
    const key = `liked_${episodeKey}`;
    const willLike = !(localStorage.getItem(key) === 'true');
    if (willLike) localStorage.setItem(key, 'true'); else localStorage.removeItem(key);
    // update all UI
    syncHeartState(episodeKey, label);

    // Send GA4-friendly event and push helpful debug info
    try {
      const gaEventName = willLike ? 'like' : 'like_removed';
      const gaParams = {
        content_id: episodeKey,
        content_title: label || episodeKey,
        content_type: 'episode',
        method: 'button'
      };

      if (window.gtag) {
        gtag('event', gaEventName, gaParams);
        console.debug('GA event sent:', gaEventName, gaParams);
      } else {
        console.debug('gtag() not available — would send:', gaEventName, gaParams);
      }

      // also push to dataLayer for debugging/inspection
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: gaEventName, liked: willLike }, gaParams));
    } catch (e) {
      console.warn('Error sending GA event', e);
    }

    if (willLike && clickedBtn) {
      emitSparkles(clickedBtn);
      try { clickedBtn.setAttribute('aria-pressed', willLike ? 'true' : 'false'); } catch (e) {}
    }
  }

  /* ------------------------------ Playback ------------------------------ */

  let currentEpisode = null;

  // next released, playable episode after the given one (by id order)
  function getNextEpisode(ep) {
    if (!ep) return null;
    const candidates = episodes
      .filter(e => e.released && e.src && e.id > ep.id)
      .sort((a, b) => a.id - b.id);
    return candidates[0] || null;
  }

  function loadEpisode(ep, opts) {
    opts = opts || {};
    if (!ep.src) {
      alert('このエピソードの音源URLがまだ設定されていません。');
      return;
    }

    currentEpisode = ep;

    const srcEl = document.getElementById('audio-source');
    const audioEl = document.getElementById('audio-player');

    srcEl.src = ep.src;
    audioEl.load();

    // resume saved position once the new source's metadata is ready
    // (setting currentTime before load() has no effect — load() resets it)
    const savedTime = localStorage.getItem(`progress_ep${ep.id}`);
    if (savedTime) {
      audioEl.addEventListener('loadedmetadata', function onReady() {
        audioEl.removeEventListener('loadedmetadata', onReady);
        audioEl.currentTime = parseFloat(savedTime);
      });
    }

    if (opts.autoplay) {
      audioEl.addEventListener('canplay', function onCanPlay() {
        audioEl.removeEventListener('canplay', onCanPlay);
        audioEl.play().catch(() => {});
      });
    }

    // set playing key before initiating play so analytics can read it
    const episodeKey = `ep${ep.id}`;
    currentPlayingKey = episodeKey;
    try { localStorage.setItem('lastPlayedKey', episodeKey); } catch (e) {}
    updateMiniPlayer(ep);
    // update heart buttons that track the currently loaded episode (now bar + mini player)
    const stored = localStorage.getItem(`liked_${episodeKey}`) === 'true';
    document.querySelectorAll('.current-heart-btn').forEach(heartBtn => {
      heartBtn.dataset.episode = episodeKey;
      heartBtn.dataset.title = `#${ep.id} ${ep.title}`;
      heartBtn.setAttribute('aria-label', `いいね #${ep.id} ${ep.title}`);
      try { heartBtn.setAttribute('aria-pressed', stored ? 'true' : 'false'); } catch (e) {}
    });
    document.getElementById('now-title').textContent = `#${ep.id} ${ep.title}`;
    document.getElementById('now-desc').textContent = ep.desc || '';
    const nowDateEl = document.getElementById('now-date');
    if (nowDateEl) nowDateEl.textContent = ep.date || '';

    // the "now" card always reflects whatever is loaded (resumed or just-picked),
    // so its label and the "new episode available" nudge must stay truthful to that
    const nowLabelEl = document.getElementById('now-label');
    const newEpisodeBtn = document.getElementById('now-new-episode');
    const isLatest = !latestReleased || ep.id === latestReleased.id;
    if (nowLabelEl) nowLabelEl.textContent = isLatest ? '最新のエピソード' : '再生中';
    if (newEpisodeBtn) {
      if (!isLatest && latestReleased) {
        const titleEl = document.getElementById('now-new-episode-title');
        if (titleEl) titleEl.textContent = `#${latestReleased.id} ${latestReleased.title}`;
        newEpisodeBtn.hidden = false;
      } else {
        newEpisodeBtn.hidden = true;
      }
    }
    try { if (window.gtag) gtag('event', 'load_episode', { event_category: 'audio', event_label: ep.title, content_id: `ep${ep.id}` }); } catch (e) {}
    syncHeartState(episodeKey, ep.title);

    // hide the matching episode row from the list to avoid duplicate entry
    try {
      // show all episode rows first (ensures any previously hidden row returns)
      document.querySelectorAll('.episode').forEach(n => n.style.display = '');
      const el = document.querySelector(`.episode[data-episode="${episodeKey}"]`);
      if (el) el.style.display = 'none';
    } catch (err) {
      console.warn('Could not hide/show episode row', err);
    }
  }

  /* ------------------------------ Mini player ------------------------------ */

  const miniPlayer = document.getElementById('mini-player');
  const miniPlayerTitle = document.getElementById('mini-player-title');
  const miniPlayerToggle = document.getElementById('mini-player-toggle');
  const miniPlayerRewind = document.getElementById('mini-player-rewind');
  const miniPlayerForward = document.getElementById('mini-player-forward');
  const miniPlayerPlayIcon = document.getElementById('mini-player-play-icon');
  const miniPlayerPauseIcon = document.getElementById('mini-player-pause-icon');
  const miniPlayerSeek = document.getElementById('mini-player-seek');
  const miniPlayerCurrentTime = document.getElementById('mini-player-current-time');
  const miniPlayerDuration = document.getElementById('mini-player-duration');
  const miniPlayerMute = document.getElementById('mini-player-mute');
  const miniPlayerVolumeIcon = document.getElementById('mini-player-volume-icon');
  const miniPlayerMutedIcon = document.getElementById('mini-player-muted-icon');
  const miniPlayerVolume = document.getElementById('mini-player-volume');

  function updateMiniPlayer(ep) {
    if (miniPlayerTitle) miniPlayerTitle.textContent = `#${ep.id} ${ep.title}`;
  }

  function setMiniPlayerPlaying(isPlaying) {
    if (miniPlayerPlayIcon) miniPlayerPlayIcon.style.display = isPlaying ? 'none' : '';
    if (miniPlayerPauseIcon) miniPlayerPauseIcon.style.display = isPlaying ? '' : 'none';
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  miniPlayerToggle?.addEventListener('click', () => {
    plyr.togglePlay();
  });

  miniPlayerRewind?.addEventListener('click', () => {
    const audioEl = document.getElementById('audio-player');
    audioEl.currentTime = Math.max(0, audioEl.currentTime - 15);
  });

  miniPlayerForward?.addEventListener('click', () => {
    const audioEl = document.getElementById('audio-player');
    const max = audioEl.duration || Infinity;
    audioEl.currentTime = Math.min(max, audioEl.currentTime + 15);
  });

  plyr.on('play', () => setMiniPlayerPlaying(true));
  plyr.on('pause', () => setMiniPlayerPlaying(false));
  plyr.on('ended', () => setMiniPlayerPlaying(false));

  // seek slider: track user dragging so timeupdate doesn't fight the drag
  let miniPlayerSeeking = false;
  miniPlayerSeek?.addEventListener('input', () => { miniPlayerSeeking = true; });
  miniPlayerSeek?.addEventListener('change', () => {
    const audioEl = document.getElementById('audio-player');
    if (audioEl.duration) audioEl.currentTime = (parseFloat(miniPlayerSeek.value) / 100) * audioEl.duration;
    miniPlayerSeeking = false;
  });

  plyr.on('timeupdate', () => {
    const audioEl = document.getElementById('audio-player');
    if (!audioEl.duration) return;
    if (!miniPlayerSeeking && miniPlayerSeek) miniPlayerSeek.value = String((audioEl.currentTime / audioEl.duration) * 100);
    if (miniPlayerCurrentTime) miniPlayerCurrentTime.textContent = formatTime(audioEl.currentTime);
  });

  plyr.on('durationchange', () => {
    const audioEl = document.getElementById('audio-player');
    if (miniPlayerDuration) miniPlayerDuration.textContent = formatTime(audioEl.duration);
  });

  // mute + volume: bind straight to the media element, native volumechange keeps everything in sync
  function syncMiniVolumeUI() {
    const audioEl = document.getElementById('audio-player');
    if (miniPlayerVolume) miniPlayerVolume.value = String(audioEl.muted ? 0 : audioEl.volume);
    if (miniPlayerVolumeIcon) miniPlayerVolumeIcon.style.display = audioEl.muted ? 'none' : '';
    if (miniPlayerMutedIcon) miniPlayerMutedIcon.style.display = audioEl.muted ? '' : 'none';
  }

  miniPlayerMute?.addEventListener('click', () => {
    const audioEl = document.getElementById('audio-player');
    audioEl.muted = !audioEl.muted;
  });

  miniPlayerVolume?.addEventListener('input', () => {
    const audioEl = document.getElementById('audio-player');
    audioEl.volume = parseFloat(miniPlayerVolume.value);
    audioEl.muted = false;
  });

  plyr.on('volumechange', syncMiniVolumeUI);
  syncMiniVolumeUI();

  // show the mini player once the main player card scrolls out of view
  const playerCard = document.querySelector('section.card[aria-label="プレイヤー"]');
  if (playerCard && miniPlayer && 'IntersectionObserver' in window) {
    const playerObserver = new IntersectionObserver(
      ([entry]) => { miniPlayer.classList.toggle('visible', !entry.isIntersecting); },
      { threshold: 0 }
    );
    playerObserver.observe(playerCard);
  }

  miniPlayerTitle?.addEventListener('click', () => {
    playerCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function getEpisodeByKey(key) {
    if (!key) return null;
    const match = key.match(/^ep(\d+)$/);
    if (!match) return null;
    const id = Number(match[1]);
    return episodes.find(e => e.id === id && e.released && e.src) || null;
  }

  const latestReleased = getLatestEpisode(episodes);
  let lastPlayedKey = null;
  try { lastPlayedKey = localStorage.getItem('lastPlayedKey'); } catch (e) {}
  const resumeEpisode = getEpisodeByKey(lastPlayedKey);
  const initialEpisode = resumeEpisode || latestReleased;
  if (initialEpisode) {
    loadEpisode(initialEpisode);
  }

  document.getElementById('now-new-episode')?.addEventListener('click', () => {
    if (latestReleased) loadEpisode(latestReleased, { autoplay: true });
  });

  /* ------------------------------ Snowfall ------------------------------ */

  const canvas = document.getElementById('snowfall');
  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let flakes = [];

  // depth simulates distance: farther flakes are smaller, slower, dimmer,
  // and plain dots; only the closest ~15% get the branched crystal shape.
  // A rare ~6% are "big" flakes on top of that — noticeably larger and
  // always crystal-shaped, for occasional visual interest.
  function spawnFlake(randomY) {
    const depth = Math.random();
    const big = Math.random() < 0.06;
    return {
      x: Math.random() * window.innerWidth,
      y: randomY ? Math.random() * window.innerHeight : -10,
      r: (0.4 + depth * 1.2) * (big ? 2.4 : 1),
      speed: (0.2 + depth * 0.7) * 0.45,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.006 + Math.random() * 0.01,
      swayAmp: 8 + depth * 14,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.01,
      alpha: (0.15 + depth * 0.3) * (big ? 1.4 : 1),
      crystal: big || depth > 0.85,
      // random-walk turbulence layered on top of the smooth sway, damped
      // so it wanders unpredictably instead of drifting off
      drift: 0
    };
  }

  function resizeSnow() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    flakes = Array.from({ length: 40 }, () => spawnFlake(true));
  }
  window.addEventListener('resize', resizeSnow);
  resizeSnow();

  function drawCrystal(x, y, f) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(f.angle);
    ctx.strokeStyle = `rgba(223,246,255,${f.alpha})`;
    ctx.lineWidth = 0.5;
    const armLen = f.r * 2.2;
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, armLen);
      ctx.moveTo(0, armLen * 0.55);
      ctx.lineTo(armLen * 0.28, armLen * 0.75);
      ctx.moveTo(0, armLen * 0.55);
      ctx.lineTo(-armLen * 0.28, armLen * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderFlake(f) {
    const x = f.x + Math.sin(f.sway) * f.swayAmp * 0.02 + f.drift;
    ctx.save();
    ctx.globalAlpha = f.alpha;
    ctx.shadowColor = '#6be3ff';
    ctx.shadowBlur = 2;
    if (f.crystal) {
      drawCrystal(x, f.y, f);
    } else {
      ctx.beginPath();
      ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.restore();
  }

  function renderSnowFrame() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    flakes.forEach(renderFlake);
  }

  function stepSnow() {
    const h = window.innerHeight;
    flakes.forEach(f => {
      f.sway += f.swaySpeed;
      f.y += f.speed;
      f.angle += f.spin;
      // turbulence: small random impulse each frame, damped so it wanders
      // instead of running away
      f.drift = (f.drift + (Math.random() - 0.5) * 0.12) * 0.995;
      if (f.y - f.r > h) Object.assign(f, spawnFlake(false));
    });
  }

  function drawSnow() {
    stepSnow();
    renderSnowFrame();
    requestAnimationFrame(drawSnow);
  }

  // reduced-motion users still get a static frame of flakes at their
  // spawn positions, just no continuous falling animation.
  renderSnowFrame();
  if (!prefersReducedMotion) drawSnow();

  /* ------------------------------ GA4 enhanced audio tracking ------------------------------ */

  document.addEventListener('DOMContentLoaded', function () {
    const player = document.getElementById('audio-player');
    setInterval(() => {
      if (!player.paused && currentPlayingKey) {
        localStorage.setItem(`progress_${currentPlayingKey}`, player.currentTime);
        localStorage.setItem('lastPlayedKey', currentPlayingKey);
      }
    }, 5000);

    const checkpoints = [25, 50, 75, 90];
    const sent = {};
    let lastTime = 0;
    let listenStart = null;

    function getEpisodeInfo() {
      // prefer explicit currentPlayingKey, then now heart dataset, then fallback to source filename
      const nowHeart = document.querySelector('.now .heart-btn');
      const srcEl = document.getElementById('audio-source');
      const title = document.getElementById('now-title')?.textContent || srcEl?.dataset?.title || srcEl?.src?.split('/').pop() || 'unknown';
      const id = currentPlayingKey || (nowHeart && nowHeart.dataset && nowHeart.dataset.episode) || null;
      return { id: id || 'unknown', title };
    }

    function pushGtag(eventName, params = {}) {
      // ensure we always attach helpful defaults
      const ep = getEpisodeInfo();
      const base = {
        event_category: 'audio',
        content_type: 'episode',
        content_id: ep.id,
        content_title: ep.title
      };
      const payload = Object.assign({}, base, params);
      if (window.gtag) {
        try { gtag('event', eventName, payload); } catch (e) { console.warn('gtag error', e); }
      }
      // always push to dataLayer for visibility even if gtag isn't ready
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: eventName }, payload));
      console.debug('GA event:', eventName, payload);
    }

    function sendListenTime() {
      if (!listenStart) return;
      const sec = Math.floor((Date.now() - listenStart) / 1000);
      listenStart = null;
      if (sec > 2) pushGtag('listen_time', { seconds_listened: sec });
    }

    // Wire player events with episode-aware params
    plyr.on('play', () => {
      listenStart = Date.now();
      pushGtag('play', { position_sec: Math.floor(player.currentTime) });
    });

    plyr.on('pause', () => {
      sendListenTime();
      pushGtag('pause', { position_sec: Math.floor(player.currentTime) });
    });

    plyr.on('seeked', () => {
      pushGtag('seek', { from_sec: Math.floor(lastTime), to_sec: Math.floor(player.currentTime) });
    });

    plyr.on('ratechange', () => {
      pushGtag('playback_speed_change', { speed: player.playbackRate });
    });

    plyr.on('ended', () => {
      sendListenTime();
      pushGtag('complete', { duration_sec: Math.floor(player.duration), position_sec: Math.floor(player.currentTime) });

      // episode finished: clear its saved position so it doesn't resume at the end next time
      if (currentPlayingKey) {
        try { localStorage.removeItem(`progress_${currentPlayingKey}`); } catch (e) {}
      }

      // continue listening: auto-advance to the next released episode
      const next = getNextEpisode(currentEpisode);
      if (next) {
        pushGtag('autoplay_next', { content_id: `ep${next.id}` });
        loadEpisode(next, { autoplay: true });
      }
    });

    plyr.on('timeupdate', () => {
      if (!player.duration) return;
      const percent = (player.currentTime / player.duration) * 100;
      checkpoints.forEach(cp => {
        if (percent >= cp && !sent[cp]) {
          pushGtag('progress', { milestone_pct: cp, position_sec: Math.floor(player.currentTime) });
          sent[cp] = true;
        }
      });
      lastTime = player.currentTime;
    });
  });

  /* ------------------------------ Random background gradient ------------------------------ */

  document.addEventListener('DOMContentLoaded', () => {
    const layer = document.querySelector('.bg-layer');
    if (!layer) return;
    const colors = [
      'rgba(255,90,255,0.08)',
      'rgba(0,255,190,0.06)',
      'rgba(180,100,255,0.07)',
      'rgba(120,255,180,0.05)',
      'rgba(255,180,255,0.04)'
    ];
    const shuffled = colors.sort(() => 0.5 - Math.random());
    const randomGradient = (color) => {
      const x = Math.floor(Math.random() * 100);
      const y = Math.floor(Math.random() * 100);
      const size = Math.floor(Math.random() * 40 + 60);
      return `radial-gradient(ellipse at ${x}% ${y}%, ${color}, transparent ${size}%)`;
    };
    const randomGradients = shuffled.map(c => randomGradient(c)).join(',');
    const darkSpace = 'linear-gradient(180deg, #03040a 0%, #050612 60%, #0a101a 100%)';
    layer.style.background = randomGradients + ',' + darkSpace;
    layer.style.backgroundBlendMode = 'screen, overlay, normal';
    layer.style.backgroundSize = '200% 200%';
    layer.style.animation = 'drift 25s ease-in-out infinite alternate';
  });

  /* ------------------------------ Message draft autosave ------------------------------ */

  const msgBox = document.getElementById('message');
  msgBox?.addEventListener('input', () => {
    localStorage.setItem('draftMessage', msgBox.value);
  });
  window.addEventListener('load', () => {
    const saved = localStorage.getItem('draftMessage');
    if (saved) msgBox.value = saved;
  });
  document.getElementById('contact-form')?.addEventListener('submit', () => {
    localStorage.removeItem('draftMessage');
  });

  /* ------------------------------ Heart button wiring ------------------------------ */

  document.addEventListener('DOMContentLoaded', () => {
    // initialize hearts: wire up clicks and hydrate from localStorage using global helpers
    document.querySelectorAll('.heart-btn').forEach(btn => {
      const episodeKey = btn.dataset.episode || 'current';
      const saved = localStorage.getItem(`liked_${episodeKey}`);
      if (saved === 'true') btn.classList.add('active');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.episode || 'current';
        const label = btn.dataset.title || btn.getAttribute('aria-label') || key;
        toggleLike(key, label, btn);
      });
    });
  });

  /* ------------------------------ FAQ toggle ------------------------------ */

  function toggleFaq(item) {
    const isActive = item.classList.toggle('active');
    const question = item.querySelector('.faq-question');
    if (question) question.setAttribute('aria-expanded', isActive ? 'true' : 'false');
  }

  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => toggleFaq(q.parentElement));
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        toggleFaq(q.parentElement);
      }
    });
  });

  /* ------------------------------ Coldsleep day counter ------------------------------ */
  // Perfume's coldsleep began 2026-01-01 00:00 JST (see episode #2, "コールドスリープ開始")

  const COLDSLEEP_START = new Date('2026-01-01T00:00:00+09:00');

  function coldsleepDay(now) {
    const diffMs = now.getTime() - COLDSLEEP_START.getTime();
    return Math.floor(diffMs / 86400000) + 1;
  }

  const coldsleepDaysEl = document.getElementById('coldsleep-days');
  if (coldsleepDaysEl) {
    const day = coldsleepDay(getNow());
    coldsleepDaysEl.textContent = day > 0 ? day : '-';
  }

  /* ------------------------------ 1st anniversary badge ------------------------------ */
  // Shown through 2026-10-31 (JST), hidden from 2026-11-01 00:00 JST.

  const ANNIVERSARY_BADGE_UNTIL = new Date('2026-11-01T00:00:00+09:00');
  const anniversaryBadge = document.getElementById('anniversary-badge');
  if (anniversaryBadge && getNow() < ANNIVERSARY_BADGE_UNTIL) {
    anniversaryBadge.hidden = false;
  }
})();
