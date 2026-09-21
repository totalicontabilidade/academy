/* ============================================================
   Totali · Academy
   painel-jornada.js — a jornada de 30 dias, na ficha do cliente

   Saiu de painel-clientes.js em 17/09/2026, quando aquele arquivo
   passou de 6.800 linhas. Este módulo não lê o estado de lá: recebe
   em `iniciar(deps)` quem está logado, qual cliente está aberto e
   como redesenhar, e só. O painel de clientes chama `html`, `ligar`
   e `pendente`; o Início usa `pendente` pelo painel de clientes.
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI, DATA = global.DATA;
  var $ = UI.$, ic = UI.icone;
  var FB = null;

  /* O que vem de painel-clientes.js. Sem `iniciar`, nada quebra:
     as funções devolvem vazio e não gravam. */
  var ctx = {
    equipe: function () { return null; },
    aberto: function () { return null; },
    vista: function () { return ""; },
    desenharFicha: function () {},
    atualizarContadores: function () {}
  };
  function eu() { return ctx.equipe(); }

  function emMs(v) {
    if (!v) return 0;
    if (typeof v === "number") return v;
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v.seconds === "number") return v.seconds * 1000;
    return 0;
  }

  /* ============================================================
     A JORNADA DE 30 DIAS

     O procedimento interno de onboarding, etapa por etapa, do
     aceite da proposta ao D30. É da EQUIPE: o cliente não vê, e a
     regra do servidor garante isso.

     Três coisas moram aqui:
       • a definição das etapas vem de DATA.JORNADA (o treinamento
         transcrito), não deste arquivo;
       • o ANDAMENTO desta empresa mora em
         empresas/{id}/jornada/andamento — aceite, tarefas feitas,
         etapas concluídas, anotações;
       • o relógio é o aceite da proposta. Nasce igual à data do
         cadastro, mas é editável: a proposta costuma ser aceita
         antes de alguém cadastrar a empresa aqui.
     ============================================================ */
  var DIA_MS = 86400000;

  function etapasDaJornada() {
    return (DATA.JORNADA || []).slice();
  }

  function aceiteDaJornada(c) {
    var j = (c && c.jornada) || {};
    return emMs(j.aceiteEm) || emMs((c && c.empresa || {}).criadaEm) || emMs((c && c.empresa || {}).criadoEm) || 0;
  }

  function prazoDaEtapa(c, e) {
    var base = aceiteDaJornada(c);
    return base ? base + e.dia * DIA_MS : 0;
  }

  function andamentoDaEtapa(c, e) {
    var j = (c && c.jornada) || {};
    return (j.etapas || {})[e.id] || {};
  }

  /* Dias INTEIROS entre o prazo e hoje, comparando datas e não
     instantes: uma etapa que vence hoje às 8h não está atrasada
     às 9h. */
  function diasDesde(ms) {
    if (!ms) return 0;
    var a = new Date(ms), b = new Date();
    a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / DIA_MS);
  }

  /* O QUE O SISTEMA JÁ SABE, e marca sozinho.

     Cada tarefa da jornada pode apontar um fato (`auto`) que o
     painel consegue verificar nos dados do cliente. Quando o fato
     é verdadeiro, a tarefa aparece marcada "pelo sistema" — e
     quem confere a jornada não precisa lembrar de clicar no que
     já aconteceu. O catálogo dos fatos está em DATA.AUTOMACOES_JORNADA. */
  function automacaoCumprida(c, id) {
    var S = global.Situacao;
    var e = c.empresa || {};
    switch (id) {
      case "gerente":
        return !!e.gerenteUid;
      case "convite":
        return !!((c.convites || []).length || (c.acessos || []).length);
      case "entrou":
        return (c.acessos || []).length > 0;
      case "canal":
        return !!e.canalPreferido;
      case "certificado": {
        var achou = false;
        DATA.GRUPOS.forEach(function (g) {
          g.itens.forEach(function (it) {
            if (it.id !== "certificado-digital") return;
            var sit = S.de(c.dados, g, it, null);
            if (["enviado", "analise", "aprovado"].indexOf(sit) > -1) achou = true;
          });
        });
        return achou;
      }
      case "aviso-automatico":
        return !DATA.LEMBRETES || DATA.LEMBRETES.ligado !== false;
      case "anterior":
        return Object.keys(c.dados.itens || {}).some(function (k) {
          return ((c.dados.itens[k] || {}).arquivos || []).some(function (a) { return a && a.origem === "anterior"; });
        });
      case "migracao-concluida":
        return e.etapa === "ativo";
      case "relatorios":
        return !!(c.financeiro && c.financeiro.formaRelatorio);
      case "feedback":
        return !!(c.feedback30 && c.feedback30.texto);
      default:
        return false;
    }
  }

  function textoDaTarefa(t) { return typeof t === "string" ? t : (t && t.texto) || ""; }
  function autoDaTarefa(t) { return (t && typeof t === "object" && t.auto) || ""; }

  /* Feita à mão OU pelo sistema. */
  function tarefaFeita(c, e, a, i) {
    var t = e.tarefas[i];
    if (a.tarefas && a.tarefas[i]) return true;
    var auto = autoDaTarefa(t);
    return !!(auto && automacaoCumprida(c, auto));
  }

  function estadoDaEtapa(c, e) {
    var a = andamentoDaEtapa(c, e);
    if (a.concluidaEm) return "feita";
    var prazo = prazoDaEtapa(c, e);
    if (!prazo) return "futura";
    var d = diasDesde(prazo);
    if (d > 0) return "atrasada";
    if (d === 0) return "hoje";
    return "futura";
  }

  /* O que a tela de Início cobra: etapas vencendo hoje ou já
     vencidas, ainda não concluídas.

     SÓ NOS PRIMEIROS 60 DIAS depois do aceite. Uma empresa
     cadastrada há meses, com a jornada nunca preenchida, poria
     nove avisos atrasados no Início de todo mundo, para sempre — e
     um aviso que ninguém vai atender é ruído que esconde os
     outros. Passado esse prazo, a jornada continua na ficha, só
     deixa de cobrar. */
  function jornadaPendente(c) {
    var base = aceiteDaJornada(c);
    if (!base || diasDesde(base) > 60) return [];
    var fora = [];
    etapasDaJornada().forEach(function (e) {
      var est = estadoDaEtapa(c, e);
      if (est !== "hoje" && est !== "atrasada") return;
      var prazo = prazoDaEtapa(c, e);
      fora.push({ etapa: e, prazo: prazo, atraso: diasDesde(prazo) });
    });
    return fora;
  }

  function isoDia(ms) {
    if (!ms) return "";
    var d = new Date(ms);
    var m = d.getMonth() + 1, dia = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dia < 10 ? "0" : "") + dia;
  }

  function jornadaHTML(c) {
    var etapas = etapasDaJornada();
    var feitas = etapas.filter(function (e) { return estadoDaEtapa(c, e) === "feita"; }).length;
    var base = aceiteDaJornada(c);
    var temAceiteProprio = !!emMs((c.jornada || {}).aceiteEm);

    /* A primeira etapa NÃO concluída nasce aberta, e as atrasadas
       também: é onde está o trabalho. Concluídas e futuras ficam
       recolhidas — nove cartões abertos de uma vez é uma parede
       de texto. */
    var abriuPrimeira = false;

    var html = '<div class="card card--pad" style="margin-top:12px">' +
      '<div class="eyebrow">Procedimento interno</div>' +
      '<div class="item__name" style="margin-top:6px">Jornada de 30 dias</div>' +
      '<p class="text-sm text-muted" style="margin:6px 0 12px">' +
        'Do aceite da proposta ao fechamento, o que a equipe faz e quando. ' +
        'O cliente não vê esta aba. ' +
        (feitas ? feitas + ' de ' + etapas.length + ' etapas concluídas.'
                : 'Nenhuma etapa concluída ainda.') + '</p>' +
      '<div class="jornada__cabeca">' +
        '<span class="field__label" style="margin:0">Aceite da proposta</span>' +
        '<input class="input" type="date" id="jAceite" value="' + isoDia(base) + '">' +
        '<span class="text-xs text-muted">' +
          (temAceiteProprio ? 'Os prazos contam a partir desta data.'
                            : 'Nasceu com a data do cadastro. Ajuste se a proposta foi aceita antes.') +
        '</span>' +
      '</div>' +
      '<div class="jornada__cabeca">' +
        '<span class="field__label" style="margin:0">Trilha</span>' +
        '<select class="select" id="jTrilha" style="max-width:220px">' +
          [["", "Não classificada"], ["A", "Trilha A"], ["B", "Trilha B"], ["C", "Trilha C"]].map(function (o) {
            return '<option value="' + o[0] + '"' + ((c.jornada || {}).trilha === o[0] ? ' selected' : '') + '>' +
              o[1] + '</option>';
          }).join("") +
        '</select>' +
        '<span class="text-xs text-muted">Definida no aceite. O que cada trilha significa está na etapa D0.</span>' +
      '</div>' +
    '</div>';

    html += '<div class="jornada">' + etapas.map(function (e) {
      var est = estadoDaEtapa(c, e);
      var a = andamentoDaEtapa(c, e);
      var prazo = prazoDaEtapa(c, e);
      var feitasTarefas = e.tarefas.filter(function (_, i) { return tarefaFeita(c, e, a, i); }).length;

      var aberta = false;
      if (est === "atrasada") aberta = true;
      else if ((est === "hoje" || est === "futura") && !abriuPrimeira) { aberta = true; abriuPrimeira = true; }
      if (est === "atrasada" && !abriuPrimeira) abriuPrimeira = true;

      var quando;
      if (est === "feita") {
        quando = 'Concluída em <b>' + U.esc(U.dataCurta(a.concluidaEm)) + '</b>' +
                 (a.concluidaPor ? ' por ' + U.esc(a.concluidaPor) : '');
      } else if (est === "hoje") {
        quando = 'Vence <b>hoje</b>' + (prazo ? ' · ' + U.esc(U.dataCurta(prazo)) : '');
      } else if (est === "atrasada") {
        var d = diasDesde(prazo);
        quando = '<b>Atrasada há ' + d + (d === 1 ? ' dia' : ' dias') + '</b> · vencia ' +
                 U.esc(U.dataCurta(prazo));
      } else {
        quando = prazo ? 'Vence em ' + U.esc(U.dataCurta(prazo)) : 'Sem data: informe o aceite';
      }
      if (est !== "feita" && e.tarefas.length) {
        quando += ' · ' + feitasTarefas + ' de ' + e.tarefas.length + ' tarefas';
      }

      return '<section class="card jetapa jetapa--' + est + (e.marco ? ' jetapa--marco' : '') +
          '" data-jetapa="' + U.escAttr(e.id) + '">' +
        '<span class="jetapa__marca" aria-hidden="true">D' + e.dia + '</span>' +
        '<button type="button" class="jetapa__cab" data-jtoggle="' + U.escAttr(e.id) +
            '" aria-expanded="' + (aberta ? "true" : "false") + '">' +
          '<span class="jetapa__txt">' +
            '<span class="jetapa__t">' + U.esc(e.titulo) + '</span>' +
            '<span class="jetapa__quando">' + quando + '</span>' +
          '</span>' +
          '<span class="group__chev">' + ic("ic-chevron-down") + '</span>' +
        '</button>' +
        '<div class="jetapa__corpo"' + (aberta ? '' : ' hidden') + '>' +
          '<p class="jetapa__obj">' + U.esc(e.objetivo) + '</p>' +
          '<p class="jetapa__quem">Quem conduz: <b>' + U.esc(e.quem) + '</b></p>' +
          (e.id === "d0" && DATA.JORNADA_CFG && DATA.JORNADA_CFG.trilhas
            ? '<p class="jetapa__trilhas">' + U.esc(DATA.JORNADA_CFG.trilhas) + '</p>' : '') +
          e.tarefas.map(function (t, i) {
            var auto = autoDaTarefa(t);
            var peloSistema = !!(auto && automacaoCumprida(c, auto));
            var feita = peloSistema || !!(a.tarefas && a.tarefas[i]);
            var rotuloAuto = "";
            if (auto) {
              var def = (DATA.AUTOMACOES_JORNADA || []).filter(function (x) { return x.id === auto; })[0];
              rotuloAuto = '<span class="jtarefa__auto" title="' + U.escAttr(def ? def.como : "") + '">' +
                (peloSistema ? 'marcada pelo sistema' : 'o sistema marca sozinho') + '</span>';
            }
            return '<label class="jtarefa' + (feita ? ' jtarefa--feita' : '') + '">' +
              '<input type="checkbox" data-jtarefa="' + U.escAttr(e.id) + '" data-n="' + i + '"' +
                (feita ? ' checked' : '') + (est === "feita" || peloSistema ? ' disabled' : '') + '>' +
              '<span>' + U.esc(textoDaTarefa(t)) + rotuloAuto + '</span>' +
            '</label>';
          }).join("") +
          feedbackDaEtapaHTML(c, e, est) +
          (e.erro ? '<div class="jetapa__erro"><b>Erro comum:</b> ' + U.esc(e.erro) + '</div>' : '') +
          '<textarea class="input jetapa__notas" data-jnotas="' + U.escAttr(e.id) + '" ' +
            'placeholder="Anotações desta etapa — a dor que o cliente contou, o que foi combinado, datas."' +
            (est === "feita" ? ' readonly' : '') + '>' + U.esc(a.notas || "") + '</textarea>' +
          '<div class="jetapa__acoes">' +
            (est === "feita"
              ? '<button type="button" class="btn btn--ghost btn--sm" data-jreabrir="' +
                  U.escAttr(e.id) + '">Reabrir etapa</button>'
              : '<button type="button" class="btn btn--primary btn--sm" data-jconcluir="' +
                  U.escAttr(e.id) + '">Concluir etapa</button>') +
          '</div>' +
        '</div>' +
      '</section>';
    }).join("") + '</div>';

    return html;
  }

  /* O pedido de feedback e a resposta, dentro da etapa que os
     tem como tarefa automática. O botão grava na EMPRESA (o
     cliente lê o próprio cadastro) e o cartão aparece no Início
     do portal até ele responder. */
  function feedbackDaEtapaHTML(c, e, est) {
    var pede = (e.tarefas || []).some(function (t) { return autoDaTarefa(t) === "feedback"; });
    if (!pede) return "";
    var fb = c.feedback30;
    if (fb && fb.texto) {
      return '<div class="jetapa__feedback">' +
        '<div class="jetapa__feedback-cab">O cliente respondeu' +
          (fb.em ? ' · ' + U.esc(U.dataHora(emMs(fb.em) || fb.em)) : '') +
          (fb.porNome ? ' · ' + U.esc(fb.porNome) : '') + '</div>' +
        '<div class="jetapa__feedback-txt">' + U.esc(fb.texto) + '</div>' +
      '</div>';
    }
    var pedido = emMs((c.empresa || {}).feedbackPedidoEm);
    return '<div class="jetapa__feedback">' +
      (pedido
        ? '<span class="text-sm text-muted">Pedido pelo portal em ' + U.esc(U.dataCurta(pedido)) +
          '. O cliente vê a pergunta no Início até responder.</span> '
        : '') +
      (est === "feita" ? '' :
        '<button type="button" class="btn btn--' + (pedido ? 'quiet' : 'ghost') + ' btn--sm" data-jfeedback="' +
          U.escAttr(c.id) + '">' + (pedido ? 'Pedir de novo' : 'Pedir o feedback pelo portal') + '</button>') +
    '</div>';
  }

  function pedirFeedbackPeloPortal(c) {
    var agora = Date.now();
    return FB.db.collection("empresas").doc(c.id).set({
      feedbackPedidoEm: agora,
      feedbackPedidoPor: (eu() && (eu().nome || eu().email)) || "equipe",
      atualizadoEm: agora
    }, { merge: true }).then(function () {
      c.empresa.feedbackPedidoEm = agora;
      ctx.desenharFicha();
      UI.toast("Pedido. O cliente vê a pergunta na tela inicial do portal.", "ok", 6000);
    }, function (e) {
      UI.toast("Não foi possível pedir: " + FB.explicar(e), "erro", 9000);
    });
  }

  /* Toda gravação da jornada passa por aqui: assinada, com merge,
     e espelhada na memória para a tela responder na hora. */
  function salvarJornada(c, patch, depois) {
    var dados = patch;
    dados.porUid = (eu() && eu().uid) || "";
    dados.porNome = (eu() && (eu().nome || eu().email)) || "equipe";
    dados.atualizadoEm = Date.now();
    return FB.db.collection("empresas").doc(c.id).collection("jornada").doc("andamento")
      .set(dados, { merge: true })
      .then(function () {
        if (typeof depois === "function") depois();
        ctx.desenharFicha();
        /* Etapa concluída ou aceite mudado altera o que o Início
           cobra. Mesmo aviso que as outras mudanças de estado. */
        ctx.atualizarContadores();
      }, function (e) {
        UI.toast("Não foi possível gravar a jornada: " + FB.explicar(e), "erro", 9000);
        ctx.desenharFicha();
      });
  }

  function garantirJornada(c) {
    if (!c.jornada) c.jornada = {};
    if (!c.jornada.etapas) c.jornada.etapas = {};
    return c.jornada;
  }

  function marcarTarefaDaJornada(c, etapaId, n, feita) {
    var j = garantirJornada(c);
    if (!j.etapas[etapaId]) j.etapas[etapaId] = {};
    if (!j.etapas[etapaId].tarefas) j.etapas[etapaId].tarefas = {};
    j.etapas[etapaId].tarefas[n] = !!feita;
    var patch = { etapas: {} };
    patch.etapas[etapaId] = { tarefas: {} };
    patch.etapas[etapaId].tarefas[n] = !!feita;
    return salvarJornada(c, patch);
  }

  function anotarNaJornada(c, etapaId, texto) {
    var j = garantirJornada(c);
    var t = String(texto || "").slice(0, 2000);
    if (!j.etapas[etapaId]) j.etapas[etapaId] = {};
    if ((j.etapas[etapaId].notas || "") === t) return;
    j.etapas[etapaId].notas = t;
    var patch = { etapas: {} };
    patch.etapas[etapaId] = { notas: t };
    return salvarJornada(c, patch);
  }

  function concluirEtapaDaJornada(c, etapaId) {
    var j = garantirJornada(c);
    var quem = (eu() && (eu().nome || eu().email)) || "equipe";
    var agora = Date.now();
    if (!j.etapas[etapaId]) j.etapas[etapaId] = {};
    j.etapas[etapaId].concluidaEm = agora;
    j.etapas[etapaId].concluidaPor = quem;
    var patch = { etapas: {} };
    patch.etapas[etapaId] = { concluidaEm: agora, concluidaPor: quem };
    return salvarJornada(c, patch, function () {
      var e = etapasDaJornada().filter(function (x) { return x.id === etapaId; })[0];
      UI.toast((e ? "D" + e.dia + " · " + e.titulo : "Etapa") + " concluída.", "ok", 4000);
    });
  }

  function reabrirEtapaDaJornada(c, etapaId) {
    var j = garantirJornada(c);
    if (j.etapas[etapaId]) {
      delete j.etapas[etapaId].concluidaEm;
      delete j.etapas[etapaId].concluidaPor;
    }
    /* Apagar campo aninhado pede `update` com caminho pontuado —
       `set` com merge não sabe apagar. O documento existe: a etapa
       só pode ser reaberta se foi concluída antes. */
    var mudanca = {};
    mudanca["etapas." + etapaId + ".concluidaEm"] = firebase.firestore.FieldValue.delete();
    mudanca["etapas." + etapaId + ".concluidaPor"] = firebase.firestore.FieldValue.delete();
    mudanca.porUid = (eu() && eu().uid) || "";
    mudanca.porNome = (eu() && (eu().nome || eu().email)) || "equipe";
    mudanca.atualizadoEm = Date.now();
    return FB.db.collection("empresas").doc(c.id).collection("jornada").doc("andamento")
      .update(mudanca)
      .then(function () { ctx.desenharFicha(); ctx.atualizarContadores(); },
            function (e) {
              UI.toast("Não foi possível reabrir: " + FB.explicar(e), "erro", 9000);
              ctx.desenharFicha();
            });
  }

  function definirAceiteDaJornada(c, iso) {
    var partes = String(iso || "").split("-");
    if (partes.length !== 3) return;
    var ms = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2])).getTime();
    if (!ms || isNaN(ms)) return;
    var j = garantirJornada(c);
    j.aceiteEm = ms;
    return salvarJornada(c, { aceiteEm: ms });
  }

  function ligarJornada() {
    var raiz = $("#clFicha");
    var c = ctx.aberto();
    if (!raiz || !c || ctx.vista() !== "jornada") return;

    var aceite = $("#jAceite", raiz);
    if (aceite) aceite.addEventListener("change", function () {
      definirAceiteDaJornada(c, aceite.value);
    });
    var trilha = $("#jTrilha", raiz);
    if (trilha) trilha.addEventListener("change", function () {
      var v = ["A", "B", "C"].indexOf(trilha.value) > -1 ? trilha.value : "";
      garantirJornada(c).trilha = v;
      salvarJornada(c, { trilha: v });
    });

    raiz.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-jtoggle]");
      if (t) {
        var corpo = t.closest(".jetapa").querySelector(".jetapa__corpo");
        var vai = corpo.hidden;
        corpo.hidden = !vai;
        t.setAttribute("aria-expanded", vai ? "true" : "false");
        return;
      }
      var fim = ev.target.closest("[data-jconcluir]");
      if (fim) {
        var e = etapasDaJornada().filter(function (x) { return x.id === fim.getAttribute("data-jconcluir"); })[0];
        var a = andamentoDaEtapa(c, e);
        var faltam = e ? e.tarefas.filter(function (_, i) { return !tarefaFeita(c, e, a, i); }).length : 0;
        var ir = function () { concluirEtapaDaJornada(c, fim.getAttribute("data-jconcluir")); };
        /* Concluir com tarefa em aberto é permitido — a etapa pode
           ter terminado de outro jeito —, mas não sem perceber. */
        if (faltam) {
          UI.confirmar({
            titulo: "Concluir com tarefas em aberto",
            mensagem: faltam + " " + U.plural(faltam, "tarefa desta etapa ainda não foi marcada",
                                                     "tarefas desta etapa ainda não foram marcadas") +
                      ". Concluir mesmo assim?",
            confirmar: "Concluir"
          }).then(function (ok) { if (ok) ir(); });
        } else ir();
        return;
      }
      var re = ev.target.closest("[data-jreabrir]");
      if (re) { reabrirEtapaDaJornada(c, re.getAttribute("data-jreabrir")); return; }
      var fb = ev.target.closest("[data-jfeedback]");
      if (fb) { fb.disabled = true; pedirFeedbackPeloPortal(c); return; }
    });

    raiz.addEventListener("change", function (ev) {
      var cx = ev.target.closest("[data-jtarefa]");
      if (cx) {
        marcarTarefaDaJornada(c, cx.getAttribute("data-jtarefa"), Number(cx.getAttribute("data-n")), cx.checked);
        return;
      }
      var nt = ev.target.closest("[data-jnotas]");
      if (nt) anotarNaJornada(c, nt.getAttribute("data-jnotas"), nt.value);
    });
  }


  global.PainelJornada = {
    iniciar: function (deps) {
      FB = global.FB;
      Object.keys(deps || {}).forEach(function (k) { if (typeof deps[k] === "function") ctx[k] = deps[k]; });
    },
    html: jornadaHTML,
    ligar: ligarJornada,
    pendente: jornadaPendente,
    automacaoCumprida: automacaoCumprida
  };
})(window);
