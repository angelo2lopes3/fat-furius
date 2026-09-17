import {
  auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, doc, getDoc, setDoc, serverTimestamp
} from "./firebase.js";
import { $, $$, msg, erroFirebase, toast } from "./utils.js";

const PACOTES_DE_BOAS_VINDAS = 3;

export function initAuthUI() {
  $$("[data-auth-tab]").forEach(btn => btn.addEventListener("click", () => {
    $$("[data-auth-tab]").forEach(b => b.classList.toggle("is-on", b === btn));
    $("#form-login").classList.toggle("is-hidden", btn.dataset.authTab !== "login");
    $("#form-signup").classList.toggle("is-hidden", btn.dataset.authTab !== "signup");
  }));

  $("#form-login").addEventListener("submit", entrar);
  $("#form-signup").addEventListener("submit", cadastrar);
  $("#btn-reset").addEventListener("click", recuperarSenha);
  $("#btn-sair").addEventListener("click", () => signOut(auth));
}

// Aceita e-mail ou StateID no campo de identificação
async function resolverEmail(ident) {
  if (!/^\d+$/.test(ident)) return ident;
  const snap = await getDoc(doc(db, "stateIds", ident));
  if (!snap.exists()) throw new Error("Não existe conta com esse StateID.");
  return snap.data().email;
}

async function entrar(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const btn = form.querySelector('button[type=submit]');
  const { ident, senha } = Object.fromEntries(new FormData(form));
  btn.disabled = true; msg(form, "Entrando…");
  try {
    const email = await resolverEmail(ident.trim());
    await signInWithEmailAndPassword(auth, email, senha);
    msg(form, "");
  } catch (e) {
    msg(form, e.code ? erroFirebase(e) : e.message, "err");
  } finally { btn.disabled = false; }
}

async function cadastrar(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const btn = form.querySelector('button[type=submit]');
  const dados = Object.fromEntries(new FormData(form));
  const stateId = dados.stateId.trim();

  if (!/^\d+$/.test(stateId)) return msg(form, "O StateID aceita apenas números.", "err");

  btn.disabled = true; msg(form, "Criando conta…");
  try {
    const jaExiste = await getDoc(doc(db, "stateIds", stateId));
    if (jaExiste.exists()) throw new Error("Este StateID já está cadastrado.");

    const cred = await createUserWithEmailAndPassword(auth, dados.email.trim(), dados.senha);
    const uid = cred.user.uid;

    await setDoc(doc(db, "users", uid), {
      nome: dados.nome.trim(),
      email: dados.email.trim(),
      stateId,
      admin: false,
      packs: PACOTES_DE_BOAS_VINDAS,
      xp: 0,
      criadoEm: serverTimestamp()
    });
    await setDoc(doc(db, "stateIds", stateId), { uid, email: dados.email.trim() });

    msg(form, "");
    toast(`Conta criada. Você ganhou ${PACOTES_DE_BOAS_VINDAS} pacotes.`);
  } catch (e) {
    msg(form, e.code ? erroFirebase(e) : e.message, "err");
  } finally { btn.disabled = false; }
}

async function recuperarSenha() {
  const form = $("#form-login");
  const ident = new FormData(form).get("ident")?.trim();
  if (!ident) return msg(form, "Escreva seu e-mail ou StateID primeiro.", "err");
  try {
    const email = await resolverEmail(ident);
    await sendPasswordResetEmail(auth, email);
    msg(form, "Enviamos um link de redefinição para o seu e-mail.", "ok");
  } catch (e) {
    msg(form, e.code ? erroFirebase(e) : e.message, "err");
  }
}
