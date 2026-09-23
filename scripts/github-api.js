const REST_API = 'https://api.github.com';
const GRAPHQL_API = 'https://api.github.com/graphql';

function headers(token) {
  const result = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'indonesia-github-streak'
  };
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

async function parseJson(response) {
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`GitHub returned non-JSON (${response.status}): ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    const message = body?.message || `HTTP ${response.status}`;
    throw new Error(`${message} (status ${response.status})`);
  }
  return body;
}

export async function searchUsers({ token, query, perPage = 100 }) {
  const params = new URLSearchParams({ q: query, per_page: String(perPage), page: '1' });
  const response = await fetch(`${REST_API}/search/users?${params}`, {
    headers: headers(token)
  });
  const data = await parseJson(response);
  return data.items || [];
}

export async function getUserProfiles({ token, logins }) {
  const users = {};
  for (const login of logins) {
    const response = await fetch(`${REST_API}/users/${encodeURIComponent(login)}`, {
      headers: headers(token)
    });
    if (!response.ok) continue;
    const data = await parseJson(response);
    users[login] = data;
  }
  return users;
}

function buildGraphqlQuery(count) {
  const fields = Array.from({ length: count }, (_, i) => `
    u${i}: user(login: $u${i}) {
      login
      name
      avatarUrl
      htmlUrl: url
      location
      bio
      followers { totalCount }
      publicRepositories: repositories(privacy: PUBLIC, first: 1) { totalCount }
      contributionsCollection(from: $from, to: $to) {
        totalContributions: contributionCalendar { totalContributions }
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  `).join('\n');

  const variableLines = Array.from({ length: count }, (_, i) => `$u${i}: String!`).join(', ');

  return `query(${variableLines}, $from: DateTime!, $to: DateTime!) { ${fields} }`;
}

export async function getContributionCalendars({ token, logins, from, to, batchSize = 8 }) {
  const output = [];

  for (let start = 0; start < logins.length; start += batchSize) {
    const batch = logins.slice(start, start + batchSize);
    const query = buildGraphqlQuery(batch.length);
    const variables = { from, to };
    batch.forEach((login, index) => {
      variables[`u${index}`] = login;
    });

    const response = await fetch(GRAPHQL_API, {
      method: 'POST',
      headers: {
        ...headers(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    const payload = await parseJson(response);
    if (payload.errors?.length) {
      const message = payload.errors.map((error) => error.message).join('; ');
      throw new Error(`GraphQL error: ${message}`);
    }

    for (const login of batch) {
      const index = batch.indexOf(login);
      const user = payload.data?.[`u${index}`];
      if (user) output.push(user);
    }

    process.stdout.write(`GraphQL ${Math.min(start + batch.length, logins.length)}/${logins.length}\n`);
  }

  return output;
}
