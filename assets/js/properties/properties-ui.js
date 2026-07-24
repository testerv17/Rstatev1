import { appState } from "../core/state.js";
import {
  $,
  formatMoney,
  formatPrice,
  escapeHtml,
  escapeAttr,
  propertyTypeLabel,
  defaultCover
} from "../core/utils.js";

export function renderPropertiesList(properties, onSelectProperty) {
  const container = $("resultsList");
  if (!container) return;

  container.innerHTML = "";

  if (!properties.length) {
    container.innerHTML = `<div class="empty-state">No se encontraron propiedades.</div>`;
    return;
  }

  properties.forEach((property) => {
    const card = document.createElement("div");
    card.className =
      "prop-card" +
      (String(property.id) === String(appState.selectedPropertyId) ? " active" : "");
    card.dataset.id = property.id;

    card.innerHTML = `
      <div class="prop-img" style="background-image:url('${escapeAttr(property.cover_url || defaultCover())}')">
        <span class="chip">${property.listing_type === "sale" ? "En venta" : "En renta"}</span>
      </div>
      <div class="prop-body">
        <div class="prop-price">${formatPrice(property.price, property.currency || "MXN")}</div>
        <div class="prop-title">${escapeHtml(property.title)}</div>
        <div class="prop-meta">${escapeHtml(property.city || "")}${property.state ? ", " + escapeHtml(property.state) : ""}</div>
        <div class="prop-spec">
          <span>${property.beds || 0} Rec</span>
          <span>${property.baths || 0} Baños</span>
          <span>${property.sqft ? formatMoney(property.sqft) + " sqft" : "—"}</span>
        </div>
        <div class="prop-actions">
          <button class="btn btn-primary" type="button">Ver</button>
          <button class="btn btn-ghost" type="button">Guardar</button>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof onSelectProperty === "function") {
        onSelectProperty(property, true);
      }
    });

    container.appendChild(card);
  });
}

export function updateResultsCount(total) {
  const el = $("resultsCount");
  if (!el) return;
  el.textContent = `${total} resultados`;
}

export function renderPropertyDetail(property, handlers = {}) {
  const target = $("selectedCard");
  const restoreBtn = $("btnRestoreDetail");
  if (!target) return;

  target.classList.remove("collapsed");
  restoreBtn?.classList.add("hidden");

  const gallery = Array.isArray(property.gallery) && property.gallery.length
    ? property.gallery
    : (property.cover_url
        ? [{
            image_url: property.cover_url,
            media_type: "image"
          }]
        : []);

const firstMedia = gallery[0] || {
    image_url: defaultCover(),
    media_type: "image"
};

  target.innerHTML = `
    <button class="detail-close" id="btnCloseDetail">×</button>

   <div class="detail-cover gallery-main" id="detailMainImage">

${
firstMedia.media_type === "video"

?

`
<video
    id="galleryMainVideo"
    controls
    muted
    autoplay
    playsinline
    style="
        width:100%;
        height:100%;
        object-fit:cover;
        border-radius:20px;
    ">

<source
src="${escapeAttr(firstMedia.image_url)}"
type="video/mp4">

</video>
`

:

`
<img
id="galleryMainPhoto"
src="${escapeAttr(firstMedia.image_url)}"

style="
width:100%;
height:100%;
object-fit:cover;
border-radius:20px;
">
`
}

${
gallery.length>1

?

`
<button class="gallery-nav prev" id="galleryPrev">‹</button>

<button class="gallery-nav next" id="galleryNext">›</button>
`

:

""
}

</div>
      ${gallery.length > 1 ? `
        <button class="gallery-nav prev" id="galleryPrev">‹</button>
        <button class="gallery-nav next" id="galleryNext">›</button>
      ` : ""}
    </div>

    <div class="detail-shell">
      ${gallery.length ? `
        <div class="gallery-thumbs" id="galleryThumbs">
          ${gallery.map((img,index)=>`

<div
class="gallery-thumb ${index===0?"active":""}"
data-index="${index}"

style="
background-image:url('${escapeAttr(img.image_url)}');
position:relative;
">

${
img.media_type==="video"

?

`
<div
style="
position:absolute;
inset:0;
display:flex;
justify-content:center;
align-items:center;
font-size:24px;
background:rgba(0,0,0,.25);
color:white;
">

▶

</div>
`

:

""
}

</div>

`).join("")}
        </div>
      ` : ""}

      <div class="detail-badge-row">
        <span class="detail-badge">${property.listing_type === "sale" ? "Venta" : "Renta"}</span>
        <span class="detail-badge">${escapeHtml(propertyTypeLabel(property.property_type))}</span>
      </div>

      <div class="detail-price">${formatPrice(property.price, property.currency || "MXN")}</div>
      <div class="detail-title">${escapeHtml(property.title)}</div>
      <div class="detail-location">${escapeHtml(property.address || "")}</div>

      <div class="detail-grid">
        <div class="detail-stat">
          <div class="detail-stat-label">Recámaras</div>
          <div class="detail-stat-value">${property.beds || 0}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Baños</div>
          <div class="detail-stat-value">${property.baths || 0}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Superficie</div>
          <div class="detail-stat-value">${property.sqft ? formatMoney(property.sqft) + " sqft" : "—"}</div>
        </div>
      </div>

      <div class="detail-desc">
        ${escapeHtml(property.description || "Propiedad premium en excelente ubicación.")}
      </div>

      <div class="detail-actions">
        <button class="btn btn-primary" type="button" id="btnDetailEdit">Editar</button>
        <button class="btn btn-soft" type="button" id="btnManageGallery">Fotos</button>
        <button class="btn btn-soft" type="button" id="btnManageLeads">Leads</button>
        <button class="btn btn-ghost" type="button" id="btnDetailDelete">Eliminar</button>
        <button class="btn btn-ghost" type="button" id="btnDetailWhatsApp">WhatsApp</button>
        <button class="btn btn-soft" type="button">Agendar visita</button>
       </div>
    </div>
  `;

  const closeBtn = $("btnCloseDetail");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      collapsePropertyDetail();
    });
  }

  $("btnDetailEdit")?.addEventListener("click", () => {
    handlers.onEdit?.(property);
  });

  $("btnDetailDelete")?.addEventListener("click", () => {
    handlers.onDelete?.(property);
  });

  $("btnDetailWhatsApp")?.addEventListener("click", () => {
  handlers.onPropertyWhatsApp?.(property);
});

  $("btnManageGallery")?.addEventListener("click", () => {
  handlers.onManageGallery?.(property);
});

$("btnManageLeads")?.addEventListener("click", () => {
  handlers.onManageLeads?.(property);
});

  bindGalleryInteractions(gallery);
}

function bindGalleryInteractions(gallery){

    if(!gallery.length) return;

    let currentIndex=0;

    const main=$("detailMainImage");

    const thumbs=
    Array.from(document.querySelectorAll(".gallery-thumb"));

    function renderMedia(index){

        currentIndex=index;

        const media=
        gallery[currentIndex];

        if(!main) return;

        if(media.media_type==="video"){

            main.innerHTML=`

<video
controls
autoplay
muted
playsinline

style="
width:100%;
height:100%;
object-fit:cover;
border-radius:20px;
">

<source
src="${media.image_url}"
type="video/mp4">

</video>

${
gallery.length>1

?

`
<button class="gallery-nav prev" id="galleryPrev">‹</button>

<button class="gallery-nav next" id="galleryNext">›</button>
`

:

""
}

`;

        }else{

            main.innerHTML=`

<img

src="${media.image_url}"

style="
width:100%;
height:100%;
object-fit:cover;
border-radius:20px;
">

${
gallery.length>1

?

`
<button class="gallery-nav prev" id="galleryPrev">‹</button>

<button class="gallery-nav next" id="galleryNext">›</button>
`

:

""
}

`;

        }

        thumbs.forEach((thumb,i)=>{

            thumb.classList.toggle(
                "active",
                i===currentIndex
            );

        });

        bindNav();

    }

    function bindNav(){

        $("galleryPrev")?.addEventListener("click",()=>{

            renderMedia(

                currentIndex===0
                ? gallery.length-1
                : currentIndex-1

            );

        });

        $("galleryNext")?.addEventListener("click",()=>{

            renderMedia(

                currentIndex===gallery.length-1
                ? 0
                : currentIndex+1

            );

        });

    }

    thumbs.forEach((thumb,i)=>{

        thumb.addEventListener("click",()=>{

            renderMedia(i);

        });

    });

    bindNav();

}

export function renderEmptyPropertyDetail() {
  const target = $("selectedCard");
  if (!target) return;
  target.innerHTML = `Selecciona una propiedad para ver sus detalles completos.`;
}

export function collapsePropertyDetail() {
  const detail = $("selectedCard");
  const restoreBtn = $("btnRestoreDetail");

  if (detail) detail.classList.add("collapsed");
  if (restoreBtn) restoreBtn.classList.remove("hidden");
}

export function restorePropertyDetail() {
  const detail = $("selectedCard");
  const restoreBtn = $("btnRestoreDetail");

  if (detail) detail.classList.remove("collapsed");
  if (restoreBtn) restoreBtn.classList.add("hidden");
}

export function highlightSelectedPropertyCard() {
  document.querySelectorAll(".prop-card").forEach((card) => {
    card.classList.toggle(
      "active",
      String(card.dataset.id) === String(appState.selectedPropertyId)
    );
  });
}

export function scrollSelectedPropertyCardIntoView() {
  const card = document.querySelector(`.prop-card[data-id="${appState.selectedPropertyId}"]`);
  const list = $("resultsList");
  if (!card || !list) return;

  const cardTop = card.offsetTop;
  const cardBottom = cardTop + card.offsetHeight;
  const viewTop = list.scrollTop;
  const viewBottom = viewTop + list.clientHeight;

  if (cardTop < viewTop) {
    list.scrollTo({ top: cardTop - 12, behavior: "smooth" });
  } else if (cardBottom > viewBottom) {
    list.scrollTo({ top: cardBottom - list.clientHeight + 12, behavior: "smooth" });
  }
}
