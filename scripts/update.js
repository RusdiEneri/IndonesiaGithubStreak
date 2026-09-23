import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { calculateStreaks } from './streak.js';
import { searchUsers, getContributionCalendars } from './github-api.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locations = JSON.parse(await fs.readFile(path.join(ROOT, 'config', 'locations.json'), 'utf8'));
const extraUsers = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'extra-users.json'), 'utf8'));

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) throw new Error('Missing GH_TOKEN or GITHUB_TOKEN');

const maxCandidates = Number(process.env.MAX_CANDIDATES || 250);
const perLocation = Number(process.env.SEARCH_PER_LOCATION || 100);
const batchSize = Number(process.env.GRAPHQL_BATCH_SIZE || 8);
const from = process.env.STREAK_FROM || '2008-01-01T00:00:00Z';
const now = new Date();
const to = process.env.STREAK_TO || now.toISOString();
const searchDelayMs = Number(process.env.SEARCH_DELAY_MS || 2200);
const today = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jakarta'
}).format(now);

console.log(`Today (Asia/Jakarta): ${today}`);
console.log(`Streak window: ${from} -> ${to}`);

const candidates = new Map();

for (const [index, location] of locations.entries()) {
  const query = `location:${JSON.stringify(location)} sort:followers-desc`;
  console.log(`Searching users: ${query}`);
  const users = await searchUsers({ token, query, perPage: perLocation });
  for (const user of users) {
    candidates.set(user.login, {
      login: user.login,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
      location: user.location || null,
      followers: user.followers ?? 0
    });
  }
  if (index < locations.length - 1 && searchDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, searchDelayMs));
  }
}

for (const entry of extraUsers) {
  const login = typeof entry === 'string' ? entry : entry.login;
  if (!login) continue;
  candidates.set(login, { login, source: 'manual' });
}

const orderedCandidates = [...candidates.values()]
  .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0) || a.login.localeCompare(b.login))
  .slice(0, maxCandidates);

console.log(`Unique candidates: ${candidates.size}; evaluating: ${orderedCandidates.length}`);

const profiles = await getContributionCalendars({
  token,
  logins: orderedCandidates.map((user) => user.login),
  from,
  to,
  batchSize
});

const ranking = [];
for (const user of profiles) {
  const days = user.contributionsCollection?.contributionCalendar?.weeks
    ?.flatMap((week) => week.contributionDays) ?? [];
  const streaks = calculateStreaks(days, today);
  const totalContributions = user.contributionsCollection?.totalContributions ?? 0;

  ranking.push({
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
    htmlUrl: user.htmlUrl,
    location: user.location,
    bio: user.bio,
    followers: user.followers?.totalCount ?? 0,
    publicRepos: user.publicRepositories?.totalCount ?? 0,
    longestStreak: streaks.longestStreak,
    currentStreak: streaks.currentStreak,
    totalContributions
  });
}

ranking.sort((a, b) =>
  b.longestStreak - a.longestStreak ||
  b.currentStreak - a.currentStreak ||
  b.totalContributions - a.totalContributions ||
  a.login.localeCompare(b.login)
);

const output = {
  generatedAt: now.toISOString(),
  timezone: 'Asia/Jakarta',
  streakDefinition: 'A streak day is a GitHub contribution-calendar day with at least 1 contribution.',
  streakWindow: { from, to },
  candidateCount: candidates.size,
  evaluatedCount: ranking.length,
  ranking
};

const outputDir = path.join(ROOT, 'public', 'data');
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'ranking.json'), JSON.stringify(output, null, 2) + '\n');

console.log(`Wrote ${ranking.length} ranked users to public/data/ranking.json`);
console.log('Top 10:');
for (const [index, user] of ranking.slice(0, 10).entries()) {
  console.log(`#${index + 1} ${user.login}: ${user.longestStreak}d (current ${user.currentStreak}d)`);
}
