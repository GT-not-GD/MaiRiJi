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
	this.wax = new WnkLaxController();

	this.config = {
		waNumber: "601115277643",
		storageKeys: {
			cart: 'mairiji_cart',
			custName: 'mairiji_cust_name',
			custAddress: 'mairiji_cust_address'
		}
	};

	this.cursorTimer = null;
}

MaiRijiApp.prototype = {

	preload: function ()
	{
		this.init();
	},

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

		this.renderProducts();
		this.renderSavoriaCards('bread');
		this.forceLoadTinyImages();

		$('.home-intro .bg-inner').addClass('play-zoom');
		this.bindEvents();
		this.initCustomCursor();

		this.cart = this.loadCart();
		this.updateCartUI();

		this.initKnightShowcase();
	},

	getCurrentLanguage: function ()
	{
		return $('html').attr('lang') === 'en' ? 'en' : 'zh';
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
			var displayLabels = isEnglish ?
				['Signature', '', 'Fresh', '', 'Sweet', '', ''] :
				['Signature / 招牌', '', 'Fresh / 新鲜', '', 'Sweet / 甜点', '', ''];
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

	renderProducts: function ()
	{
		var isEnglish = this.getCurrentLanguage() === 'en';

		this.breadProducts = isEnglish ? [
		{
			id: 'b1',
			name: "Country Sourdough",
			price: "14.00",
			img: "1",
			desc: "Our signature country loaf, fermented for over 18 hours with sourdough starter. Crafted with Japanese bread flour and German rye flour for a crisp crust, highly hydrated crumb, and a subtle delicate acidity.",
			ingredients: "Japanese high-protein bread flour, German rye flour, water, sourdough starter, rose salt.",
			allergens: "Gluten (Wheat, Rye)",
			gallery: ["1", "1-hover"]
		},
		{
			id: 'b2',
			name: "Chocolate Sourdough",
			price: "16.00",
			img: "2",
			desc: "Rich dark chocolate and cocoa powder folded into long-fermented dough. Melts slightly during baking for a smooth, indulgent chocolate flavor perfectly balanced with gentle sourdough.",
			ingredients: "Japanese high-protein bread flour, German rye flour, dark chocolate, cocoa powder, water, sourdough starter, rose salt.",
			allergens: "Gluten (Wheat, Rye), Milk, Soy (from dark chocolate)",
			gallery: ["2", "2-hover"]
		},
		{
			id: 'b3',
			name: "Lemon Blueberry Sourdough",
			price: "16.50",
			img: "3",
			desc: "Bursting with tart wild dried blueberries and fragrant fresh lemon zest. A refreshing, fruity sourdough with bright citrus aroma in every bite.",
			ingredients: "Japanese high-protein bread flour, German rye flour, wild dried blueberries, fresh lemon zest, water, sourdough starter, rose salt.",
			allergens: "Gluten (Wheat, Rye)",
			gallery: ["3", "3-hover", "3-detail-1"]
		},
		{
			id: 'b4',
			name: "Classic Walnut Raisin Sourdough",
			price: "16.00",
			img: "4",
			desc: "Packed with crunchy toasted walnuts and sweet sun-dried raisins. Offers a rich contrast of nutty aromas and natural fruit sweetness.",
			ingredients: "Japanese high-protein bread flour, German rye flour, toasted walnuts, sun-dried raisins, water, sourdough starter, rose salt.",
			allergens: "Gluten (Wheat, Rye), Tree Nuts (Walnuts)",
			gallery: ["4", "4-hover"]
		},
		{
			id: 'b5',
			name: "Coffee Chocolate Sourdough",
			price: "16.00",
			img: "5",
			desc: "Infused with espresso coffee dough, rich dark chocolate chips, and toasted walnuts. Bold roasted coffee notes harmonized with sweet chocolate and nutty warmth.",
			ingredients: "Japanese high-protein bread flour, German rye flour, espresso coffee, dark chocolate chips, toasted walnuts, water, sourdough starter, rose salt.",
			allergens: "Gluten (Wheat, Rye), Tree Nuts (Walnuts), Milk, Soy",
			gallery: ["5", "5-hover", "5-detail-1"]
		},
		{
			id: 'b6',
			name: "Matcha Cranberry Sourdough",
			price: "16.00",
			img: "6",
			desc: "Earthy premium matcha paired with sweet-tart dried cranberries. Vibrant in tea aroma with a beautifully balanced, bittersweet flavor.",
			ingredients: "Japanese high-protein bread flour, German rye flour, premium matcha powder, dried cranberries, water, sourdough starter, rose salt.",
			allergens: "Gluten (Wheat, Rye)",
			gallery: ["6", "6-hover"]
		},
		{
			id: 'b7',
			name: "Highland Barley Walnut Sourdough",
			price: "16.00",
			img: "7",
			desc: "Made with nutritious Tibetan highland barley flour, toasted walnuts, and crunchy pumpkin seeds. Wholesome and earthy with rich grain textures and wonderful chewiness.",
			ingredients: "Japanese high-protein bread flour, Tibetan highland barley flour, toasted walnuts, crunchy pumpkin seeds, water, sourdough starter, rose salt.",
			allergens: "Gluten (Wheat, Barley), Tree Nuts (Walnuts), Seeds (Pumpkin seeds)",
			gallery: ["7", "7-hover", "7-detail-1"]
		},
		{
			id: 'b8',
			name: "Earl Grey Orange & Cranberry Sourdough",
			price: "16.50",
			img: "8",
			desc: "Infused with fragrant Earl Grey tea dough, candied orange zest, and dried cranberries. Elegant citrus and bergamot notes merged with warm tea aroma.",
			ingredients: "Japanese high-protein bread flour, German rye flour, Earl Grey tea powder, candied orange zest, dried cranberries, water, sourdough starter, rose salt.",
			allergens: "Gluten (Wheat, Rye)",
			gallery: ["8", "8-hover"]
		},
		{
			id: 'b9',
			name: "Honey Pumpkin & Seed Sourdough",
			price: "16.50",
			img: "9",
			desc: "A cozy blend of real pumpkin puree, pure honey, roasted pumpkin cubes, and toasted pumpkin seeds. Tender, naturally sweet crumb with crunchy seeds.",
			ingredients: "Japanese high-protein bread flour, German rye flour, fresh pumpkin puree, pure honey, roasted pumpkin cubes, crunchy pumpkin seeds, water, sourdough starter, rose salt.",
			allergens: "Gluten (Wheat, Rye), Seeds (Pumpkin seeds)",
			gallery: ["9", "9-hover"]
		},
		{
			id: 'b10',
			name: "Dragon Fruit Cream Cheese Sourdough",
			price: "17.00",
			img: "10",
			desc: "Made with fresh red dragon fruit for a striking natural pink dough, filled with rich and velvety cream cheese pockets.",
			ingredients: "Japanese high-protein bread flour, German rye flour, fresh red dragon fruit, cream cheese filling, water, sourdough starter, rose salt.",
			allergens: "Gluten (Wheat, Rye), Milk (Cream cheese)",
			gallery: ["10", "10-hover"]
		}] : [
		{
			id: 'b1',
			name: "乡村欧包",
			price: "14.00",
			img: "1",
			desc: "麦日记的招牌经典之作。只使用面粉、水、盐和酸种酵母。历经18小时以上的低温慢发酵，外壳酥脆，内里组织湿润弹牙，带有纯粹的麦香与微酸回甘。",
			ingredients: "日本高筋小麦粉、德国裸麦粉、水、酸种酵母、玫瑰盐。",
			allergens: "含有麸质（小麦、裸麦）。",
			gallery: ["1", "1-hover"]
		},
		{
			id: 'b2',
			name: "巧克力欧包",
			price: "16.00",
			img: "2",
			desc: "选用浓郁的黑巧克力融入面团。经过烘烤后巧克力微微融化，带给面包丝滑口感与丰富的可可层次，甜而不腻，满足感十足。",
			ingredients: "日本高筋小麦粉、德国裸麦粉、黑巧克力、可可粉、水、酸种酵母、玫瑰盐。",
			allergens: "含有麸质（小麦、裸麦）、乳制品、大豆成分（来自黑巧克力）。",
			gallery: ["2", "2-hover"]
		},
		{
			id: 'b3',
			name: "柠檬蓝莓欧包",
			price: "16.50",
			img: "3",
			desc: "清爽的鲜磨柠檬皮屑与多汁的蓝莓干完美结合。酸甜果香在舌尖绽放，入口带着天然果酸与柠檬清香，是下午茶的绝佳选择。",
			ingredients: "日本高筋小麦粉、德国裸麦粉、野生蓝莓干、新鲜鲜磨柠檬皮屑、水、酸种酵母、玫瑰盐。",
			allergens: "含有麸质（小麦、裸麦）。",
			gallery: ["3", "3-hover", "3-detail-1"]
		},
		{
			id: 'b4',
			name: "经典葡萄核桃欧包",
			price: "16.00",
			img: "4",
			desc: "香脆的烤核桃搭配日晒甘甜的葡萄干。坚果的醇香与果干的自然酸甜交织，咀嚼间充满饱满的层次感，是广受欢迎的经典口味。",
			ingredients: "日本高筋小麦粉、德国裸麦粉、烤核桃仁、日晒葡萄干、水、酸种酵母、玫瑰盐。",
			allergens: "含有麸质（小麦、裸麦）、树坚果（核桃）。",
			gallery: ["4", "4-hover"]
		},
		{
			id: 'b5',
			name: "咖啡巧克力欧包",
			price: "16.00",
			img: "5",
			desc: "浓郁咖啡风味与黑巧克力块、香脆核桃仁的浪漫碰撞。醇厚的咖啡苦香烘托出巧克力的甜美与核桃油脂香，回味悠长，唤醒每一个慵懒的早晨。",
			ingredients: "日本高筋小麦粉、德国裸麦粉、浓缩咖啡液、黑巧克力粒、烤核桃仁、水、酸种酵母、玫瑰盐。",
			allergens: "含有麸质（小麦、裸麦）、树坚果（核桃）、乳制品、大豆成分。",
			gallery: ["5", "5-hover", "5-detail-1"]
		},
		{
			id: 'b6',
			name: "抹茶蔓越莓欧包",
			price: "16.00",
			img: "6",
			desc: "严选优质抹茶粉，呈现幽雅的自然茶绿。搭配酸甜可口的蔓越莓干，抹茶的微苦与果干的甘甜互补，茶香余韵悠线。",
			ingredients: "日本高筋小麦粉、德国裸麦粉、优质抹茶粉、蔓越莓干、水、酸种酵母、玫瑰盐。",
			allergens: "含有麸质（小麦、裸麦）。",
			gallery: ["6", "6-hover"]
		},
		{
			id: 'b7',
			name: "青稞核桃欧包",
			price: "16.00",
			img: "7",
			desc: "融入营养丰富的西藏青稞粉、烤核桃粒与香脆南瓜籽。青稞特有的谷物香气与坚果油脂香、南瓜籽交织，越嚼越香，健康更有嚼劲。",
			ingredients: "日本高筋小麦粉、中国西藏青稞粉、烤核桃仁、香脆南瓜籽、水、酸种酵母、玫瑰盐。",
			allergens: "含有麸质（小麦、青稞）、树坚果（核桃）、种子类（南瓜籽）。",
			gallery: ["7", "7-hover", "7-detail-1"]
		},
		{
			id: 'b8',
			name: "红茶橙皮欧包",
			price: "16.50",
			img: "8",
			desc: "伯爵红茶粉揉面，搭配糖渍橙皮皮屑与蔓越莓干。佛手柑茶香温润，橙皮清甜与蔓越莓酸甜交织，雅致韵味十足。",
			ingredients: "日本高筋小麦粉、德国裸麦粉、伯爵红茶粉、糖渍橙皮皮屑、蔓越莓干、水、酸种酵母、玫瑰盐。",
			allergens: "含有麸质（小麦、裸麦）。",
			gallery: ["8", "8-hover"]
		},
		{
			id: 'b9',
			name: "蜂蜜金瓜南瓜籽欧包",
			price: "16.50",
			img: "9",
			desc: "融入纯正蜂蜜与新鲜南瓜泥，包裹着绵软的烤南瓜丁，撒满香脆南瓜籽。天然甜香与多重南瓜层次交织，口感软糯香脆。",
			ingredients: "日本高筋小麦粉、德国裸麦粉、新鲜南瓜泥、纯正蜂蜜、烤南瓜丁、香脆南瓜籽、水、酸种酵母、玫瑰盐。",
			allergens: "含有麸质（小麦、裸麦）、种子类（南瓜籽）。",
			gallery: ["9", "9-hover"]
		},
		{
			id: 'b10',
			name: "火龙果奶酪欧包",
			price: "17.00",
			img: "10",
			desc: "纯红肉火龙果榨汁揉面，呈现梦幻的天然粉红色。包裹着浓郁绵密的奶油奶酪夹心，果香与奶香交织，颜值与美味兼备。",
			ingredients: "日本高筋小麦粉、德国裸麦粉、新鲜红肉火龙果、奶油奶酪夹心、水、酸种酵母、玫瑰盐。",
			allergens: "含有麸质（小麦、裸麦）、乳制品（奶油奶酪）。",
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
			ingredients: "Mascarpone cheese, sour cream, cream cheese, caramel biscuit crust, fresh cream, eggs, sugar, butter.",
			allergens: "Contains Milk, Eggs, Gluten (Wheat), Soy.",
			gallery: ["1", "1-hover"]
		}] : [
		{
			id: 'c1',
			name: "琥珀焦糖双层乳酪蛋糕",
			price: "0.00",
			img: "1",
			status: 'coming_soon',
			desc: "底座是香脆的焦糖饼干，中层是浓郁醇厚的烘焙芝士，顶层则是如云朵般轻盈的生乳酪慕斯。温暖焦香与丝滑奶香完美交织，带来层次丰富、入口即化的奢华体验。",
			ingredients: "马斯卡彭乳酪、酸奶油、奶油芝士、焦糖饼干底、新鲜奶油、鸡蛋、砂糖、黄油。",
			allergens: "含有乳制品（奶油、奶酪）、鸡蛋、麸质（小麦/焦糖饼干底）、大豆成分。",
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

        $('#checkout-form').off('submit').on('submit', function (e)
		{
			e.preventDefault();
			var $btn = $(this).find('.wheat-btn');
			var name = $('#cust-name').val().trim();
			var address = $('#cust-address').val().trim();
			var date = $('#cust-date').val();
			var zoneVal = $('#cust-delivery-zone').val();
			var isEnglish = $this.getCurrentLanguage() === 'en';

			if (zoneVal === 'other') {
				$this.showToast(isEnglish ? "Delivery is unavailable for other areas. Please select Self-Pickup." : "其他区域暂无配送服务，请选择【到店自提】哦！");
				return;
			}

			if ((zoneVal !== 'pickup' && !address) || !date)
			{
				$this.showToast(isEnglish ? 'Please fill in required fields.' : '请填写完整配送地址和期望日期。');
				return;
			}

			var zoneLabels = {
				tj_sepat: isEnglish ? "Tanjong Sepat Delivery" : "Tanjong Sepat 地区送货",
				banting: isEnglish ? "Banting Area (Arrangement Needed)" : "Banting 地区（需沟通安排）",
				pickup: isEnglish ? "Self-Pickup (Tanjong Sepat)" : "Tanjong Sepat 店面自提"
			};
			var deliveryZoneText = zoneLabels[zoneVal] || zoneVal;

			if (name) localStorage.setItem($this.config.storageKeys.custName, name);
			if (address && zoneVal !== 'pickup') localStorage.setItem($this.config.storageKeys.custAddress, address);

			$btn.addClass('clicked');

			setTimeout(function() {
				$this.closeCheckoutModal();
				
				$this.checkoutWhatsApp({ 
					name: name, 
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

        $('#insta-flash-btn').on('click', function(e) {
            e.preventDefault();
            var $btn = $(this);
            var url = "https://www.instagram.com/mywheatdiary/";
            
            if (!$btn.hasClass('shutter-active')) {
                $btn.addClass('shutter-active');
                
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

			if (!unit) {
				$this.showToast(isEnglish ? 'Please enter your house or unit number.' : '请补充填写门牌号或楼层单位。');
				return;
			}

			var googleMapsUrl = "https://maps.google.com/?q=" + coords;
			var finalAddressText = (isEnglish ? "Unit/House No: " : "门牌单位：") + unit + "\n" +
								(isEnglish ? "Street/Area: " : "详细区域：") + street + "\n" +
								"📍 Google Maps: " + googleMapsUrl;

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

		$(document).on('click', '.accordion-header', function () {
			var $btn = $(this);
			var $content = $btn.next('.accordion-content');
			
			var isExpanded = $btn.toggleClass('active').hasClass('active');
			$btn.attr('aria-expanded', isExpanded);
			$content.stop().slideToggle(250);
		});

		$(document).on('change', '#cust-delivery-zone', function () {
			var val = $(this).val();
			var isEnglish = $this.getCurrentLanguage() === 'en';
			var $addressGroup = $('#cust-address-group');
			var $notice = $('#zone-notice');
			var $pickupInfo = $('#cust-pickup-info');

			var pickupAddress = "65, Jalan Pelangi 12, Taman Pelangi, 42800 Tanjong Sepat";

			if (val === 'pickup') {
				$addressGroup.slideUp(200);
				$notice.slideUp(200);
				$pickupInfo.slideDown(200);
				
				$('#cust-address').val(pickupAddress + " (店面自提)");
			} else if (val === 'other') {
				$addressGroup.slideUp(200);
				$pickupInfo.slideUp(200);
				$notice.html(isEnglish ? 
					"⚠️ Sorry, we currently only deliver to <strong>Tanjong Sepat</strong> & <strong>Banting</strong>. Please select <strong>Self-Pickup</strong>." : 
					"⚠️ 抱歉！我们目前仅提供 <strong>Tanjong Sepat</strong> 配送及 <strong>Banting</strong> 地区安排配送。其他区域欢迎选择<strong>【到店自提】</strong>哦！"
				).slideDown(200);
				
				$('#cust-address').val('');
			} else {
				$addressGroup.slideDown(200);
				$notice.slideUp(200);
				$pickupInfo.slideUp(200);
				
				if ($('#cust-address').val().indexOf("Taman Pelangi") !== -1) {
					$('#cust-address').val('');
				}
			}
		});

		$('#close-thankyou-btn, #thankyou-modal-backdrop').on('click', function () {
			$('#thankyou-modal-backdrop').removeClass('show');
			$('#thankyou-modal').removeClass('show');
			$('body').removeClass('no-scroll');
		});
	},

	openProductDetail: function (type, id)
	{
		var self = this;
		var isEnglish = this.getCurrentLanguage() === 'en';
		var els = this.$els;

		var products = type === 'cake' ? this.cakeProducts : this.breadProducts;
		var item = products.filter(function (p) { return p.id === id; })[0];
		if (!item) return;

		var folder = type === 'cake' ? 'cake' : 'bread';

		els.detailTitle.text(item.name);
		els.detailPrice.text('RM ' + item.price);
		els.detailText.html(item.desc);

		els.detailPanel.find('.accordion-header').removeClass('active');
		els.detailPanel.find('.accordion-content').hide();

		els.detailIngredients.text(item.ingredients || '-');
		els.detailAllergens.text(item.allergens || (isEnglish ? "Contains Gluten (Wheat)." : "含有麸质（小麦）。"));

		if (type === 'cake') {
			els.detailStorage.text(isEnglish ?
				"Keep refrigerated (2°C - 6°C). Consume within 2 days for optimal freshness and texture." :
				"需冷藏保存（2°C - 6°C）。建议 2 天内食用完毕，以享受最佳口感与奶香。");
			els.detailReheatTitle.text(isEnglish ? "Serving Suggestion" : "食用建议");
			els.detailReheat.text(isEnglish ?
				"Take out from fridge and let it rest at room temperature for 10-15 minutes before serving for a softer, silkier texture." :
				"冷藏取出后，建议室温静置 10-15 分钟回温后再食用，乳酪慕斯口感将更加丝滑顺柔。");
		} else {
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
		if (item.gallery && item.gallery.length > 0) {
			$.each(item.gallery, function (i, imgName) {
				galleryHtml += '<img src="assets/img/' + folder + '/' + imgName + '.webp" alt="' + item.name + '">';
			});
		}
		els.detailGallery.html(galleryHtml);

		var $orderBtn = els.detailOrderBtn;
		if (item.status === 'coming_soon') {
			var inqText = isEnglish ?
				"Hello MaiRiji! I saw " + item.name + " on your website and am super interested. When will it be available?" :
				"你好，麦日记！我在网站看到了【" + item.name + "】，非常感兴趣！请问大约什么时候会上市上架呢？";
			var inqUrl = "https://wa.me/" + this.config.waNumber + "?text=" + encodeURIComponent(inqText);

			$orderBtn.removeClass('button').addClass('wheat-btn').attr('data-link', inqUrl)
				.html('<span class="btn-text-wrapper"><span class="btn-txt default">' + (isEnglish ? 'Inquire Release Date' : '询问预售 / 上市时间') + '</span><span class="btn-txt hover">WhatsApp Us!</span></span>')
				.off('click').on('click', function (e) {
					e.preventDefault(); e.stopImmediatePropagation();
					window.open(inqUrl, '_blank');
				});
		} else {
			$orderBtn.removeClass('wheat-btn').addClass('button').removeAttr('data-link')
				.html('<span style="display: inline-flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>' + (isEnglish ? 'Add to Basket' : '加进购物篮') + '</span>')
				.off('click').on('click', function (e) {
					e.preventDefault(); e.stopImmediatePropagation();
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

	// --- 核心逻辑：SPA 页面切换转场 (修复对空 $bg[0] 访问导致的异常) ---
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

				// 🌟 【核心修复 1】：添加 length > 0 安全校验，避免未找到 .bg-inner 时报错中断转场
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

		var startCursorTimer = function() {
			if (self.cursorTimer) clearInterval(self.cursorTimer);
			self.cursorTimer = setInterval(updateLoopImage, 200);
		};

		var stopCursorTimer = function() {
			if (self.cursorTimer) {
				clearInterval(self.cursorTimer);
				self.cursorTimer = null;
			}
		};

		startCursorTimer();

		$(document).on('mousemove.customCursor', function (e)
		{
			$cursor.css({
				'left': (e.clientX - 5) + 'px',
				'top': (e.clientY - 5) + 'px'
			});
			if ($cursor.css('display') === 'none') $cursor.show();
		});

		$(document).off('.cursorWindow').on({
			'mouseleave.cursorWindow': function () {
				$cursor.hide();
				stopCursorTimer();
			},
			'mouseenter.cursorWindow': function () {
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
		catch (e) { return []; }
	},

	saveCart: function ()
	{
		try
		{
			localStorage.setItem(this.config.storageKeys.cart, JSON.stringify(this.cart));
		}
		catch (e) {}
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

        var msg = isEnglish ?
            "Hello MaiRiji! I would like to place an order:\n\n" :
            "你好，麦日记！我想预定以下商品：\n\n";

        if (customerData)
		{
			msg += isEnglish ? "【Customer & Delivery Info】\n" : "【预定与配送信息】\n";
			if (customerData.deliveryZone) {
				msg += (isEnglish ? "Type/Zone: " : "配送/取货方式：") + customerData.deliveryZone + "\n";
			}
			if (customerData.name) {
				msg += (isEnglish ? "Name: " : "姓名：") + customerData.name + "\n";
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

        var waNumber = "601115277643";
        var finalUrl = "https://wa.me/" + waNumber + "?text=" + encodeURIComponent(msg);

        var newWin = window.open(finalUrl, '_blank');
        if (!newWin || newWin.closed || typeof newWin.closed == 'undefined') {
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
        
        if (!$dateInput.val() || $dateInput.val() < minDateStr) {
            $dateInput.val(minDateStr);
        }

        var savedName = localStorage.getItem('mairiji_cust_name');
        var savedAddress = localStorage.getItem('mairiji_cust_address');
        if (savedName && !$('#cust-name').val()) {
            $('#cust-name').val(savedName);
        }
        if (savedAddress && !$('#cust-address').val()) {
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
        if (!$('#product-detail-panel').hasClass('open') && !$('#cart-drawer-panel').hasClass('open')) {
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

                $('#gps-coords').val(lat + ", " + lng);

                var reverseUrl = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=" + lat + "&lon=" + lng;

                fetch(reverseUrl, {
                    headers: { 'Accept-Language': 'en-US,en;q=0.9' }
                })
                .then(function(res) { return res.json(); })
                .then(function(data) {
                    var street = data.display_name || "GPS Detected Area";
                    $('#gps-street').val(street);

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

	showToast: function (msg, duration)
	{
		duration = duration || 2500;
		var $toast = $('#app-toast-msg');
		
		if ($toast.length === 0) {
			$toast = $('<div id="app-toast-msg"></div>').appendTo('body');
		}
		
		$toast.text(msg).addClass('show');
		
		clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(function () {
			$toast.removeClass('show');
		}, duration);
	}
};

// 🌟 修正版：骑士动画与渲染 (支持 3帧待机 / 3帧奔跑 / 4帧挥刀 / 3帧死亡)
MaiRijiApp.prototype.initKnightShowcase = function () {
    var canvas = document.getElementById('tbh-knight-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    // 1. 加载 3 帧待机图片 (Idle Frames)
    var idleFrames = [];
    var idleSources = [
        'assets/img/game/knight/knight-idle-1.png',
        'assets/img/game/knight/knight-idle-2.png',
        'assets/img/game/knight/knight-idle-3.png'
    ];
    for (var i = 0; i < idleSources.length; i++) {
        var imgIdle = new Image();
        imgIdle.src = idleSources[i];
        idleFrames.push(imgIdle);
    }

    // 2. 加载 3 帧奔跑图片 (Run Frames)
    var runFrames = [];
    var runSources = [
        'assets/img/game/knight/knight-run-1.png',
        'assets/img/game/knight/knight-run-2.png',
        'assets/img/game/knight/knight-run-3.png'
    ];
    for (var r = 0; r < runSources.length; r++) {
        var imgRun = new Image();
        imgRun.src = runSources[r];
        runFrames.push(imgRun);
    }

    // 3. 加载 3 帧死亡图片 (Die Frames)
    var dieFrames = [];
    var dieSources = [
        'assets/img/game/knight/knight-die-1.png', // 第 1 帧：受击摇晃
        'assets/img/game/knight/knight-die-2.png', // 第 2 帧：向前/后倒下
        'assets/img/game/knight/knight-die-3.png'  // 第 3 帧：伏地阵亡
    ];
    for (var d = 0; d < dieSources.length; d++) {
        var imgDie = new Image();
        imgDie.src = dieSources[d];
        dieFrames.push(imgDie);
    }

    // 备用单图 (降级容错)
    var knightFallbackImg = new Image();
    knightFallbackImg.src = 'assets/img/game/knight/knight.png';

    // 4. 加载 4 帧挥刀图片 (Attack Frames)
    var attackFrames = [];
    var attackSources = [
        'assets/img/game/knight/knight-attack-1.png', // 第 1 帧：前摇蓄力
        'assets/img/game/knight/knight-attack-2.png', // 第 2 帧：极速斩击 (Hitbox 触发)
        'assets/img/game/knight/knight-attack-3.png', // 第 3 帧：延展缓冲
        'assets/img/game/knight/knight-attack-4.png'  // 第 4 帧：平稳收刀
    ];
    for (var j = 0; j < attackSources.length; j++) {
        var imgAttack = new Image();
        imgAttack.src = attackSources[j];
        attackFrames.push(imgAttack);
    }

    // 5. 动画时间轴参数 (Durations in ms)
    var idleFrameDuration = 250; // 待机每帧 0.25 秒
    var totalIdleDuration = idleFrameDuration * 3;

    var runFrameDuration = 120; // 奔跑每帧 0.12 秒
    var totalRunDuration = runFrameDuration * 3;

    var dieDurations = [120, 150, 200]; // 死亡 3 帧节奏 (倒地后停留在第 3 帧)
    var totalDieDuration = 470;

    var attackDurations = [100, 40, 70, 70]; // 挥刀 4 帧节奏
    var totalAttackDuration = 280;

    // 6. 状态管理
    var selectedActionMode = 'idle'; // 'idle' | 'run' | 'attack' | 'die'
    var isAttacking = false;
    var currentAttackFrameIndex = 0;
    var attackStartTime = 0;

    var isDying = false;
    var currentDieFrameIndex = 0;
    var dieStartTime = 0;

    var showDebugHitbox = false; // 碰撞框默认 OFF
    var zoomScale = 1.0; // 缩放比例 (默认 100%)

    // 7. 缩放控制逻辑 (Zoom Logic)
    function updateZoomUI() {
        $('#tbh-zoom-text').text(Math.round(zoomScale * 100) + '%');
    }

    // 鼠标中键滚轮缩放
    $('#tbh-canvas-wrapper').off('wheel').on('wheel', function (e) {
        e.preventDefault();
        if (e.originalEvent.deltaY < 0) {
            zoomScale = Math.min(2.5, zoomScale + 0.1); // 放大
        } else {
            zoomScale = Math.max(0.5, zoomScale - 0.1); // 缩小
        }
        updateZoomUI();
    });

    // 缩放按钮
    $('#tbh-zoom-in').off('click').on('click', function (e) {
        e.stopPropagation();
        zoomScale = Math.min(2.5, zoomScale + 0.2);
        updateZoomUI();
    });

    $('#tbh-zoom-out').off('click').on('click', function (e) {
        e.stopPropagation();
        zoomScale = Math.max(0.5, zoomScale - 0.2);
        updateZoomUI();
    });

    $('#tbh-zoom-reset').off('click').on('click', function (e) {
        e.stopPropagation();
        zoomScale = 1.0;
        updateZoomUI();
    });

    // 8. 动作模式选择 (Action Switcher)
    $('.action-btn').off('click').on('click', function (e) {
        e.stopPropagation();
        var action = $(this).data('tbh-action');
        $('.action-btn').removeClass('active');
        $(this).addClass('active');

        selectedActionMode = action;

        if (action === 'attack') {
            isAttacking = true;
            currentAttackFrameIndex = 0;
            attackStartTime = performance.now();
        } else if (action === 'die') {
            isDying = true;
            currentDieFrameIndex = 0;
            dieStartTime = performance.now();
        } else {
            isAttacking = false;
            isDying = false;
            currentAttackFrameIndex = 0;
            currentDieFrameIndex = 0;
        }
    });

    // 碰撞框切换按键
    var $toggleBtn = $('#tbh-toggle-hitbox-btn');
    if ($toggleBtn.length) {
        $toggleBtn.off('click').on('click', function (e) {
            e.stopPropagation();
            showDebugHitbox = !showDebugHitbox;
            
            var isEnglish = $('html').attr('lang') === 'en';
            if (showDebugHitbox) {
                $(this).addClass('active').html('<span class="icon">🎯</span> ' + (isEnglish ? 'Hitbox: ON' : '碰撞框: ON'));
            } else {
                $(this).removeClass('active').html('<span class="icon">🎯</span> ' + (isEnglish ? 'Hitbox: OFF' : '碰撞框: OFF'));
            }
        });
    }

    // 点击画布测试挥刀
    canvas.onclick = function () {
        if (selectedActionMode !== 'attack') {
            $('.action-btn').removeClass('active');
            $('.action-btn[data-tbh-action="attack"]').addClass('active');
            selectedActionMode = 'attack';
        }
        isAttacking = true;
        currentAttackFrameIndex = 0;
        attackStartTime = performance.now();
    };

    // 环境微粒
    var particles = [];
    for (var pIdx = 0; pIdx < 20; pIdx++) {
        particles.push({
            x: (Math.random() - 0.5) * 200,
            y: Math.random() * 80,
            size: 2,
            speedY: Math.random() * 0.4 + 0.2,
            alpha: Math.random() * 0.6 + 0.1
        });
    }

    var frameCount = 0;

    function render() {
        var rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            var dpr = window.devicePixelRatio || 1;
            
            if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
            }

            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, rect.width, rect.height);
            
            ctx.imageSmoothingEnabled = false;

            var width = rect.width;
            var height = rect.height;
            var now = performance.now();
            frameCount += 0.04;

            var centerX = width / 2;
            var centerY = height / 2 + 10;

            // 1. 夕阳背景光晕
            var bgRadius = Math.min(width, height) * 0.42;
            var sunGlow = ctx.createRadialGradient(centerX, centerY - 15, 10, centerX, centerY - 15, bgRadius * 0.85);
            sunGlow.addColorStop(0, '#fce38a');
            sunGlow.addColorStop(0.55, '#f2c968');
            sunGlow.addColorStop(1, 'rgba(242, 201, 104, 0)');
            
            ctx.fillStyle = sunGlow;
            ctx.beginPath();
            ctx.arc(centerX, centerY - 15, bgRadius * 0.85, 0, Math.PI * 2);
            ctx.fill();

            // 2. 升腾微粒
            ctx.save();
            ctx.translate(centerX, centerY + 80);
            for (var p = 0; p < particles.length; p++) {
                var pt = particles[p];
                pt.y -= pt.speedY;
                if (pt.y < -120) {
                    pt.y = 0;
                    pt.x = (Math.random() - 0.5) * 180;
                }
                ctx.fillStyle = '#f39c42';
                ctx.globalAlpha = pt.alpha * (1 - pt.y / 120);
                ctx.fillRect(Math.floor(pt.x), Math.floor(-pt.y), pt.size, pt.size);
            }
            ctx.restore();

            // 3. 动画帧计算：待机 (3帧) vs 奔跑 (3帧) vs 挥刀 (4帧) vs 死亡 (3帧)
            var currentRenderImg = knightFallbackImg;
            var currentIdleFrameIndex = 0;
            var currentRunFrameIndex = 0;

            if (selectedActionMode === 'attack') {
                // --- ⚔️ 挥刀模式 ---
                if (!isAttacking) {
                    isAttacking = true;
                    currentAttackFrameIndex = 0;
                    attackStartTime = now;
                }

                var elapsedAttackTime = now - attackStartTime;

                if (elapsedAttackTime < attackDurations[0]) {
                    currentAttackFrameIndex = 0;
                } else if (elapsedAttackTime < attackDurations[0] + attackDurations[1]) {
                    currentAttackFrameIndex = 1;
                } else if (elapsedAttackTime < attackDurations[0] + attackDurations[1] + attackDurations[2]) {
                    currentAttackFrameIndex = 2;
                } else if (elapsedAttackTime < totalAttackDuration) {
                    currentAttackFrameIndex = 3;
                } else {
                    attackStartTime = now;
                    currentAttackFrameIndex = 0;
                }

                if (attackFrames[currentAttackFrameIndex] && attackFrames[currentAttackFrameIndex].complete && attackFrames[currentAttackFrameIndex].naturalWidth > 0) {
                    currentRenderImg = attackFrames[currentAttackFrameIndex];
                }
            } else if (selectedActionMode === 'run') {
                // --- 🏃 奔跑模式 ---
                var elapsedRunTime = now % totalRunDuration;
                currentRunFrameIndex = Math.floor(elapsedRunTime / runFrameDuration);

                if (runFrames[currentRunFrameIndex] && runFrames[currentRunFrameIndex].complete && runFrames[currentRunFrameIndex].naturalWidth > 0) {
                    currentRenderImg = runFrames[currentRunFrameIndex];
                }
            } else if (selectedActionMode === 'die') {
                // --- 💀 死亡模式 (倒地后停留在第 3 帧) ---
                if (!isDying) {
                    isDying = true;
                    currentDieFrameIndex = 0;
                    dieStartTime = now;
                }

                var elapsedDieTime = now - dieStartTime;

                if (elapsedDieTime < dieDurations[0]) {
                    currentDieFrameIndex = 0;
                } else if (elapsedDieTime < dieDurations[0] + dieDurations[1]) {
                    currentDieFrameIndex = 1;
                } else {
                    currentDieFrameIndex = 2; // 保持倒地帧
                }

                if (dieFrames[currentDieFrameIndex] && dieFrames[currentDieFrameIndex].complete && dieFrames[currentDieFrameIndex].naturalWidth > 0) {
                    currentRenderImg = dieFrames[currentDieFrameIndex];
                }
            } else {
                // --- 🛡️ 待机模式 ---
                var elapsedIdleTime = now % totalIdleDuration;
                currentIdleFrameIndex = Math.floor(elapsedIdleTime / idleFrameDuration);

                if (idleFrames[currentIdleFrameIndex] && idleFrames[currentIdleFrameIndex].complete && idleFrames[currentIdleFrameIndex].naturalWidth > 0) {
                    currentRenderImg = idleFrames[currentIdleFrameIndex];
                }
            }

            // 4. 等比例渲染
            if (currentRenderImg.complete && currentRenderImg.naturalWidth > 0) {
                var imgAspect = currentRenderImg.naturalWidth / currentRenderImg.naturalHeight;
                var maxBound = Math.floor(Math.min(width, height) * 0.65 * zoomScale);
                var drawW, drawH;

                if (imgAspect > 1) {
                    drawW = maxBound;
                    drawH = Math.floor(maxBound / imgAspect);
                } else {
                    drawH = maxBound;
                    drawW = Math.floor(maxBound * imgAspect);
                }

                var startX = Math.floor(centerX - drawW / 2);
                var startY = Math.floor(centerY - drawH / 2);

                // 奔跑模式下微小振动感
                if (selectedActionMode === 'run') {
                    var runOffsetY = (currentRunFrameIndex % 2 === 1) ? -2 : 0;
                    startY += runOffsetY;
                }

                // 绘制当前动作图片
                ctx.drawImage(currentRenderImg, startX, startY, drawW, drawH);

                // 5. ⚔️ 碰撞判定框 (调试用)
                if (showDebugHitbox) {
                    // A. 【蓝色受击框 Hurtbox】：根据死亡倒地状态动态下压
                    var hurtX = startX + drawW * 0.35;
                    var hurtY = startY + drawH * 0.25;
                    var hurtW = drawW * 0.30;
                    var hurtH = drawH * 0.65;

                    // 死亡倒地过程受击框贴地
                    if (selectedActionMode === 'die') {
                        if (currentDieFrameIndex === 1) {
                            hurtY = startY + drawH * 0.45;
                            hurtH = drawH * 0.45;
                        } else if (currentDieFrameIndex === 2) {
                            hurtX = startX + drawW * 0.20;
                            hurtY = startY + drawH * 0.70;
                            hurtW = drawW * 0.60;
                            hurtH = drawH * 0.22;
                        }
                    }

                    ctx.strokeStyle = 'rgba(0, 180, 255, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(hurtX, hurtY, hurtW, hurtH);
                    ctx.fillStyle = 'rgba(0, 180, 255, 0.15)';
                    ctx.fillRect(hurtX, hurtY, hurtW, hurtH);

                    ctx.fillStyle = '#00b4ff';
                    ctx.font = '10px monospace';
                    ctx.fillText('Hurtbox (受击框)', hurtX, hurtY - 4);

                    // B. 【红色攻击框 Hitbox】：仅在挥刀第 2 帧（斩击瞬间）弹出
                    if (selectedActionMode === 'attack' && currentAttackFrameIndex === 1) {
                        var hitX = startX + drawW * 0.52;
                        var hitY = startY + drawH * 0.25;
                        var hitW = drawW * 0.42;
                        var hitH = drawH * 0.60;

                        ctx.strokeStyle = 'rgba(255, 30, 30, 0.95)';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(hitX, hitY, hitW, hitH);
                        ctx.fillStyle = 'rgba(255, 30, 30, 0.35)';
                        ctx.fillRect(hitX, hitY, hitW, hitH);

                        // 右侧斩击刀光弧线
                        ctx.strokeStyle = '#ffe082';
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.arc(hitX + hitW * 0.2, hitY + hitH * 0.5, hitW * 0.6, -Math.PI * 0.45, Math.PI * 0.45);
                        ctx.stroke();

                        ctx.fillStyle = '#ff3030';
                        ctx.font = 'bold 11px monospace';
                        ctx.fillText('⚡ 右侧 HITBOX (有效伤害!)', hitX, hitY - 6);
                    }
                }

                // 6. 顶部 UI 文字与帧状态提示
                ctx.save();
                ctx.font = 'bold 22px "Noto Serif SC", "PingFang SC", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                
                var textX = centerX;
                var textY = startY - 15;

                ctx.strokeStyle = '#121418';
                ctx.lineWidth = 4;
                ctx.strokeText('骑 士', textX, textY);
                ctx.fillStyle = '#ffffff';
                ctx.fillText('骑 士', textX, textY);

                // 底部状态提示
                ctx.font = '12px "Noto Serif SC", sans-serif';
                ctx.fillStyle = '#fce38a';
                
                var isEnglish = $('html').attr('lang') === 'en';
                var statusText = '';
                if (selectedActionMode === 'attack') {
                    statusText = isEnglish ? 
                        '⚔️ Attack Mode: Frame ' + (currentAttackFrameIndex + 1) + ' / 4' : 
                        '⚔️ 挥剑模式：第 ' + (currentAttackFrameIndex + 1) + ' / 4 帧';
                } else if (selectedActionMode === 'run') {
                    statusText = isEnglish ? 
                        '🏃 Run Mode: Frame ' + (currentRunFrameIndex + 1) + ' / 3' : 
                        '🏃 奔跑模式：第 ' + (currentRunFrameIndex + 1) + ' / 3 帧';
                } else if (selectedActionMode === 'die') {
                    statusText = isEnglish ? 
                        '💀 Death Mode: Frame ' + (currentDieFrameIndex + 1) + ' / 3' + (currentDieFrameIndex === 2 ? ' (Fallen)' : '') : 
                        '💀 死亡模式：第 ' + (currentDieFrameIndex + 1) + ' / 3 帧' + (currentDieFrameIndex === 2 ? ' (已倒地)' : '');
                } else {
                    statusText = isEnglish ? 
                        '🛡️ Idle Mode: Frame ' + (currentIdleFrameIndex + 1) + ' / 3' : 
                        '🛡️ 待机模式：第 ' + (currentIdleFrameIndex + 1) + ' / 3 帧呼吸中';
                }
                ctx.fillText(statusText, textX, startY + drawH + 25);
                ctx.restore();
            }

            ctx.restore();
        }

        requestAnimationFrame(render);
    }

    render();
};