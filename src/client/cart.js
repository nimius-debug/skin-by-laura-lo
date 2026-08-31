// Storefront client script. Plain ES2020, no build step, no dependencies.
//
// The cart is browser-only state: a list of Square variation ids and
// quantities in localStorage. Prices shown here are for display; the real
// order is always priced by Square from its own catalog at checkout.

export const CLIENT_JS = String.raw`
(function () {
  "use strict";

  var CART_KEY = "laura-lo-cart";
  var MAX_QTY = 10;

  /* ---------------------------------------------------------------- store */

  function readCart() {
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (item) { return item && typeof item.id === "string"; })
        .map(function (item) {
          var qty = parseInt(item.qty, 10);
          return { id: item.id, qty: Math.min(Math.max(isNaN(qty) ? 1 : qty, 1), MAX_QTY) };
        });
    } catch (error) {
      return [];
    }
  }

  function writeCart(items) {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (error) { /* private mode — cart just won't persist */ }
    paintCount(items);
    document.dispatchEvent(new CustomEvent("cart:change", { detail: items }));
  }

  function addToCart(id, qty) {
    var items = readCart();
    var existing = null;
    for (var i = 0; i < items.length; i++) if (items[i].id === id) existing = items[i];
    if (existing) existing.qty = Math.min(existing.qty + qty, MAX_QTY);
    else items.push({ id: id, qty: Math.min(qty, MAX_QTY) });
    writeCart(items);
  }

  function setQty(id, qty) {
    var items = readCart().map(function (item) {
      return item.id === id ? { id: id, qty: Math.min(Math.max(qty, 1), MAX_QTY) } : item;
    });
    if (qty <= 0) items = items.filter(function (item) { return item.id !== id; });
    writeCart(items);
  }

  function removeFromCart(id) {
    writeCart(readCart().filter(function (item) { return item.id !== id; }));
  }

  function countItems(items) {
    return items.reduce(function (total, item) { return total + item.qty; }, 0);
  }

  function paintCount(items) {
    var count = countItems(items || readCart());
    var nodes = document.querySelectorAll("[data-cart-count]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = String(count);
  }

  function money(cents) {
    return "$" + (Math.round(cents) / 100).toFixed(2);
  }

  /* --------------------------------------------------------------- chrome */

  function initNav() {
    var button = document.querySelector(".menu-button");
    var nav = document.getElementById("primary-nav");
    if (!button || !nav) return;
    button.addEventListener("click", function () {
      var open = nav.classList.toggle("nav-open");
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (event) {
      if (event.target.tagName === "A") {
        nav.classList.remove("nav-open");
        button.setAttribute("aria-expanded", "false");
      }
    });
  }

  var toastTimer = null;
  function showToast(name) {
    var existing = document.querySelector(".cart-toast");
    if (existing) existing.remove();
    var toast = document.createElement("div");
    toast.className = "cart-toast";
    toast.setAttribute("role", "status");
    var label = document.createElement("span");
    label.textContent = name + " added to your bag";
    var link = document.createElement("a");
    link.href = "/cart";
    link.textContent = "View bag";
    toast.appendChild(label);
    toast.appendChild(link);
    document.body.appendChild(toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.remove(); }, 4000);
  }

  /* ----------------------------------------------------------- add to cart */

  function initAddButtons() {
    document.addEventListener("click", function (event) {
      var button = event.target.closest("[data-add-to-cart]");
      if (!button || button.disabled) return;
      event.preventDefault();

      var id = button.getAttribute("data-add-to-cart");
      var qty = 1;
      if (button.hasAttribute("data-use-qty")) {
        var value = document.querySelector("[data-qty-value]");
        qty = value ? parseInt(value.textContent, 10) || 1 : 1;
      }
      addToCart(id, qty);
      showToast(button.getAttribute("data-name") || "Item");
    });
  }

  /* --------------------------------------------------------- product page */

  function initProductPage() {
    var value = document.querySelector("[data-qty-value]");
    if (value) {
      document.addEventListener("click", function (event) {
        var step = event.target.closest("[data-qty-step]");
        if (!step) return;
        var next = (parseInt(value.textContent, 10) || 1) + parseInt(step.getAttribute("data-qty-step"), 10);
        value.textContent = String(Math.min(Math.max(next, 1), MAX_QTY));
      });
    }

    var variations = window.__PRODUCT_VARIATIONS__;
    if (!variations) return;
    var addButton = document.querySelector("[data-add-to-cart][data-use-qty]");
    var priceDisplay = document.querySelector("[data-price-display]");

    document.addEventListener("click", function (event) {
      var choice = event.target.closest("[data-variation]");
      if (!choice || choice.disabled) return;
      var id = choice.getAttribute("data-variation");
      var siblings = document.querySelectorAll("[data-variation]");
      for (var i = 0; i < siblings.length; i++) siblings[i].classList.remove("active");
      choice.classList.add("active");
      if (addButton) addButton.setAttribute("data-add-to-cart", id);
      if (priceDisplay && variations[id]) priceDisplay.textContent = variations[id].price;
    });
  }

  /* ------------------------------------------------------------ shop page */

  function initShopFilters() {
    var grid = document.querySelector("[data-product-grid]");
    if (!grid) return;

    var items = Array.prototype.slice.call(grid.querySelectorAll("[data-product-item]"));
    var pills = Array.prototype.slice.call(document.querySelectorAll("[data-filter]"));
    var search = document.getElementById("shop-search-input");
    var countLabel = document.querySelector("[data-shop-count]");
    var emptyState = document.querySelector("[data-shop-empty]");
    var activeFilter = "all";

    function apply() {
      var term = (search && search.value || "").trim().toLowerCase();
      var visible = 0;

      items.forEach(function (item) {
        var matchesCategory = activeFilter === "all" || item.getAttribute("data-category") === activeFilter;
        var matchesTerm = !term || item.getAttribute("data-name").indexOf(term) !== -1;
        var show = matchesCategory && matchesTerm;
        item.hidden = !show;
        if (show) visible++;
      });

      if (countLabel) countLabel.textContent = visible + " product" + (visible === 1 ? "" : "s");
      if (emptyState) emptyState.hidden = visible !== 0;
      grid.hidden = visible === 0;
    }

    pills.forEach(function (pill) {
      pill.addEventListener("click", function () {
        pills.forEach(function (other) { other.classList.remove("active"); });
        pill.classList.add("active");
        activeFilter = pill.getAttribute("data-filter");
        apply();
      });
    });

    if (search) search.addEventListener("input", apply);

    var reset = document.querySelector("[data-shop-reset]");
    if (reset) reset.addEventListener("click", function () {
      if (search) search.value = "";
      activeFilter = "all";
      pills.forEach(function (other) { other.classList.remove("active"); });
      if (pills[0]) pills[0].classList.add("active");
      apply();
    });
  }

  /* ------------------------------------------------------------ cart page */

  function initCartPage() {
    var root = document.querySelector("[data-cart-root]");
    if (!root) return;

    var rules = window.__CART_RULES__ || {};
    var fulfillment = rules.pickupEnabled && !rules.shippingEnabled ? "pickup" : "shipping";
    var catalog = null;

    function emptyMarkup() {
      var template = document.querySelector("[data-cart-empty-template]");
      return template ? template.innerHTML : "<p>Your bag is empty.</p>";
    }

    function lineFor(item) {
      var entry = catalog && catalog[item.id];
      if (!entry) return null;
      return { item: item, entry: entry, total: entry.priceCents * item.qty };
    }

    function render() {
      var cart = readCart();
      if (!cart.length) { root.innerHTML = emptyMarkup(); return; }

      var lines = cart.map(lineFor).filter(Boolean);
      if (!lines.length) { root.innerHTML = emptyMarkup(); return; }

      var subtotal = lines.reduce(function (total, line) { return total + line.total; }, 0);
      var shipping = 0;
      if (fulfillment === "shipping" && rules.shippingEnabled) {
        var threshold = rules.freeShippingThresholdCents || 0;
        shipping = (threshold > 0 && subtotal >= threshold) ? 0 : (rules.shippingFeeCents || 0);
      }

      var rowsHtml = lines.map(function (line) {
        var entry = line.entry;
        var image = entry.image
          ? '<img src="' + escapeAttr(entry.image) + '" alt="' + escapeAttr(entry.name) + '" />'
          : '<div class="product-image-fallback">' + escapeHtml(entry.name) + "</div>";
        return '' +
          '<div class="cart-row">' +
            '<div class="cart-image">' + image + "</div>" +
            '<div class="cart-item-info">' +
              '<p class="product-category">' + escapeHtml(entry.category || "") + "</p>" +
              "<h2>" + escapeHtml(entry.name) + "</h2>" +
              (entry.variationName ? "<p>" + escapeHtml(entry.variationName) + "</p>" : "") +
              '<div class="quantity-control">' +
                '<button type="button" data-line-step="-1" data-id="' + escapeAttr(line.item.id) + '" aria-label="Decrease quantity">&#8722;</button>' +
                "<span>" + line.item.qty + "</span>" +
                '<button type="button" data-line-step="1" data-id="' + escapeAttr(line.item.id) + '" aria-label="Increase quantity">+</button>' +
              "</div>" +
            "</div>" +
            '<div class="cart-item-end">' +
              "<strong>" + money(line.total) + "</strong>" +
              '<button type="button" data-line-remove="' + escapeAttr(line.item.id) + '">Remove</button>' +
            "</div>" +
          "</div>";
      }).join("");

      var fulfilHtml = "";
      if (rules.shippingEnabled || rules.pickupEnabled) {
        fulfilHtml =
          '<fieldset class="fulfillment-options">' +
            "<legend>How would you like it?</legend>" +
            (rules.shippingEnabled
              ? '<label class="' + (fulfillment === "shipping" ? "selected" : "") + '">' +
                  '<input type="radio" name="fulfillment" value="shipping"' + (fulfillment === "shipping" ? " checked" : "") + " />" +
                  "<span><strong>Ship to me</strong><small>U.S. delivery</small></span>" +
                  "<span>" + (shipping === 0 && fulfillment === "shipping" ? "Free" : money(rules.shippingFeeCents || 0)) + "</span>" +
                "</label>"
              : "") +
            (rules.pickupEnabled
              ? '<label class="' + (fulfillment === "pickup" ? "selected" : "") + '">' +
                  '<input type="radio" name="fulfillment" value="pickup"' + (fulfillment === "pickup" ? " checked" : "") + " />" +
                  "<span><strong>Pick up in Tampa</strong><small>307 South Boulevard, Suite D</small></span>" +
                  "<span>Free</span>" +
                "</label>"
              : "") +
          "</fieldset>";
      }

      var progressHtml = "";
      var threshold = rules.freeShippingThresholdCents || 0;
      if (fulfillment === "shipping" && rules.shippingEnabled && threshold > 0) {
        var pct = Math.min(100, Math.round((subtotal / threshold) * 100));
        progressHtml =
          '<div class="shipping-progress">' +
            '<div><span style="width:' + pct + '%"></span></div>' +
            "<p>" + (subtotal >= threshold
              ? "You&#8217;ve earned free U.S. shipping."
              : money(threshold - subtotal) + " away from free U.S. shipping.") + "</p>" +
          "</div>";
      }

      root.innerHTML =
        '<div class="cart-layout">' +
          "<div>" + rowsHtml +
            '<a class="text-link continue-shopping" href="/shop">Continue shopping <span aria-hidden="true">&#8594;</span></a>' +
          "</div>" +
          '<aside class="cart-summary">' +
            "<h2>Summary</h2>" +
            fulfilHtml +
            progressHtml +
            '<div class="summary-lines">' +
              "<p><span>Subtotal</span><span>" + money(subtotal) + "</span></p>" +
              "<p><span>" + (fulfillment === "pickup" ? "Pickup" : "Shipping") + "</span><span>" +
                (fulfillment === "pickup" ? "Free" : (shipping === 0 ? "Free" : money(shipping))) + "</span></p>" +
              "<p><span>Tax</span><span><small>Calculated by Square</small></span></p>" +
              '<p class="summary-total"><span>Total</span><span>' + money(subtotal + shipping) + "</span></p>" +
            "</div>" +
            '<button class="button button-dark checkout-button" type="button" data-checkout>Checkout with Square</button>' +
            '<div class="checkout-error" data-checkout-error hidden></div>' +
            '<div class="secure-note"><p>You&#8217;ll finish payment on Square&#8217;s secure checkout. Card details never touch this site.</p></div>' +
          "</aside>" +
        "</div>";
    }

    function escapeHtml(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function escapeAttr(value) {
      return escapeHtml(value).replace(/"/g, "&quot;");
    }

    root.addEventListener("click", function (event) {
      var step = event.target.closest("[data-line-step]");
      if (step) {
        var id = step.getAttribute("data-id");
        var current = readCart().filter(function (item) { return item.id === id; })[0];
        if (current) setQty(id, current.qty + parseInt(step.getAttribute("data-line-step"), 10));
        return;
      }
      var remove = event.target.closest("[data-line-remove]");
      if (remove) { removeFromCart(remove.getAttribute("data-line-remove")); return; }

      var checkout = event.target.closest("[data-checkout]");
      if (checkout) { startCheckout(checkout); }
    });

    root.addEventListener("change", function (event) {
      if (event.target.name !== "fulfillment") return;
      fulfillment = event.target.value;
      render();
    });

    function startCheckout(button) {
      var errorBox = document.querySelector("[data-checkout-error]");
      var cart = readCart();
      if (!cart.length) return;

      button.disabled = true;
      button.textContent = "Opening Square…";
      if (errorBox) errorBox.hidden = true;

      fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart, fulfillment: fulfillment }),
      })
        .then(function (response) {
          return response.json().then(function (data) { return { ok: response.ok, data: data }; });
        })
        .then(function (result) {
          if (result.ok && result.data.url) {
            window.location.href = result.data.url;
            return;
          }
          throw new Error(result.data && result.data.message
            ? result.data.message
            : "Checkout is temporarily unavailable. Please try again.");
        })
        .catch(function (error) {
          button.disabled = false;
          button.textContent = "Checkout with Square";
          if (errorBox) {
            errorBox.hidden = false;
            errorBox.textContent = error.message;
          }
        });
    }

    document.addEventListener("cart:change", render);

    fetch("/api/catalog")
      .then(function (response) { return response.json(); })
      .then(function (data) { catalog = data.variations || {}; render(); })
      .catch(function () {
        root.innerHTML = '<div class="empty-cart"><h1>We couldn&#8217;t load your bag</h1>' +
          "<p>Please refresh the page and try again.</p></div>";
      });
  }

  /* ---------------------------------------------------------------- boot */

  function init() {
    paintCount();
    initNav();
    initAddButtons();
    initProductPage();
    initShopFilters();
    initCartPage();
    if (window.__CLEAR_CART__) writeCart([]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
`;
