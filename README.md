# APP Finanças — V1

Primeira versão limpa e testável do PWA de controle financeiro.

## Funcionalidades desta versão

- Login por e-mail e senha.
- Cadastro de usuário.
- Recuperação de senha.
- Logout.
- Criação/atualização automática do perfil em `users/{uid}` no Cloud Firestore.
- Dashboard inicial.
- Manifesto PWA e Service Worker.
- Layout responsivo.

## Firebase

Projeto configurado: `app-financas-ab7aa`.

Antes do teste em GitHub Pages, confirme em **Firebase Console → Authentication → Settings → Authorized domains** que o domínio abaixo está autorizado:

`paes2005-design.github.io`

## Como publicar no novo repositório

1. Crie um repositório novo e público.
2. Extraia este ZIP.
3. Envie **o conteúdo da pasta**, deixando `index.html` na raiz do repositório.
4. Em **Settings → Pages**, selecione:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/(root)`
5. Aguarde a publicação.

## Teste esperado

1. Abra o endereço do GitHub Pages.
2. Crie uma conta com e-mail e senha de pelo menos 6 caracteres.
3. Confira o usuário em **Firebase Authentication → Users**.
4. Confira o documento em **Firestore Database → users → UID**.

## Segurança

A configuração Web do Firebase no frontend identifica o projeto, mas não é uma chave administrativa. A proteção dos dados depende do Firebase Authentication e das regras do Firestore.

## Crédito do ícone

Finança ícones criados por DinosoftLabs — Flaticon.
