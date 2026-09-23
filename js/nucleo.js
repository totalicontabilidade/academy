/* ============================================================
   Totali · Academy
   nucleo.js — o servidor, visto de quem assiste

   TUDO O QUE A TELA DO ALUNO PRECISA DO FIREBASE PASSA POR AQUI:
   entrar, cadastrar pelo convite, ler o catálogo de trilhas e
   guardar o que já foi assistido. Nada mais.

   Por que um módulo novo em vez do `firebase.js` de antes: aquele
   nasceu para o onboarding e fala a língua dele — empresa, sócio,
   acesso vinculado à empresa, documento. Na Academy o aluno é uma
   PESSOA, não uma empresa, e reaproveitar aquele desenho obrigaria
   a inventar uma empresa para cada um. O painel da equipe continua
   com o `firebase.js`, que é onde aquela conversa ainda faz
   sentido.

   O QUE FICA GUARDADO DE QUEM ASSISTE
   -----------------------------------
   Um documento em /alunos/{uid}: nome, e-mail, a empresa que a
   pessoa diz ser a dela, o código do convite que a trouxe e o
   progresso. Progresso é um mapa "trilha/aula" → quando viu. Sem
   documento, sem senha de terceiro, sem valor — e é o próprio
   aluno quem escreve, o que as regras garantem.
   ============================================================ */
(function (global) {
  "use strict";

  var app = null, auth = null, db = null, storage = null;
  var erroInicial = "";
  var alunoAtual = null;
  var catalogoEmCache = null;

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

      /* App Check só entra se houver chave. Na Academy não há, e o
         porquê está escrito em js/firebase-config.js. */
      if (global.APP_CHECK_SITE_KEY && global.firebase.appCheck) {
        try { global.firebase.appCheck(app).activate(global.APP_CHECK_SITE_KEY, true); }
        catch (e) { /* segue sem */ }
      }

      auth = global.firebase.auth(app);
      db = global.firebase.firestore(app);
      if (global.firebase.storage) storage = global.firebase.storage(app);

      /* A sessão fica no aparelho: o cliente não quer digitar senha
         para ver a aula seguinte amanhã. */
      return auth.setPersistence(global.firebase.auth.Auth.Persistence.LOCAL)
        .catch(function () { /* aba privada: sessão só desta aba */ })
        .then(function () { return true; });
    } catch (e) {
      erroInicial = (e && e.message) || "falhou";
      return Promise.resolve(false);
    }
  })();

  function pronto() { return prontoP; }

  /* O token recém-criado demora alguns instantes para valer no
     Firestore. Sem esperar, a primeira gravação do cadastro volta
     negada e a conta nasce sem documento — foi um defeito real no
     sistema antigo, e a cura é a mesma. */
  function aguardarCredencial() {
    var u = auth && auth.currentUser;
    if (!u) return Promise.resolve();
    return u.getIdToken(true).catch(function () {});
  }

  /* ------------------------------------------------------------
     Entrar, cadastrar, sair
     ------------------------------------------------------------ */
  function lerConvite(codigo) {
    if (!db) return Promise.reject(new Error("sem-conexao"));
    var cod = String(codigo || "").trim();
    if (!/^[A-Za-z0-9]{6,40}$/.test(cod)) return Promise.reject(new Error("codigo-invalido"));
    return db.collection("convites").doc(cod).get().then(function (d) {
      if (!d.exists) throw new Error("convite-inexistente");
      var v = d.data() || {};
      if (v.ativo !== true) throw new Error("convite-usado");
      return { codigo: cod, rotulo: String(v.rotulo || v.nome || "").slice(0, 120) };
    });
  }

  function entrar(email, senha) {
    if (!auth) return Promise.reject(new Error("sem-conexao"));
    return auth.signInWithEmailAndPassword(String(email).trim(), String(senha))
      .then(aguardarCredencial);
  }

  /* O cadastro só acontece com convite válido: é o que mantém o
     conteúdo com quem é cliente. A conta no Authentication vem
     primeiro; o documento em /alunos depois, porque a regra do
     servidor exige que o uid já exista para conferir a assinatura. */
  function cadastrar(codigo, nome, email, senha, empresa) {
    if (!auth || !db) return Promise.reject(new Error("sem-conexao"));
    var cod = "";
    return lerConvite(codigo)
      .then(function (c) {
        cod = c.codigo;
        return auth.createUserWithEmailAndPassword(String(email).trim(), String(senha))
          .catch(function (e) {
            /* Já tem conta e voltou pelo link: entrar resolve, e é
               o que a pessoa esperava que acontecesse. */
            if (e && e.code === "auth/email-already-in-use") {
              return auth.signInWithEmailAndPassword(String(email).trim(), String(senha));
            }
            throw e;
          });
      })
      .then(function (cred) {
        var u = cred.user || auth.currentUser;
        var nomeLimpo = String(nome || "").trim().slice(0, 120);
        return u.updateProfile({ displayName: nomeLimpo }).catch(function () {})
          .then(aguardarCredencial)
          .then(function () {
            return db.collection("alunos").doc(u.uid).set({
              nome: nomeLimpo,
              email: String(u.email || "").slice(0, 160),
              empresa: String(empresa || "").trim().slice(0, 160),
              convite: cod,
              criadoEm: Date.now(),
              ultimoAcessoEm: Date.now(),
              progresso: {}
            });
          });
      });
  }

  function recuperarSenha(email) {
    if (!auth) return Promise.reject(new Error("sem-conexao"));
    return auth.sendPasswordResetEmail(String(email).trim());
  }

  function sair() {
    alunoAtual = null;
    return auth ? auth.signOut() : Promise.resolve();
  }

  /* ------------------------------------------------------------
     Quem está assistindo

     Um documento ausente NÃO quer dizer "não é aluno" quando a
     resposta veio do cache: numa oscilação de rede isso jogaria a
     pessoa de volta para o login no meio da aula. Só a resposta do
     SERVIDOR afirma ausência.
     ------------------------------------------------------------ */
  function observarSessao(aoMudar) {
    if (!auth) { aoMudar(null); return function () {}; }
    return auth.onAuthStateChanged(function (u) {
      if (!u) { alunoAtual = null; aoMudar(null); return; }
      aguardarCredencial()
        .then(function () { return db.collection("alunos").doc(u.uid).get(); })
        .then(function (d) {
          if (!d.exists) {
            var doServidor = d.metadata && d.metadata.fromCache === false;
            if (doServidor) { alunoAtual = null; aoMudar(null, "sem-cadastro"); return; }
            if (alunoAtual) { aoMudar(alunoAtual); return; }
            aoMudar(null, "leitura-falhou");
            return;
          }
          var v = d.data() || {};
          alunoAtual = {
            uid: u.uid,
            nome: v.nome || u.displayName || "",
            email: v.email || u.email || "",
            empresa: v.empresa || "",
            progresso: v.progresso || {}
          };
          aoMudar(alunoAtual);
          /* Marca de presença, sem travar a tela: serve para a
             equipe saber quem anda por aqui. */
          db.collection("alunos").doc(u.uid)
            .update({ ultimoAcessoEm: Date.now() }).catch(function () {});
        }, function () {
          if (alunoAtual) { aoMudar(alunoAtual); return; }
          aoMudar(null, "leitura-falhou");
        });
    });
  }

  /* ------------------------------------------------------------
     O catálogo

     Mora em conteudo/portal, no bloco `academy`, que é onde o
     painel da equipe publica. O nome do documento é herança do
     sistema antigo e continua por um motivo prático: o editor de
     conteúdo do painel grava ali, e trocar o nome dos dois lados
     de uma vez é mudança para outra rodada.

     Leitura aberta, de propósito: a tela de entrada mostra o nome
     e o contato da Totali antes de qualquer login.
     ------------------------------------------------------------ */
  function catalogo(forcar) {
    if (catalogoEmCache && !forcar) return Promise.resolve(catalogoEmCache);
    if (!db) return Promise.resolve(global.Catalogo.padrao());
    return db.collection("conteudo").doc("portal").get().then(function (d) {
      var blocos = (d.exists && (d.data() || {}).blocos) || {};
      catalogoEmCache = global.Catalogo.aplicar(blocos);
      return catalogoEmCache;
    }, function () {
      catalogoEmCache = global.Catalogo.padrao();
      return catalogoEmCache;
    });
  }

  /* ------------------------------------------------------------
     O progresso

     Uma chave por aula: "trilhaId/indice" → hora em que foi
     concluída. Gravar com caminho pontilhado mexe só naquela
     chave, sem reescrever o mapa inteiro — duas abas abertas não
     apagam o trabalho uma da outra.
     ------------------------------------------------------------ */
  function chaveDaAula(trilhaId, n) {
    return String(trilhaId).replace(/[.~/[\]*]/g, "") + "|" + Number(n);
  }

  function marcarAula(trilhaId, n, visto) {
    if (!db || !alunoAtual) return Promise.reject(new Error("sem-sessao"));
    var chave = chaveDaAula(trilhaId, n);
    var campo = new global.firebase.firestore.FieldPath("progresso", chave);
    var valor = visto ? Date.now() : global.firebase.firestore.FieldValue.delete();
    /* Espelha na memória antes de a rede responder: a tela precisa
       reagir no clique, não no ping. */
    if (visto) alunoAtual.progresso[chave] = Date.now();
    else delete alunoAtual.progresso[chave];
    return db.collection("alunos").doc(alunoAtual.uid).update(campo, valor);
  }

  function aulaVista(trilhaId, n) {
    if (!alunoAtual) return false;
    return !!alunoAtual.progresso[chaveDaAula(trilhaId, n)];
  }

  /* Apagar a própria conta é direito de quem entrou (LGPD). Sai o
     documento e sai a conta do Authentication, nesta ordem: sem o
     documento a regra já não deixaria apagá-lo depois. */
  function apagarMinhaConta() {
    if (!auth || !db || !alunoAtual) return Promise.reject(new Error("sem-sessao"));
    var u = auth.currentUser;
    return db.collection("alunos").doc(alunoAtual.uid).delete()
      .then(function () { return u.delete(); })
      .then(function () { alunoAtual = null; });
  }

  /* ------------------------------------------------------------
     Erro em português, e dizendo o que fazer
     ------------------------------------------------------------ */
  var RECADOS = {
    "auth/invalid-credential": "E-mail ou senha não conferem.",
    "auth/invalid-email": "Esse e-mail não parece válido.",
    "auth/user-not-found": "Não encontramos uma conta com esse e-mail.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/weak-password": "A senha precisa de pelo menos 6 caracteres.",
    "auth/email-already-in-use": "Já existe conta com esse e-mail. Tente entrar.",
    "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão. Verifique a internet e tente de novo.",
    "permission-denied": "Sem permissão para esta ação.",
    "unavailable": "O servidor não respondeu. Tente de novo em instantes.",
    "codigo-invalido": "Esse link de convite não está completo.",
    "convite-inexistente": "Convite não encontrado. Peça um link novo à Totali.",
    "convite-usado": "Esse convite já não vale. Peça um link novo à Totali.",
    "sem-conexao": "Sem conexão com o servidor.",
    "sem-sessao": "Sua sessão expirou. Entre de novo."
  };

  function explicar(e) {
    var c = (e && (e.code || e.message)) || "";
    return RECADOS[c] || "Não deu certo. Tente de novo em instantes.";
  }

  global.Nucleo = {
    pronto: pronto,
    get ligado() { return !!db; },
    get erro() { return erroInicial; },
    get db() { return db; },
    get auth() { return auth; },
    get storage() { return storage; },
    get aluno() { return alunoAtual; },
    observarSessao: observarSessao,
    lerConvite: lerConvite,
    entrar: entrar,
    cadastrar: cadastrar,
    recuperarSenha: recuperarSenha,
    sair: sair,
    catalogo: catalogo,
    marcarAula: marcarAula,
    aulaVista: aulaVista,
    chaveDaAula: chaveDaAula,
    apagarMinhaConta: apagarMinhaConta,
    explicar: explicar
  };
})(window);
