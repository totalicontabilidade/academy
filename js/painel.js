/* ============================================================
   Totali · Academy
   painel.js — a casca do painel de administração

   O QUE ESTE ARQUIVO FAZ, E SÓ ISSO:

     1. A porta de entrada. Ninguém vê o painel antes de provar
        que é da equipe.
     2. Qual aba está aberta, pelo endereço — dá para recarregar a
        página e voltar no mesmo lugar, e dá para mandar o link de
        uma aba para um colega.
     3. Quem está usando, sempre visível no cabeçalho. Num sistema
        interno isso não é enfeite: é o que evita alguém publicar
        conteúdo na conta de outra pessoa.

   As abas em si são desenhadas por outros arquivos
   (painel-trilhas.js, painel-alunos.js, painel-convites.js,
   painel-usuarios.js). Aqui só se decide o que aparece.

   POR QUE ELE ENCOLHEU
   --------------------
   O painel anterior tinha oito abas e 12 mil linhas de código,
   quase todas do Portal do Cliente: conferir documento, cobrar
   pendência, responder mensagem, abrir cofre de senha, gerar
   dossiê em PDF. Isso saiu inteiro em 23/09/2026 (tag
   `portal-completo` no git). O que a Academy precisa é publicar
   aula e saber quem assistiu — e é do tamanho disso que o painel
   tem de ser.
   ============================================================ */
(function (global) {
  "use strict";

  var UI = global.UI, U = global.U, A = global.Admin;
  var $ = UI.$, $$ = UI.$$;

  var ABAS = ["inicio", "conteudo", "alunos", "convites", "usuarios"];
  var PADRAO = "inicio";
  var TITULOS = {
    inicio: "Início",
    conteudo: "Trilhas e aulas",
    alunos: "Alunos",
    convites: "Convites",
    usuarios: "Usuários"
  };

  /* Criar, remover e mudar o papel de quem entra no painel é só de
     administrador — e a regra do Firestore diz o mesmo, que é
     quem de fato decide. Esconder a aba é conforto: evita a
     pessoa abrir uma tela que só saberia lhe dizer não. */
  var SO_ADMIN = ["usuarios"];

  var abaAtual = "";
  var ouvintes = [];
  var souAdmin = false;

  /* ------------------------------------------------------------
     Navegação
     ------------------------------------------------------------ */
  function abaValida(id) {
    if (ABAS.indexOf(id) === -1) return PADRAO;
    /* Rota digitada à mão para uma aba que não é dela cai no
       Início, em vez de abrir uma tela que só saberia recusar. */
    if (SO_ADMIN.indexOf(id) > -1 && !souAdmin) return PADRAO;
    return id;
  }

  function abaDaURL() {
    return abaValida((location.hash || "").replace(/^#\/?/, "").split("?")[0]);
  }

  function abrir(id, semRolar) {
    var alvo = abaValida(id);
    if (location.hash !== "#/" + alvo) { location.hash = "#/" + alvo; return; }
    aplicar(alvo, semRolar);
  }

  function aplicar(alvo, semRolar) {
    var mudou = abaAtual !== alvo;
    abaAtual = alvo;

    $$("[data-painel]").forEach(function (s) {
      s.hidden = s.getAttribute("data-painel") !== alvo;
    });

    $$("[data-aba]").forEach(function (b) {
      /* A logo do cabeçalho é atalho, não item de menu: nunca
         fica marcada como página atual. */
      if (b.classList.contains("brand")) return;
      if (b.getAttribute("data-aba") === alvo) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });

    document.title = TITULOS[alvo] + " · Painel de administração · Totali";

    if (mudou && !semRolar) global.scrollTo({ top: 0, behavior: "auto" });
    if (mudou) ouvintes.forEach(function (fn) {
      try { fn(alvo); } catch (e) { /* um ouvinte com erro não derruba os outros */ }
    });
  }

  function aoTrocarDeAba(fn) { if (typeof fn === "function") ouvintes.push(fn); }

  /* ------------------------------------------------------------
     Quem está usando
     ------------------------------------------------------------ */
  function iniciais(nome) {
    var partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "?";
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  function mostrarQuem(equipe) {
    var acoes = $("#pnAcoes");
    if (!acoes) return;
    if (!equipe) { acoes.hidden = true; return; }

    var nome = equipe.nome || (equipe.email || "").split("@")[0] || "Equipe";
    acoes.hidden = false;
    $("#pnNome").textContent = nome;
    $("#pnPapel").textContent = equipe.papel === "admin" ? "Administrador" : "Equipe";
    $("#pnIniciais").textContent = iniciais(equipe.nome || equipe.email);
    $("#pnQuem").title = equipe.email || "";

    souAdmin = equipe.papel === "admin";
    SO_ADMIN.forEach(function (aba) {
      $$('[data-aba="' + aba + '"]').forEach(function (b) { b.hidden = !souAdmin; });
    });
    /* Já estava numa aba que deixou de existir para ela — acontece
       quando o próprio papel muda com o painel aberto. */
    if (!souAdmin && SO_ADMIN.indexOf(abaAtual) > -1) abrir(PADRAO);
  }

  /* ------------------------------------------------------------
     A porta de entrada
     ------------------------------------------------------------ */
  function erroLogin(texto) {
    var caixa = $("#lgErro");
    if (!caixa) return;
    if (!texto) { caixa.hidden = true; return; }
    caixa.hidden = false;
    $("#lgErroTxt").textContent = texto;
  }

  function mostrarPorta(mostrar) {
    $("#pnPorta").hidden = !mostrar;
    $("#painel").hidden = mostrar;
    $("#secLogin").hidden = !mostrar;
    /* A classe é o que esconde o menu lateral e a barra de abas do
       celular: sem sessão não há para onde eles levarem, e cinco
       atalhos mortos ao lado da caixa de senha só dão o que
       ignorar. Quem trata disso é o css/painel.css. */
    document.body.classList.toggle("porta-aberta", !!mostrar);
    if (mostrar) mostrarQuem(null);
  }

  function ligarPorta() {
    var botao = $("#lgEntrar");
    var email = $("#lgEmail");
    var senha = $("#lgSenha");

    function tentar() {
      var e = (email.value || "").trim();
      var s = senha.value || "";
      if (!e || !s) { erroLogin("Preencha o e-mail e a senha."); return; }

      erroLogin("");
      botao.disabled = true;
      botao.textContent = "Entrando…";

      /* Quem troca a tela é o aviso que `entrar` dispara com o
         crachá já em mãos. Aqui só se cuida do que dá errado — e
         de devolver o botão, para o "Entrando…" nunca ficar preso
         numa tela que não mudou. Foi esse exato defeito que
         apareceu na tela do aluno em 23/09/2026. */
      A.entrar(e, s).then(function (eq) {
        if (!eq) { botao.disabled = false; botao.textContent = "Entrar"; }
      }, function (erro) {
        botao.disabled = false;
        botao.textContent = "Entrar";
        erroLogin(A.explicar(erro));
      });
    }

    botao.addEventListener("click", tentar);
    [email, senha].forEach(function (campo) {
      campo.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); tentar(); }
      });
    });

    $("#lgEsqueci").addEventListener("click", function (ev) {
      ev.preventDefault();
      var e = (email.value || "").trim();
      if (!e) { erroLogin("Escreva o seu e-mail acima e clique de novo."); return; }
      A.recuperar(e).then(function () {
        erroLogin("");
        UI.toast("Se existir conta com esse e-mail, o link de nova senha chegou na caixa de entrada.", "ok", 9000);
      }, function (erro) { erroLogin(A.explicar(erro)); });
    });
  }

  /* ------------------------------------------------------------
     Abertura
     ------------------------------------------------------------ */
  function iniciar() {
    ligarPorta();

    $$("[data-aba]").forEach(function (b) {
      b.addEventListener("click", function () { abrir(b.getAttribute("data-aba")); });
    });

    $("#pnSair").addEventListener("click", function () {
      A.sair().then(function () { location.hash = ""; });
    });

    global.addEventListener("hashchange", function () { aplicar(abaDaURL()); });

    A.pronto().then(function (ok) {
      if (!ok) {
        mostrarPorta(true);
        erroLogin(A.explicar(new Error(A.erroInicial())));
        return;
      }

      A.observarSessao(function (equipe, motivo) {
        if (!equipe) {
          mostrarPorta(true);
          var botao = $("#lgEntrar");
          botao.disabled = false;
          botao.textContent = "Entrar";
          if (motivo) erroLogin(A.explicar(new Error(motivo)));
          return;
        }
        erroLogin("");
        $("#lgSenha").value = "";
        mostrarPorta(false);
        mostrarQuem(equipe);
        aplicar(abaDaURL(), true);
        ouvintes.forEach(function (fn) {
          try { fn(abaAtual); } catch (e) {}
        });
      });
    });
  }

  global.Painel = {
    iniciar: iniciar,
    abrir: abrir,
    aba: function () { return abaAtual; },
    aoTrocarDeAba: aoTrocarDeAba,
    souAdmin: function () { return souAdmin; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})(window);
