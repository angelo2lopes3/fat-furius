import {
  db, storage, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection,
  increment, serverTimestamp, sref, uploadBytes, getDownloadURL, deleteObject
} from "./firebase.js";
import { state, $, msg, toast, processImage, FIG_PX, escapeHtml, erroFirebase } from "./utils.js";
import { renderAlbum, renderPartners } from "./album.js";

export function initAdmin() {
  $("#form-sticker").addEventListener("submit", subirFigurinhas);
  $("#form-partner").addEventListener("submit", subirParceiro);
  $("#form-packs").addEventListener("submit", creditarPacotes);
  $("#form-config").addEventListener("submit", salvarConfig);
  $("#form-config").querySelector("[name=packSize]").value = state.packSize;
}

/* -------- figurinhas -------- */
async function subirFigurinhas(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const btn = form.querySelector("button[type=submit]");
  const dados = new FormData(form);
  const arquivos = [...dados.getAll("files")].filter(f => f.size);
  if (!arquivos.length) return msg(form, "Escolha pelo menos uma imagem.", "err");

  btn.disabled = true;
  let numero = state.stickers.reduce((m, s) => Math.max(m, s.numero || 0), 0);

  try {
    for (const [i, file] of arquivos.entries()) {
      msg(form, `Enviando ${i + 1} de ${arquivos.length}…`);
      const blob = await processImage(file, { w: FIG_PX.w, h: FIG_PX.h, mode: "cover", type: "image/jpeg", quality: 0.92 });
      numero += 1;

      const nome = (dados.get("nome") || "").trim() ||
        file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 40);
      const caminho = `stickers/${Date.now()}-${numero}.jpg`;
      const r = sref(storage, caminho);
      await uploadBytes(r, blob, { contentType: "image/jpeg", cacheControl: "public,max-age=31536000" });
      const imageUrl = await getDownloadURL(r);

      const ref = await addDoc(collection(db, "stickers"), {
        numero, nome, raridade: dados.get("raridade") || "comum",
        imageUrl, storagePath: caminho, criadoEm: serverTimestamp()
      });
      state.stickers.push({ id: ref.id, numero, nome, raridade: dados.get("raridade"), imageUrl, storagePath: caminho });
    }
    state.stickers.sort((a, b) => a.numero - b.numero);
    renderAlbum(); listaFigurinhas();
    form.reset();
    msg(form, `${arquivos.length} figurinha(s) no álbum.`, "ok");
  } catch (e) {
    msg(form, e.code ? erroFirebase(e) : e.message, "err");
  } finally { btn.disabled = false; }
}

export function listaFigurinhas() {
  $("#admin-stickers").innerHTML = state.stickers.map(s => `
    <div class="adminlist__item">
      <img src="${escapeHtml(s.imageUrl)}" alt="">
      <button data-del-sticker="${s.id}" title="Remover">×</button>
      <small>${s.numero} · ${escapeHtml(s.nome || "")}</small>
    </div>`).join("");

  $("#admin-stickers").onclick = async ev => {
    const id = ev.target.dataset?.delSticker;
    if (!id || !confirm("Remover esta figurinha da coleção?")) return;
    const s = state.stickers.find(x => x.id === id);
    try {
      await deleteDoc(doc(db, "stickers", id));
      if (s?.storagePath) await deleteObject(sref(storage, s.storagePath)).catch(() => {});
      state.stickers = state.stickers.filter(x => x.id !== id);
      renderAlbum(); listaFigurinhas();
      toast("Figurinha removida.");
    } catch (e) { toast(erroFirebase(e), "err"); }
  };
}

/* -------- parceiros (foto, sem link) -------- */
async function subirParceiro(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const btn = form.querySelector("button[type=submit]");
  const dados = new FormData(form);
  const file = dados.get("file");
  if (!file?.size) return msg(form, "Escolha a foto do parceiro.", "err");

  btn.disabled = true; msg(form, "Enviando…");
  try {
    const blob = await processImage(file, { mode: "contain", max: 1200, type: "image/webp", quality: 0.92 });
    const caminho = `partners/${Date.now()}.webp`;
    const r = sref(storage, caminho);
    await uploadBytes(r, blob, { contentType: "image/webp", cacheControl: "public,max-age=31536000" });
    const imageUrl = await getDownloadURL(r);

    const ordem = state.partners.length + 1;
    const ref = await addDoc(collection(db, "partners"), {
      nome: (dados.get("nome") || "").trim(), imageUrl, storagePath: caminho, ordem, criadoEm: serverTimestamp()
    });
    state.partners.push({ id: ref.id, nome: dados.get("nome"), imageUrl, storagePath: caminho, ordem });
    renderPartners(); listaParceiros();
    form.reset();
    msg(form, "Parceiro adicionado.", "ok");
  } catch (e) {
    msg(form, e.code ? erroFirebase(e) : e.message, "err");
  } finally { btn.disabled = false; }
}

export function listaParceiros() {
  $("#admin-partners").innerHTML = state.partners.map(p => `
    <div class="adminlist__item is-partner">
      <img src="${escapeHtml(p.imageUrl)}" alt="">
      <button data-del-partner="${p.id}" title="Remover">×</button>
      <small>${escapeHtml(p.nome || "")}</small>
    </div>`).join("");

  $("#admin-partners").onclick = async ev => {
    const id = ev.target.dataset?.delPartner;
    if (!id || !confirm("Remover este parceiro?")) return;
    const p = state.partners.find(x => x.id === id);
    try {
      await deleteDoc(doc(db, "partners", id));
      if (p?.storagePath) await deleteObject(sref(storage, p.storagePath)).catch(() => {});
      state.partners = state.partners.filter(x => x.id !== id);
      renderPartners(); listaParceiros();
      toast("Parceiro removido.");
    } catch (e) { toast(erroFirebase(e), "err"); }
  };
}

/* -------- pacotes e configuração -------- */
async function creditarPacotes(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const dados = Object.fromEntries(new FormData(form));
  msg(form, "Procurando…");
  try {
    const mapa = await getDoc(doc(db, "stateIds", dados.stateId.trim()));
    if (!mapa.exists()) throw new Error("Nenhuma conta com esse StateID.");
    const uid = mapa.data().uid;
    await updateDoc(doc(db, "users", uid), { packs: increment(Number(dados.qtd)) });
    if (uid === state.user.uid) { state.profile.packs += Number(dados.qtd); }
    msg(form, `${dados.qtd} pacote(s) creditado(s) para ${dados.stateId}.`, "ok");
    form.reset();
  } catch (e) {
    msg(form, e.code ? erroFirebase(e) : e.message, "err");
  }
}

async function salvarConfig(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const packSize = Number(new FormData(form).get("packSize"));
  try {
    await setDoc(doc(db, "config", "app"), { packSize }, { merge: true });
    state.packSize = packSize;
    $("#pack-size").textContent = packSize;
    msg(form, "Tamanho do pacote salvo.", "ok");
  } catch (e) { msg(form, erroFirebase(e), "err"); }
}
