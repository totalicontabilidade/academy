/* ============================================================
   Totali · Portal de Onboarding
   departamentos.js — de que setor cada pessoa cuida

   POR QUE EXISTE
   --------------
   Quem cuida do Departamento Pessoal não precisa ver, todo dia,
   os balanços que a contabilidade está conferindo. Com cinco
   setores e um punhado de clientes, a fila de trabalho de cada
   pessoa some dentro da fila de todo mundo.

   O QUE ISTO É, E O QUE NÃO É
   ---------------------------
   É um FILTRO e um AVISO. Não é permissão.

   A diferença importa e foi decisão do Raoni: a pessoa PODE
   mexer em documento de outro setor — só não deve fazer isso sem
   perceber. Num escritório pequeno, alguém cobre o colega de
   férias na sexta à tarde, e um sistema que trancasse isso seria
   contornado por um login compartilhado no mesmo dia. O que se
   quer evitar é o clique distraído, não o acesso.

   Por isso NÃO existe regra de servidor por departamento: ela
   diria uma coisa que o sistema não cumpre. Quem pode conferir
   documento é a equipe, e continua sendo.

   LISTA VAZIA = TODOS OS SETORES
   ------------------------------
   Ninguém estava cadastrado com departamento quando isto foi
   escrito. Se lista vazia significasse "nenhum setor", o painel
   inteiro esvaziaria para todo mundo na hora da publicação.
   Vazio quer dizer "cuida de tudo" — que também é a verdade num
   escritório onde a mesma pessoa faz fiscal e contábil.
   ============================================================ */
(function (global) {
  "use strict";

  /* Os setores são os próprios grupos do checklist, e não uma
     lista à parte. Lista à parte sairia do lugar no dia em que a
     equipe criasse um departamento novo pela aba Conteúdo. */
  function todos() {
    return (global.DATA && global.DATA.GRUPOS ? global.DATA.GRUPOS : []).map(function (g) {
      return { id: g.id, titulo: g.titulo, icone: g.icone };
    });
  }

  /* OS SETORES QUE A PESSOA CONFERE.

     O campo passou a se chamar `setores` em 11/09/2026. Antes era
     `departamentos`, e o nome ficou errado no dia em que
     "departamento" passou a significar outra coisa — a área da
     empresa onde a pessoa trabalha (ver `AREAS` mais abaixo). Dois
     conceitos com nomes quase iguais é armadilha para quem for
     mexer aqui depois.

     A leitura aceita o nome velho para quem já estava cadastrado;
     a gravação usa só o novo. */
  function meus(equipe) {
    if (!equipe) return [];
    if (Array.isArray(equipe.setores)) return equipe.setores;
    return Array.isArray(equipe.departamentos) ? equipe.departamentos : [];
  }

  /* ---------- Os três estados possíveis ----------

       semSetores         não confere setor NENHUM
       lista vazia        confere TODOS
       lista com ids      confere só esses

     A lista vazia continua querendo dizer "todos", e não "nenhum",
     mesmo agora que "nenhum" existe. Inverter isso esvaziaria o
     painel de todo mundo que está cadastrado sem setor — Hesley,
     Raoni e a conta de teste — no instante da publicação, e sem
     ninguém ter pedido.

     Também não serve marcar os cinco grupos para dizer "todos": os
     grupos do checklist se editam pelo painel, e no dia em que
     nascesse um sexto, quem tivesse os cinco marcados deixaria de
     vê-lo sem entender por quê. Vazio é vazio de propósito: quer
     dizer "o que houver".

     O estado "nenhum" existe porque quem trabalha no Comercial ou
     na Diretoria não confere documento — pedido do Raoni em
     11/09/2026. Mensagem continua chegando para essa pessoa: ela
     não pertence a setor nenhum, e pergunta sem resposta é de quem
     estiver por perto. */
  function semSetores(equipe) {
    return !!(equipe && equipe.semSetores === true);
  }

  /* Vê tudo quem não tem setor definido — e não quem declarou não
     conferir nenhum. */
  function veTudo(equipe) {
    if (semSetores(equipe)) return false;
    return meus(equipe).length === 0;
  }

  function cuida(equipe, grupoId) {
    if (semSetores(equipe)) return false;
    if (veTudo(equipe)) return true;
    return meus(equipe).indexOf(String(grupoId)) > -1;
  }

  /* Como o recorte se chama na tela. Sem isto, o botão do filtro
     nascia com o rótulo vazio para quem não confere nada. */
  function rotuloDoRecorte(equipe) {
    if (semSetores(equipe)) return "Nenhum setor";
    var ids = meus(equipe);
    return ids.length ? nomesDos(ids) : "Todos os setores";
  }

  /* O grupo a que uma chave de documento pertence.
     "socios/{id}/rg" e "fiscal/livros" dão "socios" e "fiscal". */
  function grupoDaChave(chave) {
    return String(chave || "").split("/")[0];
  }

  function cuidaDaChave(equipe, chave) {
    return cuida(equipe, grupoDaChave(chave));
  }

  function tituloDe(grupoId) {
    var achado = todos().filter(function (g) { return g.id === grupoId; })[0];
    return achado ? achado.titulo : grupoId;
  }

  function nomesDos(ids) {
    return (ids || []).map(tituloDe).join(", ");
  }

  /* ============================================================
     A ÁREA DA EMPRESA ONDE A PESSOA TRABALHA

     Isto é OUTRA COISA dos setores acima, e vale insistir porque
     os nomes se parecem:

       setores que confere  → grupos de DOCUMENTO (Societário,
                              Fiscal…). Filtram a fila do Início.
       departamento         → área da EMPRESA (Financeiro,
                              Diretoria…). Não filtra nada; diz
                              onde a pessoa trabalha.

     Foram separados a pedido do Raoni em 11/09/2026. Numa lista
     só, quem fosse marcado apenas como "Comercial" não casaria
     com nenhum grupo de documento e abriria o painel com a tela
     de Início VAZIA, sem entender o motivo.

     A LISTA MORA NO SERVIDOR, e não aqui. Escrita no código, ela
     exigiria uma publicação no dia em que entrasse "Marketing" —
     contra a regra de que tudo se altera pelo painel. Quem edita
     é o administrador, pela tela de Usuários.

     O padrão abaixo só vale enquanto o documento não existir: é o
     que evita a tela nascer sem opção nenhuma.
     ============================================================ */
  var AREAS_PADRAO = ["Financeiro", "Comercial", "Diretoria", "Gerência", "TI"];
  var areasCache = null;

  function limparAreas(lista) {
    if (!Array.isArray(lista)) return [];
    var vistos = {};
    return lista.map(function (a) { return String(a || "").trim().slice(0, 40); })
      .filter(function (a) {
        if (!a) return false;
        var k = a.toLowerCase();
        if (vistos[k]) return false;      /* sem repetir, ignorando maiúsculas */
        vistos[k] = 1;
        return true;
      })
      .slice(0, 30);
  }

  /* O que a tela deve mostrar agora. Nunca devolve vazio: sem
     opção nenhuma, o campo viraria um selo morto no formulário. */
  function areas() {
    return (areasCache && areasCache.length) ? areasCache.slice() : AREAS_PADRAO.slice();
  }

  function carregarAreas() {
    var FB = global.FB;
    if (!FB || !FB.ligado || !FB.db) return Promise.resolve(areas());
    return FB.db.collection("configuracoes").doc("departamentos").get()
      .then(function (d) {
        var lista = d.exists ? limparAreas((d.data() || {}).lista) : [];
        areasCache = lista.length ? lista : null;
        return areas();
      }, function () { return areas(); });
  }

  function salvarAreas(lista) {
    var FB = global.FB;
    if (!FB || !FB.ligado || !FB.db) return Promise.reject(new Error("sem-conexao"));
    var limpa = limparAreas(lista);
    if (!limpa.length) return Promise.reject(new Error("lista-vazia"));
    return FB.db.collection("configuracoes").doc("departamentos").set({
      lista: limpa,
      atualizadoEm: Date.now(),
      atualizadoPor: (FB.equipe && (FB.equipe.nome || FB.equipe.email)) || "equipe"
    }).then(function () { areasCache = limpa; return areas(); });
  }

  /* A área de uma pessoa. Some da tela quando ela sai da lista —
     em vez de mostrar um setor que já não existe. */
  function areaDe(equipe) {
    var a = String((equipe && equipe.departamento) || "").trim();
    return a && areas().indexOf(a) > -1 ? a : "";
  }

  global.Departamentos = {
    todos: todos,
    meus: meus,
    semSetores: semSetores,
    rotuloDoRecorte: rotuloDoRecorte,
    areas: areas,
    areasPadrao: function () { return AREAS_PADRAO.slice(); },
    carregarAreas: carregarAreas,
    salvarAreas: salvarAreas,
    areaDe: areaDe,
    veTudo: veTudo,
    cuida: cuida,
    cuidaDaChave: cuidaDaChave,
    grupoDaChave: grupoDaChave,
    tituloDe: tituloDe,
    nomesDos: nomesDos
  };
})(window);
