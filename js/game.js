import { db, doc, updateDoc, increment } from "./firebase.js";
import { state, $, toast, escapeHtml } from "./utils.js";

export const XP = { nova: 12, repetida: 3, pacote: 5 };

const PATENTES = [
  [1, "Novato da cidade"],
  [3, "Colecionador de esquina"],
  [6, "Figurinha carimbada"],
  [10, "Dono da banca"],
  [15, "Lenda do álbum"]
];

/** Custo do nível n: 100 + 40·(n−1). */
export function nivelDe(xp = 0) {
  let n = 1, sobra = xp, custo = 100;
  while (sobra >= custo) { sobra -= custo; n++; custo = 100 + 40 * (n - 1); }
  return { nivel: n, atual: sobra, custo, pct: (sobra / custo) * 100 };
}

export function patente(n) {
  let nome = PATENTES[0][1];
  for (const [min, titulo] of PATENTES) if (n >= min) nome = titulo;
  return nome;
}

export async function ganharXp(qtd) {
  if (!qtd) return;
  const antes = nivelDe(state.profile.xp || 0).nivel;
  state.profile.xp = (state.profile.xp || 0) + qtd;
  const depois = nivelDe(state.profile.xp).nivel;
  renderGame();
  if (depois > antes) toast(`Nível ${depois}: ${patente(depois)}`);
  try {
    await updateDoc(doc(db, "users", state.user.uid), { xp: increment(qtd) });
  } catch { /* o XP local continua válido; sincroniza no próximo login */ }
}

/* ---------- missões calculadas a partir do álbum ---------- */
function missoes() {
  const coladas = state.stickers.filter(s => state.owned[s.id]).length;
  const total = state.stickers.length;
  const repetidas = Object.values(state.owned).reduce((a, q) => a + Math.max(0, q - 1), 0);
  const lendarias = state.stickers.filter(s => s.raridade === "lendaria" && state.owned[s.id]).length;
  const raras = state.stickers.filter(s => s.raridade === "rara" && state.owned[s.id]).length;
  const metade = Math.ceil(total / 2) || 1;

  return [
    { nome: "Primeira colada", desc: "Cole a sua primeira figurinha.", feito: coladas, alvo: 1 },
    { nome: "Pé na banca", desc: "Chegue a 10 figurinhas no álbum.", feito: coladas, alvo: 10 },
    { nome: "Cheirinho de novo", desc: "Junte 25 figurinhas.", feito: coladas, alvo: 25 },
    { nome: "Caçador de raras", desc: "Cole 5 figurinhas raras.", feito: raras, alvo: 5 },
    { nome: "Ouro na mão", desc: "Cole 3 lendárias.", feito: lendarias, alvo: 3 },
    { nome: "Estoque de troca", desc: "Acumule 10 repetidas.", feito: repetidas, alvo: 10 },
    { nome: "Meio caminho", desc: "Complete metade do álbum.", feito: coladas, alvo: metade },
    { nome: "Álbum fechado", desc: "Complete a coleção inteira.", feito: coladas, alvo: total || 1 }
  ];
}

export function renderGame() {
  const p = state.profile || {};
  const n = nivelDe(p.xp || 0);
  const pct = Math.min(100, n.pct);

  $("#lvl-num").textContent = n.nivel;
  $("#lvl-num-2").textContent = n.nivel;
  $("#xp-fill").style.width = pct + "%";
  $("#xp-fill-2").style.width = pct + "%";
  $("#xp-text").textContent = `${n.atual} / ${n.custo} XP`;
  $("#xp-text-2").textContent = `${n.atual} / ${n.custo} XP para o nível ${n.nivel + 1}`;
  $("#lvl-title").textContent = patente(n.nivel);
  $("#hero-rank").textContent = `Nível ${n.nivel} · ${patente(n.nivel)}`;
  $("#stat-xp").textContent = p.xp || 0;

  $("#missions-grid").innerHTML = missoes().map(m => {
    const feito = Math.min(m.feito, m.alvo);
    const ok = feito >= m.alvo;
    return `<article class="mission ${ok ? "is-done" : ""}">
      <div class="mission__mark">${ok ? "✔" : Math.round((feito / m.alvo) * 100) + "%"}</div>
      <div>
        <h3>${escapeHtml(m.nome)}</h3>
        <p>${escapeHtml(m.desc)}</p>
        <div class="xp"><span style="width:${(feito / m.alvo) * 100}%"></span></div>
        <small>${feito} de ${m.alvo}</small>
      </div>
    </article>`;
  }).join("");
}
