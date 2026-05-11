import { sb } from "./core/supabase.js";
import { $ } from "./core/utils.js";

async function init() {
  await loadCommercialDashboard();

  $("commercialSearchInput")?.addEventListener("input", () => {
    loadCommercialDashboard();
  });
}

async function loadCommercialDashboard() {
  const search = $("commercialSearchInput")?.value?.trim().toLowerCase() || "";

  const { data, error } = await sb
    .from("property_leads")
    .select(`
      *,
      properties (
        id,
        title,
        address,
        city,
        state
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando dashboard comercial:", error);
    return;
  }

  let rows = data || [];

  if (search) {
    rows = rows.filter((item) => {
      const hay = `
        ${item.full_name || ""}
        ${item.phone || ""}
        ${item.email || ""}
        ${item.notes || ""}
        ${item.properties?.title || ""}
        ${item.properties?.address || ""}
      `.toLowerCase();

      return hay.includes(search);
    });
  }

  renderKpis(rows);
  renderTopProperties(rows);
  renderRecentLeads(rows);
  renderStageSummary(rows);
}

function renderKpis(rows) {
  const total = rows.length;
  const nuevos = rows.filter(r => r.stage === "nuevo").length;
  const visitas = rows.filter(r => r.stage === "visita").length;
  const ofertas = rows.filter(r => r.stage === "oferta").length;
  const cierres = rows.filter(r => r.stage === "cierre").length;
  const budget = rows.reduce((acc, row) => acc + Number(row.budget || 0), 0);

  $("kpiTotalLeads").textContent = total;
  $("kpiNewLeads").textContent = nuevos;
  $("kpiVisits").textContent = visitas;
  $("kpiOffers").textContent = ofertas;
  $("kpiClosings").textContent = cierres;
  $("kpiBudget").textContent = "$" + budget.toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

function renderTopProperties(rows) {
  const wrap = $("topPropertiesWrap");
  if (!wrap) return;

  const map = {};

  rows.forEach((row) => {
    const key = row.properties?.id || "sin-propiedad";
    if (!map[key]) {
      map[key] = {
        title: row.properties?.title || "Sin propiedad",
        count: 0,
        city: row.properties?.city || ""
      };
    }
    map[key].count += 1;
  });

  const ranked = Object.values(map)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  wrap.innerHTML = ranked.length
    ? ranked.map(item => `
      <div class="commercial-item">
        <div class="commercial-item-title">${escapeHtml(item.title)}</div>
        <div class="commercial-item-sub">${escapeHtml(item.city)}</div>
        <div class="commercial-item-value">${item.count} lead(s)</div>
      </div>
    `).join("")
    : `<div class="empty-state">Sin datos.</div>`;
}

function renderRecentLeads(rows) {
  const wrap = $("recentLeadsWrap");
  if (!wrap) return;

  const recent = rows.slice(0, 8);

  wrap.innerHTML = recent.length
    ? recent.map(item => `
      <div class="commercial-item">
        <div class="commercial-item-title">${escapeHtml(item.full_name || "Sin nombre")}</div>
        <div class="commercial-item-sub">${escapeHtml(item.properties?.title || "Sin propiedad")}</div>
        <div class="commercial-item-value">${labelStage(item.stage)}</div>
      </div>
    `).join("")
    : `<div class="empty-state">Sin leads recientes.</div>`;
}

function renderStageSummary(rows) {
  const wrap = $("stageSummaryWrap");
  if (!wrap) return;

  const stages = ["nuevo", "contactado", "visita", "oferta", "cierre"];

  wrap.innerHTML = stages.map(stage => {
    const count = rows.filter(r => r.stage === stage).length;
    return `
      <div class="commercial-item">
        <div class="commercial-item-title">${labelStage(stage)}</div>
        <div class="commercial-item-value">${count}</div>
      </div>
    `;
  }).join("");
}

function labelStage(stage) {
  const labels = {
    nuevo: "Nuevo",
    contactado: "Contactado",
    visita: "Visita",
    oferta: "Oferta",
    cierre: "Cierre"
  };
  return labels[stage] || stage;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));
}

init();