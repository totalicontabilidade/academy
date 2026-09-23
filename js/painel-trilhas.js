/* ============================================================
   Totali · Academy
   painel-trilhas.js — onde as aulas são escritas

   A ABA QUE JUSTIFICA O PAINEL. Tudo o que o cliente vê na
   Academy nasce aqui: as trilhas, a ordem delas, cada aula, o
   vídeo de cada aula e o texto que a acompanha. Nada disso mora
   no código — é o pedido dele, e é o que permite publicar uma
   aula nova numa terça à tarde sem esperar por ninguém.

   RASCUNHO E PUBLICAÇÃO SÃO COISAS DIFERENTES
   -------------------------------------------
   Enquanto se edita, nada sai daqui. O cliente só vê depois de
   "Publicar para os clientes". Essa separação existe porque uma
   trilha pela metade é pior que uma trilha ausente: quem entra e
   encontra aula sem vídeo conclui que o sistema está quebrado.

   O rascunho mora no NAVEGADOR (localStorage). Não é backup — é
   o que evita perder meia hora de digitação num toque errado no
   botão de voltar. O aviso antes de sair da página diz isso.

   O ENDEREÇO DO VÍDEO ACEITA O QUE A PESSOA TEM NA MÃO
   ----------------------------------------------------
   Ninguém decora o identificador de onze caracteres do YouTube.
   O campo aceita o endereço inteiro, em qualquer das formas que
   o YouTube distribui, e guarda só o identificador. Exigir o
   identificador puro seria transferir para quem cadastra um
   trabalho que o computador faz melhor.
   ============================================================ */
(function (global) {
  "use strict";

  var UI = global.UI, U = global.U, A = global.Admin, C = global.Catalogo;
  var $ = UI.$, $$ = UI.$$;
  var ic = UI.icone;

  var CHAVE_RASCUNHO = "academy.rascunho.trilhas";

  var trilhas = [];        /* o que está sendo editado */
  var publicado = "";      /* o que está no servidor, em texto, para comparar */
  var org = {};
  var abertas = {};        /* quais trilhas estão expandidas */
  var carregado = false;

  /* ------------------------------------------------------------
     O identificador do vídeo

     Formas aceitas, todas as que o YouTube entrega ao copiar:
     o endereço normal, o curto, o de incorporação, o de Shorts —
     e o identificador puro, para quem já o tem.
     ------------------------------------------------------------ */
  var SO_ID = /^[A-Za-z0-9_-]{11}$/;

  function idDoVideo(texto) {
    var t = String(texto || "").trim();
    if (!t) return "";
    if (SO_ID.test(t)) return t;
    var m = t.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  }

  /* ------------------------------------------------------------
     Forma de uma trilha e de uma aula vazias
     ------------------------------------------------------------ */
  function trilhaVazia() {
    return { id: "", kicker: "", titulo: "", desc: "", capa: "", aulas: [aulaVazia()] };
  }

  function aulaVazia() {
    return { titulo: "", duracao: "", youtube: "", desc: "", capa: "" };
  }

  /* Identificador estável, usado no endereço da aula
     (#/aula/{id}/{n}). Muda-lo depois de publicado quebra o link
     que o cliente guardou — por isso o campo existe na tela, com
     esse aviso escrito, em vez de ser gerado em silêncio a cada
     mudança de título. */
  function sugerirId(titulo, menos) {
    var base = U.slug ? U.slug(titulo) : String(titulo || "")
      .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    base = (base || "trilha").slice(0, 50);
    var usado = {};
    trilhas.forEach(function (t, i) { if (i !== menos) usado[t.id] = true; });
    if (!usado[base]) return base;
    var n = 2;
    while (usado[base + "-" + n]) n++;
    return base + "-" + n;
  }

  /* ------------------------------------------------------------
     Ler do servidor, e do rascunho
     ------------------------------------------------------------ */
  function normalizar(lista) {
    return (Array.isArray(lista) ? lista : []).map(function (t) {
      t = t || {};
      var aulas = Array.isArray(t.aulas) ? t.aulas : (Array.isArray(t.videos) ? t.videos : []);
      return {
        id: String(t.id || ""),
        kicker: String(t.kicker || ""),
        titulo: String(t.titulo || ""),
        desc: String(t.desc || ""),
        capa: String(t.capa || ""),
        aulas: aulas.map(function (a) {
          a = a || {};
          return {
            titulo: String(a.titulo || ""),
            duracao: String(a.duracao || ""),
            youtube: String(a.youtube || ""),
            desc: String(a.desc || ""),
            capa: String(a.capa || "")
          };
        })
      };
    });
  }

  function comoTexto(lista) { return JSON.stringify(normalizar(lista)); }

  function mudou() { return comoTexto(trilhas) !== publicado; }

  function guardarRascunho() {
    try {
      if (mudou()) localStorage.setItem(CHAVE_RASCUNHO, comoTexto(trilhas));
      else localStorage.removeItem(CHAVE_RASCUNHO);
    } catch (e) { /* aba privada, ou armazenamento cheio: segue sem rascunho */ }
  }

  function lerRascunho() {
    try {
      var bruto = localStorage.getItem(CHAVE_RASCUNHO);
      return bruto ? normalizar(JSON.parse(bruto)) : null;
    } catch (e) { return null; }
  }

  function carregar() {
    if (carregado) return Promise.resolve();
    var caixa = $("#cnLista");
    if (caixa) caixa.innerHTML = '<div class="card card--pad text-muted">Carregando…</div>';

    return A.lerCatalogo().then(function (doc) {
      org = (doc && doc.org && typeof doc.org === "object") ? doc.org : {};
      var doServidor = normalizar(doc && doc.academy);

      /* O SERVIDOR VAZIO NÃO É ERRO: é uma Academy que ainda não
         publicou nada. O catálogo de exemplo do `catalogo.js` é o
         que o cliente está vendo neste momento, então é ele que
         aparece aqui para ser editado — começar de uma tela em
         branco faria a equipe reescrever o que já está no ar. */
      if (!doServidor.length && C) {
        doServidor = normalizar(C.padrao().trilhas);
        publicado = "";                   /* nada publicado ainda: tudo é mudança */
      } else {
        publicado = comoTexto(doServidor);
      }

      var rascunho = lerRascunho();
      trilhas = rascunho || doServidor;
      carregado = true;

      if (rascunho && comoTexto(rascunho) !== publicado) {
        UI.toast("Você tinha alterações não publicadas. Elas foram recuperadas.", "ok", 8000);
      }
      desenhar();
    }, function (e) {
      if (caixa) {
        caixa.innerHTML = '<div class="notice notice--warn"><span class="notice__icon">' +
          ic("ic-alert") + '</span><span>' + U.esc(A.explicar(e)) + '</span></div>';
      }
    });
  }

  /* ------------------------------------------------------------
     A tela
     ------------------------------------------------------------ */
  function desenhar() {
    var caixa = $("#cnLista");
    if (!caixa) return;

    if (!trilhas.length) {
      caixa.innerHTML = '<div class="card card--pad empty">' +
        '<span class="empty__icon">' + ic("ic-folder") + '</span>' +
        '<div class="empty__title">Nenhuma trilha ainda</div>' +
        '<div class="empty__desc">Uma trilha é um assunto: "Notas fiscais", "Folha de pagamento". ' +
        'Dentro dela vêm as aulas, na ordem em que devem ser assistidas.</div>' +
        '</div>';
    } else {
      caixa.innerHTML = trilhas.map(trilhaHTML).join("");
    }

    desenharOrg();
    atualizarBarra();
    ligarEventos();
  }

  function trilhaHTML(t, i) {
    var aberta = !!abertas[i];
    var nAulas = t.aulas.length;
    var semVideo = t.aulas.filter(function (a) { return !a.youtube; }).length;

    return '<div class="card" style="margin-bottom:12px">' +
      '<div class="rec__cab">' +
        '<div class="ac-ordem">' +
          '<button type="button" class="ac-mini" data-subir="' + i + '" title="Subir"' +
            (i === 0 ? " disabled" : "") + '>&#9650;</button>' +
          '<button type="button" class="ac-mini" data-descer="' + i + '" title="Descer"' +
            (i === trilhas.length - 1 ? " disabled" : "") + '>&#9660;</button>' +
        '</div>' +
        '<button type="button" class="rec__t" data-abrir="' + i + '" aria-expanded="' + aberta + '">' +
          '<span class="ac-trilha__t">' + U.esc(t.titulo || "(sem título)") + '</span>' +
          '<span class="ac-trilha__d">' +
            nAulas + " " + U.plural(nAulas, "aula", "aulas") +
            (semVideo ? ' · <span class="text-warn">' + semVideo + ' sem vídeo</span>' : "") +
          '</span>' +
        '</button>' +
        '<button type="button" class="ac-mini ac-mini--x" data-remover="' + i + '" ' +
          'title="Remover trilha" aria-label="Remover trilha">&times;</button>' +
      '</div>' +

      (aberta ? '<div class="rec__corpo">' + corpoTrilhaHTML(t, i) + '</div>' : "") +
    '</div>';
  }

  function corpoTrilhaHTML(t, i) {
    return '<div class="grid-2">' +
        campo("Título da trilha", 'data-t="titulo" data-i="' + i + '"', t.titulo,
              "Emissão de notas fiscais") +
        campo("Chamada curta", 'data-t="kicker" data-i="' + i + '"', t.kicker,
              "Dia a dia", "Agrupa as trilhas em fileiras na tela do cliente. Trilhas com a mesma chamada ficam juntas.") +
      '</div>' +

      '<div class="field">' +
        '<label class="field__label">Descrição</label>' +
        '<textarea class="textarea" rows="2" data-t="desc" data-i="' + i + '" ' +
          'placeholder="Passo a passo para emitir nota sem errar no imposto.">' +
          U.esc(t.desc) + '</textarea>' +
      '</div>' +

      '<div class="grid-2">' +
        campo("Identificador", 'data-t="id" data-i="' + i + '"', t.id, "notas-fiscais",
              "Aparece no endereço da aula. Mudar depois de publicado quebra os links já guardados.") +
        capaHTML(t.capa, i, -1) +
      '</div>' +

      '<div class="ac-aulas">' +
        '<div class="section__head" style="margin-bottom:10px">' +
          '<h3 class="section__title" style="font-size:14px">Aulas</h3>' +
        '</div>' +
        (t.aulas.length
          ? t.aulas.map(function (a, n) { return aulaHTML(a, i, n, t.aulas.length); }).join("")
          : '<p class="text-sm text-muted">Nenhuma aula nesta trilha ainda.</p>') +
        '<button type="button" class="btn btn--ghost btn--sm" data-nova-aula="' + i + '">' +
          ic("ic-plus") + 'Acrescentar aula</button>' +
      '</div>';
  }

  function aulaHTML(a, i, n, total) {
    var temVideo = !!a.youtube;
    return '<div class="ac-aula">' +
      '<span class="ac-aula__n">' + (n + 1) + '</span>' +
      '<div class="ac-aula__campos">' +
        '<div class="ac-aula__linha">' +
          '<input class="input" type="text" data-a="titulo" data-i="' + i + '" data-n="' + n + '" ' +
            'value="' + U.escAttr(a.titulo) + '" placeholder="Título da aula">' +
          '<input class="input" type="text" data-a="duracao" data-i="' + i + '" data-n="' + n + '" ' +
            'value="' + U.escAttr(a.duracao) + '" placeholder="5 min" style="max-width:110px;min-width:90px">' +
        '</div>' +
        '<div class="ac-aula__linha">' +
          '<input class="input" type="text" data-a="youtube" data-i="' + i + '" data-n="' + n + '" ' +
            'value="' + U.escAttr(a.youtube) + '" ' +
            'placeholder="Cole o endereço do vídeo no YouTube">' +
        '</div>' +
        '<div class="ac-aula__linha">' +
          '<input class="input" type="text" data-a="desc" data-i="' + i + '" data-n="' + n + '" ' +
            'value="' + U.escAttr(a.desc) + '" placeholder="O que a pessoa aprende nesta aula (opcional)">' +
        '</div>' +
        '<div class="ac-aula__estado' + (temVideo ? " ok" : "") + '">' +
          (temVideo
            ? "Vídeo reconhecido: " + U.esc(a.youtube)
            : "Sem vídeo — a aula aparece como “em breve” para o cliente.") +
        '</div>' +
      '</div>' +
      '<div class="ac-ordem">' +
        '<button type="button" class="ac-mini" data-aula-subir="' + i + '.' + n + '" title="Subir"' +
          (n === 0 ? " disabled" : "") + '>&#9650;</button>' +
        '<button type="button" class="ac-mini" data-aula-descer="' + i + '.' + n + '" title="Descer"' +
          (n === total - 1 ? " disabled" : "") + '>&#9660;</button>' +
        '<button type="button" class="ac-mini ac-mini--x" data-aula-remover="' + i + '.' + n + '" ' +
          'title="Remover aula" aria-label="Remover aula">&times;</button>' +
      '</div>' +
    '</div>';
  }

  function campo(rotulo, attrs, valor, exemplo, dica) {
    return '<div class="field">' +
      '<label class="field__label">' + U.esc(rotulo) + '</label>' +
      '<input class="input" type="text" ' + attrs + ' value="' + U.escAttr(valor) + '" ' +
        'placeholder="' + U.escAttr(exemplo || "") + '">' +
      (dica ? '<span class="field__hint">' + U.esc(dica) + '</span>' : "") +
    '</div>';
  }

  /* A capa é opcional de propósito: sem ela, a miniatura do
     YouTube já serve, e em boa resolução. Obrigar a equipe a
     exportar arte para cada trilha seria inventar trabalho. */
  function capaHTML(url, i, n) {
    var alvo = i + "." + n;
    return '<div class="field">' +
      '<label class="field__label">Capa da trilha</label>' +
      (url
        ? '<div class="capa" style="border-radius:10px;max-width:220px">' +
            '<img src="' + U.escAttr(url) + '" alt="">' +
          '</div>'
        : '<span class="field__hint">Sem capa: usamos a miniatura do primeiro vídeo.</span>') +
      '<div class="capa-acoes" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn--quiet btn--sm" data-capa="' + alvo + '">' +
          (url ? "Trocar imagem" : "Enviar imagem") + '</button>' +
        (url ? '<button type="button" class="btn btn--quiet btn--sm" data-capa-tirar="' + alvo + '">Tirar</button>' : "") +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------
     O contato da Totali

     Aparece na tela de ajuda do cliente. Mora aqui porque muda —
     telefone, horário de atendimento — e mudar telefone não pode
     depender de publicar código.
     ------------------------------------------------------------ */
  function desenharOrg() {
    var caixa = $("#cnOrg");
    if (!caixa) return;
    caixa.innerHTML =
      '<div class="grid-2">' +
        campo("Telefone que aparece na ajuda", 'data-org="telefoneExibicao"', org.telefoneExibicao || "", "(79) 99841-2107") +
        campo("Telefone do WhatsApp", 'data-org="telefone"', org.telefone || "", "5579998412107",
              "Só números, com o 55 na frente. É o que abre a conversa.") +
      '</div>' +
      '<div class="grid-2">' +
        campo("E-mail de contato", 'data-org="email"', org.email || "", "contato@totalicontabilidade.com.br") +
        campo("Horário de atendimento", 'data-org="horario"', org.horario || "", "Seg a sex, 8h às 18h") +
      '</div>';
  }

  /* ------------------------------------------------------------
     A barra de publicação
     ------------------------------------------------------------ */
  function atualizarBarra() {
    var barra = $("#cnBarra");
    if (!barra) return;
    var pendente = mudou();
    barra.hidden = !pendente;

    var aulas = 0, semVideo = 0;
    trilhas.forEach(function (t) {
      aulas += t.aulas.length;
      t.aulas.forEach(function (a) { if (!a.youtube) semVideo++; });
    });

    var resumo = $("#cnResumo");
    if (resumo) {
      resumo.textContent = trilhas.length + " " + U.plural(trilhas.length, "trilha", "trilhas") + " · " +
        aulas + " " + U.plural(aulas, "aula", "aulas") +
        (semVideo ? " · " + semVideo + " sem vídeo" : "");
    }
  }

  /* ------------------------------------------------------------
     Eventos

     Tudo por delegação, num ouvinte só. A lista é redesenhada
     inteira a cada mudança estrutural, e ouvintes presos a cada
     botão vazariam a cada redesenho.
     ------------------------------------------------------------ */
  var ligado = false;

  function ligarEventos() {
    if (ligado) return;
    ligado = true;

    var area = $('[data-painel="conteudo"]');
    if (!area) return;

    area.addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;

      var i;
      if ((i = b.getAttribute("data-abrir")) !== null) {
        abertas[i] = !abertas[i];
        desenhar();
        return;
      }
      if ((i = b.getAttribute("data-subir")) !== null) { mover(Number(i), -1); return; }
      if ((i = b.getAttribute("data-descer")) !== null) { mover(Number(i), 1); return; }
      if ((i = b.getAttribute("data-remover")) !== null) { removerTrilha(Number(i)); return; }
      if ((i = b.getAttribute("data-nova-aula")) !== null) { novaAula(Number(i)); return; }

      var par;
      if ((par = b.getAttribute("data-aula-subir")) !== null) { moverAula(par, -1); return; }
      if ((par = b.getAttribute("data-aula-descer")) !== null) { moverAula(par, 1); return; }
      if ((par = b.getAttribute("data-aula-remover")) !== null) { removerAula(par); return; }
      if ((par = b.getAttribute("data-capa")) !== null) { escolherCapa(par); return; }
      if ((par = b.getAttribute("data-capa-tirar")) !== null) { tirarCapa(par); return; }
    });

    area.addEventListener("input", function (ev) {
      var el = ev.target;
      if (!el.matches("input, textarea")) return;

      var chaveOrg = el.getAttribute("data-org");
      if (chaveOrg) { org[chaveOrg] = el.value; marcar(); return; }

      var i = Number(el.getAttribute("data-i"));
      var campoT = el.getAttribute("data-t");
      var campoA = el.getAttribute("data-a");

      if (campoT && trilhas[i]) {
        trilhas[i][campoT] = el.value;
        marcar(i);
        return;
      }
      if (campoA && trilhas[i]) {
        var n = Number(el.getAttribute("data-n"));
        var aula = trilhas[i].aulas[n];
        if (!aula) return;
        aula[campoA] = el.value;
        marcar(i);
      }
    });

    /* O endereço do vídeo vira identificador quando o campo perde
       o foco, e não a cada tecla: reescrever debaixo do cursor
       enquanto a pessoa cola é o tipo de ajuda que atrapalha. */
    area.addEventListener("focusout", function (ev) {
      var el = ev.target;
      if (!el.matches('input[data-a="youtube"]')) return;
      var i = Number(el.getAttribute("data-i"));
      var n = Number(el.getAttribute("data-n"));
      var aula = trilhas[i] && trilhas[i].aulas[n];
      if (!aula) return;

      var bruto = el.value.trim();
      var id = idDoVideo(bruto);
      aula.youtube = id;
      el.value = id;

      var estado = el.closest(".ac-aula__campos").querySelector(".ac-aula__estado");
      if (estado) {
        if (id) {
          estado.className = "ac-aula__estado ok";
          estado.textContent = "Vídeo reconhecido: " + id;
        } else {
          estado.className = "ac-aula__estado";
          estado.textContent = bruto
            ? "Não reconheci um vídeo do YouTube nesse endereço."
            : "Sem vídeo — a aula aparece como “em breve” para o cliente.";
        }
      }
      marcar(i);
    });

    /* O identificador da trilha se sugere sozinho a partir do
       título, mas só enquanto estiver vazio: preenchido, ele é
       escolha de alguém e não se mexe. */
    area.addEventListener("focusout", function (ev) {
      var el = ev.target;
      if (!el.matches('input[data-t="titulo"]')) return;
      var i = Number(el.getAttribute("data-i"));
      if (!trilhas[i] || trilhas[i].id) return;
      trilhas[i].id = sugerirId(trilhas[i].titulo, i);
      var campoId = area.querySelector('input[data-t="id"][data-i="' + i + '"]');
      if (campoId) campoId.value = trilhas[i].id;
      marcar(i);
    });

    $("#cnNova").addEventListener("click", novaTrilha);
    $("#cnPublicar").addEventListener("click", publicar);
    $("#cnDescartar").addEventListener("click", descartar);

    /* Fechar a aba com alteração não publicada pede confirmação.
       O rascunho no navegador já protege o texto; o aviso protege
       de quem acha que publicou e não publicou. */
    global.addEventListener("beforeunload", function (ev) {
      if (!mudou()) return;
      ev.preventDefault();
      ev.returnValue = "";
    });
  }

  function marcar(i) {
    guardarRascunho();
    atualizarBarra();
    if (i !== undefined) atualizarCabeca(i);
  }

  /* Redesenhar a trilha inteira a cada tecla roubaria o cursor de
     quem está digitando. Mas deixar o cabeçalho dizendo "1 sem
     vídeo" depois de o vídeo ter sido posto é informação errada na
     tela. Então só o cabeçalho se atualiza, que não tem campo
     dentro e portanto não tem foco a perder. */
  function atualizarCabeca(i) {
    var t = trilhas[i];
    var botao = $('[data-abrir="' + i + '"]');
    if (!t || !botao) return;

    var semVideo = t.aulas.filter(function (a) { return !a.youtube; }).length;
    botao.querySelector(".ac-trilha__t").textContent = t.titulo || "(sem título)";
    botao.querySelector(".ac-trilha__d").innerHTML =
      t.aulas.length + " " + U.plural(t.aulas.length, "aula", "aulas") +
      (semVideo ? ' · <span class="text-warn">' + semVideo + ' sem vídeo</span>' : "");
  }

  /* ------------------------------------------------------------
     Alterações de estrutura
     ------------------------------------------------------------ */
  function mover(i, passo) {
    var j = i + passo;
    if (j < 0 || j >= trilhas.length) return;
    var t = trilhas[i];
    trilhas[i] = trilhas[j];
    trilhas[j] = t;
    var a = abertas[i]; abertas[i] = abertas[j]; abertas[j] = a;
    marcar();
    desenhar();
  }

  function novaTrilha() {
    trilhas.push(trilhaVazia());
    abertas = {};
    abertas[trilhas.length - 1] = true;
    marcar();
    desenhar();
    var campo1 = $('input[data-t="titulo"][data-i="' + (trilhas.length - 1) + '"]');
    if (campo1) campo1.focus();
  }

  function removerTrilha(i) {
    var t = trilhas[i];
    if (!t) return;
    UI.confirmar({
      titulo: "Remover a trilha",
      mensagem: "“" + (t.titulo || "sem título") + "” sai da Academy junto com " +
             t.aulas.length + " " + U.plural(t.aulas.length, "aula", "aulas") + ". Isso só vale para o cliente " +
             "depois que você publicar.",
      confirmar: "Remover",
      perigo: true
    }).then(function (sim) {
      if (!sim) return;
      trilhas.splice(i, 1);
      abertas = {};
      marcar();
      desenhar();
    });
  }

  function novaAula(i) {
    if (!trilhas[i]) return;
    trilhas[i].aulas.push(aulaVazia());
    marcar();
    desenhar();
    var n = trilhas[i].aulas.length - 1;
    var campo1 = $('input[data-a="titulo"][data-i="' + i + '"][data-n="' + n + '"]');
    if (campo1) campo1.focus();
  }

  function pares(texto) {
    var p = String(texto).split(".");
    return { i: Number(p[0]), n: Number(p[1]) };
  }

  function moverAula(par, passo) {
    var p = pares(par);
    var lista = trilhas[p.i] && trilhas[p.i].aulas;
    if (!lista) return;
    var j = p.n + passo;
    if (j < 0 || j >= lista.length) return;
    var a = lista[p.n];
    lista[p.n] = lista[j];
    lista[j] = a;
    marcar();
    desenhar();
  }

  function removerAula(par) {
    var p = pares(par);
    var lista = trilhas[p.i] && trilhas[p.i].aulas;
    if (!lista || !lista[p.n]) return;
    var nome = lista[p.n].titulo || "esta aula";

    UI.confirmar({
      titulo: "Remover a aula",
      mensagem: "“" + nome + "” sai da trilha. As aulas seguintes sobem uma posição — " +
             "quem já tinha assistido às próximas vai ver o progresso deslocado.",
      confirmar: "Remover",
      perigo: true
    }).then(function (sim) {
      if (!sim) return;
      lista.splice(p.n, 1);
      marcar();
      desenhar();
    });
  }

  /* ------------------------------------------------------------
     Capa
     ------------------------------------------------------------ */
  function escolherCapa(par) {
    var p = pares(par);
    var entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = "image/*";
    entrada.addEventListener("change", function () {
      var arquivo = entrada.files && entrada.files[0];
      if (!arquivo) return;
      UI.toast("Enviando a imagem…", "", 4000);
      A.subir(arquivo, "trilha").then(function (url) {
        if (trilhas[p.i]) trilhas[p.i].capa = url;
        marcar();
        desenhar();
        UI.toast("Capa enviada. Publique para o cliente ver.", "ok");
      }, function (e) { UI.toast(A.explicar(e), "erro", 8000); });
    });
    entrada.click();
  }

  function tirarCapa(par) {
    var p = pares(par);
    if (!trilhas[p.i]) return;
    trilhas[p.i].capa = "";
    marcar();
    desenhar();
  }

  /* ------------------------------------------------------------
     Publicar
     ------------------------------------------------------------ */
  function problemas() {
    var lista = [];
    trilhas.forEach(function (t, i) {
      var onde = "Trilha " + (i + 1) + (t.titulo ? " (" + t.titulo + ")" : "");
      if (!t.titulo.trim()) lista.push(onde + ": falta o título.");
      if (!t.id.trim()) lista.push(onde + ": falta o identificador.");
      if (!t.aulas.length) lista.push(onde + ": não tem nenhuma aula.");
      t.aulas.forEach(function (a, n) {
        if (!a.titulo.trim()) lista.push(onde + ", aula " + (n + 1) + ": falta o título.");
      });
    });

    var vistos = {};
    trilhas.forEach(function (t) {
      var id = t.id.trim();
      if (!id) return;
      if (vistos[id]) lista.push("Duas trilhas usam o identificador “" + id + "”.");
      vistos[id] = true;
    });
    return lista;
  }

  function publicar() {
    var erros = problemas();
    if (erros.length) {
      UI.modal({
        titulo: "Falta preencher",
        corpoHTML: '<p class="text-sm text-muted" style="margin-bottom:10px">' +
          'A Academy não publica pela metade: uma trilha sem título ou sem aula aparece quebrada ' +
          'para o cliente. Corrija e publique de novo.</p><ul class="help-list">' +
          erros.map(function (x) { return "<li>" + U.esc(x) + "</li>"; }).join("") + "</ul>",
        acoes: [{ rotulo: "Entendi", classe: "btn--primary" }]
      });
      return;
    }

    /* Aula sem vídeo não impede publicar: "em breve" é um estado
       legítimo, e é como se anuncia uma trilha que está sendo
       gravada. Mas ninguém publica isso sem saber. */
    var semVideo = 0;
    trilhas.forEach(function (t) {
      t.aulas.forEach(function (a) { if (!a.youtube) semVideo++; });
    });

    var seguir = semVideo
      ? UI.confirmar({
          titulo: "Publicar com aulas sem vídeo?",
          mensagem: semVideo + " " + U.plural(semVideo, "aula ficará", "aulas ficarão") + " como “em breve” " +
                 "para o cliente. É o certo se a gravação ainda está por vir.",
          confirmar: "Publicar assim"
        })
      : Promise.resolve(true);

    seguir.then(function (sim) {
      if (!sim) return;
      var botao = $("#cnPublicar");
      botao.disabled = true;
      botao.textContent = "Publicando…";

      A.salvarCatalogo({ academy: normalizar(trilhas), org: org }).then(function () {
        publicado = comoTexto(trilhas);
        try { localStorage.removeItem(CHAVE_RASCUNHO); } catch (e) {}
        botao.disabled = false;
        botao.textContent = "Publicar para os clientes";
        atualizarBarra();
        UI.toast("Publicado. Os clientes já veem o conteúdo novo.", "ok", 7000);
      }, function (e) {
        botao.disabled = false;
        botao.textContent = "Publicar para os clientes";
        UI.toast(A.explicar(e), "erro", 10000);
      });
    });
  }

  function descartar() {
    UI.confirmar({
      titulo: "Descartar as alterações",
      mensagem: "Tudo volta a ser o que está publicado agora. O que você editou desde a última " +
             "publicação se perde.",
      confirmar: "Descartar",
      perigo: true
    }).then(function (sim) {
      if (!sim) return;
      try { localStorage.removeItem(CHAVE_RASCUNHO); } catch (e) {}
      carregado = false;
      abertas = {};
      carregar();
      UI.toast("Alterações descartadas.", "ok");
    });
  }

  /* ------------------------------------------------------------
     Abertura
     ------------------------------------------------------------ */
  global.Painel.aoTrocarDeAba(function (aba) {
    if (aba === "conteudo") carregar();
  });

  global.PainelTrilhas = { recarregar: function () { carregado = false; return carregar(); } };
})(window);
