# Turnstile Emulator

Emulador mínimo de catraca eletrônica para testes de integração, executado em Node.js e escrito em TypeScript. A comunicação inicial usa somente TCP, com mensagens de texto delimitadas por `\n`.

## Requisitos

- Node.js 20 ou superior
- npm

## Executar

```bash
npm install
npm run dev
```

Por padrão, o servidor escuta em `127.0.0.1:5000` e mantém a conexão do Agent enquanto estiver ativa. Na CLI, escolha `1` para informar o usuário e enviar `AUTH|<id>`; após `ALLOW|<id>`, pressione Enter para enviar `PASSAGE|<id>`. A catraca fecha e bloqueia após a passagem. É possível configurar o endereço:

```bash
HOST=0.0.0.0 PORT=5001 npm run dev
```

Mensagens de entrada são exibidas no terminal. Cada linha completa é entregue como uma mensagem; linhas ainda sem `\n` ficam armazenadas até os próximos dados chegarem.
Mensagens de entrada são processadas linha a linha. `OPEN`, `CLOSE`, `LOCK`, `UNLOCK`, `STATUS` e `RESET` controlam ou consultam a catraca. `AUTH|123` gera `AUTH_REQUEST|123`, sem consultar uma API. `ALLOW|123` libera a passagem; em seguida, `PASSAGE|123`, `CLOSE` e `LOCK` completam o ciclo. `DENY|123` mantém a catraca bloqueada.

## Testar em dois terminais

No primeiro terminal, inicie o emulador:

```bash
npm run dev
```

No segundo terminal, conecte o Agent (ou `nc` para simular um) uma única vez:

```bash
nc 127.0.0.1 5000
```

Digite, por exemplo, `AUTH|123` e pressione Enter. O primeiro terminal exibirá `Received: AUTH|123`. Para enviar várias mensagens, digite `OPEN`, `CLOSE`, `LOCK`, `UNLOCK`, `STATUS` ou `PING`, uma por linha. Encerre o cliente com `Ctrl+C`.
Deixe essa conexão aberta. Na CLI do primeiro terminal, escolha `1` e informe `123`. No terminal do Agent, responda `ALLOW|123` (ou `DENY|123`). Após autorização, pressione Enter na CLI para enviar `PASSAGE|123`; a catraca então fecha e bloqueia. `OPEN` está disponível como operação administrativa no menu. Encerre com `Ctrl+C`.

## Verificações

```bash
npm test
npm run build
```
