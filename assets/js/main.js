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
        initBlueskyNotes();
        initPhotoFeed();
        if (isClientNavigation) initGhostCardEnhancements();
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
        });
    }

    function initBlueskyNotes() {
        var section = document.querySelector('[data-bluesky-feed]');
        if (!section) return;

        var carousel = section.querySelector('[data-status-carousel]');
        var handle = section.getAttribute('data-bluesky-handle');
        var limit = parseInt(section.getAttribute('data-bluesky-limit'), 10) || 5;
        if (!carousel || !handle) return;

        var endpoint = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed');
        endpoint.searchParams.set('actor', handle);
        endpoint.searchParams.set('filter', 'posts_no_replies');
        endpoint.searchParams.set('limit', String(Math.max(limit * 4, 20)));

        fetch(endpoint.toString())
            .then(function (response) {
                if (!response.ok) throw new Error('Bluesky feed request failed');
                return response.json();
            })
            .then(function (data) {
                var posts = (data.feed || []).filter(function (item) {
                    return !item.reason && item.post && item.post.author && item.post.author.handle === handle;
                }).slice(0, limit);

                if (!posts.length) throw new Error('Bluesky feed is empty');

                carousel.replaceChildren();
                posts.forEach(function (item) {
                    carousel.appendChild(createStatusUpdate(item.post));
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
        var link = document.createElement('a');
        var time = document.createElement('time');
        var record = post.record || {};
        var postKey = post.uri.split('/').pop();
        var postUrl = 'https://bsky.app/profile/' + encodeURIComponent(post.author.handle) + '/post/' + encodeURIComponent(postKey);
        var createdAt = record.createdAt || post.indexedAt;

        article.className = 'status-update';
        article.hidden = true;
        avatar.className = 'status-avatar';
        avatar.src = post.author.avatar || '';
        avatar.alt = '';
        avatar.loading = 'lazy';
        body.className = 'status-update-body';
        meta.className = 'status-meta';
        author.className = 'status-author';
        author.href = 'https://bsky.app/profile/' + encodeURIComponent(post.author.handle);
        author.target = '_blank';
        author.rel = 'noopener noreferrer';
        author.textContent = post.author.displayName || '@' + post.author.handle;
        text.className = 'status-text';
        link.href = postUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = record.text || 'View this post on Bluesky';
        time.dateTime = createdAt;
        time.textContent = new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(createdAt));

        meta.appendChild(author);
        meta.appendChild(time);
        text.appendChild(link);
        body.appendChild(meta);
        body.appendChild(text);
        appendStatusEmbed(body, post.embed, postUrl);
        article.appendChild(avatar);
        article.appendChild(body);
        return article;
    }

    function appendStatusEmbed(container, embed, postUrl) {
        if (!embed) return;

        var media = embed.media || embed;
        var images = media.images || [];
        if (images.length) {
            var gallery = document.createElement('div');
            gallery.className = 'status-media' + (images.length > 1 ? ' status-media-multiple' : '');
            images.slice(0, 4).forEach(function (image) {
                var anchor = document.createElement('a');
                var img = document.createElement('img');
                anchor.href = postUrl;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                img.src = image.thumb || image.fullsize;
                img.alt = image.alt || '';
                img.loading = 'lazy';
                anchor.appendChild(img);
                gallery.appendChild(anchor);
            });
            container.appendChild(gallery);
            return;
        }

        var external = media.external;
        if (external) {
            var card = document.createElement('a');
            card.className = 'status-external';
            card.href = external.uri;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            if (external.title) {
                var title = document.createElement('strong');
                title.textContent = external.title;
                card.appendChild(title);
            }
            if (external.description) {
                var description = document.createElement('span');
                description.textContent = external.description;
                card.appendChild(description);
            }
            container.appendChild(card);
        }
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

        imagesLoaded(grid, function () {
            var masonry = new Masonry(grid, {
                itemSelector: '.grid-item',
                columnWidth: '.grid-sizer',
                percentPosition: true,
                hiddenStyle: {transform: 'translateY(50px)', opacity: 0},
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
            initPhotoInfiniteScroll(grid, masonry);
        });

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
