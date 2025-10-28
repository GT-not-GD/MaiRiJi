class EasyStoreEvents {

  constructor() {
    this.stack = {};
  }

  subscribe(event, callback) {

    if(!this.stack[event]) this.stack[event] = []
    this.stack[event].push(callback);

    console.log('EasyStore.Event.subscribe', event)
  }

  dispatch(event, data = {}) {

    // New
    if(event.includes('/')) {

      data = {
        store: {
          host: 'https://' + location.hostname,
        },
        ...data,
      }

    // Old
    } else {

      data = this.tempDataMapper(event, data)

    }

    console.log(event, data)

    if(this.stack[event]) {

      this.stack[event].forEach((subscriber) => {
        subscriber(data)
      });

      console.log('EasyStore.Event.dispatch', event, data)

    }

  }

  // Deprecating
  tempDataMapper(event, source) {

    switch (event) {
      case 'ProductView':
        var data = {
          product: {
            id: source.product.id,
            title: source.product.title,
            url: source.store.host + source.product.url,
            price: source.product.price,
            collections: source.product.collections.map(function (value, index) { return value.title }).join(', '),
            image_url: source.product.images[0].src,
          }
        }
        break;
      case 'CollectionView':
        var data = {
          collection: {
            id: source.collection.id,
            title: source.collection.title,
            url: source.store.host + '/collections/' + source.collection.handle,
          }
        }
        break;
      case 'PageView':
        var data = {
          page: {
            id: source.page.id,
            title: source.page.title,
            url: source.store.host + source.page.url,
          }
        }
        break;
      case 'ArticleView':
        var data = {
          article: {
            id: source.article.id,
            title: source.article.title,
            url: source.store.host + source.article.url,
          }
        }
        break;
      case 'Search':
        var data = {
          search: {
            term: source.search.terms,
            url: source.store.host + '/search?q=' + source.search.terms,
          }
        }
        break;
      case 'CartItemAdd':
        var data = {
          item: {
            product_id: source.item.product_id,
            product_title: source.item.product_name,
            variant_id: source.item.variant_id,
            variant_title: source.item.variant_name,
            collections: source.item.collections.split(',').join(', '),
            price: source.item.price,
            quantity: source.item.quantity,
            url: source.store.host + source.item.url,
            image_url: source.item.img_url,
          }
        }
        break;
      case 'CartItemRemove':
        var data = {
          item: {
            product_id: source.item.product_id,
            product_title: source.item.product_name,
            variant_id: source.item.variant_id,
            variant_title: source.item.variant_name,
            collections: source.item.collections.split(',').join(', '),
            price: source.item.price,
            quantity: source.item.quantity,
            url: source.store.host + source.item.url,
            image_url: source.item.img_url,
          }
        }
        break;
      case 'CouponAdd':

        var data = {

          coupon: {

            code: source.coupon.code

          }

        }
        break;
      case 'CheckoutInitial':

        var data = {

          checkout: {

            item_count: source.checkout.item_count

          }

        }
        break;
      case 'DeliveryAddressAdd':

        var data = {

          delivery: {

            method: source.delivery.method,
            name: source.delivery.method == 'shipping' ? null : source.delivery.address.name,
            first_name: source.delivery.address.first_name,
            last_name: source.delivery.address.last_name,
            country: source.delivery.address.country,
            province: source.delivery.address.province,
            city: source.delivery.address.city,

          }

        }

        break;
      case 'CheckoutCompleted':

        var items = []

        source.order.order_item.forEach(item => {

          items.push({

            order_number: source.order.order_number,
            product_id: item.product_id,
            product_title: item.product_name,
            variant_id: item.variant_id,
            variant_title: item.variant_name,
            collections: item.collections.split(',').join(', '),
            price: item.price,
            quantity: item.quantity,
            url: source.store.host + "/products/" + item.handle,
            image_url: item.item_image.url,

          })

        });

        var data = {

          order: {

            number: source.order.order_number,
            item_count: source.order.order_item.length,
            total_amount: source.order.total_amount_include_transaction,
            transaction: source.order.transaction_records[0],
            delivery_address: source.order.shipping_address,
            items: items

          }

        }

        if (source.order.pickup_location != null) {

          data.order.delivery_address = source.order.pickup_location;

        }


        break;

      default:
        var data = null;
    }

    return data;
  }

}

class EasyStoreSuperClass {

  constructor() {
    this.Event = new EasyStoreEvents();
  }

}

window.EasyStore = new EasyStoreSuperClass();


// Minify to storefront.min.js using https://jscompress.com/
