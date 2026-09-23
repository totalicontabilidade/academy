/* ============================================================
   Totali · Academy
   painel-alunos.js — quem assiste, e até onde chegou

   A PERGUNTA QUE ESTA ABA RESPONDE é "o conteúdo está sendo
   usado?". Não é curiosidade: uma trilha que ninguém termina não
   está ruim por acaso, e é olhando esta lista que se descobre
   qual aula faz as pessoas pararem.

   A LISTA VEM ORDENADA POR QUEM ESTÁ PARADO HÁ MAIS TEMPO, e não
   por nome. Ordem alfabética é bonita e não diz nada; quem sumiu
   há três semanas é o que pede uma ligação.

   O QUE NÃO SE FAZ AQUI
   ---------------------
   Não se marca aula como vista no lugar do cliente. O progresso é
   dele, a regra do Firestore só deixa ele mesmo escrever, e
   inventar progresso alheio tornaria este número inútil — que é
   justamente o contrário do que a aba serve.
   ============================================================ */
(function (global) {
  "use strict";

  var UI = global.UI, U = global.U, A = global.Admin, C = global.Catalogo;
  var $ = UI.$;
  var ic = UI.icone;

  var alunos = [];
  var trilhas = [];
  var carregado = false;
  var busca = "";

  function carregar() {
    if (carregado) return Promise.resolve();
    var caixa = $("#alLista");
    if (caixa) caixa.innerHTML = '<div class="card card--pad text-muted">Carregando…</div>';

    return Promise.all([A.alunos(), A.lerCatalogo()]).then(function (r) {
      alunos = r[0];
      trilhas = C.aplicar(r[1] || {}).trilhas;
      carregado = true;
      desenhar();
    }, function (e) {
      if (caixa) {
        caixa.innerHTML = '<div class="notice notice--warn"><span class="notice__icon">' +
          ic("ic-alert") + '</span><span>' + U.esc(A.explicar(e)) + '</span></div>';
      }
    });
  }

  /* O progresso é um mapa "trilha|n" → quando viu. A mesma chave
     que `js/nucleo.js` grava; mudar uma sem a outra faria a conta
     dar zero para todo mundo, calada. */
  function vistoDe(aluno) {
    return function (trilhaId, n) {
      var chave = String(trilhaId).replace(/[.~/[\]*]/g, "") + "|" + Number(n);
      return !!aluno.progresso[chave];
    };
  }

  function diasSem(quando) {
    if (!quando) return null;
    return Math.floor((Date.now() - quando) / 86400000);
  }

  function ordenar(lista) {
    return lista.slice().sort(function (a, b) {
      return (a.ultimoAcessoEm || 0) - (b.ultimoAcessoEm || 0);
    });
  }

  function filtrar(lista) {
    var q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(function (a) {
      return (a.nome + " " + a.email + " " + a.empresa).toLowerCase().indexOf(q) > -1;
    });
  }

  function desenhar() {
    var caixa = $("#alLista");
    if (!caixa) return;

    var lista = filtrar(ordenar(alunos));

    var resumo = $("#alResumo");
    if (resumo) {
      var ativos = alunos.filter(function (a) {
        var d = diasSem(a.ultimoAcessoEm);
        return d !== null && d <= 30;
      }).length;
      resumo.textContent = alunos.length + " " + U.plural(alunos.length, "aluno", "alunos") +
        " · " + ativos + " " + U.plural(ativos, "ativo", "ativos") + " nos últimos 30 dias";
    }

    if (!alunos.length) {
      caixa.innerHTML = '<div class="card card--pad empty">' +
        '<span class="empty__icon">' + ic("ic-users") + '</span>' +
        '<div class="empty__title">Ninguém entrou ainda</div>' +
        '<div class="empty__desc">Crie um convite na aba Convites e mande o link para o cliente. ' +
        'Quem entrar por ele aparece aqui.</div>' +
        '</div>';
      return;
    }

    if (!lista.length) {
      caixa.innerHTML = '<div class="card card--pad text-muted">Ninguém com esse nome ou e-mail.</div>';
      return;
    }

    caixa.innerHTML = lista.map(alunoHTML).join("");
  }

  function alunoHTML(a) {
    var r = C.resumoGeral(trilhas, vistoDe(a));
    var dias = diasSem(a.ultimoAcessoEm);
    var parado = dias !== null && dias >= 14;

    var quando = dias === null ? "nunca abriu"
      : dias === 0 ? "hoje"
      : dias === 1 ? "ontem"
      : "há " + dias + " dias";

    return '<div class="card card--pad" style="margin-bottom:10px">' +
      '<div class="item__top" style="align-items:center;gap:12px">' +
        '<span class="group__icon">' + ic("ic-users") + '</span>' +
        '<div class="item__main">' +
          '<div class="item__name">' + U.esc(a.nome || a.email || "sem nome") + '</div>' +
          '<div class="item__row">' +
            '<span class="text-xs text-muted">' + U.esc(a.email) + '</span>' +
            (a.empresa ? '<span class="text-xs text-muted"> · ' + U.esc(a.empresa) + '</span>' : "") +
          '</div>' +
          '<div class="item__row" style="margin-top:6px">' +
            '<span class="text-xs' + (parado ? " text-warn" : " text-muted") + '">' +
              "Último acesso " + quando + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;flex:none">' +
          '<div class="stat__num">' + r.pct + '%</div>' +
          '<div class="stat__lbl">' + r.vistas + " de " + r.total + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="pbar" style="margin-top:12px">' +
        '<div class="pbar__fill" style="width:' + r.pct + '%"></div>' +
      '</div>' +

      '<div class="item__actions" style="margin-top:12px">' +
        '<button type="button" class="btn btn--quiet btn--sm" data-detalhe="' + U.escAttr(a.uid) + '">' +
          'Ver trilha por trilha</button>' +
        '<button type="button" class="btn btn--quiet btn--sm" data-remover="' + U.escAttr(a.uid) + '">' +
          'Remover acesso</button>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------
     A ficha de um aluno
     ------------------------------------------------------------ */
  function abrirDetalhe(uid) {
    var a = alunos.filter(function (x) { return x.uid === uid; })[0];
    if (!a) return;
    var visto = vistoDe(a);

    var corpo = trilhas.map(function (t) {
      var r = C.resumoDaTrilha(t, visto);
      return '<div style="margin-bottom:14px">' +
        '<div class="item__row" style="justify-content:space-between;gap:10px">' +
          '<span class="text-sm">' + U.esc(t.titulo) + '</span>' +
          '<span class="text-xs text-muted">' + r.vistas + " de " + r.total + '</span>' +
        '</div>' +
        '<div class="pbar" style="margin-top:6px">' +
          '<div class="pbar__fill" style="width:' + r.pct + '%"></div>' +
        '</div>' +
      '</div>';
    }).join("");

    UI.modal({
      titulo: a.nome || a.email,
      corpoHTML: (trilhas.length ? corpo : '<p class="text-sm text-muted">Nenhuma trilha publicada.</p>') +
        '<p class="text-xs text-muted" style="margin-top:6px">' +
        'Entrou pelo convite ' + U.esc(a.convite || "—") + '.</p>',
      acoes: [{ rotulo: "Fechar", classe: "btn--ghost" }]
    });
  }

  /* ------------------------------------------------------------
     Remover acesso

     SOME O DOCUMENTO, NÃO A CONTA DE LOGIN. A conta continua
     existindo no Authentication — apagá-la pelo navegador só a
     própria pessoa consegue. O efeito prático é o que importa: a
     regra exige o documento, então sem ele não se lê mais nada.
     Está escrito no aviso para ninguém achar que a conta sumiu do
     Firebase e se surpreender depois.
     ------------------------------------------------------------ */
  function remover(uid) {
    var a = alunos.filter(function (x) { return x.uid === uid; })[0];
    if (!a) return;

    UI.confirmar({
      titulo: "Remover o acesso",
      mensagem: (a.nome || a.email) + " perde o acesso à Academy na hora, e o que já assistiu " +
                "é apagado. A conta de login continua existindo, mas sem alcançar nada — para " +
                "apagá-la de vez é no console do Firebase. Isso não se desfaz.",
      confirmar: "Remover",
      perigo: true
    }).then(function (sim) {
      if (!sim) return;
      A.apagarAluno(uid).then(function () {
        alunos = alunos.filter(function (x) { return x.uid !== uid; });
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

    var area = $('[data-painel="alunos"]');
    if (!area) return;

    area.addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;
      var uid;
      if ((uid = b.getAttribute("data-detalhe"))) { abrirDetalhe(uid); return; }
      if ((uid = b.getAttribute("data-remover"))) { remover(uid); return; }
    });

    var campo = $("#alBusca");
    if (campo) {
      campo.addEventListener("input", U.debounce(function () {
        busca = campo.value;
        desenhar();
      }, 160));
    }

    var atualizar = $("#alAtualizar");
    if (atualizar) {
      atualizar.addEventListener("click", function () {
        carregado = false;
        carregar();
      });
    }
  }

  global.Painel.aoTrocarDeAba(function (aba) {
    if (aba !== "alunos") return;
    ligar();
    carregar();
  });
})(window);
