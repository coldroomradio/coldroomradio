#!/usr/bin/env node
// publish-episode.mjs
//
// CLI for the weekly episode publishing flow. For a drag-and-drop UI
// instead of flags, use `node scripts/publish-server.mjs`.
//
// Automates:
//   1. Uploading the audio file to archive.org with the show's standard
//      metadata (using the `ia` CLI from the `internetarchive` pip package).
//   2. Because this script controls the archive.org identifier and the
//      remote filename, the resulting download URL is known up front —
//      no need to open the item page and copy it by hand.
//   3. Appending the new episode object to episode-list.js in the same
//      format as the existing entries.
//
// One-time setup (only needed once per machine) — see EPISODE_README.md
// for the full walkthrough, including how to authenticate when you only
// ever log into archive.org via Google (no email/password to give `ia
// configure`):
//   pip3 install internetarchive
//   # get your keys from https://archive.org/account/s3.php and put them
//   # in ~/.config/internetarchive/ia.ini, or export IA_ACCESS_KEY_ID /
//   # IA_SECRET_ACCESS_KEY
//
// Usage:
//   node scripts/publish-episode.mjs \
//     --id 36 \
//     --slug newepisode \
//     --title "new episode" \
//     --desc "エピソードの短い説明" \
//     --file ~/Downloads/ep36.mp3 \
//     --release "2026-08-30T18:59:00+09:00"
//
// Flags:
//   --id        episode number (default: next after the current max)
//   --slug      short ascii identifier used in the archive.org item id and
//               filename, e.g. "newepisode" (default: derived from --title)
//   --title     episode title as it appears in <...> on the site (required)
//   --desc      short description shown under the title on the site (required)
//   --file      path to the local mp3 to upload (required unless --dry-run
//               and the file doesn't matter yet)
//   --release   ISO 8601 release date/time with timezone, e.g.
//               2026-08-30T18:59:00+09:00 (default: 7 days after the
//               latest existing episode, same time of day)
//   --creator   archive.org "creator" metadata field (default: "Cold Room Radio")
//   --subject   archive.org "subject" metadata field (default: "coldroomradio")
//   --dry-run   print what would happen without uploading or editing files
//   --skip-upload  don't call `ia upload` (use when the file is already up
//                  and you only need to append the episode-list.js entry)
//
// The script does NOT commit or push — review the diff to episode-list.js
// and commit it yourself (or ask Claude to).

import fs from 'node:fs';
import path from 'node:path';
import {
  appendEpisodeLine, buildEpisodeLine, buildIaUploadArgs, buildMetadata,
  downloadUrlFor, getIaEnv, identifierFor, slugify, suggestNext,
} from './lib/episode-publish.mjs';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const args = { dryRun: false, skipUpload: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') { args.dryRun = true; continue; }
    if (a === '--skip-upload') { args.skipUpload = true; continue; }
    if (a.startsWith('--')) {
      const [flag, inlineVal] = a.split(/=(.*)/s);
      const key = flag.slice(2);
      const val = inlineVal !== undefined ? inlineVal : argv[++i];
      args[key] = val;
    }
  }
  return args;
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  for (const req of ['title', 'desc']) {
    if (!args[req]) fail(`missing required --${req}`);
  }
  if (!args.dryRun && !args.skipUpload && !args.file) {
    fail('missing required --file (or pass --dry-run / --skip-upload)');
  }

  const { nextId, nextRelease } = suggestNext();
  const id = args.id ? Number(args.id) : nextId;
  if (!Number.isInteger(id) || id <= 0) fail(`--id must be a positive integer, got: ${args.id}`);

  const slug = args.slug || slugify(args.title);
  if (!/^[a-z0-9]+$/.test(slug)) {
    fail(`slug must be lowercase letters/digits only (got "${slug}" — pass --slug to override)`);
  }

  const release = args.release || nextRelease;
  if (!release) fail('missing --release and could not infer one from episode-list.js');

  const identifier = identifierFor(id, slug);
  const downloadUrl = downloadUrlFor(identifier);
  const remoteFilename = `${identifier}.mp3`;
  const meta = buildMetadata({ id, title: args.title, creator: args.creator, subject: args.subject });

  console.log(`identifier:    ${identifier}`);
  console.log(`download url:  ${downloadUrl}`);
  console.log(`release:       ${release}`);

  if (!args.skipUpload && args.file) {
    const filePath = path.resolve(args.file.replace(/^~/, process.env.HOME || '~'));
    if (!args.dryRun && !fs.existsSync(filePath)) fail(`file not found: ${filePath}`);

    const iaArgs = buildIaUploadArgs({ identifier, filePath, remoteFilename, meta });

    if (args.dryRun) {
      console.log(`\n[dry-run] would run: ia ${iaArgs.map(a => `'${a}'`).join(' ')}`);
    } else {
      console.log('\nUploading to archive.org...');
      try {
        execFileSync('ia', iaArgs, { stdio: 'inherit', env: getIaEnv() });
      } catch (e) {
        fail(`ia upload failed (is it installed & configured? see EPISODE_README.md): ${e.message}`);
      }
      console.log('✓ upload command finished');
    }
  } else if (args.skipUpload) {
    console.log('(--skip-upload: not calling ia upload)');
  }

  const newLine = buildEpisodeLine({ id, title: args.title, desc: args.desc, release, downloadUrl });

  if (args.dryRun) {
    console.log(`\n[dry-run] would append to episode-list.js:\n${newLine}`);
    return;
  }

  try {
    appendEpisodeLine(newLine);
  } catch (e) {
    fail(e.message);
  }
  console.log(`\n✓ appended episode ${id} to episode-list.js:\n${newLine}`);
  console.log('\nReview the diff and commit when ready:\n  git diff episode-list.js');
}

main();
