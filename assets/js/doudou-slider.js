/* =================================================================== */
/* =========== START: SCRIPT FOR DOU DOU BAKE PRODUCT SLIDER =========== */
/* =================================================================== */

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
    )
  );
}

class SliderComponent extends HTMLElement {
  constructor() {
    super();
    this.slider = this.querySelector('ul');
    this.sliderItems = this.querySelectorAll('li');
    this.pageCount = this.querySelector('.slider-counter--current');
    this.pageTotal = this.querySelector('.slider-counter--total');
    this.prevButton = this.querySelector('button[name="previous"]');
    this.nextButton = this.querySelector('button[name="next"]');

    if (!this.slider || !this.nextButton) return;

    const resizeObserver = new ResizeObserver(entries => this.initPages());
    resizeObserver.observe(this.slider);

    this.slider.addEventListener('scroll', this.update.bind(this));
    this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
    this.nextButton.addEventListener('click', this.onButtonClick.bind(this));
  }

  initPages() {
    const sliderItemsToShow = Array.from(this.sliderItems).filter(element => element.clientWidth > 0);
    if (sliderItemsToShow.length === 0) return;
    
    this.sliderLastItem = sliderItemsToShow[sliderItemsToShow.length - 1];
    this.slidesPerPage = Math.floor(this.slider.clientWidth / sliderItemsToShow[0].clientWidth);
    this.totalPages = sliderItemsToShow.length - this.slidesPerPage + 1;
    this.update();
  }

  update() {
    if (!this.pageCount || !this.pageTotal) return;
    
    // A small delay to ensure scroll position is updated
    setTimeout(() => {
        const itemWidth = this.sliderItems[0].clientWidth;
        this.currentPage = Math.round(this.slider.scrollLeft / itemWidth) + 1;

        if (this.currentPage <= 1) {
            this.prevButton.setAttribute('disabled', 'true');
        } else {
            this.prevButton.removeAttribute('disabled');
        }

        if (this.currentPage >= this.totalPages) {
            this.nextButton.setAttribute('disabled', 'true');
        } else {
            this.nextButton.removeAttribute('disabled');
        }

        this.pageCount.textContent = this.currentPage;
        this.pageTotal.textContent = this.totalPages;
    }, 150);
  }

  onButtonClick(event) {
    event.preventDefault();
    const itemWidth = this.sliderItems[0].clientWidth;
    const scrollAmount = event.currentTarget.name === 'next' ? this.slider.scrollLeft + itemWidth : this.slider.scrollLeft - itemWidth;
    
    this.slider.scrollTo({
      left: scrollAmount,
      behavior: 'smooth'
    });
  }
}

customElements.define('slider-component', SliderComponent);


/* =================================================================== */
/* ============ END: SCRIPT FOR DOU DOU BAKE PRODUCT SLIDER ============ */
/* =================================================================== */