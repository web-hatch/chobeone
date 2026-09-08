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

Category counts are player-based. Each team registration adds 2 players, so a category closes after 8 teams or 16 players.
