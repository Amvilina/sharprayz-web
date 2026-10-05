function digits(value, max) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, max);
}

function formatDate(value) {
  const d = digits(value, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

function formatTime(value) {
  const d = digits(value, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

function parseDate(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function validateDeliveryDate(input) {
  if (!input.value.trim()) {
    input.setCustomValidity("");
    return true;
  }
  const date = parseDate(input.value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let message = "";
  if (!date) message = "Введите дату в формате ДД.ММ.ГГГГ";
  else if (date < today) message = "Дата доставки не может быть в прошлом";
  input.setCustomValidity(message);
  return !message;
}

export function validateDeliveryTime(input) {
  if (!input.value.trim()) {
    input.setCustomValidity("");
    return true;
  }
  const match = /^(\d{2}):(\d{2})$/.exec(input.value);
  const valid = Boolean(match && Number(match[1]) < 24 && Number(match[2]) < 60);
  input.setCustomValidity(valid ? "" : "Введите время в формате ЧЧ:ММ");
  return valid;
}

function isDeliveryDateOk(value) {
  if (!String(value).trim()) return true;
  const date = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Boolean(date && date >= today);
}

function isDeliveryTimeOk(value) {
  if (!String(value).trim()) return true;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) < 24 && Number(match[2]) < 60);
}

export function dateTimeInputsAreValid(root = document) {
  const dateInput = root.querySelector("[data-date-input]");
  const timeInput = root.querySelector("[data-time-input]");
  if (!(dateInput instanceof HTMLInputElement) || !(timeInput instanceof HTMLInputElement)) return true;
  return isDeliveryDateOk(dateInput.value) && isDeliveryTimeOk(timeInput.value);
}

function bindMaskedInput(input, formatter, validator) {
  input.addEventListener("input", () => {
    input.value = formatter(input.value);
    input.setCustomValidity("");
  });
  input.addEventListener("blur", () => {
    if (input.value) validator(input);
  });
}

export function bindDateTimeInputs(root = document) {
  root.querySelectorAll("[data-date-input]").forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    bindMaskedInput(input, formatDate, validateDeliveryDate);
  });
  root.querySelectorAll("[data-time-input]").forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    bindMaskedInput(input, formatTime, validateDeliveryTime);
  });
}

export function validateDateTimeInputs(root = document) {
  const date = root.querySelector("[data-date-input]");
  const time = root.querySelector("[data-time-input]");
  const dateValid = date instanceof HTMLInputElement && validateDeliveryDate(date);
  const timeValid = time instanceof HTMLInputElement && validateDeliveryTime(time);
  const invalid = !dateValid ? date : !timeValid ? time : null;
  if (invalid instanceof HTMLInputElement) {
    invalid.reportValidity();
    invalid.focus();
    return false;
  }
  return true;
}
