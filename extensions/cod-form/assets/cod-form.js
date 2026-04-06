/**
 * COD Order Form — handles popup, validation, submission, quantity offers,
 * discount codes, and multi-pixel tracking.
 * Reads config from its own <script> tag data attributes.
 * Uses event delegation for bulletproof click handling.
 */
(function () {
  'use strict';

  /* ── Config from script tag ── */
  var script = document.querySelector('script[data-cod-api-url]');
  if (!script) return;

  var COD_API = script.getAttribute('data-cod-api-url') || '';
  var COD_KEY = script.getAttribute('data-cod-api-key') || '';
  var SHOP = (typeof Shopify !== 'undefined' && Shopify.shop) ? Shopify.shop : (script.getAttribute('data-shop') || '');
  var STORE_ID = SHOP; // alias for backwards compatibility
  var CURRENCY = script.getAttribute('data-currency') || 'RON';
  var _isGreek = CURRENCY === 'EUR' && SHOP.indexOf('jgj1ff') === 0;
  var _lang = _isGreek ? 'el' : 'ro';
  var _phonePattern = _isGreek ? /^69\d{8}$/ : /^0\d{9}$/;
  var currentProductId = parseInt(script.getAttribute('data-product-id'), 10) || 0;
  var currentVariantId = parseInt(script.getAttribute('data-variant-id'), 10) || 0;
  var unitPrice = parseFloat(script.getAttribute('data-unit-price')) || 0;
  var comparePrice = parseFloat(script.getAttribute('data-compare-price')) || 0;
  var shippingPrice = parseFloat(script.getAttribute('data-shipping-price')) || 0;
  // GADS_CONVERSION_ID removed — conversion tracking handled by WeTracked
  var quantity = 1;
  var IS_PROXY = COD_API.indexOf('/apps/') === 0;

  /* ── Offers & discount state ── */
  var offers = [];
  var activeOffer = null;
  var discountCode = '';
  var discountType = '';
  var discountValue = 0;
  var discountApplied = false;

  /* ── Order bump state ── */
  var availableBumps = [];
  var acceptedBumpIds = [];

  /* ── Downsell state ── */
  var downsellConfig = null;
  var downsellShown = false;
  var orderPlaced = false;
  var formCloseCount = 0;

  /* ── Locale labels (populated from form-config, Romanian defaults) ── */
  var L = {
    cod_fee: 'Taxă ramburs',
    quantity_unit: 'buc',
    regular_price: 'Preț întreg',
    free_shipping: 'Transport gratuit',
    variant_label: 'Varianta',
    required_field: 'Câmp obligatoriu',
    connection_error: 'Eroare de conexiune. Încearcă din nou.',
    order_prefix: 'Comanda',
    retry: 'Încearcă din nou',
    otp_title: 'Verificare telefon',
    otp_desc: 'Am trimis un cod de verificare pe WhatsApp.',
    otp_verify: 'Verifică codul',
    otp_resend: 'Retrimite',
    otp_verifying: 'Se verifică...',
    otp_sending: 'Se trimite...',
    otp_resent: 'Cod retrimis!',
    otp_error: 'Nu am putut trimite codul de verificare.',
    online_payment: '💳 Plată cu cardul',
    bumps_heading: 'Adaugă la comandă',
    discount_prefix: 'Cod',
    discount_invalid: 'Cod invalid',
    discount_check_error: 'Eroare la verificare',
    upsell_loading: 'Se încarcă...',
    upsell_creating: 'Se creează comanda...',
    upsell_offer_prefix: 'Ai văzut și',
    upsell_available_only: 'Ofertă disponibilă doar',
    upsell_gift_discount: 'Reducere Cadou Pentru Tine',
    upsell_added: '✓ Adăugat',
    upsell_no_thanks: 'Nu, mulțumesc, finalizați comanda',
    success_title: 'Comanda a fost plasată cu succes!',
    success_text: 'Te vom contacta în curând.',
    close: 'Închide',
    processing: 'Se procesează...',
    submit: 'Plasează comanda',
    submit_subtitle: 'PLATA LA LIVRARE',
    subtotal: 'Subtotal',
    shipping: 'Transport',
    discount: 'Reducere',
    total: 'Total',
    select_placeholder: 'Selectează...',
    apply: 'Aplică',
    enter_code: 'Introdu codul',
    have_discount: 'Ai un cod de reducere?',
    downsell_apply: 'Aplică reducerea',
    sticky_cta: 'Comandă acum',
    sticky_cta_long: 'Comandă acum — Plata la livrare',
    accept_offer: 'Acceptă Oferta',
    reject_offer: 'Nu, mulțumesc',
    phone_error: 'Format: 07XX XXX XXX (10 cifre)',
    free_shipping_remaining: 'Mai ai nevoie de {amount} pentru livrare GRATUITĂ!',
    free_shipping_reached: 'Felicitări! Beneficiezi de livrare GRATUITĂ! 🎉',
  };

  /* ── Multi-product cart (sessionStorage) ── */
  var COD_CART_KEY = 'cod_cart_' + SHOP;
  var COD_CART_MAX = 10;

  var codCart = {
    _load: function () {
      try { return JSON.parse(sessionStorage.getItem(COD_CART_KEY) || '[]'); } catch (e) { return []; }
    },
    _save: function (items) {
      sessionStorage.setItem(COD_CART_KEY, JSON.stringify(items));
    },
    getAll: function () { return this._load(); },
    count: function () { return this._load().reduce(function (s, i) { return s + (i.quantity || 1); }, 0); },
    itemCount: function () { return this._load().length; },
    add: function (item) {
      var items = this._load();
      // Check if same variant already in cart
      for (var i = 0; i < items.length; i++) {
        if (items[i].variant_id === item.variant_id) {
          items[i].quantity = (items[i].quantity || 1) + (item.quantity || 1);
          if (item.title && !items[i].title) items[i].title = item.title;
          if (item.image_url && !items[i].image_url) items[i].image_url = item.image_url;
          if (item.price) items[i].price = item.price;
          if (item.compare_at_price) items[i].compare_at_price = item.compare_at_price;
          this._save(items);
          return items;
        }
      }
      if (items.length >= COD_CART_MAX) return items; // max reached
      items.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        title: item.title,
        variant_title: item.variant_title || '',
        price: item.price,
        compare_at_price: item.compare_at_price || 0,
        image_url: item.image_url || '',
        quantity: item.quantity || 1,
        has_quantity_offer: false
      });
      this._save(items);
      return items;
    },
    remove: function (variantId) {
      var items = this._load().filter(function (i) { return i.variant_id !== variantId; });
      this._save(items);
      return items;
    },
    updateQty: function (variantId, qty) {
      var items = this._load();
      for (var i = 0; i < items.length; i++) {
        if (items[i].variant_id === variantId) {
          items[i].quantity = Math.max(1, Math.min(qty, 10));
          break;
        }
      }
      this._save(items);
      return items;
    },
    subtotal: function () {
      return this._load().reduce(function (s, i) { return s + (i.price * (i.quantity || 1)); }, 0);
    },
    clear: function () { sessionStorage.removeItem(COD_CART_KEY); },
    has: function (variantId) {
      return this._load().some(function (i) { return i.variant_id === variantId; });
    }
  };

  /* ── COD fee state ── */
  var codFee = 0;
  var codFeeLabel = L.cod_fee;

  /* ── Shipping rates state ── */
  var shippingRates = [];
  var shippingRatesFetched = false;

  /* ── Variant state (for multi-variant offers) ── */
  var productVariants = [];
  var variantOptionName = '';
  var selectedVariants = [currentVariantId];
  try {
    var _vd = script.getAttribute('data-variants');
    if (_vd) {
      var _parsed = JSON.parse(_vd);
      for (var _vi = 0; _vi < _parsed.length; _vi++) {
        productVariants.push({
          id: _parsed[_vi].id,
          title: _parsed[_vi].t,
          price: _parsed[_vi].p,
          compare_at_price: _parsed[_vi].cp || 0,
          image_url: _parsed[_vi].img || '',
          available: _parsed[_vi].ok !== false
        });
      }
    }
  } catch (_e) { /* ignore parse errors */ }
  variantOptionName = script.getAttribute('data-variant-option-name') || '';

  /* ── OTP verification state ── */
  var otpEnabled = false;
  var otpVerified = false;
  var otpPhone = '';

  /* ── Deferred order state (order created after upsell decision) ── */
  var pendingPayload = null;
  var pendingUpsellValue = 0;
  var otpSending = false;

  /* ── Form config state (fetched from /api/cod/form-config) ── */
  var formConfig = null;

  /* ── Lazy DOM helpers (look up every time — handles dynamic rendering) ── */
  function $(id) { return document.getElementById(id); }

  /* ── UTM params ── */
  var _utmParams = (function () {
    var p = new URLSearchParams(window.location.search);
    return {
      utm_source: p.get('utm_source') || '',
      utm_medium: p.get('utm_medium') || '',
      utm_campaign: p.get('utm_campaign') || ''
    };
  })();

  /* ── Event tracking ── */
  function trackEvent(eventType, extra) {
    if (!COD_API || !STORE_ID) return;
    var body = {
      event: eventType,
      shop: SHOP,
      product_id: currentProductId,
      variant_id: currentVariantId,
      utm_source: _utmParams.utm_source,
      utm_medium: _utmParams.utm_medium,
      utm_campaign: _utmParams.utm_campaign
    };
    if (extra) { for (var k in extra) body[k] = extra[k]; }
    try {
      var headers = { 'Content-Type': 'application/json' };
      if (COD_KEY && !IS_PROXY) headers['X-COD-Key'] = COD_KEY;
      fetch(COD_API + '/api/cod/events', {
        method: 'POST', headers: headers,
        body: JSON.stringify(body),
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* ignore */ }
  }

  /* ── Helpers ── */
  function formatMoney(amount) {
    var formatted = amount.toFixed(2).replace('.', ',');
    if (CURRENCY === 'RON') return formatted + ' lei';
    if (CURRENCY === 'EUR') return '€' + formatted;
    return formatted + ' ' + CURRENCY;
  }

  function getDiscountAmount() {
    var offerDiscount = 0;
    var codeDiscount = 0;
    var subtotal = unitPrice * quantity;

    if (activeOffer) {
      var adt = activeOffer.discount_type || 'percentage';
      if (adt === 'fixed') {
        offerDiscount = Math.min((activeOffer.discount_fixed || 0) * quantity, subtotal);
      } else if (adt === 'percentage') {
        offerDiscount = subtotal * ((activeOffer.discount_percent || 0) / 100);
      }
    }
    if (discountApplied) {
      if (discountType === 'percentage') {
        codeDiscount = subtotal * (discountValue / 100);
      } else if (discountType === 'fixed_amount') {
        codeDiscount = Math.min(discountValue, subtotal);
      }
    }

    // Auto-discount for specific products (from store config)
    var autoDiscount = 0;
    var autoLabel = '';
    if (formConfig && formConfig.auto_discounts) {
      for (var ai = 0; ai < formConfig.auto_discounts.length; ai++) {
        var ad = formConfig.auto_discounts[ai];
        if (ad.product_id === currentProductId) {
          autoDiscount = (ad.discount_amount || 0) * quantity;
          autoLabel = ad.label || '';
          break;
        }
      }
    }

    var bestDiscount = Math.max(offerDiscount, codeDiscount);
    var totalDiscount = bestDiscount + autoDiscount;
    if (totalDiscount > 0) {
      var source = autoDiscount > 0 && bestDiscount === 0 ? 'auto' : (offerDiscount >= codeDiscount ? 'offer' : 'code');
      var label = autoLabel || (offerDiscount >= codeDiscount ? (activeOffer ? activeOffer.label : '') : discountCode);
      return { amount: totalDiscount, source: source, label: label };
    }
    if (offerDiscount >= codeDiscount) {
      return { amount: offerDiscount, source: 'offer', label: activeOffer ? activeOffer.label : '' };
    }
    return { amount: codeDiscount, source: 'code', label: discountCode };
  }


  /* ── Auto-detect theme price colors ── */
  function detectThemePriceColors() {
    var codPrice = $('cod-unit-price');
    var codCompare = $('cod-compare-price');
    // Look for the theme's product price elements on the page
    var themeCurrent = document.querySelector('.product-info__price-current');
    var themeCompare = document.querySelector('.product-info__price-compare');
    if (themeCurrent && codPrice) {
      var cs = window.getComputedStyle(themeCurrent);
      codPrice.style.color = cs.color;
      codPrice.style.fontWeight = cs.fontWeight;
    }
    if (themeCompare && codCompare) {
      var cs2 = window.getComputedStyle(themeCompare);
      codCompare.style.color = cs2.color;
      codCompare.style.fontWeight = cs2.fontWeight;
      codCompare.style.textDecoration = cs2.textDecoration || cs2.textDecorationLine || 'line-through';
    }
  }

  function updateComparePrice() {
    var el = $('cod-compare-price');
    if (!el) return;
    if (comparePrice > 0 && comparePrice > unitPrice) {
      el.textContent = formatMoney(comparePrice);
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
  }

  function updateTotals() {
    // Calculate subtotal: current product (offer-aware) + other cart items
    var cartItems = codCart.getAll();
    var subtotal;
    if (cartItems.length > 0) {
      subtotal = 0;
      for (var ci = 0; ci < cartItems.length; ci++) {
        if (cartItems[ci].product_id === currentProductId) {
          // Use offer quantity for current product
          subtotal += unitPrice * quantity;
        } else {
          subtotal += cartItems[ci].price * (cartItems[ci].quantity || 1);
        }
      }
    } else {
      subtotal = unitPrice * quantity;
    }
    var el;

    el = $('cod-subtotal');
    if (el) el.textContent = formatMoney(subtotal);

    el = $('cod-qty');
    if (el) el.value = quantity;

    // Update active offer
    activeOffer = null;
    for (var i = 0; i < offers.length; i++) {
      if (quantity >= offers[i].min_qty) {
        if (!activeOffer || offers[i].min_qty > activeOffer.min_qty) {
          activeOffer = offers[i];
        }
      }
    }

    // Highlight active offer in UI
    var container = $('cod-offers');
    var offerEls = container ? container.querySelectorAll('.cod-form__offer') : [];
    for (var j = 0; j < offerEls.length; j++) {
      var minQty = parseInt(offerEls[j].getAttribute('data-min-qty'), 10);
      offerEls[j].classList.toggle('cod-form__offer--active', activeOffer && minQty === activeOffer.min_qty);
    }

    // Calculate discount
    var disc = getDiscountAmount();
    var discLine = $('cod-discount-line');
    if (disc.amount > 0) {
      if (discLine) discLine.hidden = false;
      el = $('cod-discount-amount');
      if (el) el.textContent = '-' + formatMoney(disc.amount);
      el = $('cod-discount-label');
      if (el) el.textContent = disc.source === 'offer' ? disc.label : (L.discount_prefix + ': ' + disc.label);
    } else {
      if (discLine) discLine.hidden = true;
      el = $('cod-discount-amount');
      if (el) el.textContent = '';
      el = $('cod-discount-label');
      if (el) el.textContent = '';
    }

    var bumpTotal = getBumpTotal();

    // Update shipping display
    var shippingEl = $('cod-shipping');
    if (shippingEl) {
      if (shippingPrice === 0) {
        shippingEl.textContent = L.free_shipping;
        shippingEl.style.color = '#2E7D32';
        shippingEl.style.fontWeight = '600';
      } else {
        shippingEl.textContent = formatMoney(shippingPrice);
        shippingEl.style.color = '';
        shippingEl.style.fontWeight = '';
      }
    }

    var total = subtotal - disc.amount + shippingPrice + bumpTotal + codFee;
    el = $('cod-total');
    if (el) el.textContent = formatMoney(Math.max(0, total));

    // Show/hide bump total line
    var bumpLine = $('cod-bump-line');
    if (bumpLine) {
      if (bumpTotal > 0) {
        bumpLine.hidden = false;
        var bumpEl = $('cod-bump-amount');
        if (bumpEl) bumpEl.textContent = formatMoney(bumpTotal);
      } else {
        bumpLine.hidden = true;
      }
    }

    // Show/hide COD fee line
    var feeLine = $('cod-fee-line');
    if (feeLine) {
      if (codFee > 0) {
        feeLine.hidden = false;
        var feeAmtEl = $('cod-fee-amount');
        if (feeAmtEl) feeAmtEl.textContent = formatMoney(codFee);
        var feeLblEl = $('cod-fee-label');
        if (feeLblEl) feeLblEl.textContent = codFeeLabel;
      } else {
        feeLine.hidden = true;
      }
    }

    updateFreeShippingBar(subtotal - disc.amount + bumpTotal);
  }

  function updateFreeShippingBar(subtotal) {
    var bar = $('cod-free-shipping-bar');
    if (!bar) return;
    var threshold = formConfig && formConfig.shipping && formConfig.shipping.free_threshold;
    if (!threshold || threshold <= 0) { bar.hidden = true; return; }
    var remaining = threshold - subtotal;
    var progress = Math.min(100, Math.round((subtotal / threshold) * 100));
    var pct = remaining > 0 ? progress : 100;
    var truck = '<span class="cod-free-shipping-bar__truck" style="left:' + pct + '%"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></span>';
    bar.className = remaining > 0 ? 'cod-free-shipping-bar' : 'cod-free-shipping-bar cod-free-shipping-bar--reached';
    bar.innerHTML = '<div class="cod-free-shipping-bar__text">'
      + (remaining > 0
        ? (L.free_shipping_remaining || '').replace('{amount}', '<strong>' + formatMoney(remaining) + '</strong>')
        : (L.free_shipping_reached || ''))
      + '</div>'
      + '<div class="cod-free-shipping-bar__track"><div class="cod-free-shipping-bar__fill cod-free-shipping-bar__fill--animated" style="width:' + pct + '%"></div>' + truck + '</div>';
    // Apply stripe gradient + all critical styles via JS (theme-proof)
    var pc = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#b5a1e0';
    var fill = bar.querySelector('.cod-free-shipping-bar__fill');
    if (fill) {
      fill.style.cssText = 'width:' + pct + '%;height:12px;min-height:12px;border-radius:6px;display:block;'
        + 'background-image:repeating-linear-gradient(-45deg,' + pc + ' 0,' + pc + ' 5px,' + pc + '66 5px,' + pc + '66 10px);'
        + 'background-size:14.14px 14.14px;transition:width 0.5s ease;';
    }
    bar.hidden = false;
  }

  function clearErrors() {
    var form = $('cod-order-form');
    if (!form) return;
    var errs = form.querySelectorAll('.cod-form__error');
    for (var i = 0; i < errs.length; i++) errs[i].textContent = '';
    var errorBox = $('cod-error-box');
    if (errorBox) errorBox.hidden = true;
  }

  function showFieldError(field, msg) {
    var form = $('cod-order-form');
    if (!form) return;
    var el = form.querySelector('[data-error="' + field + '"]');
    if (el) el.textContent = msg;
  }

  /* ── Offers rendering ── */
  function getOffersStyle() {
    return (formConfig && formConfig.offers_style) || {};
  }

  function offerPerUnit(o, up) {
    var dt = o.discount_type || 'percentage';
    if (dt === 'fixed') return Math.max(0, up - (o.discount_fixed || 0));
    if (dt === 'percentage' && o.discount_percent > 0) return up * (1 - o.discount_percent / 100);
    return up;
  }

  function offerBadgeText(o) {
    if (o.tag) return o.tag;
    var dt = o.discount_type || 'percentage';
    if (dt === 'fixed' && (o.discount_fixed || 0) > 0) return '-' + o.discount_fixed + ' RON';
    if (dt === 'percentage' && (o.discount_percent || 0) > 0) return '-' + o.discount_percent + '%';
    return '';
  }

  function offerTitle(o) {
    return o.title || (o.min_qty + ' ' + L.quantity_unit);
  }

  function offerTagBg(o, isActive, os) {
    if (o.tag_bg) return o.tag_bg;
    return isActive ? (os.tag_bg || '#C62828') : (os.inactive_tag_bg || os.tag_bg || '#C62828');
  }

  function offerHasDiscount(o) {
    var dt = o.discount_type || 'percentage';
    if (dt === 'none') return false;
    if (dt === 'fixed') return (o.discount_fixed || 0) > 0;
    return (o.discount_percent || 0) > 0;
  }

  function renderOffers() {
    var container = $('cod-offers');
    if (!container || offers.length === 0) return;
    // Suppress badge rendering when form offers are active
    if ($('cod-form-offers')) { container.hidden = true; return; }
    container.hidden = false;
    var os = getOffersStyle();
    var html = '';
    for (var i = 0; i < offers.length; i++) {
      var o = offers[i];
      var oBadge = offerBadgeText(o);
      if (!oBadge && !o.label) continue;
      html += '<div class="cod-form__offer" data-min-qty="' + o.min_qty + '">'
        + (oBadge ? '<span class="cod-form__offer-badge" style="background:' + (os.tag_bg || '#C62828') + ';color:' + (os.tag_text_color || '#fff') + '">' + oBadge + '</span>' : '')
        + '<span>' + o.label + '</span>'
        + '</div>';
    }
    container.innerHTML = html;
  }

  function renderPageOffers() {
    var container = $('cod-page-offers');
    if (!container || offers.length === 0) return;
    container.hidden = false;
    var os = getOffersStyle();
    var tpl = os.template || 'classic';
    var rad = os.border_radius || '8px';
    var activeBg = os.active_bg || '#FFF8F8';
    var activeBd = os.active_border || '#C62828';
    var inactiveBg = os.inactive_bg || '#ffffff';
    var inactiveBd = os.inactive_border || '#e0e0e0';
    var tagColor = os.tag_text_color || '#fff';
    var tagSize = os.tag_text_size || '12px';
    var tagBold = os.tag_bold !== false ? '700' : '400';
    var tagItalic = os.tag_italic ? 'italic' : 'normal';
    var labelBg = os.label_bg || '#2E7D32';
    var labelColor = os.label_text_color || '#fff';
    var labelSize = os.label_text_size || '11px';
    var labelBold = os.label_bold !== false ? '700' : '400';
    var labelItalic = os.label_italic ? 'italic' : 'normal';
    var titleColor = os.title_color || '#333';
    var titleSize = os.title_size || '14px';
    var titleBold = os.title_bold !== false ? '700' : '400';
    var titleItalic = os.title_italic ? 'italic' : 'normal';
    var priceColor = os.price_color || '#C62828';
    var priceSize = os.price_size || '14px';
    var priceBold = os.price_bold !== false ? '700' : '400';
    var priceItalic = os.price_italic ? 'italic' : 'normal';

    var prodImgEl = document.querySelector('[data-gallery-main] img, .product-gallery__main img');
    var defaultImg = prodImgEl ? prodImgEl.getAttribute('src') : '';
    var allOffers = [{ min_qty: 1, title: '', discount_type: 'none', discount_percent: 0, discount_fixed: 0, tag: '', tag_bg: '', label: '', image_url: defaultImg }].concat(offers);

    // Handle preselect: find first preselected tier
    var preselectedQty = 0;
    for (var p = 0; p < offers.length; p++) {
      if (offers[p].preselect) { preselectedQty = offers[p].min_qty; break; }
    }

    // Determine active: preselect overrides default
    function isOfferActive(o) {
      if (preselectedQty > 0) return o.min_qty === preselectedQty;
      return (o.min_qty === 1 && quantity === 1 && !activeOffer) || (o.min_qty > 1 && quantity === o.min_qty);
    }

    if (tpl === 'classic') {
      container.className = 'cod-page-offers cod-page-offers--classic';
      var html = '';
      for (var i = 0; i < allOffers.length; i++) {
        var o = allOffers[i];
        var isAct = isOfferActive(o);
        var bg = isAct ? activeBg : inactiveBg;
        var bd = isAct ? activeBd : inactiveBd;
        var perUnit = offerPerUnit(o, unitPrice);
        var badge = offerBadgeText(o);
        var tBg = offerTagBg(o, isAct, os);
        html += '<div class="cod-page-offer" data-offer-qty="' + o.min_qty + '" style="border:2px solid ' + bd + ';background:' + bg + ';border-radius:' + rad + '">';
        if (badge) {
          html += '<div class="cod-page-offer__badge" style="background:' + tBg + ';color:' + tagColor + ';font-size:' + tagSize + ';font-weight:' + tagBold + ';font-style:' + tagItalic + '">' + badge + '</div>';
        }
        if (o.label) {
          html += '<div class="cod-page-offer__label" style="background:' + labelBg + ';color:' + labelColor + ';font-size:' + labelSize + ';font-weight:' + labelBold + ';font-style:' + labelItalic + '">' + o.label + '</div>';
        }
        if (o.image_url) {
          html += '<img src="' + o.image_url + '" alt="" style="width:60px;height:60px;border-radius:6px;object-fit:cover;margin-bottom:4px">';
        }
        html += '<div class="cod-page-offer__qty" style="color:' + titleColor + ';font-size:' + titleSize + ';font-weight:' + titleBold + ';font-style:' + titleItalic + '">' + offerTitle(o) + '</div>';
        html += '<div class="cod-page-offer__price" style="color:' + priceColor + ';font-size:' + priceSize + ';font-weight:' + priceBold + ';font-style:' + priceItalic + '">' + formatMoney(perUnit) + (o.min_qty > 1 ? (('/' + L.quantity_unit)) : '') + '</div>';
        if (o.min_qty === 1 && !offerHasDiscount(o)) {
          html += '<div class="cod-page-offer__tag">' + L.regular_price + '</div>';
        } else if (o.min_qty > 1) {
          html += '<div class="cod-page-offer__total">' + formatMoney(perUnit * o.min_qty) + ' total' + '</div>';
        }
        html += '</div>';
      }
      container.innerHTML = html;
    } else if (tpl === 'modern') {
      container.className = 'cod-page-offers cod-page-offers--modern';
      var html2 = '';
      for (var j = 0; j < allOffers.length; j++) {
        var om = allOffers[j];
        var isActM = isOfferActive(om);
        var bgM = isActM ? activeBg : inactiveBg;
        var bdM = isActM ? activeBd : inactiveBd;
        var perM = offerPerUnit(om, unitPrice);
        var badgeM = offerBadgeText(om);
        var tBgM = offerTagBg(om, isActM, os);
        html2 += '<div class="cod-page-offer-modern" data-offer-qty="' + om.min_qty + '" style="border:2px solid ' + bdM + ';background:' + bgM + ';border-radius:' + rad + '">';
        html2 += '<div class="cod-offer-radio" style="border-color:' + bdM + '">' + (isActM ? '<div class="cod-offer-radio__dot" style="background:' + activeBd + '"></div>' : '') + '</div>';
        if (om.image_url) html2 += '<img src="' + om.image_url + '" alt="" style="width:28px;height:28px;border-radius:4px;object-fit:cover;flex-shrink:0">';
        html2 += '<div class="cod-offer-modern__body"><span style="color:' + titleColor + ';font-size:' + titleSize + ';font-weight:' + titleBold + ';font-style:' + titleItalic + '">' + offerTitle(om) + '</span>';
        if (om.label) html2 += '<span class="cod-offer-modern__label" style="background:' + labelBg + ';color:' + labelColor + ';font-size:' + labelSize + ';font-weight:' + labelBold + ';font-style:' + labelItalic + '">' + om.label + '</span>';
        html2 += '</div>';
        html2 += '<div class="cod-offer-modern__end"><span style="color:' + priceColor + ';font-size:' + priceSize + ';font-weight:' + priceBold + ';font-style:' + priceItalic + '">' + formatMoney(perM) + '</span>';
        if (badgeM) html2 += '<span class="cod-offer-modern__tag" style="background:' + tBgM + ';color:' + tagColor + ';font-size:' + tagSize + ';font-weight:' + tagBold + ';font-style:' + tagItalic + '">' + badgeM + '</span>';
        html2 += '</div></div>';
      }
      container.innerHTML = html2;
    } else {
      // vertical (stacked list)
      container.className = 'cod-page-offers cod-page-offers--vertical';
      var html3 = '<div class="cod-page-offers-vstack" style="border:1px solid ' + inactiveBd + ';border-radius:' + rad + ';overflow:hidden">';
      for (var k = 0; k < allOffers.length; k++) {
        var ov = allOffers[k];
        var isActV = isOfferActive(ov);
        var bgV = isActV ? activeBg : inactiveBg;
        var perV = offerPerUnit(ov, unitPrice);
        var badgeV = offerBadgeText(ov);
        var tBgV = offerTagBg(ov, isActV, os);
        html3 += '<div class="cod-page-offer-vrow" data-offer-qty="' + ov.min_qty + '" style="background:' + bgV + ';border-left:3px solid ' + (isActV ? activeBd : 'transparent') + ';border-bottom:' + (k < allOffers.length - 1 ? '1px solid ' + inactiveBd : 'none') + '">';
        html3 += '<div class="cod-offer-vrow__left">';
        if (ov.image_url) html3 += '<img src="' + ov.image_url + '" alt="" style="width:24px;height:24px;border-radius:4px;object-fit:cover">';
        html3 += '<span style="color:' + titleColor + ';font-size:' + titleSize + ';font-weight:' + titleBold + ';font-style:' + titleItalic + '">' + offerTitle(ov) + '</span>';
        if (ov.label) html3 += '<span class="cod-offer-vrow__label" style="background:' + labelBg + ';color:' + labelColor + ';font-size:' + labelSize + ';font-weight:' + labelBold + ';font-style:' + labelItalic + '">' + ov.label + '</span>';
        html3 += '</div>';
        html3 += '<div class="cod-offer-vrow__right"><span style="color:' + priceColor + ';font-size:' + priceSize + ';font-weight:' + priceBold + ';font-style:' + priceItalic + '">' + formatMoney(perV) + '</span>';
        if (badgeV) html3 += '<span class="cod-offer-vrow__tag" style="background:' + tBgV + ';color:' + tagColor + ';font-size:' + tagSize + ';font-weight:' + tagBold + ';font-style:' + tagItalic + '">' + badgeV + '</span>';
        html3 += '</div></div>';
      }
      html3 += '</div>';
      container.innerHTML = html3;
    }

    // If preselect is set and quantity hasn't been changed yet, auto-select
    if (preselectedQty > 0 && quantity === 1) {
      quantity = preselectedQty;
      updateTotals();
    }

    trackEvent('offer_impression');
  }


  /* ── In-form offer cards + variant selectors ── */
  function renderFormOffers() {
    var container = $('cod-form-offers');
    if (!container || offers.length === 0) {
      if (container) container.hidden = true;
      var hdr0 = $('cod-form-header');
      if (hdr0) hdr0.style.display = '';
      return;
    }
    container.hidden = false;
    var hdr = $('cod-form-header');
    if (hdr) hdr.style.display = 'none';

    var os = getOffersStyle();
    var activeBg = os.active_bg || '#f5f0ff';
    var activeBd = os.active_border || '#b5a1e0';
    var inactiveBg = os.inactive_bg || '#ffffff';
    var inactiveBd = os.inactive_border || '#e0e0e0';
    var lblBg = os.label_bg || activeBd;

    var galImg = document.querySelector('[data-gallery-main] img, .product-gallery__main img, .product__media img, .product-single__photo img');
    var defImg = galImg ? galImg.getAttribute('src') : '';
    if (!defImg && script) defImg = script.getAttribute('data-product-image') || '';

    var allOffers = [{ min_qty: 1, title: '', discount_type: 'none', discount_percent: 0, discount_fixed: 0, tag: '', tag_bg: '', label: '', image_url: defImg }].concat(offers);

    var html = '<div class="cod-form-offers__cards">';
    for (var i = 0; i < allOffers.length; i++) {
      var o = allOffers[i];
      var isAct = (quantity === o.min_qty) || (o.min_qty === 1 && quantity === 1 && !activeOffer);
      var bg = isAct ? activeBg : inactiveBg;
      var bd = isAct ? activeBd : inactiveBd;
      var pu = offerPerUnit(o, unitPrice);
      var bdg = offerBadgeText(o);
      var tBg = offerTagBg(o, isAct, os);

      html += '<div class="cod-form-offers__card' + (isAct ? ' cod-form-offers__card--active' : '') + '" data-offer-qty="' + o.min_qty + '" style="border-color:' + bd + ';background:' + bg + '">';

      if (o.label) html += '<div class="cod-form-offers__label" style="background:' + lblBg + '">' + o.label + '</div>';

      html += '<div class="cod-form-offers__radio" style="border-color:' + (isAct ? activeBd : '#ccc') + '">';
      if (isAct) html += '<div class="cod-form-offers__radio-dot" style="background:' + activeBd + '"></div>';
      html += '</div>';

      var imgSrc = o.image_url || defImg;
      if (imgSrc) html += '<img class="cod-form-offers__img" src="' + imgSrc + '" alt="" loading="lazy">';

      html += '<div class="cod-form-offers__title">' + offerTitle(o) + '</div>';

      if (bdg) {
        html += '<div class="cod-form-offers__badge" style="background:' + tBg + '">' + bdg + '</div>';
      } else if (o.min_qty === 1 && !offerHasDiscount(o)) {
        html += '<div class="cod-form-offers__fulltag">' + L.regular_price + '</div>';
      }

      html += '<div class="cod-form-offers__price">' + formatMoney(pu) + (o.min_qty > 1 ? (('/' + L.quantity_unit)) : '') + '</div>';

      if (o.min_qty > 1) {
        var tot = pu * o.min_qty;
        var orig = unitPrice * o.min_qty;
        html += '<div class="cod-form-offers__total">' + formatMoney(tot) + '</div>';
        if (offerHasDiscount(o)) html += '<div class="cod-form-offers__original">' + formatMoney(orig) + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    if (productVariants.length > 1) {
      html += '<div class="cod-form-offers__variants">';
      html += '<div class="cod-form-offers__var-label">' + (variantOptionName || L.variant_label) + '</div>';
      for (var v = 0; v < quantity; v++) {
        var sv = selectedVariants[v] || currentVariantId;
        html += '<div class="cod-form-offers__var-row">';
        html += '<span class="cod-form-offers__var-num">#' + (v + 1) + '</span>';
        html += '<select class="cod-form-offers__var-select" data-unit="' + v + '">';
        for (var vi = 0; vi < productVariants.length; vi++) {
          var pv = productVariants[vi];
          if (!pv.available) continue;
          html += '<option value="' + pv.id + '"' + (sv === pv.id ? ' selected' : '') + '>' + pv.title + '</option>';
        }
        html += '</select>';
        html += '</div>';
      }
      html += '</div>';
    }
    container.innerHTML = html;
  }

  function fetchOffers() {
    if (!COD_API || !STORE_ID) return;
    var url = COD_API + '/api/cod/offers?shop=' + encodeURIComponent(SHOP);
    if (currentProductId) url += '&product_id=' + currentProductId;
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        offers = data.offers || [];
        renderOffers();
        renderPageOffers();
        renderFormOffers();
        updateTotals();
      })
      .catch(function () { /* silently fail — offers are optional */ });
  }

  // Fetch offers immediately (for on-page widget)
  fetchOffers();

  // Variant selector change handler (for multi-variant offers in form)
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t.classList || !t.classList.contains('cod-form-offers__var-select')) return;
    var idx = parseInt(t.getAttribute('data-unit'), 10) || 0;
    var nvId = parseInt(t.value, 10);
    selectedVariants[idx] = nvId;
    if (idx === 0) {
      currentVariantId = nvId;
      for (var pi = 0; pi < productVariants.length; pi++) {
        if (productVariants[pi].id === nvId) {
          unitPrice = productVariants[pi].price;
          comparePrice = productVariants[pi].compare_at_price || 0;
          if (productVariants[pi].image_url) {
            var mainImg = document.querySelector('[data-gallery-main] img, .product-gallery__main img');
            if (mainImg) mainImg.setAttribute('src', productVariants[pi].image_url);
          }
          break;
        }
      }
      updateTotals();
      renderFormOffers();
      updateComparePrice();
      var vl = $('cod-variant-label');
      if (vl) {
        var found = null;
        for (var fi = 0; fi < productVariants.length; fi++) {
          if (productVariants[fi].id === nvId) { found = productVariants[fi]; break; }
        }
        if (found) vl.textContent = found.title;
      }
      var pe = $('cod-unit-price');
      if (pe) pe.textContent = formatMoney(unitPrice);
    }
  });


  /* ── Order bumps ── */
  function getBumpTotal() {
    var total = 0;
    for (var i = 0; i < availableBumps.length; i++) {
      if (acceptedBumpIds.indexOf(availableBumps[i].variant_id) !== -1) {
        total += parseFloat(availableBumps[i].price) || 0;
      }
    }
    return total;
  }

  function parseBumpMarkdown(text) {
  return (text || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function renderBumps() {
    var container = $('cod-bumps');
    if (!container || availableBumps.length === 0) return;
    container.hidden = false;
    var html = '';
    for (var i = 0; i < availableBumps.length; i++) {
      var b = availableBumps[i];
      var checked = acceptedBumpIds.indexOf(b.variant_id) !== -1;
      html += '<label class="cod-form__bump" data-bump-vid="' + b.variant_id + '">'
        + '<input type="checkbox" class="cod-form__bump-checkbox"'
        + ' data-bump-vid="' + b.variant_id + '"'
        + (checked ? ' checked' : '') + '>'
        + (b.image_url ? '<img class="cod-form__bump-img" src="' + b.image_url + '&width=80" alt="" loading="lazy">' : '')
        + '<span class="cod-form__bump-info">'
        + '<span class="cod-form__bump-title">' + parseBumpMarkdown(b.text || b.title) + '</span>'
        + '</span>'
        + '</label>';
    }
    container.innerHTML = '<div class="cod-form__bump-heading">' + L.bumps_heading + '</div>' + html;
    trackEvent('bump_impression');
  }

  function fetchBumps() {
    if (!COD_API || !STORE_ID || !currentProductId) return;
    fetch(COD_API + '/api/cod/bumps?shop=' + encodeURIComponent(SHOP)
      + '&product_id=' + currentProductId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        availableBumps = data.bumps || [];
        acceptedBumpIds = [];
        renderBumps();
      })
      .catch(function () { /* silently fail — bumps are optional */ });
  }

  /* ── Shipping rates ── */
  function fetchShippingRates() {
    if (!COD_API || !STORE_ID) return;
    var cartItems = codCart.getAll();
    var subtotal;
    if (cartItems.length > 0) {
      subtotal = 0;
      for (var si = 0; si < cartItems.length; si++) {
        if (cartItems[si].product_id === currentProductId) {
          subtotal += unitPrice * quantity;
        } else {
          subtotal += cartItems[si].price * (cartItems[si].quantity || 1);
        }
      }
    } else {
      subtotal = unitPrice * quantity;
    }
    var disc = getDiscountAmount();
    var bumpTotal = getBumpTotal();
    var orderTotal = subtotal - disc.amount + bumpTotal;
    fetch(COD_API + '/api/cod/shipping-rates?shop=' + encodeURIComponent(SHOP)
      + '&order_total=' + orderTotal.toFixed(2)
      + '&quantity=' + quantity
      + '&product_id=' + encodeURIComponent(currentProductId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        shippingRates = data.rates || [];
        shippingRatesFetched = true;
        renderShippingRates();
      })
      .catch(function () { /* silent */ });
  }

  function renderShippingRates() {
    var container = $('cod-shipping-rates');
    if (!container || shippingRates.length <= 1) {
      // Single rate — use default behavior, hide radio buttons
      if (shippingRates.length === 1) {
        shippingPrice = parseFloat(shippingRates[0].price) || 0;
        updateTotals();
      }
      if (container) container.hidden = true;
      return;
    }
    container.hidden = false;
    var html = '';
    for (var i = 0; i < shippingRates.length; i++) {
      var r = shippingRates[i];
      var price = parseFloat(r.price) || 0;
      var checked = i === 0 ? ' checked' : '';
      html += '<label class="cod-form__shipping-rate">'
        + '<input type="radio" name="shipping_rate" value="' + price.toFixed(2) + '"' + checked + '>'
        + '<span>' + r.name + '</span>'
        + '<span class="cod-form__shipping-rate-price">'
        + (price === 0 ? L.free_shipping : formatMoney(price))
        + '</span></label>';
    }
    container.innerHTML = html;
    // Default to first rate
    shippingPrice = parseFloat(shippingRates[0].price) || 0;
    updateTotals();
  }

  /* ── Downsell popup ── */
  function fetchDownsell() {
    if (!COD_API || !STORE_ID || downsellConfig) return;
    fetch(COD_API + '/api/cod/downsell?shop=' + encodeURIComponent(SHOP) + '&product_id=' + encodeURIComponent(currentProductId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.enabled && data.discount_code) downsellConfig = data;
      })
      .catch(function () { /* silent */ });
  }

  function showDownsell() {
    if (!downsellConfig || downsellShown || orderPlaced) return;
    downsellShown = true;
    trackEvent('downsell_impression');

    var dc = downsellConfig;
    var popup = document.createElement('div');
    popup.className = 'cod-downsell-overlay';
    popup.innerHTML = '<div class="cod-downsell" style="background:' + (dc.bg_color || '#fff') + '">'
      + '<button type="button" class="cod-downsell__close" id="cod-downsell-close">&times;</button>'
      + '<div class="cod-downsell__icon">🎁</div>'
      + '<p class="cod-downsell__message" style="color:' + (dc.message_color || '#333') + '">' + dc.message + '</p>'
      + '<div class="cod-downsell__code" style="background:' + (dc.badge_bg_color || '#C62828') + ';color:' + (dc.badge_text_color || '#fff') + '">' + dc.discount_code + '</div>'
      + '<button type="button" class="cod-downsell__btn" id="cod-downsell-apply" style="background:' + (dc.button_bg_color || '#C62828') + ';color:' + (dc.button_text_color || '#fff') + '">'
      + (dc.button_text || L.downsell_apply) + '</button>'
      + '</div>';
    document.body.appendChild(popup);

    popup.addEventListener('click', function (e) {
      var target = e.target;
      if (target.id === 'cod-downsell-close' || target.classList.contains('cod-downsell-overlay')) {
        popup.remove();
      }
      if (target.id === 'cod-downsell-apply') {
        trackEvent('downsell_accept');
        // Auto-fill discount code and reopen form
        popup.remove();
        var codeEl = $('cod-discount-code');
        if (codeEl) codeEl.value = downsellConfig.discount_code;
        openForm();
        setTimeout(function () { applyDiscount(); }, 300);
      }
    });
  }

  /* ── OTP verification ── */
  function fetchOtpStatus() {
    if (!COD_API || !STORE_ID) return;
    fetch(COD_API + '/api/cod/otp-status?shop=' + encodeURIComponent(SHOP))
      .then(function (r) { return r.json(); })
      .then(function (data) { otpEnabled = !!data.otp_enabled; })
      .catch(function () { /* silent */ });
  }

  function sendOtp(phone, callback) {
    if (otpSending) return;
    otpSending = true;
    var headers = { 'Content-Type': 'application/json' };
    if (COD_KEY && !IS_PROXY) headers['X-COD-Key'] = COD_KEY;

    fetch(COD_API + '/api/cod/otp/send', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ shop: SHOP, phone: phone })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        otpSending = false;
        callback(data.sent, data.error || '');
      })
      .catch(function () {
        otpSending = false;
        callback(false, L.connection_error);
      });
  }

  function verifyOtp(phone, code, callback) {
    var headers = { 'Content-Type': 'application/json' };
    if (COD_KEY && !IS_PROXY) headers['X-COD-Key'] = COD_KEY;

    fetch(COD_API + '/api/cod/otp/verify', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ shop: SHOP, phone: phone, code: code })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { callback(data.verified, data.error || ''); })
      .catch(function () { callback(false, L.connection_error); });
  }

  function showOtpPopup(phone, onVerified) {
    otpPhone = phone;
    // Remove existing OTP popup if any
    var existing = document.querySelector('.cod-otp-overlay');
    if (existing) existing.remove();

    var popup = document.createElement('div');
    popup.className = 'cod-otp-overlay';
    popup.innerHTML = '<div class="cod-otp">'
      + '<button type="button" class="cod-otp__close" id="cod-otp-close">&times;</button>'
      + '<div class="cod-otp__icon">🔐</div>'
      + '<h3 class="cod-otp__title">' + L.otp_title + '</h3>'
      + '<p class="cod-otp__desc">' + L.otp_desc + ' ' + phone.slice(0, 4) + '***' + phone.slice(-3) + '</p>'
      + '<div class="cod-otp__input-row">'
      + '<input type="text" id="cod-otp-input" class="cod-otp__input" maxlength="6" placeholder="______" autocomplete="one-time-code" inputmode="numeric" />'
      + '</div>'
      + '<p class="cod-otp__error" id="cod-otp-error" hidden></p>'
      + '<button type="button" class="cod-otp__verify-btn" id="cod-otp-verify">' + L.otp_verify + '</button>'
      + '<p class="cod-otp__resend"><a href="#" id="cod-otp-resend">' + L.otp_resend + '</a></p>'
      + '</div>';
    document.body.appendChild(popup);

    var input = document.getElementById('cod-otp-input');
    if (input) setTimeout(function () { input.focus(); }, 200);

    popup.addEventListener('click', function (e) {
      var target = e.target;
      // Close
      if (target.id === 'cod-otp-close' || target.classList.contains('cod-otp-overlay')) {
        popup.remove();
      }
      // Verify
      if (target.id === 'cod-otp-verify') {
        var codeInput = document.getElementById('cod-otp-input');
        var code = codeInput ? codeInput.value.trim() : '';
        if (code.length < 4) return;

        target.disabled = true;
        target.textContent = L.otp_verifying;
        var errEl = document.getElementById('cod-otp-error');

        verifyOtp(phone, code, function (verified, error) {
          if (verified) {
            otpVerified = true;
            popup.remove();
            onVerified();
          } else {
            target.disabled = false;
            target.textContent = L.otp_verify;
            if (errEl) { errEl.hidden = false; errEl.textContent = error; }
          }
        });
      }
      // Resend
      if (target.id === 'cod-otp-resend') {
        e.preventDefault();
        var resendLink = target;
        resendLink.textContent = L.otp_sending;
        sendOtp(phone, function (sent, error) {
          resendLink.textContent = sent ? L.otp_resent : (error || L.retry);
          setTimeout(function () { resendLink.textContent = L.otp_resend; }, 3000);
        });
      }
    });
  }

  // Fetch OTP status on load
  fetchOtpStatus();

  /* ── Form config: fetch + apply styling ── */
  var _ICON_SVG = {
    cash: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    cart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
    truck: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    arrow: '<span style="font-size:1.2em;line-height:1">→</span>'
  };

  /* ── Prepaid (online payment) button ── */
  function initPrepaidButton(cfg) {
    if (!cfg || !cfg.prepaid || !cfg.prepaid.enabled) return;
    var pp = cfg.prepaid;
    var submitBtn = $('cod-submit-btn');
    if (!submitBtn) return;

    // Don't add if already exists
    if (document.getElementById('cod-prepaid-btn')) return;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top:8px;text-align:center;';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'cod-prepaid-btn';
    btn.style.cssText = 'width:100%;padding:12px;font-size:0.95rem;font-weight:600;color:#ffffff;background:#1a1a1a;border:none;border-radius:8px;cursor:pointer;transition:all 0.2s;';
    btn.textContent = pp.button_text || L.online_payment;

    if (pp.discount_label) {
      var badge = document.createElement('span');
      badge.style.cssText = 'display:inline-block;margin-left:8px;padding:2px 8px;font-size:0.75rem;font-weight:700;color:#fff;background:var(--color-success,#2E7D32);border-radius:999px;';
      badge.textContent = pp.discount_label;
      btn.appendChild(badge);
    }

    btn.addEventListener('click', function () {
      // Validate form fields
      var form = $('cod-order-form');
      if (!form) return;
      clearErrors();
      var allInputs = form.querySelectorAll('input[required], select[required]');
      var valid = true;
      for (var i = 0; i < allInputs.length; i++) {
        var input = allInputs[i];
        var wrap = input.closest('.cod-form__field, .cod-form__row--half');
        if (wrap && wrap.hidden) continue;
        if (!input.value.trim()) {
          showFieldError(input.name || '', L.required_field);
          valid = false;
        }
      }
      if (!valid) return;

      // Build Shopify checkout URL
      var cartUrl = '/cart/' + currentVariantId + ':' + quantity;
      var params = [];
      if (pp.discount_code) params.push('discount=' + encodeURIComponent(pp.discount_code));
      var fn = form.querySelector('[name="first_name"]');
      var ln = form.querySelector('[name="last_name"]');
      var ph = form.querySelector('[name="phone"]');
      var city = form.querySelector('[name="city"]');
      var prov = form.querySelector('[name="province"]');
      var addr = form.querySelector('[name="address1"]');
      if (fn) params.push('checkout[shipping_address][first_name]=' + encodeURIComponent(fn.value));
      if (ln) params.push('checkout[shipping_address][last_name]=' + encodeURIComponent(ln.value));
      if (ph) params.push('checkout[shipping_address][phone]=' + encodeURIComponent(ph.value));
      if (city) params.push('checkout[shipping_address][city]=' + encodeURIComponent(city.value));
      if (prov) params.push('checkout[shipping_address][province]=' + encodeURIComponent(prov.value));
      if (addr) params.push('checkout[shipping_address][address1]=' + encodeURIComponent(addr.value));
      params.push('checkout[shipping_address][country]=' + ({el:'Greece',pl:'Poland'}[_lang] || 'Romania'));

      window.location.href = cartUrl + (params.length ? '?' + params.join('&') : '');
    });

    wrapper.appendChild(btn);
    submitBtn.parentNode.insertBefore(wrapper, submitBtn.nextSibling);
  }

  /* ── Apply locale labels to form — overrides static English from liquid ── */
  function applyLocaleLabels(locale) {
    if (!locale) return;
    var labels = locale.labels || {};
    var overlay = $('cod-form-overlay');
    if (!overlay) return;

    // Map field data-field attribute to locale label key
    var fieldMap = {
      'first_name': 'first_name',
      'last_name': 'last_name',
      'phone': 'phone',
      'province': 'province',
      'city': 'city',
      'address1': 'address',
      'zip': 'zip',
      'email': 'email'
    };
    for (var field in fieldMap) {
      var el = overlay.querySelector('[data-field="' + field + '"] label');
      if (el && labels[fieldMap[field]]) {
        var required = el.querySelector('.cod-required');
        el.textContent = labels[fieldMap[field]] + ' ';
        if (required) el.appendChild(required);
      }
    }

    // Phone placeholder
    if (locale.phone_placeholder) {
      var phoneInput = overlay.querySelector('#cod-phone');
      if (phoneInput) phoneInput.placeholder = locale.phone_placeholder;
    }

    // Address placeholder
    if (labels.address_placeholder) {
      var addrInput = overlay.querySelector('#cod-address');
      if (addrInput) addrInput.placeholder = labels.address_placeholder;
    }

    // Province selector — populate options
    if (locale.provinces && locale.provinces.length) {
      var sel = overlay.querySelector('#cod-province');
      if (sel) {
        var currentVal = sel.value;
        sel.innerHTML = '<option value="">\u2014 ' + (labels.select_province || labels.province || 'Select') + ' \u2014</option>';
        for (var i = 0; i < locale.provinces.length; i++) {
          var opt = document.createElement('option');
          opt.value = locale.provinces[i];
          opt.textContent = locale.provinces[i];
          sel.appendChild(opt);
        }
        if (currentVal) sel.value = currentVal;
      }
    }

    // Submit button text
    var submitBtn = $('cod-submit-btn');
    if (submitBtn && labels.submit) {
      var textSpan = submitBtn.querySelector('.cod-form__submit-text');
      if (textSpan) {
        var subtitleText = labels.submit_subtitle || 'PLATA LA LIVRARE';
        textSpan.innerHTML = '<span>' + labels.submit + '</span>'
          + '<span style="font-size:0.9rem;text-transform:uppercase;opacity:0.85;margin-top:2px;">' + subtitleText + '</span>';
      }
    }

    // Trigger button text
    var triggerText = document.getElementById('cod-trigger-text');
    if (triggerText && labels.submit) {
      triggerText.textContent = L.submit || labels.submit || triggerText.textContent;
    }

    // Discount section — unhide if enabled in config
    var discSection = $('cod-discount-section');
    if (discSection && formConfig && formConfig.settings && formConfig.settings.enable_discount_codes) {
      discSection.hidden = false;
    }
    var discToggle = $('cod-discount-toggle');
    if (discToggle && labels.have_discount) discToggle.textContent = labels.have_discount;
    var discApply = $('cod-discount-apply');
    if (discApply && labels.apply) discApply.textContent = labels.apply;
    var discInput = $('cod-discount-code');
    if (discInput && labels.enter_code) discInput.placeholder = labels.enter_code.toUpperCase();

    // Summary labels
    var summaryLabels = overlay.querySelectorAll('.cod-form__line');
    if (summaryLabels.length >= 4) {
      if (labels.subtotal) summaryLabels[0].querySelector('span').textContent = labels.subtotal;
      if (labels.discount) { var dl = $('cod-discount-label'); if (dl) dl.textContent = labels.discount; }
      if (labels.shipping) summaryLabels[2].querySelector('span').textContent = labels.shipping;
    }
    var totalRow = overlay.querySelector('.cod-form__total-row');
    if (totalRow && labels.total) totalRow.querySelector('span').innerHTML = '<b>' + labels.total + '</b>';

    // Announcement
    var announce = $('cod-announcement');
    if (announce && labels.announcement) {
      announce.textContent = labels.announcement;
      announce.hidden = false;
    }

    // Success screen
    var successTitle = $('cod-success-title');
    if (successTitle && labels.success_title) successTitle.textContent = labels.success_title;
    var successText = $('cod-success-text');
    if (successText && labels.success_text) successText.textContent = labels.success_text;
    var successClose = $('cod-success-close');
    if (successClose && labels.close) successClose.textContent = labels.close;
    // Error retry button
    var errorRetry = $('cod-error-retry');
    if (errorRetry && labels.retry) errorRetry.textContent = labels.retry;
  }

  function fetchFormConfig() {
    if (!COD_API || !STORE_ID) return;
    fetch(COD_API + '/api/cod/form-config?shop=' + encodeURIComponent(SHOP))
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        formConfig = cfg;
        // Update language detection from actual locale config
        if (cfg.locale && cfg.locale.language) {
          _lang = cfg.locale.language;
          _isGreek = _lang === 'el';
        }
        if (cfg.locale && cfg.locale.phone_pattern) {
          try { _phonePattern = new RegExp(cfg.locale.phone_pattern); } catch (e) { /* keep default */ }
        }
        // Populate locale labels from form-config response
        if (cfg.locale && cfg.locale.labels) {
          var labels = cfg.locale.labels;
          for (var key in labels) {
            if (labels.hasOwnProperty(key) && labels[key]) L[key] = labels[key];
          }
          codFeeLabel = L.cod_fee;
          CURRENCY = cfg.locale.currency || CURRENCY;
        }
        // Apply locale labels to form fields (overrides static English from liquid)
        if (cfg.locale) applyLocaleLabels(cfg.locale);
        // Product restriction check — hide form if product excluded
        if (cfg.settings && checkProductRestriction(cfg.settings) === false) return;
        applyFormConfig(cfg);
        if (cfg.layout && cfg.layout.length) applyFieldLayout(cfg.layout);
        initPrepaidButton(cfg);
        initAddressAutocomplete(cfg);
        // Re-render offers with updated locale labels
        renderOffers();
        renderPageOffers();
        renderFormOffers();
      })
      .catch(function () { /* silent — defaults work fine */ });
  }

  /* ── Product/Collection Restrictions ── */
  function checkProductRestriction(settings) {
    if (!settings || !settings.restrict_mode || settings.restrict_mode === 'all') return true;
    var pid = currentProductId;
    if (!pid) return true;
    if (settings.restrict_mode === 'include') {
      var allowed = settings.allowed_product_ids || [];
      if (allowed.length && allowed.indexOf(pid) === -1) {
        // Product not in allowed list — hide trigger button
        var btn = $('cod-form-open');
        if (btn) btn.style.display = 'none';
        return false;
      }
    } else if (settings.restrict_mode === 'exclude') {
      var excluded = settings.excluded_product_ids || [];
      if (excluded.indexOf(pid) !== -1) {
        var btn2 = $('cod-form-open');
        if (btn2) btn2.style.display = 'none';
        return false;
      }
    }
    return true;
  }

  /* ── Google Address Autocomplete ── */
  function initAddressAutocomplete(cfg) {
    if (!cfg || !cfg.settings) return;
    if (!cfg.settings.address_autocomplete_enabled || !cfg.settings.google_places_api_key) return;
    // Load Google Places JS
    var s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(cfg.settings.google_places_api_key)
      + '&libraries=places&language=' + (L.language || 'ro') + '&callback=__codPlacesReady';
    s.async = true;
    s.defer = true;
    window.__codPlacesReady = function () {
      var form = $('cod-order-form');
      if (!form) return;
      var addrInput = form.querySelector('[name="address1"]');
      if (!addrInput || !window.google || !window.google.maps) return;
      var autocomplete = new window.google.maps.places.Autocomplete(addrInput, {
        types: ['address'],
        componentRestrictions: { country: (formConfig && formConfig.locale && formConfig.locale.country_code || 'RO').toLowerCase() },
        fields: ['address_components']
      });
      autocomplete.addListener('place_changed', function () {
        var place = autocomplete.getPlace();
        if (!place || !place.address_components) return;
        var city = '', province = '', zip = '';
        for (var i = 0; i < place.address_components.length; i++) {
          var c = place.address_components[i];
          var types = c.types || [];
          if (types.indexOf('locality') !== -1) city = c.long_name;
          if (types.indexOf('administrative_area_level_1') !== -1) province = c.long_name;
          if (types.indexOf('postal_code') !== -1) zip = c.long_name;
        }
        var cityEl = form.querySelector('[name="city"]');
        if (cityEl && city) cityEl.value = city;
        var zipEl = form.querySelector('[name="zip"]');
        if (zipEl && zip) zipEl.value = zip;
        var provEl = form.querySelector('[name="province"]');
        if (provEl && province) {
          // Try to match province dropdown value
          for (var j = 0; j < provEl.options.length; j++) {
            if (provEl.options[j].value === province || provEl.options[j].text === province) {
              provEl.value = provEl.options[j].value;
              provEl.dispatchEvent(new Event('change'));
              break;
            }
          }
        }
      });
    };
    document.head.appendChild(s);
  }

  function applyFormConfig(cfg) {
    if (!cfg) return;
    var bs = cfg.button_style;
    var fs = cfg.form_style;

    // Apply button styling
    var triggerBtn = $('cod-form-open');
    if (triggerBtn && bs) {
      triggerBtn.style.color = bs.text_color;
      triggerBtn.style.background = bs.bg_color;
      triggerBtn.style.fontSize = bs.text_size;
      triggerBtn.style.borderRadius = bs.border_radius;
      if (bs.border_color) {
        triggerBtn.style.borderColor = bs.border_color;
        triggerBtn.style.borderWidth = bs.border_width;
        triggerBtn.style.borderStyle = 'solid';
      }
      // Animation class
      triggerBtn.classList.remove('cod-anim-bounce', 'cod-anim-shake', 'cod-anim-pulse');
      if (bs.animation && bs.animation !== 'none') {
        triggerBtn.classList.add('cod-anim-' + bs.animation);
      }
      // Hover color via CSS variable
      triggerBtn.style.setProperty('--cod-btn-hover', bs.bg_color_hover);
      // Build inner HTML: icon + text + subtitle
      var html = '';
      if (bs.icon && bs.icon !== 'none' && _ICON_SVG[bs.icon]) {
        html += '<span class="cod-form-trigger__icon">' + _ICON_SVG[bs.icon] + '</span>';
      }
      html += '<span class="cod-form-trigger__text">';
      html += '<span>' + (bs.text || cfg.form.button_text || L.submit) + '</span>';
      if (bs.subtitle) {
        html += '<span class="cod-form-trigger__subtitle">' + bs.subtitle + '</span>';
      }
      html += '</span>';
      triggerBtn.innerHTML = html;
      // Ensure horizontal layout: icon left, text center
      triggerBtn.style.flexDirection = 'row';
      triggerBtn.style.gap = '10px';
    }

    // Apply form style via CSS variables on overlay
    var overlay = $('cod-form-overlay');
    if (overlay && fs) {
      overlay.style.setProperty('--cod-form-bg', fs.bg_color);
      overlay.style.setProperty('--cod-form-text', fs.text_color);
      overlay.style.setProperty('--cod-form-header-text', fs.header_text_color);
      overlay.style.setProperty('--cod-form-label', fs.label_color);
      overlay.style.setProperty('--cod-form-radius', fs.border_radius);
      overlay.style.setProperty('--cod-form-max-width', fs.max_width);
      overlay.style.setProperty('--cod-form-accent', fs.accent_color);
      overlay.style.setProperty('--cod-form-img-size', fs.product_image_size);
      if (fs.overlay_opacity) {
        overlay.style.background = 'rgba(0,0,0,' + fs.overlay_opacity + ')';
      }
    }
    // Apply form container styles
    var formEl = overlay ? overlay.querySelector('.cod-form') : null;
    if (formEl && fs) {
      formEl.style.background = fs.bg_color;
      formEl.style.color = fs.text_color;
      formEl.style.maxWidth = fs.max_width;
      formEl.style.borderRadius = fs.border_radius;
    }
    // Apply COD fee from settings
    if (cfg.settings) {
      codFee = parseFloat(cfg.settings.cod_fee) || 0;
      codFeeLabel = cfg.settings.cod_fee_label || L.cod_fee;
      updateTotals();
    }

    // Apply accent color as primary CSS variable
    if (fs && fs.accent_color) {
      document.documentElement.style.setProperty('--color-primary', fs.accent_color);
      // Also set the dark variant for hover states
      document.documentElement.style.setProperty('--color-primary-dark', bs ? bs.bg_color_hover : fs.accent_color);
    }
    // Product image size
    var prodImg = overlay ? overlay.querySelector('.cod-form__product-img') : null;
    if (prodImg && fs && fs.product_image_size) {
      prodImg.style.width = fs.product_image_size;
      prodImg.style.height = fs.product_image_size;
    }
  }

  function applyFieldLayout(fields) {
    if (!fields || !fields.length) return;
    var form = $('cod-order-form');
    if (!form) return;
    var container = form.querySelector('.cod-form__fields');
    if (!container) return;

    // Build a map of existing field elements by data-field-id
    var fieldMap = {};
    var allFields = container.querySelectorAll('.cod-form__field[data-field-id]');
    for (var i = 0; i < allFields.length; i++) {
      var el = allFields[i];
      var fid = el.getAttribute('data-field-id');
      if (fid) fieldMap[fid] = el;
    }

    // Sort by order
    fields.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

    // Collect field elements in order, creating custom ones as needed
    var orderedEls = [];
    for (var j = 0; j < fields.length; j++) {
      var f = fields[j];
      var existingEl = fieldMap[f.id];

      if (existingEl) {
        // Existing DOM field: update visibility, required, label, placeholder
        existingEl.hidden = !f.visible;
        if (!f.visible) continue;
        var inp = existingEl.querySelector('input, select, textarea');
        if (inp) {
          if (f.required) inp.setAttribute('required', '');
          else inp.removeAttribute('required');
          if (f.placeholder && inp.tagName !== 'SELECT') inp.setAttribute('placeholder', f.placeholder);
        }
        if (f.label) {
          var lbl = existingEl.querySelector('label');
          if (lbl) {
            // Preserve checkbox label structure
            if (f.field_type === 'checkbox') {
              var span = lbl.querySelector('span');
              if (span) span.textContent = f.label;
            } else {
              lbl.textContent = f.label + (f.required ? ' *' : '');
            }
          }
        }
        orderedEls.push({ el: existingEl, halfWidth: !!f.half_width });
      } else if (f.visible) {
        // Custom field — create DOM element
        var wrapper = createCustomFieldEl(f);
        orderedEls.push({ el: wrapper, halfWidth: !!f.half_width });
      }
    }

    // Hide any fields NOT in the layout
    for (var fid2 in fieldMap) {
      var inLayout = false;
      for (var m = 0; m < fields.length; m++) {
        if (fields[m].id === fid2) { inLayout = true; break; }
      }
      if (!inLayout) fieldMap[fid2].hidden = true;
    }

    // Clear container and rebuild with proper half-width rows
    container.innerHTML = '';
    var idx = 0;
    while (idx < orderedEls.length) {
      var cur = orderedEls[idx];
      // Group consecutive half-width fields into rows of 2
      if (cur.halfWidth && idx + 1 < orderedEls.length && orderedEls[idx + 1].halfWidth) {
        var row = document.createElement('div');
        row.className = 'cod-form__row cod-form__row--half';
        row.appendChild(cur.el);
        row.appendChild(orderedEls[idx + 1].el);
        container.appendChild(row);
        idx += 2;
      } else {
        container.appendChild(cur.el);
        idx++;
      }
    }
  }

  function createCustomFieldEl(f) {
    var wrapper = document.createElement('div');
    wrapper.className = 'cod-form__field';
    wrapper.setAttribute('data-field-id', f.id);
    wrapper.setAttribute('data-custom', 'true');

    if (f.field_type === 'checkbox') {
      // Single checkbox
      var chkLabel = document.createElement('label');
      chkLabel.className = 'cod-form__checkbox-label';
      var chkInput = document.createElement('input');
      chkInput.type = 'checkbox';
      chkInput.name = 'custom_' + f.id;
      chkInput.value = '1';
      var chkSpan = document.createElement('span');
      chkSpan.textContent = f.label || f.id;
      chkLabel.appendChild(chkInput);
      chkLabel.appendChild(chkSpan);
      wrapper.appendChild(chkLabel);
      return wrapper;
    }

    // Label
    var lbl = document.createElement('label');
    lbl.textContent = (f.label || f.id) + (f.required ? ' *' : '');
    wrapper.appendChild(lbl);

    var input;
    if (f.field_type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
      input.name = 'custom_' + f.id;
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.setAttribute('required', '');
      wrapper.appendChild(input);
    } else if (f.field_type === 'select' && f.options && f.options.length) {
      input = document.createElement('select');
      input.name = 'custom_' + f.id;
      var defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.textContent = f.placeholder || L.select_placeholder;
      input.appendChild(defOpt);
      for (var k = 0; k < f.options.length; k++) {
        var opt = document.createElement('option');
        opt.value = f.options[k];
        opt.textContent = f.options[k];
        input.appendChild(opt);
      }
      if (f.required) input.setAttribute('required', '');
      wrapper.appendChild(input);
    } else if (f.field_type === 'date') {
      input = document.createElement('input');
      input.type = 'date';
      input.name = 'custom_' + f.id;
      if (f.required) input.setAttribute('required', '');
      wrapper.appendChild(input);
    } else if (f.field_type === 'radio' && f.options && f.options.length) {
      var radioGroup = document.createElement('div');
      radioGroup.className = 'cod-form__radio-group';
      radioGroup.setAttribute('data-name', 'custom_' + f.id);
      for (var r = 0; r < f.options.length; r++) {
        var radioLabel = document.createElement('label');
        radioLabel.className = 'cod-form__radio-option';
        var radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = 'custom_' + f.id;
        radioInput.value = f.options[r];
        if (r === 0 && f.required) radioInput.setAttribute('required', '');
        var radioText = document.createElement('span');
        radioText.textContent = f.options[r];
        radioLabel.appendChild(radioInput);
        radioLabel.appendChild(radioText);
        radioGroup.appendChild(radioLabel);
      }
      wrapper.appendChild(radioGroup);
    } else if (f.field_type === 'checkbox_group' && f.options && f.options.length) {
      var cbGroup = document.createElement('div');
      cbGroup.className = 'cod-form__checkbox-group';
      cbGroup.setAttribute('data-name', 'custom_' + f.id);
      for (var c = 0; c < f.options.length; c++) {
        var cbLabel = document.createElement('label');
        cbLabel.className = 'cod-form__checkbox-option';
        var cbInput = document.createElement('input');
        cbInput.type = 'checkbox';
        cbInput.name = 'custom_' + f.id;
        cbInput.value = f.options[c];
        var cbText = document.createElement('span');
        cbText.textContent = f.options[c];
        cbLabel.appendChild(cbInput);
        cbLabel.appendChild(cbText);
        cbGroup.appendChild(cbLabel);
      }
      wrapper.appendChild(cbGroup);
    } else {
      input = document.createElement('input');
      input.type = f.field_type || 'text';
      input.name = 'custom_' + f.id;
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.setAttribute('required', '');
      wrapper.appendChild(input);
    }

    var errSpan = document.createElement('span');
    errSpan.className = 'cod-form__error';
    errSpan.setAttribute('data-error', 'custom_' + f.id);
    wrapper.appendChild(errSpan);

    return wrapper;
  }

  fetchFormConfig();
  updateButtonBadge(); // Show cart count on page load

  /* ── Abandoned form capture ── */
  var _partialSent = false;
  function capturePartialForm() {
    if (_partialSent || !COD_API || !STORE_ID) return;
    var form = $('cod-order-form');
    if (!form) return;
    var phoneEl = form.querySelector('[name="phone"]');
    var phone = phoneEl ? phoneEl.value.replace(/[\s-]/g, '') : '';
    var partialPhonePattern = _phonePattern;
    if (!phone.match(partialPhonePattern)) return;

    _partialSent = true;
    try { sessionStorage.setItem('cod_partial_sent', '1'); } catch (e) { /* ignore */ }

    var firstNameEl = form.querySelector('[name="first_name"]');
    var provinceEl = form.querySelector('[name="province"]');
    var body = {
      shop: SHOP,
      phone: phone,
      first_name: firstNameEl ? firstNameEl.value.trim() : '',
      product_id: currentProductId,
      variant_id: currentVariantId,
      unit_price: unitPrice,
      province: provinceEl ? provinceEl.value : ''
    };
    var headers = { 'Content-Type': 'application/json' };
    if (COD_KEY && !IS_PROXY) headers['X-COD-Key'] = COD_KEY;
    fetch(COD_API + '/api/cod/form-partial', {
      method: 'POST', headers: headers,
      body: JSON.stringify(body), keepalive: true
    }).catch(function () {});
  }

  // Check if already captured this session
  try { if (sessionStorage.getItem('cod_partial_sent')) _partialSent = true; } catch (e) { /* ignore */ }

  // Listen for phone blur to capture partial
  document.addEventListener('blur', function (e) {
    if (e.target && e.target.name === 'phone') capturePartialForm();
  }, true);

  /* ── Open/Close ── */
  /* ── Scroll lock state ── */
  var _savedScrollY = 0;

  /* ── Touch event handler to prevent background scroll on iOS ── */
  function _preventBgScroll(e) {
    var overlay = $('cod-form-overlay');
    if (!overlay) return;
    // Allow scroll if touch is inside the form (the scroll container)
    var form = overlay.querySelector('.cod-form');
    if (form && form.contains(e.target)) return;
    // Prevent scroll on elements outside the form (overlay backdrop + body)
    e.preventDefault();
  }

  function addCurrentProductToCart() {
    if (!currentProductId || !currentVariantId) return;
    if (codCart.has(currentVariantId)) return;
    var pageQty = 1;
    var qtyInput = document.querySelector('[name="quantity"], .quantity__input, input[data-quantity-input]');
    if (qtyInput) pageQty = parseInt(qtyInput.value, 10) || 1;

    var productTitle = script.getAttribute('data-product-title') || document.querySelector('.product__title, .product-title, h1.title')?.textContent?.trim() || '';
    var productImage = script.getAttribute('data-product-image') || document.querySelector('.product__media img, .product-gallery img, .product-single__photo img')?.getAttribute('src') || '';

    codCart.add({
      product_id: currentProductId,
      variant_id: currentVariantId,
      title: productTitle,
      variant_title: '',
      price: unitPrice,
      compare_at_price: comparePrice,
      image_url: productImage,
      quantity: pageQty
    });
  }

  function renderCartList() {
    var container = $('cod-cart-list');
    if (!container) return;
    var items = codCart.getAll();
    var header = $('cod-form-header');

    // When offers are active, filter out the current product — offers section handles it
    var displayItems = items;
    if (offers.length > 0 && currentProductId) {
      displayItems = items.filter(function (i) { return i.product_id !== currentProductId; });
    }

    if (displayItems.length === 0) {
      container.hidden = true;
      if (header) { header.hidden = (offers.length > 0); header.style.display = offers.length > 0 ? 'none' : ''; }
      updateCartTotals();
      return;
    }
    container.hidden = false;
    if (header) { header.hidden = true; header.style.cssText = 'display:none!important'; }
    // Count: display items + offer product quantity
    var totalCount = displayItems.reduce(function (s, i) { return s + (i.quantity || 1); }, 0) + (offers.length > 0 ? quantity : 0);
    var html = '<div class="cod-cart__heading">' + (L.order_prefix || 'Order') + ' (' + totalCount + ' ' + (L.quantity_unit || 'items') + ')</div>';
    for (var i = 0; i < displayItems.length; i++) {
      var item = displayItems[i];
      html += '<div class="cod-cart__item" data-vid="' + item.variant_id + '">'
        + (item.image_url ? '<img class="cod-cart__img" src="' + item.image_url + '&width=160" alt="" loading="lazy">' : '')
        + '<div class="cod-cart__info">'
        + '<div class="cod-cart__title-row">'
        + '<span class="cod-cart__title">' + item.title + '</span>'
        + ' <button type="button" class="cod-cart__remove" data-vid="' + item.variant_id + '">×</button>'
        + '</div>'
        + '<div class="cod-cart__price">' + formatMoney(item.price) + (item.compare_at_price > item.price ? ' <span class="cod-cart__compare">' + formatMoney(item.compare_at_price) + '</span>' : '') + '</div>'
        + '<div class="cod-cart__qty">'
        + '<button type="button" class="cod-cart__qty-btn" data-action="dec" data-vid="' + item.variant_id + '">−</button>'
        + '<span>' + (item.quantity || 1) + '</span>'
        + '<button type="button" class="cod-cart__qty-btn" data-action="inc" data-vid="' + item.variant_id + '">+</button>'
        + '</div>'
        + '</div>'
        + '</div>';
    }
    container.innerHTML = html;
    updateCartTotals();
  }

  function updateCartTotals() {
    var sub = codCart.subtotal();
    var subEl = $('cod-subtotal');
    if (subEl) subEl.textContent = formatMoney(sub);
    updateTotals();
    fetchShippingRates();
  }

  function updateButtonBadge() {
    var btn = $('cod-form-open');
    if (!btn) return;
    var count = codCart.itemCount();
    var badge = btn.querySelector('.cod-cart-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cod-cart-badge';
        badge.style.cssText = 'position:absolute;top:-6px;right:-6px;background:#e53935;color:#fff;font-size:11px;font-weight:700;min-width:20px;height:20px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 5px;';
        btn.style.position = 'relative';
        btn.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  }

  function openForm() {
    // Add current product to cart
    addCurrentProductToCart();
    updateButtonBadge();

    var overlay = $('cod-form-overlay');
    if (!overlay) return;
    overlay.hidden = false;
    // Lock body scroll
    _savedScrollY = window.scrollY;
    document.body.classList.add('cod-form-open');
    document.documentElement.classList.add('cod-form-open');
    document.addEventListener('touchmove', _preventBgScroll, { passive: false });
    overlay.scrollTop = 0;
    var formEl = overlay.querySelector('.cod-form');
    if (formEl) formEl.scrollTop = 0;
    var form = $('cod-order-form');
    if (form) {
      var firstInput = form.querySelector('input');
      if (firstInput) setTimeout(function () { firstInput.focus(); }, 100);
    }
    // Render cart items list + auto-discount banner
    renderCartList();
    if (availableBumps.length === 0) fetchBumps();
    fetchDownsell();
    fetchShippingRates();
    trackEvent('form_open');
  }

  function closeForm() {
    var overlay = $('cod-form-overlay');
    if (overlay) overlay.hidden = true;
    // Unlock body scroll — restore position
    document.body.classList.remove('cod-form-open');
    document.documentElement.classList.remove('cod-form-open');
    document.removeEventListener('touchmove', _preventBgScroll);
    window.scrollTo(0, _savedScrollY);
    trackEvent('form_close');
    formCloseCount++;
    // Show downsell if no order was placed and close count threshold met
    if (!orderPlaced) {
      var threshold = (downsellConfig && downsellConfig.show_after_closes) || 1;
      if (formCloseCount >= threshold) {
        setTimeout(showDownsell, 400);
      }
    }
  }

  /* ── Event delegation — single listener handles ALL clicks ── */
  document.addEventListener('click', function (e) {
    var target = e.target;

    // Open button
    if (target.closest('#cod-form-open')) {
      e.preventDefault();
      openForm();
      return;
    }

    // Close button
    if (target.closest('#cod-form-close')) {
      closeForm();
      return;
    }

    // Overlay backdrop click
    if (target.id === 'cod-form-overlay') {
      closeForm();
      return;
    }

    // Success close button
    if (target.closest('#cod-success-close')) {
      closeForm();
      return;
    }

    // Cart: remove item
    var removeBtn = target.closest('.cod-cart__remove');
    if (removeBtn) {
      var vid = parseInt(removeBtn.getAttribute('data-vid'), 10);
      if (vid) { codCart.remove(vid); renderCartList(); updateButtonBadge(); }
      return;
    }
    // Cart: qty +/-
    var qtyBtn = target.closest('.cod-cart__qty-btn');
    if (qtyBtn) {
      var qvid = parseInt(qtyBtn.getAttribute('data-vid'), 10);
      var action = qtyBtn.getAttribute('data-action');
      if (qvid) {
        var items = codCart.getAll();
        var found = items.find(function (i) { return i.variant_id === qvid; });
        if (found) {
          var newQty = (found.quantity || 1) + (action === 'inc' ? 1 : -1);
          if (newQty < 1) { codCart.remove(qvid); } else { codCart.updateQty(qvid, newQty); }
          renderCartList();
          updateButtonBadge();
        }
      }
      return;
    }

    // Quantity minus
    if (target.closest('#cod-qty-minus')) {
      if (quantity > 1) { quantity--; updateTotals(); }
      return;
    }

    // Quantity plus
    if (target.closest('#cod-qty-plus')) {
      if (quantity < 10) { quantity++; updateTotals(); }
      return;
    }

    // Page offer card click (on-page widget — classic, modern, vertical)
    var pageOffer = target.closest('.cod-page-offer') || target.closest('.cod-page-offer-modern') || target.closest('.cod-page-offer-vrow');
    if (pageOffer) {
      var offerQty = parseInt(pageOffer.getAttribute('data-offer-qty'), 10) || 1;
      quantity = offerQty;
      trackEvent('offer_select', { quantity: offerQty });
      updateTotals();
      renderPageOffers();
      openForm();
      return;
    }

    // Form offer card click (in-form rich cards)
    var formCard = target.closest('.cod-form-offers__card');
    if (formCard) {
      var fcQty = parseInt(formCard.getAttribute('data-offer-qty'), 10) || 1;
      quantity = fcQty;
      while (selectedVariants.length < quantity) selectedVariants.push(currentVariantId);
      selectedVariants.length = quantity;
      trackEvent('offer_select', { quantity: fcQty });
      updateTotals();
      renderFormOffers();
      renderCartList();
      return;
    }

    // Offer tile click (in-form)
    var offerTile = target.closest('.cod-form__offer');
    if (offerTile) {
      quantity = parseInt(offerTile.getAttribute('data-min-qty'), 10) || 1;
      updateTotals();
      renderCartList();
      return;
    }

    // Shipping rate radio selection
    if (target.name === 'shipping_rate') {
      shippingPrice = parseFloat(target.value) || 0;
      updateTotals();
      return;
    }

    // Bump checkbox toggle
    if (target.classList && target.classList.contains('cod-form__bump-checkbox')) {
      var bumpVid = parseInt(target.getAttribute('data-bump-vid'), 10);
      if (bumpVid) {
        var idx = acceptedBumpIds.indexOf(bumpVid);
        if (target.checked && idx === -1) {
          acceptedBumpIds.push(bumpVid);
          trackEvent('bump_accept', { bump_variant_id: bumpVid });
        } else if (!target.checked && idx !== -1) {
          acceptedBumpIds.splice(idx, 1);
        }
        fetchShippingRates();
        updateTotals();
      }
      return;
    }

    // Discount toggle
    if (target.closest('#cod-discount-toggle')) {
      var discInput = $('cod-discount-input');
      if (discInput) {
        discInput.hidden = !discInput.hidden;
        if (!discInput.hidden) {
          var codeEl = $('cod-discount-code');
          if (codeEl) codeEl.focus();
          // Scroll the discount section into view within the modal
          setTimeout(function () {
            var discSection = discInput.closest('.cod-form__discount');
            if (discSection) discSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 50);
        }
      }
      return;
    }

    // Discount apply
    if (target.closest('#cod-discount-apply')) {
      applyDiscount();
      return;
    }
  });

  // Escape key to close
  document.addEventListener('keydown', function (e) {
    var overlay = $('cod-form-overlay');
    if (e.key === 'Escape' && overlay && !overlay.hidden) closeForm();
  });

  /* ── Discount code validation ── */
  function applyDiscount() {
    var codeInput = $('cod-discount-code');
    var code = codeInput ? codeInput.value.trim() : '';
    if (!code || !COD_API) return;

    var applyBtn = $('cod-discount-apply');
    if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = '...'; }

    var headers = { 'Content-Type': 'application/json' };
    if (COD_KEY && !IS_PROXY) headers['X-COD-Key'] = COD_KEY;

    fetch(COD_API + '/api/cod/validate-discount', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ shop: SHOP, code: code })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var result = $('cod-discount-result');
        if (result) result.hidden = false;
        if (data.valid) {
          discountCode = code;
          discountType = data.discount_type;
          discountValue = data.value;
          discountApplied = true;
          if (result) {
            result.className = 'cod-form__discount-result cod-form__discount-result--success';
            var label = data.discount_type === 'percentage'
              ? ('-' + data.value + '%')
              : (data.discount_type === 'free_shipping' ? L.free_shipping : ('-' + formatMoney(data.value)));
            result.textContent = '\u2713 ' + data.title + ' (' + label + ')';
          }
        } else {
          discountApplied = false;
          discountCode = '';
          if (result) {
            result.className = 'cod-form__discount-result cod-form__discount-result--error';
            result.textContent = data.error || L.discount_invalid;
          }
        }
        updateTotals();
      })
      .catch(function () {
        var result = $('cod-discount-result');
        if (result) {
          result.hidden = false;
          result.className = 'cod-form__discount-result cod-form__discount-result--error';
          result.textContent = L.discount_check_error;
        }
      })
      .finally(function () {
        if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = L.apply; }
      });
  }

  /* ── Variant sync — listen for custom event from product-form.js ── */
  /* Init compare price + theme colors */
  updateComparePrice();
  detectThemePriceColors();

  document.addEventListener('variant:change', function (e) {
    var d = e.detail;
    if (!d || !d.id) return;
    currentVariantId = d.id;
    selectedVariants[0] = d.id;
    unitPrice = d.price / 100;
    comparePrice = (d.compare_at_price && d.compare_at_price > d.price) ? d.compare_at_price / 100 : 0;
    var variantLabel = $('cod-variant-label');
    if (variantLabel) variantLabel.textContent = (d.title && d.title !== 'Default Title') ? d.title : '';
    var unitPriceEl = $('cod-unit-price');
    if (unitPriceEl) unitPriceEl.textContent = formatMoney(unitPrice);
    updateComparePrice();
    updateTotals();
  });

  /* ── Form submit ── */
  function submitOrderRequest(form) {
    // Disable + show loading
    var submitBtn = $('cod-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
    var submitText = submitBtn ? submitBtn.querySelector('.cod-form__submit-text') : null;
    var submitLoading = submitBtn ? submitBtn.querySelector('.cod-form__submit-loading') : null;
    if (submitText) submitText.hidden = true;
    if (submitLoading) submitLoading.hidden = false;
    var errorBox2 = $('cod-error-box');
    if (errorBox2) errorBox2.hidden = true;

    var phone = form.querySelector('[name="phone"]').value.replace(/[\s-]/g, '');
    var getVal = function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el ? (el.value || '').trim() : '';
    };

    // Build variant_ids from cart items
    var cartItems = codCart.getAll();
    var allVariantIds = [];
    var primaryVariantId = currentVariantId;
    var primaryQty = quantity;

    if (offers.length > 0 && currentProductId) {
      // Offer mode: current product quantity comes from offer selection, not cart
      var otherItems = cartItems.filter(function(i) { return i.product_id !== currentProductId; });
      if (selectedVariants.length > 1) {
        for (var sv = 0; sv < selectedVariants.length; sv++) allVariantIds.push(selectedVariants[sv]);
      } else {
        for (var oq = 0; oq < quantity; oq++) allVariantIds.push(currentVariantId);
      }
      for (var oi = 0; oi < otherItems.length; oi++) {
        for (var oiq = 0; oiq < (otherItems[oi].quantity || 1); oiq++) allVariantIds.push(otherItems[oi].variant_id);
      }
      primaryVariantId = allVariantIds[0];
      primaryQty = 1;
    } else if (cartItems.length > 0) {
      // Multi-product cart mode (no offers)
      for (var ci = 0; ci < cartItems.length; ci++) {
        for (var cq = 0; cq < (cartItems[ci].quantity || 1); cq++) {
          allVariantIds.push(cartItems[ci].variant_id);
        }
      }
      primaryVariantId = cartItems[0].variant_id;
      primaryQty = 1; // quantity encoded in variant_ids array
    } else if (selectedVariants.length > 1) {
      allVariantIds = selectedVariants.slice();
    }

    var payload = {
      shop: SHOP,
      product_id: currentProductId,
      variant_id: primaryVariantId,
      quantity: primaryQty,
      first_name: getVal('first_name'),
      last_name: getVal('last_name'),
      phone: phone,
      city: getVal('city'),
      province: getVal('province'),
      address1: getVal('address1'),
      address2: getVal('address2'),
      zip: getVal('zip'),
      email: getVal('email'),
      company: getVal('company'),
      note: getVal('note'),
      accepts_marketing: !!(form.querySelector('[name="accepts_marketing"]') && form.querySelector('[name="accepts_marketing"]').checked),
      shipping_price: shippingPrice.toFixed(2),
      discount_code: discountApplied ? discountCode : '',
      bump_variant_ids: acceptedBumpIds.slice(),
      variant_ids: allVariantIds.length > 0 ? allVariantIds : [],
      custom_fields: {},
      upsell_variant_ids: [],
      upsell_discounts: []
    };

    // Collect custom field values (text, select, textarea, date, radio, checkbox, checkbox_group)
    var customEls = form.querySelectorAll('[data-custom="true"]');
    for (var ci = 0; ci < customEls.length; ci++) {
      var cel = customEls[ci];
      // Radio group: find checked radio
      var radioGroup = cel.querySelector('.cod-form__radio-group');
      if (radioGroup) {
        var checkedRadio = radioGroup.querySelector('input[type="radio"]:checked');
        if (checkedRadio) {
          var rKey = checkedRadio.name.replace('custom_', '');
          payload.custom_fields[rKey] = checkedRadio.value;
        }
        continue;
      }
      // Checkbox group: collect all checked values
      var cbGroup = cel.querySelector('.cod-form__checkbox-group');
      if (cbGroup) {
        var checked = cbGroup.querySelectorAll('input[type="checkbox"]:checked');
        if (checked.length) {
          var vals = [];
          for (var cc = 0; cc < checked.length; cc++) vals.push(checked[cc].value);
          var cbKey = checked[0].name.replace('custom_', '');
          payload.custom_fields[cbKey] = vals.join(', ');
        }
        continue;
      }
      // Single checkbox
      var singleCb = cel.querySelector('.cod-form__checkbox-label input[type="checkbox"]');
      if (singleCb) {
        var scKey = singleCb.name.replace('custom_', '');
        payload.custom_fields[scKey] = singleCb.checked ? '1' : '0';
        continue;
      }
      // Standard input/select/textarea
      var cInput = cel.querySelector('input, select, textarea');
      if (cInput && cInput.name && cInput.value) {
        var cKey = cInput.name.replace('custom_', '');
        payload.custom_fields[cKey] = cInput.value.trim();
      }
    }

    // Store payload — order creation deferred until after upsell decision
    pendingPayload = payload;
    pendingUpsellValue = 0;

    // Hide form
    form.hidden = true;

    // Reset submit button + flag for potential retry
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.hidden = false;
    if (submitLoading) submitLoading.hidden = true;
    _submitting = false;

    // Fetch upsell offers before creating the order
    fetchUpsells();
  }

  var _submitting = false;
  document.addEventListener('submit', function (e) {
    if (!e.target || e.target.id !== 'cod-order-form') return;
    e.preventDefault();
    if (_submitting) return;
    _submitting = true;

    // Validation
    clearErrors();
    var form = $('cod-order-form');
    if (!form) return;
    var valid = true;
    // Check all visible required fields (standard + custom)
    var allInputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    for (var i = 0; i < allInputs.length; i++) {
      var input = allInputs[i];
      var wrapper = input.closest('.cod-form__field');
      var rowWrapper = input.closest('.cod-form__row--half');
      // Skip hidden fields (field or parent row hidden)
      if (wrapper && wrapper.hidden) continue;
      if (rowWrapper && rowWrapper.hidden) continue;
      if (!input.value.trim()) {
        var fname = input.getAttribute('name') || '';
        var reqErr = L.required_field;
        showFieldError(fname, reqErr);
        valid = false;
      }
    }
    var phoneVal = (form.querySelector('[name="phone"]').value || '').replace(/[\s-]/g, '');
    var phonePattern = _phonePattern;
    var phoneError = L.phone_error;
    if (phoneVal && !phoneVal.match(phonePattern)) {
      showFieldError('phone', phoneError);
      valid = false;
    }
    if (!valid) { _submitting = false; return; }

    if (!COD_API) { _submitting = false;
      var errorBox = $('cod-error-box');
      var errorMsg = $('cod-error-msg');
      if (errorBox && errorMsg) { errorBox.hidden = false; errorMsg.textContent = 'COD API URL not configured.'; }
      return;
    }

    // OTP flow: if enabled and not yet verified for this phone, send OTP first
    var phone = form.querySelector('[name="phone"]').value.replace(/[\s-]/g, '');
    if (otpEnabled && !otpVerified) {
      var submitBtn = $('cod-submit-btn');
      if (submitBtn) submitBtn.disabled = true;
      sendOtp(phone, function (sent, error) {
        if (submitBtn) submitBtn.disabled = false;
        if (sent) {
          showOtpPopup(phone, function () {
            // OTP verified — now submit the actual order
            submitOrderRequest(form);
          });
        } else {
          var errBox = $('cod-error-box');
          var errMsg = $('cod-error-msg');
          if (errBox && errMsg) {
            errBox.hidden = false;
            errMsg.textContent = error || L.otp_error;
          }
        }
      });
      return;
    }

    // No OTP or already verified — submit directly
    submitOrderRequest(form);
  });

  /* ── Conversion Tracking ── */
  // All conversion tracking (Meta, Google, TikTok, etc.) is handled by
  // WeTracked server-side. The COD form must NOT fire pixel events — doing
  // so causes duplicate Purchase events in Meta and other ad platforms.
  function fireConversionPixels() {}

  /* ── Upsell functions (deferred order flow) ── */
  function fetchUpsells() {
    if (!currentProductId) {
      createOrderFromPending();
      return;
    }
    // Show #cod-success (parent of #cod-upsells) but hide success content
    var successDiv = $('cod-success');
    if (successDiv) {
      successDiv.hidden = false;
      // Hide ALL success children except #cod-upsells
      for (var si = 0; si < successDiv.children.length; si++) {
        if (successDiv.children[si].id !== 'cod-upsells') {
          successDiv.children[si].style.display = 'none';
        }
      }
      // Explicitly hide the close button during upsell
      var closeBtn = $('cod-success-close');
      if (closeBtn) closeBtn.style.display = 'none';
    }
    // Show loading in upsell container
    var preContainer = $('cod-upsells');
    if (preContainer) {
      preContainer.innerHTML = '<div style="text-align:center;padding:3rem 1rem">'
        + '<div class="cod-form__submit-loading" style="display:inline-block;width:32px;height:32px;border-width:3px"></div>'
        + '<p style="margin-top:1rem;color:#555;font-size:15px">'
        + L.upsell_loading
        + '</p></div>';
      preContainer.hidden = false;
    }
    var url = COD_API + '/api/cod/upsells?shop=' + encodeURIComponent(SHOP) +
      '&product_id=' + currentProductId;
    fetch(url)
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        if (data.products && data.products.length > 0) {
          renderUpsells(data.products);
        } else {
          createOrderFromPending();
        }
      })
      .catch(function () {
        // Upsell fetch failed — create order without upsells
        createOrderFromPending();
      });
  }

  function createOrderFromPending() {
    if (!pendingPayload) return;

    var upsellContainer = $('cod-upsells');

    // Show loading state — ensure parent (#cod-success) is visible
    var successParent = $('cod-success');
    if (successParent) {
      successParent.hidden = false;
      for (var li = 0; li < successParent.children.length; li++) {
        if (successParent.children[li].id !== 'cod-upsells') {
          successParent.children[li].style.display = 'none';
        }
      }
    }
    if (upsellContainer) {
      upsellContainer.innerHTML = '<div style="text-align:center;padding:3rem 1rem">'
        + '<div class="cod-form__submit-loading" style="display:inline-block;width:32px;height:32px;border-width:3px"></div>'
        + '<p style="margin-top:1rem;color:#555;font-size:15px">'
        + L.upsell_creating
        + '</p></div>';
      upsellContainer.hidden = false;
    }

    var headers = { 'Content-Type': 'application/json' };
    if (COD_KEY && !IS_PROXY) headers['X-COD-Key'] = COD_KEY;

    fetch(COD_API + '/api/cod/order', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(pendingPayload)
    })
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        if (data.success) {
          orderPlaced = true;
          pendingPayload = null;
          if (upsellContainer) upsellContainer.hidden = true;

          var successDiv = $('cod-success');
          if (successDiv) {
            successDiv.hidden = false;
            // Restore all success children (were hidden during upsell phase)
            for (var ri = 0; ri < successDiv.children.length; ri++) {
              successDiv.children[ri].style.display = '';
            }
            var orderNameEl = $('cod-order-name');
            if (orderNameEl) orderNameEl.textContent = L.order_prefix + ' ' + data.order_name;
          }
          var successCloseBtn = $('cod-success-close');
          if (successCloseBtn) successCloseBtn.style.display = '';

          // Fire pixels with total including upsells
          var disc = getDiscountAmount();
          var totalValue = unitPrice * quantity - disc.amount + shippingPrice + pendingUpsellValue;
          fireConversionPixels(data.order_name, Math.max(0, totalValue));
          trackEvent('order_success', { order_value: Math.max(0, totalValue) });
          codCart.clear();
          updateButtonBadge();
        } else {
          showOrderError(data.error || L.connection_error);
        }
      })
      .catch(function () {
        showOrderError(L.connection_error);
      });
  }

  function showOrderError(msg) {
    var target = $('cod-upsells') || $('cod-success');
    if (!target) return;
    target.hidden = false;
    target.innerHTML = '<div style="text-align:center;padding:2rem">'
      + '<p style="color:#c00;margin-bottom:1rem;font-size:15px">' + msg + '</p>'
      + '<button type="button" id="cod-retry-order" style="padding:0.75rem 1.5rem;background:#b5a1e0;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">'
      + L.retry
      + '</button></div>';
    var retryBtn = document.getElementById('cod-retry-order');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        createOrderFromPending();
      });
    }
  }

  function renderUpsells(products) {
    var container = $('cod-upsells');
    if (!container) {
      createOrderFromPending();
      return;
    }

    var timerInterval = null;

    function showUpsellOffer(idx) {
      if (idx >= products.length) {
        // All offers processed — create order with any accepted upsells
        createOrderFromPending();
        return;
      }
      var p = products[idx];
      // Per-offer config from formConfig.upsell_config
      var uc = (formConfig && formConfig.upsell_config) || {};
      var offerCfg = null;
      if (uc.offers) {
        for (var oi = 0; oi < uc.offers.length; oi++) {
          if (uc.offers[oi].product_id === p.product_id) { offerCfg = uc.offers[oi]; break; }
        }
      }
      // Use configured discount_amount if set, otherwise fall back to compare_at_price difference
      var configuredDiscount = (offerCfg && offerCfg.discount_amount) ? parseFloat(offerCfg.discount_amount) : 0;
      var hasCompare = configuredDiscount > 0 || (p.compare_at_price && parseFloat(p.compare_at_price) > parseFloat(p.price));
      var savings = configuredDiscount > 0 ? configuredDiscount.toFixed(2) : (hasCompare ? (parseFloat(p.compare_at_price) - parseFloat(p.price)).toFixed(2) : 0);
      var timerDur = (offerCfg && offerCfg.timer_duration) || uc.default_timer_duration || 60;
      var acceptText = (offerCfg && offerCfg.accept_text) || uc.default_accept_text || L.accept_offer;
      var rejectText = (offerCfg && offerCfg.reject_text) || uc.default_reject_text || L.reject_offer;
      var headerText = (offerCfg && offerCfg.header_text) || (L.upsell_offer_prefix + ' ' + p.title + '?');
      var subheaderText = (offerCfg && offerCfg.subheader_text) || '';
      var acceptColor = (offerCfg && offerCfg.accept_color) || '';

      var timerMins = Math.floor(timerDur / 60);
      var timerSecs = timerDur % 60;
      var timerStr = (timerMins < 10 ? '0' : '') + timerMins + ':' + (timerSecs < 10 ? '0' : '') + timerSecs;

      var savingsAmt = savings > 0 ? parseFloat(savings).toFixed(0) : 0;
      var cur = p.currency || CURRENCY;
      var regularPrice = parseFloat(p.price);
      var upsellPrice = hasCompare ? (regularPrice - parseFloat(savings)) : regularPrice;
      var displayCompare = configuredDiscount > 0 ? regularPrice : (hasCompare ? parseFloat(p.compare_at_price) : 0);
      var rejectFinalText = L.upsell_no_thanks;

      var html = '<div class="cod-upsell-page">';

      // Gift discount banner
      if (savingsAmt > 0) {
        html += '<div class="cod-upsell-page__gift">'
          + '\ud83c\udf81 ' + savingsAmt + ' ' + cur
          + ' ' + L.upsell_gift_discount
          + ' \ud83c\udf81</div>';
      }

      // Large countdown timer block
      html += '<div class="cod-upsell-page__timer-block" id="cod-upsell-timer">';
      html += '<div class="cod-upsell-page__timer-label">'
        + L.upsell_available_only
        + '</div>';
      html += '<div class="cod-upsell-page__timer-countdown" id="cod-upsell-countdown">'
        + timerStr + '</div>';
      html += '</div>';

      // Heading
      html += '<h3 class="cod-upsell-page__heading">' + headerText + '</h3>';

      // Product image
      if (p.image_url) {
        html += '<img class="cod-upsell-page__img" src="' + p.image_url + '&width=600" alt="' + p.title + '" loading="lazy">';
      }

      // Product description
      if (subheaderText) {
        html += '<p class="cod-upsell-page__description">' + subheaderText + '</p>';
      }

      // Variant selector (if multiple variants)
      if (p.variants && p.variants.length > 1) {
        html += '<div class="cod-upsell-page__variants">';
        html += '<select class="cod-upsell-page__variant-select" id="cod-upsell-variant-select">';
        for (var vi = 0; vi < p.variants.length; vi++) {
          var v = p.variants[vi];
          var isDefault = (v.variant_id === p.variant_id);
          html += '<option value="' + v.variant_id + '"'
            + ' data-price="' + v.price + '"'
            + ' data-compare="' + (v.compare_at_price || '') + '"'
            + ' data-image="' + (v.image_url || '') + '"'
            + (isDefault ? ' selected' : '') + '>'
            + v.title + '</option>';
        }
        html += '</select>';
        html += '</div>';
      }

      // Discount badge
      if (savingsAmt > 0) {
        html += '<div class="cod-upsell-page__discount-badge">- ' + savingsAmt + ' ' + cur + '</div>';
      }

      // Price — regular crossed out + discounted upsell price
      html += '<div class="cod-upsell-page__pricing">';
      if (hasCompare) {
        html += '<span class="cod-upsell-page__old-price">' + regularPrice.toFixed(2) + ' ' + cur + '</span> ';
      }
      html += '<span class="cod-upsell-page__new-price">' + upsellPrice.toFixed(2) + ' ' + cur + '</span>';
      html += '</div>';

      // Accept button
      html += '<button type="button" class="cod-upsell-page__accept" id="cod-upsell-accept"'
        + ' data-variant="' + p.variant_id + '" data-price="' + upsellPrice.toFixed(2) + '" data-title="' + p.title + '"'
        + (acceptColor ? ' style="background:' + acceptColor + '"' : '') + '>'
        + acceptText + '</button>';

      // Decline button (finalizes order)
      html += '<button type="button" class="cod-upsell-page__reject" id="cod-upsell-reject">'
        + rejectFinalText + '</button>';

      html += '</div>';

      container.innerHTML = html;
      container.hidden = false;
      trackEvent('upsell_impression', { upsell_variant_id: p.variant_id });

      // Start timer
      var timeLeft = timerDur;
      var countdownEl = $('cod-upsell-countdown');
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(function () {
        timeLeft--;
        if (countdownEl) {
          var mins = Math.floor(timeLeft / 60);
          var secs = timeLeft % 60;
          countdownEl.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
        }
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          // Timeout — auto-proceed to next offer (or create order if last)
          showUpsellOffer(idx + 1);
        }
      }, 1000);

      // Accept button — add upsell to pending order, show next
      var acceptBtn = $('cod-upsell-accept');
      if (acceptBtn) {
        acceptBtn.addEventListener('click', function () {
          acceptBtn.disabled = true;
          acceptBtn.textContent = L.upsell_added;
          acceptBtn.classList.add('cod-upsells__added');
          clearInterval(timerInterval);

          var selectedVariantId = parseInt(acceptBtn.getAttribute('data-variant'), 10) || p.variant_id;
          var selPrice = parseFloat(acceptBtn.getAttribute('data-price')) || upsellPrice;

          // Add to pending order payload
          pendingPayload.upsell_variant_ids.push(selectedVariantId);
          var discountAmt = hasCompare ? parseFloat(savings) : 0;
          pendingPayload.upsell_discounts.push(discountAmt > 0 ? discountAmt.toFixed(2) : '');
          pendingUpsellValue += selPrice;

          trackEvent('upsell_accept', { upsell_variant_id: selectedVariantId, upsell_value: selPrice });

          // Show next offer or create order
          setTimeout(function () {
            showUpsellOffer(idx + 1);
          }, 800);
        });
      }

      // Reject button — skip all remaining, create order now
      var rejectBtn = $('cod-upsell-reject');
      if (rejectBtn) {
        rejectBtn.addEventListener('click', function () {
          clearInterval(timerInterval);
          trackEvent('upsell_reject', { upsell_variant_id: p.variant_id });
          createOrderFromPending();
        });
      }

      // Variant selector change handler
      var variantSelect = $('cod-upsell-variant-select');
      if (variantSelect) {
        variantSelect.addEventListener('change', function () {
          var opt = variantSelect.options[variantSelect.selectedIndex];
          var newVariantId = parseInt(opt.value, 10);
          var newPrice = parseFloat(opt.getAttribute('data-price')) || 0;
          var newCompare = opt.getAttribute('data-compare') || '';
          var newImage = opt.getAttribute('data-image') || '';
          var newHasCompare = newCompare && parseFloat(newCompare) > newPrice;
          var newSavings = newHasCompare ? parseFloat(newCompare) - newPrice : 0;
          var newRegular = newPrice;
          var newUpsellPrice = newHasCompare ? (newRegular - newSavings) : newRegular;

          // Update accept button
          if (acceptBtn) {
            acceptBtn.setAttribute('data-variant', newVariantId);
            acceptBtn.setAttribute('data-price', newUpsellPrice.toFixed(2));
          }

          // Update pricing display
          var oldPriceEl = container.querySelector('.cod-upsell-page__old-price');
          var newPriceEl = container.querySelector('.cod-upsell-page__new-price');
          if (newHasCompare) {
            if (oldPriceEl) { oldPriceEl.textContent = newRegular.toFixed(2) + ' ' + cur; oldPriceEl.style.display = ''; }
            else {
              var pricingDiv = container.querySelector('.cod-upsell-page__pricing');
              if (pricingDiv && newPriceEl) {
                var sp = document.createElement('span');
                sp.className = 'cod-upsell-page__old-price';
                sp.textContent = newRegular.toFixed(2) + ' ' + cur;
                pricingDiv.insertBefore(sp, newPriceEl);
              }
            }
          } else {
            if (oldPriceEl) oldPriceEl.style.display = 'none';
          }
          if (newPriceEl) newPriceEl.textContent = newUpsellPrice.toFixed(2) + ' ' + cur;

          // Update discount badge
          var badgeEl = container.querySelector('.cod-upsell-page__discount-badge');
          if (newSavings > 0) {
            if (badgeEl) badgeEl.textContent = '- ' + newSavings.toFixed(0) + ' ' + cur;
          } else if (badgeEl) {
            badgeEl.style.display = 'none';
          }

          // Update image
          if (newImage) {
            var imgEl = container.querySelector('.cod-upsell-page__img');
            if (imgEl) imgEl.src = newImage + '&width=600';
          }

          // Update stored values
          regularPrice = newRegular;
          upsellPrice = newUpsellPrice;
          hasCompare = newHasCompare;
        });
      }
    }

    showUpsellOffer(0);
  }

    /* ── Mobile sticky buy button ── */
  function createStickyBar() {
    if (document.querySelector('.cod-sticky-bar')) return;
    var bar = document.createElement('div');
    bar.className = 'cod-sticky-bar';
    bar.id = 'cod-sticky-bar';
    bar.innerHTML = '<span class="cod-sticky-bar__price">' + formatMoney(unitPrice) + '</span>'
      + '<button type="button" class="cod-sticky-bar__btn" id="cod-sticky-open">' + L.sticky_cta + '</button>';
    document.body.appendChild(bar);
    document.body.classList.add('cod-sticky-active');

    bar.addEventListener('click', function (e) {
      if (e.target.id === 'cod-sticky-open' || e.target.closest('#cod-sticky-open')) {
        e.preventDefault();
        openForm();
      }
    });

    // Show/hide based on main button visibility
    var mainBtn = $('cod-form-open');
    if (mainBtn && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (e.isIntersecting) {
            bar.classList.remove('cod-sticky-bar--visible');
          } else if (e.boundingClientRect.bottom < 0) {
            bar.classList.add('cod-sticky-bar--visible');
          }
        }
      }, { threshold: 0 });
      observer.observe(mainBtn);
    }
  }

  // Create sticky bar on mobile (check via matchMedia) — respects config
  function initStickyBar() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 767px)').matches) return;
    // Check config if loaded, otherwise create (default enabled)
    if (formConfig && formConfig.settings && formConfig.settings.sticky_buy_button === false) return;
    createStickyBar();
  }
  setTimeout(initStickyBar, 600);

  /* ── Auto-inject trigger button if not already in DOM ── */
  if (!document.getElementById('cod-form-open')) {
    var anchor = document.querySelector(
      'form[action*="/cart/add"] [type="submit"], ' +
      '.product-form__submit, .product__submit, ' +
      '[data-add-to-cart], .shopify-payment-button'
    );
    if (anchor) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cod-form-trigger';
      btn.id = 'cod-form-open';
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.textContent = L.sticky_cta_long;
      anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    }
  }

  /* ── Init totals ── */
  updateTotals();
})();
