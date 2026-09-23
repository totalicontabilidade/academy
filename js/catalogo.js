/* ============================================================
   Totali · Academy
   catalogo.js — o que é uma trilha, o que é uma aula

   A FORMA DO CONTEÚDO, E AS CONTAS QUE A TELA FAZ COM ELE.

   O catálogo vem do painel da equipe, publicado em
   conteudo/portal. Como qualquer coisa que vem de fora, ele passa
   por uma peneira antes de virar tela: título tem tamanho máximo,
   id de vídeo tem formato fixo, endereço de arquivo só vale se
   apontar para o nosso Storage. A equipe é de confiança; o
   caminho entre o editor e a tela, não necessariamente.

   Aqui também moram as contas de progresso — quantas aulas, quanto
   falta, qual é a próxima. Ficam num lugar só porque a tela
   inicial, a página da trilha e o player fazem a MESMA conta, e
   três contas iguais em três arquivos divergem na primeira
   mudança.
   ============================================================ */
(function (global) {
  "use strict";

  var ID_YT = /^[A-Za-z0-9_-]{11}$/;

  function txt(v, max, padrao) {
    return (typeof v === "string" && v.trim()) ? v.slice(0, max) : (padrao || "");
  }

  /* Endereço de arquivo só vale se for do nosso Storage, e por
     HTTPS. Sem isto, um endereço qualquer no campo de capa faria a
     tela do cliente buscar imagem em servidor de terceiro. */
  function arquivoNosso(v) {
    var u = txt(v, 700);
    if (!u) return "";
    return /^https:\/\/(firebasestorage\.googleapis\.com|[a-z0-9-]+\.firebasestorage\.app)\//.test(u) ? u : "";
  }

  /* ------------------------------------------------------------
     O catálogo de exemplo

     Existe para a Academy nunca abrir vazia: antes de a equipe
     publicar a primeira trilha, é isto que aparece. São títulos
     reais do que a Totali pretende ensinar, com o vídeo em branco
     — a tela mostra "em breve" e não um player quebrado.
     ------------------------------------------------------------ */
  var PADRAO = {
    org: {
      nome: "Totali Soluções Contábeis",
      curto: "Totali",
      telefone: "5579998412107",
      telefoneExibicao: "(79) 99841-2107",
      email: "contato@totalicontabilidade.com.br",
      horario: "Seg a sex, 8h às 18h"
    },
    trilhas: [
      {
        id: "primeiros-passos", kicker: "Comece por aqui",
        titulo: "Primeiros passos com a Totali",
        desc: "Como funciona a rotina mensal, o que esperar de nós e o que precisamos de você a cada mês.",
        capa: "",
        aulas: [
          { titulo: "Quem cuida da sua empresa", duracao: "3 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" },
          { titulo: "O calendário do seu mês", duracao: "4 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" },
          { titulo: "Como falar com a gente", duracao: "2 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" }
        ]
      },
      {
        id: "notas-fiscais", kicker: "Dia a dia",
        titulo: "Emissão de notas fiscais",
        desc: "Passo a passo para emitir nota de serviço e de produto sem errar no imposto.",
        capa: "",
        aulas: [
          { titulo: "Nota de serviço: passo a passo", duracao: "5 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" },
          { titulo: "Nota de produto: passo a passo", duracao: "5 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" },
          { titulo: "Erros mais comuns na emissão", duracao: "3 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" }
        ]
      },
      {
        id: "guias-impostos", kicker: "Dia a dia",
        titulo: "Guias e impostos do mês",
        desc: "Onde encontrar suas guias, como pagar e o que acontece se atrasar.",
        capa: "",
        aulas: [
          { titulo: "Onde ficam as suas guias", duracao: "3 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" },
          { titulo: "Como pagar e comprovar", duracao: "3 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" },
          { titulo: "Atrasou? O que fazer", duracao: "3 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" }
        ]
      },
      {
        id: "folha-pessoal", kicker: "Sua equipe",
        titulo: "Contratar e demitir sem dor de cabeça",
        desc: "O que enviar para admitir, o que observar em férias e o que fazer numa rescisão.",
        capa: "",
        aulas: [
          { titulo: "Admissão: documentos e prazos", duracao: "4 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" },
          { titulo: "Férias: como programar", duracao: "4 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" },
          { titulo: "Rescisão: o passo a passo", duracao: "5 min", youtube: "", desc: "", capa: "", audio: "", audioNome: "", pdf: "", pdfNome: "" }
        ]
      }
    ]
  };

  function padrao() { return JSON.parse(JSON.stringify(PADRAO)); }

  /* ------------------------------------------------------------
     A peneira

     `videos` é o nome que o editor do painel usa para a lista de
     aulas, herdado do sistema antigo. Aqui dentro passa a ser
     `aulas`, que é como a tela e o resto do código falam. Aceitar
     os dois nomes na entrada é o que permite trocar o editor
     depois sem virar tudo de uma vez.
     ------------------------------------------------------------ */
  function aplicar(blocos) {
    var b = blocos || {};
    var saida = padrao();

    if (b.org && typeof b.org === "object") {
      saida.org = {
        nome: txt(b.org.nome, 160, PADRAO.org.nome),
        curto: txt(b.org.curto, 60, PADRAO.org.curto),
        telefone: txt(b.org.telefone, 20, PADRAO.org.telefone),
        telefoneExibicao: txt(b.org.telefoneExibicao, 40, PADRAO.org.telefoneExibicao),
        email: txt(b.org.email, 160, PADRAO.org.email),
        horario: txt(b.org.horario, 80, PADRAO.org.horario)
      };
    }

    var brutas = Array.isArray(b.academy) ? b.academy : (Array.isArray(b.trilhas) ? b.trilhas : null);
    if (!brutas) return saida;

    var limpas = brutas.slice(0, 60).map(function (t, i) {
      if (!t || typeof t !== "object") return null;
      var titulo = txt(t.titulo, 120);
      if (!titulo) return null;
      var lista = Array.isArray(t.aulas) ? t.aulas : (Array.isArray(t.videos) ? t.videos : []);
      return {
        id: txt(t.id, 60, "trilha-" + (i + 1)).replace(/[^a-zA-Z0-9_-]/g, "") || ("trilha-" + (i + 1)),
        kicker: txt(t.kicker, 40),
        titulo: titulo,
        desc: txt(t.desc, 400),
        capa: arquivoNosso(t.capa),
        aulas: lista.slice(0, 80).map(function (a) {
          if (!a || typeof a !== "object") return null;
          var at = txt(a.titulo, 140);
          if (!at) return null;
          return {
            titulo: at,
            duracao: txt(a.duracao, 20),
            desc: txt(a.desc, 600),
            youtube: ID_YT.test(a.youtube) ? a.youtube : "",
            capa: arquivoNosso(a.capa),
            audio: arquivoNosso(a.audio),
            audioNome: txt(a.audioNome, 160),
            pdf: arquivoNosso(a.pdf),
            pdfNome: txt(a.pdfNome, 160)
          };
        }).filter(Boolean)
      };
    }).filter(function (t) { return t && t.aulas.length; });

    if (limpas.length) saida.trilhas = limpas;
    return saida;
  }

  /* ------------------------------------------------------------
     Capa

     Ordem: a capa que a equipe subiu, a miniatura do YouTube, e
     por fim nada — e "nada" é um estado desenhado, não um quadrado
     quebrado. A miniatura do YouTube vem de graça e em boa
     resolução; é o que evita obrigar a equipe a exportar arte para
     cada aula.
     ------------------------------------------------------------ */
  function capaDaAula(aula) {
    if (!aula) return "";
    if (aula.capa) return aula.capa;
    if (aula.youtube) return "https://i.ytimg.com/vi/" + aula.youtube + "/hqdefault.jpg";
    return "";
  }

  function capaDaTrilha(trilha) {
    if (!trilha) return "";
    if (trilha.capa) return trilha.capa;
    for (var i = 0; i < trilha.aulas.length; i++) {
      var c = capaDaAula(trilha.aulas[i]);
      if (c) return c;
    }
    return "";
  }

  /* "5 min" → 5. Duração é texto livre no editor de propósito
     (quem cadastra escreve o que quer), então a conta de tempo
     restante é uma estimativa e a tela diz isso com "cerca de". */
  function minutos(aula) {
    var m = String((aula && aula.duracao) || "").match(/(\d+)/);
    return m ? Math.min(600, Number(m[1])) : 0;
  }

  function aulaDisponivel(aula) { return !!(aula && aula.youtube); }

  /* ------------------------------------------------------------
     As contas de progresso
     ------------------------------------------------------------ */
  function resumoDaTrilha(trilha, visto) {
    var total = 0, vistas = 0, prontas = 0, faltamMin = 0;
    (trilha.aulas || []).forEach(function (a, n) {
      total++;
      if (aulaDisponivel(a)) prontas++;
      if (visto(trilha.id, n)) vistas++;
      else if (aulaDisponivel(a)) faltamMin += minutos(a);
    });
    return {
      total: total, vistas: vistas, prontas: prontas,
      pct: total ? Math.round((vistas / total) * 100) : 0,
      completa: total > 0 && vistas === total,
      comecou: vistas > 0,
      faltamMin: faltamMin
    };
  }

  function resumoGeral(trilhas, visto) {
    var total = 0, vistas = 0, prontas = 0;
    (trilhas || []).forEach(function (t) {
      var r = resumoDaTrilha(t, visto);
      total += r.total; vistas += r.vistas; prontas += r.prontas;
    });
    return {
      total: total, vistas: vistas, prontas: prontas,
      pct: total ? Math.round((vistas / total) * 100) : 0
    };
  }

  /* A PRÓXIMA AULA, que é o coração da tela inicial.

     A ordem de preferência não é arbitrária: primeiro a trilha que
     a pessoa COMEÇOU e não terminou, porque retomar custa menos
     que começar; depois a primeira trilha intocada. Dentro da
     trilha, a primeira aula não vista que tenha vídeo — pular uma
     aula "em breve" evita mandar o cliente para uma tela vazia. */
  function proximaAula(trilhas, visto) {
    var candidatas = [[], []];
    (trilhas || []).forEach(function (t) {
      var r = resumoDaTrilha(t, visto);
      if (r.completa) return;
      candidatas[r.comecou ? 0 : 1].push(t);
    });
    var ordem = candidatas[0].concat(candidatas[1]);
    for (var i = 0; i < ordem.length; i++) {
      var t = ordem[i];
      for (var n = 0; n < t.aulas.length; n++) {
        if (!visto(t.id, n) && aulaDisponivel(t.aulas[n])) {
          return { trilha: t, aula: t.aulas[n], n: n, retomando: i < candidatas[0].length };
        }
      }
    }
    return null;
  }

  function acharTrilha(trilhas, id) {
    return (trilhas || []).filter(function (t) { return t.id === id; })[0] || null;
  }

  global.Catalogo = {
    padrao: padrao,
    aplicar: aplicar,
    capaDaAula: capaDaAula,
    capaDaTrilha: capaDaTrilha,
    minutos: minutos,
    aulaDisponivel: aulaDisponivel,
    resumoDaTrilha: resumoDaTrilha,
    resumoGeral: resumoGeral,
    proximaAula: proximaAula,
    acharTrilha: acharTrilha
  };
})(window);
