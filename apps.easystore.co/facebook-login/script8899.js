			function fb_login(){
				location.href = 'https://apps.easystore.co/facebook-login/run?domain='+window.location.protocol+'//'+window.location.hostname+'&shop=doudou-2.easy.co';
			}

			$(document).ready(function() {
				try{

                    if (!document.getElementById("fb-login-btn")) {
                        $("#CustomerLoginForm, #register form").find("input[type='submit']").parent().append('<button id="fb-login-btn" type="button" onclick="fb_login()" class="btn" style="background-color: #3a5795; border-bottom: 1px solid #103480; color: white; font-weight: bold;"><span class="icon icon-facebook" aria-hidden="true"></span> Continue with Facebook</button>');
                    }
									if($(".header-bar__module--list").html().match(/account\/login/g))
					$(".header-bar__module--list").append('<li><a href="#" onclick="fb_login()">Login with Facebook</a></li>');

				if($("#MobileNav").html().match(/account\/login/g))
						$("#MobileNav").find("a[href='/account/login']").parent().after('<li class="mobile-nav__link"><a href="#" onclick="fb_login()">Login with Facebook</a></li>');

				}catch(err) {}
			});

      document.querySelector('#fb-login-btn').addEventListener('click',()=>{
        document.querySelector('#fb-login-btn').classList.add('btn--loading')
      })
