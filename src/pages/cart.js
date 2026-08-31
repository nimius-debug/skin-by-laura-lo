import { html, jsonScript } from "../html.js";
import { formatMoney } from "../config.js";

/**
 * The cart lives in localStorage, so its contents are rendered by
 * /assets/cart.js on the client. This page ships the shell plus the
 * shipping rules, so the summary can be previewed without a round trip.
 */
export function cartPage({ cfg }) {
  const rules = {
    shippingEnabled: cfg.shippingEnabled,
    shippingFeeCents: cfg.shippingFeeCents,
    freeShippingThresholdCents: cfg.freeShippingThresholdCents,
    shippingLabel: cfg.shippingLabel,
    pickupEnabled: cfg.pickupEnabled,
  };

  return html`
    <div class="cart-page section-shell">
      <div class="cart-heading">
        <p class="eyebrow">Your bag</p>
        <h1>The <em>bag</em></h1>
      </div>

      <div data-cart-root>
        <div class="empty-cart" data-cart-loading>
          <p class="eyebrow">One moment</p>
          <h1>Opening your bag&#8230;</h1>
        </div>
      </div>
    </div>

    <template data-cart-empty-template>
      <div class="empty-cart">
        <p class="eyebrow">Your bag</p>
        <h1>Nothing in here <em>yet.</em></h1>
        <p>When you find something you like, it&#8217;ll wait for you here.</p>
        <a class="button button-dark" href="/shop">Shop the shelf</a>
      </div>
    </template>

    <script>
      window.__CART_RULES__ = ${jsonScript(rules)};
      window.__MONEY_SAMPLE__ = ${jsonScript(formatMoney(cfg.shippingFeeCents))};
    </script>
  `;
}

export function thankYouPage() {
  return html`
    <div class="success-page section-shell">
      <div class="success-mark" aria-hidden="true">&#10003;</div>
      <p class="eyebrow">Order confirmed</p>
      <h1>Thank you &#8212; <em>that&#8217;s all set.</em></h1>
      <p>
        Square has emailed your receipt. If you chose local pickup, Laura will be in
        touch when your order is ready at the Tampa studio.
      </p>
      <div class="button-row">
        <a class="button button-dark" href="/shop">Keep shopping</a>
        <a class="text-link" href="/">Back home <span aria-hidden="true">&#8594;</span></a>
      </div>
    </div>
    <script>window.__CLEAR_CART__ = true;</script>
  `;
}
