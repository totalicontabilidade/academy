/* ============================================================
   Totali · Academy
   firebase-config.js — endereço do projeto no Firebase

   Estas chaves são PÚBLICAS por natureza. Elas só dizem "qual
   projeto" — não dão permissão nenhuma. Quem decide o que cada
   um pode ler e escrever são as regras do Firestore e do
   Storage. Por isso este arquivo pode ficar no repositório sem
   problema.

   O que NUNCA pode entrar aqui: chave de conta de serviço
   (aquela que começa com "-----BEGIN PRIVATE KEY") ou token do
   Admin SDK.

   PROJETO NOVO EM 23/09/2026. Era `portaldocliente-8cc7d`, e o
   ID de um projeto do Google é IMUTÁVEL — não havia como renomear.
   Como o sistema virou Academy e o ID antigo aparecia até no
   remetente do e-mail de redefinição de senha que o cliente lê, a
   saída foi um projeto novo. Nada se perdeu: os dados do antigo
   eram todos de teste.
   ============================================================ */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyC_DCtlBp34RcehtYW_VzXH8CVHsP8-a7I",
  authDomain: "totali-academy.firebaseapp.com",
  projectId: "totali-academy",
  storageBucket: "totali-academy.firebasestorage.app",
  messagingSenderId: "279694787480",
  appId: "1:279694787480:web:dee375150a7b71fec921ed"
};

/* ============================================================
   APP CHECK — DESLIGADO, E A CONTA FOI FEITA

   O App Check existia para impedir que alguém copiasse as chaves
   acima e falasse com o Firebase por fora da Academy, gastando
   cota. No sistema antigo isso pesava: havia documento de
   cliente, senha cifrada e arquivo no Storage.

   Aqui não há nada disso. O que existe é o catálogo de aulas —
   que é conteúdo nosso, de leitura pública de propósito — e o
   nome de quem assiste, protegido pelas regras. O abuso possível
   é consumo de cota, não vazamento.

   Decisão dele em 23/09/2026. O ganho de tirar: a CSP das páginas
   volta a ser só a própria origem, sem script de terceiro, e o
   reCAPTCHA deixa de carregar em toda abertura.

   Para religar, basta pôr a chave do site do reCAPTCHA v3 aqui e
   devolver os domínios do Google ao `script-src` da CSP.
   ============================================================ */
window.APP_CHECK_SITE_KEY = "";

/* Analytics foi deixado de fora de propósito: ele instala
   rastreamento de terceiros na tela do cliente, o que pede aviso
   de cookies e conversa com a LGPD sem trazer nada que a gente
   precise. Quem assistiu o quê já fica registrado em /alunos, que
   é dado nosso, no nosso banco, e que o próprio aluno pode apagar. */
