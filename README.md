# Arena account tracker

A compact MTG Arena companion for a narrow window beside the game. Each account shows gold, gems, daily wins, and remaining quests. Four wins is the daily goal; the counter continues to 15. Quest counts range from zero to three.

- **+ Win** records a daily win and credits its gold reward: 250 for win 1, 100 for wins 2–4, 50 for wins 6/8/10, and 25 for wins 12/14. Other wins award no tracked gold. The full daily total is 750 gold.
- **+500 gold / +750 gold** completes one remaining quest and credits that reward. Both buttons are disabled without a quest.
- Choose **Quick** (5,000 gold or 750 gems) or **Premier** (10,000 gold or 1,500 gems) in the shared draft selector. Draft spending appears only when at least one currency can afford the selected draft. Both payment buttons remain visible in that section; an unaffordable payment option is disabled. Spending immediately deducts the chosen currency; it does not change wins or quests or track draft results.
- **+ Gems** beside each gem balance opens Quick or Premier draft payout presets for 0–7 wins, based on the shared draft selector. Choose a payout to add it immediately, or enter a positive custom amount. Cancel or Escape leaves balances unchanged. Rewards can be added without recording draft entry; only gems are credited. Payout reference: [draft reward tables](https://draftsim.com/mtg-arena-draft-guide/). Use Edit to correct a mistaken credit.
- **Edit** enables inline name and balance inputs plus −/+ controls for wins and quests. Valid name and balance changes save on blur or Enter; each counter correction saves immediately without calculating rewards. **Done** exits editing; invalid input stays editable with an error. Escape restores the focused input’s saved value. Removal with confirmation is inside Edit. New accounts can start with any valid balances and progress.

## Run locally

Requires Node.js 18+ for checks and Python 3 for preview. No installation or runtime dependencies are needed.

```sh
npm run preview
```

Open http://127.0.0.1:4173. Use HTTP rather than opening index.html directly because the application uses JavaScript modules. Stop the server with Ctrl+C.

```sh
npm test
npm run check
```

Tests cover validation, account isolation, atomic corrections, rewards, both draft costs and payment currencies, migration, storage failures, reset boundaries, missed days, and repeated reset checks. The optional browser check verifies 320px and 400px windows, long names and large balances, keyboard controls, immediate inline saves, validation, focus and unfinished text across updates/resets, reward behavior, draft visibility, removal, and repository-prefixed assets. With Playwright and its Chromium browser available, run `npm run test:browser`. If Playwright is installed outside the project, set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path; set `PLAYWRIGHT_BROWSERS_PATH` when using a custom browser cache. This check uses synthetic browser-local data and a temporary HTTP server, with no runtime dependency added to the app.

## Daily reset and data

Daily wins reset at **09:00 UTC**. Balances and draft selection are preserved. Each elapsed day adds one outstanding quest, capped at three, including days while the tracker is closed. This is a local estimate: correct counts through the account menu if Arena differs or you play without updating the tracker. Special game events are not modeled. `RESET_HOUR_UTC` in tracker.js controls the reset hour.

Accounts stay in creation order. All changes save in this browser's local storage under `mtga-account-tracker.v1`. Different browser profiles or site origins have independent data. Clearing site data or leaving private browsing can erase accounts. There is no backup, sync, login, or game-client connection. No account data is sent to a server.

Storage failures display a warning. Unreadable data is left untouched and saving is blocked for that session; reload after resolving the issue. Another open window's saved changes are loaded automatically, with the most recent write winning.

Saved payloads now use version 2 under the same storage key. Existing version 1 accounts migrate automatically with zero gold, zero gems, and Quick draft selected; names, order, counters, and reset timestamp are preserved. Enter current balances through Edit. Migration does not reconstruct historical rewards.

## Static output and GitHub Pages

The application is buildless: **index.html, styles.css, app.js, tracker.js, and .nojekyll** are the production files. No production build command is required. All assets use relative URLs; the single page has no client-side routes, so repository prefixes and refreshes work without server rewrites.

Published site: https://aronsai.github.io/mtga-account-tracker/

Repository: https://github.com/aronsai/mtga-account-tracker

Pages uses GitHub Actions (`.github/workflows/pages.yml`). Pushes to main or a manual workflow dispatch run syntax checks and tests, copy only the five production files into `dist/`, and deploy that artifact. No dependency installation or bundling is required. GitHub Pages must have GitHub Actions selected as its source.

The browser uses a restrictive content security policy: only same-origin scripts/styles, no application network connections, plugins, or base URL overrides. Names render as text. Account data remains in local storage and is not uploaded. This is a focused security review, not a formal audit.

To preview under a repository prefix, run a static server from the parent folder and open `/MTGA%20Account%20Tracker/`. Verify that the stylesheet and both JavaScript modules return HTTP 200. The actual deployed repository name can differ without source changes.

Keep personal account exports, credentials, and real account data out of version control. Tests use synthetic accounts only.
