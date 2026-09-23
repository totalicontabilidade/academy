/* ============================================================
   Totali · Academy
   painel-convites.js — os links que dão acesso

   COMO ALGUÉM ENTRA NA ACADEMY. Não há cadastro aberto: quem
   chega precisa de um link com um código, e o código é criado
   aqui. É o que impede que o endereço do sistema, que é público,
   vire porta de entrada para qualquer um.

   POR QUE CÓDIGO E NÃO LISTA DE E-MAILS
   -------------------------------------
   Uma lista de e-mails autorizados obrigaria a equipe a saber de
   antemão o endereço de cada pessoa da empresa do cliente — e o
   cliente costuma repassar o link para um sócio, para o
   financeiro, para quem contrata. O código atende a todos eles
   sem pedir nada à equipe, e continua sendo uma porta que se
   fecha: desligar o convite corta a entrada de quem ainda não
   entrou, sem tirar o acesso de quem já entrou.

   O código tem 22 caracteres sorteados, cerca de 110 bits. Não se
   adivinha por tentativa, e a regra do Firestore deixa lê-lo
   apenas por quem JÁ SABE o código — a coleção inteira não se
   lista sem crachá de equipe.
   ============================================================ */
(function (global) {
  "use strict";

  var UI = global.UI, U = global.U, A = global.Admin;
  var $ = UI.$;
  var ic = UI.icone;

  var convites = [];
  var carregado = false;

  /* O link leva à ACADEMY, não a esta página.

     Montá-lo a partir de `location.href` estava errado de duas
     maneiras ao mesmo tempo: carregava o `#/convites` da aba
     aberta e apontava para o próprio painel — um link que abriria
     a tela de login da administração para o cliente.

     E o painel mora em `/academy/admin/` desde 23/09/2026, então
     a pasta dele TAMBÉM não serve: é preciso subir um nível. Fazer
     isso a partir do caminho, e não de um endereço fixo, é o que
     mantém o link certo quando o sistema é servido de outra pasta
     — o que acontece toda vez que se testa em localhost. */
  function enderecoDoConvite(codigo) {
    var pasta = location.pathname.replace(/[^/]*$/, "");   /* .../academy/admin/ */
    var raiz = pasta.replace(/[^/]+\/$/, "");              /* .../academy/      */
    return location.origin + raiz + "?k=" + codigo;
  }

  function carregar() {
    if (carregado) return Promise.resolve();
    var caixa = $("#cvLista");
    if (caixa) caixa.innerHTML = '<div class="card card--pad text-muted">Carregando…</div>';

    return A.convites().then(function (lista) {
      convites = lista.sort(function (a, b) { return (b.criadoEm || 0) - (a.criadoEm || 0); });
      carregado = true;
      desenhar();
    }, function (e) {
      if (caixa) {
        caixa.innerHTML = '<div class="notice notice--warn"><span class="notice__icon">' +
          ic("ic-alert") + '</span><span>' + U.esc(A.explicar(e)) + '</span></div>';
      }
    });
  }

  function desenhar() {
    var caixa = $("#cvLista");
    if (!caixa) return;

    if (!convites.length) {
      caixa.innerHTML = '<div class="card card--pad empty">' +
        '<span class="empty__icon">' + ic("ic-link") + '</span>' +
        '<div class="empty__title">Nenhum convite criado</div>' +
        '<div class="empty__desc">Crie um convite, copie o link e mande para o cliente. ' +
        'Um convite serve para quantas pessoas você quiser.</div>' +
        '</div>';
      return;
    }

    caixa.innerHTML = convites.map(conviteHTML).join("");
  }

  function conviteHTML(c) {
    return '<div class="card card--pad" style="margin-bottom:10px">' +
      '<div class="item__top" style="align-items:center;gap:12px">' +
        '<span class="group__icon">' + ic("ic-link") + '</span>' +
        '<div class="item__main">' +
          '<div class="item__name">' + U.esc(c.rotulo || "Convite sem nome") + '</div>' +
          '<div class="item__row">' +
            '<span class="badge ' + (c.ativo ? "badge--aprovado" : "badge--na") + '">' +
              '<span class="dot"></span>' + (c.ativo ? "Ativo" : "Desligado") + '</span>' +
            (c.criadoEm
              ? '<span class="text-xs text-muted"> · criado em ' + U.esc(U.dataCurta(c.criadoEm)) + '</span>'
              : "") +
          '</div>' +
          '<div class="text-xs text-muted" style="margin-top:6px;word-break:break-all">' +
            U.esc(enderecoDoConvite(c.codigo)) +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="item__actions" style="margin-top:12px">' +
        '<button type="button" class="btn btn--quiet btn--sm" data-copiar="' + U.escAttr(c.codigo) + '">' +
          'Copiar o link</button>' +
        '<button type="button" class="btn btn--quiet btn--sm" data-alternar="' + U.escAttr(c.codigo) + '">' +
          (c.ativo ? "Desligar" : "Ligar de novo") + '</button>' +
        '<button type="button" class="btn btn--quiet btn--sm" data-renomear="' + U.escAttr(c.codigo) + '">' +
          'Renomear</button>' +
        '<button type="button" class="btn btn--quiet btn--sm" data-apagar="' + U.escAttr(c.codigo) + '">' +
          'Apagar</button>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------
     Criar
     ------------------------------------------------------------ */
  function criar() {
    var m = UI.modal({
      titulo: "Novo convite",
      corpoHTML:
        '<div class="field">' +
          '<label class="field__label" for="cvNome">Para quem é</label>' +
          '<input class="input" type="text" id="cvNome" maxlength="120" ' +
            'placeholder="Clientes novos de setembro">' +
          '<span class="field__hint">Só para você reconhecer o convite nesta lista. ' +
            'O cliente não vê este nome.</span>' +
        '</div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        { rotulo: "Criar convite", classe: "btn--primary", fecharAntes: false,
          onClick: function () { gravarNovo(m); } }
      ]
    });
    setTimeout(function () { var c = $("#cvNome", m.caixa); if (c) c.focus(); }, 60);
  }

  function gravarNovo(m) {
    var nome = ($("#cvNome", m.caixa).value || "").trim();
    var codigo = A.novoCodigo();

    A.salvarConvite(codigo, { rotulo: nome, ativo: true }).then(function () {
      UI.fecharModal();
      carregado = false;
      carregar().then(function () { copiar(codigo, true); });
    }, function (e) { UI.toast(A.explicar(e), "erro", 9000); });
  }

  /* ------------------------------------------------------------
     Copiar

     A área de transferência pode ser recusada pelo navegador — em
     aba sem foco, ou sem HTTPS. Quando isso acontece, o link vai
     para a tela num campo selecionado, em vez de sumir num erro
     que não explica nada.
     ------------------------------------------------------------ */
  function copiar(codigo, recemCriado) {
    var endereco = enderecoDoConvite(codigo);
    var aviso = recemCriado
      ? "Convite criado e link copiado. Mande para o cliente."
      : "Link copiado.";

    var tentativa = (global.navigator.clipboard && global.navigator.clipboard.writeText)
      ? global.navigator.clipboard.writeText(endereco)
      : Promise.reject(new Error("sem-area"));

    tentativa.then(function () {
      UI.toast(aviso, "ok", 6000);
    }, function () {
      UI.modal({
        titulo: recemCriado ? "Convite criado" : "Link do convite",
        corpoHTML: '<p class="text-sm text-muted" style="margin-bottom:10px">' +
          'O navegador não deixou copiar sozinho. Selecione e copie:</p>' +
          '<input class="input" id="cvLink" readonly value="' + U.escAttr(endereco) + '">',
        acoes: [{ rotulo: "Fechar", classe: "btn--ghost" }]
      });
      setTimeout(function () {
        var c = $("#cvLink");
        if (c) { c.focus(); c.select(); }
      }, 60);
    });
  }

  /* ------------------------------------------------------------
     Ligar, desligar, renomear, apagar
     ------------------------------------------------------------ */
  function alternar(codigo) {
    var c = convites.filter(function (x) { return x.codigo === codigo; })[0];
    if (!c) return;

    var seguir = c.ativo
      ? UI.confirmar({
          titulo: "Desligar o convite",
          mensagem: "Quem ainda não entrou por este link deixa de conseguir. Quem já entrou " +
                    "continua com acesso normal — para tirar o acesso de alguém, é na aba Alunos.",
          confirmar: "Desligar"
        })
      : Promise.resolve(true);

    seguir.then(function (sim) {
      if (!sim) return;
      A.salvarConvite(codigo, { rotulo: c.rotulo, ativo: !c.ativo, criadoEm: c.criadoEm })
        .then(function () {
          c.ativo = !c.ativo;
          desenhar();
          UI.toast(c.ativo ? "Convite ligado." : "Convite desligado.", "ok");
        }, function (e) { UI.toast(A.explicar(e), "erro", 9000); });
    });
  }

  function renomear(codigo) {
    var c = convites.filter(function (x) { return x.codigo === codigo; })[0];
    if (!c) return;

    var m = UI.modal({
      titulo: "Renomear o convite",
      corpoHTML:
        '<div class="field">' +
          '<label class="field__label" for="cvNovoNome">Para quem é</label>' +
          '<input class="input" type="text" id="cvNovoNome" maxlength="120" value="' +
            U.escAttr(c.rotulo) + '">' +
        '</div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        { rotulo: "Salvar", classe: "btn--primary", fecharAntes: false, onClick: function () {
            var novo = ($("#cvNovoNome", m.caixa).value || "").trim();
            A.salvarConvite(codigo, { rotulo: novo, ativo: c.ativo, criadoEm: c.criadoEm })
              .then(function () {
                c.rotulo = novo;
                UI.fecharModal();
                desenhar();
                UI.toast("Nome alterado.", "ok");
              }, function (e) { UI.toast(A.explicar(e), "erro", 9000); });
          } }
      ]
    });
    setTimeout(function () { var i = $("#cvNovoNome", m.caixa); if (i) { i.focus(); i.select(); } }, 60);
  }

  function apagar(codigo) {
    var c = convites.filter(function (x) { return x.codigo === codigo; })[0];
    if (!c) return;

    UI.confirmar({
      titulo: "Apagar o convite",
      mensagem: "O link para de funcionar de vez e não volta — um convite novo terá outro código. " +
                "Se a ideia é só fechar a entrada por enquanto, desligue em vez de apagar. " +
                "Quem já entrou continua com acesso.",
      confirmar: "Apagar",
      perigo: true
    }).then(function (sim) {
      if (!sim) return;
      A.apagarConvite(codigo).then(function () {
        convites = convites.filter(function (x) { return x.codigo !== codigo; });
        desenhar();
        UI.toast("Convite apagado.", "ok");
      }, function (e) { UI.toast(A.explicar(e), "erro", 9000); });
    });
  }

  /* ------------------------------------------------------------
     Eventos
     ------------------------------------------------------------ */
  var ligado = false;

  function ligar() {
    if (ligado) return;
    ligado = true;

    var area = $('[data-painel="convites"]');
    if (!area) return;

    area.addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;
      var cod;
      if ((cod = b.getAttribute("data-copiar"))) { copiar(cod); return; }
      if ((cod = b.getAttribute("data-alternar"))) { alternar(cod); return; }
      if ((cod = b.getAttribute("data-renomear"))) { renomear(cod); return; }
      if ((cod = b.getAttribute("data-apagar"))) { apagar(cod); return; }
    });

    $("#cvNovo").addEventListener("click", criar);
  }

  global.Painel.aoTrocarDeAba(function (aba) {
    if (aba !== "convites") return;
    ligar();
    carregar();
  });
})(window);
