/* ============================================================
   Totali · Academy
   moldura.js — a página não se deixa pôr dentro de outro site

   O GitHub Pages não deixa enviar cabeçalho HTTP, então nem
   `X-Frame-Options` nem `frame-ancestors` estão disponíveis — e
   `frame-ancestors` por <meta> o navegador ignora. Esta
   verificação em JavaScript é a defesa possível contra
   clickjacking: se a página aparecer dentro do quadro de outro
   site, o conteúdo some e a navegação vai para o endereço de
   verdade.

   VALE PARA AS DUAS PÁGINAS, e é por isso que mora num arquivo
   só. No painel a razão é mais forte que na tela do aluno: ali
   existem botões que apagam acesso, e um quadro invisível por
   cima é exatamente o golpe que este trecho impede.

   PRECISA VIR ANTES DE TODO O RESTO. Carregado depois, já teria
   havido um instante em que os botões estiveram clicáveis dentro
   do quadro alheio.
   ============================================================ */
(function (global) {
  "use strict";

  try {
    if (global.top === global.self) return;
  } catch (e) {
    /* Acessar `top` já lança erro em origem cruzada: também é quadro. */
  }

  document.documentElement.innerHTML =
    '<body style="margin:0;font-family:system-ui,sans-serif;background:#0a1522;color:#fff;' +
    'display:grid;place-items:center;height:100vh;text-align:center;padding:24px">' +
    '<div><p style="font-size:16px;font-weight:600;margin:0 0 8px">Página bloqueada</p>' +
    '<p style="font-size:14px;opacity:.8;margin:0">Por segurança, a Academy da Totali não ' +
    'pode ser exibida dentro de outro site.</p></div></body>';

  try { global.top.location = global.self.location.href; } catch (e) { /* origem cruzada */ }
})(window);
