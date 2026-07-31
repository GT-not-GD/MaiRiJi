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
			if (this.elements[i].el.get(0) == el.get(0))
			{
				this.elements[i].destroy();
				this.elements.splice(this.elements[i], 1)
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
			// 🌟 使用 .on('load error') 替代已废弃的 .load()，同时监听 404 加载失败容错
			$media.one("load.WnkMediaLoader error.WnkMediaLoader", function() {
				self.onMediaLoaded();
			});

			if (media.complete) {
				$media.trigger('load');
			}
		}
		else if ($media.prop('tagName') === 'VIDEO')
		{
			$media.one("loadeddata.WnkMediaLoader error.WnkMediaLoader", function() {
				self.onMediaLoaded();
			});
			media.load();
		}
		else
		{
			this.count = -1;
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
	// 实例化视差控制器
	this.wax = new WnkLaxController();
}

MaiRijiApp.prototype = {

	// --- 启动入口 ---
	preload: function ()
	{
		this.init();
	},

	// --- 初始化 ---
	init: function ()
	{
		var $this = this;

		// 生成产品卡片
		this.renderProducts();

		// 2. 👇 新增：生成 Savoria 横向滚动卡片（默认从 bread 随机抽取）
		this.renderSavoriaCards('bread');

		// 👇 新增：全站扫描并强制预加载所有 tiny 图 👇
		this.forceLoadTinyImages();

		// 触发首页背景 Ken Burns 放大动画
		$('.home-intro .bg-inner').addClass('play-zoom');
		// 绑定所有交互事件
		this.bindEvents();

		// 🌟 新增：启动鼠标动画
		this.initCustomCursor();

		// 初始化购物车数据
		this.cart = this.loadCart();
		this.updateCartUI();
	},

	getCurrentLanguage: function ()
	{
		return $('html').attr('lang') === 'en' ? 'en' : 'zh';
	},

	// 👇 新增这个函数：自动生成 Savoria 卡片 👇
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
			var displayLabels = isEnglish ?
				['Signature', '', 'Fresh', '', 'Sweet', '', ''] :
				['Signature / 招牌', '', 'Fresh / 新鲜', '', 'Sweet / 甜点', '', ''];
			var displayLabel = displayLabels[index] || '';
			var tinyUrl = 'assets/img/' + folder + '/' + photoName + '-tiny.webp';
			var highResUrl = 'assets/img/' + folder + '/' + photoName + '.webp';

			// 预加载 tiny 版本，避免首次显示延迟
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

	// 🌟 新增的黑科技：全局 tiny 图提取与强制加载
	forceLoadTinyImages: function ()
	{
		$('.progressive-bg').each(function ()
		{
			// 读取内联 style 里的 background-image URL
			var bgStr = $(this)[0].style.backgroundImage;
			if (bgStr && bgStr !== 'none')
			{
				// 用正则把 url('...') 里面的干净链接提取出来
				var url = bgStr.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
				// 强制浏览器后台下载这张 tiny 图
				new Image().src = url;
			}
		});
	},

	// 自动生成面包卡片
	renderProducts: function ()
	{
		var isEnglish = this.getCurrentLanguage() === 'en';

		// 💡 重点：把商品赋值给 this，方便我们全局调用
		this.breadProducts = isEnglish ? [
		{
			id: 'b1',
			name: "Country Sourdough",
			price: "14.00",
			img: "1",
			desc: "Our signature country loaf, fermented for over 18 hours with natural wild yeast. Features a crisp, blistered crust and a soft, highly hydrated crumb with a subtle, delicate acidity.",
			gallery: ["1", "1-hover"]
		},
		{
			id: 'b2',
			name: "Chocolate Sourdough",
			price: "16.00",
			img: "2",
			desc: "Crafted with premium dark chocolate folded into long-fermented dough. Rich, decadent chocolate notes perfectly balanced with a gentle sourdough finish.",
			gallery: ["2", "2-hover"]
		},
		{
			id: 'b3',
			name: "Lemon Blueberry Sourdough",
			price: "16.50",
			img: "3",
			desc: "Bursting with tart dried blueberries and fragrant fresh lemon zest. A refreshing, fruity sourdough with bright citrus aroma in every bite.",
			gallery: ["3", "3-hover"]
		},
		{
			id: 'b4',
			name: "Classic Walnut Raisin Sourdough",
			price: "16.00",
			img: "4",
			desc: "Packed with crunchy toasted walnuts and sweet sun-dried raisins. Offers a delightful contrast of textures and natural sweetness.",
			gallery: ["4", "4-hover"]
		},
		{
			id: 'b5',
			name: "Coffee Chocolate Sourdough",
			price: "16.00",
			img: "5",
			desc: "Infused with aromatic espresso coffee dough and rich dark chocolate pieces. Bold roasted coffee notes harmonized with smooth chocolate sweetness.",
			gallery: ["5", "5-hover"]
		},
		{
			id: 'b6',
			name: "Matcha Cranberry Sourdough",
			price: "16.00",
			img: "6",
			desc: "Earthy premium matcha paired with sweet-tart dried cranberries. Vibrant in color and rich in tea aroma, creating a beautifully balanced flavor.",
			gallery: ["6", "6-hover"]
		},
		{
			id: 'b7',
			name: "Highland Barley Walnut Sourdough",
			price: "16.00",
			img: "7",
			desc: "Made with nutritious highland barley and toasted walnuts. Earthy, nutty, and wholesome with a rich grain texture and wonderful chewiness.",
			gallery: ["7", "7-hover"]
		},
		{
			id: 'b8',
			name: "Black Tea Orange Peel Sourdough",
			price: "16.50",
			img: "8",
			desc: "Infused with fragrant black tea dough and dotted with candied orange peels. Elegant citrus notes merged with cozy, warm tea aroma.",
			gallery: ["8", "8-hover"]
		},
		{
			id: 'b9',
			name: "Honey Pumpkin & Seed Sourdough",
			price: "16.50",
			img: "9",
			desc: "A cozy blend of real pumpkin puree, pure honey, and crunchy pumpkin seeds. Tender, naturally sweet crumb topped with toasted seeds.",
			gallery: ["9", "9-hover"]
		},
		{
			id: 'b10',
			name: "Dragon Fruit Cream Cheese Sourdough",
			price: "17.00",
			img: "10",
			desc: "Made with 100% fresh red dragon fruit puree for a striking natural pink color, filled with velvety, rich cream cheese pockets.",
			gallery: ["10", "10-hover"]
		}] : [
		{
			id: 'b1',
			name: "乡村欧包",
			price: "14.00",
			img: "1",
			desc: "麦日记的招牌经典之作。只使用面粉、水、盐和培育多年的天然酸种。历经18小时以上的低温慢发酵，外壳酥脆，内里组织湿润弹牙，带有纯粹的麦香与微酸回甘。",
			gallery: ["1", "1-hover"]
		},
		{
			id: 'b2',
			name: "巧克力欧包",
			price: "16.00",
			img: "2",
			desc: "选用浓郁微苦的法式黑巧克力融入面团。经过烘烤后巧克力微微融化，带给面包丝滑口感与丰富的可可层次，甜而不腻，满足感十足。",
			gallery: ["2", "2-hover"]
		},
		{
			id: 'b3',
			name: "柠檬蓝莓欧包",
			price: "16.50",
			img: "3",
			desc: "清爽的鲜磨柠檬皮屑与多汁的蓝莓干完美结合。酸甜果香在舌尖绽放，入口带着天然果酸与柠檬清香，是下午茶的绝佳选择。",
			gallery: ["3", "3-hover", "3-detail-1"]
		},
		{
			id: 'b4',
			name: "经典葡萄核桃欧包",
			price: "16.00",
			img: "4",
			desc: "香脆的烤核桃搭配日晒甘甜的葡萄干。坚果的醇香与果干的自然酸甜交织，咀嚼间充满饱满的层次感，是广受欢迎的经典口味。",
			gallery: ["4", "4-hover"]
		},
		{
			id: 'b5',
			name: "咖啡巧克力欧包",
			price: "16.00",
			img: "5",
			desc: "浓郁咖啡风味与黑巧克力块的浪漫碰撞。醇厚的咖啡苦香烘托出巧克力的甜美，回味悠长，唤醒每一个慵懒的早晨。",
			gallery: ["5", "5-hover", "5-detail-1"]
		},
		{
			id: 'b6',
			name: "抹茶蔓越莓欧包",
			price: "16.00",
			img: "6",
			desc: "严选优质抹茶粉，呈现幽雅的自然茶绿。搭配酸甜可口的蔓越莓干，抹茶的微苦与果干的甘甜互补，茶香余韵悠长。",
			gallery: ["6", "6-hover"]
		},
		{
			id: 'b7',
			name: "青稞核桃欧包",
			price: "16.00",
			img: "7",
			desc: "融入营养丰富的熟青稞与烤核桃粒。青稞特有的谷物粗粝感与坚果油脂香气相结合，越嚼越香，健康又有嚼劲。",
			gallery: ["7", "7-hover", "7-detail-1"]
		},
		{
			id: 'b8',
			name: "红茶橙皮欧包",
			price: "16.50",
			img: "8",
			desc: "醇厚红茶汤揉面，搭配糖渍橙皮丁。茶香温润，橙皮清甜微苦，每一口都能感受到柑橘与红茶的雅致韵味。",
			gallery: ["8", "8-hover"]
		},
		{
			id: 'b9',
			name: "蜂蜜金瓜南瓜籽欧包",
			price: "16.50",
			img: "9",
			desc: "融入纯正蜂蜜与新鲜南瓜泥，表层撒满香脆南瓜籽。面包体绵软带有天然甜香，南瓜籽增加香脆嚼劲，营养满分。",
			gallery: ["9", "9-hover"]
		},
		{
			id: 'b10',
			name: "火龙果奶酪欧包",
			price: "17.00",
			img: "10",
			desc: "纯红肉火龙果榨汁揉面，呈现梦幻的天然粉红色。包裹着浓郁绵密的奶油奶酪夹心，果香与奶香交织，颜值与美味兼备。",
			gallery: ["10", "10-hover"]
		}];

		this.cakeProducts = isEnglish ? [
		{
			id: 'c1',
			name: "Amber Caramel Double Fromage Cheesecake",
			price: "0.00",
			img: "1",
			status: 'coming_soon',
			desc: "A heavenly double-layer creation featuring a velvety unbaked mascarpone mousse on top, a rich baked cheesecake in the middle, and a crispy caramelized cookie base. A melt-in-your-mouth indulgence infused with warm amber caramel notes.",
			gallery: ["1", "1-hover"]
		}] : [
		{
			id: 'c1',
			name: "琥珀焦糖双层乳酪蛋糕",
			price: "0.00",
			img: "1",
			status: 'coming_soon',
			desc: "底座是香脆的焦糖饼干，中层是浓郁醇厚的烘焙芝士，顶层则是如云朵般轻盈的生乳酪慕斯。温暖焦香与丝滑奶香完美交织，带来层次丰富、入口即化的奢华体验。",
			gallery: ["1", "1-hover"]
		}];

		this.renderProductGroup('bread', this.breadProducts, isEnglish ? 'Sourdough / Bread' : 'Sourdough / 酸种欧包');
		this.renderProductGroup('cake', this.cakeProducts, isEnglish ? 'Cake / Desserts' : 'Cake / 蛋糕');
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

			// 💡 新增：判断是否是未上线产品
			var isComingSoon = item.status === 'coming_soon';
			var badgeHtml = isComingSoon ?
				`<span class="coming-soon-badge">${isEnglish ? 'Coming Soon' : '敬请期待'}</span>` :
				'';

			html += `
            <li class="grid__item slider__slide">
                <a href="#product-detail" class="product-card-wrapper card-wrapper open-detail-btn" data-type="${type}" data-id="${item.id}" style="background: transparent; border: none; box-shadow: none; padding: 0; display: block; cursor: none;">
                    <div class="stack-container">
                        ${badgeHtml} <!-- 👈 插入敬请期待标签 -->
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

		// 仅在渲染面包时设置全局菜单标题
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

			// Refresh sticky nav in case layout changed
			try
			{
				self.initStickyNav();
			}
			catch (e)
			{}
		};

		// If animation not requested, do immediate switch
		if (!animate)
		{
			doSwitch();
			return;
		}

		var $toast = $('#toast-transition');
		$toast.removeClass('pop-in expanding fading-out').css('opacity', '');
		void $toast[0].offsetWidth;
		$toast.addClass('pop-in');

		// Shorter timing for menu switch
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

	// --- 事件绑定中心 ---
	bindEvents: function ()
	{
		var $this = this;

		// A. 启动导航栏滚动监听 (Sticky Header)
		this.initStickyNav();

		// B. 图片加载完后启动视差 (仅限桌面端，优化性能)
		if (!this.isMobile())
		{
			var loader = new WnkMediaLoader($('img'), this);
			$(this).one(loader.eventName, $.proxy(this.onLoad, this));
			loader.load();
		}

		// C. 移动端汉堡菜单切换
		$('.m-burger').on('click', function ()
		{
			$('body').toggleClass('menuOpen');
		});

		// D. 导航栏链接点击 (SPA 页面切换)
		$('.nav-link').on('click', function (e)
		{
			e.preventDefault();
			// 如果点击的是当前页面，不做任何事
			var targetId = $(this).data('target');
			if ($('#' + targetId).hasClass('active-view')) return;

			$this.handlePageTransition($(this));
		});

		// E. 首页/菜单页“平滑下滑”按钮
		$(document).on('click', 'a.down, a.scroll-link', function (e)
		{
			e.preventDefault();
			var targetId = $(this).attr('href');
			var $target = $(targetId);
			if ($target.length > 0)
			{
				// 平滑下滑并避开导航栏
				$('html, body').animate(
				{
					scrollTop: $target.offset().top - 60
				}, 800);
			}
		});

		// F. 全局滚动监听 (用于横向滚动特效)
		var ticking = false;
		$(window).on('scroll', function ()
		{
			if (!ticking)
			{
				window.requestAnimationFrame(function ()
				{
					var scrollTop = $(window).scrollTop();
					$this.handleHorizontalScroll(scrollTop);
					if ($this.wax && $this.wax.enabled)
					{
						$this.wax.onFrame();
					}
					ticking = false;
				});
				ticking = true;
			}
		});

		// G. 窗口大小改变时，重置视差计算
		$(window).on('resize', function ()
		{
			if ($this.wax && $this.wax.elements)
			{
				for (var i = 0; i < $this.wax.elements.length; i++)
				{
					$this.wax.elements[i].onResize();
				}
			}
			// 重新计算导航栏触发点
			Waypoint.refreshAll();
		});

		// H. 麦穗按钮点击特效 (仅对带有 data-link 的按钮生效)
        $(document).on('click', '.wheat-btn[data-link]', function (e)
        {
			var $btn = $(this);
			var targetUrl = $btn.attr('data-link');

			if (!$btn.hasClass('clicked'))
			{
				$btn.addClass('clicked'); // 播放动画

				setTimeout(function ()
				{
					// 只有当有有效链接时才打开新窗口
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

		// I. 菜单分类切换：Bread / Cake (带转场动画)
		$('.menu-switcher-btn').on('click', function ()
		{
			var target = $(this).data('view');
			$this.switchMenuView(target, true);
		});

		// J. 点击产品，打开详情面板
		$(document).on('click', '.open-detail-btn', function (e)
		{
			e.preventDefault();
			var type = $(this).data('type');
			var id = $(this).data('id');
			$this.openProductDetail(type, id);
		});

		// K. 点击关闭按钮，隐藏面板
		$(document).on('click', '.close-detail-btn', function (e)
		{
			e.preventDefault();
			$('#product-detail-panel').removeClass('open');

			// 💡 只有当“购物车抽屉”也没有打开时，才恢复导航栏与页面滚动！
			if (!$('#cart-drawer-panel').hasClass('open'))
			{
				$('body').removeClass('no-scroll');
			}
		});

		// L. 封装打开与关闭购物车的函数
		$this.openCart = function ()
		{
			$('#cart-drawer-panel').addClass('open');
			$('#cart-backdrop').addClass('show');
			$('body').addClass('no-scroll'); // 触发导航栏向上隐藏
		};

		$this.closeCart = function ()
		{
			$('#cart-drawer-panel').removeClass('open');
			$('#cart-backdrop').removeClass('show');

			// 💡 只有当“产品详情页”也没有打开时，才恢复导航栏与页面滚动！
			if (!$('#product-detail-panel').hasClass('open'))
			{
				$('body').removeClass('no-scroll');
			}
		};

		// 绑定点击事件：点击浮动图标打开，点击关闭按钮或黑色遮罩关闭
		$('#cart-float, .open-cart-btn').on('click', function (e)
		{
			e.preventDefault();
			$this.openCart();
		});
		$('.close-cart-btn, #cart-backdrop').on('click', function ()
		{
			$this.closeCart();
		});

		// M. 购物车内部：加减数量与删除
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

		// N. 点击购物车结算按钮：直接打开弹窗（不播放落叶动画）
        $('#cart-checkout-btn').on('click', function (e)
        {
            e.preventDefault();
            if (!$this.cart || $this.cart.length === 0)
            {
                alert($this.getCurrentLanguage() === 'en' ? 'Your basket is empty!' : '购物篮还是空的哦！');
                return;
            }
            $this.openCheckoutModal();
        });

        // O. 弹窗关闭与提交
        $('#close-checkout-modal, #checkout-modal-backdrop').on('click', function ()
        {
            $this.closeCheckoutModal();
        });

        $('#checkout-form').off('submit').on('submit', function (e)
        {
            e.preventDefault();
            var $btn = $(this).find('.wheat-btn');
            var name = $('#cust-name').val().trim();
            var address = $('#cust-address').val().trim();
            var date = $('#cust-date').val();

            if (!address || !date)
            {
                alert($this.getCurrentLanguage() === 'en' ? 'Please fill in required fields.' : '请填写完整配送地址和期望日期。');
                return;
            }

            // 🌟 提交时自动记录姓名和地址，方便下次使用
            if (name) localStorage.setItem('mairiji_cust_name', name);
            if (address) localStorage.setItem('mairiji_cust_address', address);

            $btn.addClass('clicked');

            setTimeout(function() {
                $this.closeCheckoutModal();
                $this.checkoutWhatsApp({ name: name, address: address, date: date });
                $btn.removeClass('clicked');
            }, 800);
        });

        // 点击 Instagram 极简快门按钮：播放闪光灯动画并跳转
        $('#insta-flash-btn').on('click', function(e) {
            e.preventDefault();
            var $btn = $(this);
            var url = "https://www.instagram.com/mywheatdiary/";
            
            if (!$btn.hasClass('shutter-active')) {
                $btn.addClass('shutter-active'); // 播放闪光灯与快门按压动画
                
                // 400毫秒（闪光灯亮起的最亮时刻）自动跳转
                setTimeout(function() {
                    var newWin = window.open(url, '_blank');
                    if (!newWin || newWin.closed || typeof newWin.closed == 'undefined') {
                        window.location.href = url;
                    }
                }, 400);
                
                setTimeout(function() {
                    $btn.removeClass('shutter-active');
                }, 800);
            }
        });

		// P. 点击一键定位：弹出 GPS 二级确认弹窗并自动抓取定位
		$(document).on('click', '#get-gps-btn', function (e)
		{
			e.preventDefault();
			$this.openGPSModal();
		});

		// Q. 关闭 GPS 二级确认弹窗
		$('#close-gps-modal, #gps-modal-backdrop').on('click', function ()
		{
			$this.closeGPSModal();
		});

		// R. 提交 GPS 确认表单：拼合地址并填回主结算框
		$('#gps-confirm-form').off('submit').on('submit', function (e)
		{
			e.preventDefault();
			var unit = $('#gps-unit').val().trim();
			var street = $('#gps-street').val().trim();
			var coords = $('#gps-coords').val().trim();
			var isEnglish = $this.getCurrentLanguage() === 'en';

			if (!unit) {
				alert(isEnglish ? 'Please enter your house or unit number.' : '请补充填写门牌号或楼层单位。');
				return;
			}

			var googleMapsUrl = "https://maps.google.com/?q=" + coords;
			var finalAddressText = (isEnglish ? "Unit/House No: " : "门牌单位：") + unit + "\n" +
								(isEnglish ? "Street/Area: " : "详细区域：") + street + "\n" +
								"📍 Google Maps: " + googleMapsUrl;

			// 将拼好的地址填入主结算表单的地址栏中
			$('#cust-address').val(finalAddressText);

			// 关闭定位弹窗
			$this.closeGPSModal();
		});

		// S. 全局 Esc 键盘快捷键关闭弹窗/抽屉
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
	},

	openProductDetail: function (type, id)
	{
		var self = this; // 💡 重点：声明 self 指向 MaiRijiApp 实例
		var isEnglish = this.getCurrentLanguage() === 'en';

		// 查找产品数据
		var products = type === 'cake' ? this.cakeProducts : this.breadProducts;
		var item = products.filter(function (p)
		{
			return p.id === id;
		})[0];
		if (!item) return;

		var folder = type === 'cake' ? 'cake' : 'bread';

		// 1. 填入文字信息
		$('#detail-title').text(item.name);
		$('#detail-price').text('RM ' + item.price);
		$('#detail-text').html(item.desc);

		// 2. 替换顶部大图
		var heroUrl = 'assets/img/' + folder + '/' + item.img + '.webp';
		$('#detail-hero-img').css('background-image', "url('" + heroUrl + "')");

		// 3. 动态生成图集
		var galleryHtml = '';
		if (item.gallery && item.gallery.length > 0)
		{
			$.each(item.gallery, function (i, imgName)
			{
				galleryHtml += '<img src="assets/img/' + folder + '/' + imgName + '.webp" alt="' + item.name + '">';
			});
		}
		$('#detail-gallery').html(galleryHtml);

		// 4. 智能判断：已上线允许加购，未上线引导 WhatsApp 咨询上市时间
		var $orderBtn = $('#detail-order-btn');

		if (item.status === 'coming_soon')
		{
			// 💡 未上线产品：禁止加购，切换为预售/上市咨询按钮
			var inqText = isEnglish ?
				"Hello MaiRiji! I saw " + item.name + " on your website and am super interested. When will it be available?" :
				"你好，麦日记！我在网站看到了【" + item.name + "】，非常感兴趣！请问大约什么时候会上市上架呢？";
			var inqUrl = "https://wa.me/601115277643?text=" + encodeURIComponent(inqText);

			$orderBtn
				.removeClass('button')
				.addClass('wheat-btn')
				.attr('data-link', inqUrl)
				.html(`
                    <span class="btn-text-wrapper">
                        <span class="btn-txt default">${isEnglish ? 'Inquire Release Date' : '询问预售 / 上市时间'}</span>
                        <span class="btn-txt hover">WhatsApp Us!</span>
                    </span>
                `)
				.off('click')
				.on('click', function (e)
				{
					e.preventDefault();
					e.stopImmediatePropagation();
					// 直接跳 WhatsApp 咨询
					var newWin = window.open(inqUrl, '_blank');
					if (!newWin || newWin.closed || typeof newWin.closed == 'undefined')
					{
						window.location.href = inqUrl;
					}
				});
		}
		else
		{
			// 💡 已上线产品：正常允许“加进购物篮”
			$orderBtn
				.removeClass('wheat-btn')
				.addClass('button')
				.removeAttr('data-link')
				.html(`
                    <span style="display: inline-flex; align-items: center; gap: 8px;">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                        ${isEnglish ? 'Add to Basket' : '加进购物篮'}
                    </span>
                `)
				.off('click')
				.on('click', function (e)
				{
					e.preventDefault();
					e.stopImmediatePropagation();
					self.addToCart(item, type, 1);
					$('#product-detail-panel').removeClass('open');
					self.openCart();
				});
		}

		// 5. 弹出面板并锁住底层滚动
		$('#product-detail-panel').addClass('open');
		$('body').addClass('no-scroll');

		// 滚动回详情页顶部
		$('.detail-scroll-area').scrollTop(0);
	},

	// --- 核心逻辑：智能导航栏 (Sticky Nav) ---
	initStickyNav: function ()
	{
		// 清理旧的触发器，防止叠加
		Waypoint.destroyAll();

		// 默认重置为大导航栏
		$('.main-header').removeClass('small');
		$('.home-intro .inner').removeClass('scroll-hide');

		// 寻找当前激活页面的触发点 (scrollTrigger)
		var $activeTrigger = $('.page-view.active-view .scrollTrigger');

		if ($activeTrigger.length > 0)
		{
			$activeTrigger.waypoint(
			{
				handler: function (dir)
				{
					if (dir == 'down')
					{
						// 向下滚动：变小导航栏，隐藏 Hero 文字
						$('.main-header').addClass('small');
						$('.home-intro .inner').addClass('scroll-hide');
					}
					else
					{
						// 向上回滚：恢复大导航栏，显示 Hero 文字
						$('.main-header').removeClass('small');
						$('.home-intro .inner').removeClass('scroll-hide');
					}
				},
				// 触发位置：元素顶部碰到导航栏底部时
				offset: $('.main-header').height() + 15
			});
		}
		// 强制刷新 Waypoint 计算
		Waypoint.refreshAll();
	},

	// --- 核心逻辑：Savoria 横向滚动特效 ---
	handleHorizontalScroll: function (scrollTop)
	{
		// 移动端禁用此特效
		if (this.isMobile()) return;

		var $scrollWrapper = $('.horizontal-scroll-wrapper');
		// 如果当前页面没有横向滚动区，直接退出
		if ($scrollWrapper.length === 0 || $scrollWrapper.is(':hidden')) return;

		var winHeight = $(window).height();
		var wrapperTop = $scrollWrapper.offset().top;
		var wrapperHeight = $scrollWrapper.height();
		var effectiveHeight = wrapperHeight - winHeight; // 可滚动的有效距离
		var scrollDist = scrollTop - wrapperTop; // 当前已滚动的距离

		var $track = $('.savoria-track');
		var $cards = $('.savoria-card');
		var $contentWrap = $('.savoria-sticky-viewport > .wrap');
		var $diary = $('#home-diary');

		// 处于滚动区间内
		if (scrollDist >= 0 && scrollDist <= effectiveHeight)
		{
			var progress = scrollDist / effectiveHeight;
			var splitPoint = 0.75; // 前 75% 滚动图片，后 25% 显示日记

			var trackWidth = $track.outerWidth();
			var viewportWidth = $(window).width();

			// 计算最大横向位移
			var maxTranslateX = trackWidth - viewportWidth + (viewportWidth * 0.3);
			var maxTranslateY = Math.max(0, $contentWrap.outerHeight() - winHeight);

			if (progress <= splitPoint)
			{
				// 阶段一：横向滚动卡片
				var hProg = progress / splitPoint;
				$track.css('transform', 'translateX(' + (-maxTranslateX * hProg) + 'px)');

				// 上下浮动动画
				$cards.each(function (i)
				{
					var isOdd = i % 2 !== 0;
					var val = Math.sin(hProg * Math.PI * 2 + (isOdd ? Math.PI : 0)) * 30;
					$(this).css('transform', 'translateY(' + val + 'px)');
				});

				// 隐藏日记
				$diary.removeClass('is-visible');
				$contentWrap.css('transform', 'translateY(0px)');

			}
			else
			{
				// 阶段二：显示日记
				var vProg = (progress - splitPoint) / (1 - splitPoint);
				$track.css('transform', 'translateX(' + (-maxTranslateX) + 'px)'); // 锁定图片位置
				$diary.addClass('is-visible'); // 显示日记

				// 内容轻微上移，腾出空间
				$contentWrap.css('transform', 'translateY(' + (-maxTranslateY * vProg) + 'px)');
			}
		}
		else if (scrollDist < 0)
		{
			// 回到顶部之前：重置
			$track.css('transform', 'translateX(0px)');
			$cards.css('transform', 'translateY(0px)');
			$diary.removeClass('is-visible');
		}
	},

	// --- 核心逻辑：SPA 页面切换转场 ---
	handlePageTransition: function ($link)
	{
		var self = this;
		var targetId = $link.data('target');

		// 目标页面不存在，直接退出
		if (!targetId || $('#' + targetId).length === 0) return;

		var $toast = $('#toast-transition');

		// 1. 重置动画状态
		$toast.removeClass('pop-in expanding fading-out').css('opacity', '');
		void $toast[0].offsetWidth; // 强制重绘

		// 2. 蹦出图标 (Pop In)
		$toast.addClass('pop-in');

		// 3. 开始转场流程
		setTimeout(function ()
		{
			// 膨胀填满屏幕
			$toast.addClass('expanding');

			setTimeout(function ()
			{
				// --- 幕后操作开始 ---

				// A. 切换视图 DOM
				$('.page-view').removeClass('active-view');
				$('#' + targetId).addClass('active-view');

				// B. 滚回顶部
				window.scrollTo(0, 0);

				// C. 修复 Banner 透明度 (防止之前的滚动逻辑残留)
				$('.home-intro .wrap, .page-intro .wrap').css('opacity', '');

				// D. 关闭移动端菜单
				if ($('body').hasClass('menuOpen')) $('body').removeClass('menuOpen');
				// 👇【新增】强制关闭产品详情面板，并解锁页面滚动 👇
				$('#product-detail-panel').removeClass('open');
				$('body').removeClass('no-scroll');

				// E. 重置 Hero 背景动画 (Zoom Effect)
				var $bg = (targetId === 'view-home') ? $('.home-intro .bg-inner') : $('#' + targetId + ' .bg-inner');
				$bg.removeClass('play-zoom');
				void $bg[0].offsetWidth; // 强制重绘
				$bg.addClass('play-zoom');

				// F. 重新初始化 Sticky 导航监听
				self.initStickyNav();

				// G. 视差稳定器 (Safe Stabilizer) - 关键修复
				// 连续 60 帧强制刷新，防止 DOM 切换导致的布局抖动
				var frames = 60;
				var stabilize = function ()
				{
					if (self.wax && self.wax.elements)
					{
						for (var i = 0; i < self.wax.elements.length; i++)
						{
							self.wax.elements[i].onResize(); // 重新测量位置
							self.wax.elements[i].onFrame(); // 立即重绘
						}
					}
					Waypoint.refreshAll(); // 刷新导航栏触发点

					frames--;
					if (frames > 0)
					{
						requestAnimationFrame(stabilize);
					}
				};
				stabilize();

				// --- 幕后操作结束 ---

				// 4. 淡出遮罩
				$toast.addClass('fading-out');

				// 5. 清理动画类名，为下次做准备
				setTimeout(function ()
				{
					$toast.removeClass('pop-in expanding fading-out');
				}, 400);

			}, 500); // 配合 CSS transition 0.5s
		}, 600); // 等待图标蹦出
	},

	// --- 视差滚动启动器 ---
	onLoad: function ()
	{
		if (this.isMobile()) return;

		// 仅对 Header 区域启用视差 (Footer 已排除)
		this.wax.addElement($('.page-intro .bg, .home-intro .bg, header.intro .bg'), null,
		{
			deltaY: 1.2,
			mode: 'translate'
		});

		this.wax.start();
	},

	// --- 工具：设备检测 ---
	isMobile: function ()
	{
		var isSmallScreen = window.innerWidth <= 769;
		var isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
		return isSmallScreen || isTouchDevice;
	},

	initCustomCursor: function ()
	{
		$('html').addClass('custom-cursor-active');

		// 如果是手机端/触控设备，直接退出并移除残留元素
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

		// 1. 强制样式 (解决层级被遮挡问题)
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

		// 2. 准备所有帧的路径
		var defaultFrames = [
			'assets/img/cursor1.png', 'assets/img/cursor2.png', 'assets/img/cursor3.png'
		];
		var pointerFrames = [
			'assets/img/pointer1.png', 'assets/img/pointer2.png', 'assets/img/pointer3.png'
		];
		var normalClickFrames = [
			'assets/img/click1.png', 'assets/img/click2.png'
		];
		var pointerClickFrames = [
			'assets/img/ptrClick1.png', 'assets/img/ptrClick2.png', 'assets/img/ptrClick3.png'
		];

		// ==========================================================
		// ✨ 核心性能优化：DOM 批量预加载代替 src 替换 ✨
		// ==========================================================
		$cursor.empty(); // 清空原本单一的 img 标签
		var imageElements = {}; // 存储所有预加载的图片 jQuery 对象

		// 合并所有用到的图片数组
		var allFrames = defaultFrames.concat(pointerFrames, normalClickFrames, pointerClickFrames);

		// 数组去重 (防止同一张图片生成多个相同的 img 标签)
		var uniqueFrames = [];
		$.each(allFrames, function (i, el)
		{
			if ($.inArray(el, uniqueFrames) === -1) uniqueFrames.push(el);
		});

		// 遍历所有不重复的图片，直接生成多个隐藏的 img 标签
		$.each(uniqueFrames, function (index, src)
		{
			var $img = $('<img>').attr('src', src).css(
			{
				'position': 'absolute',
				'top': '0',
				'left': '0',
				'width': '100%',
				'height': '100%',
				'display': 'none' // 初始全部隐藏
			});
			$cursor.append($img);
			imageElements[src] = $img; // 以路径为 key 保存起来
		});

		// 定义切换图片的函数：只改变 display，不发网络请求！
		var currentActiveImg = null;

		function setCursorImage(src)
		{
			if (currentActiveImg === imageElements[src]) return; // 如果一样，不操作
			if (currentActiveImg) currentActiveImg.hide(); // 隐藏上一个
			currentActiveImg = imageElements[src]; // 更新当前
			if (currentActiveImg) currentActiveImg.show(); // 显示当前的
		}

		// 赋予初始帧
		setCursorImage(defaultFrames[0]);

		// ==========================================================
		// 动画控制逻辑
		// ==========================================================
		var interactiveSelectors = 'a, button, input[type="submit"], .btn';
		var isHovering = false;
		var isClickAnimating = false;
		var currentLoopFrames = defaultFrames;
		var currentFrameIndex = 0;
		var animationTimer = null;

		// 播放单次点击动画
		function playClickAnimation(framesToPlay, onCompleteFrames)
		{
			if (isClickAnimating) return;
			isClickAnimating = true;
			currentFrameIndex = 0;

			setCursorImage(framesToPlay[0]); // 显示第一帧

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

		// 悬停交互
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

		// 点击交互
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

		// 循环动画定时器
		function updateLoopImage()
		{
			if (isClickAnimating) return;
			currentFrameIndex = (currentFrameIndex + 1) % currentLoopFrames.length;
			// 🌟 使用全新的 setCursorImage 切换图片
			setCursorImage(currentLoopFrames[currentFrameIndex]);
		}

		setInterval(updateLoopImage, 200);

		$(document).on('mousemove', function (e)
		{
			// 更新自定义鼠标位置
			$cursor.css(
			{
				'left': (e.clientX - 5) + 'px',
				'top': (e.clientY - 5) + 'px'
			});
			if ($cursor.css('display') === 'none')
			{
				$cursor.show();
			}
		});

		// 在 initCustomCursor 逻辑的尾部，加上这两个监听：
		var cursorInterval = setInterval(updateLoopImage, 200);

		$(document).on('mouseleave', function ()
		{
			// 鼠标离开浏览器窗口，隐藏光标并暂停动画
			$cursor.hide();
			clearInterval(cursorInterval);
		});

		$(document).on('mouseenter', function ()
		{
			// 鼠标回到浏览器窗口，恢复
			if ($cursor.css('display') === 'none') $cursor.show();
			clearInterval(cursorInterval);
			cursorInterval = setInterval(updateLoopImage, 200);
		});
	},
	// ==========================================
	// 🔥 渐进式图片加载引擎 (Blur-up)
	// ==========================================
	loadHighResImages: function ()
	{
		$('.progressive-bg').each(function ()
		{
			var $el = $(this);
			var highResUrl = $el.data('highres');

			if (highResUrl)
			{
				// 创建一个存在于内存中的“虚拟图片”对象
				var img = new Image();

				// 当这张内存里的高清图下载完毕时...
				img.onload = function ()
				{
					// 1. 替换背景图为高清图
					$el.css('background-image', "url('" + highResUrl + "')");
					// 2. 移除模糊滤镜，触发 CSS 渐变动画
					$el.removeClass('blur-effect');
				};

				// 给虚拟图片赋予 URL，浏览器开始在后台悄悄下载
				img.src = highResUrl;
			}
		});
	},

	// ==========================================
	// 🛒 购物车核心功能逻辑（支持中英双语无缝切换）
	// ==========================================
	loadCart: function ()
	{
		try
		{
			var saved = localStorage.getItem('mairiji_cart');
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
			localStorage.setItem('mairiji_cart', JSON.stringify(this.cart));
		}
		catch (e)
		{}
	},

	// 💡 智能匹配当前语言对应的商品名称
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

		// 角标弹跳动画
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
		var $list = $('#cart-items-list');
		var totalQty = 0;
		var totalPrice = 0;
		var isEnglish = this.getCurrentLanguage() === 'en';
		var self = this;

		if (!this.cart || this.cart.length === 0)
		{
			$list.html('<div class="cart-empty-tip">' + (isEnglish ? 'Your basket is empty 🥖' : '你的购物篮还是空的 🥖') + '</div>');
			$('#cart-total-price').text('RM 0.00');
			$('#cart-count-badge').text('0');
			return;
		}

		var html = '';
		$.each(this.cart, function (i, item)
		{
			totalQty += item.qty;
			totalPrice += item.price * item.qty;
			var folder = item.type === 'cake' ? 'cake' : 'bread';

			// 动态获取当前语言对应的商品名称
			var displayName = self.getItemDisplayName(item);

			html += `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-img" style="background-image: url('assets/img/${folder}/${item.img}.webp');"></div>
                <div class="cart-item-info">
                    <div class="cart-item-title">${displayName}</div>
                    <div class="cart-item-price">RM ${item.price.toFixed(2)}</div>
                    <div class="cart-qty-ctrl">
                        <!-- 减号 SVG -->
                        <button class="cart-qty-btn cart-qty-minus" title="Reduce">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        
                        <span class="cart-qty-num">${item.qty}</span>
                        
                        <!-- 加号 SVG -->
                        <button class="cart-qty-btn cart-qty-plus" title="Increase">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        
                        <!-- 垃圾桶删除 SVG -->
                        <span class="cart-item-del" title="${isEnglish ? 'Remove' : '删除'}">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </span>
                    </div>
                </div>
            </div>
            `;
		});

		$list.html(html);
		$('#cart-total-price').text('RM ' + totalPrice.toFixed(2));
		$('#cart-count-badge').text(totalQty);
	},

	// 🌟 自动生成 WhatsApp 完美双语格式消息并跳转（带 800 毫秒落叶动画延时）
	checkoutWhatsApp: function (customerData)
    {
        if (!this.cart || this.cart.length === 0)
        {
            alert(this.getCurrentLanguage() === 'en' ? 'Your basket is empty!' : '购物篮还是空的哦！');
            return;
        }

        var isEnglish = this.getCurrentLanguage() === 'en';
        var totalPrice = 0;
        var totalQty = 0;
        var self = this;

        // 1. 拼接订单标题与客户填写的配送信息
        var msg = isEnglish ?
            "Hello MaiRiji! I would like to place an order:\n\n" :
            "你好，麦日记！我想预定以下商品：\n\n";

        if (customerData)
        {
            msg += isEnglish ? "【Customer Info】\n" : "【预定信息】\n";
            if (customerData.name) {
                msg += (isEnglish ? "Name: " : "姓名：") + customerData.name + "\n";
            }
            msg += (isEnglish ? "Address / Pickup: \n" : "配送地址/说明：\n") + customerData.address + "\n";
            msg += (isEnglish ? "Preferred Date: " : "期望日期：") + customerData.date + "\n\n";
        }

        msg += isEnglish ? "【Order Details】\n" : "【商品明细】\n";

        // 2. 拼接购物车商品
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

        // 3. 直接在 _blank 新页面中打开 WhatsApp（不经过任何空白页）
        var waNumber = "601115277643";
        var finalUrl = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(msg);

        var newWin = window.open(finalUrl, '_blank');
        if (!newWin || newWin.closed || typeof newWin.closed == 'undefined') {
            window.location.href = finalUrl;
        }
    },

    openCheckoutModal: function ()
    {
        // 动态计算明天日期 (T + 1)
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        var yyyy = tomorrow.getFullYear();
        var mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        var dd = String(tomorrow.getDate()).padStart(2, '0');
        var minDateStr = yyyy + '-' + mm + '-' + dd;

        var $dateInput = $('#cust-date');
        $dateInput.attr('min', minDateStr);
        
        // 如果当前选中的日期小于明天，强制重置为明天
        if (!$dateInput.val() || $dateInput.val() < minDateStr) {
            $dateInput.val(minDateStr);
        }

		// 自动读取上次保存的姓名与地址
        var savedName = localStorage.getItem('mairiji_cust_name');
        var savedAddress = localStorage.getItem('mairiji_cust_address');
        if (savedName && !$('#cust-name').val()) {
            $('#cust-name').val(savedName);
        }
        if (savedAddress && !$('#cust-address').val()) {
            $('#cust-address').val(savedAddress);
        }

        // 关闭侧边购物车，弹出信息 Modal
        this.closeCart();
        $('#checkout-modal-backdrop').addClass('show');
        $('#checkout-modal').addClass('show');
        $('body').addClass('no-scroll');
    },

    closeCheckoutModal: function ()
    {
        $('#checkout-modal-backdrop').removeClass('show');
        $('#checkout-modal').removeClass('show');
        if (!$('#product-detail-panel').hasClass('open') && !$('#cart-drawer-panel').hasClass('open')) {
            $('body').removeClass('no-scroll');
        }
    },

	openGPSModal: function ()
    {
        var isEnglish = this.getCurrentLanguage() === 'en';
        
        // 显示定位弹窗
        $('#gps-modal-backdrop').addClass('show');
        $('#gps-confirm-modal').addClass('show');

        // 重置表单
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

        if (!navigator.geolocation)
        {
            alert(isEnglish ? "Your browser does not support GPS geolocation." : "您的浏览器不支持 GPS 地理定位。");
            $('#gps-loading-status').html(isEnglish ? "❌ GPS not supported." : "❌ 浏览器不支持 GPS");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            function (position)
            {
                var lat = position.coords.latitude.toFixed(6);
                var lng = position.coords.longitude.toFixed(6);

                $('#gps-coords').val(lat + ", " + lng);

                // 🌟 核心修改：在 URL 末尾加入 &accept-language=en，强制 OSM 逆解析输出英文/罗马字母地址
                var reverseUrl = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=" + lat + "&lon=" + lng;

                fetch(reverseUrl, {
                    headers: { 'Accept-Language': 'en-US,en;q=0.9' } // 强制 Headers 传英文
                })
                .then(function(res) { return res.json(); })
                .then(function(data) {
                    var street = data.display_name || "GPS Detected Area";
                    $('#gps-street').val(street);

                    // 如果自动识别到了门牌号，预填写门牌框
                    if (data.address && data.address.house_number) {
                        $('#gps-unit').val("No. " + data.address.house_number);
                    }

                    $('#gps-loading-status').html(isEnglish ? "✅ Location detected! Please verify & enter house number." : "✅ 定位成功！请核对街道并补全门牌号。");
                    $('#gps-unit').focus();
                })
                .catch(function() {
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
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    },

};