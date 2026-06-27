(function () {
    'use strict';

    var root = document.documentElement;
    var storedTheme = localStorage.getItem('cactus-theme');
    var preferredTheme = root.getAttribute('data-theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

    root.setAttribute('data-theme', storedTheme || preferredTheme);

    document.addEventListener('DOMContentLoaded', function () {
        initThemeToggle();
        initMenuToggle();
        initSearchBackdrop();
        initClientNavigation();
        initPageFeatures(false);
    });

    function initPageFeatures(isClientNavigation) {
        syncGhostCommentsTheme();
        initGhostCommentsFrame();
        initListeningPreviewPlayers();
        initBlueskyNotes();
        initPhotoFeed();
        initGhostGalleryMasonry();
        if (isClientNavigation) initGhostCardEnhancements();
    }

    var activeListeningPreview = null;
    var activeListeningButton = null;

    function pauseActiveListeningPreview() {
        if (activeListeningPreview) {
            activeListeningPreview.pause();
            activeListeningPreview.currentTime = 0;
        }

        if (activeListeningButton) {
            activeListeningButton.removeAttribute('data-listening-playing');
        }

        activeListeningPreview = null;
        activeListeningButton = null;
    }

    function findListeningPreviewUrl(container) {
        var source = container.querySelector('[data-listening-preview-source]');
        if (!source) return '';

        var link = source.querySelector('a[href*="audio-ssl.itunes.apple.com"], a[href*=".m4a"], a[href*=".mp3"]');
        if (!link) return '';

        try {
            var url = new URL(link.href, window.location.href);
            url.searchParams.delete('ref');
            return url.toString();
        } catch (error) {
            return link.href;
        }
    }

    function initListeningPreviewPlayers() {
        document.querySelectorAll('[data-listening-preview]:not([data-listening-preview-ready])').forEach(function (container) {
            container.setAttribute('data-listening-preview-ready', 'true');

            var button = container.querySelector('[data-listening-preview-toggle]');
            if (!button) return;

            var previewUrl = findListeningPreviewUrl(container);
            if (!previewUrl) {
                button.disabled = true;
                button.setAttribute('aria-label', 'Preview unavailable');
                return;
            }

            var audio = new Audio(previewUrl);
            audio.preload = 'none';

            function setPausedState() {
                if (activeListeningPreview === audio) {
                    activeListeningPreview = null;
                    activeListeningButton = null;
                }

                button.removeAttribute('data-listening-playing');
                button.setAttribute('aria-label', button.getAttribute('data-play-label') || 'Play preview');
            }

            button.setAttribute('data-play-label', button.getAttribute('aria-label') || 'Play preview');

            audio.addEventListener('pause', setPausedState);
            audio.addEventListener('ended', setPausedState);

            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                if (activeListeningPreview === audio && !audio.paused) {
                    pauseActiveListeningPreview();
                    return;
                }

                pauseActiveListeningPreview();

                audio.play().then(function () {
                    activeListeningPreview = audio;
                    activeListeningButton = button;
                    button.setAttribute('data-listening-playing', 'true');
                    button.setAttribute('aria-label', 'Pause preview');
                }).catch(function () {
                    setPausedState();
                });
            });
        });
    }

    var ghostGalleryResizeBound = false;

    function initGhostGalleryMasonry() {
        if (typeof Masonry === 'undefined') return;

        document.querySelectorAll('.cactus-content .kg-gallery-card:not([data-ghost-gallery-ready])').forEach(function (card) {
            if (card.hasAttribute('data-ghost-gallery-ready')) return;

            var galleryCards = [card];
            var nextCard = card.nextElementSibling;

            while (nextCard && nextCard.matches('.kg-gallery-card:not([data-ghost-gallery-ready])')) {
                galleryCards.push(nextCard);
                nextCard = nextCard.nextElementSibling;
            }

            var container = card.querySelector('.kg-gallery-container');
            if (!container) return;

            var images = [];
            var galleryItems = [];

            galleryCards.forEach(function (galleryCard) {
                var galleryImages = Array.prototype.slice.call(galleryCard.querySelectorAll('.kg-gallery-image'));
                var caption = galleryCard.querySelector(':scope > figcaption');

                images = images.concat(galleryImages);
                galleryItems = galleryItems.concat(galleryImages);

                if (caption) {
                    caption.classList.add('ghost-gallery-caption');
                    galleryItems.push(caption);
                }

                galleryCard.setAttribute('data-ghost-gallery-ready', 'true');
            });

            if (!images.length) return;

            card.classList.add('ghost-gallery-card');
            if (galleryCards.length > 1) card.classList.add('ghost-gallery-run');

            var sizer = document.createElement('div');
            sizer.className = 'kg-gallery-sizer';
            container.replaceChildren(sizer);

            galleryItems.forEach(function (item) {
                container.appendChild(item);
            });

            galleryCards.slice(1).forEach(function (galleryCard) {
                galleryCard.remove();
            });

            var masonry = new Masonry(container, {
                itemSelector: '.kg-gallery-image, .ghost-gallery-caption',
                columnWidth: '.kg-gallery-sizer',
                percentPosition: true,
                transitionDuration: 0,
            });
            card._ghostGalleryMasonry = masonry;

            function relayout() {
                if (!document.documentElement.contains(container)) return;
                masonry.layout();
                card.classList.add('initialized');
            }

            var relayoutAfterImage = throttle(relayout, 80);

            images.forEach(function (image) {
                var img = image.querySelector('img');
                if (!img || img.complete) return;
                img.addEventListener('load', relayoutAfterImage, {once: true});
                img.addEventListener('error', relayoutAfterImage, {once: true});
            });

            masonry.on('layoutComplete', function () {
                card.classList.add('initialized');
            });

            relayout();
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(relayout);
            });
            window.setTimeout(relayout, 400);
        });

        if (!ghostGalleryResizeBound) {
            ghostGalleryResizeBound = true;
            window.addEventListener('resize', throttle(relayoutGhostGalleryCards, 120));
        }
    }

    function relayoutGhostGalleryCards() {
        document.querySelectorAll('.cactus-content .kg-gallery-card[data-ghost-gallery-ready]').forEach(function (card) {
            var masonry = card._ghostGalleryMasonry;
            if (!masonry) return;
            masonry.reloadItems();
            masonry.layout();
        });
    }

    function throttle(fn, wait) {
        var timeout = null;
        var last = 0;

        return function () {
            var now = Date.now();
            var remaining = wait - (now - last);
            var context = this;
            var args = arguments;

            if (remaining <= 0) {
                last = now;
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                fn.apply(context, args);
                return;
            }

            if (!timeout) {
                timeout = setTimeout(function () {
                    last = Date.now();
                    timeout = null;
                    fn.apply(context, args);
                }, remaining);
            }
        };
    }

    function initGhostCardEnhancements() {
        if (typeof lightbox === 'function') {
            lightbox('.kg-image-card > .kg-image[width][height], .kg-gallery-image > img');
        }

        if (typeof reframe === 'function') {
            var sources = [
                '.cactus-content iframe[src*="youtube.com"]',
                '.cactus-content iframe[src*="youtube-nocookie.com"]',
                '.cactus-content iframe[src*="player.vimeo.com"]',
                '.cactus-content iframe[src*="kickstarter.com"][src*="video.html"]',
                '.cactus-content object',
                '.cactus-content embed',
            ];
            reframe(document.querySelectorAll(sources.join(',')));
        }
    }

    function initThemeToggle() {
        var toggle = document.querySelector('[data-theme-toggle]');
        if (!toggle) return;

        toggle.addEventListener('click', function () {
            var nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', nextTheme);
            localStorage.setItem('cactus-theme', nextTheme);
            syncGhostCommentsTheme();
        });
    }

    function syncGhostCommentsTheme() {
        var colorScheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

        document.querySelectorAll('script[data-ghost-comments]').forEach(function (script) {
            script.setAttribute('data-color-scheme', colorScheme);
        });
    }

    var ghostCommentsObserver = null;

    function initGhostCommentsFrame() {
        var commentsRoot = document.getElementById('ghost-comments-root') || document.querySelector('.cactus-comments');
        if (ghostCommentsObserver) ghostCommentsObserver.disconnect();
        if (!commentsRoot || typeof MutationObserver === 'undefined') return;

        var preparedFrames = [];

        function prepareCommentsFrame() {
            commentsRoot.querySelectorAll('iframe').forEach(function (frame) {
                if (preparedFrames.indexOf(frame) !== -1) return;

                preparedFrames.push(frame);
                frame.style.setProperty('background', 'transparent', 'important');
                frame.style.colorScheme = 'normal';

                function makeFrameCanvasTransparent() {
                    try {
                        var frameDocument = frame.contentDocument;
                        if (!frameDocument) return;

                        frameDocument.documentElement.style.setProperty('background', 'transparent', 'important');
                        frameDocument.documentElement.style.setProperty('color-scheme', 'normal', 'important');
                        if (frameDocument.body) {
                            frameDocument.body.style.setProperty('background', 'transparent', 'important');
                            frameDocument.body.style.setProperty('color-scheme', 'normal', 'important');
                        }
                    } catch (error) {
                        // Ghost comments can be rendered inside a protected iframe.
                        // Keep outer-frame styles even when inner access is blocked.
                    }
                }

                frame.addEventListener('load', makeFrameCanvasTransparent);
                makeFrameCanvasTransparent();
                window.setTimeout(makeFrameCanvasTransparent, 250);
                window.setTimeout(makeFrameCanvasTransparent, 1000);
            });
        }

        ghostCommentsObserver = new MutationObserver(prepareCommentsFrame);
        ghostCommentsObserver.observe(commentsRoot, {
            childList: true,
            subtree: true,
        });

        prepareCommentsFrame();
    }

    function initBlueskyNotes() {
        var section = document.querySelector('[data-bluesky-feed]');
        if (!section) return;

        var carousel = section.querySelector('[data-status-carousel]');
        var handle = section.getAttribute('data-bluesky-handle');
        var endpoint = section.getAttribute('data-bluesky-endpoint') || 'https://sync.lowvelocity.org/updates/bluesky';
        var limit = parseInt(section.getAttribute('data-bluesky-limit'), 10) || 5;
        if (!carousel) return;

        fetch(endpoint)
            .then(function (response) {
                if (!response.ok) throw new Error('Cached Bluesky feed request failed');
                return response.json();
            })
            .then(function (data) {
                var posts = (data.items || []).slice(0, limit);

                if (!posts.length) throw new Error('Bluesky feed is empty');

                carousel.replaceChildren();
                posts.forEach(function (post) {
                    carousel.appendChild(createStatusUpdate(post));
                });
                initStatusCarousel(section, posts.length);
            })
            .catch(function () {
                var status = carousel.querySelector('.bluesky-note-status');
                if (status) status.textContent = 'Updates are temporarily unavailable.';
            });
    }

    function createStatusUpdate(post) {
        var article = document.createElement('article');
        var avatar = document.createElement('img');
        var body = document.createElement('div');
        var meta = document.createElement('div');
        var author = document.createElement('a');
        var text = document.createElement('p');
        var permalink = document.createElement('a');
        var time = document.createElement('time');
        var authorData = post.author || {};
        var postKey = String(post.uri || '').split('/').pop();
        var postUrl = post.url || 'https://bsky.app/profile/' + encodeURIComponent(authorData.handle || '') + '/post/' + encodeURIComponent(postKey);
        var createdAt = post.createdAt;

        article.className = 'status-update';
        article.hidden = true;
        avatar.className = 'status-avatar';
        avatar.src = authorData.avatar || '';
        avatar.alt = '';
        avatar.loading = 'lazy';
        body.className = 'status-update-body';
        meta.className = 'status-meta';
        author.className = 'status-author';
        author.href = 'https://bsky.app/profile/' + encodeURIComponent(authorData.handle || '');
        author.target = '_blank';
        author.rel = 'noopener noreferrer';
        author.textContent = authorData.displayName || '@' + authorData.handle;
        text.className = 'status-text';
        permalink.className = 'status-time-link';
        permalink.href = postUrl;
        permalink.target = '_blank';
        permalink.rel = 'noopener noreferrer';
        time.dateTime = createdAt;
        if (createdAt) {
            time.textContent = new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(new Date(createdAt));
        }

        permalink.appendChild(time);
        meta.appendChild(author);
        meta.appendChild(permalink);
        appendLinkedPlainText(text, post.text || '');
        if (!text.textContent) {
            var emptyPostLink = document.createElement('a');
            emptyPostLink.href = postUrl;
            emptyPostLink.target = '_blank';
            emptyPostLink.rel = 'noopener noreferrer';
            emptyPostLink.textContent = 'View this post on Bluesky';
            text.appendChild(emptyPostLink);
        }
        body.appendChild(meta);
        body.appendChild(text);
        appendStatusEmbeds(body, post.embeds || [], postUrl);
        appendStatusActions(body, post, postUrl);
        article.appendChild(avatar);
        article.appendChild(body);
        return article;
    }

    function appendLinkedPlainText(container, value) {
        var text = String(value || '');
        if (!text) return;

        var pattern = /(https?:\/\/[^\s<]+|(?:^|[\s(])#([\p{L}\p{N}_-]+))/gu;
        var cursor = 0;
        var match;

        while ((match = pattern.exec(text))) {
            var matched = match[0];
            var start = match.index;
            var end = start + matched.length;
            var leading = '';

            if (matched.charAt(0) !== 'h' && matched.charAt(0) !== '#') {
                leading = matched.charAt(0);
                start += 1;
                matched = matched.slice(1);
            }

            container.appendChild(document.createTextNode(text.slice(cursor, start)));
            if (leading) container.appendChild(document.createTextNode(leading));

            var link = document.createElement('a');
            if (matched.charAt(0) === '#') {
                link.href = 'https://bsky.app/hashtag/' + encodeURIComponent(matched.slice(1));
            } else {
                link.href = matched.replace(/[),.;:!?]+$/, '');
                var trailing = matched.slice(link.href.length);
                link.textContent = link.href;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                container.appendChild(link);
                if (trailing) container.appendChild(document.createTextNode(trailing));
                cursor = end;
                continue;
            }
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = matched;
            container.appendChild(link);
            cursor = end;
        }

        container.appendChild(document.createTextNode(text.slice(cursor)));
    }

    function appendRichText(container, value, facets) {
        var text = String(value || '');
        if (!text) return;

        if (!facets.length || typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {
            container.textContent = text;
            return;
        }

        var encoder = new TextEncoder();
        var decoder = new TextDecoder();
        var bytes = encoder.encode(text);
        var cursor = 0;

        facets.slice().sort(function (left, right) {
            return left.index.byteStart - right.index.byteStart;
        }).forEach(function (facet) {
            var index = facet.index || {};
            var start = Number(index.byteStart);
            var end = Number(index.byteEnd);
            if (!Number.isFinite(start) || !Number.isFinite(end) || start < cursor || end <= start) return;

            container.appendChild(document.createTextNode(decoder.decode(bytes.slice(cursor, start))));

            var label = decoder.decode(bytes.slice(start, end));
            var feature = (facet.features || [])[0] || {};
            var href = '';
            if (feature.uri) href = feature.uri;
            else if (feature.did) href = 'https://bsky.app/profile/' + encodeURIComponent(feature.did);
            else if (feature.tag) href = 'https://bsky.app/hashtag/' + encodeURIComponent(feature.tag);

            if (href) {
                var link = document.createElement('a');
                link.href = href;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = label;
                container.appendChild(link);
            } else {
                container.appendChild(document.createTextNode(label));
            }
            cursor = end;
        });

        container.appendChild(document.createTextNode(decoder.decode(bytes.slice(cursor))));
    }

    function appendStatusEmbed(container, embed, postUrl) {
        if (!embed) return;

        var type = embed.$type || '';
        if (type.indexOf('recordWithMedia') !== -1 || (embed.record && embed.media)) {
            appendStatusEmbed(container, embed.media, postUrl);
            appendQuotedPost(container, embed.record && embed.record.record ? embed.record.record : embed.record);
            return;
        }

        if (type.indexOf('record#view') !== -1 || (embed.record && embed.record.author)) {
            appendQuotedPost(container, embed.record || embed);
            return;
        }

        var images = embed.images || embed.items || [];
        if (images.length) {
            appendStatusImages(container, images, postUrl);
            return;
        }

        if (embed.playlist || type.indexOf('video#view') !== -1) {
            appendStatusVideo(container, embed, postUrl);
            return;
        }

        var external = embed.external;
        if (external) {
            appendStatusExternal(container, external);
        }
    }

    function appendStatusEmbeds(container, embeds, postUrl) {
        var images = embeds.filter(function (embed) {
            return embed && embed.type === 'image';
        });
        if (images.length) appendStatusImages(container, images, postUrl);

        embeds.forEach(function (embed) {
            if (!embed || !embed.type) return;
            if (embed.type === 'image') return;
            if (embed.type === 'external') {
                appendStatusExternal(container, embed);
                return;
            }
            if (embed.type === 'quote') {
                appendNormalizedQuotedPost(container, embed);
            }
        });
    }

    function appendStatusImages(container, images, postUrl) {
        var gallery = document.createElement('div');
        gallery.className = 'status-media' + (images.length > 1 ? ' status-media-multiple' : '');

        images.forEach(function (image) {
            var anchor = document.createElement('a');
            var img = document.createElement('img');
            anchor.href = image.url || image.fullsize || image.thumb || image.thumbnail || postUrl;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            img.src = image.thumb || image.thumbnail || image.url || image.fullsize;
            img.alt = image.alt || '';
            img.loading = 'lazy';
            if (image.width && image.height) {
                img.style.aspectRatio = image.width + ' / ' + image.height;
            } else if (image.aspectRatio && image.aspectRatio.width && image.aspectRatio.height) {
                img.style.aspectRatio = image.aspectRatio.width + ' / ' + image.aspectRatio.height;
            }
            anchor.appendChild(img);
            gallery.appendChild(anchor);
        });
        container.appendChild(gallery);

        if (images.length > 1) {
            var note = document.createElement('p');
            note.className = 'status-media-note';
            note.textContent = images.length + ' images — swipe or scroll';
            container.appendChild(note);
        }
    }

    function appendStatusExternal(container, external) {
        if (!external || !external.uri) return;

        if (isAnimatedGifExternal(external)) {
            appendStatusAnimatedExternal(container, external);
            return;
        }

        var card = document.createElement('a');
        card.className = 'status-external';
        card.href = external.uri;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        if (external.thumb) {
            var thumbnail = document.createElement('img');
            thumbnail.className = 'status-external-thumb';
            thumbnail.src = external.thumb;
            thumbnail.alt = external.title || '';
            thumbnail.loading = 'lazy';
            card.appendChild(thumbnail);
        }

        var details = document.createElement('span');
        details.className = 'status-external-details';
        try {
            var domain = document.createElement('span');
            domain.className = 'status-external-domain';
            domain.textContent = new URL(external.uri).hostname.replace(/^www\./, '');
            details.appendChild(domain);
        } catch (error) {
            // The title still provides a useful card if the URI is unusual.
        }
        if (external.title) {
            var title = document.createElement('strong');
            title.textContent = external.title;
            details.appendChild(title);
        }
        if (external.description) {
            var description = document.createElement('span');
            description.className = 'status-external-description';
            description.textContent = external.description;
            details.appendChild(description);
        }
        card.appendChild(details);
        container.appendChild(card);
    }

    function isAnimatedGifExternal(external) {
        if (!external || !external.uri) return false;

        try {
            return new URL(external.uri).pathname.toLowerCase().endsWith('.gif');
        } catch (error) {
            return /\.gif(?:[?#]|$)/i.test(external.uri);
        }
    }

    function appendStatusAnimatedExternal(container, external) {
        var card = document.createElement('a');
        var image = document.createElement('img');
        var caption = document.createElement('span');

        card.className = 'status-external status-external-animated';
        card.href = external.uri;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        image.className = 'status-external-gif';
        image.src = external.uri;
        image.alt = external.description || external.title || '';
        image.loading = 'lazy';
        card.appendChild(image);

        if (external.title) {
            caption.className = 'status-external-gif-caption';
            caption.textContent = external.title;
            card.appendChild(caption);
        }

        container.appendChild(card);
    }

    function appendStatusVideo(container, video, postUrl) {
        var wrapper = document.createElement('div');
        var player = document.createElement('video');
        var link = document.createElement('a');
        wrapper.className = 'status-video';
        player.controls = true;
        player.playsInline = true;
        player.preload = 'metadata';
        player.src = video.playlist || '';
        if (video.thumbnail) player.poster = video.thumbnail;
        if (video.aspectRatio && video.aspectRatio.width && video.aspectRatio.height) {
            player.style.aspectRatio = video.aspectRatio.width + ' / ' + video.aspectRatio.height;
        }
        link.href = postUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = video.alt || 'Watch video on Bluesky';
        wrapper.appendChild(player);
        wrapper.appendChild(link);
        container.appendChild(wrapper);
    }

    function appendQuotedPost(container, quoted) {
        if (!quoted || !quoted.author || !quoted.value) return;

        var quote = document.createElement('div');
        var meta = document.createElement('a');
        var avatar = document.createElement('img');
        var byline = document.createElement('span');
        var name = document.createElement('strong');
        var handle = document.createElement('span');
        var text = document.createElement('p');
        var recordKey = String(quoted.uri || '').split('/').pop();
        var quoteUrl = 'https://bsky.app/profile/' + encodeURIComponent(quoted.author.handle) + '/post/' + encodeURIComponent(recordKey);

        quote.className = 'status-quote';
        meta.className = 'status-quote-meta';
        meta.href = quoteUrl;
        meta.target = '_blank';
        meta.rel = 'noopener noreferrer';
        avatar.src = quoted.author.avatar || '';
        avatar.alt = '';
        avatar.loading = 'lazy';
        name.textContent = quoted.author.displayName || quoted.author.handle;
        handle.textContent = '@' + quoted.author.handle;
        byline.appendChild(name);
        byline.appendChild(handle);
        if (quoted.author.avatar) meta.appendChild(avatar);
        meta.appendChild(byline);
        text.className = 'status-quote-text';
        appendRichText(text, quoted.value.text || '', quoted.value.facets || []);
        quote.appendChild(meta);
        if (text.textContent) quote.appendChild(text);

        (quoted.embeds || []).forEach(function (quotedEmbed) {
            appendStatusEmbed(quote, quotedEmbed, quoteUrl);
        });
        container.appendChild(quote);
    }

    function appendNormalizedQuotedPost(container, quoted) {
        if (!quoted || !quoted.author) return;

        var quote = document.createElement('div');
        var meta = document.createElement('a');
        var avatar = document.createElement('img');
        var byline = document.createElement('span');
        var name = document.createElement('strong');
        var handle = document.createElement('span');
        var text = document.createElement('p');
        var recordKey = String(quoted.uri || '').split('/').pop();
        var quoteUrl = 'https://bsky.app/profile/' + encodeURIComponent(quoted.author.handle || quoted.author.did || '') + '/post/' + encodeURIComponent(recordKey);

        quote.className = 'status-quote';
        meta.className = 'status-quote-meta';
        meta.href = quoteUrl;
        meta.target = '_blank';
        meta.rel = 'noopener noreferrer';
        avatar.src = quoted.author.avatar || '';
        avatar.alt = '';
        avatar.loading = 'lazy';
        name.textContent = quoted.author.displayName || quoted.author.handle || 'Quoted post';
        handle.textContent = quoted.author.handle ? '@' + quoted.author.handle : '';
        byline.appendChild(name);
        if (handle.textContent) byline.appendChild(handle);
        if (quoted.author.avatar) meta.appendChild(avatar);
        meta.appendChild(byline);
        text.className = 'status-quote-text';
        appendLinkedPlainText(text, quoted.text || '');
        quote.appendChild(meta);
        if (text.textContent) quote.appendChild(text);
        appendStatusEmbeds(quote, quoted.embeds || [], quoteUrl);
        container.appendChild(quote);
    }

    function appendStatusActions(container, post, postUrl) {
        var actions = document.createElement('div');
        var counts = post.counts || {};
        actions.className = 'status-actions';
        [
            [counts.replies || post.replyCount || 0, 'replies'],
            [counts.reposts || post.repostCount || 0, 'reposts'],
            [counts.likes || post.likeCount || 0, 'likes'],
            [counts.quotes || post.quoteCount || 0, 'quotes'],
        ].forEach(function (item) {
            var link = document.createElement('a');
            link.href = postUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = item[0] + ' ' + item[1];
            actions.appendChild(link);
        });
        container.appendChild(actions);
    }

    function initStatusCarousel(section, count) {
        var cards = Array.prototype.slice.call(section.querySelectorAll('.status-update'));
        var controls = section.querySelector('[data-status-controls]');
        var previous = section.querySelector('[data-status-prev]');
        var next = section.querySelector('[data-status-next]');
        var position = section.querySelector('[data-status-position]');
        var activeIndex = 0;

        function show(index) {
            activeIndex = (index + cards.length) % cards.length;
            cards.forEach(function (card, cardIndex) {
                card.hidden = cardIndex !== activeIndex;
            });
            if (position) position.textContent = (activeIndex + 1) + ' / ' + count;
        }

        if (cards.length > 1 && controls) {
            controls.hidden = false;
            previous.addEventListener('click', function () { show(activeIndex - 1); });
            next.addEventListener('click', function () { show(activeIndex + 1); });
        }

        show(0);
    }

    function initMenuToggle() {
        var header = document.getElementById('main-header');
        var toggle = document.querySelector('[data-menu-toggle]');
        if (!header || !toggle) return;

        toggle.addEventListener('click', function () {
            var isOpen = header.classList.toggle('menu-open');
            document.body.classList.toggle('is-menu-open', isOpen);
            toggle.setAttribute('aria-expanded', String(isOpen));
        });
    }

    function initSearchBackdrop() {
        var searchRoot = document.getElementById('sodo-search-root');
        if (!searchRoot || typeof MutationObserver === 'undefined') return;

        var preparedFrame = null;

        function prepareSearchFrame() {
            var frame = searchRoot.querySelector('iframe');
            if (!frame || frame === preparedFrame) return;

            preparedFrame = frame;
            frame.style.setProperty('background', 'transparent', 'important');
            frame.style.colorScheme = 'normal';

            function makeFrameCanvasTransparent() {
                try {
                    var frameDocument = frame.contentDocument;
                    if (!frameDocument) return;

                    frameDocument.documentElement.style.setProperty('background', 'transparent', 'important');
                    if (frameDocument.body) {
                        frameDocument.body.style.setProperty('background', 'transparent', 'important');
                    }
                } catch (error) {
                    // Ghost uses a same-origin srcdoc frame; leave its defaults alone
                    // if a browser blocks frame access for any reason.
                }
            }

            frame.addEventListener('load', makeFrameCanvasTransparent);
            makeFrameCanvasTransparent();
        }

        new MutationObserver(prepareSearchFrame).observe(searchRoot, {
            childList: true,
            subtree: true,
        });

        prepareSearchFrame();
    }

    function initClientNavigation() {
        if (!window.fetch || !window.DOMParser || !window.history || !window.history.pushState) return;

        var pageCache = new Map();
        var activeController = null;
        window.history.scrollRestoration = 'manual';

        function canNavigate(anchor, event) {
            if (!anchor || anchor.target || anchor.hasAttribute('download') || anchor.hasAttribute('data-no-client-nav')) return false;
            if (event && (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return false;

            var url = new URL(anchor.href, window.location.href);
            if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return false;
            if (url.pathname.indexOf('/ghost/') === 0 || /\.(?:xml|json|rss|atom|zip)$/i.test(url.pathname)) return false;
            if (url.hash && url.hash.indexOf('#/portal') === 0) return false;
            if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;

            return true;
        }

        function fetchPage(url, signal) {
            var key = url.href;
            if (pageCache.has(key)) return pageCache.get(key);

            var request = fetch(key, {
                credentials: 'same-origin',
                headers: {'X-Requested-With': 'CactusNavigation'},
                signal: signal,
            }).then(function (response) {
                if (!response.ok || !response.headers.get('content-type') || response.headers.get('content-type').indexOf('text/html') === -1) {
                    throw new Error('Page cannot be loaded in place');
                }
                return response.text();
            }).catch(function (error) {
                pageCache.delete(key);
                throw error;
            });

            pageCache.set(key, request);
            return request;
        }

        function updateHead(nextDocument) {
            var selectors = [
                'link[rel="canonical"]',
                'meta[name="description"]',
                'meta[property^="og:"]',
                'meta[name^="twitter:"]',
                'script[type="application/ld+json"]',
            ].join(',');

            document.querySelectorAll(selectors).forEach(function (element) {
                element.remove();
            });

            nextDocument.querySelectorAll(selectors).forEach(function (element) {
                document.head.appendChild(document.importNode(element, true));
            });

            document.title = nextDocument.title;
        }

        function runScripts(container) {
            container.querySelectorAll('script').forEach(function (oldScript) {
                var newScript = document.createElement('script');
                Array.prototype.forEach.call(oldScript.attributes, function (attribute) {
                    newScript.setAttribute(attribute.name, attribute.value);
                });
                newScript.textContent = oldScript.textContent;
                oldScript.replaceWith(newScript);
            });
        }

        function closeMenu() {
            var header = document.getElementById('main-header');
            var toggle = document.querySelector('[data-menu-toggle]');
            if (header) header.classList.remove('menu-open');
            document.body.classList.remove('is-menu-open');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }

        function updateNavigation(url) {
            var currentPath = url.pathname.replace(/\/$/, '') || '/';
            document.querySelectorAll('.cactus-nav a, .cactus-footer-nav a').forEach(function (link) {
                var linkPath = new URL(link.href, window.location.href).pathname.replace(/\/$/, '') || '/';
                var item = link.closest('li');
                if (linkPath === currentPath) {
                    link.setAttribute('aria-current', 'page');
                    if (item) item.classList.add('nav-current');
                } else {
                    link.removeAttribute('aria-current');
                    if (item) item.classList.remove('nav-current');
                }
            });
        }

        function swapPage(html, url, shouldPush) {
            var nextDocument = new DOMParser().parseFromString(html, 'text/html');
            var nextMain = nextDocument.querySelector('#main');
            var currentMain = document.querySelector('#main');
            if (!nextMain || !currentMain) throw new Error('Page content is missing');

            function swap() {
                updateHead(nextDocument);
                document.body.className = nextDocument.body.className;
                pauseActiveListeningPreview();
                currentMain.replaceWith(document.importNode(nextMain, true));
                closeMenu();
                updateNavigation(url);
            }

            if (!url.hash) window.scrollTo(0, 0);
            var transition = document.startViewTransition ? document.startViewTransition(swap) : null;
            if (!transition) swap();

            return (transition ? transition.updateCallbackDone : Promise.resolve()).then(function () {
                if (shouldPush) window.history.pushState({}, '', url.href);
                runScripts(document.querySelector('#main'));
                initPageFeatures(true);

                if (url.hash) {
                    var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
                    if (target) target.scrollIntoView();
                } else {
                    window.scrollTo(0, 0);
                    window.requestAnimationFrame(function () {
                        window.scrollTo(0, 0);
                    });
                }

                document.dispatchEvent(new CustomEvent('cactus:page-load', {detail: {url: url.href}}));
            });
        }

        function navigate(url, shouldPush) {
            if (activeController) activeController.abort();
            var controller = new AbortController();
            activeController = controller;
            document.documentElement.classList.add('is-navigating');

            fetchPage(url, controller.signal)
                .then(function (html) {
                    return swapPage(html, url, shouldPush);
                })
                .catch(function (error) {
                    if (error.name !== 'AbortError') window.location.href = url.href;
                })
                .finally(function () {
                    if (activeController === controller) {
                        document.documentElement.classList.remove('is-navigating');
                        activeController = null;
                    }
                });
        }

        document.addEventListener('click', function (event) {
            var anchor = event.target.closest && event.target.closest('a[href]');
            if (!canNavigate(anchor, event)) return;

            event.preventDefault();
            navigate(new URL(anchor.href, window.location.href), true);
        });

        document.addEventListener('pointerover', function (event) {
            var anchor = event.target.closest && event.target.closest('a[href]');
            if (!canNavigate(anchor)) return;
            if (!anchor.closest('.cactus-nav, .cactus-footer-nav')) return;
            fetchPage(new URL(anchor.href, window.location.href)).catch(function () {});
        });

        window.addEventListener('popstate', function () {
            navigate(new URL(window.location.href), false);
        });
    }

    function initPhotoFeed() {
        var grid = document.querySelector('.photo-feed');
        if (!grid || typeof imagesLoaded === 'undefined' || typeof Masonry === 'undefined') return;
        if (grid.getAttribute('data-masonry-ready') === 'true') return;
        grid.setAttribute('data-masonry-ready', 'true');

        var masonry = new Masonry(grid, {
            itemSelector: '.grid-item',
            columnWidth: '.grid-sizer',
            percentPosition: true,
            hiddenStyle: {transform: 'translateY(18px)', opacity: 0},
            visibleStyle: {transform: 'translateY(0)', opacity: 1},
        });

        function relayout() {
            if (!document.documentElement.contains(grid)) return;
            masonry.reloadItems();
            masonry.layout();
            grid.classList.add('initialized');
        }

        masonry.on('layoutComplete', function () {
            grid.classList.add('initialized');
        });

        relayout();
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(relayout);
        });
        window.setTimeout(relayout, 400);

        imagesLoaded(grid).on('progress', relayout).on('always', relayout);
        initPhotoInfiniteScroll(grid, masonry);
        initPhotoSwipe('.photo-feed', '.photo-card', '.post-lightbox', '.post-caption', false);
    }

    function initPhotoInfiniteScroll(grid, masonry) {
        var pagination = document.querySelector('.photo-section .pagination');
        var nextLink = pagination && pagination.querySelector('a.older-posts, a[rel="next"]');
        var nextUrl = nextLink && nextLink.href;

        if (!nextUrl || !('IntersectionObserver' in window)) return;

        var sentinel = document.createElement('div');
        sentinel.className = 'photo-scroll-sentinel';
        pagination.parentNode.insertBefore(sentinel, pagination.nextSibling);

        var isLoading = false;

        var observer = new IntersectionObserver(function (entries) {
            if (!entries[0].isIntersecting || isLoading || !nextUrl) return;

            isLoading = true;

            fetch(nextUrl)
                .then(function (response) {
                    return response.text();
                })
                .then(function (html) {
                    var doc = new DOMParser().parseFromString(html, 'text/html');
                    var nextGrid = doc.querySelector('.photo-feed');
                    var nextItems = nextGrid ? Array.prototype.slice.call(nextGrid.querySelectorAll('.grid-item:not(.grid-sizer)')) : [];
                    var nextPageLink = doc.querySelector('.photo-section .pagination a.older-posts, .photo-section .pagination a[rel="next"]');

                    if (!nextItems.length) {
                        nextUrl = null;
                        observer.disconnect();
                        return;
                    }

                    nextItems.forEach(function (item) {
                        grid.appendChild(item);
                    });

                    imagesLoaded(grid, function () {
                        masonry.appended(nextItems);
                        masonry.layout();
                    });

                    nextUrl = nextPageLink && nextPageLink.href;

                    if (!nextUrl) {
                        observer.disconnect();
                    }
                })
                .catch(function () {
                    observer.disconnect();
                })
                .finally(function () {
                    isLoading = false;
                });
        }, {rootMargin: '600px 0px'});

        observer.observe(sentinel);
    }

    function initPhotoSwipe(container, element, trigger, caption, isGallery) {
        if (typeof PhotoSwipe === 'undefined' || typeof PhotoSwipeUI_Default === 'undefined' || typeof $ === 'undefined') return;

        var parseThumbnailElements = function (el) {
            var items = [];

            $(el).find(element).each(function (i, v) {
                var gridEl = $(v);
                var linkEl = gridEl.find(trigger);
                var item = {
                    src: isGallery ? gridEl.find('img').attr('src') : linkEl.attr('href'),
                    w: 0,
                    h: 0,
                };

                if (caption && gridEl.find(caption).length) {
                    item.title = gridEl.find(caption).html();
                }

                items.push(item);
            });

            return items;
        };

        var openPhotoSwipe = function (index, galleryElement) {
            var pswpElement = document.querySelectorAll('.pswp')[0];
            var items = parseThumbnailElements(galleryElement);
            var gallery = new PhotoSwipe(pswpElement, PhotoSwipeUI_Default, items, {
                closeOnScroll: false,
                history: false,
                index: index,
                shareEl: false,
                showAnimationDuration: 0,
                showHideOpacity: true,
            });

            gallery.listen('gettingData', function (index, item) {
                if (item.w < 1 || item.h < 1) {
                    var img = new Image();
                    img.onload = function () {
                        item.w = this.width;
                        item.h = this.height;
                        gallery.updateSize(true);
                    };
                    img.src = item.src;
                }
            });

            gallery.init();
        };

        $(container).on('click', trigger, function (event) {
            event.preventDefault();
            var index = $(event.target).closest(container).find(element).index($(event.target).closest(element));
            var clickedGallery = $(event.target).closest(container);
            openPhotoSwipe(index, clickedGallery[0]);
        });
    }
})();
