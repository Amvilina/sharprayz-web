/**
 * Подтягивает названия из data/sections.json в чекбоксы разделов товара в .pages.yml
 * Запуск: node scripts/sync-cms-sections.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sections = JSON.parse(fs.readFileSync(path.join(root, "data/sections.json"), "utf8"));
const labels = [];
const seen = new Set();
for (const section of sections) {
  const names = [section.label, ...(Array.isArray(section.links) ? section.links : [])];
  for (const name of names) {
    const label = String(name || "").trim();
    const key = label.toLocaleLowerCase("ru");
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
}
const pagesPath = path.join(root, ".pages.yml");
let yml = fs.readFileSync(pagesPath, "utf8");

const start = "# SECTION_SELECT_VALUES_START";
const end = "# SECTION_SELECT_VALUES_END";
const block = `${start}\n${labels.map((l) => `                - ${JSON.stringify(l)}`).join("\n")}\n              ${end}`;

if (!yml.includes(start)) {
  console.error("Маркеры SECTION_SELECT в .pages.yml не найдены");
  process.exit(1);
}

yml = yml.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
fs.writeFileSync(pagesPath, yml);
console.log("Обновлено в .pages.yml:", labels.length, "разделов");
