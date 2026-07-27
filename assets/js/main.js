/* ================================================================= */
/* 1. 核心 helper 库 (视差滚动与图片加载) - 保持原样，仅压缩空白 */
/* ================================================================= */
function WnkLaxController(){this.elements=[];this.enabled=!1;this.requestID=null;this.init()}
WnkLaxController.prototype={init:function(){},addElement:function(el,parent,opts){var element=new WnkLaxElement(el,parent,opts);this.elements.push(element)},removeElement:function(el){for(var i=0;i<this.elements.length;i++){if(this.elements[i].el.get(0)==el.get(0)){this.elements[i].destroy();this.elements.splice(this.elements[i],1)}}},removeAll:function(){this.stop();for(var i=0;i<this.elements.length;i++){this.elements[i].destroy()}
this.elements=null},onFrame:function(){for(var i=0;i<this.elements.length;i++){this.elements[i].onFrame()}
this.requestID=window.requestAnimationFrame($.proxy(this.onFrame,this))},start:function(){this.enabled=!0;this.onFrame()},stop:function(){window.cancelAnimationFrame(this.requestID);this.requestId=null},trace:function(){for(var i=0;i<this.elements.length;i++){}},}
function WnkLaxElement(el,parent,opts){this.el=el;this.parent=parent;this.defaults={deltaX:1.0,deltaY:1.0,accX:1.0,accY:1.0,mode:'translate',axe:'v',max:!1,};this.settings=$.extend({},this.defaults,opts);this.y=0;this.x=0;this.originX=0;this.originY=0;this.w=0;this.h=0;this.currentDeltaX=0;this.currentDeltaY=0;this.wH=0;this.wW=0;this.init()}
WnkLaxElement.prototype={init:function(){this.onResize()},onFrame:function(){var tweenDeltaX=this.caclDeltaTranslate(this.settings.deltaX,this.currentDeltaX,this.settings.accX);var tweenDeltaY=this.caclDeltaTranslate(this.settings.deltaY,this.currentDeltaY,this.settings.accY);this.move(tweenDeltaX,tweenDeltaY);this.currentDeltaX=tweenDeltaX;this.currentDeltaY=tweenDeltaY},caclDeltaTranslate:function(delta,curr,acc){var scrollTop=this.getScrollTop();var newDelta=(scrollTop-(scrollTop*(delta)));var tweenDelta=(curr-((curr-newDelta))*acc);if(Math.abs(tweenDelta)<(1/1000)){tweenDelta=newDelta}
return tweenDelta},move:function(x,y){var property,value='';if(this.settings.mode=='translate'){property='transform';value="translateZ(0)";if(x!==0){value+=' translateX('+x+'px) '}
if(y!==0){value+=' translateY('+y+'px) '}}
if(this.settings.mode=='bg'){property='background-position';value+=(x!==0)?x+'px ':this._getBgPosFor('x')+' ';value+=(y!==0)?y+'px':this._getBgPosFor('y')}
if(value.length>0){this.el.css(property,value)}},enable:function(){if(!this.enabled){this.enabled=!0;this.onFrame()}},disable:function(){this.enabled=!1;this.onDisabled()},onDisabled:function(){},onResize:function(){this.wH=$(window).height();this.wW=$(window).width();this.w=this.el.width();this.h=this.el.height();var hasFixedParent=this.el.parents().filter(function(){return $(this).css('position')=='fixed'});if(hasFixedParent.length>0){this.originY=this.el.offset().top-window.pageYOffset}else{this.originY=this.el.offset().top;this.originX=this.el.offset().left}},destroy:function(){this.disable();this.el=null
this.parent=null;this.settings=null},getScrollTop:function(){if(this.originY>(this.wH/2)){return(window.pageYOffset-this.originY)+(this.wH/2)-(this.h/2)}
var origin=Math.max((this.originY-(this.wH/2)),0);return(window.pageYOffset-origin)},_getBgPosFor:function(axe){var pos=this.el.css('background-position').split(' ');if(axe=='x'){return pos[0]}
return pos[1]}}
function WnkMediaLoader(imgs,parent){this.$imgs=imgs;this.count=0;this.parent=parent;this.allLoaded=!1;this.eventName='wnk.mediasLoaded';this.init()}
WnkMediaLoader.prototype={init:function(){if(this.$imgs.length<=0){$(this.parent).trigger(this.eventName)}},load:function(){this.$imgs.each($.proxy(this.initMedia,this))},initMedia:function(i,media){var $media=$(media);if($media.prop('tagName')==='IMG'){$media.one("load.WnkMediaLoader",$.proxy(this.onMediaLoaded,this));if(media.complete)$media.load()}else if($media.prop('tagName')==='VIDEO'){$media.one("loadeddata.WnkMediaLoader",$.proxy(this.onMediaLoaded,this));media.load()}else{console.log('UNKNOWN MEDIA => '+$media.prop('tagName'));this.count=-1;this.onMediaLoaded()}},onMediaLoaded:function(e){this.count++;if(this.count==this.$imgs.length){$(this.parent).trigger(this.eventName)}},destroy:function(){this.$imgs.unbind('load.WnkMediaLoader').unbind('loadeddata.WnkMediaLoader')}};

/* ================================================================= */
/* 2. 麦日记主程序 (MaiRijiApp) */
/* ================================================================= */

function MaiRijiApp(){
    // 实例化视差控制器
    this.wax = new WnkLaxController();
}

MaiRijiApp.prototype = {
    
    // --- 启动入口 ---
    preload: function(){
        this.init();
    },
    
    // --- 初始化 ---
    init: function(){
		var $this = this;
		
		// 生成产品卡片
		this.renderProducts();
		
        // 2. 👇 新增：生成 Savoria 横向滚动卡片
        this.renderSavoriaCards();

        // 👇 新增：全站扫描并强制预加载所有 tiny 图 👇
        this.forceLoadTinyImages();

        // 触发首页背景 Ken Burns 放大动画
        $('.home-intro .bg-inner').addClass('play-zoom');
        // 绑定所有交互事件
        this.bindEvents();

        // 🌟 新增：启动鼠标动画
        this.initCustomCursor();
    },
	
    // 👇 新增这个函数：自动生成 Savoria 卡片 👇
    renderSavoriaCards: function() {
        // 1. 配置数据 (想加减卡片，改这里就行)
        var cardsData = [
            { img: "1", dir: "up",   label: "Signature / 招牌" },
            { img: "2", dir: "down", label: "" },
            { img: "3", dir: "up",   label: "Fresh / 新鲜" },
            { img: "4", dir: "down", label: "" },
            { img: "5", dir: "up",   label: "Sweet / 甜点" },
            { img: "6", dir: "down", label: "" },
            { img: "7", dir: "up",   label: "" }
        ];

        var html = '';
        
        // 2. 循环拼接 HTML
        $.each(cardsData, function(index, item) {
            // 如果有 label 文本，就生成黑色遮罩层；如果没有，就留空
            var overlayHtml = item.label ? `<div class="card-overlay"><span>${item.label}</span></div>` : '';
            
            html += `
            <div class="savoria-card ${item.dir}">
                <div class="img-holder progressive-bg blur-effect" 
                     style="background-image: url('assets/img/your-bread-${item.img}-tiny.webp');" 
                     data-highres="assets/img/your-bread-${item.img}.webp"></div>
                ${overlayHtml}
            </div>
            `;
        });

        // 3. 把生成的代码塞进 HTML 的“坑位”里
        // prepend 是塞在最前面（不覆盖后面的 mobile-clones 容器）
        $('#savoria-track-container').prepend(html);
        // html 是填满 mobile-clones 容器
        $('#savoria-mobile-clones').html(html);
    },

    // 🌟 新增的黑科技：全局 tiny 图提取与强制加载
    forceLoadTinyImages: function() {
        $('.progressive-bg').each(function() {
            // 读取内联 style 里的 background-image URL
            var bgStr = $(this)[0].style.backgroundImage;
            if (bgStr && bgStr !== 'none') {
                // 用正则把 url('...') 里面的干净链接提取出来
                var url = bgStr.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
                // 强制浏览器后台下载这张 tiny 图
                new Image().src = url; 
            }
        });
    },

	// 自动生成面包卡片
    renderProducts: function() {
        // --- 1. 这里是菜单配置区 (以后加面包改这里就行) ---
        var products = [
            { name: "乡村酵母欧包", price: "14.00", img: "1" },
            { name: "葡萄核桃欧包", price: "16.00", img: "2" },
            { name: "巧克力核桃欧包", price: "16.00", img: "3" },
            { name: "柠檬蓝莓欧包", price: "17.00", img: "4" },
            { name: "火龙果欧包", price: "16.00", img: "5" },
            { name: "抹茶蔓越莓欧包", price: "16.00", img: "6" },
            { name: "蜂蜜金瓜欧包", price: "17.00", img: "7" }
        ];

        var html = '';
        
        // 遍历上面的数组
        $.each(products, function(index, item) {
            var tinyUrlNormal = 'assets/img/your-bread-' + item.img + '-tiny.webp';
            var tinyUrlHover = 'assets/img/your-bread-' + item.img + '-hover-tiny.webp';
            new Image().src = tinyUrlNormal; 
            new Image().src = tinyUrlHover;
            html += `
            <li class="grid__item slider__slide">
                <div class="product-card-wrapper card-wrapper" style="background: transparent; border: none; box-shadow: none; padding: 0;">
                    <div class="stack-container">
                        <div class="polaroid card-bottom">
                            <div class="photo-area" style="background-color: #fbf9f4;"></div>
                        </div>

                        <div class="polaroid card-middle-hover">
                            <div class="photo-area progressive-bg blur-effect" 
                                 style="background-image: url('assets/img/your-bread-${item.img}-hover-tiny.webp');"
                                 data-highres="assets/img/your-bread-${item.img}-hover.webp">
                            </div>
                        </div>

                        <div class="polaroid card-front">
                            <div class="photo-area progressive-bg blur-effect" 
                                 style="background-image: url('assets/img/your-bread-${item.img}-tiny.webp');"
                                 data-highres="assets/img/your-bread-${item.img}.webp">
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-information" style="padding-top: 10px; text-align: center;">
                        <div class="card-information__wrapper">
                            <span class="card-information__text">${item.name}</span>
                            <div class="price"><span class="price-item">RM ${item.price}</span></div>
                        </div>
                    </div>
                </div>
            </li>
            `;
        });

        // --- 3. 把生成的 HTML 塞进页面 ---
        $('#product-list').html(html);
    },
    
    // --- 事件绑定中心 ---
    bindEvents: function(){
        var $this = this;

        // A. 启动导航栏滚动监听 (Sticky Header)
        this.initStickyNav();

        // B. 图片加载完后启动视差 (仅限桌面端，优化性能)
        if(!this.isMobile()){
            var loader = new WnkMediaLoader($('img'), this);
            $(this).one(loader.eventName, $.proxy(this.onLoad, this));
            loader.load();
        }

        // C. 移动端汉堡菜单切换
        $('.m-burger').on('click', function(){
            $('body').toggleClass('menuOpen');
        });

        // D. 导航栏链接点击 (SPA 页面切换)
        $('.nav-link').on('click', function(e){
            e.preventDefault();
            // 如果点击的是当前页面，不做任何事
            var targetId = $(this).data('target');
            if($('#' + targetId).hasClass('active-view')) return;
            
            $this.handlePageTransition($(this));
        });

        // E. 首页“向下滚动”箭头
        $(document).on('click', 'a.down', function(e) {
            e.preventDefault();
            var targetId = $(this).attr('href');
            var $target = $(targetId);
            if ($target.length > 0) {
                // 减去 60px 是为了避开导航栏遮挡
                $('html, body').animate({ scrollTop: $target.offset().top - 60 }, 800);
            }
        });

        // F. 全局滚动监听 (用于横向滚动特效)
        $(window).on('scroll', function(){
            var scrollTop = $(window).scrollTop();
            $this.handleHorizontalScroll(scrollTop);
        });
        
        // G. 窗口大小改变时，重置视差计算
        $(window).on('resize', function(){
             if($this.wax && $this.wax.elements){
                for(var i=0; i<$this.wax.elements.length; i++){
                    $this.wax.elements[i].onResize();
                }
            }
            // 重新计算导航栏触发点
            Waypoint.refreshAll();
        });

        // H. 麦穗按钮点击特效 (新标签页打开)
        $('.wheat-btn').on('click', function(e) {
            var $btn = $(this);
            var targetUrl = $btn.attr('data-link'); 
            
            if (!$btn.hasClass('clicked')) {
                $btn.addClass('clicked'); // 播放动画
                
                setTimeout(function() {
                    window.open(targetUrl, '_blank'); 
                }, 800); // 延迟 800ms

                setTimeout(function() {
                    $btn.removeClass('clicked');
                }, 1500); // 动画结束后重置
            }
        });
    },

    // --- 核心逻辑：智能导航栏 (Sticky Nav) ---
    initStickyNav: function() {
        // 清理旧的触发器，防止叠加
        Waypoint.destroyAll();
        
        // 默认重置为大导航栏
        $('.main-header').removeClass('small');
        $('.home-intro .inner').removeClass('scroll-hide');

        // 寻找当前激活页面的触发点 (scrollTrigger)
        var $activeTrigger = $('.page-view.active-view .scrollTrigger');
        
        if($activeTrigger.length > 0){
            $activeTrigger.waypoint({
                handler: function(dir){
                    if(dir == 'down'){ 
                        // 向下滚动：变小导航栏，隐藏 Hero 文字
                        $('.main-header').addClass('small');
                        $('.home-intro .inner').addClass('scroll-hide');
                    }
                    else { 
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
    handleHorizontalScroll: function(scrollTop) {
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
        if (scrollDist >= 0 && scrollDist <= effectiveHeight) {
            var progress = scrollDist / effectiveHeight;
            var splitPoint = 0.75; // 前 75% 滚动图片，后 25% 显示日记

            var trackWidth = $track.outerWidth();
            var viewportWidth = $(window).width();
            
            // 计算最大横向位移
            var maxTranslateX = trackWidth - viewportWidth + (viewportWidth * 0.3);
            var maxTranslateY = Math.max(0, $contentWrap.outerHeight() - winHeight);

            if (progress <= splitPoint) {
                // 阶段一：横向滚动卡片
                var hProg = progress / splitPoint;
                $track.css('transform', 'translateX(' + (-maxTranslateX * hProg) + 'px)');
                
                // 上下浮动动画
                $cards.each(function(i) {
                    var isOdd = i % 2 !== 0;
                    var val = Math.sin(hProg * Math.PI * 2 + (isOdd ? Math.PI : 0)) * 30;
                    $(this).css('transform', 'translateY(' + val + 'px)');
                });

                // 隐藏日记
                $diary.removeClass('is-visible');
                $contentWrap.css('transform', 'translateY(0px)');

            } else {
                // 阶段二：显示日记
                var vProg = (progress - splitPoint) / (1 - splitPoint);
                $track.css('transform', 'translateX(' + (-maxTranslateX) + 'px)'); // 锁定图片位置
                $diary.addClass('is-visible'); // 显示日记
                
                // 内容轻微上移，腾出空间
                $contentWrap.css('transform', 'translateY(' + (-maxTranslateY * vProg) + 'px)');
            }
        } else if (scrollDist < 0) {
            // 回到顶部之前：重置
            $track.css('transform', 'translateX(0px)');
            $cards.css('transform', 'translateY(0px)');
            $diary.removeClass('is-visible');
        }
    },

    // --- 核心逻辑：SPA 页面切换转场 ---
    handlePageTransition: function($link) {
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
        setTimeout(function() {
            // 膨胀填满屏幕
            $toast.addClass('expanding');
            
            setTimeout(function() {
                // --- 幕后操作开始 ---
                
                // A. 切换视图 DOM
                $('.page-view').removeClass('active-view');
                $('#' + targetId).addClass('active-view');
                
                // B. 滚回顶部
                window.scrollTo(0, 0);
                
                // C. 修复 Banner 透明度 (防止之前的滚动逻辑残留)
                $('.home-intro .wrap, .page-intro .wrap').css('opacity', '');
                
                // D. 关闭移动端菜单
                if($('body').hasClass('menuOpen')) $('body').removeClass('menuOpen');

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
                var stabilize = function() {
                    if(self.wax && self.wax.elements){
                        for(var i=0; i<self.wax.elements.length; i++){
                            self.wax.elements[i].onResize(); // 重新测量位置
                            self.wax.elements[i].onFrame();  // 立即重绘
                        }
                    }
                    Waypoint.refreshAll(); // 刷新导航栏触发点
                    
                    frames--;
                    if(frames > 0) {
                        requestAnimationFrame(stabilize);
                    }
                };
                stabilize();
                
                // --- 幕后操作结束 ---

                // 4. 淡出遮罩
                $toast.addClass('fading-out');
                
                // 5. 清理动画类名，为下次做准备
                setTimeout(function(){ 
                    $toast.removeClass('pop-in expanding fading-out'); 
                }, 400);

            }, 500); // 配合 CSS transition 0.5s
        }, 600); // 等待图标蹦出
    },

    // --- 视差滚动启动器 ---
    onLoad: function(){
        if(this.isMobile()) return;

        // 仅对 Header 区域启用视差 (Footer 已排除)
        this.wax.addElement($('.page-intro .bg, .home-intro .bg, header.intro .bg'), null, {
            deltaY: 1.2, 
            mode: 'translate'
        });
        
        this.wax.start();
    },

    // --- 工具：设备检测 ---
    isMobile: function() {
        var isSmallScreen = window.innerWidth <= 769;
        var isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        return isSmallScreen || isTouchDevice;
    },

    initCustomCursor: function() {
        // 如果是手机端/触控设备，直接退出并移除残留元素
        if (this.isMobile()) {
            $('#custom-cursor').remove();
            return;
        }

        var $cursor = $('#custom-cursor');
        if ($cursor.length === 0) {
            $cursor = $('<div id="custom-cursor"></div>');
            $('body').append($cursor);
        }
        
        // 1. 强制样式 (解决层级被遮挡问题)
        $cursor.css({
            'position': 'fixed',
            'z-index': '2147483647',
            'pointer-events': 'none',
            'transform': 'translateZ(2147483647px)',
            'margin': '0',
            'padding': '0',
            'width': '36px',
            'height': '36px'
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
        $.each(allFrames, function(i, el){
            if($.inArray(el, uniqueFrames) === -1) uniqueFrames.push(el);
        });

        // 遍历所有不重复的图片，直接生成多个隐藏的 img 标签
        $.each(uniqueFrames, function(index, src) {
            var $img = $('<img>').attr('src', src).css({
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
        function setCursorImage(src) {
            if (currentActiveImg === imageElements[src]) return; // 如果一样，不操作
            if (currentActiveImg) currentActiveImg.hide();       // 隐藏上一个
            currentActiveImg = imageElements[src];               // 更新当前
            if (currentActiveImg) currentActiveImg.show();       // 显示当前的
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
        function playClickAnimation(framesToPlay, onCompleteFrames) {
            if (isClickAnimating) return;
            isClickAnimating = true;
            currentFrameIndex = 0;
            
            setCursorImage(framesToPlay[0]); // 显示第一帧

            var frameDuration = 100; 
            var playNextFrame = function(index) {
                if (index < framesToPlay.length) {
                    setCursorImage(framesToPlay[index]);
                    animationTimer = setTimeout(function() {
                        playNextFrame(index + 1);
                    }, frameDuration);
                } else {
                    isClickAnimating = false;
                    currentLoopFrames = onCompleteFrames;
                    currentFrameIndex = -1;
                }
            };

            animationTimer = setTimeout(function() {
                playNextFrame(1);
            }, frameDuration);
        }

        // 悬停交互
        $(document).on('mouseenter', interactiveSelectors, function() {
            isHovering = true;
            if (!isClickAnimating) {
                currentLoopFrames = pointerFrames;
                currentFrameIndex = -1; 
                updateLoopImage();
            }
        });

        $(document).on('mouseleave', interactiveSelectors, function() {
            isHovering = false;
            if (!isClickAnimating) {
                currentLoopFrames = defaultFrames;
                currentFrameIndex = -1; 
                updateLoopImage();
            }
        });

        // 点击交互
        $(document).on('mousedown', function() {
            clearTimeout(animationTimer);
            isClickAnimating = false; 
            if (isHovering) {
                playClickAnimation(pointerClickFrames, pointerFrames);
            } else {
                playClickAnimation(normalClickFrames, defaultFrames);
            }
        });

        // 循环动画定时器
        function updateLoopImage() {
            if (isClickAnimating) return;
            currentFrameIndex = (currentFrameIndex + 1) % currentLoopFrames.length;
            // 🌟 使用全新的 setCursorImage 切换图片
            setCursorImage(currentLoopFrames[currentFrameIndex]); 
        }

        setInterval(updateLoopImage, 200);

        $(document).on('mousemove', function(e) {
            // 更新自定义鼠标位置
            $cursor.css({ 
                'left': (e.clientX - 5) + 'px', 
                'top': (e.clientY - 5) + 'px' 
            });
            if ($cursor.css('display') === 'none') { $cursor.show(); }
        });
    },
    // ==========================================
    // 🔥 渐进式图片加载引擎 (Blur-up)
    // ==========================================
    loadHighResImages: function() {
        $('.progressive-bg').each(function() {
            var $el = $(this);
            var highResUrl = $el.data('highres');

            if (highResUrl) {
                // 创建一个存在于内存中的“虚拟图片”对象
                var img = new Image();
                
                // 当这张内存里的高清图下载完毕时...
                img.onload = function() {
                    // 1. 替换背景图为高清图
                    $el.css('background-image', "url('" + highResUrl + "')");
                    // 2. 移除模糊滤镜，触发 CSS 渐变动画
                    $el.removeClass('blur-effect');
                };
                
                // 给虚拟图片赋予 URL，浏览器开始在后台悄悄下载
                img.src = highResUrl;
            }
        });
    }
};