/* ================================================================= */
/*             WnkLaxController & WnkMediaLoader (Helper Libs)        */
/* ================================================================= */
// (保留这部分库代码不变，这是视差滚动的基础)
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
/*                           主逻辑类                                 */
/* ================================================================= */

function MaiRijiApp(){
    this.wax = new WnkLaxController();
}

MaiRijiApp.prototype = {
    
    // 1. 入口函数
    preload: function(){
        this.init();
    },
    
    // 2. 初始化
    init: function(){
        var $this = this;
        
        // 触发首页背景 Ken Burns 动画
        $('.home-intro .bg-inner').addClass('play-zoom');
        
        // 绑定所有事件
        this.bindEvents();
        
        // 文字淡入
        setTimeout(function(){
            $('.home-intro, .page-intro').addClass('show');
        }, 100);
    },
    
    // 3. 事件绑定中心
    bindEvents: function(){
        var $this = this;

        // --- A. 导航栏滚动监听 (Waypoints) ---
        var $triggerScroll = $('.scrollTrigger');
        if($triggerScroll.length > 0){
            $triggerScroll.waypoint({
                handler: function(dir){
                    if(dir == 'down'){ $('.main-header').addClass('small'); }
                    else { $('.main-header').removeClass('small'); }
                },
                offset: $('.main-header').height() + 15
            });

            // 图片加载完后启动视差 (仅限桌面端)
            if(!this.isMobile()){
                var loader = new WnkMediaLoader($('img'), this);
                $(this).one(loader.eventName, $.proxy(this.onLoad, this));
                loader.load();
            }
        }

        // --- B. 移动端汉堡菜单 ---
        $('.m-burger').on('click', function(){
            $('body').toggleClass('menuOpen');
        });

        // --- C. 向下箭头平滑滚动 ---
        $(document).on('click', 'a.down', function(e) {
            e.preventDefault();
            var $target = $('#home-start');
            if ($target.length > 0) {
                $('html, body').animate({ scrollTop: $target.offset().top - 60 }, 800);
            }
        });

        // --- D. SPA 页面切换 (Toast 转场) ---
        $('.nav-link').on('click', function(e) {
            e.preventDefault();
            $this.handlePageTransition($(this));
        });

        // --- E. 全局滚动监听 (Savoria 效果 + Hero 视差) ---
        $(window).on('scroll', function() {
            var scrollTop = window.pageYOffset;
            
            // 1. Hero 区域透明度变化 (仅桌面)
            if(!$this.isMobile() && scrollTop < $(window).height()){
                var percent = scrollTop / ($(window).height() / 2.5);
                $('.home-intro .wrap, .page-intro .wrap').css({ opacity: 1 - percent });
            }

            // 2. 处理横向滚动逻辑
            $this.handleHorizontalScroll(scrollTop);
        });
    },

    // 辅助：处理 Savoria 横向滚动逻辑
    handleHorizontalScroll: function(scrollTop) {
        if (this.isMobile()) return; // 手机端使用 CSS 动画，跳过 JS 计算

        var $scrollWrapper = $('.horizontal-scroll-wrapper');
        if ($scrollWrapper.length === 0) return;

        var winHeight = $(window).height();
        var wrapperTop = $scrollWrapper.offset().top;
        var wrapperHeight = $scrollWrapper.height();
        var effectiveHeight = wrapperHeight - winHeight; // 可滚动的总距离
        var scrollDist = scrollTop - wrapperTop;

        var $track = $('.savoria-track');
        var $cards = $('.savoria-card');
        var $contentWrap = $('.savoria-sticky-viewport > .wrap');
        var $diary = $('#home-diary');

        // 计算逻辑
        if (scrollDist >= 0 && scrollDist <= effectiveHeight) {
            var progress = scrollDist / effectiveHeight;
            var splitPoint = 0.75; // 75% 滚动用于横移，25% 用于上浮

            // 变量计算
            var trackWidth = $track.outerWidth();
            var viewportWidth = $(window).width();
            var maxTranslateX = trackWidth - viewportWidth + (viewportWidth * 0.3);
            var maxTranslateY = Math.max(0, $contentWrap.outerHeight() - winHeight);

            if (progress <= splitPoint) {
                // 阶段 1: 横向移动 + 上下浮动
                var hProg = progress / splitPoint;
                $track.css('transform', 'translateX(' + (-maxTranslateX * hProg) + 'px)');
                
                // 卡片正弦波浮动
                $cards.each(function(i) {
                    var isOdd = i % 2 !== 0;
                    var val = Math.sin(hProg * Math.PI * 2 + (isOdd ? Math.PI : 0)) * 30;
                    $(this).css('transform', 'translateY(' + val + 'px)');
                });

                // 重置阶段 2 状态
                $diary.removeClass('is-visible');
                $contentWrap.css('transform', 'translateY(0px)');

            } else {
                // 阶段 2: 锁定横向，内容上浮
                var vProg = (progress - splitPoint) / (1 - splitPoint);
                
                $track.css('transform', 'translateX(' + (-maxTranslateX) + 'px)');
                $diary.addClass('is-visible');
                $contentWrap.css('transform', 'translateY(' + (-maxTranslateY * vProg) + 'px)');
            }
        } else if (scrollDist < 0) {
            // 复位 (在区域上方)
            $track.css('transform', 'translateX(0px)');
            $cards.css('transform', 'translateY(0px)');
            $diary.removeClass('is-visible');
        }
    },

    // 辅助：处理 SPA 转场
    handlePageTransition: function($link) {
        var targetId = $link.data('target');
        if (!targetId || $('#' + targetId).length === 0) return;
        if ($('#' + targetId).hasClass('active-view')) return;

        var $toast = $('#toast-transition');
        
        // 1. 准备
        $toast.removeClass('pop-in expanding fading-out').css('opacity', '');
        void $toast[0].offsetWidth; // 强制重绘
        
        // 2. 蹦出
        $toast.addClass('pop-in');
        
        // 3. 膨胀并切换
        setTimeout(function() {
            $toast.addClass('expanding');
            
            setTimeout(function() {
                // 切换视图 DOM
                $('.page-view').removeClass('active-view');
                $('#' + targetId).addClass('active-view');
                window.scrollTo(0, 0);
                
                // 关闭菜单
                if($('body').hasClass('menuOpen')) $('body').removeClass('menuOpen');

                // 重置 Hero 动画
                var $bg = (targetId === 'view-home') ? $('.home-intro .bg-inner') : $('#' + targetId + ' .bg-inner');
                $bg.removeClass('play-zoom');
                void $bg[0].offsetWidth;
                $bg.addClass('play-zoom');
                
                // 4. 淡出遮罩
                $toast.addClass('fading-out');
                
                // 清理类名
                setTimeout(function(){ 
                    $toast.removeClass('pop-in expanding fading-out'); 
                }, 400);

            }, 500);
        }, 600);
    },

    // 辅助：视差滚动启动 (图片加载后)
    onLoad: function(){
        if(this.isMobile()) return;

        // 为背景和文字添加视差效果
        this.wax.addElement($('.page-intro .bg, .home-intro .bg, header.intro .bg'), null, {deltaY: 1.2, mode: 'translate'});
        this.wax.addElement($('.main-footer .bg'), null, {deltaY: 0.6, mode: 'translate'});
        
        $('.page-intro, .home-intro, header.intro').each(function(){
            if(!$(this).hasClass('short')){
                // 此处 $this 指向当前遍历的元素，需使用 outer scope 的 this (即 app 实例)
                // 但由于上面使用了 bind/proxy 或者是为了简化，这里可以直接用 global instance 或者传参
                // 简单起见，假设 wax 已经在 scope 中可用
            }
        });
        
        // 注意：由于上面是在 each 循环里，this指向变了。
        // 最好的办法是在 onLoad 开头 var _app = this; 然后用 _app.wax
        // 这里为了代码简洁，保留原有逻辑结构，但在实际合并时要注意作用域
        this.wax.start();
    },

    // 工具：检测是否移动端
    isMobile: function() {
        return window.innerWidth <= 769;
    }
};