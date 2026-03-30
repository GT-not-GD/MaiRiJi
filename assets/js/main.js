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
		
        // 触发首页背景 Ken Burns 放大动画
        $('.home-intro .bg-inner').addClass('play-zoom');
        // 绑定所有交互事件
        this.bindEvents();

        // 🌟 新增：启动鼠标动画
        this.initCustomCursor();
    },
	
	// 自动生成面包卡片
    renderProducts: function() {
        // --- 1. 这里是菜单配置区 (以后加面包改这里就行) ---
        var products = [
            { name: "乡村酵母欧包", price: "15.00", img: "1" },
            { name: "葡萄核桃欧包", price: "16.00", img: "2" },
            { name: "巧克力核桃欧包", price: "16.00", img: "3" },
            { name: "柠檬蓝莓欧包", price: "17.00", img: "4" },
            { name: "火龙果欧包", price: "16.00", img: "5" },
            { name: "抹茶蔓越莓欧包", price: "16.00", img: "6" },
            { name: "蜂蜜金瓜欧包", price: "17.00", img: "7" }
        ];

        // --- 2. 生成 HTML 的逻辑 ---
        var html = '';
        
        // 遍历上面的数组
        $.each(products, function(index, item) {
            // 拼接 HTML 字符串 (使用 ES6 模板字符串 ``)
            html += `
            <li class="grid__item slider__slide">
                <div class="product-card-wrapper card-wrapper" style="background: transparent; border: none; box-shadow: none; padding: 0;">
                    <div class="stack-container">
                        <div class="polaroid card-bottom">
                            <div class="photo-area" style="background-color: #f4f4f4;"></div>
                        </div>

                        <div class="polaroid card-middle-hover">
                            <div class="photo-area" style="background-image: url('assets/img/your-bread-${item.img}-hover.jpg');"></div>
                        </div>

                        <div class="polaroid card-front">
                            <div class="photo-area" style="background-image: url('assets/img/your-bread-${item.img}.jpg');"></div>
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
        return window.innerWidth <= 769;
    },

    // ==========================================
    // 修改：终极版自定义鼠标 (普通/悬停/普通点击/悬停点击)
    // ==========================================
    initCustomCursor: function() {
        // 如果是手机端，直接退出
        if (this.isMobile()) return;

        var $cursor = $('#custom-cursor');
        var $cursorImg = $('#cursor-img');

        // 🔥 终极修复：直接用 JS 注入最高权重的内联样式，专治 CSS 缓存和图层不服
        $cursor.css({
            'position': 'fixed',
            'z-index': '2147483647',
            'pointer-events': 'none',
            'transform': 'translateZ(9999px)', /* 在 3D 空间里强行拉到最贴近屏幕的位置 */
            'margin': '0',
            'padding': '0'
        });
        
        // 🔥 强制把鼠标元素移动到 <body> 的绝对末尾，利用 DOM 顺位碾压其他元素
        // 🔥 之前修复 Bug 时的 Append 代码，保持原样 🔥
        $('body').append($cursor);

        // ========================================================
        // 🔥 [全新] 掉落冰块逻辑 (降低密度，改变运动模式) 🔥
        // ========================================================
        
        var isThrottled = false; // 用于控制冰块生成频率（性能节流）

        // 核心参数：控制冰块生成的密度（数值越高，掉落越稀疏，视觉越不密集。推荐 200-400ms）
        var spawnInterval = 300; 

        // 监听鼠标移动（使用偏移量补偿）
        $(document).on('mousemove', function(e) {
            // 1. [保持原样] 更新自定义鼠标主体位置 (使用 JS 补偿 -5px)
            $cursor.css({ 
                'left': (e.clientX - 5) + 'px', 
                'top': (e.clientY - 5) + 'px' 
            });
            if ($cursor.css('display') === 'none') { $cursor.show(); }

            // 2. [全新] 生成掉落的冰块粒子
            if (!isThrottled) {
                isThrottled = true;

                // 创建一个冰块 DOM
                var $iceCube = $('<div>');
                $iceCube.addClass('cursor-ice-cube');

                // 2a. 设置冰块初始位置在鼠标正中心 (无需 -5 偏移)
                $iceCube.css({
                    'left': e.clientX + 'px',
                    'top': e.clientY + 'px'
                });

                // 2b. 将冰块添加到 <body>
                $('body').append($iceCube);

                // 2c. [性能关键] 1秒后（动画结束时）自动从 DOM 中移除冰块
                setTimeout(function() {
                    $iceCube.remove();
                }, 1000); // 必须与 CSS 动画时间一致 (1s)

                // 2d. 设置一个定时器，在 spawnInterval 时间后，允许重新生成冰块
                setTimeout(function() {
                    isThrottled = false;
                }, spawnInterval);
            }
        });

        // ==============================
        // 1. 准备图片帧组 (请务必填写你实际的文件路径)
        // ==============================
        
        // [A] 普通循环动画 (3帧)
        var defaultFrames = [
            'assets/img/cursor1.png',
            'assets/img/cursor2.png',
            'assets/img/cursor3.png'
        ];

        // [B] 悬停循环动画 (3帧)
        var pointerFrames = [
            'assets/img/pointer1.png', 
            'assets/img/pointer2.png',
            'assets/img/pointer3.png'
        ];

        // [C] 🌟 普通点击动画 (仅播放一次，建议帧数少一点，如2-3帧，速度快一点)
        var normalClickFrames = [
            'assets/img/click1.png',
            'assets/img/click2.png',
            'assets/img/click3.png',
        ];

        // [D] 🌟 悬停后点击动画 (仅播放一次，建议帧数少一点，如2-3帧，速度快一点)
        var pointerClickFrames = [
            'assets/img/ptrClick1.png', 
            'assets/img/ptrClick2.png', 
            'assets/img/ptrClick3.png'
        ];


        // ==============================
        // 2. 状态控制变量
        // ==============================
        var interactiveSelectors = 'a, button, input[type="submit"], .btn';
        
        var isHovering = false;           // 是否悬停在按钮上
        var isClickAnimating = false;     // 是否正在播放点击动画（单次）
        
        var currentLoopFrames = defaultFrames; // 当前循环使用的帧组
        var currentFrameIndex = 0;
        var animationTimer = null;         // 用于控制单次动画播放


        // ==============================
        // 3. 核心逻辑：播放单次动画的函数
        // ==============================
        function playClickAnimation(framesToPlay, onCompleteFrames) {
            // 如果已经在播放点击动画，则忽略新的点击，防止冲突
            if (isClickAnimating) return;

            isClickAnimating = true;
            currentFrameIndex = 0;
            
            // 立即显示第一帧，让反馈最快
            $cursorImg.attr('src', framesToPlay[0]);

            // 计算单次动画总时长（比如每帧 80ms，比循环动画快一些）
            var frameDuration = 100; 
            var totalDuration = framesToPlay.length * frameDuration;

            // 播放剩余帧的逻辑
            var playNextFrame = function(index) {
                if (index < framesToPlay.length) {
                    $cursorImg.attr('src', framesToPlay[index]);
                    // 递归调用，播放下一帧
                    animationTimer = setTimeout(function() {
                        playNextFrame(index + 1);
                    }, frameDuration);
                } else {
                    // 动画播放完毕
                    isClickAnimating = false;
                    currentLoopFrames = onCompleteFrames; // 切回应有的循环帧组
                    currentFrameIndex = -1; // 重置循环索引，让它立刻播放循环的第一帧
                }
            };

            // 启动单次动画（从第二帧开始，因为第一帧已经手动渲染了）
            animationTimer = setTimeout(function() {
                playNextFrame(1);
            }, frameDuration);
        }


        // ==============================
        // 4. 事件监听：悬停 (Hover)
        // ==============================
        $(document).on('mouseenter', interactiveSelectors, function() {
            isHovering = true;
            // 如果没有播放点击动画，则立刻切到悬停循环
            if (!isClickAnimating) {
                currentLoopFrames = pointerFrames;
                currentFrameIndex = -1; // 强制立刻更新
                updateLoopImage();
            }
        });

        $(document).on('mouseleave', interactiveSelectors, function() {
            isHovering = false;
            // 如果没有播放点击动画，则立刻切回普通循环
            if (!isClickAnimating) {
                currentLoopFrames = defaultFrames;
                currentFrameIndex = -1; // 强制立刻更新
                updateLoopImage();
            }
        });


        // ==============================
        // 5. 🌟 事件监听：点击 (Click - mousedown 响应最快)
        // ==============================
        $(document).on('mousedown', function() {
            // 清除可能正在播放的单次动画定时器，防止重叠
            clearTimeout(animationTimer);
            isClickAnimating = false; 

            if (isHovering) {
                // 场景 D: 悬停后点击
                playClickAnimation(pointerClickFrames, pointerFrames);
            } else {
                // 场景 C: 普通点击
                playClickAnimation(normalClickFrames, defaultFrames);
            }
        });


        // ==============================
        // 6. 循环动画定时器
        // ==============================
        function updateLoopImage() {
            // 如果正在播放单次点击动画，则暂停循环更新
            if (isClickAnimating) return;

            currentFrameIndex = (currentFrameIndex + 1) % currentLoopFrames.length;
            $cursorImg.attr('src', currentLoopFrames[currentFrameIndex]);
        }

        setInterval(updateLoopImage, 200); // 循环动画速度
    },
};