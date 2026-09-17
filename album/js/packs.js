import {
  db, doc, setDoc, updateDoc, increment, serverTimestamp
} from "./firebase.js";
import { state, $, sleep, toast, reduceMotion, escapeHtml, erroFirebase } from "./utils.js";
import { figHTML, renderAlbum, renderCabecalho } from "./album.js";
import { ganharXp, XP, renderGame } from "./game.js";

const PESOS = { comum: 70, rara: 25, lendaria: 5 };
const POSICAO_SORTEADA = 38;   // índice da figurinha vencedora dentro da fita
const TAMANHO_FITA = 52;

let abrindo = false;
let pular = false;

export function initPacks() {
  $("#btn-abrir").addEventListener("click", abrirPacote);
  $("#btn-abrir-2").addEventListener("click", abrirPacote);
  $("#btn-again").addEventListener("click", () => { fecharOverlay(); abrirPacote(); });
  $("#btn-close-open").addEventListener("click", () => {
    fecharOverlay();
    document.querySelector('.tab[data-view="album"]')?.click();
  });
  $("#btn-skip").addEventListener("click", () => { pular = true; });
}

/* ---------- sorteio ---------- */
function sortear(qtd) {
  const pool = state.stickers;
  const saida = [];
  for (let i = 0; i < qtd; i++) {
    const total = pool.reduce((a, s) => a + (PESOS[s.raridade] ?? PESOS.comum), 0);
    let r = Math.random() * total;
    for (const s of pool) {
      r -= PESOS[s.raridade] ?? PESOS.comum;
      if (r <= 0) { saida.push(s); break; }
    }
    if (saida.length < i + 1) saida.push(pool[pool.length - 1]);
  }
  return saida;
}

/* ---------- fluxo ---------- */
async function abrirPacote() {
  if (abrindo) return;
  if (!state.stickers.length) return toast("Ainda não há figurinhas cadastradas.", "err");
  if ((state.profile?.packs || 0) < 1) return toast("Você está sem pacotes.", "err");

  abrindo = true; pular = false;
  const uid = state.user.uid;

  try {
    await updateDoc(doc(db, "users", uid), { packs: increment(-1) });
    state.profile.packs -= 1;
    renderCabecalho();
  } catch (e) {
    abrindo = false;
    return toast(erroFirebase(e), "err");
  }

  const sorteadas = sortear(state.packSize);
  const eraNova = sorteadas.map((s, i) =>
    !state.owned[s.id] && sorteadas.findIndex(x => x.id === s.id) === i);

  // grava no álbum enquanto a animação roda
  const gravacao = Promise.all(sorteadas.map(s =>
    setDoc(doc(db, "users", uid, "album", s.id),
      { qtd: increment(1), stickerId: s.id, ultimaEm: serverTimestamp() }, { merge: true })
  )).catch(e => toast(erroFirebase(e), "err"));

  abrirOverlay();
  await animarPacote();

  $("#roulette").classList.remove("is-hidden");
  for (let i = 0; i < sorteadas.length; i++) {
    await girarRoleta(sorteadas[i], i, sorteadas.length, eraNova[i]);
    if (pular) break;
  }

  sorteadas.forEach(s => { state.owned[s.id] = (state.owned[s.id] || 0) + 1; });
  await gravacao;
  renderAlbum();

  const novas = eraNova.filter(Boolean).length;
  const ganho = XP.pacote + novas * XP.nova + (sorteadas.length - novas) * XP.repetida;
  await ganharXp(ganho);
  $("#haul-xp").textContent = `+${ganho} XP  ·  ${novas} nova(s), ${sorteadas.length - novas} repetida(s)`;

  mostrarResultado(sorteadas, eraNova);
  abrindo = false;
}

function abrirOverlay() {
  $("#opening").classList.remove("is-hidden");
  $("#roulette").classList.add("is-hidden");
  $("#haul").classList.add("is-hidden");
  $("#pack-anim").classList.remove("is-hidden", "is-opening", "is-shaking");
  $("#roulette-result").innerHTML = "";
  $("#btn-skip").classList.remove("is-hidden");
  document.body.style.overflow = "hidden";
}

function fecharOverlay() {
  $("#opening").classList.add("is-hidden");
  document.body.style.overflow = "";
}

/* ---------- 1. o pacote rasgando ---------- */
async function animarPacote() {
  const pack = $("#pack-anim");
  if (reduceMotion() || pular) { pack.classList.add("is-hidden"); return; }
  pack.classList.add("is-shaking");
  await sleep(1000);
  pack.classList.remove("is-shaking");
  pack.classList.add("is-opening");
  await sleep(850);
  pack.classList.add("is-hidden");
}

/* ---------- 2. a roleta horizontal ---------- */
async function girarRoleta(alvo, indice, total, nova) {
  const strip = $("#roulette-strip");
  const viewport = $("#roulette-viewport");
  const resultado = $("#roulette-result");

  $("#roulette-counter").textContent = `${indice + 1} / ${total}`;
  resultado.innerHTML = "";

  const pool = state.stickers.length ? state.stickers : [alvo];
  const fita = Array.from({ length: TAMANHO_FITA }, (_, i) =>
    i === POSICAO_SORTEADA ? alvo : pool[Math.floor(Math.random() * pool.length)]);

  strip.innerHTML = fita.map(s => figHTML(s)).join("");
  strip.style.transition = "none";
  strip.style.transform = "translate3d(0,0,0)";
  await proximoFrame(); await proximoFrame();

  const card = strip.children[0];
  const espaco = parseFloat(getComputedStyle(strip).gap) || 14;
  const passo = card.getBoundingClientRect().width + espaco;
  const meio = viewport.getBoundingClientRect().width / 2;
  const centro = POSICAO_SORTEADA * passo + passo / 2 - meio;
  const desvio = (Math.random() - 0.5) * passo * 0.34;

  if (reduceMotion() || pular) {
    strip.style.transform = `translate3d(${-centro}px,0,0)`;
    await sleep(pular ? 120 : 500);
  } else {
    const duracao = 3000 + Math.random() * 700;
    strip.style.transition = `transform ${duracao}ms cubic-bezier(.08,.72,.13,1)`;
    strip.style.transform = `translate3d(${-(centro + desvio)}px,0,0)`;
    await sleep(duracao + 120);

    strip.style.transition = "transform 340ms ease-out";
    strip.style.transform = `translate3d(${-centro}px,0,0)`;
    await sleep(380);
  }

  strip.children[POSICAO_SORTEADA]?.classList.add("fig--hit");
  resultado.innerHTML = nova
    ? `<span class="tag-nova">Nova!</span><small>${escapeHtml(alvo.nome || "")} · nº ${alvo.numero}</small>`
    : `<span class="tag-rep">Repetida</span><small>${escapeHtml(alvo.nome || "")} · nº ${alvo.numero}</small>`;

  if (!pular) await sleep(reduceMotion() ? 400 : 900);
}

/* ---------- 3. resumo ---------- */
function mostrarResultado(sorteadas, eraNova) {
  $("#roulette").classList.add("is-hidden");
  $("#btn-skip").classList.add("is-hidden");
  $("#haul").classList.remove("is-hidden");
  $("#haul-row").innerHTML = sorteadas.map((s, i) =>
    `<div>${figHTML(s)}<p style="text-align:center;font-size:12px;margin:6px 0 0"
      class="${eraNova[i] ? "tag-nova" : "tag-rep"}">${eraNova[i] ? "nova" : "repetida"}</p></div>`).join("");

  $("#btn-again").disabled = (state.profile?.packs || 0) < 1;
  renderGame();
  $("#last-harvest").innerHTML = sorteadas.map(s => figHTML(s)).join("");
  renderCabecalho();
}

const proximoFrame = () => new Promise(r => requestAnimationFrame(r));
