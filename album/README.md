# Álbum da Cidade

Site estático (HTML, CSS e JavaScript puro) hospedado no **GitHub Pages**, usando o **Firebase apenas como banco de dados** — Authentication, Firestore e Storage. Nada de servidor próprio, nada de build.

Cadastro por **StateID**, parceiros em **foto**, figurinhas **49 × 65 mm**, abertura de pacote com **roleta horizontal** e uma camada gamificada de **XP, níveis e missões**.

---

## 1. Firebase (banco de dados)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Adicionar projeto**.
2. **Authentication** → Começar → ative **E-mail/senha**.
3. **Firestore Database** → Criar banco de dados → modo de produção.
4. **Storage** → Começar.
5. **Configurações do projeto > Seus apps > Web (`</>`)** → registre o app e copie o `firebaseConfig`.
6. Cole os valores em `js/firebase-config.js`.

**Passo que quase todo mundo esquece:** em **Authentication > Settings > Domínios autorizados**, adicione `SEU-USUARIO.github.io`. Sem isso o login não funciona no GitHub Pages.

Publicar as regras de segurança (opcional, mas recomendado — dá para colar direto no console também):

```bash
npm install -g firebase-tools
firebase login
# troque SEU-PROJETO no .firebaserc
firebase deploy --only firestore:rules,storage
```

No Storage, libere o CORS para o seu domínio se algum upload falhar:

```bash
echo '[{"origin":["https://SEU-USUARIO.github.io"],"method":["GET","PUT","POST"],"maxAgeSeconds":3600}]' > cors.json
gsutil cors set cors.json gs://SEU-PROJETO.appspot.com
```

## 2. GitHub Pages (hospedagem)

```bash
git init
git add .
git commit -m "Álbum da Cidade"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```

No repositório: **Settings > Pages > Source: GitHub Actions**. O workflow `.github/workflows/pages.yml` publica a cada push na `main`.
Se preferir sem Actions, escolha **Deploy from a branch → main → / (root)** — o arquivo `.nojekyll` já está aqui para o Pages não mexer nas pastas.

O site sai em `https://SEU-USUARIO.github.io/SEU-REPO/`.

## 3. Virar administrador

Crie sua conta no site, abra `users/{seu-uid}` no Firestore e mude `admin` para `true`. Recarregue: a aba **Admin** aparece, com upload de figurinhas, cadastro de parceiros, crédito de pacotes por StateID e tamanho do pacote.

---

## Gamificação

- **XP**: 12 por figurinha nova, 3 por repetida, 5 por pacote aberto.
- **Níveis**: o nível `n` custa `100 + 40·(n−1)` XP. Patentes de Novato da cidade a Lenda do álbum.
- **Missões**: oito conquistas calculadas em cima do álbum (primeira colada, 10 figurinhas, 5 raras, 3 lendárias, 10 repetidas, metade do álbum, coleção completa). Aparecem na aba Missões com barra de progresso.
- Mexer nos valores: `XP` e `PATENTES` em `js/game.js`; chance por raridade em `PESOS` de `js/packs.js`.

## Arte

Tudo em SVG, editável em texto: `assets/hero.svg` (ilustração do pacote estourando), `assets/brand.svg` (marca), `assets/favicon.svg`, `assets/og.svg` + `assets/og.png` (imagem de compartilhamento 1200 × 630).

## Estrutura

```
index.html   404.html   .nojekyll
css/styles.css
js/   firebase-config.js  firebase.js  utils.js  auth.js  album.js  packs.js  game.js  admin.js  main.js
assets/   hero.svg  brand.svg  favicon.svg  og.svg  og.png
firebase.json  .firebaserc  firestore.rules  storage.rules  firestore.indexes.json
.github/workflows/pages.yml
```

## Dados no Firestore

| Coleção | Campos |
|---|---|
| `users/{uid}` | nome, email, stateId, admin, packs, xp, criadoEm |
| `stateIds/{stateId}` | uid, email |
| `stickers/{id}` | numero, nome, raridade (comum / rara / lendaria), imageUrl, storagePath |
| `partners/{id}` | nome, imageUrl, storagePath, ordem |
| `users/{uid}/album/{stickerId}` | qtd, ultimaEm |
| `config/app` | packSize |

## Testar na sua máquina

Os arquivos usam módulos ES, então abrir o `index.html` clicando duas vezes não funciona. Rode um servidor:

```bash
python3 -m http.server 5173
# http://localhost:5173
```

E acrescente `localhost` aos domínios autorizados do Authentication.

## Segurança

As regras impedem que um jogador aumente os próprios pacotes ou vire admin, e só admin envia imagens. O sorteio roda no navegador: para uma cidade grande, mova `abrirPacote` (`js/packs.js`) para uma Cloud Function e bloqueie a escrita direta em `users/{uid}/album` e no campo `xp`.
