# macOS Disk Cleanup & Terminal Basics

Notes from cleaning up ~65GB of hidden disk usage on macOS, plus the underlying terminal concepts learned along the way.

---

## 1. Core concepts

### Why `~/Library` eats so much space
Every app writes to a hidden folder called `~/Library` (`~` = your home folder, e.g. `/Users/sharadpoddar`). Inside it:

- **Caches** — temporary data an app downloaded/computed once so it doesn't redo the work. Safe to delete — the app just rebuilds it, first use after might be a bit slower.
- **Application Support** — an app's real working data: settings, local databases, downloaded state. Riskier to touch (may hold login sessions, real data).
- **Containers** — sandboxed version of the above, used by Mac App Store apps.
- **Logs** — debug text files. Safe to delete.

### The filesystem is a tree
macOS (like Linux) organizes everything — files, devices, even running processes — as a tree starting at `/` (root). `~` is just one branch of it (your home folder).

```bash
pwd          # print working directory — where am I right now?
ls -la       # list everything here, including hidden dotfiles, with details
cd ~/Desktop # change directory
cd ..        # move up one level
cd -         # jump back to wherever you just were
```

**Try this:** run `ls -la /` and look at the top-level folders (`Applications`, `System`, `Users`, `Library`, `usr`, `var`). Each has a specific job. Once you know this layout, it transfers to any Unix-like system — Linux servers, Docker containers, all the same shape.

### Anatomy of a command
```
command  -flags  arguments
```
Example: `du -sh ~/Library` → command = `du`, flags = `-sh` (two flags combined: `-s` and `-h`), argument = `~/Library` (what to run it on).

Two connectors used constantly:
- `|` (pipe) — feeds one command's output into the next, e.g. `du ... | sort ...`
- `>` / `>>` — redirect output into a file instead of the screen (`>` overwrites, `>>` appends)

**Try this:** `ls -la ~/Desktop > /tmp/desktop-listing.txt`, then open that file — you just captured command output into a file.

### Getting help without leaving the terminal
```bash
man du       # full manual page for any command (press q to exit)
du --help    # quick flag reference
which du     # where is this command actually located on disk?
```
Before running anything unfamiliar — especially anything with `rm`, `sudo`, or `>` — check it with `man` or `--help` first.

### Permissions & ownership
```bash
ls -la some-file   # far-left column shows permissions, e.g. -rw-r--r--
```
`sudo` ("superuser do") temporarily runs a command as the all-powerful admin/root account — that's why it asks for your password. **Never run a command with `sudo` unless you fully understand what it does** — as root, there's no permission system left to stop a mistake.

### Processes — what's actually running
```bash
top          # live view of running processes and resource usage (press q to quit)
ps aux       # snapshot list of all running processes
kill <pid>   # stop a process by its ID number
```
This is how you'd notice something like Docker's background VM quietly eating RAM even when you're not using it.

---

## 2. Measuring disk usage — `du`

`du` = **disk usage**. The core command used throughout this cleanup:

```bash
du -sh ~/Library/* 2>/dev/null | sort -rh | head -30
```

| Part | Meaning |
|---|---|
| `du` | the disk-usage program |
| `-s` | summarize — one total per folder, not every file inside it |
| `-h` | human-readable — `29G` instead of `29360128` (KB) |
| `~/Library/*` | look at every item directly inside `~/Library` |
| `2>/dev/null` | discard permission-error messages so they don't clutter output |
| `\| sort -rh` | pipe into `sort`: `-r` = biggest first, `-h` = sort correctly with G/M suffixes |
| `\| head -30` | show only the top 30 lines |

Same pattern reused at every level — just pointed at different folders (`~/Library/Application Support/*`, `~/Library/Containers/*`, etc.) to drill down layer by layer.

**How safety was judged:** folder names literally containing `Cache`, `Caches`, `GPUCache`, `Code Cache`, `Service Worker` → almost always safe to delete. Folders like `notion.db`, `Cookies`, `Local Storage` → real data, avoid.

---

## 3. Cleanup log — what was done and why

### Docker Desktop VM (22GB → 2.3GB)
```bash
open -a Docker                        # launch the app, same as double-clicking it
docker system prune -a --volumes      # delete everything Docker isn't using
```
- `-a` — also remove unused *images* (without it, only truly orphaned data is removed)
- `--volumes` — also remove unused *volumes* (persistent storage no running container needs)

Docker Desktop keeps every image/container/build-layer ever pulled or built, forever, until told to clean up.

### Notion cache (~1.9GB)
```bash
osascript -e 'quit app "Notion"'
rm -rf ~/Library/Application\ Support/Notion/Partitions/notion/Service\ Worker \
       ~/Library/Application\ Support/Notion/Partitions/notion/Cache \
       ~/Library/Application\ Support/Notion/Partitions/notion/Code\ Cache
```
- `osascript -e '...'` — runs a one-line AppleScript; `quit app "Notion"` closes it cleanly first (deleting a running app's open files can corrupt them)
- `rm -rf` — **the actual delete**: `rm` = remove, `-r` = recursive (folders + everything inside), `-f` = force (no per-file confirmation)
- `\ ` before spaces (e.g. `Service\ Worker`) — spaces normally separate arguments in a terminal; the backslash says "this space is part of the filename"

### Stremio cache (6.1GB)
```bash
rm -rf ~/Library/Application\ Support/stremio-server/stremio-cache
```

### npm / npx cache (~20GB — the biggest single item found)
```bash
npm cache clean --force     # empties npm's downloaded-package cache
rm -rf ~/.npm/_npx/*        # npx's separate cache of one-off package runs
```
`--force` is required because modern npm treats clearing the cache as risky enough to need explicit confirmation via the flag.

### Homebrew cache (2.5GB)
```bash
brew cleanup -s
```
Homebrew keeps old downloaded package versions for rollback; `cleanup` removes them, `-s` also clears its download cache.

### Gradle / Maven / Cargo caches (~4.2GB combined)
```bash
rm -rf ~/.gradle/caches
rm -rf ~/.m2/repository
rm -rf ~/.cargo/registry/cache ~/.cargo/registry/src
```
Same idea as npm, for Java (Gradle/Maven) and Rust (Cargo): downloaded dependencies cached locally, redownloaded on next build if cleared.

### Generic `~/.cache` (941MB)
```bash
rm -rf ~/.cache/*
```
Catch-all cache folder many CLI tools use by convention (pip, puppeteer, etc.).

### App-specific caches (Chrome, JetBrains, Telegram)
```bash
osascript -e 'quit app "Google Chrome"' 2>/dev/null
rm -rf ~/Library/Caches/Google/Chrome
rm -rf ~/Library/Caches/JetBrains/*
osascript -e 'quit app "Telegram"' 2>/dev/null
rm -rf ~/Library/Caches/ru.keepcoder.Telegram
```

**Total reclaimed: ~65GB.**

---

## 4. Do NOT touch without checking first

- `~/.rustup` (2.3GB) — installed Rust *toolchains*, not cache. Only remove unused ones via `rustup toolchain list` then `rustup toolchain uninstall <name>`.
- `~/Library/Android/sdk` (3.8GB) — real SDK platforms/build-tools. Trim only via Android Studio's SDK Manager.
- `~/Library/Containers/app.getfluid` (4.4GB) — only delete if the Fluid app itself is no longer used.
- Project `node_modules` folders — active dependencies, not cache. Delete only if not currently working in that project; `npm install` restores them.
- Cursor / VS Code Application Support — normal size for active editors; only worth trimming with a closer look.

---

## 5. General command reference (quick cheatsheet)

| Command | Does |
|---|---|
| `pwd` | show current folder |
| `ls -la` | list files, including hidden, with details |
| `cd <path>` | change folder |
| `du -sh <path>` | show folder size, human-readable |
| `rm -rf <path>` | delete a folder permanently — **no undo** |
| `man <command>` | full manual for a command |
| `<command> --help` | quick flag reference |
| `top` / `ps aux` | see running processes |
| `kill <pid>` | stop a process |
| `sudo <command>` | run as admin — only when you understand exactly what it does |
