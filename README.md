# Caderneta Digital — Controle de Fiado

App para controlar vendas fiado do mercado. Só você (o mercado) usa login
nesse app: cadastra o cliente com uma senha numérica (PIN de 6 dígitos) e,
na hora de lançar a venda, entrega o aparelho para o cliente digitar a
senha dele num teclado numérico na tela — como um pinpad de maquininha —
para confirmar e reconhecer a compra. Funciona em qualquer navegador
(celular, tablet, computador) e sincroniza entre todos os dispositivos.

## Segurança

- A senha de acesso do mercado e a senha (PIN) de cada cliente são geridas
  pelo **Firebase Authentication** — nunca ficam salvas em texto puro em
  lugar nenhum, nem eu tenho acesso a elas.
- A confirmação da venda só acontece se o PIN digitado bater com o PIN
  real do cliente (verificado contra o Firebase, não por comparação de
  texto simples).
- As **Regras de Segurança do Firestore** (`firestore.rules`) garantem que
  só a conta do mercado consegue ler ou alterar clientes e vendas.

## Passo a passo para publicar

### 1. Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e crie um novo projeto.
2. No menu lateral, vá em **Build > Authentication** → aba **Sign-in method**
   → ative o provedor **E-mail/senha**.
3. Vá em **Build > Firestore Database** → **Criar banco de dados** → escolha
   modo de produção e a região mais próxima (ex: `southamerica-east1`).
4. Ainda no Firestore, abra a aba **Regras** e cole o conteúdo do arquivo
   `firestore.rules` deste projeto, substituindo o que já está lá. Clique em
   **Publicar**.
5. Vá em **Configurações do projeto** (ícone de engrenagem) → role até
   **Seus aplicativos** → clique no ícone `</>` para criar um app da Web.
   Dê um nome qualquer e clique em registrar. O Firebase vai mostrar um bloco
   `firebaseConfig` — você vai precisar desses valores no próximo passo.

### 2. Configurar o projeto localmente

1. Copie o arquivo `.env.example` para `.env`.
2. Preencha o `.env` com os valores do `firebaseConfig` que o Firebase
   mostrou (apiKey, authDomain, projectId, etc.).

### 3. Subir para o GitHub

1. Crie um repositório novo no GitHub (pode ser privado).
2. Envie esta pasta para o repositório:
   ```
   git init
   git add .
   git commit -m "Caderneta Digital - controle de fiado"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
   > O arquivo `.env` não vai junto (está no `.gitignore`), que é o certo —
   > ele contém a configuração do seu Firebase.

### 4. Publicar no Vercel

1. Acesse https://vercel.com, clique em **Add New > Project** e importe o
   repositório do GitHub que você acabou de criar.
2. O Vercel detecta automaticamente que é um projeto Vite — pode deixar as
   configurações padrão de build.
3. Antes de clicar em **Deploy**, abra **Environment Variables** e adicione
   cada uma das variáveis do seu `.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Clique em **Deploy**. Em cerca de um minuto o app estará no ar, com um
   link tipo `seu-projeto.vercel.app`.

### 5. Primeiro acesso

1. Abra o link publicado. Como é a primeira vez, o app vai pedir para você
   criar a conta do mercado (nome do mercado, seu e-mail e uma senha). Esse
   e-mail também serve para recuperar a senha caso esqueça.
2. Cadastre um cliente: nome, CPF, telefone e uma senha de 6 dígitos (o
   próprio cliente pode digitar essa senha na hora do cadastro).
3. Para lançar uma venda: aba "Nova venda" → escolha o cliente → valor →
   vencimento → "Lançar venda" → entregue o aparelho para o cliente digitar
   a senha e confirmar.

## Rodar localmente (opcional, para testar antes de publicar)

```
npm install
npm run dev
```
