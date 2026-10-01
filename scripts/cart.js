const CART_KEY = "sharprayz-cart";

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function getCartCount() {
  return readCart().reduce((sum, line) => sum + line.qty, 0);
}

export function getLineQty(productId) {
  const line = readCart().find((item) => item.id === productId);
  return line ? line.qty : 0;
}

export function getCartTotal(productsById) {
  return readCart().reduce((sum, line) => {
    const product = productsById.get(line.id);
    return sum + (product ? product.price * line.qty : 0);
  }, 0);
}

export function addToCart(productId) {
  const items = readCart();
  const existing = items.find((line) => line.id === productId);
  if (existing) existing.qty += 1;
  else items.push({ id: productId, qty: 1 });
  writeCart(items);
  return items;
}

export function changeQty(productId, delta) {
  const items = readCart();
  const line = items.find((item) => item.id === productId);
  if (!line) return items;
  line.qty += delta;
  const next = items.filter((item) => item.qty > 0);
  writeCart(next);
  return next;
}

export function removeFromCart(productId) {
  const next = readCart().filter((item) => item.id !== productId);
  writeCart(next);
  return next;
}

export function getCartLines() {
  return readCart();
}

export function clearCart() {
  writeCart([]);
}

export function formatRub(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Одна цена для карточки, модалки и корзины — только поле price */
export function productPriceLabel(product) {
  const price = Number(product?.price);
  if (!Number.isFinite(price)) return "—";
  return `от ${formatRub(price)}`;
}
