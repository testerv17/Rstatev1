import { $ } from "../core/utils.js";

export function openGalleryAdminModal() {
  $("galleryAdminModal")?.classList.remove("hidden");
}

export function closeGalleryAdminModal() {
  $("galleryAdminModal")?.classList.add("hidden");
}

export function setGalleryAdminMessage(message, isError = false) {
  const el = $("galleryAdminMsg");

  if (!el) return;

  el.textContent = message;
  el.style.color = isError ? "#c73636" : "#11b67a";
}

export function getGalleryAdminFiles() {
  return Array.from($("galleryAdminInput")?.files || []);
}

export function clearGalleryAdminInput() {
  const input = $("galleryAdminInput");

  if (input) {
    input.value = "";
  }
}

export function renderGalleryAdmin(items = [], handlers = {}) {
  const el = $("galleryAdminGrid");

  if (!el) return;

  el.innerHTML = "";

  if (!items.length) {
    el.innerHTML = `
      <div class="empty-state">
        No hay archivos multimedia en esta propiedad.
      </div>
    `;

    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "gallery-admin-card";

    const isVideo = item.media_type === "video";

    const mediaHtml = isVideo
      ? `
        <video
          class="gallery-admin-image gallery-admin-video"
          src="${item.image_url}"
          controls
          muted
          preload="metadata"
          playsinline
        ></video>
      `
      : `
        <div
          class="gallery-admin-image"
          style="background-image: url('${item.image_url}')"
        ></div>
      `;

    const coverButtonHtml = isVideo
      ? `
        <span class="gallery-admin-badge">
          Video
        </span>
      `
      : `
        <button
          class="btn btn-soft btn-set-cover"
          type="button"
        >
          Usar como portada
        </button>
      `;

    card.innerHTML = `
      ${mediaHtml}

      <div class="gallery-admin-actions">
        ${
          item.is_cover
            ? `<span class="gallery-admin-badge">Portada</span>`
            : ""
        }

        ${coverButtonHtml}

        <button
          class="btn btn-ghost btn-delete-image"
          type="button"
        >
          Eliminar
        </button>
      </div>
    `;

    card
      .querySelector(".btn-set-cover")
      ?.addEventListener("click", () => {
        handlers.onSetCover?.(item);
      });

    card
      .querySelector(".btn-delete-image")
      ?.addEventListener("click", () => {
        handlers.onDelete?.(item);
      });

    el.appendChild(card);
  });
}
