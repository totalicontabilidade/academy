/* ============================================================
   Totali · Academy
   util.js — funções auxiliares puras (sem estado, sem DOM global)

   ENCOLHEU EM 23/09/2026. Eram trinta funções, e vinte delas
   serviam ao Portal do Cliente: máscara de CNPJ, de CPF e de PIS,
   validação de dígito verificador, política de aceite de arquivo,
   tamanho em bytes, ícone por extensão, link do sistema contábil,
   base64 de convite, carregador de script sob demanda. Nada disso
   tem uso numa Academy de vídeos.

   Ficaram nove, que são as que as duas telas realmente chamam. O
   resto está na tag `portal-completo` no git, inteiro, para
   quando o Portal do Cliente for construído.
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- Segurança: escape de HTML ----------
     Toda string que vier de fora — nome de quem assiste, título de
     aula digitado no painel, rótulo de convite — DEVE passar por
     aqui antes de entrar em innerHTML. É a primeira barreira
     contra XSS, e a mais barata.
  ------------------------------------------------- */
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };
  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[&<>"'`]/g, function (c) { return ESC_MAP[c]; });
  }

  /* Escape para uso dentro de atributo entre aspas duplas. É o
     mesmo trabalho de `esc`, e tem nome próprio para que o lugar
     de chamada diga onde o texto vai parar. */
  function escAttr(v) { return esc(v); }

  /* ---------- Datas ---------- */
  function dataCurta(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  /* ---------- Texto ---------- */
  function saudacao() {
    var h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }

  function primeiroNome(nome) {
    if (!nome) return "";
    return String(nome).trim().split(/\s+/)[0];
  }

  /* Devolve só a palavra; o número vai por conta de quem chama.
     É assim porque nem toda frase põe o número antes da palavra
     ("2 aulas", mas também "sem aulas"). */
  function plural(n, sing, plur) { return n === 1 ? sing : plur; }

  /* Endereço legível a partir de um título: "Notas fiscais" vira
     "notas-fiscais". Vai no endereço da aula, que o cliente pode
     guardar nos favoritos. */
  function slug(nome) {
    return String(nome || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item";
  }

  /* ---------- Validação ----------
     Deliberadamente frouxa: a regra exata do que é um e-mail
     válido é longa e cheia de exceções, e errar para o lado
     rígido recusa endereços legítimos. Quem decide de verdade é o
     Firebase, que também manda o e-mail. */
  function validaEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v || "").trim());
  }

  /* ---------- Ritmo ----------
     Para campo de busca: redesenhar a lista a cada tecla faz a
     digitação engasgar em lista grande. */
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 250);
    };
  }

  global.U = {
    esc: esc,
    escAttr: escAttr,
    dataCurta: dataCurta,
    saudacao: saudacao,
    primeiroNome: primeiroNome,
    plural: plural,
    slug: slug,
    validaEmail: validaEmail,
    debounce: debounce
  };
})(window);
