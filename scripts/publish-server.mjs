#!/usr/bin/env node
// publish-server.mjs
//
// A tiny local drag-and-drop UI for publishing a new episode, as an
// alternative to the --flags of publish-episode.mjs. Runs only on your
// machine (http://localhost) — credentials never leave it.
//
// Usage:
//   node scripts/publish-server.mjs
//   (opens http://localhost:8933 in your browser automatically)
//
// Same one-time setup as publish-episode.mjs — see EPISODE_README.md.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  appendEpisodeLine, buildEpisodeLine, buildIaUploadArgs, buildMetadata,
  commitAndPushEpisodeList, downloadUrlFor, identifierFor, runIaUpload, slugify, suggestNext,
} from './lib/episode-publish.mjs';

const PORT = Number(process.env.PORT) || 8933;

const PAGE = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>Cold Room Radio — episode publisher</title>
<style>
  :root{ --bg:#0a1620; --accent:#6be3ff; --muted:#b3c7d6; --glass:rgba(255,255,255,0.06); }
  *{box-sizing:border-box}
  body{
    margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:radial-gradient(ellipse at 30% 0%, #133a4d, transparent 60%), var(--bg);
    color:#e7f6fb; font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    padding:24px;
  }
  main{ width:100%; max-width:480px; }
  h1{ font-size:20px; font-weight:600; margin:0 0 4px; color:var(--accent); }
  p.sub{ color:var(--muted); margin:0 0 24px; font-size:13px; }
  .card{
    background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02));
    border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:24px;
  }
  .dropzone{
    border:2px dashed rgba(107,227,255,0.35); border-radius:12px; padding:28px 16px;
    text-align:center; cursor:pointer; transition:background .15s, border-color .15s;
    color:var(--muted); font-size:14px;
  }
  .dropzone.drag{ background:rgba(107,227,255,0.08); border-color:var(--accent); }
  .dropzone.has-file{ border-style:solid; border-color:var(--accent); color:#e7f6fb; }
  input[type=file]{ display:none; }
  label{ display:block; font-size:12px; color:var(--muted); margin:16px 0 4px; }
  input[type=text], input[type=datetime-local], input[type=number]{
    width:100%; padding:10px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.15);
    background:rgba(255,255,255,0.04); color:#e7f6fb; font-size:14px; font-family:inherit;
  }
  input:focus{ outline:none; border-color:var(--accent); }
  .row{ display:flex; gap:12px; }
  .row > div{ flex:1; }
  .checkbox-row{
    display:flex; align-items:center; gap:8px; margin-top:20px;
    font-size:12px; color:var(--muted); cursor:pointer;
  }
  .checkbox-row input{ width:auto; margin:0; accent-color:var(--accent); }
  button{
    width:100%; margin-top:20px; padding:12px; border:none; border-radius:10px;
    background:linear-gradient(90deg,var(--accent),#7af5ff); color:#04222c; font-weight:600;
    font-size:14px; cursor:pointer;
  }
  button:disabled{ opacity:.5; cursor:not-allowed; }
  #status{ margin-top:16px; font-size:13px; color:var(--muted); white-space:pre-wrap; line-height:1.5; }
  #status.error{ color:#ff9d9d; }
  #status.ok{ color:var(--accent); }
  a{ color:var(--accent); }
  details{ margin-top:16px; }
  summary{ font-size:12px; color:var(--muted); cursor:pointer; }
</style>
</head>
<body>
<main>
  <h1>Cold Room Radio</h1>
  <p class="sub">エピソードを追加 — drop the mp3, fill in the rest, publish.</p>
  <div class="card">
    <div class="dropzone" id="dropzone">mp3ファイルをドラッグ＆ドロップ<br>（またはクリックして選択）</div>
    <input type="file" id="file" accept="audio/mpeg,.mp3">

    <label for="title">タイトル (episode title)</label>
    <input type="text" id="title" placeholder="new episode">

    <label for="desc">説明 (short description)</label>
    <input type="text" id="desc" placeholder="今週のエピソードについて">

    <label for="release">公開日時 (release, JST)</label>
    <input type="datetime-local" id="release">

    <details>
      <summary>詳細設定 (advanced: id / slug)</summary>
      <div class="row">
        <div>
          <label for="id">Episode ID</label>
          <input type="number" id="id">
        </div>
        <div>
          <label for="slug">Slug</label>
          <input type="text" id="slug" placeholder="自動生成 (auto from title)">
        </div>
      </div>
    </details>

    <label class="checkbox-row">
      <input type="checkbox" id="skipUpload">
      すでにInternet Archiveにアップロード済み (アップロードをスキップ)
    </label>

    <label class="checkbox-row">
      <input type="checkbox" id="autopush" checked>
      公開後に episode-list.js を自動で git commit &amp; push する
    </label>

    <button id="publish">公開する (Publish)</button>
    <div id="status"></div>
  </div>
</main>
<script>
  let file = null;
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file');
  const statusEl = document.getElementById('status');
  const publishBtn = document.getElementById('publish');

  function setFile(f) {
    if (!f) return;
    file = f;
    dropzone.textContent = '✓ ' + f.name + ' (' + (f.size / 1024 / 1024).toFixed(1) + ' MB)';
    dropzone.classList.add('has-file');

    // Filenames already follow coldroomradio_ep{NN}_{slug}.mp3 — pull id
    // and slug straight from it. Title is filled with the raw slug as-is
    // (no guessing at word boundaries); split it into words by hand below.
    const m = f.name.match(/^coldroomradio_ep(\\d+)_(.+)\\.mp3$/i);
    if (m) {
      const idField = document.getElementById('id');
      const slugField = document.getElementById('slug');
      const titleField = document.getElementById('title');
      idField.value = String(Number(m[1]));
      slugField.value = m[2];
      if (!titleField.value) titleField.value = m[2];
    }
  }

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => setFile(e.target.files[0]));
  ['dragover', 'dragenter'].forEach(ev => dropzone.addEventListener(ev, (e) => {
    e.preventDefault(); dropzone.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, (e) => {
    e.preventDefault(); dropzone.classList.remove('drag');
  }));
  dropzone.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));

  // Prefill suggested id / release from the server.
  fetch('/api/next').then(r => r.json()).then(info => {
    document.getElementById('id').value = info.nextId;
    document.getElementById('id').placeholder = info.nextId;
    if (info.nextRelease) {
      // datetime-local wants "YYYY-MM-DDTHH:MM" in local wall-clock terms;
      // we already have the JST wall-clock string from the server.
      document.getElementById('release').value = info.nextRelease.slice(0, 16);
    }
  }).catch(() => {});

  publishBtn.addEventListener('click', async () => {
    const title = document.getElementById('title').value.trim();
    const desc = document.getElementById('desc').value.trim();
    const releaseLocal = document.getElementById('release').value;
    const id = document.getElementById('id').value.trim();
    const slug = document.getElementById('slug').value.trim();

    const skipUpload = document.getElementById('skipUpload').checked;

    statusEl.className = '';
    if (!file && !skipUpload) { statusEl.textContent = 'mp3ファイルを選んでください'; statusEl.className = 'error'; return; }
    if (!title || !desc || !releaseLocal) {
      statusEl.textContent = 'タイトル・説明・公開日時を入力してください';
      statusEl.className = 'error';
      return;
    }
    if (!file && skipUpload && !(id && slug)) {
      statusEl.textContent = 'アップロードをスキップする場合は Episode ID と Slug を入力してください（詳細設定）';
      statusEl.className = 'error';
      return;
    }

    const release = releaseLocal + ':00+09:00';
    const autopush = document.getElementById('autopush').checked;
    const params = new URLSearchParams({ title, desc, release });
    if (id) params.set('id', id);
    if (slug) params.set('slug', slug);
    if (autopush) params.set('autopush', '1');
    if (skipUpload) params.set('skipUpload', '1');
    if (file) params.set('filename', file.name);

    publishBtn.disabled = true;
    statusEl.className = '';
    statusEl.textContent = skipUpload
      ? '処理中...'
      : 'アップロード中... (this can take a few minutes for a large file)';

    try {
      const res = await fetch('/api/publish?' + params.toString(), { method: 'POST', body: file || undefined });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
      statusEl.className = 'ok';
      let msg = '✓ 公開しました\\n' + data.url;
      if (data.git && data.git.pushed) {
        msg += '\\n\\n✓ git commit & push 完了 (' + data.git.commit + ')';
      } else if (data.git && data.git.error) {
        msg += '\\n\\n⚠ episode-list.js には追記済みですが git push に失敗しました:\\n' + data.git.error + '\\n手動で commit / push してください。';
      } else {
        msg += '\\n\\nepisode-list.js に追記しました。git diff を確認してコミットしてください。';
      }
      statusEl.textContent = msg;
    } catch (err) {
      statusEl.className = 'error';
      statusEl.textContent = '✗ ' + err.message;
    } finally {
      publishBtn.disabled = false;
    }
  });
</script>
</body>
</html>`;

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/next') {
    try {
      const { nextId, nextRelease } = suggestNext();
      sendJson(res, 200, { nextId, nextRelease });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/publish') {
    const p = url.searchParams;
    const title = p.get('title');
    const desc = p.get('desc');
    const release = p.get('release');
    const originalFilename = p.get('filename') || 'episode.mp3';

    if (!title || !desc || !release) {
      sendJson(res, 400, { ok: false, error: 'missing title/desc/release' });
      return;
    }

    let tmpPath;
    try {
      const { nextId } = suggestNext();
      const id = p.get('id') ? Number(p.get('id')) : nextId;
      const slug = p.get('slug') || slugify(title);
      if (!/^[a-z0-9]+$/.test(slug)) {
        sendJson(res, 400, { ok: false, error: `slug must be lowercase letters/digits (got "${slug}")` });
        return;
      }

      const identifier = identifierFor(id, slug);
      const downloadUrl = downloadUrlFor(identifier);
      const remoteFilename = `${identifier}.mp3`;
      const ext = path.extname(originalFilename) || '.mp3';
      tmpPath = path.join(os.tmpdir(), `crr-upload-${randomUUID()}${ext}`);

      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(tmpPath);
        req.pipe(ws);
        req.on('error', reject);
        ws.on('error', reject);
        ws.on('finish', resolve);
      });

      const meta = buildMetadata({ id, title });
      const iaArgs = buildIaUploadArgs({ identifier, filePath: tmpPath, remoteFilename, meta });
      const isDryRun = p.get('dryRun') === '1';
      const isSkipUpload = p.get('skipUpload') === '1';

      if (!isDryRun && !isSkipUpload) await runIaUpload(iaArgs);

      const line = buildEpisodeLine({ id, title, desc, release, downloadUrl });
      appendEpisodeLine(line);

      let git;
      if (p.get('autopush') === '1' && !isDryRun) {
        try {
          const { message, commit } = await commitAndPushEpisodeList({ id });
          git = { pushed: true, commit, message };
        } catch (e) {
          git = { pushed: false, error: e.message };
        }
      }

      sendJson(res, 200, { ok: true, url: downloadUrl, line, git });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    } finally {
      if (tmpPath) fs.unlink(tmpPath, () => {});
    }
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Cold Room Radio episode publisher running at ${url}`);
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  execFile(opener, [url], () => {});
});
