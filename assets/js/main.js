/* ================================================================= */
/* 1. 核心 helper 库 (视差滚动与图片加载)  */
/* ================================================================= */
function WnkLaxController()
{
	this.elements = [];
	this.enabled = !1;
	this.requestID = null;
	this.init()
}
WnkLaxController.prototype = {
	init: function () {},
	addElement: function (el, parent, opts)
	{
		var element = new WnkLaxElement(el, parent, opts);
		this.elements.push(element)
	},
	removeElement: function (el)
	{
		for (var i = 0; i < this.elements.length; i++)
		{
			if (this.elements[i].el.get(0) == el.get(0)) {
				this.elements[i].destroy();
				this.elements.splice(i, 1); 
				break; 
			}
		}
	},
	removeAll: function ()
	{
		this.stop();
		for (var i = 0; i < this.elements.length; i++)
		{
			this.elements[i].destroy()
		}
		this.elements = null
	},
	onFrame: function ()
	{
		for (var i = 0; i < this.elements.length; i++)
		{
			this.elements[i].onFrame()
		}
	},
	start: function ()
	{
		this.enabled = !0;
		this.onFrame()
	},
	stop: function ()
	{
		window.cancelAnimationFrame(this.requestID);
		this.requestId = null
	}
}

function WnkLaxElement(el, parent, opts)
{
	this.el = el;
	this.parent = parent;
	this.defaults = {
		deltaX: 1.0,
		deltaY: 1.0,
		accX: 1.0,
		accY: 1.0,
		mode: 'translate',
		axe: 'v',
		max: !1,
	};
	this.settings = $.extend(
	{}, this.defaults, opts);
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
	this.init()
}
WnkLaxElement.prototype = {
	init: function ()
	{
		this.onResize()
	},
	onFrame: function ()
	{
		var tweenDeltaX = this.caclDeltaTranslate(this.settings.deltaX, this.currentDeltaX, this.settings.accX);
		var tweenDeltaY = this.caclDeltaTranslate(this.settings.deltaY, this.currentDeltaY, this.settings.accY);
		this.move(tweenDeltaX, tweenDeltaY);
		this.currentDeltaX = tweenDeltaX;
		this.currentDeltaY = tweenDeltaY
	},
	caclDeltaTranslate: function (delta, curr, acc)
	{
		var scrollTop = this.getScrollTop();
		var newDelta = (scrollTop - (scrollTop * (delta)));
		var tweenDelta = (curr - ((curr - newDelta)) * acc);
		if (Math.abs(tweenDelta) < (1 / 1000))
		{
			tweenDelta = newDelta
		}
		return tweenDelta
	},
	move: function (x, y)
	{
		var property, value = '';
		if (this.settings.mode == 'translate')
		{
			property = 'transform';
			value = "translateZ(0)";
			if (x !== 0)
			{
				value += ' translateX(' + x + 'px) '
			}
			if (y !== 0)
			{
				value += ' translateY(' + y + 'px) '
			}
		}
		if (this.settings.mode == 'bg')
		{
			property = 'background-position';
			value += (x !== 0) ? x + 'px ' : this._getBgPosFor('x') + ' ';
			value += (y !== 0) ? y + 'px' : this._getBgPosFor('y')
		}
		if (value.length > 0)
		{
			this.el.css(property, value)
		}
	},
	enable: function ()
	{
		if (!this.enabled)
		{
			this.enabled = !0;
			this.onFrame()
		}
	},
	disable: function ()
	{
		this.enabled = !1;
	},
	onResize: function ()
	{
		this.wH = $(window).height();
		this.wW = $(window).width();
		this.w = this.el.width();
		this.h = this.el.height();
		var hasFixedParent = this.el.parents().filter(function ()
		{
			return $(this).css('position') == 'fixed'
		});
		if (hasFixedParent.length > 0)
		{
			this.originY = this.el.offset().top - window.pageYOffset
		}
		else
		{
			this.originY = this.el.offset().top;
			this.originX = this.el.offset().left
		}
	},
	destroy: function ()
	{
		this.disable();
		this.el = null
		this.parent = null;
		this.settings = null
	},
	getScrollTop: function ()
	{
		if (this.originY > (this.wH / 2))
		{
			return (window.pageYOffset - this.originY) + (this.wH / 2) - (this.h / 2)
		}
		var origin = Math.max((this.originY - (this.wH / 2)), 0);
		return (window.pageYOffset - origin)
	},
	_getBgPosFor: function (axe)
	{
		var pos = this.el.css('background-position').split(' ');
		if (axe == 'x')
		{
			return pos[0]
		}
		return pos[1]
	}
}

function WnkMediaLoader(imgs, parent)
{
	this.$imgs = imgs;
	this.count = 0;
	this.parent = parent;
	this.allLoaded = !1;
	this.eventName = 'wnk.mediasLoaded';
	this.init()
}
WnkMediaLoader.prototype = {
	init: function ()
	{
		if (this.$imgs.length <= 0)
		{
			$(this.parent).trigger(this.eventName);
		}
	},
	load: function ()
	{
		this.$imgs.each($.proxy(this.initMedia, this));
	},
	initMedia: function (i, media)
	{
		var $media = $(media);
		var self = this;

		if ($media.prop('tagName') === 'IMG')
		{
			$media.one("load.WnkMediaLoader error.WnkMediaLoader", function ()
			{
				self.onMediaLoaded();
			});

			if (media.complete)
			{
				$media.trigger('load');
			}
		}
		else if ($media.prop('tagName') === 'VIDEO')
		{
			$media.one("loadeddata.WnkMediaLoader error.WnkMediaLoader", function ()
			{
				self.onMediaLoaded();
			});
			media.load();
		}
		else
		{
			this.onMediaLoaded();
		}
	},
	onMediaLoaded: function (e)
	{
		this.count++;
		if (this.count >= this.$imgs.length)
		{
			$(this.parent).trigger(this.eventName);
		}
	},
	destroy: function ()
	{
		this.$imgs.off('load.WnkMediaLoader error.WnkMediaLoader').off('loadeddata.WnkMediaLoader');
	}
};

/* ================================================================= */
/* 2. 麦日记主程序 (MaiRijiApp) */
/* ================================================================= */

function MaiRijiApp()
{
	this.wax = new WnkLaxController();

	this.config = {
		waNumber: "601115277643",
		googleSheetUrl: "https://script.google.com/macros/s/AKfycby1Qm6k1oiw4zqqIS5WWFUKBGnWuW-CdvctB4DvHFPMFm4YcGsL_O3S8oNgB6IMzFVL5Q/exec",
		storageKeys:
		{
			cart: 'mairiji_cart',
			custName: 'mairiji_cust_name',
			custPhone: 'mairiji_cust_phone',
			custAddress: 'mairiji_cust_address',
			lang: 'mairiji_lang'
		}
	};
	this.cursorTimer = null;
	this.currentLang = localStorage.getItem(this.config.storageKeys.lang) || 'zh';
}

MaiRijiApp.prototype = {

	// 1. 预加载：同时请求 products.json 和 locales.json
	preload: function ()
	{
		var self = this;
		$.when(
			$.getJSON('assets/data/products.json'),
			$.getJSON('assets/data/locales.json')
		).done(function (prodRes, localeRes)
		{
			self.productsData = prodRes[0];
			self.localesData = localeRes[0];
			self.init();
		}).fail(function ()
		{
			console.error("加载数据失败，请确保在服务器环境下运行。");
		});
	},

	// 2. 全局翻译引擎 (Translation Engine)
	t: function (keyPath)
	{
		if (!this.localesData || !this.localesData[this.currentLang]) return keyPath;

		var keys = keyPath.split('.');
		var current = this.localesData[this.currentLang];
		for (var i = 0; i < keys.length; i++)
		{
			if (current[keys[i]] === undefined) return keyPath;
			current = current[keys[i]];
		}
		return current;
	},

	// 3. 一键更新 DOM 中的所有文字
	updateDOMTranslations: function ()
	{
		var self = this;
		$('html').attr('lang', this.currentLang === 'en' ? 'en' : 'zh-CN');

		// 翻译带有 data-i18n 的普通文本
		$('[data-i18n]').each(function ()
		{
			var key = $(this).data('i18n');
			var translated = self.t(key);
			if (translated) $(this).html(translated);
		});

		// 翻译带有 data-i18n-placeholder 的输入框
		$('[data-i18n-placeholder]').each(function ()
		{
			var key = $(this).data('i18n-placeholder');
			var translated = self.t(key);
			if (translated) $(this).attr('placeholder', translated);
		});

		// 翻译右下角悬浮按钮文字：英文版显示"中文"，中文版显示"EN"
		$('#lang-float .textIcon').text(this.currentLang === 'en' ? '中文' : 'EN');
	},

	// 4. 原地无刷新切换语言
	switchLanguage: function (targetLang)
	{
		var self = this;

		if (this.isLangSwitching) return;
		this.isLangSwitching = true;

		this.currentLang = targetLang || (this.currentLang === 'en' ? 'zh' : 'en');
		localStorage.setItem(this.config.storageKeys.lang, this.currentLang);

		var $overlay = $('#lang-switch-overlay');
		if ($overlay.length === 0)
		{
			$overlay = $('<div id="lang-switch-overlay"></div>').appendTo('body');
		}
		$overlay.addClass('show');

		var $targets = $('[data-i18n]');
		var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789麦日记风味烘焙';

		$targets.addClass('text-scrambling');

		var scrambleCount = 0;
		var scrambleInterval = setInterval(function ()
		{
			$targets.each(function () {
				var $el = $(this);
				if ($el.children().length > 0 || $el.html().indexOf('<') !== -1) return;
				
				var scrambled = '';
				var len = Math.min(Math.max($el.text().length, 4), 10);
				for (var i = 0; i < len; i++) {
					scrambled += chars.charAt(Math.floor(Math.random() * chars.length));
				}
				$el.text(scrambled);
			});
			scrambleCount++;
			if (scrambleCount >= 4)
			{
				clearInterval(scrambleInterval);
			}
		}, 35);

		setTimeout(function ()
		{
			self.updateDOMTranslations();
			self.renderProducts();
			self.updateCartUI();
			self.loadHighResImages();

			var existingVIP = localStorage.getItem(self.config.storageKeys.custName);
			if (existingVIP)
			{
				$('#open-vip-btn').attr('data-label', 'Hi, ' + existingVIP);
			}
			else
			{
				$('#open-vip-btn').attr('data-label', self.t('nav.vip'));
			}

			if (self.$els.detailPanel.hasClass('open'))
			{
				var currentType = self.$els.detailPanel.data('type');
				var currentId = self.$els.detailPanel.data('id');
				if (currentType && currentId)
				{
					self.openProductDetail(currentType, currentId);
				}
			}

			$targets.removeClass('text-scrambling');
			$overlay.removeClass('show');

			setTimeout(function ()
			{
				self.isLangSwitching = false;
			}, 250);

		}, 220);
	},

	// 5. 读取当前语言
	getCurrentLanguage: function ()
	{
		return this.currentLang;
	},

	// 6. 初始化
	init: function ()
	{
		var $this = this;

		this.$els = {
			body: $('body'),
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
			cartBadge: $('#cart-count-badge')
		};

		this.updateDOMTranslations();

		this.renderProducts();
		this.renderSavoriaCards('bread');
		this.forceLoadTinyImages();

		$('.home-intro .bg-inner').addClass('play-zoom');
		this.bindEvents();
		this.initCustomCursor();

		this.cart = this.loadCart();
		this.updateCartUI();

		var existingVIP = localStorage.getItem(this.config.storageKeys.custName);
		if (existingVIP)
		{
			$('#open-vip-btn').attr('data-label', 'Hi, ' + existingVIP);
		}
		else
		{
			$('#open-vip-btn').attr('data-label', this.t('nav.vip'));
		}
	},

	// 7. 渲染商品 (基于 JSON 数据)
	renderProducts: function ()
	{
		var langKey = this.getCurrentLanguage();

		if (this.productsData && this.productsData[langKey])
		{
			this.breadProducts = this.productsData[langKey].bread;
			this.cakeProducts = this.productsData[langKey].cake;
		}
		else
		{
			this.breadProducts = [];
			this.cakeProducts = [];
		}

		this.renderProductGroup('bread', this.breadProducts, this.t('menu.bread_title'));
		this.renderProductGroup('cake', this.cakeProducts, this.t('menu.cake_title'));
	},

	renderSavoriaCards: function (folder)
	{
		folder = folder || 'bread';
		var isEnglish = this.getCurrentLanguage() === 'en';

		var photoBuckets = {
			bread: ['1', '2', '3', '4', '5', '6', '7']
		};

		var availablePhotos = photoBuckets[folder] || photoBuckets.bread;
		var selectedPhotos = this.shuffleArray(availablePhotos.slice()).slice(0, 7);

		var html = '';

		$.each(selectedPhotos, function (index, photoName)
		{
			var dirClass = index % 2 === 0 ? 'up' : 'down';
			var displayLabels = isEnglish ? ['Signature', '', 'Fresh', '', 'Sweet', '', ''] : ['Signature / 招牌', '', 'Fresh / 新鲜', '', 'Sweet / 甜点', '', ''];
			var displayLabel = displayLabels[index] || '';
			var tinyUrl = 'assets/img/' + folder + '/' + photoName + '-tiny.webp';
			var highResUrl = 'assets/img/' + folder + '/' + photoName + '.webp';

			new Image().src = tinyUrl;

			var overlayHtml = displayLabel ? `<div class="card-overlay"><span>${displayLabel}</span></div>` : '';
			html += `
            <div class="savoria-card ${dirClass}">
                <div class="img-holder progressive-bg blur-effect" 
                     style="background-image: url('${tinyUrl}');" 
                     data-highres="${highResUrl}"></div>
                ${overlayHtml}
            </div>
            `;
		});

		$('#savoria-track-container').prepend(html);
		$('#savoria-mobile-clones').html(html);
	},

	shuffleArray: function (array)
	{
		for (var i = array.length - 1; i > 0; i--)
		{
			var j = Math.floor(Math.random() * (i + 1));
			var temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
		return array;
	},

	forceLoadTinyImages: function ()
	{
		$('.progressive-bg').each(function ()
		{
			var bgStr = $(this)[0].style.backgroundImage;
			if (bgStr && bgStr !== 'none')
			{
				var url = bgStr.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
				new Image().src = url;
			}
		});
	},

	renderProductGroup: function (type, products, title)
	{
		var isEnglish = this.getCurrentLanguage() === 'en';
		var html = '';
		var folder = type === 'cake' ? 'cake' : 'bread';
		var titleText = title;

		$.each(products, function (index, item)
		{
			var tinyUrlNormal = 'assets/img/' + folder + '/' + item.img + '-tiny.webp';
			var tinyUrlHover = 'assets/img/' + folder + '/' + item.img + '-hover-tiny.webp';
			new Image().src = tinyUrlNormal;
			new Image().src = tinyUrlHover;

			var isComingSoon = item.status === 'coming_soon';
			var badgeHtml = isComingSoon ?
				`<span class="coming-soon-badge">${isEnglish ? 'Coming Soon' : '敬请期待'}</span>` :
				'';

			html += `
            <li class="grid__item slider__slide">
                <a href="#product-detail" class="product-card-wrapper card-wrapper open-detail-btn" data-type="${type}" data-id="${item.id}" style="background: transparent; border: none; box-shadow: none; padding: 0; display: block; cursor: none;">
                    <div class="stack-container">
                        ${badgeHtml}
                        <div class="polaroid card-bottom">
                            <div class="photo-area" style="background-color: ${type === 'cake' ? '#fdf7ef' : '#fbf9f4'};"></div>
                        </div>

                        <div class="polaroid card-middle-hover">
                            <div class="photo-area progressive-bg blur-effect" 
                                 style="background-image: url('assets/img/${folder}/${item.img}-hover-tiny.webp');"
                                 data-highres="assets/img/${folder}/${item.img}-hover.webp">
                            </div>
                        </div>

                        <div class="polaroid card-front">
                            <div class="photo-area progressive-bg blur-effect" 
                                 style="background-image: url('assets/img/${folder}/${item.img}-tiny.webp');"
                                 data-highres="assets/img/${folder}/${item.img}.webp">
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-information" style="padding-top: 10px; text-align: center;">
                        <div class="card-information__wrapper">
                            <span class="card-information__text">${item.name}</span>
                            <div class="price"><span class="price-item">RM ${item.price}</span></div>
                        </div>
                    </div>
                </a>
            </li>
            `;
		});

		if (type === 'bread')
		{
			$('#product-list').html(html);
		}
		else
		{
			$('#cake-product-list').html(html);
		}

		if (type === 'bread')
		{
			$('.menu-title').text(titleText);
		}
	},

	switchMenuView: function (view, animate)
	{
		var self = this;
		var isEnglish = this.getCurrentLanguage() === 'en';

		var doSwitch = function ()
		{
			$('.menu-switcher-btn').removeClass('active');
			$('.menu-switcher-btn[data-view="' + view + '"]').addClass('active');

			$('.menu-view').removeClass('active');
			$('.menu-view[data-view-panel="' + view + '"]').addClass('active');

			$('.menu-hero-panel').removeClass('active');
			$('.menu-hero-panel[data-hero-view="' + view + '"]').addClass('active');

			$('.menu-intro-panel').removeClass('active');
			$('.menu-intro-panel[data-intro-view="' + view + '"]').addClass('active');

			$('.menu-banner-panel').removeClass('active');
			$('.menu-banner-panel[data-banner-view="' + view + '"]').addClass('active');

			$('.menu-title').text(view === 'cake' ? (isEnglish ? 'Cake / Desserts' : 'Cake / 蛋糕') : (isEnglish ? 'Sourdough / Bread' : 'Sourdough / 酸种欧包'));

			try
			{
				self.initStickyNav();
			}
			catch (e)
			{}
		};

		if (!animate)
		{
			doSwitch();
			return;
		}

		var $toast = $('#toast-transition');
		$toast.removeClass('pop-in expanding fading-out').css('opacity', '');
		void $toast[0].offsetWidth;
		$toast.addClass('pop-in');

		setTimeout(function ()
		{
			$toast.addClass('expanding');

			setTimeout(function ()
			{
				doSwitch();

				$toast.addClass('fading-out');
				setTimeout(function ()
				{
					$toast.removeClass('pop-in expanding fading-out');
				}, 400);
			}, 500);
		}, 250);
	},

	bindEvents: function ()
	{
		var $this = this;

		this.initStickyNav();

		// 绑定悬浮语言切换按钮
		$('#lang-float').off('click').on('click', function (e)
		{
			e.preventDefault();
			$this.switchLanguage();
		});

		if (!this.isMobile())
		{
			var loader = new WnkMediaLoader($('img'), this);
			$(this).one(loader.eventName, $.proxy(this.onLoad, this));
			loader.load();
		}

		$('.m-burger').on('click', function ()
		{
			$('body').toggleClass('menuOpen');
		});

		$('.nav-link').on('click', function (e)
		{
			e.preventDefault();
			var targetId = $(this).data('target');
			if ($('#' + targetId).hasClass('active-view')) return;

			$this.handlePageTransition($(this));
		});

		$(document).on('click', 'a.down, a.scroll-link', function (e)
		{
			e.preventDefault();
			var targetId = $(this).attr('href');
			var $target = $(targetId);
			if ($target.length > 0)
			{
				$('html, body').animate(
				{
					scrollTop: $target.offset().top - 60
				}, 800);
			}
		});

		$this.activeObservers = {
			horizontal: true,
			parallax: true
		};

		if ('IntersectionObserver' in window)
		{
			var observerOptions = {
				root: null,
				rootMargin: '500px 0px',
				threshold: 0
			};

			var hScrollEl = document.querySelector('.horizontal-scroll-wrapper');
			if (hScrollEl)
			{
				var hObserver = new IntersectionObserver(function (entries)
				{
					$this.activeObservers.horizontal = entries[0].isIntersecting;
				}, observerOptions);
				hObserver.observe(hScrollEl);
			}

			var pTargets = document.querySelectorAll('section.intro, header.intro, .full-width-image-divider');
			if (pTargets.length > 0)
			{
				var pObserver = new IntersectionObserver(function (entries)
				{
					entries.forEach(function (entry)
					{
						entry.target._isPVisible = entry.isIntersecting;
					});

					var isAnyVisible = false;
					pTargets.forEach(function (el)
					{
						if (el._isPVisible) isAnyVisible = true;
					});
					$this.activeObservers.parallax = isAnyVisible;
				}, observerOptions);

				pTargets.forEach(function (el)
				{
					pObserver.observe(el);
				});
			}
		}

		var ticking = false;
		$(window).on('scroll', function ()
		{
			if (!ticking)
			{
				window.requestAnimationFrame(function ()
				{
					var scrollTop = $(window).scrollTop();

					if ($this.activeObservers.horizontal)
					{
						$this.handleHorizontalScroll(scrollTop);
					}

					if ($this.activeObservers.parallax && $this.wax && $this.wax.enabled)
					{
						$this.wax.onFrame();
					}

					ticking = false;
				});
				ticking = true;
			}
		});

		$(window).on('resize', function ()
		{
			if ($this.wax && $this.wax.elements)
			{
				for (var i = 0; i < $this.wax.elements.length; i++)
				{
					$this.wax.elements[i].onResize();
				}
			}
			Waypoint.refreshAll();
		});

		$(document).on('click', '.wheat-btn[data-link]', function (e)
		{
			var $btn = $(this);
			var targetUrl = $btn.attr('data-link');

			if (!$btn.hasClass('clicked'))
			{
				$btn.addClass('clicked');

				setTimeout(function ()
				{
					if (targetUrl && targetUrl.length > 0)
					{
						window.open(targetUrl, '_blank');
					}
				}, 800);

				setTimeout(function ()
				{
					$btn.removeClass('clicked');
				}, 1500);
			}
		});

		$('.menu-switcher-btn').on('click', function ()
		{
			var target = $(this).data('view');
			$this.switchMenuView(target, true);
		});

		$(document).on('click', '.open-detail-btn', function (e)
		{
			e.preventDefault();
			var type = $(this).data('type');
			var id = $(this).data('id');
			$this.openProductDetail(type, id);
		});

		$(document).on('click', '.close-detail-btn', function (e)
		{
			e.preventDefault();
			$('#product-detail-panel').removeClass('open');

			if (!$('#cart-drawer-panel').hasClass('open'))
			{
				$('body').removeClass('no-scroll');
			}
		});

		$this.openCart = function ()
		{
			$this.$els.cartDrawer.addClass('open');
			$this.$els.cartBackdrop.addClass('show');
			$this.$els.body.addClass('no-scroll');
		};

		$this.closeCart = function ()
		{
			$this.$els.cartDrawer.removeClass('open');
			$this.$els.cartBackdrop.removeClass('show');

			if (!$this.$els.detailPanel.hasClass('open'))
			{
				$this.$els.body.removeClass('no-scroll');
			}
		};

		$('#cart-float, .open-cart-btn').on('click', function (e)
		{
			e.preventDefault();
			$this.openCart();
		});
		$('.close-cart-btn, #cart-backdrop').on('click', function ()
		{
			$this.closeCart();
		});

		$(document).on('click', '.cart-qty-plus', function ()
		{
			var id = $(this).closest('.cart-item').data('id');
			$this.changeCartItemQty(id, 1);
		});
		$(document).on('click', '.cart-qty-minus', function ()
		{
			var id = $(this).closest('.cart-item').data('id');
			$this.changeCartItemQty(id, -1);
		});
		$(document).on('click', '.cart-item-del', function ()
		{
			var id = $(this).closest('.cart-item').data('id');
			$this.removeCartItem(id);
		});

		$('#cart-checkout-btn').on('click', function (e)
		{
			e.preventDefault();
			if (!$this.cart || $this.cart.length === 0)
			{
				$this.showToast($this.getCurrentLanguage() === 'en' ? 'Your basket is empty!' : '购物篮还是空的哦！');
				return;
			}
			$this.openCheckoutModal();
		});

		$('#close-checkout-modal, #checkout-modal-backdrop').on('click', function ()
		{
			$this.closeCheckoutModal();
		});

		// 监听用户输入，修改时自动消除红框
		$(document).on('input', '#checkout-form input, #checkout-form textarea', function() {
			$this.clearFieldError($(this));
		});

		$('#checkout-form').off('submit').on('submit', function (e)
		{
			e.preventDefault();
			var $btn = $(this).find('.wheat-btn');
			var name = $('#cust-name').val().trim();
			var phone = $('#cust-phone').val().trim();
			var address = $('#cust-address').val().trim();
			var date = $('#cust-date').val();
			var zoneVal = $('#cust-delivery-zone').val();
			var isEnglish = $this.getCurrentLanguage() === 'en';

			// 清除之前的错误高亮
			$this.clearFieldError($('#cust-name'));
			$this.clearFieldError($('#cust-phone'));
			$this.clearFieldError($('#cust-address'));

			if (zoneVal === 'other')
			{
				$this.showToast(isEnglish ? "Delivery is unavailable for other areas. Please select Self-Pickup." : "其他区域暂无配送服务，请选择【到店自提】哦！");
				return;
			}

			// 基础必填校验
			if (!name) {
				$this.showFieldError($('#cust-name'), isEnglish ? 'Please enter your name' : '请填写联系姓名');
				return;
			}
			if (!phone) {
				$this.showFieldError($('#cust-phone'), isEnglish ? 'Please enter your phone number' : '请填写联系电话');
				return;
			}
			
			if (!$this.isValidPhone(phone)) {
				$this.showFieldError($('#cust-phone'), isEnglish ? 
					'Invalid phone format (e.g. 011-2956 9555 or 012-345 6789)' : 
					'电话号码格式不正确，请检查位数是否有多打或少打');
				return;
			}

			if (zoneVal !== 'pickup' && !address) {
				$this.showFieldError($('#cust-address'), isEnglish ? 'Please enter delivery address' : '请填写详细配送地址');
				return;
			}

			// 🌟 正确定义配送区域描述文本，避免 ReferenceError
			var zoneLabels = {
				tj_sepat: isEnglish ? "Tanjong Sepat Delivery" : "Tanjong Sepat 地区送货",
				banting: isEnglish ? "Banting Area (Arrangement Needed)" : "Banting 地区（需沟通安排）",
				pickup: isEnglish ? "Self-Pickup (Tanjong Sepat)" : "Tanjong Sepat 店面自提"
			};
			var deliveryZoneText = zoneLabels[zoneVal] || zoneVal;

			// 保存个人信息到本地
			if (name) localStorage.setItem($this.config.storageKeys.custName, name);
			if (phone) localStorage.setItem($this.config.storageKeys.custPhone, phone);
			if (address && zoneVal !== 'pickup') localStorage.setItem($this.config.storageKeys.custAddress, address);

			// 后台 Google Sheets 静默同步
			if ($this.config.googleSheetUrl && $this.config.googleSheetUrl.indexOf("http") === 0)
			{
				fetch($this.config.googleSheetUrl,
				{
					method: "POST",
					mode: "no-cors",
					headers:
					{
						"Content-Type": "application/json"
					},
					body: JSON.stringify(
					{
						name: name,
						phone: phone
					})
				}).catch(function (err)
				{
					console.warn("后台 VIP 同步提醒:", err);
				});
			}

			$btn.addClass('clicked');

			setTimeout(function ()
			{
				$this.closeCheckoutModal();

				// 传递电话数据给 WhatsApp 消息生成器
				$this.checkoutWhatsApp(
				{
					name: name,
					phone: phone,
					address: address,
					date: date,
					deliveryZone: deliveryZoneText
				});

				$('#thankyou-modal-backdrop').addClass('show');
				$('#thankyou-modal').addClass('show');
				$('body').addClass('no-scroll');

				$this.cart = [];
				$this.saveCart();
				$this.updateCartUI();

				$btn.removeClass('clicked');
			}, 800);
		});

		$('#insta-flash-btn').on('click', function (e)
		{
			e.preventDefault();
			var $btn = $(this);
			var url = "https://www.instagram.com/mywheatdiary/";

			if (!$btn.hasClass('shutter-active'))
			{
				$btn.addClass('shutter-active');

				setTimeout(function ()
				{
					var newWin = window.open(url, '_blank');
					if (!newWin || newWin.closed || typeof newWin.closed == 'undefined')
					{
						window.location.href = url;
					}
				}, 400);

				setTimeout(function ()
				{
					$btn.removeClass('shutter-active');
				}, 800);
			}
		});

		$(document).on('click', '#get-gps-btn', function (e)
		{
			e.preventDefault();
			$this.openGPSModal();
		});

		$('#close-gps-modal, #gps-modal-backdrop').on('click', function ()
		{
			$this.closeGPSModal();
		});

		$('#gps-confirm-form').off('submit').on('submit', function (e)
		{
			e.preventDefault();
			var unit = $('#gps-unit').val().trim();
			var street = $('#gps-street').val().trim();
			var coords = $('#gps-coords').val().trim();
			var isEnglish = $this.getCurrentLanguage() === 'en';

			if (!unit)
			{
				$this.showToast(isEnglish ? 'Please enter your house or unit number.' : '请补充填写门牌号或楼层单位。');
				return;
			}

			var cleanCoords = coords.replace(/\s+/g, ''); // 确保无空格
			var googleMapsUrl = "https://maps.google.com/?q=" + cleanCoords;
			var finalAddressText = (isEnglish ? "Unit/House No: " : "门牌单位：") + unit + "\n" +
				(isEnglish ? "Street/Area: " : "详细区域：") + street + "\n" +
				"Google Maps: " + googleMapsUrl;

			$('#cust-address').val(finalAddressText);

			$this.closeGPSModal();
		});

		$(document).on('keyup', function (e)
		{
			if (e.key === 'Escape')
			{
				if ($('#gps-confirm-modal').hasClass('show'))
				{
					$this.closeGPSModal();
				}
				else if ($('#checkout-modal').hasClass('show'))
				{
					$this.closeCheckoutModal();
				}
				else if ($('#cart-drawer-panel').hasClass('open'))
				{
					$this.closeCart();
				}
				else if ($('#product-detail-panel').hasClass('open'))
				{
					$('#product-detail-panel').removeClass('open');
					$('body').removeClass('no-scroll');
				}
			}
		});

		$(document).on('click', '.accordion-header', function ()
		{
			var $btn = $(this);
			var $content = $btn.next('.accordion-content');

			var isExpanded = $btn.toggleClass('active').hasClass('active');
			$btn.attr('aria-expanded', isExpanded);
			$content.stop().slideToggle(250);
		});

		$(document).on('input', '#cust-address', function() {
			$(this).removeAttr('data-is-auto-filled');
		});

		$(document).on('change', '#cust-delivery-zone', function () {
			var val = $(this).val();
			var isEnglish = $this.getCurrentLanguage() === 'en';
			var $addressGroup = $('#cust-address-group');
			var $notice = $('#zone-notice');
			var $pickupInfo = $('#cust-pickup-info');
			var $addressInput = $('#cust-address');

			var pickupAddress = "65, Jalan Pelangi 12, Taman Pelangi, 42800 Tanjong Sepat";

			if (val === 'pickup') {
				$addressGroup.slideUp(200);
				$notice.slideUp(200);
				$pickupInfo.slideDown(200);
				
				$addressInput.val(pickupAddress + " (店面自提)").attr('data-is-auto-filled', 'true');
			} else if (val === 'other') {
				$addressGroup.slideUp(200);
				$pickupInfo.slideUp(200);
				$notice.html(isEnglish ? 
					"⚠️ Sorry, we currently only deliver to <strong>Tanjong Sepat</strong> & <strong>Banting</strong>. Please select <strong>Self-Pickup</strong>." : 
					"⚠️ 抱歉！我们目前仅提供 <strong>Tanjong Sepat</strong> 配送及 <strong>Banting</strong> 地区安排配送。其他区域欢迎选择<strong>【到店自提】</strong>哦！"
				).slideDown(200);
				
				if ($addressInput.attr('data-is-auto-filled') === 'true') {
					$addressInput.val('').removeAttr('data-is-auto-filled');
				}
			} else {
				$addressGroup.slideDown(200);
				$notice.slideUp(200);
				$pickupInfo.slideUp(200);
				
				if ($addressInput.attr('data-is-auto-filled') === 'true') {
					var savedAddress = localStorage.getItem($this.config.storageKeys.custAddress) || '';
					$addressInput.val(savedAddress).removeAttr('data-is-auto-filled');
				}
			}
		});

		$('#close-thankyou-btn, #thankyou-modal-backdrop').on('click', function ()
		{
			$('#thankyou-modal-backdrop').removeClass('show');
			$('#thankyou-modal').removeClass('show');
			$('body').removeClass('no-scroll');
		});

		// VIP 点击逻辑
		$('#open-vip-btn').off('click').on('click', function (e)
		{
			e.preventDefault();
			var isEn = $this.getCurrentLanguage() === 'en';
			var savedName = localStorage.getItem($this.config.storageKeys.custName);
			var savedPhone = localStorage.getItem($this.config.storageKeys.custPhone);
			var savedAddress = localStorage.getItem($this.config.storageKeys.custAddress);

			if ($('body').hasClass('menuOpen')) $('body').removeClass('menuOpen');

			if (savedName)
			{
				$('#profile-display-name').text(savedName);
				$('#profile-display-phone').text(savedPhone || (isEn ? "Not provided" : "未填写"));
				$('#profile-display-address').text(savedAddress || (isEn ? "No default address saved" : "暂无保存的默认地址"));

				$('#vip-profile-backdrop').addClass('show');
				$('#vip-profile-modal').addClass('show');
				$('body').addClass('no-scroll');
			}
			else
			{
				$('#vip-modal-backdrop').addClass('show');
				$('#vip-register-modal').addClass('show');
				$('body').addClass('no-scroll');
			}
		});

		$('#close-vip-profile-modal, #vip-profile-close-btn, #vip-profile-backdrop').on('click', function ()
		{
			$('#vip-profile-backdrop').removeClass('show');
			$('#vip-profile-modal').removeClass('show');
			if (!$('#product-detail-panel').hasClass('open') && !$('#cart-drawer-panel').hasClass('open'))
			{
				$('body').removeClass('no-scroll');
			}
		});

		$('#vip-logout-btn').on('click', function ()
		{
			var isEn = $this.getCurrentLanguage() === 'en';

			localStorage.removeItem($this.config.storageKeys.custName);
			localStorage.removeItem($this.config.storageKeys.custPhone);
			localStorage.removeItem($this.config.storageKeys.custAddress);

			$('#vip-profile-backdrop').removeClass('show');
			$('#vip-profile-modal').removeClass('show');
			if (!$('#product-detail-panel').hasClass('open') && !$('#cart-drawer-panel').hasClass('open'))
			{
				$('body').removeClass('no-scroll');
			}

			$('#open-vip-btn span').text(isEn ? "VIP Profile" : "VIP 档案");
			$('#open-vip-btn').attr('data-label', isEn ? "VIP Profile" : "VIP 档案");

			$this.showToast(isEn ? "Signed out & profile cleared." : "已成功退出并清除档案。");
		});

		$('#close-vip-modal, #vip-modal-backdrop').on('click', function ()
		{
			$('#vip-modal-backdrop').removeClass('show');
			$('#vip-register-modal').removeClass('show');
			if (!$('#product-detail-panel').hasClass('open') && !$('#cart-drawer-panel').hasClass('open'))
			{
				$('body').removeClass('no-scroll');
			}
		});

		$('#vip-register-form').off('submit').on('submit', function (e)
		{
			e.preventDefault();
			var isEn = $this.getCurrentLanguage() === 'en';
			var name = $('#vip-name').val().trim();
			var phone = $('#vip-phone').val().trim();
			var $btn = $('#vip-submit-btn');

			if (!name || !phone)
			{
				$this.showToast(isEn ? "Please enter your name and phone number." : "请填写姓名与手机号码哦。");
				return;
			}

			if (!$this.isValidPhone(phone))
			{
				$this.showToast(isEn ? "Please enter a valid phone number (e.g. 01115277643 or 0123456789)." : "手机号码格式不正确，请检查位数是否有多打或少打。");
				return;
			}

			$btn.css('opacity', '0.7').css('pointer-events', 'none');
			$btn.find('.btn-txt.default').text(isEn ? "Saving..." : "档案生成中...");

			fetch($this.config.googleSheetUrl,
				{
					method: "POST",
					mode: "no-cors",
					headers:
					{
						"Content-Type": "application/json"
					},
					body: JSON.stringify(
					{
						name: name,
						phone: phone
					})
				})
				.then(function ()
				{
					localStorage.setItem($this.config.storageKeys.custName, name);
					localStorage.setItem($this.config.storageKeys.custPhone, phone);

					$this.showToast(isEn ? "Successfully joined! Welcome, " + name : "注册成功！麦日记欢迎您，" + name);

					$btn.css('opacity', '1').css('pointer-events', 'auto');
					$btn.find('.btn-txt.default').text(isEn ? "Create My Profile" : "生成我的专属档案");
					$('#close-vip-modal').trigger('click');

					$('#open-vip-btn span').text(isEn ? "Hi, " + name : "Hi, " + name);
					$('#open-vip-btn').attr('data-label', 'Hi, ' + name);
				})
				.catch(function (error)
				{
					$btn.css('opacity', '1').css('pointer-events', 'auto');
					$btn.find('.btn-txt.default').text(isEn ? "Create My Profile" : "生成我的专属档案");
					$this.showToast(isEn ? "Network error, please try again." : "网络波动，请稍后再试。");
				});
		});
	},

	openProductDetail: function (type, id)
	{
		this.$els.detailPanel.data('type', type);
		this.$els.detailPanel.data('id', id);

		var self = this;
		var isEnglish = this.getCurrentLanguage() === 'en';
		var els = this.$els;

		var products = type === 'cake' ? this.cakeProducts : this.breadProducts;
		var item = products.filter(function (p)
		{
			return p.id === id;
		})[0];
		if (!item) return;

		var folder = type === 'cake' ? 'cake' : 'bread';

		els.detailTitle.text(item.name);
		els.detailPrice.text('RM ' + item.price);
		els.detailText.html(item.desc);

		els.detailPanel.find('.accordion-header').removeClass('active').attr('aria-expanded', 'false');
		els.detailPanel.find('.accordion-content').hide();

		els.detailIngredients.text(item.ingredients || '-');
		els.detailAllergens.text(item.allergens || (isEnglish ? "Contains Gluten (Wheat)." : "含有麸质（小麦）。"));

		if (type === 'cake')
		{
			els.detailStorage.text(isEnglish ?
				"Keep refrigerated (2°C - 6°C). Consume within 2 days for optimal freshness and texture." :
				"需冷藏保存（2°C - 6°C）。建议 2 天内食用完毕，以享受最佳口感与奶香。");
			els.detailReheatTitle.text(isEnglish ? "Serving Suggestion" : "食用建议");
			els.detailReheat.text(isEnglish ?
				"Take out from fridge and let it rest at room temperature for 10-15 minutes before serving for a softer, silkier texture." :
				"冷藏取出后，建议室温静置 10-15 分钟回温后再食用，乳酪慕斯口感将更加丝滑顺柔。");
		}
		else
		{
			els.detailStorage.text(isEnglish ?
				"• Room Temperature: Keep sealed for 2-3 days.\n• Freezer: Slice and freeze sealed for up to 4 weeks.\n(Avoid refrigeration as it dries out the bread)." :
				"• 常温密封：可保存 2-3 天。\n• 切片密封冷冻：可保存 3-4 周。\n（⚠️ 请勿直接冷藏，冷藏会加速水分流线与淀粉老化）。");
			els.detailReheatTitle.text(isEnglish ? "Reheating Suggestions" : "加热复酥建议");
			els.detailReheat.text(isEnglish ?
				"1. Mist: Lightly spray water on the bread surface.\n2. Oven/Air Fryer: Preheat to 180°C and bake for 3-5 minutes.\n3. Pan Fry: Toast sliced bread in a dry pan on medium heat until crispy." :
				"1. 喷水：表面轻喷少量水雾。\n2. 烤箱/空气炸锅：预热 180°C 烘烤 3-5 分钟。\n3. 平底锅：中火无油干煎切片至两面复酥金黄即可。");
		}

		var heroUrl = 'assets/img/' + folder + '/' + item.img + '.webp';
		els.detailHeroImg.css('background-image', "url('" + heroUrl + "')");

		var galleryHtml = '';
		if (item.gallery && item.gallery.length > 0)
		{
			$.each(item.gallery, function (i, imgName)
			{
				galleryHtml += '<img src="assets/img/' + folder + '/' + imgName + '.webp" alt="' + item.name + '">';
			});
		}
		els.detailGallery.html(galleryHtml);

		var $orderBtn = els.detailOrderBtn;
		if (item.status === 'coming_soon')
		{
			var inqText = isEnglish ?
				"Hello MaiRiji! I saw " + item.name + " on your website and am super interested. When will it be available?" :
				"你好，麦日记！我在网站看到了【" + item.name + "】，非常感兴趣！请问大约什么时候会上市上架呢？";
			var inqUrl = "https://wa.me/" + this.config.waNumber + "?text=" + encodeURIComponent(inqText);

			$orderBtn.removeClass('button').addClass('wheat-btn').attr('data-link', inqUrl)
				.html('<span class="btn-text-wrapper"><span class="btn-txt default">' + (isEnglish ? 'Inquire Release Date' : '询问预售 / 上市时间') + '</span><span class="btn-txt hover">WhatsApp Us!</span></span>')
				.off('click').on('click', function (e)
				{
					e.preventDefault();
					e.stopImmediatePropagation();
					window.open(inqUrl, '_blank');
				});
		}
		else
		{
			$orderBtn.removeClass('wheat-btn').addClass('button').removeAttr('data-link')
				.html('<span style="display: inline-flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>' + (isEnglish ? 'Add to Basket' : '加进购物篮') + '</span>')
				.off('click').on('click', function (e)
				{
					e.preventDefault();
					e.stopImmediatePropagation();
					self.addToCart(item, type, 1);
					els.detailPanel.removeClass('open');
					self.openCart();
				});
		}

		els.detailPanel.addClass('open');
		els.body.addClass('no-scroll');
		els.detailPanel.find('.detail-scroll-area').scrollTop(0);
	},

	initStickyNav: function ()
	{
		Waypoint.destroyAll();

		$('.main-header').removeClass('small');
		$('.home-intro .inner').removeClass('scroll-hide');

		var $activeTrigger = $('.page-view.active-view .scrollTrigger');

		if ($activeTrigger.length > 0)
		{
			$activeTrigger.waypoint(
			{
				handler: function (dir)
				{
					if (dir == 'down')
					{
						$('.main-header').addClass('small');
						$('.home-intro .inner').addClass('scroll-hide');
					}
					else
					{
						$('.main-header').removeClass('small');
						$('.home-intro .inner').removeClass('scroll-hide');
					}
				},
				offset: $('.main-header').height() + 15
			});
		}
		Waypoint.refreshAll();
	},

	handleHorizontalScroll: function (scrollTop)
	{
		if (this.isMobile()) return;

		var $scrollWrapper = $('.horizontal-scroll-wrapper');
		if ($scrollWrapper.length === 0 || $scrollWrapper.is(':hidden')) return;

		var winHeight = $(window).height();
		var wrapperTop = $scrollWrapper.offset().top;
		var wrapperHeight = $scrollWrapper.height();
		var effectiveHeight = wrapperHeight - winHeight;
		var scrollDist = scrollTop - wrapperTop;

		var $track = $('.savoria-track');
		var $cards = $('.savoria-card');
		var $contentWrap = $('.savoria-sticky-viewport > .wrap');
		var $diary = $('#home-diary');

		if (scrollDist >= 0 && scrollDist <= effectiveHeight)
		{
			var progress = scrollDist / effectiveHeight;
			var splitPoint = 0.75;

			var trackWidth = $track.outerWidth();
			var viewportWidth = $(window).width();

			var maxTranslateX = trackWidth - viewportWidth + (viewportWidth * 0.3);
			var maxTranslateY = Math.max(0, $contentWrap.outerHeight() - winHeight);

			if (progress <= splitPoint)
			{
				var hProg = progress / splitPoint;
				$track.css('transform', 'translateX(' + (-maxTranslateX * hProg) + 'px)');

				$cards.each(function (i)
				{
					var isOdd = i % 2 !== 0;
					var val = Math.sin(hProg * Math.PI * 2 + (isOdd ? Math.PI : 0)) * 30;
					$(this).css('transform', 'translateY(' + val + 'px)');
				});

				$diary.removeClass('is-visible');
				$contentWrap.css('transform', 'translateY(0px)');

			}
			else
			{
				var vProg = (progress - splitPoint) / (1 - splitPoint);
				$track.css('transform', 'translateX(' + (-maxTranslateX) + 'px)');
				$diary.addClass('is-visible');

				$contentWrap.css('transform', 'translateY(' + (-maxTranslateY * vProg) + 'px)');
			}
		}
		else if (scrollDist < 0)
		{
			$track.css('transform', 'translateX(0px)');
			$cards.css('transform', 'translateY(0px)');
			$diary.removeClass('is-visible');
		}
	},

	handlePageTransition: function ($link)
	{
		var self = this;
		var targetId = $link.data('target');

		if (!targetId || $('#' + targetId).length === 0) return;

		var $toast = $('#toast-transition');

		$toast.removeClass('pop-in expanding fading-out').css('opacity', '');
		void $toast[0].offsetWidth;

		$toast.addClass('pop-in');

		setTimeout(function ()
		{
			$toast.addClass('expanding');

			setTimeout(function ()
			{
				$('.page-view').removeClass('active-view');
				$('#' + targetId).addClass('active-view');

				window.scrollTo(0, 0);

				$('.home-intro .wrap, .page-intro .wrap').css('opacity', '');

				if ($('body').hasClass('menuOpen')) $('body').removeClass('menuOpen');
				$('#product-detail-panel').removeClass('open');
				$('body').removeClass('no-scroll');

				var $bg = (targetId === 'view-home') ? $('.home-intro .bg-inner') : $('#' + targetId + ' .bg-inner');
				if ($bg.length > 0)
				{
					$bg.removeClass('play-zoom');
					void $bg[0].offsetWidth;
					$bg.addClass('play-zoom');
				}

				self.initStickyNav();

				var frames = 60;
				var stabilize = function ()
				{
					if (self.wax && self.wax.elements)
					{
						for (var i = 0; i < self.wax.elements.length; i++)
						{
							self.wax.elements[i].onResize();
							self.wax.elements[i].onFrame();
						}
					}
					Waypoint.refreshAll();

					frames--;
					if (frames > 0)
					{
						requestAnimationFrame(stabilize);
					}
				};
				stabilize();

				$toast.addClass('fading-out');

				setTimeout(function ()
				{
					$toast.removeClass('pop-in expanding fading-out');
				}, 400);

			}, 500);
		}, 600);
	},

	onLoad: function ()
	{
		if (this.isMobile()) return;

		this.wax.addElement($('.page-intro .bg, .home-intro .bg, header.intro .bg'), null,
		{
			deltaY: 1.2,
			mode: 'translate'
		});

		this.wax.start();
	},

	isMobile: function ()
	{
		var isSmallScreen = window.innerWidth <= 769;
		var isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
		return isSmallScreen || isTouchDevice;
	},

	initCustomCursor: function ()
	{
		$('html').addClass('custom-cursor-active');

		if (this.isMobile())
		{
			$('#custom-cursor').remove();
			return;
		}

		var $cursor = $('#custom-cursor');
		if ($cursor.length === 0)
		{
			$cursor = $('<div id="custom-cursor"></div>');
			$('body').append($cursor);
		}
		else
		{
			$cursor.detach();
			$('body').append($cursor);
		}

		$cursor.css(
		{
			'position': 'fixed',
			'top': '0',
			'left': '0',
			'z-index': '2147483647',
			'pointer-events': 'none',
			'transform': 'translate3d(0, 0, 0)',
			'isolation': 'isolate',
			'margin': '0',
			'padding': '0',
			'width': '36px',
			'height': '36px',
			'will-change': 'transform, left, top'
		});

		var defaultFrames = [
			'assets/img/cursor/cursor1.png', 'assets/img/cursor/cursor2.png', 'assets/img/cursor/cursor3.png'
		];
		var pointerFrames = [
			'assets/img/cursor/pointer1.png', 'assets/img/cursor/pointer2.png', 'assets/img/cursor/pointer3.png'
		];
		var normalClickFrames = [
			'assets/img/cursor/click1.png', 'assets/img/cursor/click2.png'
		];
		var pointerClickFrames = [
			'assets/img/cursor/ptrClick1.png', 'assets/img/cursor/ptrClick2.png', 'assets/img/cursor/ptrClick3.png'
		];

		$cursor.empty();
		var imageElements = {};

		var allFrames = defaultFrames.concat(pointerFrames, normalClickFrames, pointerClickFrames);

		var uniqueFrames = [];
		$.each(allFrames, function (i, el)
		{
			if ($.inArray(el, uniqueFrames) === -1) uniqueFrames.push(el);
		});

		$.each(uniqueFrames, function (index, src)
		{
			var $img = $('<img>').attr('src', src).css(
			{
				'position': 'absolute',
				'top': '0',
				'left': '0',
				'width': '100%',
				'height': '100%',
				'display': 'none'
			});
			$cursor.append($img);
			imageElements[src] = $img;
		});

		var currentActiveImg = null;

		function setCursorImage(src)
		{
			if (currentActiveImg === imageElements[src]) return;
			if (currentActiveImg) currentActiveImg.hide();
			currentActiveImg = imageElements[src];
			if (currentActiveImg) currentActiveImg.show();
		}

		setCursorImage(defaultFrames[0]);

		var interactiveSelectors = 'a, button, input[type="submit"], .btn';
		var isHovering = false;
		var isClickAnimating = false;
		var currentLoopFrames = defaultFrames;
		var currentFrameIndex = 0;
		var animationTimer = null;

		function playClickAnimation(framesToPlay, onCompleteFrames)
		{
			if (isClickAnimating) return;
			isClickAnimating = true;
			currentFrameIndex = 0;

			setCursorImage(framesToPlay[0]);

			var frameDuration = 100;
			var playNextFrame = function (index)
			{
				if (index < framesToPlay.length)
				{
					setCursorImage(framesToPlay[index]);
					animationTimer = setTimeout(function ()
					{
						playNextFrame(index + 1);
					}, frameDuration);
				}
				else
				{
					isClickAnimating = false;
					currentLoopFrames = onCompleteFrames;
					currentFrameIndex = -1;
				}
			};

			animationTimer = setTimeout(function ()
			{
				playNextFrame(1);
			}, frameDuration);
		}

		$(document).on('mouseenter', interactiveSelectors, function ()
		{
			isHovering = true;
			if (!isClickAnimating)
			{
				currentLoopFrames = pointerFrames;
				currentFrameIndex = -1;
				updateLoopImage();
			}
		});

		$(document).on('mouseleave', interactiveSelectors, function ()
		{
			isHovering = false;
			if (!isClickAnimating)
			{
				currentLoopFrames = defaultFrames;
				currentFrameIndex = -1;
				updateLoopImage();
			}
		});

		$(document).on('mousedown', function ()
		{
			clearTimeout(animationTimer);
			isClickAnimating = false;
			if (isHovering)
			{
				playClickAnimation(pointerClickFrames, pointerFrames);
			}
			else
			{
				playClickAnimation(normalClickFrames, defaultFrames);
			}
		});

		function updateLoopImage()
		{
			if (isClickAnimating) return;
			currentFrameIndex = (currentFrameIndex + 1) % currentLoopFrames.length;
			setCursorImage(currentLoopFrames[currentFrameIndex]);
		}

		var startCursorTimer = function ()
		{
			if (self.cursorTimer) clearInterval(self.cursorTimer);
			self.cursorTimer = setInterval(updateLoopImage, 200);
		};

		var stopCursorTimer = function ()
		{
			if (self.cursorTimer)
			{
				clearInterval(self.cursorTimer);
				self.cursorTimer = null;
			}
		};

		startCursorTimer();

		$(document).on('mousemove.customCursor', function (e)
		{
			$cursor.css(
			{
				'transform': 'translate3d(' + (e.clientX - 5) + 'px, ' + (e.clientY - 5) + 'px, 0)'
			});
			if ($cursor.css('display') === 'none') $cursor.show();
		});

		$(document).off('.cursorWindow').on(
		{
			'mouseleave.cursorWindow': function ()
			{
				$cursor.hide();
				stopCursorTimer();
			},
			'mouseenter.cursorWindow': function ()
			{
				if ($cursor.css('display') === 'none') $cursor.show();
				startCursorTimer();
			}
		});
	},

	loadHighResImages: function ()
	{
		$('.progressive-bg').each(function ()
		{
			var $el = $(this);
			var highResUrl = $el.data('highres');

			if (highResUrl)
			{
				var img = new Image();

				img.onload = function ()
				{
					$el.css('background-image', "url('" + highResUrl + "')");
					$el.removeClass('blur-effect');
				};

				img.src = highResUrl;
			}
		});
	},

	loadCart: function ()
	{
		try
		{
			var saved = localStorage.getItem(this.config.storageKeys.cart);
			return saved ? JSON.parse(saved) : [];
		}
		catch (e)
		{
			return [];
		}
	},

	saveCart: function ()
	{
		try
		{
			localStorage.setItem(this.config.storageKeys.cart, JSON.stringify(this.cart));
		}
		catch (e)
		{}
	},

	getItemDisplayName: function (item)
	{
		var products = item.type === 'cake' ? this.cakeProducts : this.breadProducts;
		if (products && products.length > 0)
		{
			var match = products.filter(function (p)
			{
				return p.id === item.id;
			})[0];
			if (match) return match.name;
		}
		return item.name;
	},

	addToCart: function (item, type, qty)
	{
		qty = qty || 1;
		this.cart = this.cart || [];
		var existing = this.cart.filter(function (x)
		{
			return x.id === item.id;
		})[0];
		if (existing)
		{
			existing.qty += qty;
		}
		else
		{
			this.cart.push(
			{
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

		$('#cart-count-badge').addClass('bump');
		setTimeout(function ()
		{
			$('#cart-count-badge').removeClass('bump');
		}, 300);
	},

	changeCartItemQty: function (id, delta)
	{
		var item = this.cart.filter(function (x)
		{
			return x.id === id;
		})[0];
		if (item)
		{
			item.qty += delta;
			if (item.qty <= 0)
			{
				this.removeCartItem(id);
				return;
			}
			this.saveCart();
			this.updateCartUI();
		}
	},

	removeCartItem: function (id)
	{
		this.cart = this.cart.filter(function (x)
		{
			return x.id !== id;
		});
		this.saveCart();
		this.updateCartUI();
	},

	updateCartUI: function ()
	{
		var els = this.$els;
		var totalQty = 0;
		var totalPrice = 0;
		var isEnglish = this.getCurrentLanguage() === 'en';
		var self = this;

		if (!this.cart || this.cart.length === 0)
		{
			els.cartList.html('<div class="cart-empty-tip">' + (isEnglish ? 'Your basket is empty 🥖' : '你的购物篮还是空的 🥖') + '</div>');
			els.cartTotalPrice.text('RM 0.00');
			els.cartBadge.text('0');
			return;
		}

		var html = '';
		$.each(this.cart, function (i, item)
		{
			totalQty += item.qty;
			totalPrice += item.price * item.qty;
			var folder = item.type === 'cake' ? 'cake' : 'bread';
			var displayName = self.getItemDisplayName(item);

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
		els.cartTotalPrice.text('RM ' + totalPrice.toFixed(2));
		els.cartBadge.text(totalQty);
	},

	checkoutWhatsApp: function (customerData)
	{
		var isEnglish = this.getCurrentLanguage() === 'en';

		if (!this.cart || this.cart.length === 0)
		{
			this.showToast(isEnglish ? 'Your basket is empty!' : '购物篮还是空的哦！');
			return;
		}

		var totalPrice = 0;
		var totalQty = 0;
		var self = this;

		var isVIP = !!localStorage.getItem(this.config.storageKeys.custName);
		var vipBadge = isVIP ? (isEnglish ? " [VIP Member]" : " [VIP会员]") : "";

		var msg = isEnglish ?
			"Hello MaiRiji! I would like to place an order:\n\n" :
			"你好，麦日记！我想预定以下商品：\n\n";

		if (customerData)
		{
			msg += isEnglish ? "【Customer & Delivery Info】\n" : "【预定与配送信息】\n";
			if (customerData.deliveryZone)
			{
				msg += (isEnglish ? "Type/Zone: " : "配送/取货方式：") + customerData.deliveryZone + "\n";
			}
			if (customerData.name)
			{
				msg += (isEnglish ? "Name: " : "姓名：") + customerData.name + vipBadge + "\n";
			}
			if (customerData.phone)
			{
				msg += (isEnglish ? "Contact Phone: " : "联系电话：") + customerData.phone + "\n";
			}
			msg += (isEnglish ? "Address/Note: \n" : "地址/说明：\n") + customerData.address + "\n";
			msg += (isEnglish ? "Preferred Date: " : "期望日期：") + customerData.date + "\n\n";
		}

		msg += isEnglish ? "【Order Details】\n" : "【商品明细】\n";

		$.each(this.cart, function (i, item)
		{
			var lineTotal = (item.price * item.qty).toFixed(2);
			totalPrice += item.price * item.qty;
			totalQty += item.qty;

			var displayName = self.getItemDisplayName(item);
			msg += (i + 1) + ". " + displayName + " x " + item.qty + " — RM " + lineTotal + "\n";
		});

		msg += "\n------------------------------\n";
		msg += isEnglish ?
			"Total Items: " + totalQty + " | Total: RM " + totalPrice.toFixed(2) + "\n\n" :
			"共 " + totalQty + " 件商品 | 总计：RM " + totalPrice.toFixed(2) + "\n\n";

		msg += isEnglish ?
			"Please confirm availability and delivery schedule with me. Thank you!" :
			"请与我确认具体配送/自提时间，谢谢！";

		var waNumber = self.config.waNumber;
		var finalUrl = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(msg);

		var newWin = window.open(finalUrl, '_blank');
		if (!newWin || newWin.closed || typeof newWin.closed == 'undefined')
		{
			window.location.href = finalUrl;
		}
	},

	openCheckoutModal: function ()
	{
		var tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		var yyyy = tomorrow.getFullYear();
		var mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
		var dd = String(tomorrow.getDate()).padStart(2, '0');
		var minDateStr = yyyy + '-' + mm + '-' + dd;

		var $dateInput = $('#cust-date');
		$dateInput.attr('min', minDateStr);

		if (!$dateInput.val() || $dateInput.val() < minDateStr)
		{
			$dateInput.val(minDateStr);
		}

		var savedName = localStorage.getItem(this.config.storageKeys.custName);
		var savedPhone = localStorage.getItem(this.config.storageKeys.custPhone);
		var savedAddress = localStorage.getItem(this.config.storageKeys.custAddress);

		if (savedName && !$('#cust-name').val())
		{
			$('#cust-name').val(savedName);
		}
		if (savedPhone && !$('#cust-phone').val())
		{
			$('#cust-phone').val(savedPhone);
		}
		if (savedAddress && !$('#cust-address').val())
		{
			$('#cust-address').val(savedAddress);
		}

		this.closeCart();
		$('#checkout-modal-backdrop').addClass('show');
		$('#checkout-modal').addClass('show');
		$('body').addClass('no-scroll');
	},

	closeCheckoutModal: function ()
	{
		$('#checkout-modal-backdrop').removeClass('show');
		$('#checkout-modal').removeClass('show');
		if (!$('#product-detail-panel').hasClass('open') && !$('#cart-drawer-panel').hasClass('open'))
		{
			$('body').removeClass('no-scroll');
		}
	},

	openGPSModal: function ()
	{
		var isEnglish = this.getCurrentLanguage() === 'en';

		$('#gps-modal-backdrop').addClass('show');
		$('#gps-confirm-modal').addClass('show');

		$('#gps-unit').val('');
		$('#gps-street').val('');
		$('#gps-coords').val('');
		$('#gps-loading-status').html(isEnglish ? "⌛ Detecting your precise GPS location, please wait..." : "⌛ 正在获取您的精准 GPS 位置，请稍候...");

		this.startGPSDetection();
	},

	closeGPSModal: function ()
	{
		$('#gps-modal-backdrop').removeClass('show');
		$('#gps-confirm-modal').removeClass('show');
	},

	startGPSDetection: function ()
	{
		var isEnglish = this.getCurrentLanguage() === 'en';
		var self = this;

		if (!navigator.geolocation)
		{
			self.showToast(isEnglish ? "GPS geolocation is not supported." : "您的浏览器不支持 GPS 地理定位。");
			$('#gps-loading-status').html(isEnglish ? "❌ GPS not supported." : "❌ 浏览器不支持 GPS");
			return;
		}

		navigator.geolocation.getCurrentPosition(
			function (position)
			{
				var lat = position.coords.latitude.toFixed(6);
				var lng = position.coords.longitude.toFixed(6);

				$('#gps-coords').val(lat + "," + lng);

				var reverseUrl = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=" + lat + "&lon=" + lng;

				fetch(reverseUrl,
					{
						headers:
						{
							'Accept-Language': 'en-US,en;q=0.9'
						}
					})
					.then(function (res)
					{
						return res.json();
					})
					.then(function (data)
					{
						var street = data.display_name || "GPS Detected Area";
						$('#gps-street').val(street);

						if (data.address && data.address.house_number)
						{
							$('#gps-unit').val("No. " + data.address.house_number);
						}

						$('#gps-loading-status').html(isEnglish ? "✅ Location detected! Please verify & enter house number." : "✅ 定位成功！请核对街道并补全门牌号。");
						$('#gps-unit').focus();
					})
					.catch(function ()
					{
						$('#gps-street').val("Detected GPS Area");
						$('#gps-loading-status').html(isEnglish ? "✅ Coordinates captured. Please fill in house number." : "✅ 坐标抓取成功，请补充门牌号。");
						$('#gps-unit').focus();
					});
			},
			function (error)
			{
				var errMsg = isEnglish ? "Failed to get location. Please check location permissions." : "定位失败，请确保已开启浏览器位置权限。";
				$('#gps-loading-status').html("❌ " + errMsg);
			},
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 0
			}
		);
	},

	showToast: function (msg, duration)
	{
		duration = duration || 2500;
		var $toast = $('#app-toast-msg');

		if ($toast.length === 0)
		{
			$toast = $('<div id="app-toast-msg"></div>').appendTo('body');
		}

		$toast.text(msg).addClass('show');

		clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(function ()
		{
			$toast.removeClass('show');
		}, duration);
	},

	// 校验手机号码（严格规则：0111 + 7位数字，或 010/012~019 + 7位数字）
	isValidPhone: function (phone) {
		if (!phone) return false;
		
		var cleaned = phone.replace(/[\s\-\(\)\+]/g, '');

		if (cleaned.indexOf('601') === 0) {
			cleaned = '0' + cleaned.substring(2);
		}

		// 0111 + 7位数字（共11位） 或 010, 012~019 + 7位数字（共10位）
		var phonePattern = /^(0111\d{7}|01[02-9]\d{7})$/;

		return phonePattern.test(cleaned);
	},

	// 显示贴身字段错误提醒
	showFieldError: function ($input, msg) {
		var $group = $input.closest('.form-group');
		$group.find('.field-error-msg').remove();
		
		$input.addClass('input-error').focus();
		$group.append('<div class="field-error-msg">⚠️ ' + msg + '</div>');
	},

	// 清除字段错误状态
	clearFieldError: function ($input) {
		var $group = $input.closest('.form-group');
		$input.removeClass('input-error');
		$group.find('.field-error-msg').remove();
	},
};