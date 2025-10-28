$('body').on("click", ".sf_promo-product-single__btn-qty-adjust", function(event) {
  event.stopImmediatePropagation();
  var $button = $(this);
  var oldValue = $button.parent().find("input.sf_promo-quantity-input").val();

  if ($button.attr('data-adjust') == 1) {
    var newVal = parseFloat(oldValue) + 1;
  } else {
  // Don't allow decrementing below zero
    if (oldValue > 1) {
      var newVal = parseFloat(oldValue) - 1;
    } else {
      newVal = 1; 
    }
  }

  $button.parent().find("input.sf_promo-quantity-input").val(newVal).change();
  
});

function expandPromoSection() {
  var element = document.getElementById("promotion-section")
  var expand_btn = document.getElementById("view-more-promotion")

  
  element.classList.remove("sf_promo-container-white-gradient","sf_promo-container-height-opacity");
  expand_btn.classList.add("hide");
}
  
function promoScrollToView(id) {
  var element = document.getElementById('sf_promo-'+id);
  if(element) element.scrollIntoView();
} 

function promo_checkbox_onChange(checkbox, product_id, promotion_id) {
  
  // Delay for IOS mobile
  setTimeout(function() {    
  if($("#sf_promo-"+promotion_id+" #sf_promo-product-"+product_id + " .sf_promo-prod-checkbox").is(':checked')){

      $("#sf_promo-"+promotion_id+" #sf_promo-product-"+product_id).addClass("is-selected");
      $("#sf_promo-"+promotion_id+" #sf_promo-product-"+product_id + " .sf_promo-variant_hidden_input").attr({'name':"promo_variant"});
      $("#sf_promo-"+promotion_id+" #sf_promo-product-"+product_id + " .sf_promo-quantity-selector").attr({'name':"promo_qty",'required':true});
    }else{

      $("#sf_promo-"+promotion_id+" #sf_promo-product-"+product_id).removeClass("is-selected");
      $("#sf_promo-"+promotion_id+" #sf_promo-product-"+product_id + " .sf_promo-variant_hidden_input").removeAttr('name');
      $("#sf_promo-"+promotion_id+" #sf_promo-product-"+product_id + " .sf_promo-quantity-selector").removeAttr('name required');
    }
  },150);

};
  
$("body").on("change", ".sf_promo-prod-checkbox", function(event){
  event.stopImmediatePropagation();
  promo_checkbox_onChange($(this),$(this).attr("data-product-id"),$(this).attr("data-promotion-id"))
});
  
$("body").on("change",".sf_promo-variant-select",function(event){
  event.stopImmediatePropagation();
  promoVariantDetailUpdate($(this))
  
});

function promoVariantDetailInitial(){
  $("body").find(".sf_promo-variant-select").each(function(){
    if(!$(this).attr('is-initial')){
      promoVariantDetailUpdate($(this),true)
      $(this).attr('is-initial',true)
    }
  })
}

function promoVariantDetailUpdate(el,initial = false){
  var this_variant_id = $('option:selected', el).val(),
      this_variant_price = $('option:selected', el).attr('data-price'),
      this_variant_compare_price = $('option:selected', el).attr('data-compare_at_price'),
      this_variant_img = $('option:selected', el).attr('data-varaint-img'),
      this_promotion_id = $('option:selected', el).attr('data-promotion-id'),
      this_product_id = $('option:selected', el).attr('data-product-id'),
      this_variant_inventory = $('option:selected', el).attr('data-quantity'),
      this_variant_available = $('option:selected', el).attr('data-available'),
      this_variant_img_url = 'https://s3.ap-southeast-1.amazonaws.com/eesb.public/images/products/no_image.png',
      primary_product = $(el).attr('data-primary-product') != undefined ? true : false;

  var allCookies = document.cookie.split(";"),
      cookies = {};
  for (var i=0; i<allCookies.length; i++){
    var pair = allCookies[i].split("=");
    cookies[(pair[0]+'').trim()] = unescape(pair[1]);
  }
  if (cookies['currency'] != undefined) selectedCurrency = cookies['currency']


  if(this_variant_img != null && this_variant_img != '' ) {
    this_variant_img_url = this_variant_img
    $("#sf_promo-"+this_promotion_id+" #sf_promo-product-"+this_product_id + " .sf_promo-product-image").attr('src',this_variant_img_url);
  }

  $("#sf_promo-"+this_promotion_id+" #sf_promo-product-"+this_product_id + " .sf_promo-variant_hidden_input").attr({'value':this_variant_id});
  
  $("body").find("#sf_promo-"+this_promotion_id+" #sf_promo-product-"+this_product_id + " .sf_promo-product-discounted-price").html(promoformatMoney(this_variant_price,shop_money_format) );
  $("body").find("#sf_promo-"+this_promotion_id+" #sf_promo-product-"+this_product_id + " .sf_promo-product-original-price").html(promoformatMoney(this_variant_compare_price,shop_money_format) );
  
  if(!initial) $("#sf_promo-"+this_promotion_id+" #sf_promo-product-"+this_product_id + " .sf_promo-prod-checkbox").prop('checked',true).change();
  
  sf_promoCheckInventory(this_product_id, this_variant_inventory, this_variant_available, this_variant_price, primary_product);

  if(window.Currency != undefined) Currency.convertAll(shopCurrency, selectedCurrency);
  if(window.EasyStore != undefined && window.EasyStore.Currencies != undefined) EasyStore.Currencies.convertAll()
  

}

function sf_promoCheckInventory(id, inventory, available, price, primary_product){
  // console.log("check inventory",id, inventory, available);
  if((available == false) || (price <= 0 && primary_product)){
    $("#sf_promo-product-"+id + " .sf_promo-prod-checkbox").prop('checked',false).change();
    $("#sf_promo-product-"+id + " .sf_promo-prod-checkbox").prop('disabled',true);
    $("#sf_promo-product-"+id + " .sf_promo-qty-adjust input").prop('disabled',true);
    $("#sf_promo-product-"+id + " .sf_promo-qty-adjust").addClass('hide');
    $("#sf_promo-product-"+id + " .entitled-label").addClass('hide');
    if(inventory == 0 || inventory != null || inventory != '') $("#sf_promo-product-"+id + " .sold-out-text").removeClass('hide');
  }
  else{
    $("#sf_promo-product-"+id + " .sf_promo-qty-adjust").removeClass('hide');
    $("#sf_promo-product-"+id + " .sold-out-text").addClass('hide');
    $("#sf_promo-product-"+id + " .sf_promo-qty-adjust input").prop('disabled',false);
    $("#sf_promo-product-"+id + " .sf_promo-prod-checkbox").prop('disabled',false);
  }

  if(inventory == null && inventory != 0){
    $("#sf_promo-product-"+id + " .sf_promo-qty-adjust input").prop('max','');
  }else if(available && inventory > 0){
    $("#sf_promo-product-"+id + " .sf_promo-qty-adjust input").prop('max',inventory);
  }
  
}

$("body").on("input change",".sf_promo-quantity-input",function(event){
  event.stopImmediatePropagation();

  $("#sf_promo-product-"+$(this).attr("data-product-id") + " .sf_promo-prod-checkbox").prop('checked',true).change();
});

$("body").on("submit", ".sf_promo-form", function(event){
    event.preventDefault();
    event.stopImmediatePropagation();
    var countCheckedCheckboxes = $(this).find('input.sf_promo-prod-checkbox').filter(':checked').length;
    
    if(countCheckedCheckboxes > 0){
      $(this).find('button[type=submit]').addClass('btn--loading')
      var form_template = $(this).attr('data-template')

      var id = $(this).find('input[name="promo_variant"]'),
          input_quantity =  $(this).find('input[name="promo_qty"]'),
          id_ar = [],
          qty_ar = []

      $.each(id, function( index, b ) {
          id_ar.push($(b).val())
      })

      $.each(input_quantity, function( index, b ) {
          qty_ar.push($(b).val())
      })

      let this_form = $(this)

      $.ajax({
        type: "POST",
        dataType: 'json',
        url: "/cart/add",
        data:{
            id: id_ar,
            quantity: qty_ar,
            _token: $('#app__product_promotionDialog-token').val(),
            promotion_id: $(this).attr("data-promotion-id"),
        },
        success: function(response){
          var cartCount = $('.cart-count')
          cartCount.text(response.item_count);
          $('.hidden-count').removeClass('hidden-count');

          if(window.theme != undefined && window.theme.fetchCartDrawer != undefined) theme.fetchCartDrawer()
          if(document.querySelector('cart-notification')) document.querySelector('cart-notification').renderContents(response)
          if(response.cart_content && document.querySelector('#cart-template')) document.querySelector('#cart-template').innerHTML = response.cart_content

          if (window.checkProductProperties !== undefined){
            window.checkProductProperties();
          }
          
        },
        error: function(xhr){
          console.log('error',xhr);
          var data = eval('(' + xhr.responseText + ')');
          var response = data.description;
        },
        complete: function(xhr){
          this_form.find('button[type=submit]').removeClass('btn--loading')
        }
      });
    }
});

promoformatMoney = function(t, e) {
  function n(t, e) {
      return "undefined" == typeof t ? e : t
  }

  function r(t, e, r, i) {
      if (e = n(e, 2), r = n(r, ","), i = n(i, "."), isNaN(t) || null == t) return 0;
      t = (t / 100).toFixed(e);
      var o = t.split("."),
          a = o[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + r),
          s = o[1] ? i + o[1] : "";
      return a + s
  }
  "string" == typeof t && (t = t.replace(".", "")) && (t = t.replace(",", ""));
  var i = "",
      o = /\{\{\s*(\w+)\s*\}\}/,
      a = e || this.money_format;
  switch (a.match(o)[1]) {
      case "amount":
          i = r(t, 2);
          break;
      case "amount_no_decimals":
          i = r(t, 0);
          break;
      case "amount_with_comma_separator":
          i = r(t, 2, ".", ",");
          break;
      case "amount_no_decimals_with_comma_separator":
          i = r(t, 0, ".", ",");
          break;
      case "amount_no_decimals_with_space_separator":
          i = r(t, 0, " ")
  }
  return a.replace(o, i)
}