import { $ } from "../core/utils.js";

export function openLeadModal() {
  $("leadModal")?.classList.remove("hidden");
}

export function closeLeadModal() {
  $("leadModal")?.classList.add("hidden");
}

export function openLeadListModal() {
  $("leadListModal")?.classList.remove("hidden");
}

export function closeLeadListModal() {
  $("leadListModal")?.classList.add("hidden");
}

export function setLeadFormMessage(message, isError = false) {
  const el = $("leadFormMsg");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#c73636" : "#11b67a";
}

export function setLeadListMessage(message, isError = false) {
  const el = $("leadListMsg");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#c73636" : "#11b67a";
}

export function clearLeadForm() {
  ["leadFullName", "leadPhone", "leadEmail", "leadBudget", "leadFollowUp", "leadNotes"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  if ($("leadStage")) $("leadStage").value = "nuevo";
}

export function getLeadFormData() {
  return {
    full_name: $("leadFullName")?.value.trim() || "",
    phone: $("leadPhone")?.value.trim() || "",
    email: $("leadEmail")?.value.trim() || "",
    budget: $("leadBudget")?.value || "",
    stage: $("leadStage")?.value || "nuevo",
    follow_up_at: $("leadFollowUp")?.value || null,
    notes: $("leadNotes")?.value.trim() || ""
  };
}

export function validateLeadForm(data) {
  if (!data.full_name) {
    return "Captura el nombre del lead.";
  }
  return null;
}

export function renderLeadList(items = [], handlers = {}) {
  const el = $("leadListWrap");
  if (!el) return;

  el.innerHTML = "";

  if (!items.length) {
    el.innerHTML = `<div class="empty-state">No hay leads para esta propiedad.</div>`;
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "lead-card";

    card.innerHTML = `
      <div class="lead-card-top">
        <div>
          <div class="lead-name">${item.full_name || ""}</div>
          <div class="lead-meta">
            ${item.phone || "Sin teléfono"} · ${item.email || "Sin correo"}
          </div>
          <div class="lead-meta">
            ${item.budget ? "$" + Number(item.budget).toLocaleString("es-MX") : "Sin presupuesto"}
          </div>
        </div>
        <div class="lead-stage">${item.stage || "nuevo"}</div>
      </div>

      <div class="lead-notes">${item.notes || "Sin notas"}</div>

      <div class="lead-actions">
  <button class="btn btn-soft btn-whatsapp">WhatsApp</button>
  <button class="btn btn-soft btn-stage" data-stage="contactado">Contactado</button>
  <button class="btn btn-soft btn-stage" data-stage="visita">Visita</button>
  <button class="btn btn-soft btn-stage" data-stage="oferta">Oferta</button>
  <button class="btn btn-ghost btn-delete">Eliminar</button>
</div>
    `;

    card.querySelectorAll(".btn-stage").forEach((btn) => {
      btn.addEventListener("click", () => {
        handlers.onStage?.(item, btn.dataset.stage);
      });
    });

    card.querySelector(".btn-whatsapp")?.addEventListener("click", () => {
  handlers.onWhatsApp?.(item);
});

    card.querySelector(".btn-delete")?.addEventListener("click", () => {
      handlers.onDelete?.(item);
    });

    el.appendChild(card);
  });
}
export function buildWhatsAppLeadUrl(lead, propertyTitle = "") {
  const rawPhone = String(lead.phone || "").replace(/\D/g, "");

  if (!rawPhone) {
    return null;
  }

  const phone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone;

  const message = `Hola ${lead.full_name || ""}, soy asesor inmobiliario. Te contacto por la propiedad "${propertyTitle || "que te interesó"}". ¿Te gustaría que agendemos una visita o te comparta más información?`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}