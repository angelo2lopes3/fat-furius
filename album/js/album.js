import { state, $, escapeHtml } from "./utils.js";
import { renderGame } from "./game.js";

/** HTML de uma figurinha (49x65 mm). `dupes` mostra o selo de repetidas. */
export function figHTML(s, { dupes = 0, slot = false } = {}) {
  if (slot) {
    return `<div class="fig fig--slot" title="Ainda falta">
      <b>${s.numero}</b><span>falta</span></div>`;
  }
  return `<div class="fig fig--${escapeHtml(s.raridade || "comum")}">
    <img src="${escapeHtml(s.imageUrl)}" alt="${escapeHtml(s.nome || "Figurinha " + s.numero)}" loading="lazy">
    <span class="fig__num">${s.numero} · ${escapeHtml(s.nome || "")}</span>
    ${dupes > 1 ? `<span class="fig__dupe">${dupes - 1} rep.</span>` : ""}
  </div>`;
}

export function renderAlbum() {
  const grid = $("#album-grid");
  const soFaltam = $("#only-missing").checked;
  const lista = state.stickers;

  $("#album-empty").classList.toggle("is-hidden", lista.length > 0);

  grid.innerHTML = lista
    .filter(s => (soFaltam ? !state.owned[s.id] : true))
    .map(s => (state.owned[s.id] ? figHTML(s, { dupes: state.owned[s.id] }) : figHTML(s, { slot: true })))
    .join("");

  atualizarProgresso();
}

export function atualizarProgresso() {
  const total = state.stickers.length;
  const coladas = state.stickers.filter(s => state.owned[s.id]).length;
  const repetidas = Object.values(state.owned).reduce((a, q) => a + Math.max(0, q - 1), 0);
  const pct = total ? (coladas / total) * 100 : 0;

  $("#progress-fill").style.width = pct + "%";
  $("#progress-text").textContent = `${coladas} de ${total} figurinhas — ${pct.toFixed(0)}% do álbum`;
  $("#stat-coladas").textContent = coladas;
  $("#stat-total").textContent = total;
  $("#stat-repetidas").textContent = repetidas;
  if ($("#missions-grid")) renderGame();
}

export function renderPartners() {
  const grid = $("#partners-grid");
  $("#partners-empty").classList.toggle("is-hidden", state.partners.length > 0);
  grid.innerHTML = state.partners.map(p => `
    <figure class="partner">
      <div class="partner__ph"><img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.nome)}" loading="lazy"></div>
      <figcaption class="partner__name">${escapeHtml(p.nome)}</figcaption>
    </figure>`).join("");
}

export function renderCabecalho() {
  const p = state.profile;
  $("#me-nome").textContent = p?.nome || "—";
  $("#me-state").textContent = "StateID " + (p?.stateId || "—");
  const packs = p?.packs || 0;
  $("#packs-count").textContent = packs;
  $("#packs-word").textContent = packs === 1 ? "1 pacote" : `${packs} pacotes`;
  $("#pack-size").textContent = state.packSize;
  $("#btn-abrir").disabled = packs < 1;
  $("#btn-abrir-2").disabled = packs < 1;
}
