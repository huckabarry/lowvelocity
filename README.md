# Low Velocity theme

The Ghost theme for **[lowvelocity.org](https://lowvelocity.org)**: long-form writing on urbanism and photography. It's built from Ghost's official [Dawn](https://github.com/TryGhost/Dawn) theme, restyled with a look inspired by the Cactus theme, and heavily customized since.

## What's in it

- **Sections**: Home, Urbanism (`/urbanism/`), Field Notes (`/field-notes/`), Gallery (`/gallery/`, a masonry photo grid with a lightbox) and an all-posts archive (`/posts/`). The `routes.yaml` file defines them by tag.
- **Feeds**: RSS at `/rss/` (each item starts with the post's feature image) and JSON Feed 1.1 at `/feed.json/`. Both leave out the old imported post types.
- **Bluesky replies**: when the [sync Worker](https://github.com/huckabarry/lowvelocity-sync) announces an essay on Bluesky, it adds a `lowvelocity:bluesky-post` meta tag to the post. The theme then shows that Bluesky thread's replies under the essay (`assets/js/main.js`).
- **Now / Updates pages**: these show recent Bluesky posts from the Worker's `/updates/bluesky` endpoint.
- **Design settings** (Ghost → Settings → Design): light and dark colors, accent color, content width, fonts, related posts.

The Worker also handles the standard.site records and the `/.well-known/site.standard.publication` file. Nothing in this repo does that.

## Tags

Since November 2026 a post's **first tag** decides its section, and each post is in one section:

| Tag | Section | Page | Feeds |
| --- | --- | --- | --- |
| Urbanism | Urbanism | `/urbanism/` | `/urbanism/rss/`, `/urbanism/feed.json/` |
| Field Notes | Field Notes | `/field-notes/` | `/field-notes/rss/`, `/field-notes/feed.json/` |
| Photography | Latest Photos | `/gallery/` (any post tagged Photography) | `/gallery/rss/`, `/gallery/feed.json/` |

**Books** is a topic tag, never first. Each tag's description (Ghost → Tags) is the subtitle under its section. The site-wide feeds are `/rss/` and `/feed.json/`. Internal tags the sync Worker reads: `#no-bluesky` (don't announce on Bluesky) and `#label-*` (content labels).

## Deploying

Merging into `main` deploys automatically (`.github/workflows/deploy-theme.yml`):

1. Checks the theme with `gscan`.
2. Builds the zip, then uploads and activates it in Ghost.
3. Uploads `routes.yaml`. This step needs a **staff user's** token, because Ghost doesn't let integration keys change routes. If the upload is rejected, the run fails with an error.

GitHub Actions secrets: `GHOST_ADMIN_URL`, `GHOST_ADMIN_API_KEY` (integration key, for the theme), and `GHOST_STAFF_ACCESS_TOKEN` (staff token, for the routes). If the staff user who owns that token is suspended, routes stop deploying.

## Working locally

Requires Node 22 (`.nvmrc`).

```sh
npm ci
npm run dev    # rebuild CSS/JS on change (assets/css, assets/js → assets/built)
npm test       # gscan theme check
npm run zip    # dist/cactus-lowvelocity.zip, for a manual upload
```

Commit `assets/built/` along with your source changes, because Ghost serves the built files.

## Leftovers

These are kept for now but aren't used on the live site:

- Check-in and `#bluesky` post templates (map card, per-post Bluesky thread) from the old importers. Those posts were deleted in November 2026.
- `partials/home-shelved.hbs`: an old homepage block that nothing includes anymore.
- `.github/workflows/test-ghost-activitypub-identities.yml`: a manual test for the ActivityPub experiment.

## License

Built from [Dawn](https://github.com/TryGhost/Dawn) by the Ghost Foundation, released under the [MIT license](LICENSE). The "cactus" in file and class names comes from the design that inspired the look.
