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

const maxCandidates = Number(process.env.MAX_CANDIDATES || 100);
const perLocation = Number(process.env.SEARCH_PER_LOCATION || 20);
const batchSize = Number(process.env.GRAPHQL_BATCH_SIZE || 1);
const searchDelayMs = Number(process.env.SEARCH_DELAY_MS || 5000);
const graphqlDelayMs = Number(process.env.GRAPHQL_DELAY_MS || 3000);

const now = new Date();
// ponytail: default 1-year trailing window. GitHub GraphQL limits contributionsCollection to max 1 year.
const defaultFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
const from = process.env.STREAK_FROM || defaultFrom;
const to = process.env.STREAK_TO || now.toISOString();
const today = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jakarta'
}).format(now);

console.log(`Today (Asia/Jakarta): ${today}`);
console.log(`Streak window: ${from} -> ${to}`);

const candidates = new Map();

try {
  const prev = JSON.parse(await fs.readFile(path.join(ROOT, 'public', 'data', 'ranking.json'), 'utf8'));
  for (const user of prev.ranking || []) {
    if (user.login) candidates.set(user.login, { login: user.login, source: 'tracked' });
  }
  if (candidates.size > 0) {
    console.log(`Loaded ${candidates.size} existing streak holders from previous ranking.`);
  }
} catch {
  // No previous ranking, start fresh
}

for (const [index, location] of locations.entries()) {
  if (candidates.size >= maxCandidates) {
    console.log(`Candidate target reached (${candidates.size}/${maxCandidates}), stopping further search.`);
    break;
  }

  const query = `location:${JSON.stringify(location)} type:user`;
  console.log(`Searching users: ${query}`);
  try {
    const users = await searchUsers({ token, query, perPage: perLocation });
    for (const user of users) {
      if (user.type && user.type !== 'User') continue;
      if (!candidates.has(user.login)) {
        candidates.set(user.login, {
          login: user.login,
          avatarUrl: user.avatar_url,
          htmlUrl: user.html_url,
          location: user.location || null
        });
      }
    }
  } catch (err) {
    console.warn(`Search rate limited or failed for "${location}": ${err.message}. Proceeding with ${candidates.size} candidates.`);
    break;
  }

  if (index < locations.length - 1 && searchDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, searchDelayMs));
  }
}

for (const entry of extraUsers) {
  const login = typeof entry === 'string' ? entry : entry.login;
  if (!login) continue;
  candidates.set(login, { ...candidates.get(login), login, source: 'manual' });
}

// ponytail: Prioritize manual additions and established streak holders over arbitrary search results
const orderedCandidates = [...candidates.values()]
  .sort((a, b) => {
    const p = (u) => (u.source === 'manual' ? 2 : (u.source === 'tracked' ? 1 : 0));
    return p(b) - p(a) || a.login.localeCompare(b.login);
  })
  .slice(0, maxCandidates);

console.log(`Unique candidates: ${candidates.size}; evaluating: ${orderedCandidates.length}`);

const profiles = await getContributionCalendars({
  token,
  logins: orderedCandidates.map((user) => user.login),
  from,
  to,
  batchSize,
  delayMs: graphqlDelayMs
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
