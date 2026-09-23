/* ============================================================
   Totali · Academy
   admin.js — o servidor, visto de quem administra

   O PAR DE `nucleo.js`. Aquele é o Firebase do aluno; este é o de
   quem publica as aulas. Estão separados porque falam de coisas
   diferentes e porque nenhum dos dois deve carregar o peso do
   outro: a tela do cliente não precisa saber criar convite, e o
   painel não precisa saber marcar aula como vista.

   O QUE ESTE ARQUIVO SUBSTITUIU
   -----------------------------
   O `firebase.js` de antes, de 987 linhas, que era do Portal do
   Cliente: empresa, sócio, documento, cofre de senha, envelope
   criptografado, trilha de auditoria. Nada disso existe mais na
   Academy (ver a tag `portal-completo` no git). Sobrou o que a
   Academy realmente faz:

     conteudo/portal    o catálogo de trilhas e aulas
     alunos/{uid}       quem assiste, e o que já assistiu
     convites/{codigo}  os links que dão acesso
     usuarios/{uid}     quem entra neste painel

   SER DA EQUIPE É TER DOCUMENTO EM /usuarios. Não é um campo no
   próprio perfil — seria o interessado atestando a si mesmo. A
   tela aqui é conveniência; quem decide é a regra do Firestore, e
   ela decide de novo a cada gravação.
   ============================================================ */
(function (global) {
  "use strict";

  var app = null, auth = null, db = null, storage = null;
  var erroInicial = "";
  var equipeAtual = null;
  var ouvintes = [];
  var ocupado = false;   /* silencia o ouvinte durante operação nossa */

  /* ------------------------------------------------------------
     Abertura
     ------------------------------------------------------------ */
  var prontoP = (function () {
    try {
      if (!global.firebase || !global.FIREBASE_CONFIG) {
        erroInicial = "sem-sdk";
        return Promise.resolve(false);
      }
      app = global.firebase.initializeApp(global.FIREBASE_CONFIG);
      auth = global.firebase.auth(app);
      db = global.firebase.firestore(app);
      if (global.firebase.storage) storage = global.firebase.storage(app);

      /* A SESSÃO FICA NO APARELHO, como a do aluno.

         Primeiro ficou na aba (SESSION), pensando em computador
         compartilhado: fechar a aba encerrava o acesso. Custava
         caro no uso real — cada aba nova pedia a senha de novo, e
         quem publica aula abre o painel várias vezes por dia. Ele
         escolheu o outro lado em 23/09/2026, e a escolha é dele:
         o painel roda no computador dele, não num balcão.

         O que isso exige em troca: num computador que outra
         pessoa use, o botão Sair passa a ser obrigatório — sem
         ele, quem sentar depois abre o painel já logado. É o
         preço da comodidade, e está dito aqui para não ser
         redescoberto do jeito difícil. */
      return auth.setPersistence(global.firebase.auth.Auth.Persistence.LOCAL)
        .catch(function () {})
        .then(function () { return true; });
    } catch (e) {
      erroInicial = (e && e.message) || "falhou";
      return Promise.resolve(false);
    }
  })();

  function pronto() { return prontoP; }

  /* O token recém-emitido demora alguns instantes para valer no
     Firestore. Mesma cura do lado do aluno, e pelo mesmo motivo:
     sem esperar, a primeira leitura volta negada. */
  function aguardarCredencial() {
    var u = auth && auth.currentUser;
    if (!u) return Promise.resolve();
    return u.getIdToken(true).catch(function () {});
  }

  /* ------------------------------------------------------------
     A SESSÃO

     Mesmo desenho do `nucleo.js`, e pela mesma razão: `entrar`
     carrega o crachá e avisa por conta própria, em vez de esperar
     o evento de autenticação. Depender do evento produziu dois
     defeitos reais na tela do aluno (23/09/2026) — o botão preso
     em "Entrando…" e a tela de cadastro que não saía —, e o
     painel tem exatamente a mesma forma.
     ------------------------------------------------------------ */
  function avisar(motivo) {
    ouvintes.forEach(function (fn) {
      try { fn(equipeAtual, motivo); } catch (e) { /* um ouvinte ruim não derruba os outros */ }
    });
  }

  function carregarCracha(uid) {
    return aguardarCredencial()
      .then(function () { return db.collection("usuarios").doc(uid).get(); })
      .then(function (d) {
        if (!d.exists) {
          /* Ausência vinda do cache não afirma nada. Só a resposta
             do servidor autoriza dizer "não é da equipe" — e essa
             frase, aqui, derruba a sessão de alguém. */
          var doServidor = d.metadata && d.metadata.fromCache === false;
          if (!doServidor) throw new Error("leitura-falhou");
          return null;
        }
        var v = d.data() || {};
        equipeAtual = {
          uid: uid,
          nome: String(v.nome || ""),
          email: String(v.email || (auth.currentUser && auth.currentUser.email) || ""),
          papel: v.papel === "admin" ? "admin" : "equipe"
        };
        return equipeAtual;
      });
  }

  function entrar(email, senha) {
    if (!auth || !db) return Promise.reject(new Error("sem-conexao"));
    ocupado = true;
    return auth.signInWithEmailAndPassword(String(email).trim(), String(senha))
      .then(function (cred) { return carregarCracha(cred.user.uid); })
      .then(function (eq) {
        ocupado = false;
        if (eq) { avisar(); return eq; }
        /* Conta de verdade, mas sem crachá: é um aluno tentando o
           painel, ou alguém que perdeu o acesso. Encerrar a sessão
           evita deixar a pessoa autenticada numa tela que só
           saberia recusar tudo o que ela pedisse. */
        return auth.signOut().catch(function () {}).then(function () {
          equipeAtual = null;
          avisar("sem-cracha");
          return null;
        });
      }, function (e) { ocupado = false; throw e; });
  }

  function sair() {
    equipeAtual = null;
    return auth ? auth.signOut() : Promise.resolve();
  }

  function recuperar(email) {
    if (!auth) return Promise.reject(new Error("sem-conexao"));
    return auth.sendPasswordResetEmail(String(email).trim());
  }

  function observarSessao(aoMudar) {
    if (typeof aoMudar === "function") ouvintes.push(aoMudar);
    if (!auth) { if (aoMudar) aoMudar(null, "sem-conexao"); return function () {}; }
    return auth.onAuthStateChanged(function (u) {
      if (!u) { equipeAtual = null; avisar(); return; }
      if (ocupado) return;
      carregarCracha(u.uid).then(function (eq) {
        if (eq) { avisar(); return; }
        auth.signOut().catch(function () {}).then(function () {
          equipeAtual = null;
          avisar("sem-cracha");
        });
      }, function () {
        if (equipeAtual) avisar();
        else avisar("leitura-falhou");
      });
    });
  }

  function eu() { return equipeAtual; }
  function souAdmin() { return !!(equipeAtual && equipeAtual.papel === "admin"); }

  /* Assinatura: o `porUid` gravado tem de ser o de quem grava, e a
     regra confere. Não é registro de boa fé — é o que impede
     assinar uma alteração com o nome de outra pessoa. */
  function assinar(dados) {
    var d = dados || {};
    d.porUid = equipeAtual ? equipeAtual.uid : "";
    d.porNome = equipeAtual ? (equipeAtual.nome || equipeAtual.email || "") : "";
    d.em = Date.now();
    return d;
  }

  /* ------------------------------------------------------------
     O CATÁLOGO

     Um documento só, `conteudo/portal`, com o bloco `academy`
     dentro. O nome é herdado do Portal do Cliente e foi mantido
     de propósito: renomear obrigaria a publicar tela e regra na
     mesma janela, e o ganho seria estético. Está escrito aqui e
     em `js/nucleo.js` para ninguém procurar um `conteudo/academy`
     que não existe.
     ------------------------------------------------------------ */
  function lerCatalogo() {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    return db.collection("conteudo").doc("portal").get().then(function (d) {
      return d.exists ? (d.data() || {}) : {};
    });
  }

  function salvarCatalogo(blocos) {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    var b = blocos || {};
    var d = assinar({ academy: b.academy || [], org: b.org || {} });
    return db.collection("conteudo").doc("portal").set(d, { merge: true });
  }

  /* ------------------------------------------------------------
     QUEM ASSISTE
     ------------------------------------------------------------ */
  function alunos() {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    return db.collection("alunos").get().then(function (s) {
      var saida = [];
      s.forEach(function (d) {
        var v = d.data() || {};
        saida.push({
          uid: d.id,
          nome: String(v.nome || ""),
          email: String(v.email || ""),
          empresa: String(v.empresa || ""),
          convite: String(v.convite || ""),
          criadoEm: Number(v.criadoEm) || 0,
          ultimoAcessoEm: Number(v.ultimoAcessoEm) || 0,
          progresso: (v.progresso && typeof v.progresso === "object") ? v.progresso : {}
        });
      });
      return saida;
    });
  }

  /* Some com o DOCUMENTO, não com a conta de login: apagar conta
     do Authentication pelo navegador só é possível para a própria
     pessoa. Quem for removido aqui perde o acesso ao conteúdo na
     hora, porque a regra exige o documento, e a conta órfã de
     login não alcança mais nada. A tela diz isso com todas as
     letras, para ninguém supor que a conta sumiu do Firebase. */
  function apagarAluno(uid) {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    return db.collection("alunos").doc(String(uid)).delete();
  }

  /* ------------------------------------------------------------
     OS CONVITES
     ------------------------------------------------------------ */
  /* 22 caracteres sorteados, sem os que se confundem ao ditar ao
     telefone (0/O, 1/l/I). Dá cerca de 110 bits: não se adivinha,
     e é o que substitui uma lista de e-mails autorizados. */
  function novoCodigo() {
    var ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    var b = new Uint8Array(22);
    global.crypto.getRandomValues(b);
    var s = "";
    for (var i = 0; i < b.length; i++) s += ALFA[b[i] % ALFA.length];
    return s;
  }

  function convites() {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    return db.collection("convites").get().then(function (s) {
      var saida = [];
      s.forEach(function (d) {
        var v = d.data() || {};
        saida.push({
          codigo: d.id,
          rotulo: String(v.rotulo || v.nome || ""),
          ativo: v.ativo === true,
          criadoEm: Number(v.criadoEm) || Number(v.em) || 0,
          porNome: String(v.porNome || "")
        });
      });
      return saida;
    });
  }

  function salvarConvite(codigo, dados) {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    var cod = String(codigo || "").trim();
    if (!/^[A-Za-z0-9]{6,40}$/.test(cod)) return Promise.reject(new Error("codigo-invalido"));
    var d = assinar({
      rotulo: String((dados && dados.rotulo) || "").slice(0, 120),
      ativo: !!(dados && dados.ativo)
    });
    d.criadoEm = (dados && dados.criadoEm) ? dados.criadoEm : Date.now();
    return db.collection("convites").doc(cod).set(d, { merge: true }).then(function () { return cod; });
  }

  function apagarConvite(codigo) {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    return db.collection("convites").doc(String(codigo)).delete();
  }

  /* ------------------------------------------------------------
     QUEM ENTRA NO PAINEL
     ------------------------------------------------------------ */
  function usuarios() {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    return db.collection("usuarios").get().then(function (s) {
      var saida = [];
      s.forEach(function (d) {
        var v = d.data() || {};
        saida.push({
          uid: d.id,
          nome: String(v.nome || ""),
          email: String(v.email || ""),
          papel: v.papel === "admin" ? "admin" : "equipe"
        });
      });
      return saida;
    });
  }

  /* CRIA A CONTA DE LOGIN NUMA SEGUNDA CONEXÃO.

     Criar conta pelo SDK entra nela automaticamente. Na conexão
     principal isso derrubaria a sessão do administrador no meio
     do cadastro — ele sairia do painel sem entender por quê. A
     segunda conexão nasce só para isso: entra, pega o uid e sai. */
  function criarConta(email, senha) {
    if (!auth || !global.firebase) return Promise.reject(new Error("sem-conexao"));
    var secundario;
    try { secundario = global.firebase.app("secundario"); }
    catch (e) { secundario = global.firebase.initializeApp(global.FIREBASE_CONFIG, "secundario"); }

    var authSec = secundario.auth();
    var e = String(email).trim(), s = String(senha);

    var encerrar = function (cred) {
      var uid = cred.user.uid;
      return authSec.signOut().then(function () { return uid; }, function () { return uid; });
    };

    /* Se a conta de login nascer e o crachá não — uma falha de
       rede entre as duas gravações —, cadastrar de novo com os
       MESMOS dados conclui o que faltou, em vez de exigir o
       console do Firebase. Sem a senha certa nada avança, e criar
       o crachá continua sendo coisa de administrador. */
    return authSec.createUserWithEmailAndPassword(e, s).then(encerrar, function (erro) {
      if (!erro || erro.code !== "auth/email-already-in-use") throw erro;
      return authSec.signInWithEmailAndPassword(e, s).then(encerrar, function () {
        throw new Error("email-em-uso-com-outra-senha");
      });
    });
  }

  function salvarUsuario(uid, dados) {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    return db.collection("usuarios").doc(String(uid)).set(assinar({
      nome: String((dados && dados.nome) || "").slice(0, 120),
      email: String((dados && dados.email) || "").slice(0, 160),
      papel: (dados && dados.papel) === "admin" ? "admin" : "equipe"
    }));
  }

  function apagarUsuario(uid) {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    return db.collection("usuarios").doc(String(uid)).delete();
  }

  /* ------------------------------------------------------------
     ARQUIVOS

     Capa, áudio e apostila das aulas, e só em `publico/`. É a
     única coisa que a Academy guarda no Storage: conteúdo nosso,
     que qualquer cliente pode ver. Documento de cliente não
     existe mais aqui — saiu com o onboarding.

     OS LIMITES SÃO OS MESMOS DO `storage.rules`, DE PROPÓSITO.
     Não é validação repetida por desconfiança: a regra do
     servidor é quem decide, e ela recusa com uma mensagem que
     ninguém entende. Conferir antes é o que permite dizer "a
     imagem passa de 5 MB" em vez de "storage/unauthorized".

     Se um dia os limites divergirem, é aqui que se percebe: um
     arquivo que passa nesta peneira e é recusado lá quer dizer
     que as duas listas deixaram de combinar.
     ------------------------------------------------------------ */
  var MB = 1024 * 1024;
  var TIPOS = {
    imagem: { re: /^image\/(jpeg|png|webp)$/, max: 5 * MB,  erro: "arquivo-imagem", ext: "jpg" },
    audio:  { re: /^audio\/(mpeg|mp3|mp4|x-m4a|aac|ogg|opus|wav|x-wav)$/, max: 60 * MB, erro: "arquivo-audio", ext: "mp3" },
    pdf:    { re: /^application\/pdf$/, max: 60 * MB, erro: "arquivo-pdf", ext: "pdf" }
  };

  function subir(arquivo, prefixo, qual) {
    if (!storage) return Promise.reject(new Error("sem-storage"));
    if (!arquivo) return Promise.reject(new Error("sem-arquivo"));

    var t = TIPOS[qual || "imagem"];
    if (!t.re.test(arquivo.type || "")) return Promise.reject(new Error(t.erro));
    if (arquivo.size > t.max) {
      return Promise.reject(new Error(t.max <= 5 * MB ? "arquivo-grande" : "arquivo-grande-60"));
    }

    var ext = (String(arquivo.name || "").match(/\.([a-zA-Z0-9]{1,5})$/) || ["", t.ext])[1].toLowerCase();
    var nome = String(prefixo || "arquivo") + "-" + Date.now() + "-" +
               Math.random().toString(36).slice(2, 8) + "." + ext;
    var ref = storage.ref("publico/" + nome);
    return ref.put(arquivo, { contentType: arquivo.type })
      .then(function () { return ref.getDownloadURL(); });
  }

  /* ------------------------------------------------------------
     ERROS, EM PORTUGUÊS

     Quem usa o painel não tem que ler `auth/wrong-password`. E o
     texto diz o que FAZER, não só o que houve.
     ------------------------------------------------------------ */
  var FALAS = {
    "sem-conexao": "Sem conexão com o servidor. Confira a internet e tente de novo.",
    "sem-sdk": "O sistema não carregou por completo. Atualize a página.",
    "leitura-falhou": "Não deu para falar com o servidor agora. Tente de novo em instantes.",
    "sem-cracha": "Esta conta não tem acesso ao painel. Fale com um administrador da Totali.",
    "codigo-invalido": "O código do convite precisa ter de 6 a 40 letras ou números, sem espaço.",
    "email-em-uso-com-outra-senha": "Já existe uma conta com este e-mail e outra senha. Use outro e-mail, ou peça à pessoa para entrar com a senha que ela já tem.",
    "sem-storage": "O envio de imagens não está disponível agora.",
    "sem-arquivo": "Escolha um arquivo.",
    "arquivo-grande": "A imagem passa de 5 MB. Reduza e tente de novo.",
    "arquivo-grande-60": "O arquivo passa de 60 MB. Comprima e tente de novo.",
    "arquivo-imagem": "A capa precisa ser JPG, PNG ou WebP.",
    "arquivo-audio": "O áudio precisa ser MP3, M4A, AAC, OGG ou WAV.",
    "arquivo-pdf": "A apostila precisa ser um PDF.",
    "auth/invalid-email": "Esse e-mail não parece válido.",
    "auth/user-not-found": "E-mail ou senha não conferem.",
    "auth/wrong-password": "E-mail ou senha não conferem.",
    "auth/invalid-credential": "E-mail ou senha não conferem.",
    "auth/invalid-login-credentials": "E-mail ou senha não conferem.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
    "auth/email-already-in-use": "Já existe uma conta com este e-mail.",
    "auth/weak-password": "A senha precisa de pelo menos 6 caracteres.",
    "auth/network-request-failed": "A internet oscilou. Tente de novo.",
    "permission-denied": "Você não tem permissão para isso. Se deveria ter, fale com um administrador.",
    /* O envio de arquivo depende de a regra do Storage conseguir
       consultar o Firestore para saber quem é da equipe, e essa
       consulta precisa de uma permissão que o projeto não recebe
       sozinha. Sem ela a regra reprova tudo, calada. A mensagem
       diz onde se resolve, porque "não deu certo" faria alguém
       procurar o defeito no arquivo. */
    "storage/unauthorized": "O servidor recusou o envio. Falta liberar, uma vez só, a permissão que deixa a regra do Storage consultar o Firestore — está no README, em “Envio de arquivos”.",
    "storage/retry-limit-exceeded": "O envio demorou demais. Tente de novo com uma conexão melhor.",
    "storage/canceled": "Envio cancelado.",
    "unavailable": "O servidor não respondeu. Tente de novo em instantes."
  };

  function explicar(e) {
    var chave = (e && (e.code || e.message)) || "";
    return FALAS[chave] || "Não deu certo agora. Tente de novo; se insistir, avise o suporte.";
  }

  global.Admin = {
    pronto: pronto,
    erroInicial: function () { return erroInicial; },
    get auth() { return auth; },
    get db() { return db; },
    get storage() { return storage; },

    entrar: entrar,
    sair: sair,
    recuperar: recuperar,
    observarSessao: observarSessao,
    eu: eu,
    souAdmin: souAdmin,
    assinar: assinar,

    lerCatalogo: lerCatalogo,
    salvarCatalogo: salvarCatalogo,

    alunos: alunos,
    apagarAluno: apagarAluno,

    convites: convites,
    salvarConvite: salvarConvite,
    apagarConvite: apagarConvite,
    novoCodigo: novoCodigo,

    usuarios: usuarios,
    criarConta: criarConta,
    salvarUsuario: salvarUsuario,
    apagarUsuario: apagarUsuario,

    subir: subir,
    explicar: explicar
  };
})(window);
