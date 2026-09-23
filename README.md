# 🇮🇩 Indonesia GitHub Streak

Static leaderboard for Indonesian GitHub users, updated automatically with GitHub Actions and published through GitHub Pages.

## Architecture

- GitHub REST Search API: discover candidate users from Indonesian country/city location queries.
- GitHub GraphQL API: read each user's contribution calendar and public profile metadata.
- Node.js: calculate longest streak + current streak.
- `public/data/ranking.json`: generated data consumed by the frontend.
- GitHub Pages: serves `public/` as a static website.

## Streak definition

A streak day means the GitHub contribution calendar reports at least 1 contribution on that date. The leaderboard is sorted by longest streak, then current streak, then total contributions.

## Important limitation

This is a **tracked leaderboard**, not a mathematically complete list of every Indonesian GitHub account. GitHub user search is based on free-text profile metadata, so users with missing, unusual, or city-only locations can be missed. The discovery list can be expanded in `config/locations.json`, and additional usernames can be added to `data/extra-users.json`.

## Run locally

```powershell
$env:GH_TOKEN = "YOUR_GITHUB_TOKEN"
npm test
npm run update
python -m http.server 8080 --directory public
```

Open `http://localhost:8080`.

## GitHub Pages

1. Create a public repository and push this project.
2. Open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Run **Actions → Update leaderboard and deploy → Run workflow**.
5. The scheduled job runs daily.

The workflow uses the built-in `GITHUB_TOKEN`, so no additional secret is required for the first version.

## Tuning

Edit these environment values in `.github/workflows/update-and-deploy.yml`:

- `MAX_CANDIDATES`: how many discovered accounts are scored.
- `SEARCH_PER_LOCATION`: how many search results are collected for each location.
- `GRAPHQL_BATCH_SIZE`: users per GraphQL request.
- `STREAK_FROM`: earliest date to consider for the streak calculation.

Start with 250 candidates. Increase only after checking the Actions runtime and API rate limits.
