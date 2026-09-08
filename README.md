# Cho-Be-One Mini Pickleball Tournament

Static registration page for GitHub Pages with Google Apps Script as the Google Sheet API.

## Google Apps Script setup

1. Create a Google Sheet.
2. Open Extensions > Apps Script.
3. Paste the contents of `Code.gs`.
4. Click Deploy > New deployment.
5. Select Web app.
6. Set Execute as to `Me`.
7. Set Who has access to `Anyone`.
8. Deploy and copy the Web App URL.
9. Paste the URL into `GOOGLE_SCRIPT_URL` in `script.js`.

## GitHub Pages setup

1. Push this folder to a GitHub repository.
2. Open the repository Settings > Pages.
3. Set Source to `GitHub Actions`.
4. Push to the `main` branch or run the Pages workflow manually.
5. Save.

The public page will be available at the GitHub Pages URL after GitHub finishes publishing.

Player photos are saved in a Google Drive folder named `Cho-Be-One Player Photos`, beside the Google Sheet when possible. The photo links are written into the `Registrations` sheet.

Category counts are team-slot based. Each team registration uses 1 slot, so a category closes after 16 teams or 32 players.

## Registration and matching controls

Deploy the updated `Code.gs` to the existing Apps Script web app (Deploy > Manage deployments > Edit > New version). In Project Settings > Script properties, set `TOURNAMENT_ADMIN_PASSWORD` to a private password for the tournament controls. Enter that password when using the controls; it is verified by the backend and cleared after each action. Closing, reopening, locking, and unlocking always require a fresh password entry. The existing bracketing access password remains separate.

On the Bracketing page, **Close Registration / Reopen Registration** controls submissions across all categories. Registration stays open until manually closed; reopen it to extend registration. The 16-team limit still applies.

**Lock Matching / Unlock Matching** freezes or releases the current team pairings across all categories. Winners can still be recorded while locked. If registration is reopened while matching is locked, new teams appear in Official Teams and enter the matching after it is unlocked. Unlocking can change pairings and automatic byes, so review existing results before continuing. Results are saved in the `BracketResults` Google Sheet tab (created automatically), including initial, H, and L results. Saves and resets require the server-verified tournament password. Concurrent edits are rejected instead of overwriting newer results.

Control settings and locked team snapshots are shared through Apps Script. Bracketing refreshes every 30 seconds and when the window regains focus; Refresh Data also loads changes immediately; registration checks again every minute and when the page regains focus. The backend rejects submissions immediately when registration is closed.

To transfer existing results, open the browser that originally recorded them, select each category, and click **Import Browser Results**. Import only fills categories without shared history and leaves the browser copy intact. Reset Data now resets the selected category on all devices. Deploy the new Apps Script version before using the updated frontend.
