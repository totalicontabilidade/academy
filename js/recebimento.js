/* ============================================================
   Totali · Portal de Onboarding
   recebimento.js — o que a contabilidade anterior mandou

   POR QUE EXISTE
   --------------
   Desde 16/09/2026 a documentação de entrada não vem mais do
   cliente: vem da CONTABILIDADE ANTERIOR dele, quase sempre por
   e-mail, num .zip com tudo dentro. O cliente só acompanha. A
   firma anterior não tem acesso ao portal, e não vai ter — é
   uma relação de uma semana, com alguém que está entregando o
   cliente para nós.

   Então quem registra é a equipe: abre o e-mail, descompacta,
   solta os arquivos aqui e diz a qual documento cada um pertence.
   O cliente abre o portal e vê o balanço como "recebido da
   contabilidade anterior" — que é o que aconteceu.

   O QUE FICA GRAVADO
   ------------------
   Cada arquivo entra no MESMO lugar em que entraria se o cliente
   tivesse mandado — o registro do documento, em /itens — com duas
   marcas a mais: `origem: "anterior"` e `recebidoPor`, o nome de
   quem registrou. É o que o portal, a ficha e o dossiê mostram.
   O registro é assinado (`porUid`) como qualquer gravação da
   equipe; a trilha de auditoria, escrita pelo servidor, anota a
   origem junto.

   O QUE NÃO FAZ
   -------------
   Não descompacta .zip nem .rar no navegador. Um .zip pode ser
   registrado inteiro num documento ("livros fiscais", por
   exemplo), mas o certo é descompactar antes e registrar arquivo
   por arquivo — é assim que a conferência e o dossiê ficam
   legíveis. .rar não é aceito pelo servidor.

   Não avisa o cliente por mensagem. Documento chegando não é
   assunto de conversa (pedido dele, 2026-09).
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI;
  var $ = UI.$;
  var ic = UI.icone;

  var LIMITE = 40;   /* arquivos por rodada — o mesmo teto por documento */

  /* Para onde um arquivo pode ir: todo documento de arquivo que
     não foi dispensado, um por sócio quando é de sócio. */
  function destinos(c) {
    var S = global.Situacao;
    var lista = [];
    (global.DATA.GRUPOS || []).forEach(function (g) {
      var alvos = g.escopo === "socio" ? (c.dados.socios || []) : [null];
      alvos.forEach(function (socio) {
        g.itens.forEach(function (item) {
          if (item.kind !== "arquivo") return;
          var socioId = socio ? socio.id : null;
          var sit = S.de(c.dados, g, item, socioId);
          if (sit === "na" || sit === "substituido") return;
          var reg = c.dados.itens[S.chaveItem(g.id, item.id, socioId)] || {};
          lista.push({
            grupo: g, item: item, socio: socio,
            chave: S.chaveItem(g.id, item.id, socioId),
            rotulo: item.nome + (socio ? " — " + (socio.nome || "sócio") : ""),
            fonte: S.fonteDe(item),
            jaTem: (reg.arquivos || []).length
          });
        });
      });
    });
    return lista;
  }

  /* Um palpite pelo nome do arquivo. A pessoa confere e troca;
     o palpite só poupa cliques no caso comum. */
  var PISTAS = [
    [/balan/i, "balancos"],
    [/\bdre\b|resultado/i, "dre"],
    [/patrim/i, "patrimonio"],
    [/contrato|altera/i, "contrato-social"],
    [/livro|apura|lalur|\becd\b|\becf\b|sped/i, "livros-fiscais"],
    [/ficha.*(func|regis)|registro.*(func|empreg)/i, "fichas-funcionarios"],
    [/folha/i, "folhas-12m"],
    [/f[ée]rias/i, "ferias"],
    [/financeira/i, "ficha-financeira"],
    [/informe|rendiment/i, "informe-rendimentos"],
    [/extrato/i, "extrato-folha"],
    [/dirf/i, "dirf"]
  ];

  function palpite(nome, lista) {
    for (var i = 0; i < PISTAS.length; i++) {
      if (!PISTAS[i][0].test(nome)) continue;
      var d = lista.filter(function (x) { return x.item.id === PISTAS[i][1] && !x.socio; })[0];
      if (d) return d.chave;
    }
    return "";
  }

  function opcoesHTML(lista, escolhida) {
    var porGrupo = [], indice = {};
    lista.forEach(function (d) {
      if (!indice[d.grupo.id]) { indice[d.grupo.id] = { grupo: d.grupo, itens: [] }; porGrupo.push(indice[d.grupo.id]); }
      indice[d.grupo.id].itens.push(d);
    });
    return '<option value="">Qual documento é este?</option>' +
      porGrupo.map(function (g) {
        return '<optgroup label="' + U.escAttr(g.grupo.titulo) + '">' +
          g.itens.map(function (d) {
            return '<option value="' + U.escAttr(d.chave) + '"' +
              (d.chave === escolhida ? ' selected' : '') + '>' +
              U.esc(d.rotulo) +
              (d.jaTem ? ' (já tem ' + d.jaTem + ')' : '') +
              (d.fonte === "cliente" ? ' · do cliente' : '') +
              '</option>';
          }).join("") +
        '</optgroup>';
      }).join("");
  }

  function linhaHTML(f, i, lista) {
    return '<div class="rc-linha" data-rc="' + i + '">' +
      '<span class="file__icon">' + ic(U.iconePorExtensao(U.extensao(f.arquivo.name))) + '</span>' +
      '<span class="rc-linha__txt">' +
        '<span class="rc-linha__n" title="' + U.escAttr(f.arquivo.name) + '">' + U.esc(f.arquivo.name) + '</span>' +
        '<span class="rc-linha__t">' + U.esc(U.bytes(f.arquivo.size)) +
          (f.erro ? ' · <span style="color:var(--danger)">' + U.esc(f.erro) + '</span>' : '') + '</span>' +
      '</span>' +
      (f.erro
        ? ''
        : '<select class="select rc-linha__sel" data-rc-dest="' + i + '" aria-label="Documento de ' +
            U.escAttr(f.arquivo.name) + '">' + opcoesHTML(lista, f.chave) + '</select>') +
      '<button type="button" class="arq-x" data-rc-tira="' + i + '" title="Tirar da lista" ' +
        'aria-label="Tirar ' + U.escAttr(f.arquivo.name) + ' da lista">' + ic("ic-x") + '</button>' +
    '</div>';
  }

  /* ------------------------------------------------------------
     Abre a tela.

     opcoes = {
       cliente     o cliente da ficha (id, empresa, dados)
       equipe      quem está logado (uid, nome, email)
       chave       documento pré-escolhido, ou ""
       aoGravar()  chamado depois de gravar; recarrega a ficha
     }
     ------------------------------------------------------------ */
  function abrir(opcoes) {
    var o = opcoes || {};
    var c = o.cliente;
    if (!c || !global.FB || !global.FB.ligado) return;
    var FB = global.FB;
    var lista = destinos(c);
    var fila = [];           /* [{arquivo, chave, erro}] */
    var gravando = false;
    var nomeAnterior = (c.empresa.contabilidadeAnterior || {}).nome || "";

    var m = UI.modal({
      titulo: "Receber da contabilidade anterior",
      corpoHTML:
        '<p style="font-size:13.5px;line-height:1.65;color:var(--txt-2);margin-bottom:12px">' +
          'Os arquivos que a contabilidade anterior de <strong>' +
          U.esc(c.empresa.nomeFantasia || c.empresa.razaoSocial || "este cliente") +
          '</strong> mandou por e-mail. Descompacte o .zip, solte os arquivos aqui e diga a qual ' +
          'documento cada um pertence. O cliente passa a ver cada um como recebido.</p>' +
        '<div class="field">' +
          '<label class="field__label" for="rcNome">Contabilidade anterior</label>' +
          '<input type="text" class="input" id="rcNome" maxlength="120" placeholder="Nome do escritório" ' +
            'value="' + U.escAttr(nomeAnterior) + '">' +
          '<div class="field__hint">Fica no cadastro do cliente, e o portal diz a ele de quem se espera cada documento.</div>' +
        '</div>' +
        '<div class="rc-zona" id="rcZona" role="button" tabindex="0">' +
          ic("ic-upload") +
          '<span class="rc-zona__t">Solte os arquivos aqui ou clique para escolher</span>' +
          '<span class="rc-zona__d">PDF, imagem, planilha, documento do Office, XML ou .zip · até ' +
            U.esc(U.bytes(U.MAX_ARQUIVO)) + ' cada</span>' +
        '</div>' +
        '<div class="rc-lista" id="rcLista"></div>',
      acoes: [
        { rotulo: "Cancelar", classe: "btn--ghost" },
        {
          rotulo: "Registrar", classe: "btn--primary", fecharAntes: false,
          onClick: function () { gravar(); }
        }
      ]
    });

    var entrada = document.createElement("input");
    entrada.type = "file";
    entrada.multiple = true;
    entrada.accept = U.ACCEPT_ATTR;
    entrada.style.display = "none";
    m.caixa.appendChild(entrada);
    entrada.addEventListener("change", function () {
      receber(entrada.files);
      entrada.value = "";
    });

    var zona = $("#rcZona", m.caixa);
    zona.addEventListener("click", function () { if (!gravando) entrada.click(); });
    zona.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); if (!gravando) entrada.click(); }
    });
    ["dragenter", "dragover"].forEach(function (t) {
      zona.addEventListener(t, function (ev) { ev.preventDefault(); zona.classList.add("rc-zona--over"); });
    });
    ["dragleave", "drop"].forEach(function (t) {
      zona.addEventListener(t, function (ev) { ev.preventDefault(); zona.classList.remove("rc-zona--over"); });
    });
    zona.addEventListener("drop", function (ev) {
      if (!gravando) receber(ev.dataTransfer && ev.dataTransfer.files);
    });

    function receber(arquivos) {
      if (!arquivos || !arquivos.length) return;
      var restam = LIMITE - fila.length;
      if (restam <= 0) { UI.toast(LIMITE + " arquivos por rodada é o limite.", "erro"); return; }
      Array.prototype.slice.call(arquivos, 0, restam).forEach(function (f) {
        var erro = U.validaArquivo(f, 0);
        if (!erro && /\.rar$/i.test(f.name)) erro = "Descompacte o .rar antes: o servidor não aceita esse formato.";
        fila.push({
          arquivo: f,
          chave: erro ? "" : (o.chave || palpite(f.name, lista)),
          erro: erro
        });
      });
      desenhar();
    }

    function desenhar() {
      var caixa = $("#rcLista", m.caixa);
      if (!caixa) return;
      caixa.innerHTML = fila.map(function (f, i) { return linhaHTML(f, i, lista); }).join("");
      var botao = $('[data-acao="1"]', m.caixa);
      var prontos = fila.filter(function (f) { return !f.erro; }).length;
      if (botao && !gravando) {
        botao.disabled = !prontos;
        botao.textContent = prontos
          ? "Registrar " + prontos + " " + U.plural(prontos, "arquivo", "arquivos")
          : "Registrar";
      }
    }
    desenhar();

    m.caixa.addEventListener("change", function (ev) {
      var sel = ev.target.closest("[data-rc-dest]");
      if (!sel) return;
      var f = fila[Number(sel.getAttribute("data-rc-dest"))];
      if (f) f.chave = sel.value;
    });
    m.caixa.addEventListener("click", function (ev) {
      var tira = ev.target.closest("[data-rc-tira]");
      if (!tira || gravando) return;
      fila.splice(Number(tira.getAttribute("data-rc-tira")), 1);
      desenhar();
    });

    function gravar() {
      if (gravando) return;
      var validos = fila.filter(function (f) { return !f.erro; });
      if (!validos.length) return;
      var semDestino = validos.filter(function (f) { return !f.chave; });
      if (semDestino.length) {
        UI.toast("Diga a qual documento pertence cada arquivo. " + semDestino.length + " " +
                 U.plural(semDestino.length, "está sem documento.", "estão sem documento."), "erro", 7000);
        var primeiro = m.caixa.querySelector('[data-rc-dest][value=""], .rc-linha__sel');
        if (primeiro) primeiro.focus();
        return;
      }

      gravando = true;
      var botao = $('[data-acao="1"]', m.caixa);
      var quem = (o.equipe && (o.equipe.nome || o.equipe.email)) || "equipe";
      var enviados = [];      /* [{f, meta}] */

      /* 1. Storage, um por vez: a barreira de verdade é a regra do
         Storage, e o tipo é deduzido pela extensão porque celular e
         Outlook mandam arquivo sem contentType. */
      var passo = Promise.resolve();
      validos.forEach(function (f, i) {
        passo = passo.then(function () {
          if (botao) { botao.disabled = true; botao.textContent = "Enviando " + (i + 1) + " de " + validos.length + "…"; }
          var id = U.uid();
          var tipo = U.mimeDoArquivo(f.arquivo);
          return FB.storage.ref("empresas/" + c.id + "/documentos/" + id + "/arquivo")
            .put(f.arquivo, { contentType: tipo })
            .then(function () {
              enviados.push({ f: f, meta: {
                id: id,
                nome: (U.nomeSeguro ? U.nomeSeguro(f.arquivo.name) : String(f.arquivo.name)).slice(0, 160),
                tamanho: f.arquivo.size || 0,
                tipo: tipo,
                em: Date.now(),
                origem: "anterior",
                recebidoPor: String(quem).slice(0, 120)
              } });
            }, function (e) {
              f.erro = "Não subiu: " + FB.explicar(e);
            });
        });
      });

      passo.then(function () {
        if (!enviados.length) throw new Error("nenhum-arquivo");

        /* 2. Firestore, num lote só: cada documento recebe os seus
           arquivos somados aos que já tinha. `na: false` porque um
           documento que chegou não é mais "não se aplica" do
           cliente — a definição da equipe (`naEquipe`) não é tocada. */
        var porChave = {};
        enviados.forEach(function (x) {
          (porChave[x.f.chave] = porChave[x.f.chave] || []).push(x.meta);
        });
        var lote = FB.db.batch();
        var raiz = FB.db.collection("empresas").doc(c.id);
        Object.keys(porChave).forEach(function (chave) {
          var reg = c.dados.itens[chave] || {};
          var arquivos = (reg.arquivos || []).concat(porChave[chave]).slice(0, LIMITE);
          lote.set(raiz.collection("itens").doc(global.Nuvem.codificar(chave)), {
            arquivos: arquivos,
            na: false,
            atualizadoEm: Date.now(),
            porUid: (o.equipe && o.equipe.uid) || "",
            porNome: String(quem).slice(0, 120)
          }, { merge: true });
        });

        var nome = ($("#rcNome", m.caixa) || {}).value || "";
        nome = String(nome).trim().slice(0, 120);
        if (nome !== nomeAnterior) {
          lote.set(raiz, {
            contabilidadeAnterior: { nome: nome },
            atualizadoEm: Date.now()
          }, { merge: true });
        }

        return lote.commit().then(function () {
          if (nome !== nomeAnterior) {
            c.empresa.contabilidadeAnterior = c.empresa.contabilidadeAnterior || {};
            c.empresa.contabilidadeAnterior.nome = nome;
          }
          return enviados.length;
        }, function (e) {
          /* A gravação falhou depois de os arquivos subirem: tira
             do bucket o que ficaria órfão. Melhor esforço. */
          enviados.forEach(function (x) {
            FB.storage.ref("empresas/" + c.id + "/documentos/" + x.meta.id + "/arquivo")
              .delete().catch(function () {});
          });
          throw e;
        });
      }).then(function (n) {
        UI.fecharModal();
        var falhas = validos.length - n;
        UI.toast(n + " " + U.plural(n, "arquivo registrado", "arquivos registrados") +
          " como recebidos da contabilidade anterior." +
          (falhas ? " " + falhas + " " + U.plural(falhas, "não subiu.", "não subiram.") : ""),
          falhas ? "erro" : "ok", 8000);
        if (typeof o.aoGravar === "function") o.aoGravar();
      }, function (e) {
        gravando = false;
        desenhar();
        if (e && e.message === "nenhum-arquivo") {
          UI.toast("Nenhum arquivo subiu. Veja o motivo em cada linha.", "erro", 8000);
        } else {
          UI.toast("Não foi possível registrar: " + FB.explicar(e), "erro", 9000);
        }
      });
    }
  }

  global.Recebimento = { abrir: abrir, destinos: destinos };
})(window);
