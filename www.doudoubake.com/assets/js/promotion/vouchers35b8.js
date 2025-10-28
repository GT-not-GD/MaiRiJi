document.addEventListener('DOMContentLoaded', () => {
  class VouchersModal extends HTMLElement {
    constructor() {
      super();
      this.voucherModal = document.getElementById('vouchers-modal');
      this.voucherModalBackdrop = document.getElementById('vouchers-modal-backdrop');
      this.onBodyClick = this.handleBodyClick.bind(this);
      
      this.voucherModal.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
      this.querySelectorAll('.vouchers-modal__close').forEach((closeButton) =>
        closeButton.addEventListener('click', this.close.bind(this))
      );

      this.eventHandlers = []; // Store event handlers to remove them later
    }
  
    open() {
      this.voucherModal.classList.add('animate', 'active');
      this.voucherModalBackdrop.classList.add('active');
  
      this.voucherModal.addEventListener('transitionend', () => {
        this.voucherModal.focus();
        trapFocus(this.voucherModal);
      }, { once: true });
      
      document.body.style.overflow = 'hidden';
      document.body.addEventListener('click', this.onBodyClick, {capture: true});

      // Render voucher placeholders
      this.initVoucherWidget();
    }
  
    close() {
      this.voucherModal.classList.remove('active');
      this.voucherModalBackdrop.classList.remove('active');
  
      document.body.style.overflow = '';
      document.body.removeEventListener('click', this.onBodyClick, {capture: true});

      // Clear voucher placeholders
      const $voucherElements = document.querySelectorAll("[data-voucher-widget]");
      $voucherElements.forEach(element => element.innerHTML = "");

      // Remove all event listeners attached to buttons
      this.eventHandlers.forEach(({ button, handler }) => {
        button.removeEventListener("click", handler);
      });

      // Clear stored event handlers
      this.eventHandlers = []; 
    }
  
    handleBodyClick(evt) {
      const target = evt.target;
      if (target !== this.voucherModal && !target.closest('vouchers-modal')) {
        this.close();
      }
    }
  
    setActiveElement(element) {
      this.activeElement = element;
    }

    // Function to process all voucher placeholders with [data-voucher-widget]
    initVoucherWidget() {
      const $voucherElements = $("[data-voucher-widget]");

      $voucherElements.each((index, element) => {
        const voucherData = JSON.parse(element.getAttribute("data-voucher-widget"));
        const voucherWidget = createVoucherWidget(this.formatVoucherData(voucherData));

        element.setAttribute("data-type", voucherData.is_enabled ? "active" : "inactive");
        if (!voucherData.is_enabled) {
          element.classList.add("disabled");
        }

        element.appendChild(voucherWidget);

        // Add event listener to button
        setTimeout(() => {
          const button = element.querySelector(".voucher-widget-button");
          if (button) {
            const clickHandler = (event) => {
              this.onButtonClick(event, voucherData);
            };
            button.addEventListener("click", clickHandler);
            // Store reference for removal later
            this.eventHandlers.push({ button, handler: clickHandler });
          }
        }, 1000);
      });
    }

    formatVoucherData(data) {
      this.voucherData = {
        title: data.title,
        details: data,
      }
      return {
        "discount": data.title,
        "isShowQuantity": true,
        "isHoverable": false,
        "condition": getVoucherCondition(this.voucherData),
        "badge": getPrerequisiteCondition(this.voucherData, _getPrerequisiteConditionTranslation),
        "expiry": data.is_enabled ? " " : _getVoucherErrorTranslation.condition_not_matched,
        "highlightExpiry": {
          "isHighlightExpiry": data.is_enabled ? false : true,
          "highlightType": "danger",
        },
        "buttonText": _getVoucherButtonTextTranslation.apply,
        "quantity": data.discount_codes_count || 1,
        "isShowButton": data.is_enabled,
        "icon": getVoucherIcon(this.voucherData),
      };
    }

    onButtonClick(event, data) {
      event.preventDefault();

      let code = data?.soonest_expiring_discount_code 
          ?? data.discount_codes[0] 
          ?? "";
      this.hideErrorMsg();

      const allVouchers = document.querySelectorAll("[data-voucher-widget]");
      const button = event.currentTarget;
      
      if(code && button){
        allVouchers.forEach(voucher => voucher.style.pointerEvents = "none");
        button.classList.add('loading')
        fetch('/new_cart/voucher', {
          method: 'POST',
          headers: {"Content-Type": "application/json","X-Requested-With": "XMLHttpRequest",},
          body: JSON.stringify({
            category : 'create',
            voucher_code : code
          }),
        })
        .then(response => response.json())
        .then((data) => {
          console.log('/new_cart/voucher',data);
          button.classList.remove('loading');
          allVouchers.forEach(voucher => voucher.style.removeProperty("pointer-events"));
      
          if(data.error && data.error.message) this.renderErrorMsg(data.error.message)
          if(data.cart_content) {
            document.querySelector('#cart-template , #CartTemplate').innerHTML = data.cart_content;
            document.querySelector('vouchers-modal').close()
          }
        })
      }

    }

    renderErrorMsg(html){
      this.querySelector('.form__message').classList.remove('hidden')
      this.querySelector('.js-error-content').innerHTML = html
    }
  
    hideErrorMsg(){
      this.querySelector('.form__message').classList.add('hidden')
    }
  }
  customElements.define('vouchers-modal', VouchersModal);

  // TODO: To be removed
  class VouchersList extends HTMLElement {
    constructor() {
      super();
      this.radioButtons = this.querySelectorAll('input[name="voucher_code"]');
      this.button = this.querySelector('button');
  
      this.button.addEventListener('click', this.onButtonClick.bind(this))
      this.radioButtons.forEach(radioButton => radioButton.addEventListener('change', (event)=>{
        this.hideErrorMsg()
      }))
    }
  
    onButtonClick(event) {
      event.preventDefault();
      this.hideErrorMsg();
      let radioValue
      for (const radioButton of this.radioButtons) {
        if (radioButton.checked) {
          radioValue = radioButton.value;
          break;
        }
      }

      if(radioValue){
        this.button.classList.add('loading','btn--loading')
        fetch('/new_cart/voucher', {
          method: 'POST',
          headers: {"Content-Type": "application/json","X-Requested-With": "XMLHttpRequest",},
          body: JSON.stringify({
            category : 'create',
            voucher_code : radioValue
          }),
        })
        .then(response => response.json())
        .then((data) => {
          console.log('/new_cart/voucher',data);
          this.button.classList.remove('loading','btn--loading')
          if(data.error && data.error.message) this.renderErrorMsg(data.error.message)
          if(data.cart_content) {
            document.querySelector('#cart-template , #CartTemplate').innerHTML = data.cart_content;
            document.querySelector('vouchers-modal').close()
          }
        })
      }

    }
  
    renderErrorMsg(html){
      this.querySelector('.form__message').classList.remove('hidden')
      this.querySelector('.js-error-content').innerHTML = html
    }
  
    hideErrorMsg(){
      this.querySelector('.form__message').classList.add('hidden')
    }
  
    clearSelection(){
      for (let radioButton of this.radioButtons) {
        if (radioButton.checked) {
          radioButton.checked = false;
          break;
        }
      }
    }
  }
  customElements.define('vouchers-list', VouchersList);

  
  if(typeof DiscountInput == "undefined"){
    class DiscountInput extends HTMLElement {
      constructor() {
        super();
        this.input = this.querySelector('input');
        this.button = this.querySelector('button');
    
        this.button.addEventListener('click', this.onButtonClick.bind(this))
        this.input.addEventListener('keypress', (event)=>{
          if (event.key == 'Enter' || event.keyCode == 13){
            event.preventDefault()
            this.onButtonClick(event)
          }
          this.hideErrorMsg()
        })
      }
    
      onButtonClick(event) {
        event.preventDefault();
        this.hideErrorMsg();
    
        if(this.input.value != ''){
          this.button.classList.add('loading','btn--loading')
          fetch('/new_cart/voucher', {
            method: 'POST',
            headers: {'Content-Type': 'application/json','X-Requested-With': 'XMLHttpRequest',},
            body: JSON.stringify({
              category : 'create',
              voucher_code : this.input.value
            }),
          })
          .then(response => response.json())
          .then((data) => {
            this.button.classList.remove('loading','btn--loading')
            if(data.error && data.error.message) this.renderErrorMsg(data.error.message)
            if(data.cart_content) {
              document.querySelector('#cart-template , #CartTemplate').innerHTML = data.cart_content;
              document.querySelector('vouchers-modal').close()
            }
          })
        }
      }
    
      renderErrorMsg(html){
        this.querySelector('.form__message').classList.remove('hidden')
        this.querySelector('.js-error-content').innerHTML = html
      }
    
      hideErrorMsg(){
        this.querySelector('.form__message').classList.add('hidden')
      }
    }
    customElements.define('discount-input', DiscountInput);
  }


})

