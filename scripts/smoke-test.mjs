// Black-box HTTP scenarios against a running API: local server or deployed stack.
// Statistics are recomputed independently from the player list.
//
//   BASE_URL=http://localhost:3000 API_KEY=... npm run test:smoke                  read-only
//   BASE_URL=http://localhost:3000 API_KEY=... ALLOW_WRITES=1 npm run test:smoke   + creations
//
// Without ALLOW_WRITES, nothing is written: write requests are all rejected (401/400/413),
// which is checked by counting the players before and after.
if (!process.env.BASE_URL || !process.env.API_KEY) {
  console.error('BASE_URL (API root, with or without /api/v1) and API_KEY are required');
  process.exit(2);
}
const ROOT = process.env.BASE_URL.replace(/\/$/, '').replace(/\/api\/v1$/, '');
const API = `${ROOT}/api/v1`;
const API_KEY = process.env.API_KEY;
const ALLOW_WRITES = process.env.ALLOW_WRITES === '1';

const results = [];
const latencies = [];
let section = '';

const check = (name, condition, detail = '') => {
  results.push({ section, name, ok: Boolean(condition), detail });
};
const group = (title) => {
  section = title;
};

async function http(method, path, { body, headers = {}, raw } = {}) {
  const url = path.startsWith('http') ? path : `${path.startsWith('/docs') ? ROOT : API}${path}`;
  const init = { method, headers: { ...headers } };
  if (raw !== undefined) init.body = raw;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['content-type'] ??= 'application/json';
  }
  const started = performance.now();
  const response = await fetch(url, init);
  latencies.push(performance.now() - started);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, headers: response.headers, text, json };
}

const ERROR_KEYS = ['statusCode', 'error', 'message', 'path', 'timestamp'];
function isUniformError(r, status) {
  const j = r.json;
  return (
    r.status === status &&
    j &&
    ERROR_KEYS.every((k) => k in j) &&
    j.statusCode === status &&
    !Number.isNaN(Date.parse(j.timestamp)) &&
    /json/.test(r.headers.get('content-type') ?? '')
  );
}

const PLAYER_KEYS = [
  'id',
  'firstName',
  'lastName',
  'shortName',
  'sex',
  'country',
  'pictureUrl',
  'stats',
];
const STATS_KEYS = ['rank', 'points', 'weightKg', 'heightCm', 'age', 'lastResults'];
const hasPlayerShape = (p) =>
  JSON.stringify(Object.keys(p).sort()) === JSON.stringify([...PLAYER_KEYS].sort()) &&
  JSON.stringify(Object.keys(p.stats).sort()) === JSON.stringify([...STATS_KEYS].sort()) &&
  JSON.stringify(Object.keys(p.country).sort()) === JSON.stringify(['code', 'pictureUrl']);

const round2 = (x) => Math.sign(x) * (Math.round((Math.abs(x) + Number.EPSILON) * 100) / 100);
function expectedStats(players) {
  const totals = {};
  for (const p of players) {
    const t = (totals[p.country.code] ??= { wins: 0, matches: 0 });
    t.wins += p.stats.lastResults.filter((r) => r === 1).length;
    t.matches += p.stats.lastResults.length;
  }
  const best = Object.entries(totals)
    .filter(([, t]) => t.matches > 0)
    .map(([code, t]) => ({ code, ...t, ratio: t.wins / t.matches }))
    .sort((a, b) => b.ratio - a.ratio || b.matches - a.matches || a.code.localeCompare(b.code))[0];
  const bmis = players.map((p) => p.stats.weightKg / (p.stats.heightCm / 100) ** 2);
  const heights = players.map((p) => p.stats.heightCm).sort((a, b) => a - b);
  const mid = Math.floor(heights.length / 2);
  return {
    bestCountry: best
      ? { code: best.code, winRatio: round2(best.ratio), wins: best.wins, matches: best.matches }
      : null,
    averageBmi: players.length ? round2(bmis.reduce((a, b) => a + b, 0) / bmis.length) : null,
    medianHeightCm: players.length
      ? heights.length % 2
        ? heights[mid]
        : (heights[mid - 1] + heights[mid]) / 2
      : null,
  };
}
const sortedByRank = (list) =>
  list.every((p, i) => i === 0 || list[i - 1].stats.rank <= p.stats.rank);
const ids = (list) => list.map((p) => p.id);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const SEED_IDS = [17, 52, 102, 65, 95];
const DJOKOVIC = {
  id: 52,
  firstName: 'Novak',
  lastName: 'Djokovic',
  shortName: 'N.DJO',
  sex: 'M',
  country: { code: 'SRB', pictureUrl: 'https://tenisu.latelier.co/resources/Serbie.png' },
  pictureUrl: 'https://tenisu.latelier.co/resources/Djokovic.png',
  stats: {
    rank: 2,
    points: 2542,
    weightKg: 80,
    heightCm: 188,
    age: 31,
    lastResults: [1, 1, 1, 1, 1],
  },
};
const validPlayer = () => ({
  firstName: 'Jannik',
  lastName: 'Sinner',
  shortName: 'J.SIN',
  sex: 'M',
  country: { code: 'ITA', pictureUrl: 'https://example.com/ita.png' },
  pictureUrl: 'https://example.com/sinner.png',
  stats: { rank: 4, points: 1900, weightKg: 77.5, heightCm: 191, age: 23, lastResults: [1, 0, 1] },
});

// ---------------------------------------------------------------------------
group('Health & documentation');
{
  const r = await http('GET', '/health');
  check(
    'GET /health → 200 {status: ok, uptime}',
    r.status === 200 && r.json?.status === 'ok' && typeof r.json.uptime === 'number',
  );
  check('JSON content type', /application\/json/.test(r.headers.get('content-type') ?? ''));
  check('no X-Powered-By header', r.headers.get('x-powered-by') === null);
  const docs = await http('GET', '/docs');
  check(
    'GET /docs → 200 HTML (Swagger UI)',
    docs.status === 200 && /text\/html/.test(docs.headers.get('content-type') ?? ''),
  );
  for (const asset of [
    'swagger-ui.css',
    'swagger-ui-bundle.js',
    'swagger-ui-standalone-preset.js',
  ]) {
    const a = await http('GET', `/docs/${asset}`);
    check(`GET /docs/${asset} → 200`, a.status === 200 && a.text.length > 1000);
  }
  const spec = await http('GET', '/docs/json');
  const paths = Object.keys(spec.json?.paths ?? {}).sort();
  check('OpenAPI 3 document', spec.status === 200 && /^3\./.test(spec.json?.openapi ?? ''));
  check(
    'documents the 4 routes',
    same(paths, ['/api/v1/health', '/api/v1/players', '/api/v1/players/{id}', '/api/v1/stats']),
    paths.join(','),
  );
  check(
    'documents GET and POST /players',
    same(Object.keys(spec.json?.paths?.['/api/v1/players'] ?? {}).sort(), ['get', 'post']),
  );
  check(
    'declares the x-api-key security scheme',
    spec.json?.components?.securitySchemes?.['api-key']?.name === 'x-api-key',
  );
  check(
    'POST /players requires the API key',
    same(spec.json?.paths?.['/api/v1/players']?.post?.security, [{ 'api-key': [] }]),
  );
  check(
    'documents 201/400/401 for POST',
    ['201', '400', '401'].every(
      (c) => c in (spec.json?.paths?.['/api/v1/players']?.post?.responses ?? {}),
    ),
  );
}

// ---------------------------------------------------------------------------
group('Task 1 — GET /players (sorted list)');
const list = await http('GET', '/players');
const players = list.json ?? [];
{
  check(
    '→ 200 JSON array',
    list.status === 200 && Array.isArray(players) && players.length >= 5,
    `${players.length} players`,
  );
  check('every player has the documented shape', players.every(hasPlayerShape));
  check(
    'sorted from best to worst official rank',
    sortedByRank(players),
    JSON.stringify(players.map((p) => p.stats.rank)),
  );
  check(
    'Nadal (rank 1, fewer points) comes before Djokovic (rank 2)',
    ids(players).indexOf(17) < ids(players).indexOf(52),
  );
  check(
    'contains the 5 seeded players',
    SEED_IDS.every((id) => ids(players).includes(id)),
  );
  check(
    'Djokovic exposed exactly, weight converted to kg',
    same(
      players.find((p) => p.id === 52),
      DJOKOVIC,
    ),
  );
  check(
    'no weight left in grams',
    players.every((p) => p.stats.weightKg < 300),
  );
  check('ids are unique', new Set(ids(players)).size === players.length);
}

group('Task 1 — filters');
{
  const cases = [
    ['sex=F', (p) => p.sex === 'F'],
    ['sex=f', (p) => p.sex === 'F'],
    ['sex=M', (p) => p.sex === 'M'],
    ['country=SRB', (p) => p.country.code === 'SRB'],
    ['country=srb', (p) => p.country.code === 'SRB'],
    ['country=USA&sex=F', (p) => p.country.code === 'USA' && p.sex === 'F'],
    ['sex=M&country=USA', (p) => p.country.code === 'USA' && p.sex === 'M'],
    ['country=FRA', (p) => p.country.code === 'FRA'],
  ];
  for (const [query, predicate] of cases) {
    const r = await http('GET', `/players?${query}`);
    const expected = players.filter(predicate);
    check(
      `?${query} → 200, matches the filtered list (${expected.length})`,
      r.status === 200 && same(r.json, expected),
      JSON.stringify(ids(r.json ?? [])),
    );
  }
  const invalid = [
    ['sex=X', 'sex must be one of the following values: M, F'],
    ['sex=', 'sex must be one of the following values: M, F'],
    ['country=SERBIA', 'country must be an ISO 3166-1 alpha-3 code (e.g. SRB)'],
    ['country=SR', 'country must be an ISO 3166-1 alpha-3 code (e.g. SRB)'],
    ['country=SR1', 'country must be an ISO 3166-1 alpha-3 code (e.g. SRB)'],
    ['foo=bar', 'property foo should not exist'],
    ['sex=M&sex=F', 'sex must be one of the following values: M, F'],
  ];
  for (const [query, detail] of invalid) {
    const r = await http('GET', `/players?${query}`);
    check(
      `?${query} → 400 with detail`,
      isUniformError(r, 400) &&
        r.json.message === 'Validation failed' &&
        r.json.details?.includes(detail),
      JSON.stringify(r.json?.details),
    );
  }
}

// ---------------------------------------------------------------------------
group('Task 2 — GET /players/:id');
{
  let allMatch = true;
  for (const p of players) {
    const r = await http('GET', `/players/${p.id}`);
    if (r.status !== 200 || !same(r.json, p)) allMatch = false;
  }
  check(`every listed player (${players.length}) is returned identically by id`, allMatch);
  const missing = await http('GET', '/players/999999');
  check(
    'unknown id → 404 uniform error',
    isUniformError(missing, 404) &&
      missing.json.message === 'Player with id 999999 not found' &&
      missing.json.error === 'Not Found' &&
      missing.json.path === '/api/v1/players/999999',
  );
  for (const bad of ['abc', '0', '-1', '1.5', '01', '1e3', '+1', '9007199254740992', '52abc']) {
    const r = await http('GET', `/players/${bad}`);
    check(
      `id "${decodeURIComponent(bad)}" → 400`,
      isUniformError(r, 400) && r.json.message === 'id must be a positive integer',
      `${r.status} ${r.json?.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
group('Task 3 — GET /stats');
{
  const r = await http('GET', '/stats');
  check(
    '→ 200 with the 3 statistics',
    r.status === 200 &&
      same(Object.keys(r.json ?? {}).sort(), ['averageBmi', 'bestCountry', 'medianHeightCm']),
  );
  const expected = expectedStats(players);
  check(
    'matches an independent computation from the player list',
    same(r.json, expected),
    `got ${JSON.stringify(r.json)} expected ${JSON.stringify(expected)}`,
  );
  if (players.length === 5) {
    check(
      'seed dataset: SRB 1 (5/5), BMI 23.36, median 185',
      same(r.json, {
        bestCountry: { code: 'SRB', winRatio: 1, wins: 5, matches: 5 },
        averageBmi: 23.36,
        medianHeightCm: 185,
      }),
    );
  }
}

// ---------------------------------------------------------------------------
group('Routing & uniform errors');
{
  const r = await http('GET', '/nope');
  check(
    'unknown route under /api/v1 → 404 uniform JSON',
    isUniformError(r, 404) && r.json.message === 'Cannot GET /api/v1/nope',
  );
  for (const method of ['DELETE', 'PUT', 'PATCH']) {
    const m = await http(method, '/players/17');
    check(`${method} /players/17 (not supported) → 404 uniform JSON`, isUniformError(m, 404));
  }
  const still = await http('GET', '/players/17');
  check('player 17 still exists after the unsupported calls', still.status === 200);
}

// ---------------------------------------------------------------------------
group('Task 4 — POST /players: authentication');
const countBefore = players.length;
{
  const noKey = await http('POST', '/players', { body: validPlayer() });
  check(
    'no API key → 401',
    isUniformError(noKey, 401) && noKey.json.message === 'Missing or invalid API key',
  );
  const wrong = await http('POST', '/players', {
    body: validPlayer(),
    headers: { 'x-api-key': 'definitely-not-the-right-key' },
  });
  check('wrong API key → 401', isUniformError(wrong, 401));
  const prefix = await http('POST', '/players', {
    body: validPlayer(),
    headers: { 'x-api-key': API_KEY.slice(0, -1) },
  });
  check('truncated API key → 401', isUniformError(prefix, 401));
  const longer = await http('POST', '/players', {
    body: validPlayer(),
    headers: { 'x-api-key': `${API_KEY}x` },
  });
  check('API key with an extra character → 401', isUniformError(longer, 401));
  const bearer = await http('POST', '/players', {
    body: validPlayer(),
    headers: { authorization: `Bearer ${API_KEY}` },
  });
  check('key sent in Authorization instead of x-api-key → 401', isUniformError(bearer, 401));
  const authFirst = await http('POST', '/players', { body: {} });
  check('auth checked before validation (invalid body, no key → 401)', authFirst.status === 401);
}

group('Task 4 — POST /players: validation (valid key, nothing written)');
{
  const key = { 'x-api-key': API_KEY };
  const base = validPlayer();
  const cases = [
    ['empty body', {}, 'firstName should not be empty'],
    ['missing stats', { ...base, stats: undefined }, 'stats should not be null or undefined'],
    ['stats: null', { ...base, stats: null }, 'stats should not be null or undefined'],
    ['id chosen by the client', { ...base, id: 1 }, 'property id should not exist'],
    ['unknown top-level field', { ...base, titles: 4 }, 'property titles should not exist'],
    [
      'unknown nested field',
      { ...base, country: { ...base.country, name: 'Italy' } },
      'country.property name should not exist',
    ],
    ['blank first name', { ...base, firstName: '   ' }, 'firstName should not be empty'],
    [
      'first name too long',
      { ...base, firstName: 'x'.repeat(51) },
      'firstName must be shorter than or equal to 50 characters',
    ],
    ['sex X', { ...base, sex: 'X' }, 'sex must be one of the following values: M, F'],
    [
      'country code SPAIN',
      { ...base, country: { ...base.country, code: 'SPAIN' } },
      'country.code must be an ISO 3166-1 alpha-3 code (e.g. SRB)',
    ],
    [
      'http picture URL',
      { ...base, pictureUrl: 'http://example.com/a.png' },
      'pictureUrl must be an https URL',
    ],
    ['not a URL', { ...base, pictureUrl: 'sinner.png' }, 'pictureUrl must be an https URL'],
    [
      'rank 0',
      { ...base, stats: { ...base.stats, rank: 0 } },
      'stats.rank must not be less than 1',
    ],
    [
      'rank 100000',
      { ...base, stats: { ...base.stats, rank: 100000 } },
      'stats.rank must not be greater than 99999',
    ],
    [
      'rank as a string',
      { ...base, stats: { ...base.stats, rank: '4' } },
      'stats.rank must be an integer number',
    ],
    [
      'rank 4.5',
      { ...base, stats: { ...base.stats, rank: 4.5 } },
      'stats.rank must be an integer number',
    ],
    [
      'negative points',
      { ...base, stats: { ...base.stats, points: -1 } },
      'stats.points must not be less than 0',
    ],
    [
      'weight in grams',
      { ...base, stats: { ...base.stats, weightKg: 77500 } },
      'stats.weightKg must not be greater than 200',
    ],
    [
      'height 300 cm',
      { ...base, stats: { ...base.stats, heightCm: 300 } },
      'stats.heightCm must not be greater than 250',
    ],
    ['age 5', { ...base, stats: { ...base.stats, age: 5 } }, 'stats.age must not be less than 10'],
    [
      'match result 3',
      { ...base, stats: { ...base.stats, lastResults: [1, 3] } },
      'stats.lastResults must only contain 1 (win) or 0 (loss)',
    ],
    [
      '6 match results',
      { ...base, stats: { ...base.stats, lastResults: [1, 1, 1, 1, 1, 1] } },
      'stats.lastResults must contain no more than 5 elements',
    ],
    [
      'lastResults not an array',
      { ...base, stats: { ...base.stats, lastResults: '11011' } },
      'stats.lastResults must be an array',
    ],
  ];
  for (const [name, body, detail] of cases) {
    const r = await http('POST', '/players', { body, headers: key });
    check(
      `${name} → 400 "${detail}"`,
      isUniformError(r, 400) &&
        r.json.message === 'Validation failed' &&
        r.json.details?.includes(detail),
      JSON.stringify(r.json?.details ?? r.json),
    );
  }
  const array = await http('POST', '/players', { body: [validPlayer()], headers: key });
  check('JSON array instead of an object → 400', isUniformError(array, 400));
  const malformed = await http('POST', '/players', {
    raw: '{ not json',
    headers: { ...key, 'content-type': 'application/json' },
  });
  check('malformed JSON → 400 uniform error', isUniformError(malformed, 400));
  const textPlain = await http('POST', '/players', {
    raw: JSON.stringify(validPlayer()),
    headers: { ...key, 'content-type': 'text/plain' },
  });
  check('non-JSON content type → 400 (body not parsed)', isUniformError(textPlain, 400));
  const after = await http('GET', '/players');
  check(
    `nothing was created by the rejected requests (still ${countBefore})`,
    after.json?.length === countBefore,
    `${after.json?.length}`,
  );
}

// ---------------------------------------------------------------------------
if (ALLOW_WRITES) {
  group('Task 4 — POST /players: creation');
  const key = { 'x-api-key': API_KEY };
  const created = await http('POST', '/players', { body: validPlayer(), headers: key });
  const location = created.headers.get('location');
  check(
    'valid player → 201 JSON',
    created.status === 201 && /json/.test(created.headers.get('content-type') ?? ''),
  );
  check(
    'Location header points to the new player',
    location === `/api/v1/players/${created.json?.id}`,
    location,
  );
  check(
    'body = request + server-assigned id',
    same(created.json, { id: created.json?.id, ...validPlayer() }),
  );
  check('new id is above every existing id', created.json?.id > Math.max(...ids(players)));
  const fetched = await http('GET', `${ROOT}${location}`);
  check(
    'GET Location → 200, same resource',
    fetched.status === 200 && same(fetched.json, created.json),
  );
  const newList = (await http('GET', '/players')).json ?? [];
  check(
    'appears in the list, still sorted by rank',
    newList.length === countBefore + 1 &&
      sortedByRank(newList) &&
      ids(newList).includes(created.json?.id),
  );
  const filtered = await http('GET', '/players?country=ita&sex=m');
  check('found by the country + sex filters', ids(filtered.json ?? []).includes(created.json?.id));
  const stats = await http('GET', '/stats');
  check(
    'statistics include the new player',
    same(stats.json, expectedStats(newList)),
    JSON.stringify(stats.json),
  );
  const normalised = await http('POST', '/players', {
    body: {
      ...validPlayer(),
      firstName: '  Jannik ',
      sex: 'm',
      country: { ...validPlayer().country, code: 'ita' },
    },
    headers: key,
  });
  check(
    'case-insensitive fields normalised (sex m, country ita, trimmed name)',
    normalised.status === 201 &&
      normalised.json.sex === 'M' &&
      normalised.json.country.code === 'ITA' &&
      normalised.json.firstName === 'Jannik',
  );
  check('successive creations get increasing ids', normalised.json?.id > created.json?.id);
  const noMatches = await http('POST', '/players', {
    body: { ...validPlayer(), stats: { ...validPlayer().stats, lastResults: [] } },
    headers: key,
  });
  check('player without any recorded match → 201', noMatches.status === 201);
  const concurrent = await Promise.all(
    Array.from({ length: 10 }, () =>
      http('POST', '/players', { body: validPlayer(), headers: key }),
    ),
  );
  const concurrentIds = concurrent.map((c) => c.json?.id);
  check(
    '10 concurrent creations → 10 × 201 with unique ids',
    concurrent.every((c) => c.status === 201) && new Set(concurrentIds).size === 10,
    JSON.stringify(concurrentIds),
  );
  const finalList = (await http('GET', '/players')).json ?? [];
  check(
    'final list: +13 players, sorted, stats consistent',
    finalList.length === countBefore + 13 &&
      sortedByRank(finalList) &&
      same((await http('GET', '/stats')).json, expectedStats(finalList)),
  );
}

// ---------------------------------------------------------------------------
group('Robustness');
{
  const burst = await Promise.all(Array.from({ length: 30 }, () => http('GET', '/players/52')));
  check(
    '30 concurrent reads → all 200 and identical',
    burst.every((b) => b.status === 200 && same(b.json, burst[0].json)),
  );
  const big = await http('POST', '/players', {
    raw: JSON.stringify({ firstName: 'x'.repeat(200_000) }),
    headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
  });
  check(
    'oversized body (>100 kB) rejected with a uniform 4xx',
    big.status === 413 && isUniformError(big, 413),
    `${big.status}`,
  );
}

// ---------------------------------------------------------------------------
let current = '';
for (const r of results) {
  if (r.section !== current) {
    current = r.section;
    console.log(`\n## ${current}`);
  }
  console.log(`${r.ok ? '  ✔' : '  ✘'} ${r.name}${r.ok ? '' : `\n      → ${r.detail}`}`);
}
const failed = results.filter((r) => !r.ok).length;
const sorted = [...latencies].sort((a, b) => a - b);
const pct = (p) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))].toFixed(0);
console.log(
  `\n${results.length - failed}/${results.length} checks passed, ${failed} failed — ${latencies.length} requests, latency p50 ${pct(50)} ms, p95 ${pct(95)} ms, max ${pct(100)} ms`,
);
process.exitCode = failed ? 1 : 0;
