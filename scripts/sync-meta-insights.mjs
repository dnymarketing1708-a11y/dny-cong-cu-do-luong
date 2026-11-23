import { mkdir, writeFile } from 'node:fs/promises';

const token = process.env.META_ACCESS_TOKEN;
const pageId = process.env.META_PAGE_ID;
const rawAccountId = process.env.META_AD_ACCOUNT_ID;
const version = process.env.META_GRAPH_API_VERSION || 'v25.0';
const days = Math.max(1, Math.min(90, Number(process.env.META_DAYS || 14)));
const pageMetrics = (process.env.META_PAGE_METRICS || 'page_impressions,page_post_engagements,page_follows')
  .split(',').map(value => value.trim()).filter(Boolean);

if (!token || !pageId || !rawAccountId) {
  throw new Error('Missing META_ACCESS_TOKEN, META_PAGE_ID, or META_AD_ACCOUNT_ID secret.');
}

const accountId = rawAccountId.startsWith('act_') ? rawAccountId : `act_${rawAccountId}`;
const zonedDate = (offsetDays) => {
  const date = new Date(Date.now() - offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((result, part) => ({...result, [part.type]: part.value}), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const since = zonedDate(days);
const until = zonedDate(1);

async function graph(path, params) {
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}});
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || `Meta API returned ${response.status}`);
  return body;
}

async function allPages(path, params) {
  const first = await graph(path, params);
  const rows = [...(first.data || [])];
  let next = first.paging?.next;
  while (next) {
    const response = await fetch(next, {headers: {Authorization: `Bearer ${token}`}});
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || `Meta pagination returned ${response.status}`);
    rows.push(...(body.data || []));
    next = body.paging?.next;
  }
  return rows;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const [pageRows, adsRows] = await Promise.all([
  allPages(`${pageId}/insights`, {metric: pageMetrics.join(','), period: 'day', since, until}),
  allPages(`${accountId}/insights`, {
    fields: 'date_start,date_stop,spend,impressions,reach,clicks,inline_link_clicks,actions',
    level: 'account', time_increment: '1', time_range: JSON.stringify({since, until}), limit: '100'
  })
]);

const page = Object.fromEntries(pageRows.map(row => [row.name, {
  title: row.title || row.name,
  values: (row.values || []).map(({end_time, value}) => ({date: end_time.slice(0, 10), value: number(value)}))
}]));
const ads = adsRows.map(row => ({
  date: row.date_start,
  spend: number(row.spend), impressions: number(row.impressions), reach: number(row.reach),
  clicks: number(row.clicks), linkClicks: number(row.inline_link_clicks),
  actions: Object.fromEntries((row.actions || []).map(item => [item.action_type, number(item.value)]))
}));
const output = {
  schemaVersion: 1,
  source: 'Meta Graph API + Marketing API',
  updatedAt: new Date().toISOString(), timezone: 'Asia/Ho_Chi_Minh',
  period: {since, until}, page, ads
};

await mkdir('data', {recursive: true});
await writeFile('data/meta-insights.json', `${JSON.stringify(output, null, 2)}\n`);
