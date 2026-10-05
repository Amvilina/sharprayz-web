export function normalizeMediaPath(path) {
  if (!path || typeof path !== "string") return path;
  const trimmed = path.trim();
  if (trimmed.startsWith("/")) return trimmed.slice(1);
  return trimmed;
}

export function imageVariants(path) {
  path = normalizeMediaPath(path);
  if (!path) return { webp: "", fallback: "" };
  if (/^https?:\/\//i.test(path)) return { webp: path, fallback: path };
  if (path.endsWith(".webp")) {
    return { webp: path, fallback: path.replace(/\.webp$/i, ".png") };
  }
  if (/\.(png|jpe?g)$/i.test(path)) {
    const webp = path.replace(/\.(png|jpe?g)$/i, ".webp");
    const productUpload = /\/products\//.test(path) || path.startsWith("assets/products/");
    if (productUpload) {
      return { webp: "", fallback: path };
    }
    return { webp, fallback: path };
  }
  return { webp: "", fallback: path };
}

function escAttr(value) {
  return String(value).replace(/"/g, "&quot;");
}

/** @param {string} path @param {{ alt?: string, width?: number, height?: number, loading?: string, fetchpriority?: string, className?: string }} opts */
export function pictureHtml(path, opts = {}) {
  const { webp, fallback } = imageVariants(path);
  const { alt = "", width, height, loading, fetchpriority, className } = opts;
  const attrs = [
    width ? `width="${width}"` : "",
    height ? `height="${height}"` : "",
    loading ? `loading="${loading}"` : "",
    fetchpriority ? `fetchpriority="${fetchpriority}"` : "",
    className ? `class="${escAttr(className)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const altAttr = `alt="${escAttr(alt)}"`;

  if (!webp || webp === fallback) {
    return `<img src="${fallback}" ${altAttr} ${attrs} />`;
  }

  return `<picture><source type="image/webp" srcset="${webp}" /><img src="${fallback}" ${altAttr} ${attrs} /></picture>`;
}

/** @param {HTMLImageElement} img @param {string} path */
export function setResponsiveImage(img, path, alt = "") {
  if (!img) return;
  const { webp, fallback } = imageVariants(path);
  img.alt = alt;
  img.src = fallback || webp;
  const picture = img.closest("picture");
  const source = picture?.querySelector("source[type='image/webp']");
  if (!(source instanceof HTMLSourceElement)) return;
  if (webp && webp !== fallback) source.srcset = webp;
  else source.removeAttribute("srcset");
}
