export function $(id) {
  return document.getElementById(id);
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function formatMoney(n) {
  return Number(n || 0).toLocaleString("es-MX", {
    maximumFractionDigits: 0
  });
}

export function formatPrice(value, currency = "MXN") {
  const locale = currency === "USD" ? "en-US" : "es-MX";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function shortPrice(value, currency = "MXN") {
  const v = Number(value || 0);
  const prefix = currency === "USD" ? "US$" : "$";

  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `${prefix}${Math.round(v / 1_000)}k`;
  return `${prefix}${v}`;
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

export function escapeAttr(str) {
  return String(str ?? "").replace(/'/g, "&#39;");
}

export function propertyTypeLabel(type) {
  const labels = {
    house: "Casa",
    apartment: "Departamento",
    land: "Terreno",
    warehouse: "Bodega",
    industrial: "Nave industrial"
  };
  return labels[type] || "Propiedad";
}

export function defaultCover() {
  return "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80";
}