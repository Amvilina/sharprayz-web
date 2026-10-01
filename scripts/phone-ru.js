const PHONE_DISPLAY_MAX = 18;

/** @returns {string} up to 11 digits, always starting with 7 when non-empty */
export function digitsFromPhoneValue(value) {
  let d = String(value || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("8")) d = `7${d.slice(1)}`;
  if (!d.startsWith("7")) d = `7${d}`;
  return d.slice(0, 11);
}

/** @param {string} value masked or raw */
export function formatPhoneRu(value) {
  const full = digitsFromPhoneValue(value);
  if (!full) return "";

  const n = full.slice(1);
  let out = "+7";
  if (!n.length) return out;

  out += ` (${n.slice(0, 3)}`;
  if (n.length <= 3) return out;

  out += `) ${n.slice(3, 6)}`;
  if (n.length <= 6) return out;

  out += `-${n.slice(6, 8)}`;
  if (n.length <= 8) return out;

  out += `-${n.slice(8, 10)}`;
  return out;
}

export function isPhoneRuComplete(value) {
  const d = digitsFromPhoneValue(value);
  return d.length === 11;
}

export function phoneRuToTel(value) {
  const d = digitsFromPhoneValue(value);
  return d.length === 11 ? `+${d}` : "";
}

function countNationalDigitsBefore(value, caret) {
  const sub = String(value || "").slice(0, caret).replace(/\D/g, "");
  if (!sub) return 0;
  let d = sub;
  if (d.startsWith("8")) d = `7${d.slice(1)}`;
  if (d.startsWith("7")) return Math.max(0, d.length - 1);
  return d.length;
}

function caretForNationalDigitCount(formatted, nationalCount) {
  if (nationalCount <= 0) {
    const open = formatted.indexOf("(");
    return open >= 0 ? open + 1 : formatted.length;
  }

  let n = 0;
  let skippedCountry = false;
  for (let i = 0; i < formatted.length; i += 1) {
    if (!/\d/.test(formatted[i])) continue;
    if (!skippedCountry && formatted[i] === "7") {
      skippedCountry = true;
      continue;
    }
    n += 1;
    if (n === nationalCount) return i + 1;
  }
  return formatted.length;
}

function applyMask(input) {
  const before = countNationalDigitsBefore(input.value, input.selectionStart ?? 0);
  const formatted = formatPhoneRu(input.value);
  input.value = formatted;
  const nextCaret = caretForNationalDigitCount(formatted, before);
  input.setSelectionRange(nextCaret, nextCaret);
}

export function setPhoneValidity(input, message = "Введите номер полностью: +7 (999) 999-99-99") {
  const ok = isPhoneRuComplete(input.value);
  input.setCustomValidity(ok ? "" : message);
  return ok;
}

/** @param {HTMLInputElement} input */
export function bindPhoneInput(input) {
  if (!input || input.dataset.phoneRuBound === "1") return;
  input.dataset.phoneRuBound = "1";

  input.type = "tel";
  input.inputMode = "tel";
  input.autocomplete = input.autocomplete || "tel";
  input.placeholder = input.placeholder || "+7 (___) ___-__-__";
  input.maxLength = PHONE_DISPLAY_MAX;

  const onInput = () => {
    applyMask(input);
    if (input.dataset.touched === "1") setPhoneValidity(input);
  };

  input.addEventListener("input", onInput);

  input.addEventListener("focus", () => {
    if (!digitsFromPhoneValue(input.value)) {
      input.value = "+7 (";
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  input.addEventListener("blur", () => {
    input.dataset.touched = "1";
    const d = digitsFromPhoneValue(input.value);
    if (!d || d === "7") {
      input.value = "";
      input.setCustomValidity("");
      return;
    }
    input.value = formatPhoneRu(input.value);
    setPhoneValidity(input);
  });

  input.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData("text") || "";
    input.value = formatPhoneRu(text);
    applyMask(input);
  });

  if (input.value) {
    input.value = formatPhoneRu(input.value);
  }
}

export function bindAllPhoneInputs(root = document) {
  root.querySelectorAll("[data-phone-ru]").forEach((el) => {
    if (el instanceof HTMLInputElement) bindPhoneInput(el);
  });
}
