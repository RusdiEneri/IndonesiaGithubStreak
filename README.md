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

## GitHub Pages Setup (Wajib Diperhatikan)

Untuk mencegah error `Get Pages site failed ... Error: Not Found`:
1. Push project ini ke repository GitHub.
2. Buka **Settings → Pages** pada repository.
3. Di bagian **Build and deployment**, ubah **Source** menjadi **GitHub Actions** (default-nya "Deploy from a branch"). Langkah inisialisasi ini wajib dilakukan via web UI karena `GITHUB_TOKEN` tidak memiliki izin admin untuk mengaktifkan Pages pertama kali melalui API.
4. Buka tab **Actions → Update leaderboard and deploy → Run workflow** (atau tunggu jadwal harian).

Workflow menggunakan `GITHUB_TOKEN` bawaan, sehingga tidak memerlukan personal access token tambahan.

## Tuning & Rate Limits

Parameter environment di `.github/workflows/update-and-deploy.yml`:

- `MAX_CANDIDATES`: Jumlah maksimum kandidat unik yang dievaluasi (default: `100`).
- `SEARCH_PER_LOCATION`: Jumlah hasil pencarian per lokasi (default: `20`).
- `SEARCH_DELAY_MS`: Jeda antar pencarian REST API per lokasi (default: `5000` ms untuk mematuhi limit Search API 30 req/menit).
- `GRAPHQL_BATCH_SIZE`: Jumlah user per GraphQL query (default: `1` agar beban query ringan).
- `GRAPHQL_DELAY_MS`: Jeda antar query GraphQL (default: `3000` ms untuk mencegah Secondary Rate Limit 403).
- `STREAK_FROM`: Tanggal awal kalkulasi kalender kontribusi (dihitung dinamis 1 tahun lalu via GitHub Actions dan fallback otomatis 365 hari di script karena batasan GitHub GraphQL API).
