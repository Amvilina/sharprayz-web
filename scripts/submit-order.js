import { phoneRuToTel } from "./phone-ru.js";

export function buildOrderMessage(form, productsById, formatRub, getCartTotal) {
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const phone = String(data.get("phone") || "").trim();
  const address = String(data.get("address") || "").trim();
  const date = String(data.get("date") || "").trim();
  const time = String(data.get("time") || "").trim();
  const comment = String(data.get("comment") || "").trim();
  const payInput = form.querySelector('input[name="pay"]:checked');
  const payLabel = payInput?.closest(".choice")?.querySelector(".choice__title")?.textContent?.trim() || "—";

  const cartLines = JSON.parse(localStorage.getItem("sharprayz-cart") || "[]");
  const lines = [];
  const items = cartLines
    .map((line) => {
      const product = productsById.get(line.id);
      if (!product) return null;
      return `• ${product.title} × ${line.qty} — ${formatRub(product.price * line.qty)}`;
    })
    .filter(Boolean);

  lines.push("Новый заказ с сайта ШАРПРАЙЗ", "");
  lines.push(`Имя: ${name || "—"}`);
  lines.push(`Телефон: ${phone}`);
  lines.push(`Адрес: ${address || "—"}`);
  lines.push(`Доставка: ${date} ${time}`);
  lines.push(`Оплата: ${payLabel}`);
  if (comment) {
    lines.push(`Комментарий: ${comment}`);
  }
  lines.push("");
  lines.push("Состав заказа:");
  lines.push(...(items.length ? items : ["—"]));
  lines.push("");
  lines.push(`Итого: ${formatRub(getCartTotal(productsById))}`);

  return {
    name,
    phone,
    phoneTel: phoneRuToTel(phone),
    address,
    date,
    time,
    payLabel,
    comment,
    message: lines.join("\n"),
  };
}

/** @param {string} notifyEmail */
export async function sendOrderViaFormSubmit(notifyEmail, payload) {
  const email = notifyEmail.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Некорректный email для заказов");

  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: "Заказ с сайта ШАРПРАЙЗ",
      _template: "table",
      _captcha: "false",
      name: payload.name || "Без имени",
      phone: payload.phoneTel || payload.phone,
      address: payload.address,
      delivery_date: payload.date,
      delivery_time: payload.time,
      payment: payload.payLabel,
      comment: payload.comment || "—",
      message: payload.message,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Не удалось отправить заказ");
  }
  return result;
}
