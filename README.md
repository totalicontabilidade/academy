# Academy · Totali Soluções Contábeis

Plataforma de aulas em vídeo para os clientes da Totali. O cliente entra por um
link de convite, assiste às trilhas e o sistema guarda onde ele parou. Mais nada.

Aplicação estática (HTML, CSS e JavaScript sem framework), pensada primeiro para
o celular, instalável como aplicativo (PWA) e publicada no GitHub Pages.

- **Academy (cliente):** <https://totalicontabilidade.github.io/academy/>
- **Administração:** <https://totalicontabilidade.github.io/academy/admin/>

---

## O que este sistema NÃO é

Até 23/09/2026 isto era o **Portal do Cliente**: checklist de documentos,
recebimento da contabilidade anterior, cofre de senhas de maquininha, jornada de
30 dias, dossiê e ficha em PDF, mensagens e trilha de auditoria. Tudo isso saiu.

O código removido está inteiro na tag **`portal-completo`** do git, e é o
material de origem do Portal do Cliente, que é um sistema à parte. Para trazer
qualquer pedaço de volta:

```
git checkout portal-completo -- <caminho>
```

Se você chegou aqui procurando alguma dessas funções, é na tag que ela está — e
não deve voltar para cá.

---

## Como funciona

### Quem assiste

1. Recebe um link de convite: `…/academy/?k=CODIGO`.
2. Cria o acesso com nome, e-mail e senha. O código precisa existir e estar
   ativo — sem ele não há cadastro, e é o que impede que o endereço público
   vire porta de entrada para qualquer um.
3. Assiste. Cada aula marcada como vista fica em `alunos/{uid}.progresso`, num
   mapa `"trilha|numero" → quando viu`.

### Quem administra

A administração (`admin/index.html`) tem cinco abas:

| Aba | Serve para |
|---|---|
| Início | O que precisa de atenção: nada publicado, aula sem vídeo, aluno parado |
| Trilhas e aulas | Criar, ordenar e publicar o conteúdo. É a aba que justifica o painel |
| Alunos | Quem assiste e até onde chegou; remover acesso |
| Convites | Criar, desligar e apagar os links de acesso |
| Usuários | Quem entra no painel — **só administrador** |

Nada do que se edita em Trilhas chega ao cliente antes de **Publicar para os
clientes**. Enquanto isso o rascunho fica no navegador, e a página avisa antes
de ser fechada com alteração pendente.

**Nenhuma alteração de conteúdo exige mexer no código ou abrir o console do
Firebase.** Essa é uma regra do projeto, não uma coincidência.

---

## Arquitetura

```
index.html          a Academy do cliente
admin/index.html    a administração (equipe.html sobrou só como encaminhamento)

js/moldura.js       impede a página de ser posta dentro de outro site
js/util.js          nove funções auxiliares puras
js/ui.js            toast, modal, menu, confirmação
js/catalogo.js      a forma de uma trilha e de uma aula, e as contas de progresso

js/nucleo.js        o Firebase do ALUNO      → index.html
js/aluno.js         as telas do aluno

js/admin.js         o Firebase do PAINEL     → admin/index.html
js/painel.js        casca: porta de entrada, abas, identidade
js/painel-inicio.js · painel-trilhas.js · painel-alunos.js
js/painel-convites.js · painel-usuarios.js

sw.js               service worker (cache versionado)
css/academy.css     o visual do cliente
css/painel.css      o visual do painel
```

`nucleo.js` e `admin.js` são separados de propósito: a tela do cliente não
precisa saber criar convite, e o painel não precisa saber marcar aula como
vista.

### Dados no Firestore

| Coleção | O que guarda | Quem lê | Quem escreve |
|---|---|---|---|
| `conteudo/portal` | o catálogo publicado (bloco `academy`) | todo mundo | equipe |
| `alunos/{uid}` | nome, empresa, convite, progresso | o próprio e a equipe | o próprio e a equipe |
| `convites/{codigo}` | rótulo e se está ativo | quem sabe o código | equipe |
| `usuarios/{uid}` | quem entra no painel | equipe | administrador |

O nome `conteudo/portal` é herdado e foi mantido de propósito: renomear
obrigaria a publicar tela e regra na mesma janela, e o ganho seria estético.

**Ser da equipe é TER DOCUMENTO em `usuarios/{uid}`** — não é um campo no
próprio perfil, que a pessoa poderia escrever. As regras estão em
`firestore.rules`, comentadas uma a uma.

### Storage

Só `publico/`: capa de trilha e de aula, aula em áudio e apostila em PDF. Não há
documento de cliente na Academy. Os limites e os tipos aceitos estão em
`storage.rules` e repetidos em `js/admin.js` — se divergirem, um arquivo passa no
navegador e é recusado no servidor.

#### Envio de arquivos: uma permissão que se concede uma vez

A regra do Storage descobre quem é da equipe **consultando o Firestore**:

```
firestore.exists(/databases/(default)/documents/usuarios/$(request.auth.uid))
```

Essa consulta entre serviços exige uma permissão que o projeto **não recebe
sozinha** quando as regras são publicadas pela linha de comando. Sem ela a regra
reprova todo envio, em silêncio, e o painel mostra `storage/unauthorized` — as
regras estão certas e mesmo assim nada sobe.

Para liberar, o caminho curto:

1. Console do Firebase → **Storage → Rules**.
2. Salvar/publicar as regras por ali (pode ser o mesmo texto de `storage.rules`).
3. O console detecta a consulta entre serviços e oferece conceder a permissão.
   Aceite.
4. **Publique as regras de novo depois disso.** Só a permissão não basta — foi
   preciso subir uma versão nova para o envio passar a funcionar. Se o
   `firebase deploy` disser *already up to date, skipping upload*, mude
   qualquer comentário em `storage.rules` para forçar.

Se não aparecer a oferta, o caminho longo, no Google Cloud → **IAM**, do projeto
`totali-academy`: marque *Incluir concessões de papéis fornecidas pelo Google*,
procure `service-279694787480@gcp-sa-firebaserules.iam.gserviceaccount.com` e
conceda o papel **Firebase Rules Firestore Service Agent**.

Enquanto isso não for feito, o resto da Academy funciona: o vídeo mora no
YouTube, e a capa da aula cai na miniatura dele.

Liberado em 23/09/2026 e verificado: a equipe envia, a leitura é pública, e o
servidor recusa HTML e SVG — arquivo que o navegador executa servido do nosso
endereço seria XSS com a nossa assinatura.

### O que não existe

Sem App Check, sem Cloud Functions, sem notificações. Nada disso tem o que
proteger ou o que disparar num sistema de vídeos.

---

## O primeiro administrador nasce à mão

Não existe regra que diga "pode se promover se a coleção estiver vazia" sem
abrir a porta para quem chegar primeiro. Uma vez na vida do projeto:

1. No console do Firebase, **Authentication → Add user**, com e-mail e senha.
2. Copie o **UID** que aparece na lista.
3. Em **Firestore**, crie `usuarios/{aquele-uid}` com:

```
nome   (string)  Seu Nome
email  (string)  voce@totalicontabilidade.com.br
papel  (string)  admin
```

Daí em diante o painel se basta: a aba Usuários cria e remove os outros.

---

## Publicar

```bash
git push origin main
```

GitHub Pages, com cache de 10 minutos. Confira pela `VERSAO` em `sw.js`, que
sobe a cada mudança de arquivo — se a versão publicada não mudou, o deploy não
chegou.

Regras do Firestore e do Storage:

```bash
npx firebase-tools deploy --only firestore:rules,storage --project totali-academy
```

---

## Desenvolvimento

```bash
npx http-server . -p 8099 -c-1
```

Ou `serve.ps1`. Não abra por `file://`: o service worker e o Firebase exigem
`http://localhost` ou HTTPS.

---

## Decisões que parecem estranhas e não são

- **A sessão do painel fica no aparelho** (`LOCAL`), como a do aluno. Ficou na
  aba primeiro, e custava uma senha por aba nova. Em troca, num computador
  compartilhado o botão Sair passa a ser obrigatório.
- **`entrar()` carrega o perfil e avisa por conta própria**, em vez de esperar o
  evento de autenticação do Firebase. Depender do evento produziu dois defeitos
  reais em 23/09/2026: o botão preso em "Entrando…" e a tela de cadastro que não
  saía. O porquê está escrito em `js/nucleo.js`.
- **`frame-ancestors` não está na CSP.** Entregue por `<meta>`, o navegador a
  ignora. Quem impede o enquadramento é o `js/moldura.js`.
- **Aula sem vídeo é um estado legítimo:** aparece como "em breve". O painel
  avisa antes de publicar, mas não impede.
- **Remover um aluno apaga o documento, não a conta de login.** Apagar conta do
  Authentication pelo navegador só a própria pessoa consegue. Sem o documento, a
  regra já não deixa ler nada.

---

## Nomes que não mudam

| Aparece como | É | Por quê |
|---|---|---|
| `conteudo/portal` | o catálogo da Academy | renomear exigiria publicar tela e regra juntas |
| `totalicontabilidade/academy` | o repositório | era `portaldocliente`, renomeado em 21/09/2026 |
