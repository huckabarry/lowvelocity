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
        initPhotoFeed();
    });

    function initThemeToggle() {
        var toggle = document.querySelector('[data-theme-toggle]');
        if (!toggle) return;

        toggle.addEventListener('click', function () {
            var nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', nextTheme);
            localStorage.setItem('cactus-theme', nextTheme);
        });
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

    function initPhotoFeed() {
        var grid = document.querySelector('.photo-feed');
        if (!grid || typeof imagesLoaded === 'undefined' || typeof Masonry === 'undefined') return;

        imagesLoaded(grid, function () {
            var masonry = new Masonry(grid, {
                itemSelector: '.grid-item',
                columnWidth: '.grid-sizer',
                percentPosition: true,
                gutter: 10,
                hiddenStyle: {transform: 'translateY(50px)', opacity: 0},
                visibleStyle: {transform: 'translateY(0)', opacity: 1},
            });

            masonry.on('layoutComplete', function () {
                grid.classList.add('initialized');
            });

            masonry.layout();
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
