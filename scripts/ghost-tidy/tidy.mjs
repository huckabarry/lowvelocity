// One-off tidy-up of Low Velocity's Ghost tags (November 2026).
//
//   node scripts/ghost-tidy/tidy.mjs            dry run: prints every change, writes nothing
//   node scripts/ghost-tidy/tidy.mjs --apply    makes the changes
//
// Needs GHOST_ADMIN_URL and GHOST_ADMIN_API_KEY (an integration's id:secret Admin API key).
// Before changing anything, --apply saves the current posts, pages and tags to ./ghost-tidy-backup/.
//
// What it does:
//   1. Section tags: every post gets exactly one first tag, from tag-plan.json:
//      Urbanism, Field Notes or Photography.
//   2. Photo-heavy posts in other sections keep Photography as a later tag (so /gallery/ still has them);
//      book posts keep Books as a later tag.
//   3. Retired tags are removed from posts, then deleted once empty: Gallery, #gallery, Now, Housing,
//      Transportation, Public Finance, Book Reviews, updates, #field-notes, #waypoints, #section-*,
//      #bluesky, #atproto.
//   4. The 4 imported Bluesky posts (tagged #bluesky, listed in tag-plan.json) are deleted.
//   5. The Updates page is unpublished (set back to draft).
//   6. Tag names and descriptions are set, and the About page body is replaced with about.html.
// Tags not in the retired list (for example #no-bluesky or #label-*) are kept as they are.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const ghostUrl = (process.env.GHOST_ADMIN_URL || '').replace(/\/$/, '');
const adminKey = process.env.GHOST_ADMIN_API_KEY || '';
if (!ghostUrl || !adminKey.includes(':')) {
  console.error('Set GHOST_ADMIN_URL and GHOST_ADMIN_API_KEY (id:secret).');
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(path.join(here, 'tag-plan.json'), 'utf8'));
const aboutHtml = fs.readFileSync(path.join(here, 'about.html'), 'utf8');

const SECTIONS = {
  urbanism: { name: 'Urbanism', description: 'Essays on planning, housing, transportation, and how cities pay for themselves.' },
  'field-notes': { name: 'Field Notes', description: 'Trips, outings, and notes from being out in the world.' },
  photography: { name: 'Photography', description: 'Photographs of cities, landscapes, and the places in between.' },
};
const BOOKS = { slug: 'books', name: 'Books', description: 'Books about cities and the people who shape them.' };
const PHOTO_SIGNS = new Set(['photography', 'gallery', 'hash-gallery']);
const BOOK_SIGNS = new Set(['books', 'book-reviews']);
const RETIRED = new Set([
  'gallery', 'hash-gallery', 'now', 'housing', 'transportation', 'public-finance', 'book-reviews', 'updates',
  'hash-field-notes', 'hash-waypoints', 'hash-bluesky', 'hash-atproto',
  'hash-section-blog', 'hash-section-books', 'hash-section-custom-posts', 'hash-section-hero',
]);
// Everything the script decides itself; any other tag on a post is carried over untouched.
const MANAGED = new Set([...RETIRED, ...Object.keys(SECTIONS), BOOKS.slug]);

function token() {
  const [id, secret] = adminKey.split(':');
  const now = Math.floor(Date.now() / 1000);
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const body = `${enc({ alg: 'HS256', typ: 'JWT', kid: id })}.${enc({ iat: now, exp: now + 300, aud: '/admin/' })}`;
  return `${body}.${crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(body).digest('base64url')}`;
}

async function api(method, route, body) {
  const res = await fetch(`${ghostUrl}/ghost/api/admin/${route}`, {
    method,
    headers: { Authorization: `Ghost ${token()}`, 'Accept-Version': 'v6.0', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'DELETE' && res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} → HTTP ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function all(resource, query) {
  const out = [];
  for (let page = 1; ; page++) {
    const data = await api('GET', `${resource}/?limit=100&page=${page}&${query}`);
    out.push(...data[resource]);
    if (!data.meta?.pagination?.next) return out;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const names = (tags) => tags.map((t) => t.name).join(', ') || '(none)';

const posts = await all('posts', 'include=tags&filter=status:[published,draft,scheduled]&formats=lexical');
const tags = await all('tags', 'include=count.posts&filter=visibility:[public,internal]');
const pages = await all('pages', 'filter=slug:[about,updates]&formats=lexical');
const tagBySlug = new Map(tags.map((t) => [t.slug, t]));
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${posts.length} posts, ${tags.length} tags, ${ghostUrl}\n`);

// Where each post goes.
const sectionOf = new Map();
for (const slug of Object.keys(SECTIONS)) for (const postSlug of plan[slug] || []) sectionOf.set(postSlug, slug);
const toDelete = new Set(plan.delete || []);

// Safety checks before anything else.
const problems = [];
for (const slug of [...sectionOf.keys(), ...toDelete]) {
  if (!posts.some((p) => p.slug === slug)) problems.push(`planned post not found: ${slug}`);
}
for (const slug of toDelete) {
  const post = posts.find((p) => p.slug === slug);
  if (post && !post.tags.some((t) => t.slug === 'hash-bluesky')) problems.push(`refusing to delete a post without #bluesky: ${slug}`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

if (APPLY) {
  fs.mkdirSync('ghost-tidy-backup', { recursive: true });
  for (const [file, data] of [['posts.json', posts], ['tags.json', tags], ['pages.json', pages]]) {
    fs.writeFileSync(path.join('ghost-tidy-backup', file), JSON.stringify(data, null, 2));
  }
  console.log('Backup saved to ghost-tidy-backup/\n');
}

// 1. Tag names and descriptions (creates a section tag if it doesn't exist yet).
console.log('== Tags: names and descriptions');
for (const [slug, want] of [...Object.entries(SECTIONS), [BOOKS.slug, BOOKS]]) {
  const have = tagBySlug.get(slug);
  if (!have) {
    console.log(`  create ${want.name}: "${want.description}"`);
    if (APPLY) tagBySlug.set(slug, (await api('POST', 'tags/', { tags: [{ name: want.name, slug, description: want.description }] })).tags[0]);
    continue;
  }
  if (have.name === want.name && have.description === want.description) {
    console.log(`  ${want.name}: already set`);
    continue;
  }
  console.log(`  ${have.name} → ${want.name}: "${want.description}"`);
  if (APPLY) tagBySlug.set(slug, (await api('PUT', `tags/${have.id}/`, { tags: [{ name: want.name, description: want.description, updated_at: have.updated_at }] })).tags[0]);
}

// 2. Post tags.
console.log('\n== Posts: tags (first tag = section)');
let edits = 0;
const unplanned = [];
for (const post of posts) {
  if (toDelete.has(post.slug)) continue;
  const section = sectionOf.get(post.slug);
  if (!section) {
    unplanned.push(post);
    continue;
  }
  const old = post.tags.map((t) => t.slug);
  const next = [section];
  if (section !== 'photography' && old.some((s) => PHOTO_SIGNS.has(s))) next.push('photography');
  if (old.some((s) => BOOK_SIGNS.has(s))) next.push(BOOKS.slug);
  for (const s of old) if (!MANAGED.has(s) && !next.includes(s)) next.push(s);
  if (next.join(',') === old.join(',')) continue;
  edits++;
  const display = next.map((s) => (s === BOOKS.slug ? BOOKS.name : SECTIONS[s]?.name || tagBySlug.get(s)?.name || s));
  console.log(`  ${post.title.slice(0, 48).padEnd(48)} ${names(post.tags)}  →  ${display.join(', ')}`);
  if (APPLY) {
    await api('PUT', `posts/${post.id}/`, { posts: [{ tags: next.map((s) => ({ id: tagBySlug.get(s).id })), updated_at: post.updated_at }] });
    await sleep(2000); // pace the webhook → sync Worker → standard.site updates
  }
}
console.log(`  ${edits} posts to change.`);
if (unplanned.length) console.log(`  Not in the plan, left alone: ${unplanned.map((p) => `${p.title} [${p.status}]`).join('; ')}`);

// 3. Delete the imported Bluesky posts.
console.log('\n== Posts: delete imported Bluesky posts');
for (const post of posts.filter((p) => toDelete.has(p.slug))) {
  console.log(`  delete "${post.title.slice(0, 70)}" (${post.slug})`);
  if (APPLY) {
    await api('DELETE', `posts/${post.id}/`);
    await sleep(1000);
  }
}

// 4. Unpublish the Updates page.
console.log('\n== Pages');
const updates = pages.find((p) => p.slug === 'updates');
if (updates?.status === 'published') {
  console.log('  Updates page: published → draft');
  if (APPLY) await api('PUT', `pages/${updates.id}/`, { pages: [{ status: 'draft', updated_at: updates.updated_at }] });
} else {
  console.log(`  Updates page: ${updates ? updates.status : 'not found'}, nothing to do`);
}

// 5. About page body.
const about = pages.find((p) => p.slug === 'about');
if (!about) {
  console.log('  About page not found, skipped');
} else {
  console.log(`  About page: replace the body with about.html (${aboutHtml.length} characters of HTML)`);
  if (APPLY) await api('PUT', `pages/${about.id}/?source=html`, { pages: [{ html: aboutHtml, updated_at: about.updated_at }] });
}

// 6. Delete retired tags once nothing uses them.
console.log('\n== Tags: delete retired tags');
const fresh = APPLY ? await all('tags', 'include=count.posts&filter=visibility:[public,internal]') : tags;
for (const tag of fresh.filter((t) => RETIRED.has(t.slug))) {
  // In a dry run the counts are from before the changes; every retired tag is removed from every post above.
  const stillUsed = APPLY ? tag.count.posts : 0;
  if (stillUsed > 0) {
    console.log(`  keep ${tag.name}: still on ${stillUsed} posts (check by hand)`);
    continue;
  }
  console.log(`  delete ${tag.name} (${tag.slug}, was on ${tags.find((t) => t.id === tag.id)?.count.posts ?? 0} posts)`);
  if (APPLY) await api('DELETE', `tags/${tag.id}/`);
}

console.log(`\n${APPLY ? 'Done.' : 'Dry run only. Nothing was changed.'}`);
