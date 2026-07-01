# Caderneta Digital — Controle de Fiado

App para controlar vendas fiado do mercado. Só você (o mercado) faz login
nesse app: cadastra o cliente com uma senha numérica (PIN de 6 dígitos) e,
na hora de lançar a venda, entrega o aparelho para o cliente digitar a
senha dele num teclado numérico na tela — como um pinpad de maquininha —
para confirmar e reconhecer a compra. Funciona em qualquer navegador
(celular, tablet, computador) e sincroniza entre todos os dispositivos.

## Funcionalidades

- Cadastro de clientes com nome, CPF, telefone, dia de vencimento da
  fatura, limite de crédito (opcional) e senha pessoal (PIN de 6 dígitos).
- Lançamento de venda com busca de cliente por nome ou CPF. Se a compra
  ultrapassar o limite de crédito do cliente, aparece um aviso — mas você
  ainda pode decidir lançar mesmo assim.
- Limite de crédito editável a qualquer momento na ficha do cliente,
  onde também aparece quanto ainda está disponível.
- O vencimento de cada compra é calculado automaticamente: a fatura fecha
  5 dias antes do vencimento escolhido para o cliente — compras feitas
  antes do fechamento entram na fatura do mês atual, depois entram na do
  mês seguinte.
- Confirmação da compra pelo próprio cliente, no pinpad, na hora.
- Aba de Cobranças com busca, mostrando só quem tem saldo em aberto.
- Fatura imprimível (com todas as compras discriminadas) e envio da
  fatura por WhatsApp para o telefone cadastrado do cliente.
- Espaço para logo do mercado no topo do app (clique no quadrado ao lado
  do nome do mercado para enviar uma imagem).

## Segurança

- A senha de acesso do mercado e o PIN de cada cliente são geridos pelo
  **Firebase Authentication** — nunca ficam salvos em texto puro em
  lugar nenhum, nem eu tenho acesso a eles.
- A confirmação da venda só acontece se o PIN digitado bater com o PIN
  real do cliente (verificado contra o Firebase).
- As **Regras de Segurança do Firestore** (`firestore.rules`) garantem que
  só a conta do mercado consegue ler ou alterar clientes e vendas.

## Passo a passo para publicar

### 1. Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e crie um novo projeto.
2. **Build > Authentication** → aba **Sign-in method** → ative
   **E-mail/senha**.
3. **Build > Firestore Database** → **Criar banco de dados** → modo de
   produção, região `southamerica-east1`.
4. Na aba **Regras** do Firestore, apague o conteúdo e cole o do arquivo
   `firestore.rules` deste projeto → **Publicar**.
5. **Build > Storage** → **Começar** → siga o assistente (modo produção,
   mesma região). Isso é usado só para guardar a imagem do logo do
   mercado. Na aba **Regras** do Storage, cole o conteúdo do arquivo
   `storage.rules` deste projeto → **Publicar**.
6. **Configurações do projeto** (ícone de engrenagem) → **Seus
   aplicativos** → ícone `</>` para criar um app Web → dê um nome →
   Registrar. Vai aparecer um bloco `firebaseConfig` — você vai usar
   esses valores no passo do Vercel.

### 2. Subir para o GitHub

1. Crie um repositório novo (pode ser privado) em https://github.com
2. Envie todos os arquivos e pastas de dentro desta pasta para o
   repositório (pelo site, em "uploading an existing file", ou por
   `git push` se preferir usar terminal).
   > O arquivo `.env` não deve subir — ele já está no `.gitignore`.

### 3. Publicar no Vercel

1. https://vercel.com → **Add New > Project** → importe o repositório.
2. Antes de clicar em Deploy, em **Environment Variables**, adicione:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   (os valores vêm do `firebaseConfig` do passo 1.6)
3. Clique em **Deploy**.

### 4. Primeiro acesso

1. Abra o link publicado → crie a conta do mercado (nome, e-mail, senha).
2. Clique no quadrado de logo no topo para enviar a imagem do mercado
   (opcional).
3. Cadastre um cliente: nome, CPF, telefone, dia de vencimento da fatura
   e senha de 6 dígitos.
4. Lance uma venda de teste na aba "Nova venda" e confirme com o pinpad.
5. Na ficha do cliente (Clientes ou Cobranças → toque no cliente), use
   "Imprimir fatura" ou "WhatsApp" para gerar a cobrança.

## Rodar localmente (opcional)

```
npm install
npm run dev
```
