export const state = {
  user: null,        // Firebase user
  profile: null,     // doc users/{uid}
  stickers: [],      // todas as figurinhas
  owned: {},         // { stickerId: qtd }
  partners: [],
  packSize: 5
};

// 49 x 65 mm a 300 dpi
export const FIG_PX = { w: 579, h: 768 };

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(texto, kind) {
  const el = document.createElement("div");
  el.className = "toast" + (kind === "err" ? " toast--err" : "");
  el.textContent = texto;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), 3200);
}

export function msg(form, texto, kind = "") {
  const p = form.querySelector("[data-msg]");
  if (!p) return;
  p.textContent = texto;
  p.dataset.kind = kind;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function erroFirebase(e) {
  const map = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/user-not-found": "Não existe conta com esse e-mail.",
    "auth/email-already-in-use": "Este e-mail já tem conta. Entre em vez de criar.",
    "auth/weak-password": "A senha precisa de pelo menos 6 caracteres.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/too-many-requests": "Muitas tentativas. Espere um minuto e tente de novo.",
    "permission-denied": "Sua conta não tem permissão para isso."
  };
  return map[e?.code] || e?.message || "Algo deu errado. Tente de novo.";
}

/**
 * Recorta e redimensiona a imagem.
 * cover: preenche exatamente w x h (padrão das figurinhas 579x768 = 49x65 mm).
 * contain: mantém a proporção dentro do limite max (usado nas fotos dos parceiros).
 */
export async function processImage(file, opts = {}) {
  const { w, h, mode = "cover", max = 1200, type = "image/jpeg", quality = 0.9 } = opts;
  const bitmap = await createImageBitmap(await fileToBlob(file));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (mode === "cover") {
    canvas.width = w; canvas.height = h;
    const escala = Math.max(w / bitmap.width, h / bitmap.height);
    const dw = bitmap.width * escala, dh = bitmap.height * escala;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  bitmap.close?.();

  return new Promise((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error("Não consegui processar a imagem."))), type, quality));
}

function fileToBlob(file) {
  if (file.size > 12 * 1024 * 1024) throw new Error("Imagem muito grande (máximo 12 MB).");
  return Promise.resolve(file);
}
