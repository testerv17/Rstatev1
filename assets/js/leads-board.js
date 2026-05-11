import { sb } from "./core/supabase.js";
import { $ } from "./core/utils.js";
import { appState } from "./core/state.js";
import { fetchMyProfile } from "./core/profile-service.js";
import { updateLeadStage } from "./leads/property-leads-service.js";

const STAGES = ["nuevo", "contactado", "visita", "oferta", "cierre"];

let draggedLeadId = null;

async function init() {
  const profileData = await fetchMyProfile();
  appState.currentUser = profileData?.user || null;
  appState.currentProfile = profileData?.profile || null;

  renderCurrentUserBadge();
  bindDropzones();

  await loadBoard();

  $("leadSearchInput")?.addEventListener("input", () => {
    loadBoard();
  });
}

async function loadBoard() {
  const search = $("leadSearchInput")?.value?.trim().toLowerCase() || "";

  let query = sb
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

  const role = appState.currentProfile?.role || "asesor";
  const userId = appState.currentUser?.id || null;

  if (role !== "admin" && userId) {
    query = query.eq("created_by", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error cargando leads:", error);
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

  renderBoard(rows);
}

function renderBoard(items) {
  STAGES.forEach((stage) => {
    const col = $(`col-${stage}`);
    if (col) col.innerHTML = "";
  });

  items.forEach((item) => {
    const stage = STAGES.includes(item.stage) ? item.stage : "nuevo";
    const col = $(`col-${stage}`);
    if (!col) return;

    const card = document.createElement("div");
    card.className = "pipeline-card";
    card.draggable = true;
    card.dataset.leadId = item.id;
    card.dataset.stage = stage;

    card.innerHTML = `
      <div class="pipeline-card-name">${escapeHtml(item.full_name || "Sin nombre")}</div>
      <div class="pipeline-card-property">${escapeHtml(item.properties?.title || "Sin propiedad")}</div>

      <div class="pipeline-card-meta">
        ${escapeHtml(item.phone || "Sin teléfono")}<br>
        ${escapeHtml(item.email || "Sin correo")}<br>
        ${item.budget ? "$" + Number(item.budget).toLocaleString("es-MX") : "Sin presupuesto"}
      </div>

      <div class="pipeline-card-notes">
        ${escapeHtml(item.notes || "Sin notas")}
      </div>

      <select class="pipeline-stage-select">
        ${STAGES.map(s => `
          <option value="${s}" ${item.stage === s ? "selected" : ""}>${labelStage(s)}</option>
        `).join("")}
      </select>

      <div class="pipeline-card-actions">
        <button class="btn btn-soft btn-save-stage" type="button">Mover</button>
      </div>
    `;

    card.addEventListener("dragstart", (e) => {
      draggedLeadId = item.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(item.id));
    });

    card.addEventListener("dragend", () => {
      draggedLeadId = null;
      card.classList.remove("dragging");
      document.querySelectorAll(".pipeline-dropzone").forEach((zone) => {
        zone.classList.remove("drag-over");
      });
    });

    const select = card.querySelector(".pipeline-stage-select");
    const btn = card.querySelector(".btn-save-stage");

    btn?.addEventListener("click", async () => {
      try {
        await updateLeadStage(item.id, select.value);
        await loadBoard();
      } catch (err) {
        console.error("Error moviendo etapa:", err);
        alert(err.message || "Error actualizando etapa.");
      }
    });

    col.appendChild(card);
  });
}

function bindDropzones() {
  STAGES.forEach((stage) => {
    const zone = $(`col-${stage}`);
    if (!zone) return;

    zone.dataset.stage = stage;

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drag-over");
      e.dataTransfer.dropEffect = "move";
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");

      const leadId = e.dataTransfer.getData("text/plain") || draggedLeadId;
      const newStage = zone.dataset.stage;

      if (!leadId || !newStage) return;

      try {
        await updateLeadStage(leadId, newStage);
        await loadBoard();
      } catch (err) {
        console.error("Error actualizando etapa por drag & drop:", err);
        alert(err.message || "Error moviendo lead.");
      }
    });
  });
}

function renderCurrentUserBadge() {
  const badge = $("userBadge");
  if (!badge || !appState.currentProfile) return;

  badge.textContent = `${appState.currentProfile.full_name || "Usuario"} · ${appState.currentProfile.role || "asesor"}`;
  badge.classList.remove("hidden");
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