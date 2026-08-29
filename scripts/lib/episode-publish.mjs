// episode-publish.mjs
// Shared logic used by both the CLI (publish-episode.mjs) and the
// drag-and-drop mini UI (publish-server.mjs): archive.org metadata
// conventions, the `ia upload` invocation, and appending a new entry
// to episode-list.js.

import { execFile, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const EPISODE_LIST_PATH = path.join(REPO_ROOT, 'episode-list.js');

// `pip install --user` (what EPISODE_README.md tells you to run) puts the
// `ia` binary in a per-user site-packages bin dir that usually isn't on
// PATH by default (and background/IDE-launched Node processes may not
// have sourced your shell profile at all even if you added it there).
// Look it up from Python directly and fall back to it if a bare `ia`
// spawn wouldn't otherwise resolve.
let cachedIaEnv = null;
export function getIaEnv() {
  if (cachedIaEnv) return cachedIaEnv;
  const extraDirs = [];
  try {
    const userBase = execSync('python3 -m site --user-base', { encoding: 'utf8' }).trim();
    if (userBase) extraDirs.push(path.join(userBase, 'bin'));
  } catch { /* python3 not found or sandboxed; PATH-only fallback below */ }
  extraDirs.push(path.join(os.homedir(), '.local', 'bin'));
  const sep = process.platform === 'win32' ? ';' : ':';
  cachedIaEnv = { ...process.env, PATH: [...extraDirs, process.env.PATH].join(sep) };
  return cachedIaEnv;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function jsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}

export function formatDateJP(isoWithOffset) {
  const m = String(isoWithOffset).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error(`release must start with YYYY-MM-DD, got: ${isoWithOffset}`);
  return `${m[1]}/${m[2]}/${m[3]}`;
}

// Reads episode-list.js and returns { maxId, lastLineIndex, lines, latestReleaseAt }.
export function readEpisodeList(episodeListPath = EPISODE_LIST_PATH) {
  if (!fs.existsSync(episodeListPath)) {
    throw new Error(`episode-list.js not found at ${episodeListPath}`);
  }
  const src = fs.readFileSync(episodeListPath, 'utf8');
  const lines = src.split('\n');

  let lastLineIndex = -1;
  let maxId = -1;
  let latestReleaseAt = null;
  lines.forEach((line, i) => {
    const idMatch = line.match(/\{\s*id\s*:\s*(\d+)/);
    if (!idMatch) return;
    const n = Number(idMatch[1]);
    if (n > maxId) {
      maxId = n;
      lastLineIndex = i;
      const relMatch = line.match(/release_at:\s*"([^"]+)"/);
      latestReleaseAt = relMatch ? relMatch[1] : null;
    }
  });

  return { lines, lastLineIndex, maxId, latestReleaseAt };
}

// Suggests the next episode id and a release datetime one week after the
// latest known release, keeping the same time-of-day (matches the show's
// weekly cadence).
export function suggestNext(episodeListPath = EPISODE_LIST_PATH) {
  const { maxId, latestReleaseAt } = readEpisodeList(episodeListPath);
  const nextId = maxId + 1;
  let nextRelease = null;
  if (latestReleaseAt) {
    // Do calendar arithmetic on the wall-clock time as written (e.g. the
    // "18:59" and "+09:00" in "2026-08-23T18:59:00+09:00"), rather than
    // converting through Date (which normalizes to UTC and would shift
    // the displayed hour).
    const m = latestReleaseAt.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2}|Z)$/
    );
    if (m) {
      const [, y, mo, d, h, mi, s, offset] = m;
      const wall = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
      wall.setUTCDate(wall.getUTCDate() + 7);
      const pad = (n) => String(n).padStart(2, '0');
      nextRelease =
        `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T` +
        `${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:${pad(wall.getUTCSeconds())}${offset}`;
    }
  }
  return { nextId, nextRelease };
}

export function buildMetadata({ id, title, creator = 'Cold Room Radio', subject = 'coldroomradio' }) {
  const idPadded = pad2(id);
  const iaTitle = `Cold Room - Radio Episode ${idPadded} - ${title}`;
  const description =
    `"ColdRoomRadio Episode ${idPadded} - ${title}" released under Creative Commons ` +
    `Attribution-NonCommercial-NoDerivatives 4.0 International License. Listeners may share ` +
    `original files with attribution, though commercial use and modifications are prohibited.`;
  return { idPadded, iaTitle, description, creator, subject };
}

export function identifierFor(id, slug) {
  return `coldroomradio_ep${pad2(id)}_${slug}`;
}

export function downloadUrlFor(identifier) {
  return `https://archive.org/download/${identifier}/${identifier}.mp3`;
}

export function buildIaUploadArgs({ identifier, filePath, remoteFilename, meta }) {
  return [
    'upload', identifier, filePath,
    `--remote-name=${remoteFilename}`,
    `--metadata=title:${meta.iaTitle}`,
    '--metadata=mediatype:audio',
    '--metadata=collection:opensource_audio',
    `--metadata=creator:${meta.creator}`,
    `--metadata=subject:${meta.subject}`,
    '--metadata=licenseurl:https://creativecommons.org/licenses/by-nc-nd/4.0/',
    '--metadata=language:Japanese',
    `--metadata=description:${meta.description}`,
  ];
}

export function runIaUpload(args, { onOutput } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile('ia', args, { maxBuffer: 1024 * 1024 * 32, env: getIaEnv() }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`ia upload failed (is it installed & configured?): ${stderr || err.message}`));
        return;
      }
      resolve({ stdout, stderr });
    });
    if (onOutput) {
      child.stdout?.on('data', (d) => onOutput(d.toString()));
      child.stderr?.on('data', (d) => onOutput(d.toString()));
    }
  });
}

export function buildEpisodeLine({ id, title, desc, release, downloadUrl }) {
  const dateStr = formatDateJP(release);
  return (
    `  { id:${id}, title:"<${jsEscape(title)}>", date:"${dateStr}公開", ` +
    `desc:"${jsEscape(desc)}", src:"${downloadUrl}", release_at: "${release}" },`
  );
}

export function appendEpisodeLine(newLine, episodeListPath = EPISODE_LIST_PATH) {
  const { lines, lastLineIndex } = readEpisodeList(episodeListPath);
  if (lastLineIndex === -1) throw new Error('could not find any existing episode entries in episode-list.js');
  lines.splice(lastLineIndex + 1, 0, newLine);
  fs.writeFileSync(episodeListPath, lines.join('\n'));
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: REPO_ROOT }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout.trim());
    });
  });
}

// Stages just episode-list.js, commits, and pushes — scoped to that one
// file so it never sweeps up unrelated working-tree changes.
export async function commitAndPushEpisodeList({ id }) {
  await runGit(['add', '--', path.relative(REPO_ROOT, EPISODE_LIST_PATH)]);
  const message = `Add episode ${id} to the episode list`;
  await runGit(['commit', '-m', message]);
  const commit = await runGit(['rev-parse', '--short', 'HEAD']);
  await runGit(['push']);
  return { message, commit };
}
