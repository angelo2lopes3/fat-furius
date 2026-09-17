import {
  auth, db, onAuthStateChanged, doc, getDoc, collection, getDocs, query, orderBy
} from "./firebase.js";
import { state, $, $$, toast, erroFirebase } from "./utils.js";
import { initAuthUI } from "./auth.js";
import { renderAlbum, renderPartners, renderCabecalho, atualizarProgresso } from "./album.js";
import { initPacks } from "./packs.js";
import { renderGame } from "./game.js";

initAuthUI();
initPacks();

/* navegação por abas */
$$("[data-view]").forEach(btn => btn.addEventListener("click", ev => {
  ev.preventDefault();
  const alvo = btn.dataset.view;
  $$(".tab").forEach(t => t.classList.toggle("is-on", t.dataset.view === alvo));
  $$(".view").forEach(v => v.classList.toggle("is-hidden", v.id !== "view-" + alvo));
}));

$("#only-missing").addEventListener("change", renderAlbum);
$("#btn-print").addEventListener("click", () => window.print());

/* sessão */
onAuthStateChanged(auth, async user => {
  $("#boot").classList.add("is-hidden");
  state.user = user;

  if (!user) {
    $("#app").classList.add("is-hidden");
    $("#view-auth").classList.remove("is-hidden");
    return;
  }

  $("#view-auth").classList.add("is-hidden");
  $("#app").classList.remove("is-hidden");

  try {
    await carregarTudo(user.uid);
  } catch (e) {
    toast(erroFirebase(e), "err");
  }
});

async function carregarTudo(uid) {
  const [perfil, figs, parceiros, album, config] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDocs(query(collection(db, "stickers"), orderBy("numero"))),
    getDocs(query(collection(db, "partners"), orderBy("ordem"))),
    getDocs(collection(db, "users", uid, "album")),
    getDoc(doc(db, "config", "app")).catch(() => null)
  ]);

  state.profile = perfil.exists() ? perfil.data() : { nome: "Jogador", stateId: "—", packs: 0, xp: 0, admin: false };
  state.stickers = figs.docs.map(d => ({ id: d.id, ...d.data() }));
  state.partners = parceiros.docs.map(d => ({ id: d.id, ...d.data() }));
  state.owned = Object.fromEntries(album.docs.map(d => [d.id, d.data().qtd || 0]));
  if (config?.exists()) state.packSize = config.data().packSize || 5;

  state.profile.xp = state.profile.xp || 0;
  renderCabecalho();
  renderGame();
  renderAlbum();
  renderPartners();
  atualizarProgresso();

  if (state.profile.admin) {
    $("#tab-admin").classList.remove("is-hidden");
    const { initAdmin, listaFigurinhas, listaParceiros } = await import("./admin.js");
    initAdmin(); listaFigurinhas(); listaParceiros();
  }
}
