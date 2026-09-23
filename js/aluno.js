/* ============================================================
   Totali · Academy
   aluno.js — a Academy vista por quem assiste

   COMO A TELA SE ORGANIZA, E POR QUÊ

   A pergunta que a tela inicial responde não é "o que existe
   aqui", é "o que eu vejo agora". Por isso o primeiro bloco é uma
   aula só — a próxima dessa pessoa — com capa grande e um botão.
   O catálogo vem depois, em filas por assunto.

   Foi decisão de desenho, não de gosto: numa plataforma de curso,
   o que mais derruba a conclusão é a pessoa abrir, não saber onde
   parou, e fechar. Quem nunca começou vê a primeira aula da
   primeira trilha, com o mesmo desenho — assim a tela nunca abre
   pedindo uma escolha.

   O PROGRESSO É EXPLÍCITO, E ISSO É PROPOSITAL. O player não
   adivinha que a aula acabou: quem assistiu clica em "concluir e
   ir para a próxima". Detectar o fim do vídeo exigiria carregar a
   API do YouTube, ou seja, script de terceiro em toda abertura —
   e a Academy acabou de se livrar disso. Um botão claro custa um
   clique e não custa a política de segurança da página.

   ROTAS
     #/inicio              a tela de sempre
     #/trilha/{id}         uma trilha, com suas aulas
     #/aula/{id}/{n}       o player
     #/ajuda               como falar com a gente
     #/conta               nome, empresa, sair, apagar a conta
   ============================================================ */
(function (global) {
  "use strict";

  var U = global.U, N = global.Nucleo, C = global.Catalogo;

  var raiz = null;
  var estado = { rota: "inicio", aluno: null, cat: null, carregando: true, porta: "entrar" };

  /* ------------------------------------------------------------
     Ferramentas de tela

     Pequenas de propósito: a folha antiga trazia um módulo de
     interface inteiro, feito para formulário e modal de
     conferência. Aqui bastam três funções.
     ------------------------------------------------------------ */
  function $(s, onde) { return (onde || document).querySelector(s); }
  function esc(v) { return U.esc(String(v == null ? "" : v)); }
  function at(v) { return U.escAttr(String(v == null ? "" : v)); }
  function ic(nome, cls) {
    return '<svg class="ic' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#' + nome + '"></use></svg>';
  }

  var recadoTimer = null;
  function recado(texto, tipo, ms) {
    var antigo = $(".recado");
    if (antigo) antigo.remove();
    if (recadoTimer) clearTimeout(recadoTimer);
    var d = document.createElement("div");
    d.className = "recado" + (tipo ? " recado--" + tipo : "");
    d.setAttribute("role", "status");
    d.innerHTML = ic(tipo === "erro" ? "ic-alerta" : tipo === "ok" ? "ic-check" : "ic-info") +
      "<span>" + esc(texto) + "</span>";
    document.body.appendChild(d);
    recadoTimer = setTimeout(function () { d.remove(); }, ms || 5000);
  }

  function visto(trilhaId, n) { return N.aulaVista(trilhaId, n); }

  /* ------------------------------------------------------------
     Rotas
     ------------------------------------------------------------ */
  function lerRota() {
    var h = String(location.hash || "").replace(/^#\/?/, "");
    var p = h.split("/").filter(Boolean).map(decodeURIComponent);
    if (!p.length) return { nome: "inicio" };
    if (p[0] === "trilha" && p[1]) return { nome: "trilha", id: p[1] };
    if (p[0] === "aula" && p[1] && p[2] !== undefined) return { nome: "aula", id: p[1], n: Number(p[2]) };
    if (p[0] === "ajuda") return { nome: "ajuda" };
    if (p[0] === "conta") return { nome: "conta" };
    return { nome: "inicio" };
  }

  function ir(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  /* ------------------------------------------------------------
     Pedaços que se repetem
     ------------------------------------------------------------ */
  function topoHTML() {
    var a = estado.aluno;
    var iniciais = (a && a.nome ? a.nome.trim().split(/\s+/).slice(0, 2)
      .map(function (p) { return p[0]; }).join("") : "?").toUpperCase();
    return '<header class="topo">' +
      '<button type="button" class="marca" data-ir="#/inicio" aria-label="Academy · ir para o início">' +
        '<img class="marca__logo marca__logo--cheia" src="assets/academy-branca.png" ' +
          'alt="Academy · Totali" width="1989" height="618">' +
      '</button>' +
      '<div class="topo__dir">' +
        '<button type="button" class="btn-topo" data-ir="#/ajuda">' + ic("ic-ajuda") +
          '<span class="btn-topo__rot">Ajuda</span></button>' +
        '<button type="button" class="eu" data-ir="#/conta" ' +
          'aria-label="Sua conta">' + esc(iniciais) + '</button>' +
      '</div>' +
    '</header>';
  }

  function abasHTML(atual) {
    var itens = [
      { r: "inicio", i: "ic-casa", t: "Início" },
      { r: "trilhas", i: "ic-trilhas", t: "Trilhas" },
      { r: "ajuda", i: "ic-ajuda", t: "Ajuda" },
      { r: "conta", i: "ic-olho", t: "Conta" }
    ];
    return '<nav class="abas" aria-label="Seções">' + itens.map(function (x) {
      var alvo = x.r === "trilhas" ? "#/inicio" : "#/" + x.r;
      var on = (x.r === "trilhas" ? false : atual === x.r);
      return '<button type="button" class="abas__i" data-ir="' + alvo + '" ' +
        'aria-current="' + (on ? "page" : "false") + '">' + ic(x.i) + '<span>' + x.t + '</span></button>';
    }).join("") + '</nav>';
  }

  /* O círculo do play precisa de um <span> por fora para o CSS
     centrá-lo sobre a capa. Uma função em vez de montar a mão:
     tentei com `replace` sobre o ícone e ficou ilegível. */
  function playHTML() {
    return '<span class="cartao__play"><span>' + ic("ic-play") + '</span></span>';
  }

  function cartaoTrilhaHTML(t) {
    var r = C.resumoDaTrilha(t, visto);
    var capa = C.capaDaTrilha(t);
    var selo = r.completa
      ? '<span class="cartao__selo cartao__selo--ok">' + ic("ic-check") + 'Concluída</span>'
      : (r.prontas === 0 ? '<span class="cartao__selo cartao__selo--breve">Em breve</span>' : "");
    return '<button type="button" class="cartao" data-ir="#/trilha/' + at(t.id) + '">' +
      '<span class="cartao__capa">' +
        (capa ? '<img src="' + at(capa) + '" alt="" loading="lazy" decoding="async">' : "") +
        selo +
        playHTML() +
        (r.vistas ? '<span class="cartao__linha"><i style="width:' + r.pct + '%"></i></span>' : "") +
      '</span>' +
      '<span class="cartao__corpo">' +
        (t.kicker ? '<span class="cartao__chapeu">' + esc(t.kicker) + '</span>' : "") +
        '<span class="cartao__t">' + esc(t.titulo) + '</span>' +
        (t.desc ? '<span class="cartao__d">' + esc(t.desc) + '</span>' : "") +
        '<span class="cartao__pe">' +
          (r.completa
            ? "Você concluiu as " + r.total + " aulas"
            : r.vistas
              ? '<b>' + r.vistas + " de " + r.total + '</b> aulas assistidas'
              : r.total + (r.total === 1 ? " aula" : " aulas")) +
        '</span>' +
      '</span>' +
    '</button>';
  }


  /* ------------------------------------------------------------
     Tela inicial
     ------------------------------------------------------------ */
  function telaInicio() {
    var cat = estado.cat, a = estado.aluno;
    var prox = C.proximaAula(cat.trilhas, visto);
    var geral = C.resumoGeral(cat.trilhas, visto);
    var nome = U.primeiroNome ? U.primeiroNome(a.nome) : (a.nome || "").split(" ")[0];

    var html = '<div class="folha entra">';

    /* ---- o bloco de cima: uma coisa a fazer ---- */
    if (prox) {
      var capa = C.capaDaAula(prox.aula) || C.capaDaTrilha(prox.trilha);
      var min = C.minutos(prox.aula);
      html += '<section class="secao">' +
        '<div class="destaque">' +
          (capa ? '<img class="destaque__capa" src="' + at(capa) + '" alt="" decoding="async">' : "") +
          '<span class="destaque__veu"></span>' +
          '<div class="destaque__corpo">' +
            '<span class="chapeu">' + (prox.retomando ? "Continuar de onde parou" : "Comece por aqui") + '</span>' +
            '<h1 class="destaque__t">' + esc(prox.aula.titulo) + '</h1>' +
            '<div class="destaque__meta">' +
              '<span>' + esc(prox.trilha.titulo) + '</span>' +
              '<span>Aula <b>' + (prox.n + 1) + '</b> de ' + prox.trilha.aulas.length + '</span>' +
              (min ? '<span>' + ic("ic-relogio") + " " + min + ' min</span>' : "") +
            '</div>' +
            '<div class="destaque__acoes">' +
              '<button type="button" class="btn btn--ouro" data-ir="#/aula/' + at(prox.trilha.id) + '/' + prox.n + '">' +
                ic("ic-play") + (prox.retomando ? "Continuar assistindo" : "Assistir a primeira aula") + '</button>' +
              '<button type="button" class="btn btn--claro" data-ir="#/trilha/' + at(prox.trilha.id) + '">' +
                'Ver a trilha</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
    } else if (geral.prontas === 0) {
      html += '<section class="secao">' + saudacaoHTML(nome) +
        '<div class="vazio"><div class="vazio__ic">' + ic("ic-livro") + '</div>' +
        '<div class="vazio__t">As aulas estão sendo gravadas</div>' +
        '<p class="vazio__d">As trilhas já estão montadas e os vídeos entram em breve. ' +
        'Quando a primeira aula subir, ela aparece aqui.</p></div></section>';
    } else {
      html += '<section class="secao">' +
        '<div class="destaque" style="min-height:220px">' +
          '<span class="destaque__veu"></span>' +
          '<div class="destaque__corpo">' +
            '<span class="chapeu">Tudo em dia</span>' +
            '<h1 class="destaque__t">Você assistiu a tudo o que está no ar</h1>' +
            '<p class="destaque__d">Assim que uma aula nova entrar, ela aparece aqui primeiro. ' +
            'Enquanto isso, pode rever qualquer trilha abaixo.</p>' +
          '</div>' +
        '</div>' +
      '</section>';
    }

    /* ---- o placar ---- */
    if (geral.total) {
      html += '<section class="secao"><div class="placar">' +
        placa(geral.vistas, geral.vistas === 1 ? "aula assistida" : "aulas assistidas") +
        placa(geral.pct + "%", "do caminho feito") +
        placa(cat.trilhas.length, cat.trilhas.length === 1 ? "trilha" : "trilhas") +
        placa(Math.max(0, geral.prontas - geral.vistas), "aulas por assistir") +
      '</div></section>';
    }

    /* ---- as filas, por assunto ---- */
    var comecadas = cat.trilhas.filter(function (t) {
      var r = C.resumoDaTrilha(t, visto);
      return r.comecou && !r.completa;
    });
    if (comecadas.length) html += filaHTML("Continuar", "Trilhas que você começou", comecadas);

    var porAssunto = {}, ordem = [];
    cat.trilhas.forEach(function (t) {
      var k = t.kicker || "Todas as trilhas";
      if (!porAssunto[k]) { porAssunto[k] = []; ordem.push(k); }
      porAssunto[k].push(t);
    });
    ordem.forEach(function (k) { html += filaHTML(k, "", porAssunto[k]); });

    return html + '</div>' + abasHTML("inicio");
  }

  function saudacaoHTML(nome) {
    var s = U.saudacao ? U.saudacao() : "Olá";
    return '<div class="secao__cab"><div>' +
      '<span class="chapeu">' + esc(s) + (nome ? ", " + esc(nome) : "") + '</span>' +
      '<h1 class="secao__t" style="font-size:22px;margin-top:6px">Academy</h1>' +
    '</div></div>';
  }

  function placa(n, r) {
    return '<div class="placa"><div class="placa__n">' + esc(n) + '</div>' +
      '<div class="placa__l">' + esc(r) + '</div></div>';
  }

  function filaHTML(titulo, desc, trilhas) {
    return '<section class="secao">' +
      '<div class="secao__cab"><div>' +
        '<h2 class="secao__t">' + esc(titulo) + '</h2>' +
        (desc ? '<p class="secao__d">' + esc(desc) + '</p>' : "") +
      '</div></div>' +
      '<div class="fila">' + trilhas.map(cartaoTrilhaHTML).join("") + '</div>' +
    '</section>';
  }

  /* ------------------------------------------------------------
     Página da trilha
     ------------------------------------------------------------ */
  function telaTrilha(id) {
    var t = C.acharTrilha(estado.cat.trilhas, id);
    if (!t) return telaNaoAchou();
    var r = C.resumoDaTrilha(t, visto);
    var capa = C.capaDaTrilha(t);
    var prox = -1;
    for (var i = 0; i < t.aulas.length; i++) {
      if (!visto(t.id, i) && C.aulaDisponivel(t.aulas[i])) { prox = i; break; }
    }

    var circ = 2 * Math.PI * 26;
    var html = '<div class="folha entra">' +
      '<button type="button" class="volta" data-ir="#/inicio">' + ic("ic-seta-e") + 'Início</button>' +
      '<div class="cabeca">' +
        '<div class="cabeca__capa">' +
          (capa ? '<img src="' + at(capa) + '" alt="" decoding="async">' : "") +
        '</div>' +
        '<div>' +
          (t.kicker ? '<span class="chapeu">' + esc(t.kicker) + '</span>' : "") +
          '<h1 class="cabeca__t">' + esc(t.titulo) + '</h1>' +
          (t.desc ? '<p class="cabeca__d">' + esc(t.desc) + '</p>' : "") +
          '<div class="anel">' +
            '<svg viewBox="0 0 62 62" aria-hidden="true">' +
              '<circle class="trilho" cx="31" cy="31" r="26"></circle>' +
              '<circle class="arco" cx="31" cy="31" r="26" ' +
                'stroke-dasharray="' + circ.toFixed(1) + '" ' +
                'stroke-dashoffset="' + (circ * (1 - r.pct / 100)).toFixed(1) + '"></circle>' +
            '</svg>' +
            '<div><div class="anel__n">' + r.pct + '%</div>' +
              '<div class="anel__l">' + r.vistas + ' de ' + r.total + ' aulas' +
              (r.faltamMin ? ' · cerca de ' + r.faltamMin + ' min restantes' : "") + '</div></div>' +
          '</div>' +
          (prox > -1
            ? '<button type="button" class="btn btn--ouro" data-ir="#/aula/' + at(t.id) + '/' + prox + '">' +
                ic("ic-play") + (r.comecou ? "Continuar" : "Começar a trilha") + '</button>'
            : r.completa
              ? '<div class="aviso aviso--ok">' + ic("ic-check") +
                '<span>Trilha concluída. Pode rever qualquer aula quando quiser.</span></div>'
              : '<div class="aviso">' + ic("ic-info") +
                '<span>Os vídeos desta trilha estão sendo gravados.</span></div>') +
        '</div>' +
      '</div>' +
      '<h2 class="secao__t" style="margin-bottom:13px">Aulas</h2>' +
      '<div class="aulas">' + t.aulas.map(function (a, n) {
        return linhaAulaHTML(t, a, n, -1);
      }).join("") + '</div>' +
    '</div>';
    return html + abasHTML("");
  }

  function linhaAulaHTML(t, a, n, atual) {
    var vi = visto(t.id, n);
    var pronta = C.aulaDisponivel(a);
    var min = C.minutos(a);
    var cls = "aula" + (vi ? " aula--vista" : "") + (n === atual ? " aula--atual" : "") +
      (pronta ? "" : " aula--breve");
    return '<button type="button" class="' + cls + '"' +
      (pronta ? ' data-ir="#/aula/' + at(t.id) + '/' + n + '"' : ' disabled aria-disabled="true"') + '>' +
      '<span class="aula__n">' + (vi ? ic("ic-check") : (n + 1)) + '</span>' +
      '<span class="aula__txt">' +
        '<span class="aula__t">' + esc(a.titulo) + '</span>' +
        '<span class="aula__m">' +
          (min ? '<span>' + min + ' min</span>' : "") +
          (pronta ? (vi ? '<span>Assistida</span>' : "") : '<span>Em breve</span>') +
          (a.audio ? '<span>' + ic("ic-fone") + ' áudio</span>' : "") +
          (a.pdf ? '<span>' + ic("ic-pdf") + ' apostila</span>' : "") +
        '</span>' +
      '</span>' +
      (pronta ? '<span class="aula__seta">' + ic("ic-seta-d") + '</span>' : "") +
    '</button>';
  }

  /* ------------------------------------------------------------
     O player
     ------------------------------------------------------------ */
  function telaAula(id, n) {
    var t = C.acharTrilha(estado.cat.trilhas, id);
    if (!t || !t.aulas[n]) return telaNaoAchou();
    var a = t.aulas[n];
    var vi = visto(t.id, n);
    var min = C.minutos(a);

    /* A próxima aula com vídeo, para o botão do fim. Pular as que
       ainda não subiram evita mandar a pessoa para um player vazio. */
    var seguinte = -1;
    for (var i = n + 1; i < t.aulas.length; i++) {
      if (C.aulaDisponivel(t.aulas[i])) { seguinte = i; break; }
    }

    var html = '<div class="folha entra">' +
      '<button type="button" class="volta" data-ir="#/trilha/' + at(t.id) + '">' +
        ic("ic-seta-e") + esc(t.titulo) + '</button>' +
      '<div class="palco">' +
        '<div>' +
          '<div class="quadro">' +
            (C.aulaDisponivel(a)
              ? '<iframe src="https://www.youtube-nocookie.com/embed/' + at(a.youtube) +
                  '?rel=0&modestbranding=1&playsinline=1&color=white" ' +
                  'title="' + at(a.titulo) + '" allowfullscreen ' +
                  'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
                  'referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>'
              : '<div class="quadro__breve">' + ic("ic-relogio") +
                '<div>Esta aula está sendo gravada.<br>Ela aparece aqui quando subir.</div></div>') +
          '</div>' +

          '<div class="sobre">' +
            '<h1 class="sobre__t">' + esc(a.titulo) + '</h1>' +
            '<div class="sobre__m">' +
              '<span>Aula ' + (n + 1) + ' de ' + t.aulas.length + '</span>' +
              (min ? '<span>' + min + ' min</span>' : "") +
              (vi ? '<span style="color:var(--ok)">Assistida</span>' : "") +
            '</div>' +
            (a.desc ? '<p class="sobre__d">' + esc(a.desc) + '</p>' : "") +
            '<div class="sobre__acoes">' +
              (C.aulaDisponivel(a)
                ? (vi
                    ? '<button type="button" class="btn btn--fantasma btn--sm" data-desmarcar="' + n + '">' +
                        'Marcar como não assistida</button>'
                    : '<button type="button" class="btn btn--ouro" data-concluir="' + n +
                        '" data-seguinte="' + seguinte + '">' + ic("ic-check") +
                        (seguinte > -1 ? "Concluir e ir para a próxima" : "Concluir aula") + '</button>')
                : "") +
              (seguinte > -1 && vi
                ? '<button type="button" class="btn btn--claro" data-ir="#/aula/' + at(t.id) + '/' + seguinte + '">' +
                    "Próxima aula" + ic("ic-seta-d") + '</button>'
                : "") +
            '</div>' +
            materialHTML(a) +
          '</div>' +
        '</div>' +

        '<aside class="palco__lado">' +
          '<h2 class="secao__t" style="font-size:15px">Nesta trilha</h2>' +
          '<div class="aulas">' + t.aulas.map(function (x, k) {
            return linhaAulaHTML(t, x, k, n);
          }).join("") + '</div>' +
        '</aside>' +
      '</div>' +
    '</div>';
    return html + abasHTML("");
  }

  /* Áudio e apostila: o que a pessoa leva embora. O áudio toca na
     própria página, porque o caso de uso é ouvir de novo enquanto
     faz outra coisa — obrigar a baixar antes seria atrito à toa. */
  function materialHTML(a) {
    if (!a.audio && !a.pdf) return "";
    var html = '<div class="material"><div class="material__t">Material desta aula</div>';
    if (a.audio) {
      html += '<div class="material__linha">' +
        '<span class="material__ic">' + ic("ic-fone") + '</span>' +
        '<span class="material__txt">' +
          '<span class="material__n">' + esc(a.audioNome || "Aula em áudio") + '</span>' +
          '<span class="material__d">Para ouvir no carro ou caminhando</span>' +
          '<audio controls preload="none" src="' + at(a.audio) + '"></audio>' +
        '</span>' +
      '</div>';
    }
    if (a.pdf) {
      html += '<a class="material__linha" href="' + at(a.pdf) + '" target="_blank" rel="noopener">' +
        '<span class="material__ic">' + ic("ic-pdf") + '</span>' +
        '<span class="material__txt">' +
          '<span class="material__n">' + esc(a.pdfNome || "Apostila em PDF") + '</span>' +
          '<span class="material__d">Abre numa aba nova</span>' +
        '</span>' +
        '<span class="aula__seta">' + ic("ic-baixar") + '</span>' +
      '</a>';
    }
    return html + '</div>';
  }

  /* ------------------------------------------------------------
     Ajuda e conta
     ------------------------------------------------------------ */
  function telaAjuda() {
    var o = estado.cat.org;
    var zap = "https://wa.me/" + String(o.telefone || "").replace(/\D/g, "");
    return '<div class="folha entra">' +
      '<button type="button" class="volta" data-ir="#/inicio">' + ic("ic-seta-e") + 'Início</button>' +
      '<span class="chapeu">Ajuda</span>' +
      '<h1 class="cabeca__t" style="margin-bottom:14px">Precisa falar com a gente?</h1>' +
      '<p class="cabeca__d">A Academy é para aprender a rotina da sua empresa. ' +
        'Dúvida sobre a sua contabilidade, documento ou imposto se resolve direto com o seu ' +
        'gerente de contas — e é mais rápido assim.</p>' +
      '<div class="aulas" style="max-width:520px">' +
        '<a class="aula" href="' + at(zap) + '" target="_blank" rel="noopener">' +
          '<span class="aula__n">' + ic("ic-ajuda") + '</span>' +
          '<span class="aula__txt"><span class="aula__t">WhatsApp</span>' +
          '<span class="aula__m">' + esc(o.telefoneExibicao) + ' · ' + esc(o.horario) + '</span></span>' +
          '<span class="aula__seta">' + ic("ic-seta-d") + '</span></a>' +
        '<a class="aula" href="mailto:' + at(o.email) + '">' +
          '<span class="aula__n">' + ic("ic-info") + '</span>' +
          '<span class="aula__txt"><span class="aula__t">E-mail</span>' +
          '<span class="aula__m">' + esc(o.email) + '</span></span>' +
          '<span class="aula__seta">' + ic("ic-seta-d") + '</span></a>' +
      '</div>' +
      '<p class="porta__rodape">' + esc(o.nome) + '</p>' +
    '</div>' + abasHTML("ajuda");
  }

  function telaConta() {
    var a = estado.aluno;
    return '<div class="folha entra">' +
      '<button type="button" class="volta" data-ir="#/inicio">' + ic("ic-seta-e") + 'Início</button>' +
      '<span class="chapeu">Sua conta</span>' +
      '<h1 class="cabeca__t" style="margin-bottom:18px">' + esc(a.nome || "Aluno") + '</h1>' +
      '<div style="max-width:430px">' +
        '<div class="campo"><label class="campo__r" for="cNome">Seu nome</label>' +
          '<input class="entrada" id="cNome" maxlength="120" value="' + at(a.nome) + '"></div>' +
        '<div class="campo"><label class="campo__r" for="cEmp">Sua empresa</label>' +
          '<input class="entrada" id="cEmp" maxlength="160" value="' + at(a.empresa) + '" ' +
          'placeholder="Como a Totali conhece a sua empresa"></div>' +
        '<div class="campo"><label class="campo__r">E-mail de acesso</label>' +
          '<input class="entrada" value="' + at(a.email) + '" disabled></div>' +
        '<button type="button" class="btn btn--ouro btn--bloco" data-salvar-conta="1">Salvar</button>' +
        '<div style="height:26px"></div>' +
        '<button type="button" class="btn btn--fantasma btn--bloco" data-sair="1">' +
          ic("ic-sair") + 'Sair desta conta</button>' +
        '<div style="height:26px"></div>' +
        '<div class="aviso">' + ic("ic-alerta") +
          '<span><strong>Apagar a minha conta.</strong> Sai o seu nome, o seu e-mail e o ' +
          'registro do que você assistiu. Não dá para desfazer, e você precisaria de um ' +
          'convite novo para voltar.<br><br>' +
          '<button type="button" class="btn btn--fantasma btn--sm" data-apagar-conta="1" ' +
            'style="border-color:rgba(232,138,131,.5);color:var(--danger)">Apagar a minha conta</button>' +
          '</span></div>' +
      '</div>' +
    '</div>' + abasHTML("conta");
  }

  function telaNaoAchou() {
    return '<div class="folha entra"><div class="vazio">' +
      '<div class="vazio__ic">' + ic("ic-info") + '</div>' +
      '<div class="vazio__t">Não encontramos esta página</div>' +
      '<p class="vazio__d">O endereço pode ter mudado. Volte ao início e comece de lá.</p>' +
      '<div style="margin-top:18px"><button type="button" class="btn btn--claro" data-ir="#/inicio">' +
        'Ir para o início</button></div>' +
    '</div></div>' + abasHTML("");
  }

  /* ------------------------------------------------------------
     Porta de entrada
     ------------------------------------------------------------ */
  function codigoDaURL() {
    var m = String(location.search || "").match(/[?&]k=([A-Za-z0-9]{6,40})/);
    return m ? m[1] : "";
  }

  function telaPorta(convite) {
    var cad = estado.porta === "cadastro";
    var rec = estado.porta === "recuperar";
    var o = (estado.cat && estado.cat.org) || C.padrao().org;

    var corpo;
    if (rec) {
      corpo = '<h1 class="porta__t">Esqueci minha senha</h1>' +
        '<p class="porta__d">Escreva o seu e-mail. Mandamos um link para você criar uma senha nova.</p>' +
        campo("pEmail", "E-mail", "email", "voce@suaempresa.com.br") +
        '<button type="button" class="btn btn--ouro btn--bloco" data-acao="recuperar">Enviar o link</button>' +
        '<p class="porta__pe"><button type="button" class="btn btn--sm btn--fantasma" data-porta="entrar">Voltar</button></p>';
    } else if (cad) {
      corpo = '<h1 class="porta__t">Criar o seu acesso</h1>' +
        '<p class="porta__d">' +
          (convite && convite.rotulo
            ? "Convite de " + esc(convite.rotulo) + ". Escolha uma senha e comece a assistir."
            : "Você foi convidado pela " + esc(o.curto) + ". Escolha uma senha e comece a assistir.") +
        '</p>' +
        campo("pNome", "Seu nome", "text", "Como você quer ser chamado") +
        campo("pEmpresa", "Sua empresa", "text", "Opcional") +
        campo("pEmail", "E-mail", "email", "voce@suaempresa.com.br") +
        campo("pSenha", "Crie uma senha", "password", "Pelo menos 6 caracteres") +
        '<button type="button" class="btn btn--ouro btn--bloco" data-acao="cadastrar">Criar acesso e entrar</button>' +
        '<p class="porta__pe">Já tem acesso? ' +
          '<button type="button" class="btn btn--sm btn--fantasma" data-porta="entrar">Entrar</button></p>';
    } else {
      corpo = '<h1 class="porta__t">Entrar</h1>' +
        '<p class="porta__d">Use o e-mail e a senha que você cadastrou.</p>' +
        campo("pEmail", "E-mail", "email", "voce@suaempresa.com.br") +
        campo("pSenha", "Senha", "password", "") +
        '<button type="button" class="btn btn--ouro btn--bloco" data-acao="entrar">Entrar</button>' +
        '<p class="porta__pe"><button type="button" class="btn btn--sm btn--fantasma" data-porta="recuperar">' +
          'Esqueci minha senha</button></p>';
    }

    return '<div class="porta"><div class="porta__cartao entra">' +
      '<img class="porta__marca" src="assets/academy-branca.png" alt="Academy · Totali" ' +
        'width="1989" height="618">' +
      corpo +
      '<p class="porta__rodape">' + esc(o.nome) + '<br>' +
        esc(o.telefoneExibicao) + ' · ' + esc(o.email) + '</p>' +
    '</div></div>';
  }

  function campo(id, rotulo, tipo, dica) {
    return '<div class="campo"><label class="campo__r" for="' + id + '">' + esc(rotulo) + '</label>' +
      '<input class="entrada" id="' + id + '" type="' + tipo + '" ' +
      (tipo === "email" ? 'inputmode="email" autocomplete="email" ' : "") +
      (tipo === "password" ? 'autocomplete="current-password" ' : "") +
      'placeholder="' + at(dica) + '"></div>';
  }

  /* ------------------------------------------------------------
     Desenho
     ------------------------------------------------------------ */
  var conviteAtual = null;

  function render() {
    if (!raiz) return;

    if (estado.carregando) {
      raiz.innerHTML = '<div class="carregando"><div class="giro"></div>' +
        '<p>Abrindo a sua Academy…</p></div>';
      return;
    }

    if (!estado.aluno) {
      raiz.innerHTML = telaPorta(conviteAtual);
      var foco = $("#pNome") || $("#pEmail");
      if (foco) { try { foco.focus(); } catch (e) {} }
      return;
    }

    var r = lerRota();
    estado.rota = r.nome;
    var corpo;
    if (r.nome === "trilha") corpo = telaTrilha(r.id);
    else if (r.nome === "aula") corpo = telaAula(r.id, r.n);
    else if (r.nome === "ajuda") corpo = telaAjuda();
    else if (r.nome === "conta") corpo = telaConta();
    else corpo = telaInicio();

    raiz.innerHTML = topoHTML() + corpo;
    if (r.nome !== "aula") global.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ------------------------------------------------------------
     Cliques
     ------------------------------------------------------------ */
  function valor(id) { var e = $(id); return e ? String(e.value || "").trim() : ""; }

  function ligar() {
    document.addEventListener("click", function (ev) {
      var alvo = ev.target.closest ? ev.target : null;
      if (!alvo) return;

      var nav = alvo.closest("[data-ir]");
      if (nav) { ev.preventDefault(); ir(nav.getAttribute("data-ir")); return; }

      var troca = alvo.closest("[data-porta]");
      if (troca) { estado.porta = troca.getAttribute("data-porta"); render(); return; }

      var acao = alvo.closest("[data-acao]");
      if (acao) { ev.preventDefault(); agir(acao.getAttribute("data-acao"), acao); return; }

      var fim = alvo.closest("[data-concluir]");
      if (fim) {
        var n = Number(fim.getAttribute("data-concluir"));
        var seg = Number(fim.getAttribute("data-seguinte"));
        var rr = lerRota();
        fim.disabled = true;
        N.marcarAula(rr.id, n, true).then(function () {
          if (seg > -1) ir("#/aula/" + rr.id + "/" + seg);
          else { render(); recado("Aula concluída. Trilha inteira assistida!", "ok"); }
        }, function (e) {
          fim.disabled = false;
          recado(N.explicar(e), "erro", 8000);
        });
        return;
      }

      var des = alvo.closest("[data-desmarcar]");
      if (des) {
        var rd = lerRota();
        N.marcarAula(rd.id, Number(des.getAttribute("data-desmarcar")), false)
          .then(render, function (e) { recado(N.explicar(e), "erro"); });
        return;
      }

      if (alvo.closest("[data-sair]")) {
        N.sair().then(function () { location.hash = ""; });
        return;
      }

      if (alvo.closest("[data-salvar-conta]")) { salvarConta(); return; }
      if (alvo.closest("[data-apagar-conta]")) { apagarConta(); return; }
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      var alvo = ev.target;
      if (!alvo || alvo.tagName !== "INPUT") return;
      var botao = $("[data-acao]");
      if (botao) { ev.preventDefault(); botao.click(); }
    });

    global.addEventListener("hashchange", render);
  }

  function agir(qual, botao) {
    var email = valor("#pEmail"), senha = valor("#pSenha");
    var trava = function (t) { botao.disabled = true; botao.textContent = t; };
    var solta = function (t) { botao.disabled = false; botao.textContent = t; };

    if (qual === "recuperar") {
      if (!email) { recado("Escreva o seu e-mail.", "erro"); return; }
      trava("Enviando…");
      N.recuperarSenha(email).then(function () {
        estado.porta = "entrar"; render();
        recado("Link enviado para " + email + ". Confira também o lixo eletrônico.", "ok", 9000);
      }, function (e) { solta("Enviar o link"); recado(N.explicar(e), "erro", 8000); });
      return;
    }

    if (qual === "entrar") {
      if (!email || !senha) { recado("Preencha o e-mail e a senha.", "erro"); return; }
      trava("Entrando…");
      N.entrar(email, senha).catch(function (e) {
        solta("Entrar"); recado(N.explicar(e), "erro", 8000);
      });
      return;
    }

    if (qual === "cadastrar") {
      var nome = valor("#pNome"), empresa = valor("#pEmpresa");
      if (!nome) { recado("Escreva o seu nome.", "erro"); return; }
      if (!email || !senha) { recado("Preencha o e-mail e a senha.", "erro"); return; }
      if (senha.length < 6) { recado("A senha precisa de pelo menos 6 caracteres.", "erro"); return; }
      var cod = codigoDaURL();
      if (!cod) { recado("Abra o link de convite que a Totali mandou.", "erro", 9000); return; }
      trava("Criando…");
      N.cadastrar(cod, nome, email, senha, empresa).catch(function (e) {
        solta("Criar acesso e entrar"); recado(N.explicar(e), "erro", 9000);
      });
    }
  }

  function salvarConta() {
    var nome = valor("#cNome"), empresa = valor("#cEmp");
    if (!nome) { recado("O nome não pode ficar vazio.", "erro"); return; }
    N.db.collection("alunos").doc(estado.aluno.uid)
      .update({ nome: nome.slice(0, 120), empresa: empresa.slice(0, 160) })
      .then(function () {
        estado.aluno.nome = nome; estado.aluno.empresa = empresa;
        render(); recado("Salvo.", "ok");
      }, function (e) { recado(N.explicar(e), "erro", 8000); });
  }

  function apagarConta() {
    if (!global.confirm("Apagar a sua conta da Academy? Sai o seu nome, o seu e-mail e o " +
        "registro do que você assistiu. Não dá para desfazer.")) return;
    N.apagarMinhaConta().then(function () {
      location.hash = "";
      recado("Conta apagada. Obrigado por ter estado aqui.", "ok", 9000);
    }, function (e) {
      /* Apagar conta exige login recente. Quando o Firebase recusa
         por isso, a saída honesta é pedir para entrar de novo. */
      var c = (e && e.code) || "";
      if (c === "auth/requires-recent-login") {
        recado("Por segurança, entre de novo e repita a exclusão.", "erro", 9000);
        N.sair().then(function () { location.hash = ""; });
        return;
      }
      recado(N.explicar(e), "erro", 9000);
    });
  }

  /* ------------------------------------------------------------
     Abertura
     ------------------------------------------------------------ */
  function iniciar() {
    raiz = $("#app");
    if (!raiz) return;
    ligar();
    render();

    N.pronto().then(function (ok) {
      if (!ok) {
        estado.carregando = false;
        raiz.innerHTML = '<div class="folha"><div class="vazio">' +
          '<div class="vazio__ic">' + ic("ic-alerta") + '</div>' +
          '<div class="vazio__t">Não foi possível abrir a Academy</div>' +
          '<p class="vazio__d">Verifique a conexão e recarregue a página. ' +
          'Se continuar, fale com a gente.</p></div></div>';
        return;
      }

      /* O catálogo é público: carrega em paralelo com a sessão, e
         por isso a porta de entrada já mostra o nome e o contato
         certos em vez de texto genérico. */
      N.catalogo().then(function (c) {
        estado.cat = c;
        if (!estado.aluno && !estado.carregando) render();
      });

      var cod = codigoDaURL();
      if (cod) {
        estado.porta = "cadastro";
        N.lerConvite(cod).then(function (c) { conviteAtual = c; if (!estado.aluno) render(); },
          function () { conviteAtual = null; });
      }

      N.observarSessao(function (aluno, motivo) {
        estado.aluno = aluno;
        estado.carregando = false;
        if (!aluno && motivo === "sem-cadastro") {
          /* Conta existe no Authentication mas não em /alunos: é
             quem começou o cadastro e não terminou. Com convite na
             mão, a tela de criar acesso resolve; sem, precisa de um
             link novo. */
          estado.porta = codigoDaURL() ? "cadastro" : "entrar";
          if (!codigoDaURL()) recado("Sua conta não está vinculada à Academy. Peça um link novo à Totali.", "erro", 10000);
        }
        if (aluno && !estado.cat) {
          N.catalogo().then(function (c) { estado.cat = c; render(); });
          return;
        }
        render();
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})(window);
