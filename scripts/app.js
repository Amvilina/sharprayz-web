import {
  addToCart,
  changeQty,
  formatRub,
  productPriceLabel,
  clearCart,
  getCartCount,
  getCartTotal,
  getLineQty,
  removeFromCart,
} from "./cart.js";
import {
  buildCallbackPayload,
  buildOrderMessage,
  sendCallbackViaFormSubmit,
  sendOrderViaFormSubmit,
} from "./submit-order.js";
import { bindAllPhoneInputs, isPhoneRuComplete, setPhoneValidity } from "./phone-ru.js";
import { bindDateTimeInputs, validateDateTimeInputs } from "./date-time-input.js";
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
let activeSectionId = "";
let productImage = "assets/logo-mark.png";
let openProductId = null;
const activeTagBySection = {};

function showDialog(dialog) {
  const scrollY = window.scrollY;
  dialog.showModal();
  document.body.classList.add("dialog-open");
  window.scrollTo(0, scrollY);
}

function slugifySectionLabel(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u0400-\u04ff-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function prepareNavSections(sections) {
  const used = new Set();
  return (sections || []).map((section, index) => {
    const label = String(section.label || "").trim();
    let id = String(section.id || "").trim();
    if (!id) id = slugifySectionLabel(label);
    if (!id) id = `section-${index + 1}`;
    let unique = id;
    let n = 2;
    while (used.has(unique)) {
      unique = `${id}-${n++}`;
    }
    used.add(unique);
    return {
      ...section,
      label,
      id: unique,
      links: Array.isArray(section.links) ? section.links : [],
    };
  });
}

function productSectionValues(product) {
  const value = product?.section;
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => String(item || "").trim()).filter(Boolean);
}

function sameName(a, b) {
  return String(a || "").trim().toLocaleLowerCase("ru") === String(b || "").trim().toLocaleLowerCase("ru");
}

function productBelongsToSection(product, sectionId) {
  const section = siteData.nav.find((item) => item.id === sectionId);
  if (!section) return false;
  const values = productSectionValues(product);
  if (values.some((value) => sameName(value, section.id) || sameName(value, section.label))) return true;
  return values.some((value) => (section.links || []).some((link) => sameName(value, link)));
}

async function loadSite() {
  const [siteRes, sectionsRes, productsRes] = await Promise.all([
    fetch("data/site.json"),
    fetch("data/sections.json"),
    fetch("data/products.json"),
  ]);
  if (!siteRes.ok) throw new Error("Не удалось загрузить data/site.json");
  if (!sectionsRes.ok) throw new Error("Не удалось загрузить data/sections.json");
  if (!productsRes.ok) throw new Error("Не удалось загрузить data/products.json");
  siteData = await siteRes.json();
  siteData.nav = prepareNavSections(await sectionsRes.json());
  siteData.products = (await productsRes.json()).map((product, index) => {
    const title = String(product.title || "").trim();
    let id = String(product.id || "").trim();
    if (!id) id = slugifySectionLabel(title) || `item-${index + 1}`;
    const price = Number(product.price);
    return { ...product, id, title, price: Number.isFinite(price) ? price : 0 };
  });
  productImage = siteData.productImage || "assets/logo-mark.png";
  productsById = new Map(siteData.products.map((product) => [product.id, product]));
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
          <p class="product__price">${productPriceLabel(product)}</p>
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
  return siteData.products.filter((product) => productBelongsToSection(product, sectionId));
}

function productsForSection(sectionId) {
  let products = productsForSectionRaw(sectionId);
  const tag = activeTagBySection[sectionId];
  if (tag) {
    const needle = tag.trim().toLocaleLowerCase("ru");
    products = products.filter((product) => {
      const hay = [product.title, product.description, ...productSectionValues(product)]
        .join("\n")
        .toLocaleLowerCase("ru");
      return hay.includes(needle);
    });
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
  headerTabs.innerHTML = siteData.nav
    .map(
      (section) =>
        `<button type="button" class="catalog-tab" role="tab" data-section-tab="${section.id}" aria-selected="false">${section.label}</button>`
    )
    .join("");
}

function renderHeroChips() {
  const host = document.getElementById("hero-chips");
  if (!host || !siteData?.nav?.length) return;
  host.innerHTML = siteData.nav
    .slice(0, 3)
    .map((section) => `<a href="#cat-${section.id}">${section.label}</a>`)
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
            .map((link) => {
              const label = String(link).trim();
              if (!label) return "";
              return `<button type="button" class="category-tag" data-section-tag="${section.id}" data-tag="${label.replace(/"/g, "&quot;")}" aria-pressed="false">${label}</button>`;
            })
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

  stage.innerHTML = sectionPanels;
}

function isCatalogSection(sectionId) {
  return siteData.nav.some((section) => section.id === sectionId);
}

function setActiveSection(sectionId, scrollToCatalog = false) {
  if (!isCatalogSection(sectionId)) return;
  activeSectionId = sectionId;

  document.querySelectorAll("[data-section-tab]").forEach((tab) => {
    const on = tab.dataset.sectionTab === sectionId;
    tab.setAttribute("aria-selected", on ? "true" : "false");
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
  if (hash === "all") return "other";
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
  document.querySelectorAll("[data-shop-vk]").forEach((el) => {
    if (!(el instanceof HTMLAnchorElement)) return;
    if (shop.vkUrl) {
      el.href = shop.vkUrl;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  });
  document.querySelectorAll("[data-shop-instagram]").forEach((el) => {
    if (!(el instanceof HTMLAnchorElement)) return;
    if (shop.instagramUrl) {
      el.href = shop.instagramUrl;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  });
  const socials = document.querySelector(".about-item__socials");
  if (socials) socials.hidden = !shop.vkUrl && !shop.instagramUrl;
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
  document.getElementById("product-modal-price").textContent = productPriceLabel(product);
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
        <div class="cart-line__media">${productMediaHtml(product)}</div>
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
  const phoneInput = checkoutForm?.querySelector("[data-phone-ru]");
  const phoneOk = phoneInput instanceof HTMLInputElement && isPhoneRuComplete(phoneInput.value);
  button.disabled = getCartCount() === 0 || !phoneOk;
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
      const tag = (tagBtn.getAttribute("data-tag") || "").trim();
      if (tag) activeTagBySection[sectionId] = tag;
      else delete activeTagBySection[sectionId];

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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!setPhoneValidity(phoneInput)) {
      phoneInput.reportValidity();
      phoneInput.focus();
      return;
    }

    const notifyEmail =
      siteData?.order?.notifyEmail?.trim() || siteData?.shop?.email?.trim() || "";
    if (!notifyEmail) {
      alert("Не указан email для заявок в настройках сайта");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const prevText = button instanceof HTMLButtonElement ? button.textContent : "";
    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
      button.textContent = "Отправляем…";
    }

    try {
      const payload = buildCallbackPayload(phoneInput.value);
      await sendCallbackViaFormSubmit(notifyEmail, payload);
      phoneInput.value = "";
      phoneInput.setCustomValidity("");
      alert("Заявка отправлена — перезвоним в рабочее время.");
    } catch (error) {
      console.error(error);
      alert(`Не удалось отправить заявку.\n\n${error.message || "Позвоните нам или попробуйте позже."}`);
    } finally {
      if (button instanceof HTMLButtonElement) {
        button.disabled = false;
        button.textContent = prevText;
      }
    }
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
    renderHeroChips();
    renderCatalogStage();
    renderPaymentChoices();
    bindSectionSwitching();
    bindDateTimeInputs();
    bindCartUi();
    bindProductModal();
    bindCallbackForm();
    bindAllPhoneInputs();
    bindDialogScrollLock(cartDialog);
    setActiveSection(parseHashSection() || siteData.nav[0]?.id, false);
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
