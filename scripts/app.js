import {
  addToCart,
  changeQty,
  formatRub,
  clearCart,
  getCartCount,
  getCartTotal,
  getLineQty,
  removeFromCart,
} from "./cart.js";
import { buildOrderMessage, sendOrderViaFormSubmit } from "./submit-order.js";
import { bindAllPhoneInputs, setPhoneValidity } from "./phone-ru.js";
import { bindDateTimeInputs, dateTimeInputsAreValid, validateDateTimeInputs } from "./date-time-input.js";
import { pictureHtml, setResponsiveImage } from "./media.js";
import { bindSeo } from "./seo.js";

const cartDialog = document.getElementById("cart-modal");
const productDialog = document.getElementById("product-modal");
const cartList = document.getElementById("cart-list");
const cartTotalEl = document.getElementById("cart-total-sum");
const cartBadge = document.getElementById("cart-badge");
const cartEmpty = document.getElementById("cart-empty");
const checkoutForm = document.getElementById("checkout-form");

let siteData = null;
let productsById = new Map();
const CATALOG_ALL = "all";
let activeSectionId = CATALOG_ALL;
let productImage = "assets/logo-mark.png";
let openProductId = null;
const activeTagBySection = {};

function showDialog(dialog) {
  const scrollY = window.scrollY;
  dialog.showModal();
  document.body.classList.add("dialog-open");
  window.scrollTo(0, scrollY);
}

async function loadSite() {
  const response = await fetch("data/site.json");
  if (!response.ok) throw new Error("Не удалось загрузить data/site.json");
  siteData = await response.json();
  siteData.products = buildTestCatalog(siteData.products, siteData.nav);
  productImage = siteData.productImage || "assets/logo-mark.png";
  productsById = new Map(siteData.products.map((product) => [product.id, product]));
}

function buildTestCatalog(products, sections) {
  const variants = [
    "Классический",
    "Нежный",
    "Яркий",
    "Праздничный",
    "Премиум",
    "Мини",
    "Большой",
    "С декором",
    "На заказ",
    "Популярный",
  ];

  return sections.flatMap((section) => {
    const source = products.filter((product) => product.section === section.id);
    if (!source.length) return [];

    return Array.from({ length: 10 }, (_, index) => {
      const base = source[index % source.length];
      if (index < source.length) return base;
      const price = base.price + index * 50;
      return {
        ...base,
        id: `${section.id}-test-${index + 1}`,
        title: `${base.title} · ${variants[index]}`,
        price,
        priceLabel: `от ${formatRub(price)}`,
        badge: index === 4 ? "Хит" : undefined,
      };
    });
  });
}

function productImagePath(product) {
  return product?.image || productImage;
}

function productMediaHtml(product) {
  return pictureHtml(productImagePath(product), {
    alt: product?.title || "Товар ШАРПРАЙЗ",
    width: 400,
    height: 400,
    loading: "lazy",
  });
}

function productActionsHtml(productId) {
  const qty = getLineQty(productId);
  if (qty === 0) {
    return `<button class="btn btn--add" type="button" data-add-cart="${productId}">Добавить</button>`;
  }
  return `
    <div class="product-card-qty">
      <div class="product-card-qty__controls">
        <button type="button" class="qty-btn" data-card-minus="${productId}" aria-label="Меньше">−</button>
        <span class="product-card-qty__value">${qty}</span>
        <button type="button" class="qty-btn" data-card-plus="${productId}" aria-label="Больше">+</button>
      </div>
    </div>`;
}

function productCardHtml(product) {
  return `
    <li class="product" data-product-id="${product.id}">
      <button class="product__open" type="button" data-product-open="${product.id}">
        <div class="product__media">
          ${product.badge ? `<span class="product__badge">${product.badge}</span>` : ""}
          ${productMediaHtml(product)}
        </div>
        <div class="product__meta">
          <p class="product__price">${product.priceLabel}</p>
          <h3 class="product__title">${product.title}</h3>
          <p class="product__description">${product.description}</p>
        </div>
      </button>
      <div class="product__actions" data-product-actions="${product.id}">
        ${productActionsHtml(product.id)}
      </div>
    </li>`;
}

function productsGridHtml(products) {
  if (!products.length) {
    return `<p class="category-empty">Ничего не найдено — сбросьте фильтр или позвоните, подберём вручную.</p>`;
  }
  return `<ul class="product-grid" role="list">${products.map(productCardHtml).join("")}</ul>`;
}

function productsForSectionRaw(sectionId) {
  return siteData.products.filter((product) => product.section === sectionId);
}

function productsForSection(sectionId) {
  let products = productsForSectionRaw(sectionId);
  const tag = activeTagBySection[sectionId];
  if (tag) {
    const needle = tag.toLowerCase();
    products = products.filter(
      (product) =>
        product.title.toLowerCase().includes(needle) ||
        (product.description && product.description.toLowerCase().includes(needle))
    );
  }
  return products;
}

function updateSectionGrid(sectionId) {
  const gridHost = document.querySelector(`[data-section-grid="${sectionId}"]`);
  if (!gridHost) return;
  gridHost.innerHTML = productsGridHtml(productsForSection(sectionId));
  syncProductCards();
}

function renderCatalogTabs() {
  const headerTabs = document.getElementById("catalog-tabs");
  if (!headerTabs) return;
  headerTabs.innerHTML =
    `<button type="button" class="catalog-tab" role="tab" data-section-tab="${CATALOG_ALL}" aria-selected="false">Весь каталог</button>` +
    siteData.nav
      .map(
        (section) =>
          `<button type="button" class="catalog-tab" role="tab" data-section-tab="${section.id}" aria-selected="false">${section.label}</button>`
      )
      .join("");
}

function renderCatalogStage() {
  const stage = document.getElementById("catalog-stage");
  if (!stage) return;

  const sectionPanels = siteData.nav
    .map((section) => {
      return `
      <div class="catalog-panel" id="cat-${section.id}" role="tabpanel" data-section-panel="${section.id}" hidden>
        <h2 class="catalog-panel__title">${section.label}</h2>
        ${
          section.links.length
            ? `<div class="catalog-panel__tags">
          <button type="button" class="category-tag" data-section-tag="${section.id}" data-tag="" aria-pressed="true">Все</button>
          ${section.links
            .map(
              (link) =>
                `<button type="button" class="category-tag" data-section-tag="${section.id}" data-tag="${link}" aria-pressed="false">${link}</button>`
            )
            .join("")}
        </div>`
            : ""
        }
        <div data-section-grid="${section.id}">
          ${productsGridHtml(productsForSection(section.id))}
        </div>
      </div>`;
    })
    .join("");

  const allPanel = `
    <div class="catalog-panel" id="cat-${CATALOG_ALL}" role="tabpanel" data-section-panel="${CATALOG_ALL}" hidden>
      <h2 class="catalog-panel__title">Весь каталог</h2>
      <p class="catalog-panel__lead">Всё для праздника, оформления и подарков.</p>
      <div class="catalog-all">
        ${siteData.nav
          .map((section) => {
            const products = productsForSectionRaw(section.id);
            if (!products.length) return "";
            return `
          <section class="catalog-group" id="cat-group-${section.id}" aria-labelledby="cat-group-title-${section.id}">
            <h3 class="catalog-group__title" id="cat-group-title-${section.id}">
              <button type="button" class="catalog-group__jump" data-section-tab="${section.id}">${section.label}</button>
            </h3>
            ${productsGridHtml(products)}
          </section>`;
          })
          .join("")}
      </div>
    </div>`;

  stage.innerHTML = allPanel + sectionPanels;
}

function isCatalogSection(sectionId) {
  return sectionId === CATALOG_ALL || siteData.nav.some((section) => section.id === sectionId);
}

function setActiveSection(sectionId, scrollToCatalog = false) {
  if (!isCatalogSection(sectionId)) return;
  activeSectionId = sectionId;

  document.querySelectorAll("[data-section-tab]").forEach((tab) => {
    tab.setAttribute("aria-selected", tab.dataset.sectionTab === sectionId ? "true" : "false");
  });

  document.querySelectorAll("[data-section-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.sectionPanel !== sectionId;
  });

  if (scrollToCatalog) {
    const catalog = document.getElementById("catalog");
    if (catalog) {
      const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height || 0;
      const top = catalog.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }

  history.replaceState(null, "", `#cat-${sectionId}`);
}

function parseHashSection() {
  const hash = location.hash.replace("#cat-", "");
  if (hash === CATALOG_ALL) return CATALOG_ALL;
  if (hash && siteData?.nav.some((section) => section.id === hash)) return hash;
  return activeSectionId;
}

function renderPaymentChoices() {
  const root = document.getElementById("cart-payment");
  if (!root) return;
  root.innerHTML = siteData.paymentMethods
    .map(
      (method, index) => `
    <label class="choice">
      <input type="radio" name="pay" value="${method.id}" ${index === 0 ? "checked" : ""} />
      <span class="choice__box">
        <span class="choice__title">${method.label}</span>
        <span class="choice__hint">${method.description}</span>
      </span>
    </label>`
    )
    .join("");
}

function bindShopText() {
  const { shop, hero } = siteData;
  document.querySelectorAll("[data-shop-phone]").forEach((el) => {
    el.textContent = shop.phone;
    if (el.tagName === "A") el.href = `tel:${shop.phoneTel}`;
  });
  document.querySelectorAll("[data-shop-email]").forEach((el) => {
    el.textContent = shop.email;
    if (el.tagName === "A") el.href = `mailto:${shop.email}`;
  });
  document.querySelectorAll("[data-shop-address]").forEach((el) => {
    el.textContent = shop.address;
  });
  const mapFrame = document.querySelector("[data-yandex-map]");
  if (mapFrame instanceof HTMLIFrameElement && shop.mapLat && shop.mapLon) {
    const params = new URLSearchParams({
      ll: `${shop.mapLon},${shop.mapLat}`,
      z: String(shop.mapZoom || 17),
      pt: `${shop.mapLon},${shop.mapLat},pm2rdm`,
    });
    mapFrame.src = `https://yandex.ru/map-widget/v1/?${params}`;
  }
  const hours = document.querySelector("[data-shop-hours]");
  if (hours) hours.textContent = `заказы ${shop.hoursOrder} · доставка ${shop.hoursDelivery}`;
  const callbackNote = document.querySelector("[data-callback-hours]");
  if (callbackNote) {
    callbackNote.textContent = `Введите телефон — перезвоним за 60 секунд (${shop.callbackHours})`;
  }
  document.querySelector("[data-hero-badge]").textContent = hero.badge;
  document.querySelector("[data-hero-title]").textContent = hero.title;
  document.querySelector("[data-hero-lead]").textContent = hero.lead;
}

function bindDialogScrollLock(dialog) {
  if (!dialog) return;
  dialog.addEventListener("close", () => {
    if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function syncProductCards() {
  document.querySelectorAll("[data-product-actions]").forEach((wrap) => {
    wrap.innerHTML = productActionsHtml(wrap.dataset.productActions);
  });
}

function refreshModalActions() {
  const actions = document.getElementById("product-modal-actions");
  if (!actions || !openProductId) return;
  actions.innerHTML = productActionsHtml(openProductId);
}

function openProductModal(productId) {
  const product = productsById.get(productId);
  if (!product || !productDialog) return;
  openProductId = productId;
  setResponsiveImage(
    document.getElementById("product-modal-img"),
    productImagePath(product),
    product.title
  );
  document.getElementById("product-modal-title").textContent = product.title;
  document.getElementById("product-modal-price").textContent = product.priceLabel;
  document.getElementById("product-modal-desc").textContent =
    product.description || "Состав и цвет уточняйте у менеджера при заказе.";
  refreshModalActions();
  showDialog(productDialog);
}

function renderCart() {
  if (!siteData || !cartList) return;
  const lines = JSON.parse(localStorage.getItem("sharprayz-cart") || "[]");
  cartBadge.dataset.count = String(getCartCount());
  cartBadge.textContent = getCartCount() > 99 ? "99+" : String(getCartCount());
  checkoutForm.hidden = lines.length === 0;
  refreshOrderButtonState();

  if (lines.length === 0) {
    cartList.innerHTML = "";
    cartEmpty.hidden = false;
    cartTotalEl.textContent = formatRub(0);
    syncProductCards();
    refreshModalActions();
    return;
  }

  cartEmpty.hidden = true;
  cartList.innerHTML = lines
    .map((line) => {
      const product = productsById.get(line.id);
      if (!product) return "";
      return `
      <article class="cart-line">
        <span class="cart-line__name">${product.title}</span>
        <span class="cart-line__price">${formatRub(product.price * line.qty)}</span>
        <div class="cart-line__qty">
          <button type="button" class="qty-btn" data-qty-minus="${line.id}">−</button>
          <span>${line.qty}</span>
          <button type="button" class="qty-btn" data-qty-plus="${line.id}">+</button>
          <button type="button" class="cart-line__remove" data-remove="${line.id}">Удалить</button>
        </div>
      </article>`;
    })
    .join("");
  cartTotalEl.textContent = formatRub(getCartTotal(productsById));
  syncProductCards();
  refreshModalActions();
}

function refreshOrderButtonState() {
  const button = document.getElementById("order-submit");
  if (!(button instanceof HTMLButtonElement)) return;
  button.disabled = getCartCount() === 0 || !dateTimeInputsAreValid(checkoutForm);
}

function bindSectionSwitching() {
  document.body.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-section-tab]");
    if (tab?.tagName === "BUTTON") {
      setActiveSection(tab.dataset.sectionTab, true);
    }

    const tagBtn = event.target.closest("[data-section-tag]");
    if (tagBtn) {
      const sectionId = tagBtn.dataset.sectionTag;
      activeTagBySection[sectionId] = tagBtn.dataset.tag || undefined;
      if (!activeTagBySection[sectionId]) delete activeTagBySection[sectionId];

      document.querySelectorAll(`[data-section-tag="${sectionId}"]`).forEach((btn) => {
        btn.setAttribute("aria-pressed", btn === tagBtn ? "true" : "false");
      });
      updateSectionGrid(sectionId);
    }
  });

  document.body.addEventListener("click", (event) => {
    const hashLink = event.target.closest('a[href^="#cat-"]');
    if (!hashLink) return;
    event.preventDefault();
    setActiveSection(hashLink.getAttribute("href").replace("#cat-", ""), true);
  });

  window.addEventListener("hashchange", () => {
    setActiveSection(parseHashSection(), false);
  });
}

function bindCartUi() {
  checkoutForm?.addEventListener("input", refreshOrderButtonState);

  document.querySelectorAll("[data-cart-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderCart();
      showDialog(cartDialog);
    });
  });
  document.querySelectorAll("[data-cart-close]").forEach((btn) => {
    btn.addEventListener("click", () => cartDialog.close());
  });

  document.body.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-cart]");
    if (add) {
      event.preventDefault();
      addToCart(add.dataset.addCart);
      openProductId = add.dataset.addCart;
      renderCart();
      return;
    }
    const cardPlus = event.target.closest("[data-card-plus]");
    const cardMinus = event.target.closest("[data-card-minus]");
    if (cardPlus) {
      changeQty(cardPlus.dataset.cardPlus, 1);
      openProductId = cardPlus.dataset.cardPlus;
    }
    if (cardMinus) {
      changeQty(cardMinus.dataset.cardMinus, -1);
      openProductId = cardMinus.dataset.cardMinus;
    }
    if (cardPlus || cardMinus) renderCart();
  });

  cartList?.addEventListener("click", (event) => {
    const minus = event.target.closest("[data-qty-minus]");
    const plus = event.target.closest("[data-qty-plus]");
    const remove = event.target.closest("[data-remove]");
    if (minus) changeQty(minus.dataset.qtyMinus, -1);
    if (plus) changeQty(plus.dataset.qtyPlus, 1);
    if (remove) removeFromCart(remove.dataset.remove);
    if (minus || plus || remove) renderCart();
  });

  document.getElementById("order-submit")?.addEventListener("click", () => submitCheckoutOrder());
}

async function submitCheckoutOrder() {
  const button = document.getElementById("order-submit");
  if (!(button instanceof HTMLButtonElement) || button.disabled) return;
  if (getCartCount() === 0) return;

  if (!checkoutForm.reportValidity()) return;
  if (!validateDateTimeInputs(checkoutForm)) return;

  const phoneInput = checkoutForm.querySelector("[data-phone-ru]");
  if (phoneInput instanceof HTMLInputElement && !setPhoneValidity(phoneInput)) {
    phoneInput.reportValidity();
    phoneInput.focus();
    return;
  }

  const notifyEmail =
    siteData?.order?.notifyEmail?.trim() || siteData?.shop?.email?.trim() || "";
  if (!notifyEmail) {
    alert("Не указан email для заказов в data/site.json");
    return;
  }

  const payload = buildOrderMessage(checkoutForm, productsById, formatRub, getCartTotal);

  button.disabled = true;
  const prevText = button.textContent;
  button.textContent = "Отправляем…";

  try {
    await sendOrderViaFormSubmit(notifyEmail, payload);
    clearCart();
    checkoutForm.reset();
    renderCart();
    cartDialog.close();
    alert("Заказ отправлен. Мы свяжемся с вами для подтверждения.");
  } catch (error) {
    console.error(error);
    alert(`Не удалось отправить заказ.\n\n${error.message || "Попробуйте позже или позвоните нам."}`);
  } finally {
    button.textContent = prevText;
    refreshOrderButtonState();
  }
}

function bindCallbackForm() {
  const form = document.querySelector(".callback-card");
  const phoneInput = document.getElementById("callback-phone");
  if (!form || !(phoneInput instanceof HTMLInputElement)) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!setPhoneValidity(phoneInput)) {
      phoneInput.reportValidity();
      phoneInput.focus();
      return;
    }
    alert("Заявка принята — перезвоним в рабочее время.");
    phoneInput.value = "";
    phoneInput.setCustomValidity("");
  });
}

function bindProductModal() {
  document.body.addEventListener("click", (event) => {
    const open = event.target.closest("[data-product-open]");
    if (open) {
      event.preventDefault();
      openProductModal(open.dataset.productOpen);
    }
  });
  document.querySelector("[data-product-close]")?.addEventListener("click", () => {
    openProductId = null;
    productDialog.close();
  });
  productDialog.addEventListener("close", () => {
    openProductId = null;
  });
  bindDialogScrollLock(productDialog);
}

async function init() {
  try {
    await loadSite();
    bindShopText();
    bindSeo(siteData);
    renderCatalogTabs();
    renderCatalogStage();
    renderPaymentChoices();
    bindSectionSwitching();
    bindDateTimeInputs();
    bindCartUi();
    bindProductModal();
    bindCallbackForm();
    bindAllPhoneInputs();
    bindDialogScrollLock(cartDialog);
    setActiveSection(parseHashSection() || CATALOG_ALL, false);
    renderCart();
  } catch (error) {
    console.error(error);
    document.querySelector("main")?.insertAdjacentHTML(
      "afterbegin",
      `<p class="category-empty" style="margin:1rem">Каталог временно недоступен — позвоните <a href="tel:+79691010199">+7 (969) 101-01-99</a>.</p>`
    );
  }
}

init();
