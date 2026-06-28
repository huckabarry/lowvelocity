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
        initBlueskyPostLinkPreviews();
        initBlueskyNotes();
        initNowMixedFeed();
        initAtprotoEngagement();
        initPhotoFeed();
        initCheckinsAtlas();
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
        var source = container.querySelector('[data-listening-preview-source]') || container;
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

            if (container.classList.contains('lv-listening-post')) {
                container.querySelectorAll('a[href*="audio-ssl.itunes.apple.com"], a[href*=".m4a"], a[href*=".mp3"]').forEach(function (link) {
                    link.remove();
                });
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

    function initBlueskyPostLinkPreviews() {
        document.querySelectorAll('.cactus-content .lv-atproto-note:not([data-link-previews-ready])').forEach(function (container) {
            container.setAttribute('data-link-previews-ready', 'true');
            enhanceBlueskyPostLinkPreviews(container);
        });
    }

    function enhanceBlueskyPostLinkPreviews(container) {
        Array.prototype.slice.call(container.querySelectorAll('p')).forEach(function (paragraph) {
            if (paragraph.closest('.kg-card, .status-external, .lv-atproto-quote, blockquote')) return;

            var anchors = Array.prototype.slice.call(paragraph.querySelectorAll('a[href]'));
            if (anchors.length !== 1) return;

            var anchor = anchors[0];
            if (!/^https?:\/\//i.test(anchor.href)) return;

            var strong = anchor.querySelector('strong');
            var textNodes = Array.prototype.slice.call(paragraph.childNodes).filter(function (node) {
                return node.nodeType === 3 && node.textContent.trim();
            });
            var hasOnlyAnchor = paragraph.children.length === 1 && !textNodes.length;
            var paragraphText = paragraph.textContent.trim();
            var anchorText = anchor.textContent.trim();
            var isBareLink = hasOnlyAnchor && paragraphText === anchorText && /^https?:\/\//i.test(anchorText);
            var isGhostPreviewLink = hasOnlyAnchor && strong;

            if (!isBareLink && !isGhostPreviewLink) return;

            paragraph.replaceWith(createBlueskyLinkPreview(anchor, strong));
        });
    }

    function createBlueskyLinkPreview(anchor, strong) {
        var preview = document.createElement('a');
        var details = document.createElement('span');
        var domain = document.createElement('span');
        var title = document.createElement('strong');
        var description = document.createElement('span');
        var descriptionText = '';

        preview.className = 'status-external lv-atproto-link-preview';
        preview.href = anchor.href;
        preview.rel = anchor.rel || 'noopener';
        if (anchor.target) preview.target = anchor.target;

        details.className = 'status-external-details';

        try {
            domain.className = 'status-external-domain';
            domain.textContent = new URL(anchor.href, window.location.href).hostname.replace(/^www\./, '');
            details.appendChild(domain);
        } catch (error) {}

        if (strong) {
            var descriptionClone = anchor.cloneNode(true);
            descriptionClone.querySelectorAll('strong').forEach(function (node) {
                node.remove();
            });
            title.textContent = strong.textContent.trim();
            descriptionText = descriptionClone.textContent.trim();
        } else {
            title.textContent = domain.textContent || anchor.textContent.trim() || anchor.href;
            descriptionText = anchor.href;
        }

        details.appendChild(title);

        if (descriptionText && descriptionText !== title.textContent) {
            description.className = 'status-external-description';
            description.textContent = descriptionText;
            details.appendChild(description);
        }

        preview.appendChild(details);
        return preview;
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

    function initNowMixedFeed() {
        var section = document.querySelector('[data-now-feed]');
        if (!section) return;

        var container = section.querySelector('[data-now-feed-items]');
        if (!container) return;

        var listeningItems = Array.prototype.slice.call(section.querySelectorAll('template[data-now-listening-entry]'))
            .map(createNowListeningItem)
            .filter(Boolean);
        var statusItems = Array.prototype.slice.call(section.querySelectorAll('template[data-now-status-entry]'))
            .map(createNowStatusItem)
            .filter(Boolean);

        section._nowFeedItems = listeningItems.concat(statusItems);
        section._nowFeedIds = createNowFeedIdSet(section._nowFeedItems);

        renderNowMixedFeed(container, section._nowFeedItems);

        section.querySelectorAll('template[data-now-listening-entry], template[data-now-status-entry]').forEach(function (template) {
            template.remove();
        });

        initNowInfiniteFeed(section, container);
    }

    function createNowStatusItem(template) {
        if (!template) return null;

        var source = document.createElement('div');
        var date = template.getAttribute('data-date') || '';
        var title = template.getAttribute('data-title') || 'Status update';
        var url = template.getAttribute('data-url') || '#';
        var card = document.createElement('article');
        var body = document.createElement('div');
        var actions = document.createElement('p');
        var link = document.createElement('a');

        source.appendChild(template.content.cloneNode(true));

        card.className = 'now-status-entry';
        body.className = 'mixed-feed__summary now-status-entry__body';
        body.innerHTML = source.innerHTML.trim();
        enhanceNowStatusBody(body);

        if (!body.textContent.trim() && !body.querySelector('img, video, iframe')) {
            var fallback = document.createElement('p');
            fallback.textContent = title;
            body.appendChild(fallback);
        }

        actions.className = 'mixed-feed__actions now-status-entry__actions';
        link.className = 'now-status-read mixed-feed__action';
        link.href = url;
        link.textContent = 'Read';
        actions.appendChild(link);

        card.appendChild(body);
        card.appendChild(actions);

        return {
            type: 'status',
            kicker: 'Status',
            date: date,
            dateLabel: template.getAttribute('data-date-label') || formatNowFeedDate(date),
            id: url,
            node: card,
        };
    }

    function enhanceNowStatusBody(body) {
        if (!body) return;

        enhanceNowStatusLinkPreviews(body);
        enhanceNowStatusImageCarousel(body);
    }

    function enhanceNowStatusLinkPreviews(body) {
        Array.prototype.slice.call(body.querySelectorAll('p')).forEach(function (paragraph) {
            var anchor = paragraph.firstElementChild;
            var strong = anchor && anchor.querySelector('strong');
            var textNodes = Array.prototype.slice.call(paragraph.childNodes).filter(function (node) {
                return node.nodeType === 3 && node.textContent.trim();
            });

            if (!anchor || anchor.tagName !== 'A' || paragraph.children.length !== 1 || textNodes.length || !strong) return;
            if (anchor.closest('.kg-card, .status-external, .now-status-carousel')) return;

            var preview = document.createElement('a');
            var details = document.createElement('span');
            var title = document.createElement('strong');
            var description = document.createElement('span');
            var domain = document.createElement('span');
            var descriptionClone = anchor.cloneNode(true);

            descriptionClone.querySelectorAll('strong').forEach(function (node) {
                node.remove();
            });

            preview.className = 'status-external now-status-link-preview';
            preview.href = anchor.href;
            preview.rel = anchor.rel || 'noopener';
            if (anchor.target) preview.target = anchor.target;

            details.className = 'status-external-details';
            title.textContent = strong.textContent.trim();

            try {
                domain.className = 'status-external-domain';
                domain.textContent = new URL(anchor.href, window.location.href).hostname.replace(/^www\./, '');
                details.appendChild(domain);
            } catch (error) {}

            details.appendChild(title);

            if (descriptionClone.textContent.trim()) {
                description.className = 'status-external-description';
                description.textContent = descriptionClone.textContent.trim();
                details.appendChild(description);
            }

            preview.appendChild(details);
            paragraph.replaceWith(preview);
        });
    }

    function enhanceNowStatusImageCarousel(body) {
        var figures = Array.prototype.slice.call(body.querySelectorAll('figure.kg-image-card')).filter(function (figure) {
            return figure.querySelector('img') && !figure.closest('.lv-atproto-quote, blockquote, .kg-bookmark-card, .kg-embed-card, .kg-video-card, .kg-product-card, .kg-button-card, .now-status-carousel');
        });

        if (figures.length <= 4) return;

        var carousel = document.createElement('div');
        var viewport = document.createElement('div');
        var controls = document.createElement('div');
        var previous = document.createElement('button');
        var next = document.createElement('button');
        var count = document.createElement('span');

        carousel.className = 'now-status-carousel';
        viewport.className = 'now-status-carousel__viewport';
        viewport.setAttribute('aria-label', figures.length + ' photos');
        viewport.tabIndex = 0;

        figures[0].before(carousel);
        carousel.appendChild(viewport);

        figures.forEach(function (figure, index) {
            var slide = document.createElement('div');
            slide.className = 'now-status-carousel__slide';
            slide.setAttribute('aria-label', 'Photo ' + (index + 1) + ' of ' + figures.length);
            slide.appendChild(figure);
            setNowCarouselSlideOrientation(slide);
            viewport.appendChild(slide);
        });

        controls.className = 'now-status-carousel__controls';
        previous.className = 'now-status-carousel__button';
        previous.type = 'button';
        previous.setAttribute('aria-label', 'Previous photo');
        previous.textContent = '‹';
        next.className = 'now-status-carousel__button';
        next.type = 'button';
        next.setAttribute('aria-label', 'Next photo');
        next.textContent = '›';
        count.className = 'now-status-carousel__count';
        count.textContent = figures.length + ' photos';

        controls.appendChild(previous);
        controls.appendChild(count);
        controls.appendChild(next);
        carousel.appendChild(controls);

        function scrollBySlide(direction) {
            viewport.scrollBy({
                left: direction * Math.max(1, viewport.clientWidth * 0.88),
                behavior: 'smooth',
            });
        }

        previous.addEventListener('click', function () {
            scrollBySlide(-1);
        });
        next.addEventListener('click', function () {
            scrollBySlide(1);
        });
    }

    function setNowCarouselSlideOrientation(slide) {
        var image = slide && slide.querySelector('img');
        if (!image) return;

        function apply() {
            var width = image.naturalWidth || parseInt(image.getAttribute('width'), 10) || 0;
            var height = image.naturalHeight || parseInt(image.getAttribute('height'), 10) || 0;
            if (!width || !height) return;

            var ratio = width / height;
            var desktopHeight = 23;
            var widthRem = Math.max(10, Math.min(42, desktopHeight * ratio));

            slide.classList.toggle('is-portrait', ratio < 1);
            slide.classList.toggle('is-landscape', ratio >= 1);
            slide.style.setProperty('--now-status-image-ratio', ratio.toFixed(4));
            slide.style.setProperty('--now-status-slide-width', widthRem.toFixed(2) + 'rem');
        }

        apply();

        if (!image.complete) {
            image.addEventListener('load', apply, {once: true});
        }
    }

    function initAtprotoEngagement() {
        document.querySelectorAll('[data-atproto-engagement]:not([data-atproto-ready])').forEach(function (section) {
            section.setAttribute('data-atproto-ready', 'true');

            var endpoint = section.getAttribute('data-atproto-endpoint') || 'https://sync.lowvelocity.org/updates/bluesky/thread';
            var rkey = atprotoRkeyFromSection(section);
            var status = section.querySelector('.atproto-engagement__status');
            if (!rkey) {
                if (status) status.textContent = 'Bluesky discussion is unavailable for this post.';
                return;
            }

            var url = new URL(endpoint, window.location.href);
            url.searchParams.set('rkey', rkey);

            fetch(url.toString(), {headers: {Accept: 'application/json'}})
                .then(function (response) {
                    if (!response.ok) throw new Error('Bluesky thread request failed');
                    return response.json();
                })
                .then(function (data) {
                    renderAtprotoEngagement(section, data);
                })
                .catch(function () {
                    if (status) status.textContent = 'Bluesky discussion is temporarily unavailable.';
                });
        });
    }

    function atprotoRkeyFromSection(section) {
        var value = section.getAttribute('data-atproto-rkey') || '';
        var match = value.match(/(?:^|\/)bsky-([a-z0-9-]+)\/?$/i) || value.match(/^([a-z0-9-]+)$/i);
        return match ? match[1] : '';
    }

    function renderAtprotoEngagement(section, data) {
        var post = data && data.post;
        var counts = data && data.counts ? data.counts : {};
        var replies = Array.isArray(data && data.replies) ? data.replies : [];
        var quotes = Array.isArray(data && data.quotes) ? data.quotes : [];
        var fragment = document.createDocumentFragment();
        var header = document.createElement('div');
        var title = document.createElement('h2');
        var countsList = document.createElement('div');
        var postUrl = post && post.url;

        section.replaceChildren();
        header.className = 'atproto-engagement__header';
        title.className = 'atproto-engagement__title';
        title.textContent = 'Bluesky discussion';
        header.appendChild(title);
        if (postUrl) {
            header.appendChild(createAtprotoReplyButton(postUrl));
        }
        fragment.appendChild(header);

        countsList.className = 'atproto-engagement__counts';
        [
            ['replies', 'Replies', 'reply'],
            ['reposts', 'Reposts', 'repost'],
            ['quotes', 'Quotes', 'quote'],
            ['likes', 'Likes', 'like'],
        ].forEach(function (item) {
            countsList.appendChild(createAtprotoMetric({
                href: postUrl,
                key: item[0],
                label: item[1],
                icon: item[2],
                value: Number(counts[item[0]]) || 0,
            }));
        });
        fragment.appendChild(countsList);

        if (replies.length) {
            fragment.appendChild(createAtprotoPostList('Recent replies', replies));
        }

        if (quotes.length) {
            fragment.appendChild(createAtprotoPostList('Recent quotes', quotes));
        }

        if (!replies.length && !quotes.length) {
            var empty = document.createElement('p');
            empty.className = 'atproto-engagement__empty';
            empty.textContent = 'No replies or quote posts yet.';
            fragment.appendChild(empty);
        }

        section.appendChild(fragment);
    }

    function createAtprotoMetric(options) {
        var metric = document.createElement(options.href ? 'a' : 'span');
        var icon = createAtprotoIcon(options.icon);
        var number = document.createElement('strong');
        var label = document.createElement('span');

        metric.className = 'atproto-engagement__metric atproto-engagement__metric--' + options.key;
        metric.setAttribute('aria-label', formatCompactNumber(options.value) + ' ' + options.label.toLowerCase());

        if (options.href) {
            metric.href = options.href;
            metric.target = '_blank';
            metric.rel = 'noopener noreferrer';
        }

        number.textContent = formatCompactNumber(options.value);
        label.className = 'atproto-engagement__metric-label';
        label.textContent = options.label;

        metric.appendChild(icon);
        metric.appendChild(number);
        metric.appendChild(label);
        return metric;
    }

    function createAtprotoReplyButton(postUrl) {
        var button = document.createElement('a');
        var label = document.createElement('span');

        button.className = 'atproto-engagement__reply-button';
        button.href = postUrl;
        button.target = '_blank';
        button.rel = 'noopener noreferrer';
        button.setAttribute('aria-label', 'Reply on Bluesky');
        label.textContent = 'Reply on Bluesky';

        button.appendChild(createAtprotoIcon('bluesky'));
        button.appendChild(label);
        return button;
    }

    function createAtprotoIcon(name) {
        var icon = document.createElement('span');
        icon.className = 'atproto-engagement__icon atproto-engagement__icon--' + name;
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = getAtprotoIconSvg(name);
        return icon;
    }

    function getAtprotoIconSvg(name) {
        var icons = {
            reply: '<svg viewBox="0 0 24 24" focusable="false"><path d="M6.37 3.93c.53-.51 1.28-.83 2.35-.83h8.03c1.07 0 1.82.32 2.35.83.51.49.83 1.18.83 2.18v5.78c0 1-.32 1.69-.83 2.18-.53.51-1.28.83-2.35.83h-2.84l-4.1 4.1c-.24.24-.49.36-.79.36-.57 0-1.01-.42-1.01-.99V14.9H8.72c-1.07 0-1.82-.32-2.35-.83-.51-.49-.83-1.18-.83-2.18V6.11c0-1 .32-1.69.83-2.18Zm2.35.77c-.72 0-1.05.2-1.25.39-.18.17-.33.45-.33 1.02v5.78c0 .57.15.85.33 1.02.2.19.53.39 1.25.39h1.95v3.07l3.07-3.07h3.03c.72 0 1.05-.2 1.25-.39.18-.17.33-.45.33-1.02V6.11c0-.57-.15-.85-.33-1.02-.2-.19-.53-.39-1.25-.39H8.72Z"></path></svg>',
            repost: '<svg viewBox="0 0 24 24" focusable="false"><path d="M5.05 4.86a.75.75 0 0 1 1.06 0l2.76 2.76a.75.75 0 1 1-1.06 1.06L6.33 7.2v7.05c0 .7.17 1.12.45 1.39.27.27.69.45 1.39.45h5.5a.75.75 0 0 1 0 1.5h-5.5c-1.02 0-1.87-.28-2.45-.86-.58-.58-.89-1.43-.89-2.48V7.2L3.99 8.68a.75.75 0 1 1-1.06-1.06l2.12-2.12Zm13.9 10.46a.75.75 0 0 1 1.06 1.06l-2.76 2.76a.75.75 0 0 1-1.06 0l-2.76-2.76a.75.75 0 1 1 1.06-1.06l1.48 1.48V9.75c0-.7-.17-1.12-.45-1.39-.27-.27-.69-.45-1.39-.45h-5.5a.75.75 0 0 1 0-1.5h5.5c1.02 0 1.87.28 2.45.86.58.58.89 1.43.89 2.48v7.05l1.48-1.48Z"></path></svg>',
            quote: '<svg viewBox="0 0 24 24" focusable="false"><path d="M7.1 5.2h9.8c1.08 0 1.93.3 2.52.9.59.58.88 1.42.88 2.5v5.1c0 1.08-.29 1.92-.88 2.5-.59.6-1.44.9-2.52.9h-3.2l-3.27 3.04a.8.8 0 0 1-1.35-.58V17.1H7.1c-1.08 0-1.93-.3-2.52-.9-.59-.58-.88-1.42-.88-2.5V8.6c0-1.08.29-1.92.88-2.5.59-.6 1.44-.9 2.52-.9Zm0 1.55c-.65 0-1.1.15-1.4.44-.28.28-.42.74-.42 1.41v5.1c0 .67.14 1.13.43 1.41.28.29.74.44 1.39.44h3.52v2.47l2.47-2.47h3.81c.65 0 1.11-.15 1.39-.44.29-.28.43-.74.43-1.41V8.6c0-.67-.14-1.13-.43-1.41-.28-.29-.74-.44-1.39-.44H7.1Zm1.7 3.05h2.2v3.05H7.9v-2.1c0-.63.3-.95.9-.95Zm5.2 0h2.2v3.05h-3.1v-2.1c0-.63.3-.95.9-.95Z"></path></svg>',
            like: '<svg viewBox="0 0 24 24" focusable="false"><path d="M16.72 3.8c2.87 0 4.93 2.16 4.93 5.13 0 1.89-.77 3.32-2.08 4.7-1.28 1.35-3.09 2.71-5.17 4.28l-1.89 1.43a.82.82 0 0 1-1 0l-1.89-1.43c-2.08-1.57-3.89-2.93-5.17-4.28-1.31-1.38-2.08-2.81-2.08-4.7 0-2.97 2.06-5.13 4.93-5.13 1.79 0 3.03.89 3.83 1.83.35.41.64.85.87 1.25.23-.4.52-.84.87-1.25.8-.94 2.04-1.83 3.83-1.83Zm0 1.6c-1.19 0-2.02.56-2.61 1.25-.61.71-.96 1.53-1.12 2.03a.82.82 0 0 1-1.56 0c-.16-.5-.51-1.32-1.12-2.03-.59-.69-1.42-1.25-2.61-1.25-1.88 0-3.33 1.38-3.33 3.53 0 1.33.51 2.38 1.64 3.57 1.15 1.21 2.82 2.47 4.94 4.08L12 17.68l1.84-1.39c2.12-1.61 3.79-2.87 4.94-4.08 1.13-1.19 1.64-2.24 1.64-3.57 0-2.15-1.45-3.53-3.33-3.53Z"></path></svg>',
            bluesky: '<svg viewBox="0 0 24 24" focusable="false"><path d="M5.69 4.78c2.35 1.76 4.88 5.33 5.81 7.27.93-1.94 3.46-5.51 5.81-7.27 1.69-1.27 4.43-2.26 4.43.87 0 .63-.36 5.29-.57 6.05-.72 2.66-3.35 3.34-5.69 2.94 4.09.7 5.13 3.04 2.88 5.39-4.27 4.46-6.14-1.12-6.62-2.55-.09-.26-.13-.38-.24-.38s-.15.12-.24.38c-.48 1.43-2.35 7.01-6.62 2.55-2.25-2.35-1.21-4.69 2.88-5.39-2.34.4-4.97-.28-5.69-2.94-.21-.76-.57-5.42-.57-6.05 0-3.13 2.74-2.14 4.43-.87Z"></path></svg>',
        };
        return icons[name] || icons.reply;
    }

    function createAtprotoPostList(titleText, posts) {
        var wrap = document.createElement('div');
        var heading = document.createElement('h3');
        var list = document.createElement('div');

        wrap.className = 'atproto-engagement__group';
        heading.className = 'atproto-engagement__subtitle';
        heading.textContent = titleText;
        list.className = 'atproto-engagement__posts';
        posts.forEach(function (post) {
            list.appendChild(createAtprotoPostPreview(post));
        });

        wrap.appendChild(heading);
        wrap.appendChild(list);
        return wrap;
    }

    function createAtprotoPostPreview(post) {
        var article = document.createElement('article');
        var avatar = document.createElement('img');
        var body = document.createElement('div');
        var meta = document.createElement('div');
        var author = document.createElement('a');
        var time = document.createElement('a');
        var text = document.createElement('p');
        var authorData = post.author || {};

        article.className = 'atproto-post-preview';
        avatar.className = 'atproto-post-preview__avatar';
        avatar.src = authorData.avatar || '';
        avatar.alt = '';
        avatar.loading = 'lazy';
        body.className = 'atproto-post-preview__body';
        meta.className = 'atproto-post-preview__meta';
        author.className = 'atproto-post-preview__author';
        author.href = 'https://bsky.app/profile/' + encodeURIComponent(authorData.handle || authorData.did || '');
        author.target = '_blank';
        author.rel = 'noopener noreferrer';
        author.textContent = authorData.displayName || authorData.handle || 'Bluesky user';
        time.className = 'atproto-post-preview__time';
        time.href = post.url || author.href;
        time.target = '_blank';
        time.rel = 'noopener noreferrer';
        time.textContent = formatNowFeedDate(post.createdAt);
        text.className = 'atproto-post-preview__text';
        appendLinkedPlainText(text, post.text || '');

        if (avatar.src) article.appendChild(avatar);
        meta.appendChild(author);
        if (time.textContent) meta.appendChild(time);
        body.appendChild(meta);
        if (text.textContent.trim()) body.appendChild(text);
        article.appendChild(body);
        return article;
    }

    function formatCompactNumber(value) {
        return new Intl.NumberFormat(document.documentElement.lang || 'en', {
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(value);
    }

    function createNowListeningItem(template) {
        if (!template) return null;

        var source = document.createElement('div');
        var date = template.getAttribute('data-date') || '';
        var title = template.getAttribute('data-title') || 'Listening';
        var url = template.getAttribute('data-url') || '#';
        var image = template.getAttribute('data-image') || '';
        var imageAlt = template.getAttribute('data-image-alt') || title;
        var summary = template.getAttribute('data-summary') || '';
        source.appendChild(template.content.cloneNode(true));

        var artist = textFrom(source.querySelector('.lv-listening-entry__artist'));
        var note = source.querySelector('.lv-listening-entry__note');
        var previewUrl = findListeningPreviewUrl(source);
        var links = Array.prototype.slice.call(source.querySelectorAll('.lv-listening-entry__links a')).filter(function (link) {
            return !/audio-ssl\.itunes\.apple\.com|\.m4a(?:[?#]|$)|\.mp3(?:[?#]|$)/i.test(link.href);
        });
        var card = document.createElement('div');
        var coverLink = document.createElement('a');
        var cover = document.createElement('img');
        var body = document.createElement('div');
        var heading = document.createElement('h2');
        var headingLink = document.createElement('a');

        card.className = 'media-entry media-entry--track now-media-entry';

        if (image) {
            coverLink.className = 'media-entry__cover';
            coverLink.href = url;
            cover.src = image;
            cover.alt = imageAlt;
            cover.loading = 'lazy';
            coverLink.appendChild(cover);
            card.appendChild(coverLink);
        }

        body.className = 'media-entry__body';
        heading.className = 'mixed-feed__title';
        headingLink.href = url;
        headingLink.textContent = title;
        heading.appendChild(headingLink);
        body.appendChild(heading);

        if (artist) {
            var credit = document.createElement('p');
            credit.className = 'media-entry__credit';
            credit.textContent = artist;
            body.appendChild(credit);
        }

        if (note && note.innerHTML.trim()) {
            var noteWrapper = document.createElement('div');
            noteWrapper.className = 'mixed-feed__summary media-entry__note';
            noteWrapper.innerHTML = note.innerHTML;
            body.appendChild(noteWrapper);
        } else if (summary) {
            var summaryNode = document.createElement('p');
            summaryNode.className = 'mixed-feed__summary';
            summaryNode.textContent = summary;
            body.appendChild(summaryNode);
        }

        if (links.length) {
            var actions = document.createElement('div');
            actions.className = 'mixed-feed__actions';
            links.forEach(function (link) {
                var action = document.createElement('a');
                action.className = 'tag-pill mixed-feed__action';
                action.href = link.href;
                action.target = '_blank';
                action.rel = 'noopener noreferrer';
                action.textContent = link.textContent;
                actions.appendChild(action);
            });
            body.appendChild(actions);
        }

        if (previewUrl) {
            var audioWrap = document.createElement('div');
            var audio = document.createElement('audio');
            audioWrap.className = 'mixed-feed__audio';
            audio.controls = true;
            audio.preload = 'none';
            audio.src = previewUrl;
            audio.setAttribute('aria-label', 'Preview ' + title);
            audioWrap.appendChild(audio);
            body.appendChild(audioWrap);
        }

        card.appendChild(body);

        return {
            type: 'media',
            kicker: 'Listening',
            date: date,
            dateLabel: template.getAttribute('data-date-label') || formatNowFeedDate(date),
            id: url,
            node: card,
        };
    }

    function initNowInfiniteFeed(section, container) {
        var apiConfig = getGhostContentApiConfig();
        var status = document.createElement('p');
        var sentinel = document.createElement('div');
        var sources;
        var observer;

        if (!apiConfig.key || !apiConfig.endpoint) return;

        sources = [
            {
                filter: section.getAttribute('data-now-status-filter') || 'tag:hash-bluesky',
                limit: parseInt(section.getAttribute('data-now-status-limit'), 10) || 100,
                page: 2,
                hasMore: true,
                createItem: createNowStatusItemFromPost,
            },
            {
                filter: section.getAttribute('data-now-listening-filter') || 'tag:hash-crucialtracks',
                limit: parseInt(section.getAttribute('data-now-listening-limit'), 10) || 25,
                page: 2,
                hasMore: true,
                createItem: createNowListeningItemFromPost,
            },
        ];

        status.className = 'now-feed-status now-feed-status--loader';
        status.hidden = true;
        status.setAttribute('aria-live', 'polite');
        sentinel.className = 'now-feed-sentinel';
        sentinel.setAttribute('aria-hidden', 'true');
        section.appendChild(status);
        section.appendChild(sentinel);

        function loadMoreNowItems() {
            var activeSources = sources.filter(function (source) {
                return source.hasMore;
            });

            if (section._nowFeedLoading || !activeSources.length) return;

            section._nowFeedLoading = true;
            status.hidden = false;
            status.textContent = 'Loading older updates…';

            Promise.all(activeSources.map(function (source) {
                return fetchNowFeedPage(apiConfig, source).then(function (result) {
                    var pagination = result.meta && result.meta.pagination ? result.meta.pagination : {};
                    var items = (result.posts || []).map(source.createItem).filter(Boolean);

                    source.hasMore = Boolean(pagination.next);
                    source.page = pagination.next || source.page + 1;

                    return items;
                }).catch(function () {
                    source.hasMore = false;
                    return [];
                });
            })).then(function (groups) {
                var newItems = [];

                groups.forEach(function (items) {
                    items.forEach(function (item) {
                        var id = item.id || item.date + item.kicker;
                        if (section._nowFeedIds.has(id)) return;
                        section._nowFeedIds.add(id);
                        newItems.push(item);
                    });
                });

                if (newItems.length) {
                    section._nowFeedItems = section._nowFeedItems.concat(newItems);
                    renderNowMixedFeed(container, section._nowFeedItems);
                }

                section._nowFeedLoading = false;

                if (sources.some(function (source) { return source.hasMore; })) {
                    status.hidden = true;
                    status.textContent = '';
                } else {
                    status.hidden = false;
                    status.textContent = 'You’ve reached the beginning of this local now archive.';
                    if (observer) observer.disconnect();
                    sentinel.remove();
                }
            });
        }

        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver(function (entries) {
                if (entries.some(function (entry) { return entry.isIntersecting; })) {
                    loadMoreNowItems();
                }
            }, {rootMargin: '900px 0px'});
            observer.observe(sentinel);
        } else {
            var button = document.createElement('button');
            button.className = 'now-feed-load-more';
            button.type = 'button';
            button.textContent = 'Load older updates';
            button.addEventListener('click', loadMoreNowItems);
            sentinel.replaceWith(button);
        }
    }

    function fetchNowFeedPage(apiConfig, source) {
        var url = new URL(apiConfig.endpoint, window.location.href);
        url.searchParams.set('key', apiConfig.key);
        url.searchParams.set('filter', source.filter);
        url.searchParams.set('limit', source.limit);
        url.searchParams.set('page', source.page);
        url.searchParams.set('include', 'tags');
        url.searchParams.set('formats', 'html');
        url.searchParams.set('order', 'published_at desc');

        return fetch(url.toString(), {headers: {Accept: 'application/json'}}).then(function (response) {
            if (!response.ok) throw new Error('Now feed page request failed');
            return response.json();
        });
    }

    function getGhostContentApiConfig() {
        var script = document.querySelector('script[data-key][data-api], script[data-key][data-sodo-search], script[data-key][data-ghost]');
        var key = script ? script.getAttribute('data-key') : '';
        var apiBase = script ? script.getAttribute('data-api') : '';
        var base;
        var endpoint;

        try {
            base = apiBase ? new URL(apiBase, window.location.origin).toString() : new URL('/ghost/api/content/', window.location.origin).toString();
            endpoint = new URL('posts/', base).toString();
        } catch (error) {
            endpoint = '';
        }

        return {
            key: key,
            endpoint: endpoint,
        };
    }

    function createNowStatusItemFromPost(post) {
        var template = createNowTemplateFromPost(post);
        return createNowStatusItem(template);
    }

    function createNowListeningItemFromPost(post) {
        var template = createNowTemplateFromPost(post);
        if (post && post.feature_image) template.setAttribute('data-image', post.feature_image);
        if (post && post.feature_image_alt) template.setAttribute('data-image-alt', post.feature_image_alt);
        if (post && post.custom_excerpt) template.setAttribute('data-summary', post.custom_excerpt);
        return createNowListeningItem(template);
    }

    function createNowTemplateFromPost(post) {
        var template = document.createElement('template');
        var title = post && post.title ? post.title : '';
        var date = post && post.published_at ? post.published_at : '';
        var url = post && post.url ? post.url : post && post.slug ? '/' + post.slug + '/' : '#';

        template.setAttribute('data-date', date);
        template.setAttribute('data-date-label', formatNowFeedDate(date));
        template.setAttribute('data-title', title);
        template.setAttribute('data-url', url);
        template.innerHTML = post && post.html ? post.html : '';

        return template;
    }

    function createNowFeedIdSet(items) {
        var ids = new Set();

        items.forEach(function (item) {
            if (!item) return;
            ids.add(item.id || item.date + item.kicker);
        });

        return ids;
    }

    function renderNowMixedFeed(container, items) {
        var sorted = items.filter(function (item) {
            return item && item.node;
        }).sort(function (left, right) {
            return new Date(right.date) - new Date(left.date);
        });

        container.replaceChildren();

        if (!sorted.length) {
            var empty = document.createElement('p');
            empty.className = 'now-feed-status';
            empty.textContent = 'The now feed is temporarily unavailable.';
            container.appendChild(empty);
            return;
        }

        sorted.forEach(function (item) {
            container.appendChild(createNowFeedEntry(item));
        });
    }

    function createNowFeedEntry(item) {
        var article = document.createElement('article');
        var metaColumn = document.createElement('div');
        var time = document.createElement('time');
        var rail = document.createElement('div');
        var dot = document.createElement('span');
        var content = document.createElement('div');
        var itemWrap = document.createElement('div');
        var kicker = document.createElement('p');

        article.className = 'mixed-feed__entry mixed-feed__entry--' + item.type;
        metaColumn.className = 'mixed-feed__meta-column';
        time.className = 'mixed-feed__date';
        time.dateTime = item.date || '';
        time.textContent = item.dateLabel || formatNowFeedDate(item.date);
        rail.className = 'mixed-feed__rail';
        rail.setAttribute('aria-hidden', 'true');
        dot.className = 'mixed-feed__dot';
        content.className = 'mixed-feed__content';
        itemWrap.className = 'mixed-feed__item mixed-feed__item--' + item.type;
        kicker.className = 'mixed-feed__kicker';
        kicker.textContent = item.kicker || item.type;

        rail.appendChild(dot);
        metaColumn.appendChild(time);
        itemWrap.appendChild(kicker);
        itemWrap.appendChild(item.node);
        content.appendChild(itemWrap);
        article.appendChild(metaColumn);
        article.appendChild(rail);
        article.appendChild(content);

        return article;
    }

    function formatNowFeedDate(value) {
        if (!value) return '';

        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';

        return new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(date);
    }

    function textFrom(node) {
        return node ? node.textContent.trim() : '';
    }

    function createStatusUpdate(post, options) {
        options = options || {};
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
        article.hidden = !options.visible;
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
        hydratePhotoBodyCards(grid);

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

    function normalizePhotoUrl(value) {
        if (!value) return '';

        try {
            var url = new URL(value, window.location.href);
            url.pathname = url.pathname.replace(/\/content\/images\/size\/w\d+\//, '/content/images/');
            url.search = '';
            url.hash = '';
            return url.toString();
        } catch (error) {
            return String(value || '').replace(/\/content\/images\/size\/w\d+\//, '/content/images/');
        }
    }

    function largestSrcFromSet(srcset) {
        if (!srcset) return '';

        var candidates = srcset.split(',').map(function (candidate) {
            var parts = candidate.trim().split(/\s+/);
            var width = parts[1] && parts[1].endsWith('w') ? parseInt(parts[1], 10) : 0;
            return {url: parts[0], width: width || 0};
        }).filter(function (candidate) {
            return candidate.url;
        }).sort(function (a, b) {
            return b.width - a.width;
        });

        return candidates[0] ? candidates[0].url : '';
    }

    function isPhotoBodyImage(image) {
        if (!image) return false;
        if (image.closest('.kg-bookmark-card, .kg-embed-card, .kg-video-card, .kg-product-card, .kg-button-card')) return false;

        return Boolean(image.closest('.kg-image-card, .kg-gallery-image'));
    }

    function hydratePhotoBodyCards(grid) {
        var sources = Array.prototype.slice.call(grid.querySelectorAll('template[data-photo-body-source]'));
        if (!sources.length) return;

        var seen = new Set();
        Array.prototype.slice.call(grid.querySelectorAll('.post-lightbox[href], .photo-card img[src]')).forEach(function (item) {
            seen.add(normalizePhotoUrl(item.getAttribute('href') || item.getAttribute('src')));
        });

        sources.forEach(function (source) {
            var postTitle = source.getAttribute('data-post-title') || '';
            var postUrl = source.getAttribute('data-post-url') || '#';
            var postDate = source.getAttribute('data-post-date') || '';
            var postDatetime = source.getAttribute('data-post-datetime') || '';
            var images = Array.prototype.slice.call(source.content.querySelectorAll('.kg-image-card img, .kg-gallery-image img'))
                .filter(isPhotoBodyImage)
                .slice(0, 10);

            images.forEach(function (originalImage) {
                var sourceSrc = originalImage.getAttribute('src') || originalImage.getAttribute('data-src') || '';
                var sourceSrcset = originalImage.getAttribute('srcset') || '';
                var lightboxUrl = largestSrcFromSet(sourceSrcset) || sourceSrc;
                var normalized = normalizePhotoUrl(lightboxUrl || sourceSrc);

                if (!normalized || seen.has(normalized)) return;
                seen.add(normalized);

                var displaySrc = sourceSrc || lightboxUrl;
                var alt = originalImage.getAttribute('alt') || postTitle;
                var width = parseInt(originalImage.getAttribute('width'), 10) || 0;
                var height = parseInt(originalImage.getAttribute('height'), 10) || 0;

                var gridItem = document.createElement('div');
                gridItem.className = 'grid-item';

                var figure = document.createElement('figure');
                figure.className = 'photo-card photo-card-body-image';

                var postLink = document.createElement('a');
                postLink.className = 'post-link';
                postLink.href = postUrl;
                postLink.setAttribute('aria-label', 'Read ' + postTitle);

                var img = document.createElement('img');
                img.className = 'post-image';
                img.src = displaySrc;
                if (sourceSrcset) img.setAttribute('srcset', sourceSrcset);
                if (originalImage.getAttribute('sizes')) img.setAttribute('sizes', originalImage.getAttribute('sizes'));
                img.alt = alt;
                img.loading = 'lazy';
                if (width && height) {
                    img.width = width;
                    img.height = height;
                }
                postLink.appendChild(img);

                var lightbox = document.createElement('a');
                lightbox.className = 'post-lightbox';
                lightbox.href = lightboxUrl || displaySrc;
                lightbox.setAttribute('aria-label', 'Expand image');
                lightbox.setAttribute('data-no-client-nav', '');
                if (width && height) {
                    lightbox.setAttribute('data-pswp-width', String(width));
                    lightbox.setAttribute('data-pswp-height', String(height));
                }
                lightbox.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';

                var caption = document.createElement('figcaption');
                caption.className = 'post-caption';

                var title = document.createElement('h2');
                title.className = 'post-caption-title';
                title.textContent = postTitle;

                var meta = document.createElement('div');
                meta.className = 'post-caption-meta';

                var dateItem = document.createElement('span');
                dateItem.className = 'post-caption-meta-item';
                var time = document.createElement('time');
                if (postDatetime) time.dateTime = postDatetime;
                time.textContent = postDate;
                dateItem.appendChild(time);

                var readItem = document.createElement('span');
                readItem.className = 'post-caption-meta-item';
                var read = document.createElement('a');
                read.href = postUrl;
                read.textContent = 'Read';
                readItem.appendChild(read);

                meta.appendChild(dateItem);
                meta.appendChild(readItem);
                caption.appendChild(title);
                caption.appendChild(meta);

                figure.appendChild(postLink);
                figure.appendChild(lightbox);
                figure.appendChild(caption);
                gridItem.appendChild(figure);
                grid.appendChild(gridItem);
            });

            source.remove();
        });
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
                var width = parseInt(linkEl.attr('data-pswp-width'), 10) || 0;
                var height = parseInt(linkEl.attr('data-pswp-height'), 10) || 0;
                var item = {
                    src: isGallery ? gridEl.find('img').attr('src') : linkEl.attr('href'),
                    w: width,
                    h: height,
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
            var clickedItem = $(event.target).closest(element);
            var index = $(event.target).closest(container).find(element).index(clickedItem);
            var clickedGallery = $(event.target).closest(container);
            if (index < 0) index = 0;
            openPhotoSwipe(index, clickedGallery[0]);
        });
    }

    function initCheckinsAtlas() {
        document.querySelectorAll('[data-checkins-atlas]:not([data-checkins-ready])').forEach(function (atlas) {
            atlas.setAttribute('data-checkins-ready', 'true');

            var templates = Array.prototype.slice.call(atlas.querySelectorAll('template[data-checkin-entry]'));
            var items = templates.map(readCheckinTemplate).filter(function (item) {
                return item && Number.isFinite(item.latitude) && Number.isFinite(item.longitude);
            });
            var list = atlas.querySelector('[data-checkins-list]');
            var mapElement = atlas.querySelector('[data-checkins-map]');

            renderCheckinsList(list, items);
            renderCheckinsMap(mapElement, items);
        });
    }

    function readCheckinTemplate(template) {
        var wrapper = document.createElement('div');
        wrapper.appendChild(template.content.cloneNode(true));

        var article = wrapper.querySelector('.lv-checkin');
        if (!article) return readGhostCheckinTemplate(template, wrapper);

        var latitude = parseFloat(article.getAttribute('data-lat') || '');
        var longitude = parseFloat(article.getAttribute('data-lng') || '');
        var placeHeading = article.querySelector('.lv-checkin-place h2');
        var placeText = article.querySelector('.lv-checkin-place p');
        var note = Array.prototype.slice.call(article.children).find(function (element) {
            return element.tagName === 'P';
        });
        var image = article.querySelector('.lv-checkin-image img');
        var title = placeHeading && placeHeading.textContent.trim()
            ? placeHeading.textContent.trim()
            : (template.getAttribute('data-title') || '').replace(/^Checked in at\s+/i, '');

        return {
            title: title || 'Check-in',
            url: template.getAttribute('data-url') || '#',
            date: article.getAttribute('data-visited-at') || template.getAttribute('data-date') || '',
            dateLabel: template.getAttribute('data-date-label') || '',
            place: article.getAttribute('data-place') || (placeText ? placeText.textContent.trim() : ''),
            category: article.getAttribute('data-category') || '',
            note: note ? note.textContent.trim() : '',
            image: image ? image.src : '',
            imageAlt: image ? image.alt : '',
            latitude: latitude,
            longitude: longitude
        };
    }

    function readGhostCheckinTemplate(template, wrapper) {
        var heading = wrapper.querySelector('h2');
        if (!heading) return null;

        var coordinates = readCheckinCoordinates(wrapper);
        var listItems = Array.prototype.slice.call(wrapper.querySelectorAll('li'));
        var category = readCheckinListValue(listItems, 'Category');
        var place = readCheckinListValue(listItems, 'Place');
        var placeText = heading.nextElementSibling && heading.nextElementSibling.tagName === 'P'
            ? heading.nextElementSibling.textContent.trim()
            : '';
        var noteElement = Array.prototype.slice.call(wrapper.children).find(function (element) {
            return element.tagName === 'P' && element.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING;
        });
        var image = wrapper.querySelector('.lv-checkin-image img, figure img');
        var title = heading.textContent.trim() || (template.getAttribute('data-title') || '').replace(/^Checked in at\s+/i, '');

        return {
            title: title || 'Check-in',
            url: template.getAttribute('data-url') || '#',
            date: template.getAttribute('data-date') || '',
            dateLabel: template.getAttribute('data-date-label') || '',
            place: place || placeText,
            category: category,
            note: noteElement ? noteElement.textContent.trim() : '',
            image: image ? image.src : '',
            imageAlt: image ? image.alt : '',
            latitude: coordinates.latitude,
            longitude: coordinates.longitude
        };
    }

    function readCheckinListValue(items, label) {
        var match = items.find(function (item) {
            return item.textContent.trim().toLowerCase().indexOf(label.toLowerCase()) === 0;
        });
        return match ? match.textContent.trim().replace(new RegExp('^' + label + '\\s*:?\\s*', 'i'), '') : '';
    }

    function readCheckinCoordinates(wrapper) {
        var mapLink = Array.prototype.slice.call(wrapper.querySelectorAll('a[href*="google.com/maps"]')).find(function (link) {
            return link.href;
        });
        if (!mapLink) return {latitude: NaN, longitude: NaN};

        try {
            var url = new URL(mapLink.href, window.location.href);
            var query = url.searchParams.get('query') || '';
            var match = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
            if (match) {
                return {
                    latitude: parseFloat(match[1]),
                    longitude: parseFloat(match[2])
                };
            }
        } catch (error) {
            // Fall through to the empty coordinate response.
        }

        return {latitude: NaN, longitude: NaN};
    }

    function renderCheckinsList(list, items) {
        if (!list) return;

        list.replaceChildren();

        if (!items.length) {
            var empty = document.createElement('p');
            empty.className = 'checkins-empty';
            empty.textContent = 'No public check-ins are available yet.';
            list.appendChild(empty);
            return;
        }

        items.forEach(function (item) {
            var card = document.createElement('article');
            var body = document.createElement('div');
            var title = document.createElement('h2');
            var link = document.createElement('a');
            var meta = document.createElement('p');

            card.className = item.image ? 'checkin-card has-image' : 'checkin-card';
            body.className = 'checkin-card__body';
            link.href = item.url;
            link.textContent = item.title;
            title.appendChild(link);
            meta.className = 'checkin-card__meta';
            meta.textContent = [formatCheckinDate(item.date, item.dateLabel), item.place, item.category].filter(Boolean).join(' · ');

            if (item.image) {
                var imageLink = document.createElement('a');
                var image = document.createElement('img');
                imageLink.className = 'checkin-card__image';
                imageLink.href = item.url;
                image.src = item.image;
                image.alt = item.imageAlt || '';
                image.loading = 'lazy';
                imageLink.appendChild(image);
                card.appendChild(imageLink);
            }

            body.appendChild(title);
            if (meta.textContent) body.appendChild(meta);

            if (item.note) {
                var note = document.createElement('p');
                note.className = 'checkin-card__note';
                note.textContent = item.note;
                body.appendChild(note);
            }

            card.appendChild(body);
            list.appendChild(card);
        });
    }

    function renderCheckinsMap(mapElement, items) {
        if (!mapElement) return;

        if (!items.length || typeof L === 'undefined') {
            mapElement.hidden = true;
            return;
        }

        var map = L.map(mapElement, {
            scrollWheelZoom: false,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        var bounds = [];

        items.forEach(function (item) {
            var marker = L.marker([item.latitude, item.longitude]).addTo(map);
            var popup = '<strong>' + escapeMarkup(item.title) + '</strong>';
            if (item.place) popup += '<br>' + escapeMarkup(item.place);
            if (item.date || item.dateLabel) popup += '<br><small>' + escapeMarkup(formatCheckinDate(item.date, item.dateLabel)) + '</small>';
            popup += '<br><a href="' + escapeAttribute(item.url) + '">Read</a>';
            marker.bindPopup(popup);
            bounds.push([item.latitude, item.longitude]);
        });

        if (bounds.length === 1) {
            map.setView(bounds[0], 13);
        } else {
            map.fitBounds(bounds, {padding: [28, 28]});
        }

        window.setTimeout(function () {
            map.invalidateSize();
        }, 250);
    }

    function formatCheckinDate(value, fallback) {
        if (!value) return fallback || '';
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return fallback || '';
        return new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(date);
    }

    function escapeMarkup(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttribute(value) {
        return escapeMarkup(value).replace(/`/g, '&#96;');
    }
})();
