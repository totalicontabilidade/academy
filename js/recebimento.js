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

   ZIP E RAR ABREM AQUI MESMO (pedido dele, 17/09/2026)
   ----------------------------------------------------
   O pacote é aberto no navegador, com a libarchive em WebAssembly
   (lib/libarchive/), e cada arquivo de dentro entra na lista como
   se tivesse sido solto sozinho. Nada do pacote sobe para o
   servidor: sobem os arquivos, um a um, cada qual no seu
   documento. Pacote com senha não abre — a tela diz isso.

   A SENHA DO CERTIFICADO
   ----------------------
   O certificado digital (.pfx) vem com senha, e a senha vem da
   contabilidade anterior também. Quando a lista reconhece um
   certificado, pede a senha na mesma linha e a guarda no cofre
   de credenciais da empresa — cifrada aqui, no painel, com a
   chave pública da Totali, exatamente como o portal faz com a
   senha que o cliente digita. Quem abre depois é a função
   abrirCredencial, com registro em /auditoria.

   Não avisa o cliente por mensagem. Documento chegando não é
   assunto de conversa (pedido dele, 2026-09).
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, UI = global.UI;
  var $ = UI.$;
  var ic = UI.icone;

  var LIMITE = 40;   /* arquivos por rodada — o mesmo teto por documento */
  var PACOTES = ["zip", "rar", "7z"];

  /* A biblioteca de pacotes só carrega quando o primeiro .zip ou
     .rar aparece: é um megabyte de WebAssembly que a maioria das
     rodadas não precisa. */
  var Archive = null;
  function biblioteca() {
    if (Archive) return Promise.resolve(Archive);
    return import("/lib/libarchive/libarchive.js").then(function (m) {
      m.Archive.init({ workerUrl: new URL("/lib/libarchive/worker-bundle.js", location.href).href });
      Archive = m.Archive;
      return Archive;
    });
  }

  function achatar(obj, caminho, saida) {
    Object.keys(obj || {}).forEach(function (nome) {
      var v = obj[nome];
      if (/^(\.|__MACOSX|Thumbs\.db$|desktop\.ini$)/i.test(nome)) return;
      if (v instanceof File) saida.push({ arquivo: v, caminho: caminho + nome });
      else if (v && typeof v === "object") achatar(v, caminho + nome + "/", saida);
    });
    return saida;
  }

  /* Abre um pacote e devolve os arquivos de dentro, já com o tipo
     deduzido pela extensão — a libarchive entrega tudo como
     octet-stream, e a validação (e a regra do Storage) olham o
     tipo. */
  function descompactar(pacote) {
    return biblioteca().then(function (A) {
      return A.open(pacote);
    }).then(function (arc) {
      return Promise.resolve(arc.hasEncryptedData()).then(function (protegido) {
        if (protegido) throw new Error("pacote-com-senha");
        return arc.extractFiles();
      });
    }).then(function (arvore) {
      return achatar(arvore, "", []).map(function (x) {
        var f = x.arquivo;
        return new File([f], f.name, { type: U.mimeDoArquivo(f), lastModified: f.lastModified || Date.now() });
      });
    });
  }

  function ehPacote(nome) { return PACOTES.indexOf(U.extensao(nome)) > -1; }
  function ehCertificado(f) {
    var ext = U.extensao(f.arquivo.name);
    return ext === "pfx" || ext === "p12" || /certificado-digital$/.test(f.chave || "");
  }

  /* Para onde um arquivo pode ir: todo documento de arquivo que
     não foi dispensado, um por sócio quando é de sócio. */
  function destinos(c) {
    var S = global.Situacao;
    var lista = [];
    (global.DATA.GRUPOS || []).forEach(function (g) {
      var alvos = g.escopo === "socio" ? (c.dados.socios || []) : [null];
      alvos.forEach(function (socio) {
        g.itens.forEach(function (item) {
          /* Documento de arquivo, ou acesso que vem da contabilidade
             anterior — o certificado digital chega como arquivo. */
          var acessoDaAnterior = item.kind === "acesso" && S.fonteDe(item) === "anterior";
          if (item.kind !== "arquivo" && !acessoDaAnterior) return;
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
    [/dirf/i, "dirf"],
    [/certific|e-?cnpj|\.pfx$|\.p12$/i, "certificado-digital"]
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
    var cert = !f.erro && ehCertificado(f);
    return '<div class="rc-linha" data-rc="' + i + '">' +
      '<span class="file__icon">' + ic(U.iconePorExtensao(U.extensao(f.arquivo.name))) + '</span>' +
      '<span class="rc-linha__txt">' +
        '<span class="rc-linha__n" title="' + U.escAttr(f.arquivo.name) + '">' + U.esc(f.arquivo.name) + '</span>' +
        '<span class="rc-linha__t">' + U.esc(U.bytes(f.arquivo.size)) +
          (f.pacote ? ' · de ' + U.esc(f.pacote) : '') +
          (f.erro ? ' · <span style="color:var(--danger)">' + U.esc(f.erro) + '</span>' : '') + '</span>' +
      '</span>' +
      (f.erro
        ? ''
        : '<select class="select rc-linha__sel" data-rc-dest="' + i + '" aria-label="Documento de ' +
            U.escAttr(f.arquivo.name) + '">' + opcoesHTML(lista, f.chave) + '</select>') +
      '<button type="button" class="arq-x" data-rc-tira="' + i + '" title="Tirar da lista" ' +
        'aria-label="Tirar ' + U.escAttr(f.arquivo.name) + ' da lista">' + ic("ic-x") + '</button>' +
      /* Certificado reconhecido: a senha vem junto, e vai para o
         cofre cifrada. Sem senha, sobe só o arquivo. */
      (cert
        ? '<div class="rc-linha__senha">' +
            '<input type="password" class="input" data-rc-senha="' + i + '" maxlength="120" ' +
              'autocomplete="new-password" placeholder="Senha do certificado (guardada no cofre)" ' +
              'value="' + U.escAttr(f.senha || "") + '">' +
            '<span class="field__hint">Cifrada aqui e aberta só pela equipe, com registro de quem abriu.</span>' +
          '</div>'
        : '') +
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
          '</strong> mandou por e-mail. Solte os arquivos, ou o .zip/.rar inteiro — o sistema abre o ' +
          'pacote aqui mesmo. Depois diga a qual documento cada um pertence. O cliente passa a ver ' +
          'cada um como recebido.</p>' +
        '<div class="field">' +
          '<label class="field__label" for="rcNome">Contabilidade anterior</label>' +
          '<input type="text" class="input" id="rcNome" maxlength="120" placeholder="Nome do escritório" ' +
            'value="' + U.escAttr(nomeAnterior) + '">' +
          '<div class="field__hint">Fica no cadastro do cliente, e o portal diz a ele de quem se espera cada documento.</div>' +
        '</div>' +
        '<div class="rc-zona" id="rcZona" role="button" tabindex="0">' +
          ic("ic-upload") +
          '<span class="rc-zona__t">Solte os arquivos ou o pacote aqui, ou clique para escolher</span>' +
          '<span class="rc-zona__d">.zip e .rar abrem sozinhos · PDF, imagem, planilha, Office, XML, ' +
            'certificado .pfx · até ' + U.esc(U.bytes(U.MAX_ARQUIVO_EQUIPE)) + ' cada</span>' +
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
    entrada.accept = U.ACCEPT_ATTR + ",.rar,.7z";
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

    function entrarNaFila(f, pacote) {
      if (fila.length >= LIMITE) return false;
      var erro = U.validaArquivo(f, 0, U.MAX_ARQUIVO_EQUIPE);
      fila.push({
        arquivo: f,
        pacote: pacote || "",
        chave: erro ? "" : (o.chave || palpite(f.name, lista)),
        erro: erro
      });
      return true;
    }

    function receber(arquivos) {
      if (!arquivos || !arquivos.length) return;
      if (fila.length >= LIMITE) { UI.toast(LIMITE + " arquivos por rodada é o limite.", "erro"); return; }
      var lista2 = Array.prototype.slice.call(arquivos);
      var passo = Promise.resolve();
      lista2.forEach(function (f) {
        if (!ehPacote(f.name)) { entrarNaFila(f, ""); return; }
        /* Pacote: abre aqui e entra arquivo por arquivo. */
        passo = passo.then(function () {
          UI.toast("Abrindo " + f.name + "…", "", 4000);
          return descompactar(f).then(function (dentro) {
            if (!dentro.length) { fila.push({ arquivo: f, chave: "", erro: "O pacote está vazio." }); return; }
            var coube = dentro.every(function (x) { return entrarNaFila(x, f.name); });
            if (!coube) UI.toast("Só os primeiros " + LIMITE + " arquivos entraram nesta rodada.", "erro", 7000);
            desenhar();
          }, function (e) {
            var motivo = (e && e.message === "pacote-com-senha")
              ? "O pacote tem senha. Abra no computador e solte os arquivos."
              : "Não consegui abrir este pacote. Abra no computador e solte os arquivos.";
            fila.push({ arquivo: f, chave: "", erro: motivo });
            desenhar();
          });
        });
      });
      passo.then(desenhar);
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
      if (sel) {
        var f = fila[Number(sel.getAttribute("data-rc-dest"))];
        if (!f) return;
        var eraCert = ehCertificado(f);
        f.chave = sel.value;
        /* Virou (ou deixou de ser) certificado: a linha ganha ou
           perde o campo de senha. */
        if (eraCert !== ehCertificado(f)) desenhar();
        return;
      }
    });
    m.caixa.addEventListener("input", function (ev) {
      var sen = ev.target.closest("[data-rc-senha]");
      if (!sen) return;
      var f = fila[Number(sen.getAttribute("data-rc-senha"))];
      if (f) f.senha = sen.value;
    });
    m.caixa.addEventListener("click", function (ev) {
      var tira = ev.target.closest("[data-rc-tira]");
      if (!tira || gravando) return;
      fila.splice(Number(tira.getAttribute("data-rc-tira")), 1);
      desenhar();
    });

    /* A senha do certificado vai para o cofre, cifrada com a chave
       pública — o mesmo envelope que o portal monta no aparelho do
       cliente. E o recibo em financeiro/geral, para a lista "Acessos
       e senhas" da ficha e para o botão Ver senha. */
    function guardarSenhas(enviados) {
      var C = global.Cripto;
      var comSenha = enviados.filter(function (x) { return x.f.senha && ehCertificado(x.f); });
      if (!comSenha.length) return Promise.resolve();
      if (!C || !C.configurada) {
        UI.toast("A senha não foi guardada: o cofre de senhas não está configurado neste painel.", "erro", 9000);
        return Promise.resolve();
      }
      var raiz = FB.db.collection("empresas").doc(c.id);
      var quem = (o.equipe && (o.equipe.nome || o.equipe.email)) || "equipe";
      var vistas = {};
      return comSenha.reduce(function (p, x) {
        return p.then(function () {
          if (vistas[x.f.chave]) return;
          vistas[x.f.chave] = true;
          var id = global.Nuvem.codificar(x.f.chave);
          return C.cifrar({ senha: String(x.f.senha).slice(0, 300) }).then(function (pacote) {
            var agora = Date.now();
            var lote = FB.db.batch();
            lote.set(raiz.collection("credenciais").doc(id), {
              pacote: pacote, campos: ["senha"], atualizadoEm: agora,
              origem: "anterior", recebidoPor: String(quem).slice(0, 120),
              porUid: (o.equipe && o.equipe.uid) || "", porNome: String(quem).slice(0, 120)
            });
            var recibo = {};
            recibo[id] = { campos: ["senha"], em: agora, origem: "anterior" };
            lote.set(raiz.collection("financeiro").doc("geral"), { credenciaisEnviadas: recibo }, { merge: true });
            return lote.commit().then(function () {
              c.recibos = c.recibos || {};
              c.recibos[x.f.chave] = recibo[id];
            });
          });
        });
      }, Promise.resolve()).catch(function (e) {
        UI.toast("O arquivo subiu, mas a senha do certificado não foi guardada: " + FB.explicar(e), "erro", 10000);
      });
    }

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
          return guardarSenhas(enviados).then(function () { return enviados.length; });
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
        UI.toast(n + " " + U.plural(n, "arquivo registrado como recebido", "arquivos registrados como recebidos") +
          " da contabilidade anterior." +
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
