Episode list management

- Edit `episode-list.html` to update episodes.
- The file defines a global JavaScript array `window.EPISODE_LIST`.
- Use the `release_at` field to schedule a release. Preferred format is ISO 8601 with timezone, e.g. `2026-01-18T00:00:00+09:00` (midnight Japan time).
- If `release_at` is present and current browser time >= release_at, the episode will be marked `released: true` and become clickable.
- You can also manually set `release_at: null` and `src` to enable/disable releases manually.

Fields per episode object:
- id (number) — unique episode id
- title (string)
- date (string) — human readable date
- desc (string) — short description/status
- src (string) — audio source URL (leave empty until released)
- release_at (string|null) — ISO date/time or null

Notes:
- The logic runs in the user's browser, so scheduling relies on the client's system clock. For strict server-side release control, serve a server-rendered page that hides episodes until the server time reaches the release time.
- If you want centralized scheduling (robust to client clock skew), consider generating a server-side JSON that the site fetches from a trusted server with correct timezone handling.

Publishing a new episode (automated)

Both tools below handle the weekly upload → URL → episode-list.js flow.
Because they choose the archive.org identifier and filename themselves
(`coldroomradio_ep{NN}_{slug}`), the download URL is known before the
upload even starts — no need to open the item page and copy it by hand.

One-time setup (per machine) — install the `ia` CLI:
```
pip3 install internetarchive
```

Authenticating **without** an archive.org email/password (e.g. you only
ever log in via Google): `ia configure` won't work since it asks for a
password you don't have. Instead:
1. Log into archive.org in your browser as usual (Google is fine).
2. Go to https://archive.org/account/s3.php — this shows your IAS3
   Access Key and Secret Key for your account regardless of how you log in.
3. Put them in `~/.config/internetarchive/ia.ini`:
   ```
   [s3]
   access = YOUR_ACCESS_KEY
   secret = YOUR_SECRET_KEY

   [general]
   screenname = your_archive_org_username
   ```
   (Or export `IA_ACCESS_KEY_ID` / `IA_SECRET_ACCESS_KEY` in your shell
   profile instead of writing the file — both must be set together.)

### Option A: mini drag-and-drop UI

Double-click **`Publish Episode.command`** in the project folder (you can
drag it to the Dock or Desktop for quicker access). It opens a Terminal
window, starts the server, and opens the page in your browser — no need
to type anything. Closing that Terminal window stops the server; it
doesn't run in the background between episodes, so re-double-click it
next week.

(Equivalent manual command, if you'd rather run it yourself: `node
scripts/publish-server.mjs`.)

Opens a small local page (http://localhost:8933) in your browser. Drop
the mp3, type the title/description, adjust the pre-filled release date
if needed (it defaults to a week after the last episode, same time of
day), and click Publish. Episode ID and slug are auto-filled/derived but
editable under "詳細設定". Runs only on your machine — the file and any
credentials never leave localhost.

Dropping a file already named `coldroomradio_ep{NN}_{slug}.mp3` auto-fills
the id, slug, and title fields from the filename (title is filled in as
the raw slug — split it into words by hand in the box, e.g. "alphalive" ->
"alpha live").

The "公開後に... 自動で git commit & push する" checkbox (on by default)
stages just `episode-list.js`, commits it as "Add episode N to the episode
list", and pushes — the same three commands as Option B's manual step,
just triggered by the Publish click instead of a separate terminal step.
Uncheck it to leave the change staged locally for you to review/commit
yourself. If the push fails (e.g. your local branch is behind), the file
is still updated — you'll see the error in the status box and can resolve
it manually (`git pull --ff-only && git push`).

### Option B: CLI

```
node scripts/publish-episode.mjs \
  --title "new episode" \
  --desc "エピソードの短い説明" \
  --file ~/Downloads/ep36.mp3
```
`--id`, `--slug`, and `--release` are optional and auto-filled the same
way as the UI (next id, slug from the title, +7 days from the last
episode). Pass them explicitly to override.

Add `--dry-run` to preview the archive.org command and the episode-list.js
line without uploading or editing anything. Add `--skip-upload` if the file
is already on archive.org and you only need the episode-list.js entry.
See the header comment in `scripts/publish-episode.mjs` for the full flag
list.

### Both options

The CLI never commits or pushes — review `git diff episode-list.js` and
commit it yourself (or ask Claude to) once it looks right. The UI can
optionally do it for you, see the checkbox note above.
