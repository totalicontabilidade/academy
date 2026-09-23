/* ============================================================
   Totali · Academy
   painel-usuarios.js — quem entra neste painel

   SÓ ADMINISTRADOR VÊ E MEXE. A aba some do menu para quem não
   é, e a regra do Firestore recusa a gravação de qualquer jeito —
   esconder é conforto, a barreira é a regra.

   POR QUE O PRIMEIRO ADMINISTRADOR NASCE À MÃO
   --------------------------------------------
   Não existe regra que diga "pode se promover se a coleção
   estiver vazia" sem abrir a porta para quem chegar primeiro. Num
   projeto novo, quem chega primeiro pode ser qualquer um. Então o
   primeiro documento em /usuarios é criado no console do
   Firebase, uma vez na vida do sistema, e daí em diante o painel
   se basta.

   DESLIGOU ALGUÉM? REMOVA AQUI.
   O acesso morre na hora: a regra exige o documento, e sem ele
   não se lê nem se grava nada. A conta de login continua
   existindo no Authentication — apagá-la é no console —, mas não
   alcança mais coisa alguma.
   ============================================================ */
(function (global) {
  "use strict";

  var UI = global.UI, U = global.U, A = global.Admin;
  var $ = UI.$;
  var ic = UI.icone;

  var membros = [];
  var carregado = false;

  function carregar() {
    if (carregado) return Promise.resolve();
    var caixa = $("#usLista");
    if (caixa) caixa.innerHTML = '<div class="card card--pad text-muted">Carregando…</div>';

    return A.usuarios().then(function (lista) {
      membros = lista.sort(function (a, b) {
        return (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR");
      });
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
    var caixa = $("#usLista");
    if (!caixa) return;
    caixa.innerHTML = membros.map(membroHTML).join("");
  }

  function membroHTML(m) {
    var eu = A.eu();
    var souEu = eu && eu.uid === m.uid;
    var admin = m.papel === "admin";

    return '<div class="card card--pad" style="margin-bottom:10px">' +
      '<div class="item__top" style="align-items:center;gap:12px">' +
        '<span class="group__icon">' + ic(admin ? "ic-shield" : "ic-users") + '</span>' +
        '<div class="item__main">' +
          '<div class="item__name">' + U.esc(m.nome || m.email) +
            (souEu ? ' <span class="text-xs text-muted">(você)</span>' : "") + '</div>' +
          '<div class="item__row">' +
            '<span class="text-xs text-muted">' + U.esc(m.email) + '</span>' +
            '<span class="badge ' + (admin ? "badge--aprovado" : "badge--analise") + '">' +
              '<span class="dot"></span>' + (admin ? "Administrador" : "Equipe") + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="item__actions" style="margin-top:12px">' +
        (souEu
          /* Ninguém muda nem remove o próprio crachá. Não é
             desconfiança: é o que impede o último administrador
             se rebaixar por engano e trancar todo mundo do lado
             de fora — inclusive ele. */
          ? '<span class="text-xs text-muted">Você não altera o próprio acesso. ' +
            'Peça a outro administrador.</span>'
          : '<button type="button" class="btn btn--quiet btn--sm" data-papel="' + U.escAttr(m.uid) + '">' +
              (admin ? "Tornar equipe" : "Tornar administrador") + '</button>' +
            '<button type="button" class="btn btn--quiet btn--sm" data-remover="' + U.escAttr(m.uid) + '">' +
              'Remover acesso</button>') +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------
     Cadastrar alguém

     Cria a conta de login e o crachá, nesta ordem. A conta nasce
     numa segunda conexão com o Firebase (ver `admin.js`), senão
     criar alguém derrubaria a sessão de quem está cadastrando.
     ------------------------------------------------------------ */
  function cadastrar() {
    var m = UI.modal({
      titulo: "Dar acesso ao painel",
      corpoHTML:
        '<div class="field">' +
          '<label class="field__label" for="usNome">Nome</label>' +
          '<input class="input" type="text" id="usNome" maxlength="120" placeholder="Maria Silva">' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="usEmail">E-mail</label>' +
          '<input class="input" type="email" id="usEmail" maxlength="160" ' +
            'placeholder="maria@totalicontabilidade.com.br">' +
          '<span class="field__hint">Use e-mail nominal, nunca caixa de setor: é este nome que ' +
            'fica registrado em cada publicação.</span>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="usSenha">Senha inicial</label>' +
          '<input class="input" type="text" id="usSenha" maxlength="60" ' +
            'placeholder="pelo menos 6 caracteres">' +
          '<span class="field__hint">Combine com a pessoa e peça para ela trocar depois, ' +
            'em "Esqueci minha senha" na tela de entrada.</span>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="usPapel">Papel</label>' +
          '<select class="select" id="usPapel">' +
            '<option value="equipe">Equipe — publica aulas e vê os alunos</option>' +
            '<option value="admin">Administrador — e também gerencia quem entra aqui</option>' +
          '</select>' +
        '</div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        { rotulo: "Dar acesso", classe: "btn--primary", fecharAntes: false,
          onClick: function () { gravarNovo(m); } }
      ]
    });
    setTimeout(function () { var c = $("#usNome", m.caixa); if (c) c.focus(); }, 60);
  }

  function gravarNovo(m) {
    var nome = ($("#usNome", m.caixa).value || "").trim();
    var email = ($("#usEmail", m.caixa).value || "").trim();
    var senha = $("#usSenha", m.caixa).value || "";
    var papel = $("#usPapel", m.caixa).value === "admin" ? "admin" : "equipe";

    if (!nome) { UI.toast("Escreva o nome da pessoa.", "erro"); return; }
    if (!U.validaEmail(email)) { UI.toast("Esse e-mail não parece válido.", "erro"); return; }
    if (senha.length < 6) { UI.toast("A senha precisa de pelo menos 6 caracteres.", "erro"); return; }

    var botao = $('[data-acao="1"]', m.caixa);
    if (botao) { botao.disabled = true; botao.textContent = "Criando…"; }

    var soltar = function () {
      if (botao) { botao.disabled = false; botao.textContent = "Dar acesso"; }
    };

    A.criarConta(email, senha).then(function (uid) {
      if (membros.some(function (x) { return x.uid === uid; })) {
        soltar();
        UI.toast("Essa pessoa já tem acesso ao painel.", "erro", 7000);
        return;
      }
      return A.salvarUsuario(uid, { nome: nome, email: email, papel: papel }).then(function () {
        UI.fecharModal();
        carregado = false;
        carregar();
        UI.toast(nome + " agora entra no painel.", "ok", 7000);
      }, function (e) {
        soltar();
        /* A conta de login nasceu e o crachá não. Cadastrar de
           novo com os MESMOS dados conclui: a criação entra na
           conta que já existe, descobre o uid e grava o que
           faltou. Sem isso, a saída seria o console do Firebase —
           dependência que este sistema não deve ter. */
        UI.toast("A conta de login foi criada, mas o acesso ao painel não: " + A.explicar(e) +
                 " Cadastre de novo com o mesmo e-mail e a mesma senha — o painel conclui o que faltou.",
                 "erro", 14000);
      });
    }, function (e) {
      soltar();
      UI.toast(A.explicar(e), "erro", 10000);
    });
  }

  /* ------------------------------------------------------------
     Trocar o papel
     ------------------------------------------------------------ */
  function trocarPapel(uid) {
    var m = membros.filter(function (x) { return x.uid === uid; })[0];
    if (!m) return;
    var novo = m.papel === "admin" ? "equipe" : "admin";

    UI.confirmar({
      titulo: novo === "admin" ? "Tornar administrador" : "Tornar equipe",
      mensagem: novo === "admin"
        ? (m.nome || m.email) + " passa a poder dar e tirar acesso ao painel, inclusive o seu."
        : (m.nome || m.email) + " continua publicando aulas e vendo os alunos, mas deixa de " +
          "gerenciar quem entra no painel.",
      confirmar: "Confirmar"
    }).then(function (sim) {
      if (!sim) return;
      A.salvarUsuario(uid, { nome: m.nome, email: m.email, papel: novo }).then(function () {
        m.papel = novo;
        desenhar();
        UI.toast("Papel alterado.", "ok");
      }, function (e) { UI.toast(A.explicar(e), "erro", 9000); });
    });
  }

  function remover(uid) {
    var m = membros.filter(function (x) { return x.uid === uid; })[0];
    if (!m) return;

    /* Remover o último administrador trancaria todo mundo do lado
       de fora: ninguém poderia criar outro, e o conserto seria no
       console do Firebase. A tela recusa antes de deixar chegar
       lá. */
    var admins = membros.filter(function (x) { return x.papel === "admin"; }).length;
    if (m.papel === "admin" && admins <= 1) {
      UI.toast("Este é o único administrador. Promova outra pessoa antes de remover esta.", "erro", 10000);
      return;
    }

    UI.confirmar({
      titulo: "Remover o acesso ao painel",
      mensagem: (m.nome || m.email) + " perde o acesso na hora. A conta de login continua " +
                "existindo, mas sem alcançar nada — para apagá-la de vez é no console do Firebase.",
      confirmar: "Remover",
      perigo: true
    }).then(function (sim) {
      if (!sim) return;
      A.apagarUsuario(uid).then(function () {
        membros = membros.filter(function (x) { return x.uid !== uid; });
        desenhar();
        UI.toast("Acesso removido.", "ok");
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

    var area = $('[data-painel="usuarios"]');
    if (!area) return;

    area.addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;
      var uid;
      if ((uid = b.getAttribute("data-papel"))) { trocarPapel(uid); return; }
      if ((uid = b.getAttribute("data-remover"))) { remover(uid); return; }
    });

    $("#usNovo").addEventListener("click", cadastrar);
  }

  global.Painel.aoTrocarDeAba(function (aba) {
    if (aba !== "usuarios") return;
    ligar();
    carregar();
  });
})(window);
