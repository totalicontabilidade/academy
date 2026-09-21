/* ============================================================
   Totali · Academy
   painel-cadastro.js — editar o cadastro do cliente pela ficha

   Saiu de painel-clientes.js em 17/09/2026 (ver painel-jornada.js
   para o motivo). Recebe em `iniciar(deps)` o helper de campo e as
   funções de redesenho; o painel de clientes chama `editar(c)`.

   Aqui também mora o GERENTE DE CONTAS: quem cuida deste cliente.
   Nasce sendo quem cadastrou (js/equipe.js) e troca-se aqui.
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI;
  var $ = UI.$;
  var FB = null;

  var ctx = {
    campoTexto: function () { return ""; },
    desenharFicha: function () {},
    desenharLista: function () {}
  };
  function campoTexto(id, rotulo, valor, extra) { return ctx.campoTexto(id, rotulo, valor, extra); }

  /* A equipe, para o seletor de gerente. Uma leitura por abertura
     de modal: a lista é pequena e muda raramente. */
  function carregarEquipe() {
    if (!FB || !FB.db) return Promise.resolve([]);
    return FB.db.collection("usuarios").get().then(function (snap) {
      var lista = [];
      snap.forEach(function (d) {
        var u = d.data() || {};
        lista.push({ uid: d.id, nome: String(u.nome || u.email || d.id).slice(0, 120) });
      });
      lista.sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });
      return lista;
    }, function () { return []; });
  }

  function preencherGerentes(sel, atualUid, atualNome) {
    if (!sel) return;
    carregarEquipe().then(function (lista) {
      var achou = lista.some(function (u) { return u.uid === atualUid; });
      sel.innerHTML = '<option value="">Sem gerente definido</option>' +
        (atualUid && !achou
          ? '<option value="' + U.escAttr(atualUid) + '" selected>' + U.esc(atualNome || "(fora da equipe)") + '</option>'
          : '') +
        lista.map(function (u) {
          return '<option value="' + U.escAttr(u.uid) + '"' + (u.uid === atualUid ? ' selected' : '') + '>' +
            U.esc(u.nome) + '</option>';
        }).join("");
    });
  }

  function nomeDoGerente(sel) {
    if (!sel || !sel.value) return "";
    var o = sel.options[sel.selectedIndex];
    return o ? String(o.textContent || "").slice(0, 120) : "";
  }

  var REGIMES = ["", "Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI",
                 "Não sei informar"];

  function editarCadastro(c) {
    var e = c.empresa;
    var m = UI.modal({
      titulo: "Editar cadastro",
      corpoHTML:
        campoTexto("edRazao", "Razão social", e.razaoSocial, 'data-focus') +
        campoTexto("edFantasia", "Nome fantasia", e.nomeFantasia) +
        '<div class="grid-2">' +
          campoTexto("edCnpj", "CNPJ", e.cnpj, 'inputmode="numeric" maxlength="18"') +
          '<div class="field">' +
            '<label class="field__label" for="edRegime">Regime tributário</label>' +
            '<select class="select" id="edRegime">' +
              REGIMES.map(function (r) {
                return '<option value="' + U.escAttr(r) + '"' +
                  (String(e.regime || "") === r ? " selected" : "") + '>' +
                  U.esc(r || "Selecione…") + '</option>';
              }).join("") +
            '</select></div>' +
        '</div>' +
        '<hr class="hr">' +
        /* Quem cuida deste cliente. É o que o Início usa em "Meus
           clientes" e o que a jornada marca no D0. A lista vem de
           /usuarios e chega depois de o modal abrir. */
        '<div class="field"><label class="field__label" for="edGerente">Gerente de contas</label>' +
          '<select class="select" id="edGerente" data-gerente-atual="' + U.escAttr(e.gerenteUid || "") + '">' +
            '<option value="">Carregando a equipe…</option>' +
          '</select></div>' +
        '<div class="grid-2">' +
          campoTexto("edAntNome", "Contabilidade anterior", (e.contabilidadeAnterior || {}).nome) +
          campoTexto("edAntContato", "Contato dela", (e.contabilidadeAnterior || {}).contato,
                     'placeholder="e-mail ou telefone"') +
        '</div>' +
        '<hr class="hr">' +
        campoTexto("edRespNome", "Responsável", e.responsavelNome) +
        campoTexto("edRespCargo", "Função", e.responsavelCargo) +
        '<div class="grid-2">' +
          campoTexto("edRespEmail", "E-mail", e.responsavelEmail, 'inputmode="email"') +
          campoTexto("edRespTel", "Telefone", e.responsavelTelefone, 'inputmode="tel"') +
        '</div>' +
        '<div class="field__hint" style="margin-top:4px">O cliente vê o nome fantasia no topo do ' +
          'portal dele. Razão social, CNPJ e regime são só nossos.</div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Salvar", classe: "btn--primary", fecharAntes: false,
          onClick: function () { salvarCadastro(c, m); }
        }
      ]
    });

    /* Máscara ao digitar, igual à tela de novo cliente — senão o
       mesmo CNPJ fica com pontuação num lugar e sem no outro. */
    preencherGerentes($("#edGerente", m.caixa), e.gerenteUid || "", e.gerenteNome || "");

    var campoCnpj = $("#edCnpj", m.caixa);
    if (campoCnpj) campoCnpj.addEventListener("input", function () {
      campoCnpj.value = U.mascaraCNPJ(campoCnpj.value);
    });
    var campoTel = $("#edRespTel", m.caixa);
    if (campoTel) campoTel.addEventListener("input", function () {
      campoTel.value = U.mascaraTelefone(campoTel.value);
    });
  }

  function salvarCadastro(c, m) {
    var pega = function (id) { return ($(id, m.caixa) || {}).value || ""; };
    var razao = pega("#edRazao").trim();
    if (razao.length < 3) {
      UI.toast("A razão social precisa ter pelo menos 3 letras.", "erro");
      return;
    }

    var cnpj = pega("#edCnpj").trim();
    /* CNPJ vazio passa: às vezes a empresa ainda está sendo
       aberta e o número não existe. Errado é que não pode. */
    if (cnpj && !U.validaCNPJ(cnpj)) {
      UI.toast("O CNPJ não confere. Verifique os números ou deixe em branco.", "erro", 8000);
      return;
    }

    var dados = {
      razaoSocial: razao.slice(0, 150),
      nomeFantasia: pega("#edFantasia").trim().slice(0, 120),
      cnpj: cnpj,
      regime: pega("#edRegime"),
      responsavelNome: pega("#edRespNome").trim().slice(0, 200),
      responsavelCargo: pega("#edRespCargo").trim().slice(0, 200),
      responsavelEmail: pega("#edRespEmail").trim().slice(0, 200),
      responsavelTelefone: pega("#edRespTel").trim().slice(0, 200),
      /* Quem era o contador antes. O portal mostra o nome ao
         cliente ("quem envia é a sua contabilidade anterior, X");
         o contato é só nosso, para cobrar por fora. */
      contabilidadeAnterior: {
        nome: pega("#edAntNome").trim().slice(0, 120),
        contato: pega("#edAntContato").trim().slice(0, 160)
      },
      gerenteUid: pega("#edGerente").slice(0, 60),
      gerenteNome: nomeDoGerente($("#edGerente", m.caixa)),
      atualizadoEm: Date.now()
    };

    var botao = $('[data-acao="1"]', m.caixa);
    if (botao) { botao.disabled = true; botao.textContent = "Salvando…"; }

    FB.db.collection("empresas").doc(c.id).set(dados, { merge: true }).then(function () {
      Object.keys(dados).forEach(function (k) { c.empresa[k] = dados[k]; });
      UI.fecharModal();
      ctx.desenharFicha();
      ctx.desenharLista();
      UI.toast("Cadastro atualizado.", "ok", 3000);
    }, function (err) {
      if (botao) { botao.disabled = false; botao.textContent = "Salvar"; }
      UI.toast("Não foi possível salvar: " + FB.explicar(err), "erro", 9000);
    });
  }


  global.PainelCadastro = {
    iniciar: function (deps) {
      FB = global.FB;
      Object.keys(deps || {}).forEach(function (k) { if (typeof deps[k] === "function") ctx[k] = deps[k]; });
    },
    editar: editarCadastro
  };
})(window);
