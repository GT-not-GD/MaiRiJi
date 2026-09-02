/* ================================================================= */
/* 1. 核心 helper 库 (视差滚动与图片加载)  */
/* ================================================================= */
function WnkLaxController() {
    this.elements = [];
    this.enabled = false;
    this.requestID = null;
    this.init();
}

WnkLaxController.prototype = {
    init: function () {},
    addElement: function (el, parent, opts) {
        const element = new WnkLaxElement(el, parent, opts);
        this.elements.push(element);
    },
    onFrame: function () {
        for (let i = 0; i < this.elements.length; i++) {
            this.elements[i].onFrame();
        }
    },
    start: function () {
        this.enabled = true;
        this.onFrame();
    },
    stop: function () {
        if (this.requestID) {
            window.cancelAnimationFrame(this.requestID);
            this.requestID = null;
        }
        this.enabled = false;
    }
};

function WnkLaxElement(el, parent, opts) {
    this.el = el;
    this.parent = parent;
    this.defaults = {
        deltaX: 1.0,
        deltaY: 1.0,
        accX: 1.0,
        accY: 1.0,
        mode: 'translate',
    };
    this.settings = $.extend({}, this.defaults, opts);
    this.y = 0;
    this.x = 0;
    this.originX = 0;
    this.originY = 0;
    this.w = 0;
    this.h = 0;
    this.currentDeltaX = 0;
    this.currentDeltaY = 0;
    this.wH = 0;
    this.wW = 0;
    this.init();
}

WnkLaxElement.prototype = {
    init: function () {
        this.onResize();
    },
    onFrame: function () {
        const tweenDeltaX = this.caclDeltaTranslate(this.settings.deltaX, this.currentDeltaX, this.settings.accX);
        const tweenDeltaY = this.caclDeltaTranslate(this.settings.deltaY, this.currentDeltaY, this.settings.accY);
        this.move(tweenDeltaX, tweenDeltaY);
        this.currentDeltaX = tweenDeltaX;
        this.currentDeltaY = tweenDeltaY;
    },
    caclDeltaTranslate: function (delta, curr, acc) {
        const scrollTop = this.getScrollTop();
        const newDelta = (scrollTop - (scrollTop * delta));
        let tweenDelta = (curr - ((curr - newDelta)) * acc);
        if (Math.abs(tweenDelta) < (1 / 1000)) {
            tweenDelta = newDelta;
        }
        return tweenDelta;
    },
    move: function (x, y) {
        let property = '';
        let value = '';
        if (this.settings.mode === 'translate') {
            property = 'transform';
            value = "translateZ(0)";
            if (x !== 0) value += ` translateX(${x}px) `;
            if (y !== 0) value += ` translateY(${y}px) `;
        } else if (this.settings.mode === 'bg') {
            property = 'background-position';
            value += (x !== 0) ? `${x}px ` : `${this._getBgPosFor('x')} `;
            value += (y !== 0) ? `${y}px` : this._getBgPosFor('y');
        }
        if (property && value.length > 0) {
            this.el.css(property, value);
        }
    },
    enable: function () {
        if (!this.enabled) {
            this.enabled = true;
            this.onFrame();
        }
    },
    onResize: function () {
        this.wH = $(window).height();
        this.wW = $(window).width();
        this.w = this.el.width();
        this.h = this.el.height();
        const hasFixedParent = this.el.parents().filter((_, el) => $(el).css('position') === 'fixed');
        if (hasFixedParent.length > 0) {
            this.originY = this.el.offset().top - window.pageYOffset;
        } else {
            this.originY = this.el.offset().top;
        }
    },
    getScrollTop: function () {
        if (this.originY > (this.wH / 2)) {
            return (window.pageYOffset - this.originY) + (this.wH / 2) - (this.h / 2);
        }
        const origin = Math.max((this.originY - (this.wH / 2)), 0);
        return (window.pageYOffset - origin);
    },
    _getBgPosFor: function (axe) {
        const bgPos = this.el.css('background-position');
        const pos = bgPos ? bgPos.split(' ') : ['0px', '0px'];
        return axe === 'x' ? (pos[0] || '0px') : (pos[1] || '0px');
    }
};

function WnkMediaLoader(imgs, parent) {
    this.$imgs = imgs;
    this.count = 0;
    this.parent = parent;
    this.allLoaded = false;
    this.eventName = 'wnk.mediasLoaded';
    this.init();
}

WnkMediaLoader.prototype = {
    init: function () {
        if (this.$imgs.length <= 0) {
            $(this.parent).trigger(this.eventName);
        }
    },
    load: function () {
        this.$imgs.each((i, media) => this.initMedia(i, media));
    },
    initMedia: function (i, media) {
        const $media = $(media);

        if ($media.prop('tagName') === 'IMG') {
            $media.one("load.WnkMediaLoader error.WnkMediaLoader", () => this.onMediaLoaded());
            if (media.complete) $media.trigger('load');
        } else if ($media.prop('tagName') === 'VIDEO') {
            $media.one("loadeddata.WnkMediaLoader error.WnkMediaLoader", () => this.onMediaLoaded());
            media.load();
        } else {
            this.onMediaLoaded();
        }
    },
    onMediaLoaded: function () {
        this.count++;
        if (this.count >= this.$imgs.length) {
            $(this.parent).trigger(this.eventName);
        }
    },
};

/* ================================================================= */
/* 2. 麦日记主程序 (MaiRijiApp) */
/* ================================================================= */

function MaiRijiApp() {
    this.wax = new WnkLaxController();

    this.config = {
        waNumber: "601115277643",
        googleSheetUrl: "https://script.google.com/macros/s/AKfycby1Qm6k1oiw4zqqIS5WWFUKBGnWuW-CdvctB4DvHFPMFm4YcGsL_O3S8oNgB6IMzFVL5Q/exec",
        /* 🚚 配送规则（v4.4）：
         * minLeadHours: 欧包极限制作 24h + 排产缓冲 → 最少提前 36 小时（蛋糕也统一 36h）
         * farMinRM: Banting 方向来回 ~50km，油+车损 ≈RM14 → 起送线 RM50，不满可下单但等拼单
         * postcodes: 邮编 → 区域档位。local=Tanjong Sepat 本地；far=Banting 方向
         *   42800 Tanjong Sepat/Batu Laut · 42700 Banting/Telok Datok/Morib/Kanchong · 42600 Jenjarom */
        delivery: {
            minLeadHours: 36,
            farMinRM: 50,
            postcodes: { '42800': 'local', '42700': 'far', '42600': 'far' },
            farName: 'Banting'
        },
        storageKeys: {
            cart: 'mairiji_cart',
            custName: 'mairiji_cust_name',
            custPhone: 'mairiji_cust_phone',
            custAddress: 'mairiji_cust_address',
            custPostcode: 'mairiji_cust_postcode',
            lang: 'mairiji_lang'
        }
    };
    this.cursorTimer = null;
    this.currentLang = localStorage.getItem(this.config.storageKeys.lang) || 'zh';
    this.pushedStateCount = 0;
    
    this.scrollMetrics = {
        winHeight: 0,
        winWidth: 0,
        wrapperTop: 0,
        wrapperHeight: 0,
        trackWidth: 0,
        contentWrapHeight: 0
    };
    
    // 防并发锁 (非常重要)
    this.isVideoTransitioning = false;
}

MaiRijiApp.prototype = {

    preload: function () {
        $.when(
            $.getJSON('assets/data/products.json'),
            $.getJSON('assets/data/locales.json')
        ).done((prodRes, localeRes) => {
            this.productsData = prodRes[0];
            this.localesData = localeRes[0];
            this.init();
        }).fail(() => {
            console.error("加载数据失败，请确保在服务器环境下运行。");
            this.init(); // 兜底保障
        });
    },

    t: function (keyPath) {
        if (!this.localesData || !this.localesData[this.currentLang]) return keyPath;

        const keys = keyPath.split('.');
        let current = this.localesData[this.currentLang];
        for (let i = 0; i < keys.length; i++) {
            if (current[keys[i]] === undefined) return keyPath;
            current = current[keys[i]];
        }
        return current;
    },

    updateDOMTranslations: function () {
        $('html').attr('lang', this.currentLang === 'en' ? 'en' : 'zh-CN');

        const pageTitle = this.t('meta.title');
        const pageDesc = this.t('meta.description');
        if (pageTitle) document.title = pageTitle;
        if (pageDesc) $('meta[name="description"]').attr('content', pageDesc);

        $('[data-i18n]').each((_, el) => {
            const key = $(el).data('i18n');
            const translated = this.t(key);
            if (translated) $(el).html(translated);
        });

        $('[data-i18n-placeholder]').each((_, el) => {
            const key = $(el).data('i18n-placeholder');
            const translated = this.t(key);
            if (translated) $(el).attr('placeholder', translated);
        });

        $('#lang-float .textIcon').text(this.currentLang === 'en' ? '中文' : 'EN');
    },

    switchLanguage: function (targetLang) {
        if (this.isLangSwitching) return;
        this.isLangSwitching = true;

        this.currentLang = targetLang || (this.currentLang === 'en' ? 'zh' : 'en');
        localStorage.setItem(this.config.storageKeys.lang, this.currentLang);

        let $overlay = $('#lang-switch-overlay');
        if ($overlay.length === 0) {
            $overlay = $('<div id="lang-switch-overlay"></div>').appendTo('body');
        }
        $overlay.addClass('show');

        const $targets = $('[data-i18n]');
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789麦日记风味烘焙';

        $targets.addClass('text-scrambling');

        let scrambleCount = 0;
        const scrambleInterval = setInterval(() => {
            $targets.each((_, el) => {
                const $el = $(el);
                if ($el.children().length > 0 || $el.html().indexOf('<') !== -1) return;
                
                let scrambled = '';
                const len = Math.min(Math.max($el.text().length, 4), 10);
                for (let i = 0; i < len; i++) {
                    scrambled += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                $el.text(scrambled);
            });
            scrambleCount++;
            if (scrambleCount >= 4) {
                clearInterval(scrambleInterval);
            }
        }, 35);

        setTimeout(() => {
            this.updateDOMTranslations();
            this.renderProducts();
            this.updateCartUI();
            this.loadHighResImages();
            this.updateVIPBtnUI();

            if (this.$els.detailPanel.hasClass('open')) {
                const currentType = this.$els.detailPanel.data('type');
                const currentId = this.$els.detailPanel.data('id');
                if (currentType && currentId) {
                    this.openProductDetail(currentType, currentId);
                }
            }

            $targets.removeClass('text-scrambling');
            $overlay.removeClass('show');

            setTimeout(() => {
                this.isLangSwitching = false;
            }, 250);

        }, 220);
    },

    getCurrentLanguage: function () {
        return this.currentLang;
    },

    init: function () {
        this.$els = {
            body: $('body'),
            mainHeader: $('.main-header'),
            detailPanel: $('#product-detail-panel'),
            detailTitle: $('#detail-title'),
            detailPrice: $('#detail-price'),
            detailText: $('#detail-text'),
            detailHeroImg: $('#detail-hero-img'),
            detailGallery: $('#detail-gallery'),
            detailOrderBtn: $('#detail-order-btn'),
            detailIngredients: $('#detail-ingredients'),
            detailAllergens: $('#detail-allergens'),
            detailStorage: $('#detail-storage'),
            detailReheatTitle: $('#detail-reheat-title'),
            detailReheat: $('#detail-reheat'),
            cartDrawer: $('#cart-drawer-panel'),
            cartBackdrop: $('#cart-backdrop'),
            cartList: $('#cart-items-list'),
            cartTotalPrice: $('#cart-total-price'),
            cartBadge: $('#cart-count-badge'),
            menuSwitcherBtn: $('.menu-switcher-btn'),
            menuView: $('.menu-view'),
            menuBannerPanel: $('.menu-banner-panel'),
            menuTitle: $('.menu-title'),
            scrollWrapper: $('.horizontal-scroll-wrapper'),
            savoriaTrack: $('.savoria-track'),
            savoriaCards: $('.savoria-card'),
            savoriaContentWrap: $('.savoria-sticky-viewport > .wrap'),
            toastTransition: $('#toast-transition')
        };

        this.updateDOMTranslations();
        this.renderProducts();
        this.renderSavoriaCards('bread');

        $('.home-intro .bg-inner').addClass('play-zoom');
        this.bindEvents();
        this.initCustomCursor();

        this.cart = this.loadCart();
        this.updateCartUI();

        this.updateScrollMetrics();
        this.updateVIPBtnUI();
        this.initPWA();
    },

    /* 📲 PWA（v4.18）：让顾客把官网「安装」到手机桌面，像 APP 一样打开。
     * ① 动态注入 manifest link + theme-color（index.html 一行不用改）
     * ② 注册 Service Worker（mrj-sw.js：HTML网络优先/静态资源缓存优先）
     * ③ Android/Chrome：拦下 beforeinstallprompt，30秒后弹一次自制安装横幅
     *    （每7天最多提醒一次，点过"不用了"不再烦）
     * ④ iPhone/Safari 不支持自动弹：显示"添加到主屏幕"教学提示 */
    initPWA: function () {
        try {
            if (!document.querySelector('link[rel="manifest"]')) {
                const lk = document.createElement('link');
                lk.rel = 'manifest'; lk.href = 'manifest.json';
                document.head.appendChild(lk);
            }
            if (!document.querySelector('meta[name="theme-color"]')) {
                const mt = document.createElement('meta');
                mt.name = 'theme-color'; mt.content = '#8b5e3c';
                document.head.appendChild(mt);
            }
            if ('serviceWorker' in navigator && location.protocol === 'https:') {
                navigator.serviceWorker.register('mrj-sw.js').catch(() => {});
            }
        } catch (e) {}

        /* 已装过（standalone 打开）→ 什么都不提示 */
        const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        if (standalone) return;
        /* 7天冷却：拒绝过/提示过就先不烦 */
        const last = Number(localStorage.getItem('mrj_pwa_ask') || 0);
        if (Date.now() - last < 7 * 86400000) return;

        const isEnglish = () => this.getCurrentLanguage() === 'en';
        const showBanner = (html, onOk) => {
            const bar = document.createElement('div');
            bar.id = 'mrj-pwa-bar';
            bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99997;background:#fdf9f3;border:1.5px solid #d9c3a5;border-radius:14px;box-shadow:0 8px 26px rgba(60,42,26,.22);padding:12px 14px;display:flex;align-items:center;gap:10px;max-width:92vw;font-size:13px;color:#5a3a22;line-height:1.5';
            bar.innerHTML = html;
            document.body.appendChild(bar);
            localStorage.setItem('mrj_pwa_ask', String(Date.now()));
            const okB = bar.querySelector('.mrj-pwa-ok');
            const noB = bar.querySelector('.mrj-pwa-no');
            if (okB) okB.addEventListener('click', () => { bar.remove(); if (onOk) onOk(); });
            if (noB) noB.addEventListener('click', () => bar.remove());
        };

        let deferred = null;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferred = e;
        });
        /* 30 秒后（顾客已经在逛了）才提示，不打扰刚进门的 */
        setTimeout(() => {
            const en = isEnglish();
            if (deferred) {
                showBanner('🍞 <span>' + (en ? 'Install <b>MaiRiJi</b> on your phone — one tap to order & track!' : '把<b>麦日记</b>装到手机桌面，下单看进度一点就开～') + '</span>' +
                    '<button class="mrj-pwa-ok" style="border:none;background:#8b5e3c;color:#fff;border-radius:99px;padding:7px 16px;font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap">' + (en ? 'Install' : '安装') + '</button>' +
                    '<button class="mrj-pwa-no" style="border:none;background:none;color:#a8977f;font-size:17px;cursor:pointer;line-height:1">&times;</button>',
                    () => { try { deferred.prompt(); } catch (e) {} deferred = null; });
            } else if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS/i.test(navigator.userAgent)) {
                /* iOS Safari：不支持自动安装，给教学提示 */
                showBanner('🍞 <span>' + (en ? 'Add <b>MaiRiJi</b> to Home Screen: tap <b>Share</b> ⬆ then "<b>Add to Home Screen</b>"' : '把<b>麦日记</b>加到主屏幕：点浏览器 <b>分享</b> ⬆ → 「<b>添加到主屏幕</b>」') + '</span>' +
                    '<button class="mrj-pwa-no" style="border:none;background:none;color:#a8977f;font-size:17px;cursor:pointer;line-height:1">&times;</button>');
            }
        }, 30000);
    },

    pushModalState: function (stateName) {
        history.pushState({ modal: stateName }, '', window.location.pathname + window.location.search);
        this.pushedStateCount = (this.pushedStateCount || 0) + 1;
    },

    popModalStateIfNeeded: function (fromPopState) {
        if (!fromPopState && this.pushedStateCount > 0) {
            this.pushedStateCount--;
            this.isProgrammaticPop = true;
            history.back();
        }
    },

    updateScrollMetrics: function () {
        if (this.isMobile() || !this.$els.scrollWrapper || this.$els.scrollWrapper.length === 0) return;

        this.scrollMetrics = {
            winHeight: $(window).height(),
            winWidth: $(window).width(),
            wrapperTop: this.$els.scrollWrapper.offset().top,
            wrapperHeight: this.$els.scrollWrapper.height(),
            trackWidth: this.$els.savoriaTrack.outerWidth(),
            contentWrapHeight: this.$els.savoriaContentWrap.outerHeight()
        };
    },

    renderProducts: function () {
        const langKey = this.getCurrentLanguage();

        if (this.productsData && this.productsData[langKey]) {
            this.breadProducts = this.productsData[langKey].bread || [];
            this.cakeProducts = this.productsData[langKey].cake || [];
        } else {
            this.breadProducts = [];
            this.cakeProducts = [];
        }

        this.renderProductGroup('bread', this.breadProducts, this.t('menu.bread_title'));
        this.renderProductGroup('cake', this.cakeProducts, this.t('menu.cake_title'));
        this.reconcileCart(); /* 价格改动/商品下架 → 旧购物车自动对账 */
    },

    shuffleArray: function (array) {
        const arr = array.slice();
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    renderProductGroup: function (type, products, title) {
        const isEnglish = this.getCurrentLanguage() === 'en';
        let html = '';
        const folder = type === 'cake' ? 'cake' : 'bread';

        products.forEach((item) => {
            const highResNormal = `assets/img/${folder}/${item.img}.webp`;
            const highResHover = `assets/img/${folder}/${item.img}-hover.webp`;

            const isComingSoon = item.status === 'coming_soon';
            const badgeHtml = isComingSoon ?
                `<span class="coming-soon-badge">${isEnglish ? 'Coming Soon' : '敬请期待'}</span>` :
                '';

            html += `
            <li class="grid__item slider__slide">
                <a href="#product-detail" class="product-card-wrapper card-wrapper open-detail-btn" data-type="${type}" data-id="${item.id}" style="background: transparent; border: none; box-shadow: none; padding: 0; display: block; cursor: none;">
                    <div class="stack-container">
                        ${badgeHtml}
                        <div class="polaroid card-bottom">
                            <div class="photo-area" style="background-color: ${type === 'cake' ? '#fdf7ef' : 'var(--bg-cream)'};"></div>
                        </div>

                        <div class="polaroid card-middle-hover">
                            <div class="photo-area progressive-bg shimmer-glass" 
                                 data-highres="${highResHover}">
                            </div>
                        </div>

                        <div class="polaroid card-front">
                            <div class="photo-area progressive-bg shimmer-glass" 
                                 data-highres="${highResNormal}">
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-information" style="padding-top: 10px; text-align: center;">
                        <div class="card-information__wrapper">
                            <span class="card-information__text">${item.name}</span>
                            <div class="price">${item.oldPrice ? `<span class="price-old">RM ${item.oldPrice}</span> ` : ''}<span class="price-item ${item.oldPrice ? 'price-promo' : ''}">RM ${item.price}</span></div>
                        </div>
                    </div>
                </a>
            </li>
            `;
        });

        if (type === 'bread') {
            $('#product-list').html(html);
            this.$els.menuTitle.text(title);
        } else {
            $('#cake-product-list').html(html);
        }

        this.loadHighResImages();
    },

    renderSavoriaCards: function (folder = 'bread') {
        const isEnglish = this.getCurrentLanguage() === 'en';
        const photoBuckets = { bread: ['1', '2', '3', '4', '5', '6', '7'] };
        const availablePhotos = photoBuckets[folder] || photoBuckets.bread;
        const selectedPhotos = this.shuffleArray(availablePhotos).slice(0, 7);

        let html = '';

        selectedPhotos.forEach((photoName, index) => {
            const dirClass = index % 2 === 0 ? 'up' : 'down';
            const displayLabels = isEnglish ? ['Signature', '', 'Fresh', '', 'Sweet', '', ''] : ['Signature / 招牌', '', 'Fresh / 新鲜', '', 'Sweet / 甜点', '', ''];
            const displayLabel = displayLabels[index] || '';
            const highResUrl = `assets/img/${folder}/${photoName}.webp`;

            const overlayHtml = displayLabel ? `<div class="card-overlay"><span>${displayLabel}</span></div>` : '';
            html += `
            <div class="savoria-card ${dirClass}">
                <div class="img-holder progressive-bg shimmer-glass" 
                     data-highres="${highResUrl}"></div>
                ${overlayHtml}
            </div>
            `;
        });

        $('#savoria-track-container').prepend(html);
        $('#savoria-mobile-clones').html(html);

        this.$els.savoriaCards = $('.savoria-card');
        this.loadHighResImages();
    },

    loadHighResImages: function () {
        const observerOptions = {
            root: null,
            rootMargin: '300px 0px',
            threshold: 0.01
        };

        if ('IntersectionObserver' in window) {
            if (!this.lazyImageObserver) {
                this.lazyImageObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const $el = $(entry.target);
                            this.fetchSingleImage($el);
                            observer.unobserve(entry.target);
                        }
                    });
                }, observerOptions);
            }

            $('.progressive-bg, .shimmer-glass').each((_, el) => {
                const $el = $(el);
                if ($el.data('highres') && !$el.data('loaded')) {
                    this.lazyImageObserver.observe(el);
                }
            });
        } else {
            $('.progressive-bg, .shimmer-glass').each((_, el) => {
                this.fetchSingleImage($(el));
            });
        }
    },

    fetchSingleImage: function ($el) {
        const highResUrl = $el.data('highres');
        if (highResUrl && !$el.data('loaded')) {
            $el.data('loaded', true);
            const img = new Image();

            img.onload = () => {
                $el.css('background-image', `url('${highResUrl}')`);
                $el.removeClass('blur-effect shimmer-glass');
            };

            img.onerror = () => {
                $el.removeClass('blur-effect shimmer-glass');
                $el.css({
                    'background-image': "url('assets/img/logo/logo-mini-black.png')",
                    'background-size': '40% auto',
                    'background-color': '#f2eae1'
                });
            };

            img.src = highResUrl;
        }
    },

    switchMenuView: function (view, animate) {
        const doSwitch = () => {
            this.$els.menuSwitcherBtn.removeClass('active').filter(`[data-view="${view}"]`).addClass('active');
            this.$els.menuView.removeClass('active').filter(`[data-view-panel="${view}"]`).addClass('active');
            this.$els.menuBannerPanel.removeClass('active').filter(`[data-banner-view="${view}"]`).addClass('active');

            this.$els.menuTitle.text(view === 'cake' ? this.t('menu.cake_title') : this.t('menu.bread_title'));

            try {
                this.initStickyNav();
            } catch (e) {
                console.warn("Sticky nav re-init notice:", e);
            }
        };

        if (!animate) {
            doSwitch();
            return;
        }

        // 菜单 Tab 切换：内容淡出下沉 → 换画面 → 淡入浮起（丝滑无蒙版）
        this.playMenuFade(doSwitch);
    },

    // 🌾 菜单内容"蒙一下"过场：渐渐蒙（模糊+变淡但仍隐约可见）→ 换画面 → 慢慢变清楚
    playMenuFade: function (callback) {
        if (this.isMaskTransitioning) { if (callback) callback(); return; }
        this.isMaskTransitioning = true;

        if (!this._menuFadeCss) {
            this._menuFadeCss = true;
            $('<style>' +
              '.mrj-fade-zone{transition:opacity .35s ease,filter .35s ease}' +
              '.mrj-fade-out{opacity:.45 !important;filter:blur(6px) saturate(.8)}' +
              '</style>').appendTo('head');
        }

        // 只对菜单内容 + 顶部横幅做过渡（不是全屏蒙版）
        const $zone = $('#bakery-menu-container, .menu-hero-banner-container');
        $zone.addClass('mrj-fade-zone');

        // ① 渐渐蒙上：模糊 + 变淡（但看得见轮廓，不是黑掉/白掉）
        $zone.addClass('mrj-fade-out');
        setTimeout(() => {
            // ② 蒙着的时候换内容（用户只看到画面朦胧中变了）
            if (callback) callback();
            // ③ 双 rAF 确保新内容以蒙状态渲染，然后慢慢变清楚
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    $zone.removeClass('mrj-fade-out');
                    setTimeout(() => {
                        $zone.removeClass('mrj-fade-zone');
                        this.isMaskTransitioning = false;
                    }, 380);
                });
            });
        }, 360);
    },

    bindEvents: function () {
        /* 💰 促销价样式（划线原价 + 红色现价），一次性注入 */
        if (!document.getElementById('mrj-promo-css')) {
            const st = document.createElement('style');
            st.id = 'mrj-promo-css';
            st.textContent = '.price-old{text-decoration:line-through;color:#b3a28c;font-size:.85em;margin-right:4px}' +
                '.price-promo{color:#c0392b;font-weight:700}';
            document.head.appendChild(st);
        }
        this.initStickyNav();

        $('#lang-float').off('click').on('click', (e) => {
            e.preventDefault();
            this.switchLanguage();
        });

        if (!this.isMobile()) {
            const loader = new WnkMediaLoader($('img'), this);
            $(this).one(loader.eventName, () => this.onLoad());
            loader.load();
        }

        $('.m-burger').on('click', (e) => {
            const $this = $(e.currentTarget);
            const isOpen = this.$els.body.toggleClass('menuOpen').hasClass('menuOpen');
            $this.attr('aria-expanded', isOpen ? 'true' : 'false');
            if (isOpen) {
                this.pushModalState('mobile-menu');
            } else {
                this.popModalStateIfNeeded(false);
            }
        });

        $('.nav-link').on('click', (e) => {
            e.preventDefault();
            const $link = $(e.currentTarget);
            const targetId = $link.data('target');
            if ($(`#${targetId}`).hasClass('active-view')) return;

            this.handlePageTransition($link);
        });

        $(document).on('click', 'a.down, a.scroll-link', (e) => {
            e.preventDefault();
            const targetId = $(e.currentTarget).attr('href');
            const $target = $(targetId);
            if ($target.length > 0) {
                $('html, body').animate({
                    scrollTop: $target.offset().top - 60
                }, 800);
            }
        });

        this.activeObservers = { horizontal: true, parallax: true };

        if ('IntersectionObserver' in window) {
            const observerOptions = { root: null, rootMargin: '500px 0px', threshold: 0 };

            const hScrollEl = document.querySelector('.horizontal-scroll-wrapper');
            if (hScrollEl) {
                const hObserver = new IntersectionObserver((entries) => {
                    this.activeObservers.horizontal = entries[0].isIntersecting;
                }, observerOptions);
                hObserver.observe(hScrollEl);
            }

            const pTargets = document.querySelectorAll('section.intro, header.intro, .full-width-image-divider');
            if (pTargets.length > 0) {
                const pObserver = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        entry.target._isPVisible = entry.isIntersecting;
                    });

                    let isAnyVisible = false;
                    pTargets.forEach((el) => {
                        if (el._isPVisible) isAnyVisible = true;
                    });
                    this.activeObservers.parallax = isAnyVisible;
                }, observerOptions);

                pTargets.forEach((el) => pObserver.observe(el));
            }
        }

        let ticking = false;
        $(window).on('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollTop = $(window).scrollTop();

                    if (this.activeObservers.horizontal) {
                        this.handleHorizontalScroll(scrollTop);
                    }

                    if (this.activeObservers.parallax && this.wax && this.wax.enabled) {
                        this.wax.onFrame();
                    }

                    ticking = false;
                });
                ticking = true;
            }
        });

        $(window).on('resize', () => {
            this.updateScrollMetrics();

            if (this.wax && this.wax.elements) {
                for (let i = 0; i < this.wax.elements.length; i++) {
                    this.wax.elements[i].onResize();
                }
            }
            if (typeof Waypoint !== 'undefined' && Waypoint.refreshAll) {
                Waypoint.refreshAll();
            }
        });

        $(document).on('click', '.wheat-btn[data-link]', (e) => {
            const $btn = $(e.currentTarget);
            const targetUrl = $btn.attr('data-link');

            if (!$btn.hasClass('clicked')) {
                $btn.addClass('clicked');

                setTimeout(() => {
                    if (targetUrl && targetUrl.length > 0) {
                        window.open(targetUrl, '_blank');
                    }
                }, 800);

                setTimeout(() => {
                    $btn.removeClass('clicked');
                }, 1500);
            }
        });

        this.$els.menuSwitcherBtn.on('click', (e) => {
            const target = $(e.currentTarget).data('view');
            this.switchMenuView(target, true);
        });

        $(document).on('click', '.open-detail-btn', (e) => {
            e.preventDefault();
            const $btn = $(e.currentTarget);
            const type = $btn.data('type');
            const id = $btn.data('id');
            this.openProductDetail(type, id);
        });

        $(document).on('click', '.close-detail-btn', (e) => {
            e.preventDefault();
            this.closeProductDetail();
        });

        this.openCart = () => {
            this.pushModalState('cart-drawer');
            this.$els.cartDrawer.addClass('open');
            this.$els.cartBackdrop.addClass('show');
            this.$els.body.addClass('no-scroll');
        };

        this.closeCart = (fromPopState = false) => {
            this.$els.cartDrawer.removeClass('open');
            this.$els.cartBackdrop.removeClass('show');
            if (!this.$els.detailPanel.hasClass('open')) {
                this.$els.body.removeClass('no-scroll');
            }
            this.popModalStateIfNeeded(fromPopState);
        };

        $('#cart-float, .open-cart-btn').on('click', (e) => {
            e.preventDefault();
            this.openCart();
        });
        $('.close-cart-btn, #cart-backdrop').on('click', () => {
            this.closeCart();
        });

        $(document).on('click', '.cart-qty-plus', (e) => {
            const id = $(e.currentTarget).closest('.cart-item').data('id');
            this.changeCartItemQty(id, 1);
        });
        $(document).on('click', '.cart-qty-minus', (e) => {
            const id = $(e.currentTarget).closest('.cart-item').data('id');
            this.changeCartItemQty(id, -1);
        });
        $(document).on('click', '.cart-item-del', (e) => {
            const id = $(e.currentTarget).closest('.cart-item').data('id');
            this.removeCartItem(id);
        });

        $('#cart-checkout-btn').on('click', (e) => {
            e.preventDefault();
            if (!this.cart || this.cart.length === 0) {
                this.showToast(this.getCurrentLanguage() === 'en' ? 'Your basket is empty!' : '购物篮还是空的哦！');
                return;
            }
            this.openCheckoutModal();
        });

        $('#close-checkout-modal, #checkout-modal-backdrop').on('click', () => {
            this.closeCheckoutModal();
        });

        $(document).on('input', '#checkout-form input, #checkout-form textarea', (e) => {
            this.clearFieldError($(e.currentTarget));
        });

        $('#checkout-form').off('submit').on('submit', (e) => {
            e.preventDefault();
            const $form = $(e.currentTarget);
            const $btn = $form.find('.wheat-btn');
            const name = $('#cust-name').val().trim();
            const phone = $('#cust-phone').val().trim();
            const address = $('#cust-address').val().trim();
            const date = $('#cust-date').val();
            const zoneVal = $('#cust-delivery-zone').val();
            const postcode = ($('#cust-postcode').val() || '').trim();
            const isEnglish = this.getCurrentLanguage() === 'en';

            this.clearFieldError($('#cust-name'));
            this.clearFieldError($('#cust-phone'));
            this.clearFieldError($('#cust-address'));
            this.clearFieldError($('#cust-postcode'));
            this.clearFieldError($('#cust-date'));

            if (!name) {
                this.showFieldError($('#cust-name'), isEnglish ? 'Please enter your name' : '请填写联系姓名');
                return;
            }
            if (!phone) {
                this.showFieldError($('#cust-phone'), isEnglish ? 'Please enter your phone number' : '请填写联系电话');
                return;
            }
            
            if (!this.isValidPhone(phone)) {
                this.showFieldError($('#cust-phone'), isEnglish ? 
                    'Invalid phone format (e.g. 011-2956 9555 or 012-345 6789)' : 
                    '电话号码格式不正确，请检查位数是否有多打或少打');
                return;
            }

            /* 🚚 v4.4：配送必须有邮编，且邮编要在范围内（42600/42700/42800） */
            const dCfg = this.config.delivery;
            let pcTier = '';
            if (zoneVal === 'delivery') {
                if (!/^\d{5}$/.test(postcode)) {
                    this.showFieldError($('#cust-postcode'), isEnglish ? 'Please enter your 5-digit postcode' : '请填写 5 位数字邮编');
                    return;
                }
                pcTier = dCfg.postcodes[postcode] || '';
                if (!pcTier) {
                    this.showFieldError($('#cust-postcode'), isEnglish ?
                        'This postcode is outside our delivery range. Please choose Self-Pickup.' :
                        '该邮编超出配送范围，请选择【到店自提】哦！');
                    return;
                }
                if (!address) {
                    this.showFieldError($('#cust-address'), isEnglish ? 'Please enter delivery address' : '请填写详细配送地址');
                    return;
                }
            }
            
            if (!date) {
                this.showFieldError($('#cust-date'), isEnglish ? 'Please select preferred date & time' : '请选择期望送货/取货时间');
                return;
            }

            /* 🕐 v4.4：36 小时下限（欧包极限制作 24h，留足发酵与排产时间） */
            const minStr = this.minPickupTimeStr();
            if (date < minStr) {
                this.showFieldError($('#cust-date'), isEnglish ?
                    `Sourdough needs long fermentation — earliest available: ${minStr.replace('T', ' ')} (36 hours ahead)` :
                    `酸种欧包需要长时间发酵，最早可选 ${minStr.replace('T', ' ')}（至少提前 36 小时）`);
                return;
            }

            /* 🚚 Banting 方向未满起送线：可以下单，但先跟顾客说清楚要等拼单 */
            const cartTotal = (this.cart || []).reduce((s, it) => s + it.price * it.qty, 0);
            const isPooled = (pcTier === 'far' && cartTotal < dCfg.farMinRM);

            const zoneLabels = {
                pickup: isEnglish ? "Self-Pickup (Tanjong Sepat)" : "Tanjong Sepat 店面自提",
                delivery: isEnglish ? `Delivery (Postcode ${postcode})` : `配送上门（邮编 ${postcode}）`
            };
            let deliveryZoneText = zoneLabels[zoneVal] || zoneVal;
            if (isPooled) {
                deliveryZoneText += isEnglish ?
                    ` [${dCfg.farName} pooled delivery — below RM${dCfg.farMinRM}, date TBC]` :
                    ` [${dCfg.farName}方向拼单配送 — 未满RM${dCfg.farMinRM}，送达日期待确认]`;
            }

            if (name) localStorage.setItem(this.config.storageKeys.custName, name);
            if (phone) localStorage.setItem(this.config.storageKeys.custPhone, phone);
            if (address && zoneVal !== 'pickup') localStorage.setItem(this.config.storageKeys.custAddress, address);
            if (postcode && zoneVal === 'delivery') localStorage.setItem(this.config.storageKeys.custPostcode, postcode);

            if (this.config.googleSheetUrl && this.config.googleSheetUrl.indexOf("http") === 0) {
                fetch(this.config.googleSheetUrl, {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: name, phone: phone })
                }).catch((err) => {
                    console.warn("后台 VIP 同步提醒:", err);
                });
            }

            $btn.addClass('clicked');

            setTimeout(() => {
                this.closeCheckoutModal();

                const orderData = {
                    name: name,
                    phone: phone,
                    address: address,
                    date: date,
                    deliveryZone: deliveryZoneText,
                    postcode: postcode,
                    pooled: isPooled /* 🚚 Banting方向未满RM50：等拼单 */
                };
                if (window.MRJMailbox && window.MRJMailbox.placeOrder) {
                    window.MRJMailbox.placeOrder(this, orderData);
                } else {
                    // 插件没加载成功时兜底：走原来的 WhatsApp 流程
                    this.checkoutWhatsApp(orderData);
                }
                // 感谢弹窗改由插件在提交成功后显示（失败保留购物车+WhatsApp兜底）

                $btn.removeClass('clicked');
            }, 800);
        });

        $('#insta-flash-btn').on('click', (e) => {
            e.preventDefault();
            const $btn = $(e.currentTarget);
            const url = "https://www.instagram.com/mywheatdiary/";

            if (!$btn.hasClass('shutter-active')) {
                $btn.addClass('shutter-active');

                setTimeout(() => {
                    const newWin = window.open(url, '_blank');
                    if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
                        window.location.href = url;
                    }
                }, 400);

                setTimeout(() => {
                    $btn.removeClass('shutter-active');
                }, 800);
            }
        });

        $(document).on('click', '#get-gps-btn', (e) => {
            e.preventDefault();
            this.openGPSModal();
        });

        $('#close-gps-modal, #gps-modal-backdrop').on('click', () => {
            this.closeGPSModal();
        });

        $('#gps-confirm-form').off('submit').on('submit', (e) => {
            e.preventDefault();
            const unit = $('#gps-unit').val().trim();
            const street = $('#gps-street').val().trim();
            const coords = $('#gps-coords').val().trim();
            const isEnglish = this.getCurrentLanguage() === 'en';

            if (!unit) {
                this.showToast(isEnglish ? 'Please enter your house or unit number.' : '请补充填写门牌号或楼层单位。');
                return;
            }

            const cleanCoords = coords.replace(/\s+/g, '');
            const googleMapsUrl = `https://maps.google.com/?q=${cleanCoords}`;
            const finalAddressText = (isEnglish ? "Unit/House No: " : "门牌单位：") + unit + "\n" +
                (isEnglish ? "Street/Area: " : "详细区域：") + street + "\n" +
                "Google Maps: " + googleMapsUrl;

            $('#cust-address').val(finalAddressText);

            this.closeGPSModal();
        });

        $(document).on('keyup', (e) => {
            if (e.key === 'Escape') {
                if ($('#gps-confirm-modal').hasClass('show')) {
                    this.closeGPSModal();
                } else if ($('#checkout-modal').hasClass('show')) {
                    this.closeCheckoutModal();
                } else if (this.$els.cartDrawer.hasClass('open')) {
                    this.closeCart();
                } else if (this.$els.detailPanel.hasClass('open')) {
                    this.closeProductDetail();
                }
            }
        });

        $(document).on('click', '.accordion-header', (e) => {
            const $btn = $(e.currentTarget);
            const $parent = $btn.closest('.detail-accordions');
            const $content = $btn.next('.accordion-content');
            const isActive = $btn.hasClass('active');

            $parent.find('.accordion-header').not($btn).removeClass('active').attr('aria-expanded', 'false');
            $parent.find('.accordion-content').not($content).stop(true, true).slideUp(250);

            if (isActive) {
                $btn.removeClass('active').attr('aria-expanded', 'false');
                $content.stop(true, true).slideUp(250);
            } else {
                $btn.addClass('active').attr('aria-expanded', 'true');
                $content.stop(true, true).slideDown(250);
            }
        });

        $(document).on('input', '#cust-address', (e) => {
            $(e.currentTarget).removeAttr('data-is-auto-filled');
        });

        /* 🚚 v4.4：只剩 自取/配送 两个选项；选配送时展开 邮编+地址 栏 */
        $(document).on('change', '#cust-delivery-zone', (e) => {
            const val = $(e.currentTarget).val();
            const isEnglish = this.getCurrentLanguage() === 'en';
            const $addressGroup = $('#cust-address-group');
            const $postcodeGroup = $('#cust-postcode-group');
            const $notice = $('#zone-notice');
            const $pickupInfo = $('#cust-pickup-info');
            const $addressInput = $('#cust-address');

            const pickupAddress = "65, Jalan Pelangi 12, Taman Pelangi, 42800 Tanjong Sepat";
            const pickupLabel = isEnglish ? "(Self-Pickup)" : "(店面自提)";

            if (val === 'pickup') {
                $addressGroup.slideUp(200);
                $postcodeGroup.slideUp(200);
                $notice.slideUp(200);
                $pickupInfo.slideDown(200);
                
                $addressInput.val(`${pickupAddress} ${pickupLabel}`).attr('data-is-auto-filled', 'true');
            } else {
                $addressGroup.slideDown(200);
                $postcodeGroup.slideDown(200);
                $notice.slideUp(200);
                $pickupInfo.slideUp(200);
                
                if ($addressInput.attr('data-is-auto-filled') === 'true') {
                    const savedAddress = localStorage.getItem(this.config.storageKeys.custAddress) || '';
                    $addressInput.val(savedAddress).removeAttr('data-is-auto-filled');
                }
                this.validatePostcodeUI();
            }
        });

        /* 🚚 邮编即时验证 + 地址栏失焦自动抓邮编 */
        $(document).on('input', '#cust-postcode', () => {
            this.validatePostcodeUI();
        });
        $(document).on('blur', '#cust-address', () => {
            this.tryAutofillPostcode();
        });

        $('#close-thankyou-btn, #thankyou-modal-backdrop').on('click', () => {
            $('#thankyou-modal-backdrop').removeClass('show');
            $('#thankyou-modal').removeClass('show');
            this.$els.body.removeClass('no-scroll');
        });

        $('#open-vip-btn').off('click').on('click', (e) => {
            e.preventDefault();
            const isEn = this.getCurrentLanguage() === 'en';
            const savedName = localStorage.getItem(this.config.storageKeys.custName);
            const savedPhone = localStorage.getItem(this.config.storageKeys.custPhone);
            const savedAddress = localStorage.getItem(this.config.storageKeys.custAddress);

            if (this.$els.body.hasClass('menuOpen')) this.$els.body.removeClass('menuOpen');

            if (savedName) {
                $('#profile-display-name').text(savedName);
                $('#profile-display-phone').text(savedPhone || (isEn ? "Not provided" : "未填写"));
                $('#profile-display-address').text(savedAddress || (isEn ? "No default address saved" : "暂无保存的默认地址"));

                $('#vip-profile-backdrop').addClass('show');
                $('#vip-profile-modal').addClass('show');
                this.$els.body.addClass('no-scroll');
                /* 🌾 麦粒积分：由插件异步填充（缓存秒显 + 后台刷新） */
                if (window.MRJMailbox && window.MRJMailbox.fillPoints) window.MRJMailbox.fillPoints();
            } else {
                $('#vip-modal-backdrop').addClass('show');
                $('#vip-register-modal').addClass('show');
                this.$els.body.addClass('no-scroll');
            }
        });

        $('#close-vip-profile-modal, #vip-profile-close-btn, #vip-profile-backdrop').on('click', () => {
            $('#vip-profile-backdrop').removeClass('show');
            $('#vip-profile-modal').removeClass('show');
            if (!this.$els.detailPanel.hasClass('open') && !this.$els.cartDrawer.hasClass('open')) {
                this.$els.body.removeClass('no-scroll');
            }
        });

        $('#vip-logout-btn').on('click', () => {
            const isEn = this.getCurrentLanguage() === 'en';

            localStorage.removeItem(this.config.storageKeys.custName);
            localStorage.removeItem(this.config.storageKeys.custPhone);
            localStorage.removeItem(this.config.storageKeys.custAddress);

            $('#vip-profile-backdrop').removeClass('show');
            $('#vip-profile-modal').removeClass('show');
            if (!this.$els.detailPanel.hasClass('open') && !this.$els.cartDrawer.hasClass('open')) {
                this.$els.body.removeClass('no-scroll');
            }

            this.updateVIPBtnUI();

            this.showToast(isEn ? "Signed out & profile cleared." : "已成功退出并清除档案。");
        });

        $('#close-vip-modal, #vip-modal-backdrop').on('click', () => {
            $('#vip-modal-backdrop').removeClass('show');
            $('#vip-register-modal').removeClass('show');
            if (!this.$els.detailPanel.hasClass('open') && !this.$els.cartDrawer.hasClass('open')) {
                this.$els.body.removeClass('no-scroll');
            }
        });

        $('#vip-register-form').off('submit').on('submit', (e) => {
            e.preventDefault();
            const isEn = this.getCurrentLanguage() === 'en';
            const name = $('#vip-name').val().trim();
            const phone = $('#vip-phone').val().trim();
            const $btn = $('#vip-submit-btn');

            if (!name || !phone) {
                this.showToast(isEn ? "Please enter your name and phone number." : "请填写姓名与手机号码哦。");
                return;
            }

            if (!this.isValidPhone(phone)) {
                this.showToast(isEn ? "Please enter a valid phone number (e.g. 01115277643 or 0123456789)." : "手机号码格式不正确，请检查位数是否有多打或少打。");
                return;
            }

            $btn.css({'opacity': '0.7', 'pointer-events': 'none'});
            $btn.find('.btn-txt.default').text(isEn ? "Saving..." : "档案生成中...");

            const restoreBtn = () => {
                $btn.css({'opacity': '1', 'pointer-events': 'auto'});
                $btn.find('.btn-txt.default').text(isEn ? "Create My Profile" : "生成我的专属档案");
            };
            const saveLocal = () => {
                localStorage.setItem(this.config.storageKeys.custName, name);
                localStorage.setItem(this.config.storageKeys.custPhone, phone);
                this.showToast(isEn ? `Successfully joined! Welcome, ${name}` : `注册成功！麦日记欢迎您，${name}`);
                restoreBtn();
                $('#close-vip-modal').trigger('click');
                this.updateVIPBtnUI();
            };
            /* 🌟 VIP 注册走信箱（和下单同一 token，麦粒积分自动挂钩） */
            if (window.MRJMailbox && window.MRJMailbox.vipRegister) {
                window.MRJMailbox.vipRegister(name, phone)
                    .then(saveLocal)
                    .catch(() => { restoreBtn(); this.showToast(isEn ? "Network error, please try again." : "网络波动，请稍后再试。"); });
            } else {
                /* 插件没加载：仍存本地，不阻断 */
                saveLocal();
            }
        });

        $(document).on('click', '.quick-link-card', (e) => {
            const tab = $(e.currentTarget).data('guide-tab');
            if (tab === 'contact') {
                /* v4.12：不再跳 WhatsApp，打开站内客服咨询聊天（开场白里有 WhatsApp 可选链接） */
                if (window.MRJMailbox && window.MRJMailbox.openAsk) {
                    window.MRJMailbox.openAsk();
                    return;
                }
                /* 插件没加载时兜底：老流程跳 WhatsApp */
                const isEn = this.getCurrentLanguage() === 'en';
                const waMessage = this.t('contact.wa_msg') || (isEn ? 
                    "Hello MaiRiji! I would like to inquire about custom orders and pre-orders." : 
                    "你好，麦日记！我想咨询关于预定与客制化烘焙的问题。");
                const waUrl = `https://wa.me/${this.config.waNumber}?text=${encodeURIComponent(waMessage)}`;
                window.open(waUrl, '_blank');
                return;
            }

            $('.guide-tab-btn').removeClass('active').filter(`[data-tab="${tab}"]`).addClass('active');
            $('.guide-tab-content').removeClass('active').filter(`#guide-tab-${tab}`).addClass('active');

            $('#guide-modal-backdrop').addClass('show');
            $('#guide-modal').addClass('show');
            this.$els.body.addClass('no-scroll');
        });

        $(document).on('click', '.guide-tab-btn', (e) => {
            const $btn = $(e.currentTarget);
            const tab = $btn.data('tab');
            $('.guide-tab-btn').removeClass('active');
            $btn.addClass('active');
            $('.guide-tab-content').removeClass('active').filter(`#guide-tab-${tab}`).addClass('active');
        });

        $('#close-guide-modal, #guide-modal-backdrop').on('click', () => {
            $('#guide-modal-backdrop').removeClass('show');
            $('#guide-modal').removeClass('show');
            if (!this.$els.detailPanel.hasClass('open') && !this.$els.cartDrawer.hasClass('open')) {
                this.$els.body.removeClass('no-scroll');
            }
        });

        $(document).on('click', '.stage-pet', (e) => {
            const $pet = $(e.currentTarget);
            const entryId = $pet.data('entry');

            $pet.addClass('clicked');
            setTimeout(() => $pet.removeClass('clicked'), 500);

            const icons = { '1': '🥐', '2': '🍞', '3': '🍥' };
            
            const title = this.t(`diary_stage.entry${entryId}_title`);
            const content = this.t(`diary_stage.entry${entryId}_content`);

            $('#diary-read-icon').text(icons[entryId] || '📖');
            $('#diary-read-title').text(title);
            $('#diary-read-content').text(content);

            $('#diary-modal-backdrop').addClass('show');
            $('#diary-read-modal').addClass('show');
            this.$els.body.addClass('no-scroll');
        });

        $('#close-diary-modal, #close-diary-btn, #diary-modal-backdrop').on('click', () => {
            $('#diary-modal-backdrop').removeClass('show');
            $('#diary-read-modal').removeClass('show');
            if (!this.$els.detailPanel.hasClass('open') && !this.$els.cartDrawer.hasClass('open')) {
                this.$els.body.removeClass('no-scroll');
            }
        });

        // 统一响应式触发：针对商品详情页动作按钮进行处理
        $(document).on('click', '#detail-order-btn, #detail-order-btn-sticky', (e) => {
            e.preventDefault();
            const type = this.$els.detailPanel.data('type');
            const id = this.$els.detailPanel.data('id');
            const products = type === 'cake' ? this.cakeProducts : this.breadProducts;
            const item = products.find(p => p.id === id);
            
            if (!item) return;

            if (item.status === 'coming_soon') {
                const isEnglish = this.getCurrentLanguage() === 'en';
                const inqText = isEnglish ?
                    `Hello MaiRiji! I saw ${item.name} on your website and am super interested. When will it be available?` :
                    `你好，麦日记！我在网站看到了【${item.name}】，非常感兴趣！请问大约什么时候会上市上架呢？`;
                const inqUrl = `https://wa.me/${this.config.waNumber}?text=${encodeURIComponent(inqText)}`;
                window.open(inqUrl, '_blank');
            } else {
                this.addToCart(item, type, this.detailQty || 1);
                this.closeProductDetail();
                this.openCart();
            }
        });

        $(window).off('popstate.modalHandler').on('popstate.modalHandler', () => {
            if (this.isProgrammaticPop) {
                this.isProgrammaticPop = false;
                return;
            }

            if (this.pushedStateCount > 0) {
                this.pushedStateCount--;
            }

            if ($('#gps-confirm-modal').hasClass('show')) {
                this.closeGPSModal(true);
            } 
            else if ($('#thankyou-modal').hasClass('show')) {
                $('#thankyou-modal-backdrop, #thankyou-modal').removeClass('show');
                this.$els.body.removeClass('no-scroll');
            } 
            else if ($('#checkout-modal').hasClass('show')) {
                this.closeCheckoutModal(true);
            } 
            else if ($('#vip-register-modal').hasClass('show')) {
                $('#vip-modal-backdrop, #vip-register-modal').removeClass('show');
                this.$els.body.removeClass('no-scroll');
            } 
            else if ($('#vip-profile-modal').hasClass('show')) {
                $('#vip-profile-backdrop, #vip-profile-modal').removeClass('show');
                this.$els.body.removeClass('no-scroll');
            } 
            else if ($('#guide-modal').hasClass('show')) {
                $('#guide-modal-backdrop, #guide-modal').removeClass('show');
                this.$els.body.removeClass('no-scroll');
            } 
            else if ($('#diary-read-modal').hasClass('show')) {
                $('#diary-modal-backdrop, #diary-read-modal').removeClass('show');
                this.$els.body.removeClass('no-scroll');
            } 
            else if (this.$els.detailPanel.hasClass('open')) {
                this.closeProductDetail(true);
            } 
            else if (this.$els.cartDrawer.hasClass('open')) {
                this.closeCart(true);
            } 
            else if (this.$els.body.hasClass('menuOpen')) {
                this.$els.body.removeClass('menuOpen');
                $('.m-burger').attr('aria-expanded', 'false');
            } 
            else if (!$('#view-home').hasClass('active-view')) {
                const $homeLink = $('.nav-link[data-target="view-home"]');
                if ($homeLink.length > 0) {
                    this.handlePageTransition($homeLink, true);
                }
            }
        });
    },

    openProductDetail: function (type, id) {
        this.savedMainScrollPos = window.pageYOffset || document.documentElement.scrollTop;

        this.$els.detailPanel.data('type', type);
        this.$els.detailPanel.data('id', id);

        const isEnglish = this.getCurrentLanguage() === 'en';
        const els = this.$els;

        const products = type === 'cake' ? this.cakeProducts : this.breadProducts;
        const item = products.find(p => p.id === id);
        if (!item) return;

        const folder = type === 'cake' ? 'cake' : 'bread';
        const isComingSoon = item.status === 'coming_soon';

        const tagsHtml = type === 'cake' ?
            `<span class="detail-tag-badge">🍰 ${this.t('detail.tag_cake_1')}</span><span class="detail-tag-badge">${this.t('detail.tag_cake_2')}</span>` :
            `<span class="detail-tag-badge">🌾 ${this.t('detail.tag_bread_1')}</span><span class="detail-tag-badge">${this.t('detail.tag_bread_2')}</span>`;
        $('#detail-tags').html(tagsHtml);

        els.detailTitle.text(item.name);
        els.detailText.html(item.desc);
        $('#sticky-title').text(item.name);

        const $qtySelector = $('#detail-qty-selector');
        const $inpageBtn = $('#detail-order-btn');
        const $stickyBtn = $('#detail-order-btn-sticky');

        if (isComingSoon) {
            const comingSoonText = isEnglish ? 'Coming Soon' : '敬请期待';
            els.detailPrice.text(comingSoonText);
            $('#sticky-price').text(comingSoonText);

            $qtySelector.hide();

            const inqBtnInnerHtml = `
                <span class="btn-text-wrapper">
                    <span class="btn-txt default">${isEnglish ? 'Inquire Release Date' : '询问预售 / 上市时间'}</span>
                    <span class="btn-txt hover">WhatsApp Us!</span>
                </span>
            `;

            $inpageBtn.html(inqBtnInnerHtml);
            $stickyBtn.html(inqBtnInnerHtml);

        } else {
            if (item.oldPrice) {
                els.detailPrice.html(`<span class="price-old">RM ${item.oldPrice}</span> <span class="price-promo">RM ${item.price}</span>`);
                $('#sticky-price').html(`<span class="price-old" style="font-size:.85em">RM ${item.oldPrice}</span> RM ${item.price}`);
            } else {
                els.detailPrice.text(`RM ${item.price}`);
                $('#sticky-price').text(`RM ${item.price}`);
            }

            $qtySelector.show();

            const addBtnInnerHtml = `
                <span class="btn-text-wrapper">
                    <span class="btn-txt default">${isEnglish ? 'Add to Basket' : '加进购物篮'}</span>
                    <span class="btn-txt hover">Add to Basket</span>
                </span>
            `;

            $inpageBtn.html(addBtnInnerHtml);
            $stickyBtn.html(addBtnInnerHtml);

            this.detailQty = 1;
            $('#detail-qty-val').text(1);

            $('#detail-qty-minus').off('click').on('click', () => {
                if (this.detailQty > 1) {
                    this.detailQty--;
                    $('#detail-qty-val').text(this.detailQty);
                }
            });
            $('#detail-qty-plus').off('click').on('click', () => {
                this.detailQty++;
                $('#detail-qty-val').text(this.detailQty);
            });
        }

        els.detailPanel.find('.accordion-header').removeClass('active').attr('aria-expanded', 'false');
        els.detailPanel.find('.accordion-content').hide();

        els.detailIngredients.text(item.ingredients || '-');
        els.detailAllergens.text(item.allergens || (isEnglish ? "Contains Gluten (Wheat)." : "含有麸质（小麦）。"));

        if (type === 'cake') {
            els.detailStorage.text(this.t('detail.storage_cake'));
            els.detailReheatTitle.text(this.t('detail.serving_suggestion'));
            els.detailReheat.text(this.t('detail.reheat_cake'));
        } else {
            els.detailStorage.text(this.t('detail.storage_bread'));
            els.detailReheatTitle.text(this.t('detail.acc_reheat'));
            els.detailReheat.text(this.t('detail.reheat_bread'));
        }

        const mainHeroUrl = `assets/img/${folder}/${item.img}.webp`;
        els.detailHeroImg.css('background-image', `url('${mainHeroUrl}')`);

        let galleryHtml = `<img src="${mainHeroUrl}" class="active" alt="${item.name}">`;
        if (item.gallery && item.gallery.length > 0) {
            item.gallery.forEach(imgName => {
                const galleryImgUrl = `assets/img/${folder}/${imgName}.webp`;
                if (galleryImgUrl !== mainHeroUrl) {
                    galleryHtml += `<img src="${galleryImgUrl}" alt="${item.name}">`;
                }
            });
        }
        els.detailGallery.html(galleryHtml);

        els.detailGallery.off('click', 'img').on('click', 'img', function () {
            const newSrc = $(this).attr('src');
            els.detailHeroImg.css('background-image', `url('${newSrc}')`);
            els.detailGallery.find('img').removeClass('active');
            $(this).addClass('active');
        });

        const $stickyBar = $('#detail-sticky-bar').removeClass('show');
        const $scrollArea = $('.detail-scroll-area');

        /* 🌟 修复"打开详情页悬浮条闪一下"：面板滑入动画期间锚点位置不可信，
         * 会误判成"锚点不在视口"而弹出悬浮条。开页后 600ms 内不做任何判定，
         * 动画结束、布局稳定后才开始（本来就没要出来，就不要出来）。 */
        const stickyReadyAt = Date.now() + 600;

        const checkStickyVisibility = () => {
            if (Date.now() < stickyReadyAt) return;
            const $anchor = $('#inpage-action-anchor');
            if ($anchor.length === 0) return;

            const rect = $anchor[0].getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

            const isInViewport = (rect.top < viewportHeight) && (rect.bottom > 0);

            if (!isInViewport) {
                $stickyBar.addClass('show');
            } else {
                $stickyBar.removeClass('show');
            }
        };

        $scrollArea.off('scroll.stickyBtn').on('scroll.stickyBtn', checkStickyVisibility);

        setTimeout(checkStickyVisibility, 650); /* 布局稳定后首查 */

        this.pushModalState('product-detail');
        els.detailPanel.addClass('open');
        els.body.addClass('no-scroll');
        els.detailPanel.find('.detail-scroll-area').scrollTop(0);
    },

    closeProductDetail: function (fromPopState = false) {
        this.$els.detailPanel.removeClass('open');
        if (!this.$els.cartDrawer.hasClass('open')) {
            this.$els.body.removeClass('no-scroll');
        }
        if (typeof this.savedMainScrollPos !== 'undefined') {
            window.scrollTo(0, this.savedMainScrollPos);
        }
        this.popModalStateIfNeeded(fromPopState);
    },

    initStickyNav: function () {
        if (typeof Waypoint !== 'undefined' && Waypoint.destroyAll) {
            Waypoint.destroyAll();
        }

        this.$els.mainHeader.removeClass('small');
        $('.home-intro .inner').removeClass('scroll-hide');

        const isHome = $('#view-home').hasClass('active-view');
        const isMenu = $('#view-menu').hasClass('active-view');
        const isDiary = $('#view-diary').hasClass('active-view');

        if (isHome) {
            const $homeTrigger = $('#home-start');
            if ($homeTrigger.length > 0 && typeof Waypoint !== 'undefined') {
                $homeTrigger.waypoint({
                    handler: (dir) => {
                        if (dir === 'down') {
                            this.$els.mainHeader.addClass('small');
                            $('.home-intro .inner').addClass('scroll-hide');
                        } else {
                            this.$els.mainHeader.removeClass('small');
                            $('.home-intro .inner').removeClass('scroll-hide');
                        }
                    },
                    offset: this.$els.mainHeader.height() + 15
                });
            }
        } else if (isMenu) {
            const $menuTrigger = $('.product-showcase-section');
            if ($menuTrigger.length > 0 && typeof Waypoint !== 'undefined') {
                $menuTrigger.waypoint({
                    handler: (dir) => {
                        if (dir === 'down') {
                            this.$els.mainHeader.addClass('small');
                        } else {
                            this.$els.mainHeader.removeClass('small');
                        }
                    },
                    offset: 200
                });
            }
        } else if (isDiary) {
            const $diaryTrigger = $('#view-diary .diary-stage-wrapper');
            if ($diaryTrigger.length > 0 && typeof Waypoint !== 'undefined') {
                $diaryTrigger.waypoint({
                    handler: (dir) => {
                        if (dir === 'down') {
                            this.$els.mainHeader.addClass('small');
                        } else {
                            this.$els.mainHeader.removeClass('small');
                        }
                    },
                    offset: 150
                });
            }
        }

        if (typeof Waypoint !== 'undefined' && Waypoint.refreshAll) {
            Waypoint.refreshAll();
        }
    },

    handleHorizontalScroll: function (scrollTop) {
        if (this.isMobile()) return;

        const { winHeight, wrapperTop, wrapperHeight, trackWidth, winWidth } = this.scrollMetrics;
        if (!wrapperHeight) return;

        const effectiveHeight = wrapperHeight - winHeight;
        const scrollDist = scrollTop - wrapperTop;

        if (scrollDist >= 0 && scrollDist <= effectiveHeight) {
            const progress = scrollDist / effectiveHeight;
            const maxTranslateX = trackWidth - winWidth + (winWidth * 0.3);

            if (this.$els.savoriaTrack[0]) {
                this.$els.savoriaTrack[0].style.transform = `translateX(${-maxTranslateX * progress}px)`;
            }

            const cards = this.$els.savoriaCards.get();
            for (let i = 0; i < cards.length; i++) {
                const isOdd = i % 2 !== 0;
                const val = Math.sin(progress * Math.PI * 2 + (isOdd ? Math.PI : 0)) * 30;
                cards[i].style.transform = `translateY(${val}px)`;
            }
        }
    },

    handlePageTransition: function ($link, fromPopState = false) {
        const targetId = $link.data('target');
        if (!targetId || $(`#${targetId}`).length === 0) return;

        if (!fromPopState && targetId !== 'view-home' && $('#view-home').hasClass('active-view')) {
            this.pushModalState(`view-${targetId}`);
        }

        // 调用牛角包熊转场动画
        this.playVideoTransition(
            // 遮挡瞬间的回调 (切换 DOM 视图)
            () => {
                $('.page-view').removeClass('active-view');
                $(`#${targetId}`).addClass('active-view');

                window.scrollTo(0, 0);
                $('.home-intro .wrap, .page-intro .wrap').css('opacity', '');

                if (this.$els.body.hasClass('menuOpen')) {
                    this.$els.body.removeClass('menuOpen');
                    $('.m-burger').attr('aria-expanded', 'false');
                }
                this.$els.detailPanel.removeClass('open');
                this.$els.body.removeClass('no-scroll');

                const $bg = (targetId === 'view-home') ? $('.home-intro .bg-inner') : $(`#${targetId} .bg-inner`);
                if ($bg.length > 0) {
                    $bg.removeClass('play-zoom');
                    void $bg[0].offsetWidth;
                    $bg.addClass('play-zoom');
                }

                this.initStickyNav();
            }
        );
    },

    onLoad: function () {
        this.wax.addElement($('.page-intro .bg, .home-intro .bg, header.intro .bg'), null, {
            deltaY: 1.2,
            mode: 'translate'
        });

        this.wax.start();
    },

    isMobile: function () {
        const isSmallScreen = window.innerWidth <= 769;
        const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        return isSmallScreen || isTouchDevice;
    },

    initCustomCursor: function () {
        $('html').addClass('custom-cursor-active');

        if (this.isMobile()) {
            $('#custom-cursor').remove();
            return;
        }

        let $cursor = $('#custom-cursor');
        if ($cursor.length === 0) {
            $cursor = $('<div id="custom-cursor"></div>');
            this.$els.body.append($cursor);
        } else {
            $cursor.detach();
            this.$els.body.append($cursor);
        }

        const defaultFrames = [
            'assets/img/cursor/cursor1.png', 'assets/img/cursor/cursor2.png', 'assets/img/cursor/cursor3.png'
        ];
        const pointerFrames = [
            'assets/img/cursor/pointer1.png', 'assets/img/cursor/pointer2.png', 'assets/img/cursor/pointer3.png'
        ];
        const normalClickFrames = [
            'assets/img/cursor/click1.png', 'assets/img/cursor/click2.png'
        ];
        const pointerClickFrames = [
            'assets/img/cursor/ptrClick1.png', 'assets/img/cursor/ptrClick2.png', 'assets/img/cursor/ptrClick3.png'
        ];

        $cursor.empty();
        const imageElements = {};

        const allFrames = [...defaultFrames, ...pointerFrames, ...normalClickFrames, ...pointerClickFrames];
        const uniqueFrames = Array.from(new Set(allFrames));

        uniqueFrames.forEach((src) => {
            const $img = $('<img>').attr('src', src);
            $cursor.append($img);
            imageElements[src] = $img;
        });

        let currentActiveImg = null;

        const setCursorImage = (src) => {
            if (currentActiveImg === imageElements[src]) return;
            if (currentActiveImg) currentActiveImg.hide();
            currentActiveImg = imageElements[src];
            if (currentActiveImg) currentActiveImg.show();
        };

        setCursorImage(defaultFrames[0]);

        const interactiveSelectors = 'a, button, input[type="submit"], .btn';
        let isHovering = false;
        let isClickAnimating = false;
        let currentLoopFrames = defaultFrames;
        let currentFrameIndex = 0;
        let animationTimer = null;

        const updateLoopImage = () => {
            if (isClickAnimating || document.hidden) return;
            currentFrameIndex = (currentFrameIndex + 1) % currentLoopFrames.length;
            setCursorImage(currentLoopFrames[currentFrameIndex]);
        };

        const playClickAnimation = (framesToPlay, onCompleteFrames) => {
            if (isClickAnimating) return;
            isClickAnimating = true;
            currentFrameIndex = 0;

            setCursorImage(framesToPlay[0]);

            const frameDuration = 100;
            const playNextFrame = (index) => {
                if (index < framesToPlay.length) {
                    setCursorImage(framesToPlay[index]);
                    animationTimer = setTimeout(() => {
                        playNextFrame(index + 1);
                    }, frameDuration);
                } else {
                    isClickAnimating = false;
                    currentLoopFrames = onCompleteFrames;
                    currentFrameIndex = -1;
                }
            };

            animationTimer = setTimeout(() => {
                playNextFrame(1);
            }, frameDuration);
        };

        $(document).on('mouseenter', interactiveSelectors, () => {
            isHovering = true;
            if (!isClickAnimating) {
                currentLoopFrames = pointerFrames;
                currentFrameIndex = -1;
                updateLoopImage();
            }
        });

        $(document).on('mouseleave', interactiveSelectors, () => {
            isHovering = false;
            if (!isClickAnimating) {
                currentLoopFrames = defaultFrames;
                currentFrameIndex = -1;
                updateLoopImage();
            }
        });

        $(document).on('mousedown', () => {
            clearTimeout(animationTimer);
            isClickAnimating = false;
            if (isHovering) {
                playClickAnimation(pointerClickFrames, pointerFrames);
            } else {
                playClickAnimation(normalClickFrames, defaultFrames);
            }
        });

        const startCursorTimer = () => {
            if (this.cursorTimer) clearInterval(this.cursorTimer);
            this.cursorTimer = setInterval(updateLoopImage, 200);
        };

        const stopCursorTimer = () => {
            if (this.cursorTimer) {
                clearInterval(this.cursorTimer);
                this.cursorTimer = null;
            }
        };

        startCursorTimer();

        let mouseX = 0, mouseY = 0;
        let cursorTicking = false;

        $(document).on('mousemove.customCursor', (e) => {
            mouseX = e.clientX - 5;
            mouseY = e.clientY - 5;
            
            if (!cursorTicking) {
                requestAnimationFrame(() => {
                    $cursor[0].style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
                    if ($cursor[0].style.display === 'none') $cursor[0].style.display = 'block';
                    cursorTicking = false;
                });
                cursorTicking = true;
            }
        });

        $(document).off('.cursorWindow').on({
            'mouseleave.cursorWindow': () => {
                $cursor.hide();
                stopCursorTimer();
            },
            'mouseenter.cursorWindow': () => {
                if ($cursor.css('display') === 'none') $cursor.show();
                startCursorTimer();
            }
        });
    },

    loadCart: function () {
        try {
            const saved = localStorage.getItem(this.config.storageKeys.cart);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    },

    /* 🛒 购物车对账（v4.13）：产品数据加载后调用——
     * ① 价格以最新 products.json 为准（改价后旧购物车自动更新）
     * ② 已下架（不在菜单里）的商品自动移除并提示顾客 */
    reconcileCart: function () {
        if (!this.cart || !this.cart.length) return;
        const all = [...(this.breadProducts || []), ...(this.cakeProducts || [])];
        if (!all.length) return; /* 数据没加载成功时不动购物车 */
        const isEn = this.getCurrentLanguage() === 'en';
        const removed = [];
        let changed = false;
        this.cart = this.cart.filter(it => {
            const p = all.find(x => x.id === it.id);
            if (!p) { removed.push(it.name); changed = true; return false; } /* 下架商品移除 */
            const now = parseFloat(p.price);
            if (!isNaN(now) && now !== it.price) { it.price = now; changed = true; } /* 价格同步 */
            if (p.name && p.name !== it.name) { it.name = p.name; changed = true; }  /* 名称同步（改名/换语言） */
            return true;
        });
        if (changed) {
            this.saveCart();
            this.updateCartUI();
            if (removed.length) {
                this.showToast(isEn
                    ? `Removed from basket (no longer available): ${removed.join(', ')}`
                    : `已从购物篮移除（暂时下架）：${removed.join('、')}`);
            }
        }
    },

    saveCart: function () {
        try {
            localStorage.setItem(this.config.storageKeys.cart, JSON.stringify(this.cart));
        } catch (e) {}
    },

    getItemDisplayName: function (item) {
        const products = item.type === 'cake' ? this.cakeProducts : this.breadProducts;
        if (products && products.length > 0) {
            const match = products.find(p => p.id === item.id);
            if (match) return match.name;
        }
        return item.name;
    },

    addToCart: function (item, type, qty = 1) {
        this.cart = this.cart || [];
        const existing = this.cart.find(x => x.id === item.id);
        if (existing) {
            existing.qty += qty;
        } else {
            this.cart.push({
                id: item.id,
                name: item.name,
                price: parseFloat(item.price),
                img: item.img,
                type: type,
                qty: qty
            });
        }
        this.saveCart();
        this.updateCartUI();

        this.$els.cartBadge.addClass('bump');
        setTimeout(() => {
            this.$els.cartBadge.removeClass('bump');
        }, 300);
    },

    changeCartItemQty: function (id, delta) {
        const item = this.cart.find(x => x.id === id);
        if (item) {
            item.qty += delta;
            if (item.qty <= 0) {
                this.removeCartItem(id);
                return;
            }
            this.saveCart();
            this.updateCartUI();
        }
    },

    removeCartItem: function (id) {
        this.cart = this.cart.filter(x => x.id !== id);
        this.saveCart();
        this.updateCartUI();
    },

    updateCartUI: function () {
        const els = this.$els;
        let totalQty = 0;
        let totalPrice = 0;
        const isEnglish = this.getCurrentLanguage() === 'en';

        if (!this.cart || this.cart.length === 0) {
            els.cartList.html(`<div class="cart-empty-tip">${isEnglish ? 'Your basket is empty 🥖' : '你的购物篮还是空的 🥖'}</div>`);
            els.cartTotalPrice.text('RM 0.00');
            els.cartBadge.text('0');
            return;
        }

        let html = '';
        this.cart.forEach((item) => {
            totalQty += item.qty;
            totalPrice += item.price * item.qty;
            const folder = item.type === 'cake' ? 'cake' : 'bread';
            const displayName = this.getItemDisplayName(item);

            html += `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-img" style="background-image: url('assets/img/${folder}/${item.img}.webp');"></div>
                <div class="cart-item-info">
                    <div class="cart-item-title">${displayName}</div>
                    <div class="cart-item-price">RM ${item.price.toFixed(2)}</div>
                    <div class="cart-qty-ctrl">
                        <button class="cart-qty-btn cart-qty-minus" title="Reduce">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        <span class="cart-qty-num">${item.qty}</span>
                        <button class="cart-qty-btn cart-qty-plus" title="Increase">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        <span class="cart-item-del" title="${isEnglish ? 'Remove' : '删除'}">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </span>
                    </div>
                </div>
            </div>
            `;
        });

        els.cartList.html(html);
        els.cartTotalPrice.text(`RM ${totalPrice.toFixed(2)}`);
        els.cartBadge.text(totalQty);
    },

    updateVIPBtnUI: function () {
        const existingVIP = localStorage.getItem(this.config.storageKeys.custName);
        const label = existingVIP ? `Hi, ${existingVIP}` : this.t('nav.vip');
        $('#open-vip-btn').attr('data-label', label);
    },

    checkoutWhatsApp: function (customerData) {
        const isEnglish = this.getCurrentLanguage() === 'en';

        if (!this.cart || this.cart.length === 0) {
            this.showToast(isEnglish ? 'Your basket is empty!' : '购物篮还是空的哦！');
            return;
        }

        let totalPrice = 0;
        let totalQty = 0;

        const isVIP = !!localStorage.getItem(this.config.storageKeys.custName);
        const vipBadge = isVIP ? (isEnglish ? " [VIP Member]" : " [VIP会员]") : "";

        let msg = isEnglish ?
            "Hello MaiRiji! I would like to place an order:\n\n" :
            "你好，麦日记！我想预定以下商品：\n\n";

        if (customerData) {
            msg += isEnglish ? "【Customer & Delivery Info】\n" : "【预定与配送信息】\n";
            if (customerData.deliveryZone) {
                msg += (isEnglish ? "Type/Zone: " : "配送/取货方式：") + customerData.deliveryZone + "\n";
            }
            if (customerData.name) {
                msg += (isEnglish ? "Name: " : "姓名：") + customerData.name + vipBadge + "\n";
            }
            if (customerData.phone) {
                msg += (isEnglish ? "Contact Phone: " : "联系电话：") + customerData.phone + "\n";
            }

            const zoneVal = $('#cust-delivery-zone').val();
            const addressLabel = (zoneVal === 'pickup') ? 
                (isEnglish ? "Pickup Location: \n" : "自提地点：\n") : 
                (isEnglish ? "Delivery Address: \n" : "详细配送地址：\n");

            msg += addressLabel + customerData.address + "\n";
            msg += (isEnglish ? "Preferred Time: " : "期望时间：") + String(customerData.date || '').replace('T', ' ') + "\n";
            if (customerData.pooled) {
                msg += (isEnglish ? "Note: below delivery threshold, waiting for pooled delivery (date TBC)" : "备注：未满起送额，等拼单配送（日期待确认）") + "\n";
            }
            msg += "\n";
        }

        msg += isEnglish ? "【Order Details】\n" : "【商品明细】\n";

        this.cart.forEach((item, i) => {
            const lineTotal = (item.price * item.qty).toFixed(2);
            totalPrice += item.price * item.qty;
            totalQty += item.qty;

            const displayName = this.getItemDisplayName(item);
            msg += `${i + 1}. ${displayName} x ${item.qty} — RM ${lineTotal}\n`;
        });

        msg += "\n------------------------------\n";
        msg += isEnglish ?
            `Total Items: ${totalQty} | Total: RM ${totalPrice.toFixed(2)}\n\n` :
            `共 ${totalQty} 件商品 | 总计：RM ${totalPrice.toFixed(2)}\n\n`;

        msg += isEnglish ?
            "Please confirm availability and delivery schedule with me. Thank you!" :
            "请与我确认具体配送/自提时间，谢谢！";

        const waNumber = this.config.waNumber;
        const finalUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;

        const newWin = window.open(finalUrl, '_blank');
        if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
            window.location.href = finalUrl;
        }
    },

    /* 🕐 最早可选取货时间：现在 + 36小时，向上取整到整点（datetime-local 格式） */
    minPickupTimeStr: function () {
        const min = new Date(Date.now() + this.config.delivery.minLeadHours * 3600 * 1000);
        if (min.getMinutes() > 0 || min.getSeconds() > 0) min.setHours(min.getHours() + 1);
        min.setMinutes(0, 0, 0);
        const p = n => String(n).padStart(2, '0');
        return `${min.getFullYear()}-${p(min.getMonth() + 1)}-${p(min.getDate())}T${p(min.getHours())}:00`;
    },

    /* 🚚 v4.4 结账表单改造（幂等，只跑一次）：
     * ① 配送方式 4 选项 → 2 选项（自取/配送），区域判定改由邮编负责
     * ② 插入邮编栏（选配送才显示）：42800 本地 / 42700·42600 Banting 方向
     * ③ 日期栏升级成 datetime-local（以小时为单位，最少提前 36 小时） */
    setupCheckoutFormV44: function () {
        const $zone = $('#cust-delivery-zone');
        if (!$zone.length || $zone.data('v44')) return;
        $zone.data('v44', 1);
        $zone.empty()
            .append('<option value="pickup" data-i18n="checkout.zone_pickup">🏡 到店自提（Tanjong Sepat）</option>')
            .append('<option value="delivery" data-i18n="checkout.zone_delivery">🛵 配送上门（填邮编确认区域）</option>');
        $('#cust-address-group').before(
            `<div class="form-group" id="cust-postcode-group" style="display:none">
                <label for="cust-postcode"><span data-i18n="checkout.postcode_label">邮编 Postcode</span> <span class="required">*</span></label>
                <input type="text" id="cust-postcode" inputmode="numeric" maxlength="5" autocomplete="postal-code" data-i18n-placeholder="checkout.postcode_ph" placeholder="如：42800（用于确认配送区域与运费门槛）">
                <div id="postcode-status" class="form-tip" style="display:none; margin-top:8px;"></div>
            </div>`
        );
        this.updateDOMTranslations();
    },

    /* 🚚 邮编即时验证：绿=可配送 / 黄=Banting方向未满RM50等拼单 / 红=超范围 */
    validatePostcodeUI: function () {
        const isEnglish = this.getCurrentLanguage() === 'en';
        const $st = $('#postcode-status');
        const pc = ($('#cust-postcode').val() || '').trim();
        if ($('#cust-delivery-zone').val() !== 'delivery' || !pc) { $st.hide(); return; }
        if (!/^\d{5}$/.test(pc)) {
            $st.html(isEnglish ? '✍️ Please enter a 5-digit postcode.' : '✍️ 请输入 5 位数字邮编。')
               .css({ background: '#f7ece1', borderLeft: '3px solid #8b5e3c', color: '#5a3a22' }).show();
            return;
        }
        const d = this.config.delivery;
        const tier = d.postcodes[pc];
        const total = (this.cart || []).reduce((s, it) => s + it.price * it.qty, 0);
        if (tier === 'local') {
            $st.html(isEnglish ? '✅ Tanjong Sepat area — delivery available!' : '✅ Tanjong Sepat 本地区域，可以配送！')
               .css({ background: '#eef7ec', borderLeft: '3px solid #5a9a4e', color: '#33622b' }).show();
        } else if (tier === 'far') {
            if (total >= d.farMinRM) {
                $st.html(isEnglish ?
                    `✅ ${d.farName} area — order reaches RM${d.farMinRM}, delivery available!` :
                    `✅ ${d.farName} 方向 — 订单已满 RM${d.farMinRM}，可以配送！`)
                   .css({ background: '#eef7ec', borderLeft: '3px solid #5a9a4e', color: '#33622b' }).show();
            } else {
                $st.html(isEnglish ?
                    `🚚 ${d.farName} direction (round trip ~50km). Orders below <strong>RM${d.farMinRM}</strong> can still be placed, but will wait for <strong>pooled delivery</strong> (we combine orders heading the same way — exact date to be confirmed). Add RM${(d.farMinRM - total).toFixed(2)} more for priority delivery, or choose self-pickup.` :
                    `🚚 ${d.farName} 方向（来回约50km）。未满 <strong>RM${d.farMinRM}</strong> 也可以下单，但需<strong>等拼单</strong>（凑同方向订单一起送，具体日期另行确认）。再加 RM${(d.farMinRM - total).toFixed(2)} 即可优先安排，或选择到店自提。`)
                   .css({ background: '#fdf2e9', borderLeft: '3px solid #e67e22', color: '#a04000' }).show();
            }
        } else {
            $st.html(isEnglish ?
                '❌ Sorry, this postcode is outside our delivery range (42600 / 42700 / 42800). Please choose <strong>Self-Pickup</strong>.' :
                '❌ 抱歉，该邮编超出配送范围（42600 / 42700 / 42800）。欢迎选择<strong>到店自提</strong>哦！')
               .css({ background: '#fdecea', borderLeft: '3px solid #c0392b', color: '#922b21' }).show();
        }
    },

    /* 🚚 顾客手输地址后帮TA抓邮编：先正则抠 5 位数字；抠不到再免费反查一次（Nominatim） */
    tryAutofillPostcode: function () {
        if ($('#cust-delivery-zone').val() !== 'delivery') return;
        if (($('#cust-postcode').val() || '').trim()) return; /* 已填就不打扰 */
        const addr = ($('#cust-address').val() || '').trim();
        if (!addr) return;
        const m = addr.match(/\b(\d{5})\b/);
        if (m) {
            $('#cust-postcode').val(m[1]);
            this.validatePostcodeUI();
            return;
        }
        if (addr.length < 10) return; /* 太短查不准，不浪费请求 */
        if (this._pcLookupBusy) return;
        this._pcLookupBusy = true;
        const isEnglish = this.getCurrentLanguage() === 'en';
        fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=my&q=${encodeURIComponent(addr)}`)
            .then(res => res.json())
            .then((list) => {
                const pc = list && list[0] && list[0].address && list[0].address.postcode;
                if (pc && /^\d{5}$/.test(pc) && !($('#cust-postcode').val() || '').trim()) {
                    $('#cust-postcode').val(pc);
                    this.validatePostcodeUI();
                    this.showToast(isEnglish ? `📮 Postcode detected: ${pc} (please verify)` : `📮 已帮您识别邮编：${pc}（请核对一下哦）`);
                }
            })
            .catch(() => {})
            .finally(() => { this._pcLookupBusy = false; });
    },

    /* 🕐 默认预填时间（v4.15）：36小时之后的第一个早上11点。
     * 例：周一 20:00 下单 → min=周三 08:00 → 默认填 周三 11:00；
     *     周一 02:00 下单 → min=周二 14:00 → 11点已过 → 顺延 周三 11:00。
     * 顾客仍可自由改成 min 之后的任何整点，这只是省事的默认值 */
    defaultPickupTimeStr: function () {
        const minStr = this.minPickupTimeStr();
        const min = new Date(minStr);
        const d = new Date(min);
        d.setHours(11, 0, 0, 0);            /* 当天早上 11 点 */
        if (d < min) d.setDate(d.getDate() + 1); /* 11点在下限之前 → 顺延到明天11点 */
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T11:00`;
    },

    openCheckoutModal: function () {
        this.setupCheckoutFormV44();

        /* 🕐 datetime-local + 36小时下限（以小时为单位）；默认填最近的早上11点 */
        const minStr = this.minPickupTimeStr();
        const $dateInput = $('#cust-date');
        $dateInput.attr('type', 'datetime-local').attr('min', minStr).attr('step', 3600);
        if (!$dateInput.val() || $dateInput.val() < minStr) {
            $dateInput.val(this.defaultPickupTimeStr());
        }

        const savedName = localStorage.getItem(this.config.storageKeys.custName);
        const savedPhone = localStorage.getItem(this.config.storageKeys.custPhone);
        const savedAddress = localStorage.getItem(this.config.storageKeys.custAddress);
        const savedPostcode = localStorage.getItem(this.config.storageKeys.custPostcode);
        if (savedPostcode && !$('#cust-postcode').val()) {
            $('#cust-postcode').val(savedPostcode);
        }
        $('#cust-delivery-zone').trigger('change');

        if (savedName && !$('#cust-name').val()) {
            $('#cust-name').val(savedName);
        }
        if (savedPhone && !$('#cust-phone').val()) {
            $('#cust-phone').val(savedPhone);
        }
        if (savedAddress && !$('#cust-address').val()) {
            $('#cust-address').val(savedAddress);
        }

        this.closeCart();
        $('#checkout-modal-backdrop').addClass('show');
        $('#checkout-modal').addClass('show');
        this.$els.body.addClass('no-scroll');
    },

    closeCheckoutModal: function () {
        $('#checkout-modal-backdrop').removeClass('show');
        $('#checkout-modal').removeClass('show');
        if (!this.$els.detailPanel.hasClass('open') && !this.$els.cartDrawer.hasClass('open')) {
            this.$els.body.removeClass('no-scroll');
        }
    },

    openGPSModal: function () {
        const isEnglish = this.getCurrentLanguage() === 'en';

        $('#gps-modal-backdrop').addClass('show');
        $('#gps-confirm-modal').addClass('show');

        $('#gps-unit').val('');
        $('#gps-street').val('');
        $('#gps-coords').val('');
        
        const loadingMsg = this.t('gps.loading') || (isEnglish ? 
            "⌛ Detecting your precise GPS location, please wait..." : 
            "⌛ 正在获取您的精准 GPS 位置，请稍候...");
        $('#gps-loading-status').html(loadingMsg);

        this.startGPSDetection();
    },

    closeGPSModal: function () {
        $('#gps-modal-backdrop').removeClass('show');
        $('#gps-confirm-modal').removeClass('show');
    },

    startGPSDetection: function () {
        const isEnglish = this.getCurrentLanguage() === 'en';

        if (!navigator.geolocation) {
            this.showToast(isEnglish ? "GPS geolocation is not supported." : "您的浏览器不支持 GPS 地理定位。");
            $('#gps-loading-status').html(isEnglish ? "❌ GPS not supported." : "❌ 浏览器不支持 GPS");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(6);
                const lng = position.coords.longitude.toFixed(6);

                $('#gps-coords').val(`${lat},${lng}`);

                const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=${lat}&lon=${lng}`;

                fetch(reverseUrl, {
                    headers: { 'Accept-Language': 'en-US,en;q=0.9' }
                })
                .then(res => res.json())
                .then((data) => {
                    const street = data.display_name || "GPS Detected Area";
                    $('#gps-street').val(street);

                    if (data.address && data.address.house_number) {
                        $('#gps-unit').val(`No. ${data.address.house_number}`);
                    }

                    /* 📮 v4.4：GPS 反查顺手抓邮编，自动填进结账表单并即时验证区域 */
                    if (data.address && data.address.postcode && /^\d{5}$/.test(data.address.postcode)) {
                        $('#cust-postcode').val(data.address.postcode);
                        this.validatePostcodeUI();
                    }

                    $('#gps-loading-status').html(isEnglish ? "✅ Location detected! Please verify & enter house number." : "✅ 定位成功！请核对街道并补全门牌号。");
                    $('#gps-unit').focus();
                })
                .catch(() => {
                    $('#gps-street').val("Detected GPS Area");
                    $('#gps-loading-status').html(isEnglish ? "✅ Coordinates captured. Please fill in house number." : "✅ 坐标抓取成功，请补充门牌号。");
                    $('#gps-unit').focus();
                });
            },
            () => {
                const errMsg = isEnglish ? "Failed to get location. Please check location permissions." : "定位失败，请确保已开启浏览器位置权限。";
                $('#gps-loading-status').html(`❌ ${errMsg}`);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    },

    showToast: function (msg, duration = 2500) {
        let $toast = $('#app-toast-msg');

        if ($toast.length === 0) {
            $toast = $('<div id="app-toast-msg"></div>').appendTo('body');
        }

        $toast.text(msg).addClass('show');

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            $toast.removeClass('show');
        }, duration);
    },

    isValidPhone: function (phone) {
        if (!phone) return false;
        let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');

        if (cleaned.indexOf('601') === 0) {
            cleaned = '0' + cleaned.substring(2);
        }

        const phonePattern = /^01[0-9]{8,9}$/;
        return phonePattern.test(cleaned);
    },

    showFieldError: function ($input, msg) {
        const $group = $input.closest('.form-group');
        $group.find('.field-error-msg').remove();
        
        $input.addClass('input-error').focus();
        $group.append(`<div class="field-error-msg">⚠️ ${msg}</div>`);
    },

    clearFieldError: function ($input) {
        const $group = $input.closest('.form-group');
        $input.removeClass('input-error');
        $group.find('.field-error-msg').remove();
    },

    // 🎬 视频转场核心函数 (高频 60fps 丝滑白色蒙版)
    playVideoTransition: function (callback) {
        if (this.isVideoTransitioning) return;
        this.isVideoTransitioning = true;

        const $transitionLayer = $('#video-transition');
        const videoEl = document.getElementById('transition-video');

        if (!videoEl) {
            console.warn("找不到视频元素");
            if (callback) callback();
            this.isVideoTransitioning = false;
            return;
        }

        // 1. 显示转场层
        $transitionLayer.addClass('active');

        // 2. 重置视频到开头
        videoEl.currentTime = 0;

        // 🌟 针对牛角包熊，2.7秒时刚好完全遮挡屏幕
        const switchTime = 2.7; 
        let callbackExecuted = false;
        let rafId = null; // 用于存储 requestAnimationFrame 的 ID

        // --- 🎨 蒙版自定义配置 ---
        const maxOpacity = 1.0; 
        const maskRGB = '255, 255, 255'; // 纯白色

        // 🌟 核心优化：使用 requestAnimationFrame 实现硬件级帧率渲染，彻底解决原生 timeupdate 频率低导致的卡顿
        const updateTransition = () => {
            if (!this.isVideoTransitioning) return; // 安全出口：如果转场已被清理，终止循环

            const current = videoEl.currentTime;
            const duration = (videoEl.duration && !isNaN(videoEl.duration)) ? videoEl.duration : 4.5;
            
            // 🌓 实时计算蒙版透明度
            let currentOpacity = 0;
            if (current <= switchTime) {
                // 阶段1 (0 -> 2.7秒): 渐渐加深到 maxOpacity
                // 指数降至 1.1，让白色来得更快、更有冲击感、节奏更紧凑
                const progress = current / switchTime;
                currentOpacity = Math.pow(progress, 1.1) * maxOpacity;
            } else {
                // 阶段2 (2.7秒 -> 结束): 渐渐消退到 0
                const remaining = duration - switchTime;
                if (remaining > 0) {
                    const progress = (current - switchTime) / remaining;
                    currentOpacity = (1 - Math.pow(progress, 1.1)) * maxOpacity;
                }
            }
            
            currentOpacity = Math.max(0, Math.min(currentOpacity, maxOpacity));
            $transitionLayer.css('background-color', `rgba(${maskRGB}, ${currentOpacity})`);

            // 当视频播放到指定时间点，暗中执行 DOM 视图切换
            if (!callbackExecuted && current >= switchTime) {
                callbackExecuted = true;
                if (callback) callback(); 
            }

            // 如果视频还在播放，继续渲染下一帧 (实现极致顺滑)
            if (!videoEl.paused && !videoEl.ended) {
                rafId = requestAnimationFrame(updateTransition);
            }
        };

        // 🌙 后台兜底 1：timeupdate 在切后台时依然触发（rAF 会停），
        //    保证 2.7 秒的视图切换回调不会因为切后台而漏掉
        const timeupdateHandler = () => {
            if (!callbackExecuted && videoEl.currentTime >= switchTime) {
                callbackExecuted = true;
                if (callback) callback();
            }
        };
        videoEl.addEventListener('timeupdate', timeupdateHandler);

        // 🌙 后台兜底 2：切回前台时，若视频被浏览器暂停就续播，并重启渲染循环
        const visibilityHandler = () => {
            if (document.hidden || !this.isVideoTransitioning) return;
            if (videoEl.paused && !videoEl.ended) {
                videoEl.play().catch(() => {});
            }
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(updateTransition);
        };
        document.addEventListener('visibilitychange', visibilityHandler);

        // 🌙 后台兜底 3：超时保险丝——就算 ended 事件在后台丢了，也强制收尾
        let safetyTimer = null;
        const armSafety = () => {
            const dur = (videoEl.duration && !isNaN(videoEl.duration)) ? videoEl.duration : 4.5;
            safetyTimer = setTimeout(() => { if (this.isVideoTransitioning) endedHandler(); }, dur * 1000 + 2000);
        };

        const endedHandler = () => {
            // 停止高频渲染循环
            if (rafId) cancelAnimationFrame(rafId);
            if (safetyTimer) clearTimeout(safetyTimer);

            $transitionLayer.removeClass('active');
            $transitionLayer.css('background-color', 'transparent');
            
            videoEl.removeEventListener('ended', endedHandler);
            videoEl.removeEventListener('timeupdate', timeupdateHandler);
            document.removeEventListener('visibilitychange', visibilityHandler);
            
            if (!callbackExecuted) {
                callbackExecuted = true;
                if (callback) callback();
            }
            this.isVideoTransitioning = false;
        };

        videoEl.addEventListener('ended', endedHandler);
        armSafety();

        // 4. 开始播放
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // 🌟 视频成功播放后，开启硬件级高频渲染循环
                rafId = requestAnimationFrame(updateTransition);
            }).catch(err => {
                console.warn('转场视频加载失败或被浏览器拦截:', err);
                if (rafId) cancelAnimationFrame(rafId);
                if (!callbackExecuted && callback) {
                    callbackExecuted = true;
                    callback();
                }
                $transitionLayer.removeClass('active');
                $transitionLayer.css('background-color', 'transparent');
                this.isVideoTransitioning = false;
            });
        } else {
            // 兼容老版本浏览器
            rafId = requestAnimationFrame(updateTransition);
        }
    },

};