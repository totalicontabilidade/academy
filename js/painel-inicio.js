/* ============================================================
   Totali · Academy
   painel-inicio.js — a primeira tela, e o que ela responde

   UMA PERGUNTA SÓ: o que precisa de você agora. Não traz
   informação nova — traz a mesma das outras abas, em ordem do que
   custa mais deixar para amanhã.

   Três coisas pedem ação nesta Academy, e nesta ordem:

     1. Nada publicado ainda. Enquanto o catálogo estiver vazio no
        servidor, o cliente vê o conteúdo de exemplo. É o pior
        estado possível e o mais fácil de não perceber, porque a
        tela do cliente parece cheia.
     2. Aula sem vídeo. Aparece como "em breve", o que é legítimo
        — mas só enquanto for de propósito.
     3. Aluno parado. Quem não abre há semanas é o que pede uma
        ligação, e é o número que diz se o conteúdo está servindo.

   Se nada disso existir, a tela diz isso com todas as letras em
   vez de inventar um painel de indicadores. Tela de início que
   não tem o que dizer deve dizer que está tudo em ordem.
   ============================================================ */
(function (global) {
  "use strict";

  var UI = global.UI, U = global.U, A = global.Admin, C = global.Catalogo;
  var $ = UI.$;
  var ic = UI.icone;

  var carregado = false;

  function carregar() {
    if (carregado) return Promise.resolve();
    var caixa = $("#inCorpo");
    if (caixa) caixa.innerHTML = '<div class="card card--pad text-muted">Carregando…</div>';

    return Promise.all([A.lerCatalogo(), A.alunos()]).then(function (r) {
      carregado = true;
      desenhar(r[0] || {}, r[1] || []);
    }, function (e) {
      if (caixa) {
        caixa.innerHTML = '<div class="notice notice--warn"><span class="notice__icon">' +
          ic("ic-alert") + '</span><span>' + U.esc(A.explicar(e)) + '</span></div>';
      }
    });
  }

  function vistoDe(aluno) {
    return function (trilhaId, n) {
      var chave = String(trilhaId).replace(/[.~/[\]*]/g, "") + "|" + Number(n);
      return !!aluno.progresso[chave];
    };
  }

  function desenhar(doc, alunos) {
    var caixa = $("#inCorpo");
    if (!caixa) return;

    var publicou = Array.isArray(doc.academy) && doc.academy.length > 0;
    var trilhas = C.aplicar(doc).trilhas;

    var aulas = 0, semVideo = 0;
    trilhas.forEach(function (t) {
      aulas += t.aulas.length;
      t.aulas.forEach(function (a) { if (!C.aulaDisponivel(a)) semVideo++; });
    });

    var agora = Date.now();
    var parados = alunos.filter(function (a) {
      return !a.ultimoAcessoEm || (agora - a.ultimoAcessoEm) > 14 * 86400000;
    });

    var soma = 0;
    alunos.forEach(function (a) { soma += C.resumoGeral(trilhas, vistoDe(a)).pct; });
    var medio = alunos.length ? Math.round(soma / alunos.length) : 0;

    var eu = A.eu();
    var nome = U.primeiroNome ? U.primeiroNome(eu && eu.nome) : ((eu && eu.nome) || "");

    caixa.innerHTML =
      '<div class="card card--pad" style="margin-bottom:14px">' +
        '<div class="eyebrow">' + U.esc(U.saudacao ? U.saudacao() : "Olá") + '</div>' +
        '<h2 class="section__title" style="font-size:19px;margin-top:4px">' +
          (nome ? U.esc(nome) : "Bem-vindo") + '</h2>' +
        '<p class="section__desc">' +
          (publicou
            ? "A Academy está no ar com o conteúdo que vocês publicaram."
            : "A Academy ainda está mostrando o conteúdo de exemplo.") +
        '</p>' +
      '</div>' +

      '<div class="numeros">' +
        numero(trilhas.length, U.plural(trilhas.length, "trilha", "trilhas")) +
        numero(aulas, U.plural(aulas, "aula", "aulas")) +
        numero(alunos.length, U.plural(alunos.length, "aluno", "alunos")) +
        numero(medio + "%", "progresso médio") +
      '</div>' +

      avisos(publicou, semVideo, parados, alunos.length) +

      '<div class="card card--pad" style="margin-top:14px">' +
        '<div class="eyebrow">Atalhos</div>' +
        '<div class="item__actions" style="margin-top:10px">' +
          '<button type="button" class="btn btn--primary btn--sm" data-aba="conteudo">' +
            'Editar trilhas e aulas</button>' +
          '<button type="button" class="btn btn--quiet btn--sm" data-aba="convites">' +
            'Criar um convite</button>' +
          '<a class="btn btn--quiet btn--sm" href="../" target="_blank" rel="noopener">' +
            'Ver como o cliente vê</a>' +
        '</div>' +
      '</div>';

    /* Os atalhos são botões de aba como os do menu, então o
       ouvinte do `painel.js` já os atende — menos estes, que
       nascem depois dele. Ligar aqui é mais barato que observar a
       árvore inteira à espera deles. */
    UI.$$("[data-aba]", caixa).forEach(function (b) {
      b.addEventListener("click", function () { global.Painel.abrir(b.getAttribute("data-aba")); });
    });
  }

  function numero(valor, rotulo) {
    return '<div class="numero">' +
      '<div class="numero__n">' + U.esc(String(valor)) + '</div>' +
      '<div class="numero__rot">' + U.esc(rotulo) + '</div>' +
    '</div>';
  }

  function avisos(publicou, semVideo, parados, totalAlunos) {
    var itens = [];

    if (!publicou) {
      itens.push(aviso("warn", "ic-alert", "Nenhuma trilha publicada ainda",
        "O cliente está vendo o catálogo de exemplo que vem com o sistema — títulos reais, " +
        "mas sem vídeo. Abra Trilhas e aulas, ajuste o que for preciso e publique."));
    }

    if (semVideo) {
      itens.push(aviso("warn", "ic-play",
        semVideo + " " + U.plural(semVideo, "aula sem vídeo", "aulas sem vídeo"),
        U.plural(semVideo, "Ela aparece", "Elas aparecem") + " como “em breve” para o " +
        "cliente. Se a gravação ainda vem, está certo assim."));
    }

    if (totalAlunos && parados.length) {
      var nomes = parados.slice(0, 3).map(function (a) { return a.nome || a.email; }).join(", ");
      itens.push(aviso("info", "ic-users",
        parados.length + " " + U.plural(parados.length, "aluno parado", "alunos parados"),
        "Sem abrir a Academy há mais de duas semanas: " + nomes +
        (parados.length > 3 ? " e mais " + (parados.length - 3) : "") + "."));
    }

    if (!itens.length) {
      itens.push(aviso("ok", "ic-check-circle", "Nada pendente",
        "O conteúdo está publicado, todas as aulas têm vídeo e os alunos estão entrando."));
    }

    return itens.join("");
  }

  function aviso(tipo, icone, titulo, texto) {
    return '<div class="notice notice--' + tipo + '" style="margin-top:12px;align-items:flex-start">' +
      '<span class="notice__icon">' + ic(icone) + '</span>' +
      '<span><strong>' + U.esc(titulo) + '.</strong> ' + U.esc(texto) + '</span>' +
    '</div>';
  }

  global.Painel.aoTrocarDeAba(function (aba) {
    if (aba !== "inicio") return;
    carregado = false;    /* a primeira tela sempre chega fresca */
    carregar();
  });
})(window);
