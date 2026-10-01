export function bindSeo(siteData) {
  const seo = siteData.seo || {};
  const shop = siteData.shop || {};
  const hero = siteData.hero || {};
  const siteUrl = (seo.siteUrl || "").replace(/\/$/, "");

  const title = seo.title || "ШАРПРАЙЗ — магазин воздушных шаров в Балашихе";
  const description =
    seo.description ||
    hero.lead ||
    "Магазин воздушных шаров с доставкой в Балашихе: букеты, фигуры, оформление праздников.";

  document.title = title;

  setMeta("description", description);
  if (seo.keywords) setMeta("keywords", seo.keywords);

  const ogImage = absoluteUrl(siteUrl, seo.ogImage || "assets/og-cover.webp");
  setMetaProperty("og:title", title);
  setMetaProperty("og:description", description);
  setMetaProperty("og:type", "website");
  setMetaProperty("og:locale", "ru_RU");
  setMetaProperty("og:image", ogImage);
  setMetaProperty("og:image:type", "image/webp");

  setMetaName("twitter:card", "summary_large_image");
  setMetaName("twitter:title", title);
  setMetaName("twitter:description", description);
  setMetaName("twitter:image", ogImage);

  if (siteUrl) {
    setLink("canonical", siteUrl + "/");
    setMetaProperty("og:url", siteUrl + "/");
  }

  const socialLinks = [shop.vkUrl, shop.instagramUrl].filter(Boolean);

  const ld = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "ШАРПРАЙЗ",
    description,
    image: ogImage,
    telephone: shop.phoneTel,
    email: shop.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: shop.address,
      addressLocality: "Балашиха",
      addressRegion: "Московская область",
      addressCountry: "RU",
    },
    geo: shop.mapLat
      ? {
          "@type": "GeoCoordinates",
          latitude: shop.mapLat,
          longitude: shop.mapLon,
        }
      : undefined,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "09:00",
        closes: "22:00",
      },
    ],
    url: siteUrl || undefined,
    sameAs: socialLinks.length ? socialLinks : undefined,
  };

  let script = document.getElementById("schema-org");
  if (!script) {
    script = document.createElement("script");
    script.id = "schema-org";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(ld, (_, v) => (v === undefined ? undefined : v));
}

function absoluteUrl(siteUrl, path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (siteUrl) return `${siteUrl}/${path.replace(/^\//, "")}`;
  return path;
}

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function setMetaProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setMetaName(name, content) {
  setMeta(name, content);
}

function setLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}
