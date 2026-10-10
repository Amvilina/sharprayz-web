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
  lines.push(`Доставка: ${[date, time].filter(Boolean).join(" ") || "—"}`);
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

export function buildCallbackPayload(phone) {
  const phoneTrim = String(phone || "").trim();
  const phoneTel = phoneRuToTel(phoneTrim);
  const submittedAt = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
  const message = ["Заявка на обратный звонок — сайт ШАРПРАЙЗ", "", `Телефон: ${phoneTrim}`, `Время заявки: ${submittedAt}`].join(
    "\n"
  );
  return { phone: phoneTrim, phoneTel, message, submittedAt };
}

const FORMTOMAIL_KEY = "gCknhL44ZcC47vpX";

function textHtml(value) {
  return String(value || "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

async function sendFormToMail(title, body) {
  if (!FORMTOMAIL_KEY) throw new Error("Не удалось отправить заявку");

  const response = await fetch("https://api.formtomail.ru/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FORMTOMAIL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Не удалось отправить заявку");
  return result;
}

export function sendCallback(payload) {
  return sendFormToMail("Заказ звонка — ШАРПРАЙЗ", {
    Телефон: textHtml(payload.phoneTel || payload.phone),
    Время: textHtml(payload.submittedAt),
  });
}

export function sendOrder(payload) {
  return sendFormToMail("Заказ с сайта ШАРПРАЙЗ", {
    Имя: textHtml(payload.name),
    Телефон: textHtml(payload.phoneTel || payload.phone),
    Адрес: textHtml(payload.address),
    Доставка: textHtml([payload.date, payload.time].filter(Boolean).join(" ")),
    Оплата: textHtml(payload.payLabel),
    Комментарий: textHtml(payload.comment),
    Заказ: textHtml(payload.message),
  });
}
