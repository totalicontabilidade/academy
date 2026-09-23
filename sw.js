/* ============================================================
   Totali · Academy
   sw.js — service worker (funcionamento offline)

   Estratégia:
     • Navegação (HTML)  → rede primeiro, cache como reserva.
       Garante que o cliente sempre veja a versão mais recente
       quando estiver online.
     • Demais recursos   → cache primeiro, atualizando em segundo
       plano. Deixa o portal instantâneo depois da primeira visita.

   Segurança:
     • Só entram no cache respostas da MESMA origem, com status 200
       e método GET. Nada de terceiros, nada de resposta opaca.

   Ao alterar qualquer arquivo do app, suba o número da versão —
   é o que faz o navegador do cliente buscar o conteúdo novo.
   ============================================================ */
var VERSAO = "v205";
var CACHE = "totali-academy-" + VERSAO;

var SHELL = [
  "./",
  "./index.html",
  "./css/academy.css",
  "./lib/firebase-app-compat.js",
  "./lib/firebase-auth-compat.js",
  "./lib/firebase-firestore-compat.js",
  "./lib/firebase-storage-compat.js",
  "./js/firebase-config.js",
  "./js/util.js",
  "./js/catalogo.js",
  "./js/nucleo.js",
  "./js/aluno.js",
  "./js/pwa.js",
  "./manifest.webmanifest",
  "./assets/academy-simbolo.png",
  "./assets/academy-branca.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/favicon-32.png",
  "./assets/apple-touch-icon.png"
];

/* A LISTA ENCURTOU MUITO EM 23/09/2026, e não foi otimização: o
   sistema deixou de ter documento, senha, cofre, PDF gerado no
   navegador e página de extrato. Saíram daqui, junto com o código
   que os servia, o jsPDF, o módulo de criptografia, o de
   armazenamento local de arquivos e a folha de estilo antiga.

   O que entra no cache é só o que a Academy precisa para abrir
   offline: a casca, o catálogo já visto e a marca. O vídeo vem do
   YouTube e nunca é adiantado — seria adiantar megabytes de algo
   que a pessoa pode não assistir. */

/* O QUE MUDOU AQUI, E POR QUÊ — leia antes de "otimizar".

   Antes o `install` terminava com `skipWaiting()`, e o `activate`
   com `clients.claim()`. Juntos, eles faziam a versão nova assumir
   uma aba JÁ ABERTA no meio do uso. Na prática: o cliente estava
   enviando um documento, saía uma publicação, o service worker
   trocava debaixo dele e o envio morria. Foi o "sistema cai
   enquanto vocês atualizam" que o Raoni relatou.

   Agora a versão nova INSTALA e ESPERA, e quem manda assumir é a
   página, pela mensagem "assumir-agora".

   QUANDO A PÁGINA MANDA (ver js/pwa.js): se ninguém tocou na tela
   desde que ela abriu, na hora — não há envio nem digitação para
   interromper, e pedir permissão para atualizar algo que a pessoa
   acabou de abrir não faz sentido. Se já houve toque, espera o
   aviso ser tocado. A decisão mora lá porque só a página sabe se
   alguém está no meio de alguma coisa. */
self.addEventListener("install", function (ev) {
  ev.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: "reload" })).catch(function () { /* segue sem travar */ });
      }));
    })
  );
});

/* A página pede a troca quando o usuário aceita. */
self.addEventListener("message", function (ev) {
  if (ev.data === "assumir-agora") self.skipWaiting();
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.map(function (n) {
        if (n !== CACHE && (n.indexOf("totali-academy-") === 0 ||
            n.indexOf("totali-onboarding-") === 0)) return caches.delete(n);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function mesmaOrigem(req) {
  try { return new URL(req.url).origin === self.location.origin; }
  catch (e) { return false; }
}

function guardavel(resp) {
  return resp && resp.status === 200 && resp.type === "basic";
}

/* Sob qual chave esta navegação deve ser guardada. Só existem
   duas páginas no projeto; qualquer outra rota cai no portal. */
function paginaDe(url) {
  try {
    return /(^|\/)admin\/?$|\/admin\/index\.html$/i.test(new URL(url).pathname)
      ? "./admin/" : "./index.html";
  } catch (e) { return "./index.html"; }
}

/* O que é código do aplicativo e precisa estar sempre atual. */
function ehCodigo(url) {
  try { return /\.(js|css|webmanifest)$/i.test(new URL(url).pathname); }
  catch (e) { return false; }
}

self.addEventListener("fetch", function (ev) {
  var req = ev.request;

  if (req.method !== "GET" || !mesmaOrigem(req)) return;

  /* Navegação: rede primeiro.

     CADA PÁGINA NO SEU PRÓPRIO LUGAR. Antes, toda navegação era
     guardada sob a chave "./index.html" — inclusive a do painel.
     Bastava alguém da equipe abrir o painel para o portal do
     cliente, naquele aparelho, passar a abrir o PAINEL quando
     estivesse sem internet. Não vazava nada (o painel exige login
     e servidor), mas era a tela errada na hora errada. */
  if (req.mode === "navigate") {
    var pagina = paginaDe(req.url);
    ev.respondWith(
      /* O `no-cache` aqui é o mesmo remédio já aplicado ao código
         mais abaixo, e pelo mesmo motivo.

         "Rede primeiro" não bastava: o GitHub Pages manda guardar
         por 10 minutos, então a busca na rede era atendida pelo
         cache do próprio navegador e a página vinha VELHA mesmo com
         a versão nova publicada. Depois de um deploy, o portal
         continuava mostrando a tela antiga por até 10 minutos — e
         quem testa logo depois de publicar conclui que o deploy
         falhou. Aconteceu aqui, em 26 de agosto de 2026.

         Com o `no-cache` o servidor responde 304 quando não mudou
         nada, que é curto, e manda o arquivo quando mudou. */
      fetch(new Request(req, { cache: "no-cache" })).then(function (resp) {
        if (guardavel(resp)) {
          var copia = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(pagina, copia); });
        }
        return resp;
      }).catch(function () {
        /* O painel não entra no SHELL de propósito: ele é ferramenta
           da equipe e não faz sentido pesar no aparelho de todo
           cliente. Sem rede e sem cópia dele, cai no portal. */
        return caches.match(pagina).then(function (r) {
          if (r) return r;
          return caches.match("./index.html").then(function (r2) {
            return r2 || caches.match("./");
          });
        });
      })
    );
    return;
  }

  /* CÓDIGO (js, css, manifesto): rede primeiro, cache como
     reserva.

     Antes era cache primeiro, e isso criava um problema chato de
     enxergar: a página HTML vinha nova, mas o JavaScript e o CSS
     vinham velhos, do cache. A correção só aparecia no segundo ou
     terceiro acesso — ou depois de um Ctrl+Shift+R. Quem usa o
     portal não tem como saber que precisa fazer isso.

     O `no-cache` obriga a revalidar também no cache do navegador:
     sem ele, o GitHub Pages manda guardar por 10 minutos e a
     resposta continuaria velha mesmo buscando na rede. Quando há
     versão nova o servidor manda o arquivo; quando não há, manda
     um 304 curtinho. Sem internet, cai para o cache e o portal
     abre normalmente. */
  if (ehCodigo(req.url)) {
    ev.respondWith(
      fetch(new Request(req, { cache: "no-cache" })).then(function (resp) {
        if (guardavel(resp)) {
          var copia = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
        }
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (r) { return r || Response.error(); });
      })
    );
    return;
  }

  /* Imagens e demais arquivos: cache primeiro, revalidando em
     segundo plano. Mudam pouco e pesam mais. */
  ev.respondWith(
    caches.match(req).then(function (cacheado) {
      var busca = fetch(req).then(function (resp) {
        if (guardavel(resp)) {
          var copia = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
        }
        return resp;
      }).catch(function () { return cacheado; });
      return cacheado || busca;
    })
  );
});

/* As notificações saíram com o onboarding: não há mais pendência
   de documento a cobrar, e nada na Academy dispara push. O
   ouvinte de `push` e o de `notificationclick` estão na tag
   `portal-completo`, se um dia voltarem a fazer sentido.
   ============================================================ */
