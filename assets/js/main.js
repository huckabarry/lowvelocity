$(function () {
    'use strict';
    featured();
    if (document.querySelector('.lowvelocity-gallery-feed')) {
        galleryFeed();
    } else {
        pagination(false);
    }
});

function galleryFeed() {
    'use strict';

    var grid = document.querySelector('.lowvelocity-gallery-feed');
    if (!grid) return;

    imagesLoaded(grid, function () {
        var masonry = new Masonry(grid, {
            itemSelector: '.lowvelocity-gallery-item',
            columnWidth: '.lowvelocity-gallery-sizer',
            hiddenStyle: {transform: 'translateY(40px)', opacity: 0},
            visibleStyle: {transform: 'translateY(0)', opacity: 1},
        });

        masonry.on('layoutComplete', function () {
            grid.classList.add('initialized');
        });

        masonry.layout();

        function appendItems(items, loadNextPage) {
            imagesLoaded(items, function (loaded) {
                masonry.appended(items);
                masonry.layout();
                loaded.elements.forEach(function (item) {
                    item.style.visibility = 'visible';
                });
                loadNextPage();
            });
        }

        pagination(true, appendItems, true);
    });

    grid.addEventListener('click', function (event) {
        var trigger = event.target.closest('.lowvelocity-gallery-expand');
        if (!trigger || !grid.contains(trigger)) return;

        event.preventDefault();

        var cards = Array.from(grid.querySelectorAll('.lowvelocity-gallery-card'));
        var currentCard = trigger.closest('.lowvelocity-gallery-card');
        var index = cards.indexOf(currentCard);
        var items = cards.map(function (card) {
            var image = card.querySelector('.lowvelocity-gallery-image');
            var source = card.querySelector('.lowvelocity-gallery-expand');
            var title = card.querySelector('.lowvelocity-gallery-title');
            var date = card.querySelector('.lowvelocity-gallery-date');
            var caption = document.createElement('span');
            var captionTitle = document.createElement('strong');

            captionTitle.textContent = title.textContent;
            caption.appendChild(captionTitle);
            caption.appendChild(document.createElement('br'));
            caption.appendChild(document.createTextNode(date.textContent));

            return {
                src: source.href,
                msrc: image.currentSrc || image.src,
                w: 0,
                h: 0,
                el: image,
                title: caption.innerHTML,
            };
        });

        var gallery = new PhotoSwipe(
            document.querySelector('.pswp'),
            PhotoSwipeUI_Default,
            items,
            {
                bgOpacity: 0.94,
                closeOnScroll: false,
                history: false,
                index: index,
                shareEl: false,
                showAnimationDuration: 0,
                showHideOpacity: true,
                getThumbBoundsFn: function (itemIndex) {
                    var thumbnail = items[itemIndex].el;
                    var pageYScroll = window.pageYOffset || document.documentElement.scrollTop;
                    var rect = thumbnail.getBoundingClientRect();

                    return {x: rect.left, y: rect.top + pageYScroll, w: rect.width};
                },
            }
        );

        gallery.listen('gettingData', function (itemIndex, item) {
            if (item.w < 1 || item.h < 1) {
                var image = new Image();
                image.onload = function () {
                    item.w = this.width;
                    item.h = this.height;
                    gallery.updateSize(true);
                };
                image.src = item.src;
            }
        });

        gallery.init();
    });
}

function featured() {
    'use strict';
    $('.featured-feed').owlCarousel({
        dots: false,
        margin: 30,
        nav: true,
        navText: [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" class="icon"><path d="M20.547 22.107L14.44 16l6.107-6.12L18.667 8l-8 8 8 8 1.88-1.893z"></path></svg>',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" class="icon"><path d="M11.453 22.107L17.56 16l-6.107-6.12L13.333 8l8 8-8 8-1.88-1.893z"></path></svg>',
        ],
        responsive: {
            0: {
                items: 1,
            },
            768: {
                items: 2,
            },
            992: {
                items: 3,
            },
        },
    });
}
