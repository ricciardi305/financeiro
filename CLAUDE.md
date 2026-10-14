# CLAUDE.md — App de finanças pessoais (nome provisório)

App Android **pessoal** (um único usuário) para controlar toda a vida financeira: receitas, despesas, contas, cartões de crédito com faturas, contas fixas recorrentes e investimentos. Lançamentos podem ser manuais ou automáticos (notificações dos bancos + Open Finance via Pluggy).

## Idioma e estilo
- Responda em português do Brasil, de forma direta e com código.
- Código, nomes e commits em inglês. Textos da UI em português.

## Stack
- **React Native + Expo (SDK mais recente) com Development Build.** Expo Go não funciona, porque há código nativo.
- **TypeScript** estrito.
- **expo-sqlite + Drizzle ORM**, com migrations versionadas. Local-first, **sem backend** no MVP.
- **expo-router** para navegação. **Zustand** para estado de UI. **TanStack Query** só para chamadas à Pluggy.
- **expo-secure-store** para credenciais da Pluggy.
- **Módulo Expo local em Kotlin** (`modules/notification-listener`) com `NotificationListenerService`.
- Gráficos: **victory-native** (ou equivalente com Skia). Datas: **date-fns**.
- Testes: **Jest**, com foco em regras de domínio e parsers.

## Ambiente
- Desenvolvimento no **Windows** (sem WSL), com Android Studio, SDK e um aparelho físico via ADB.
- `npx expo run:android` para build local. EAS Build como alternativa.
- Rode `npx expo prebuild --clean` após mexer em nativo ou em config plugin (e em campos de `app.json` que viram config nativa, como `userInterfaceStyle`). Depois dele, **reinicie o Metro com `--clear`**: o watcher trava e o app deixa de refletir as mudanças.
- Variáveis de ambiente do usuário: `JAVA_HOME` (Temurin 17), `ANDROID_HOME`, e `platform-tools` no `PATH`. Para o celular alcançar o Metro: `adb reverse tcp:8081 tcp:8081`.
- O aparelho é um Xiaomi (HyperOS): instalar via USB exige "Instalar via USB" ligado nas Opções do desenvolvedor, com a conta Xiaomi logada.
- **Módulo nativo novo exige recompilar e reinstalar o app.** Antes de adicionar um, prefira o que já está no APK (`expo-sqlite`, `expo-file-system`, `expo-secure-store`). Dependência só de JS carrega sem rebuild.

## Arquitetura
```
app/                      # telas (expo-router)
modules/notification-listener/  # Kotlin
src/
  db/                     # schema Drizzle, migrations, client, seeds (categorias padrão)
  domain/                 # regras puras e testáveis: faturas, parcelas, recorrências, saldos, projeção
  services/               # casos de uso (createTransaction, payInvoice, generateOccurrences...)
  capture/parsers/        # nubank.ts, inter.ts: notificação → evento parseado
  sync/pluggy/            # cliente da API + conciliação
  store/                  # Zustand
  ui/                     # componentes
```
Regra: **lógica financeira fica em `src/domain`, em funções puras e testadas**. Telas não calculam saldo, fatura nem projeção.

## Modelo de domínio

### Contas (`accounts`)
`type`: `checking` (conta corrente) | `credit_card` | `investment` | `cash` (carteira).
Campos: id, name, institution (`nubank` | `inter` | `other`), type, initialBalanceCents, archived, pluggyAccountId?.
Cartão também tem: closingDay, dueDay, limitCents?, paymentAccountId (conta que paga a fatura; precisa ser uma conta corrente ativa).
- `type` e `initialBalanceCents` são **fixos após a criação**. Correção de saldo é um lançamento `adjustment`.
- Conta não é excluída: é **arquivada** (e não dá para arquivar a conta que paga a fatura de um cartão ativo).

### Lançamentos (`transactions`)
Campos: id, accountId, **amountCents assinado** (negativo = saída da conta, positivo = entrada), kind (`income` | `expense` | `transfer` | `adjustment`), description, merchantRaw?, categoryId?, necessity? (`essential` | `optional`), occurredAt (instante ISO), **occurredOn** (`YYYY-MM-DD` no fuso America/Sao_Paulo), status (`pending` | `confirmed`), source (`manual` | `notification` | `pluggy` | `recurrence`), invoiceId?, **paidInvoiceId?**, installmentGroupId?, installmentNumber?, installmentTotal?, transferGroupId?, occurrenceId?, pluggyTransactionId?, rawNotificationId?, notes?, createdAt, **deletedAt?**.

- **Toda regra de dia ou mês usa `occurredOn`**, nunca o instante UTC (um ISO perto da meia-noite cai no dia errado). Lançamento digitado à mão grava o meio-dia de São Paulo (UTC-3, sem horário de verão desde 2019).
- O banco impõe por `CHECK`: `income` > 0 e `expense` < 0. O valor digitado na UI é sempre a magnitude positiva; o sinal vem do `kind`.
- `kind` não muda ao editar (ele fixa o sinal). Transferência edita valor, descrição e data nas duas pernas; para trocar as contas, exclua e recrie.

- **Receita** (salário, bônus): `income`, positivo, numa conta corrente.
- **Despesa Pix/débito**: `expense`, negativo, na conta corrente.
- **Compra no cartão**: `expense`, negativo, na conta do cartão, **sempre vinculada a uma fatura** (`invoiceId`).
- **Transferência** (pagar fatura, aplicar em investimento, resgatar, mover entre contas): duas linhas com o mesmo `transferGroupId`, uma negativa na origem e uma positiva no destino. **Transferência não conta como receita nem despesa** nos relatórios.
- **Parcelado**: gera N lançamentos, um por fatura futura, com o mesmo `installmentGroupId`. Divida o total em centavos e jogue a diferença de arredondamento na primeira parcela.

### Faturas (`invoices`)
Campos: id, cardAccountId, referenceMonth (`YYYY-MM`), closingDate, dueDate. **O status (`open` | `closed` | `paid` | `partially_paid`) é derivado** por função pura em `src/domain`, a partir das datas e dos pagamentos; nunca é gravado.
- A fatura de uma compra é definida pela data da compra versus o dia de fechamento: compra **no dia do fechamento ou depois** vai para a fatura seguinte. Isso fica numa função pura testada, incluindo virada de ano e meses curtos (dia 31 → último dia do mês).
- `invoiceId` só existe em compras, estornos e encargos. **Total da fatura = soma dos lançamentos com esse `invoiceId`.**
- Pagar fatura = transferência da conta pagadora para o cartão; a perna do cartão leva `paidInvoiceId` (não `invoiceId`, para o pagamento não zerar o total). Valor pago = soma dos `paidInvoiceId`. Pagamento parcial é permitido.
- `referenceMonth` é o **mês em que a fatura fecha**. Vencimento = primeira data com `dueDay` estritamente depois do fechamento (mesmo mês se `dueDay` > fechamento, senão o mês seguinte; dia 31 vira o último dia do mês). Faturas são criadas sob demanda (`ensureInvoice`); a aberta hoje e a seguinte sempre existem.
- **Regra de fechamento:** compra no dia do fechamento vai para a fatura seguinte. **Confirmado no Inter** (pelo usuário). **Nubank ainda não confirmado**; por isso a tela de compra permite ajustar a fatura à mão (‹ ›) até validar com a primeira fatura real.
- Parcelado: `planInstallments` gera uma parcela por fatura consecutiva (a diferença de centavos vai na primeira); cada parcela tem a data da compra deslocada mês a mês (dia limitado ao fim do mês). Parcela: dá para editar valor (de cada parcela), descrição, categoria e necessidade, e excluir, sempre com a escolha **só esta parcela** ou **esta e as seguintes** (a data, e portanto a fatura, não muda). Compra à vista no cartão pode ter valor, descrição e categoria editados, mas não conta nem data (a data define a fatura).
- **Estorno** na fatura é um lançamento `adjustment` positivo com `invoiceId` na conta do cartão (reduz o total; não é receita nem despesa, e o CHECK impede `expense` positivo). **Juros e encargos** são `expense` com `invoiceId`. Ambos são lançados pela tela do cartão (`addInvoiceAdjustment`). Relatórios de gasto por categoria (Fase 4) devem abater estornos com categoria.

### Categorias (`categories`)
id, name, kind (`income` | `expense`), icon, color, parentId?, defaultNecessity?. Seed com categorias padrão brasileiras (Moradia, Energia, Internet, Educação, Mercado, Transporte, Saúde, Lazer, Assinaturas, Salário, Bônus, Rendimentos...).

### Recorrências (`recurrences`) e ocorrências (`occurrences`)
- `recurrences`: id, description, kind (`income` | `expense`), accountId, categoryId, necessity (`essential` | `optional`), amountCents (valor esperado), isVariableAmount (conta de luz varia; internet não), dayOfMonth, startMonth, endMonth?, active.
  Exemplos: salário, energia, internet, faculdade, aluguel, assinaturas.
- `occurrences`: id, recurrenceId, month (`YYYY-MM`), dueDate, expectedAmountCents, status (`planned` | `paid` | `skipped`), transactionId?.
- As ocorrências do mês corrente e do próximo são geradas de forma **idempotente** (unique em recurrenceId + month) ao abrir o app.
- Marcar como paga cria o lançamento real (com o valor real, que pode diferir do esperado) e vincula `transactionId`. Um lançamento capturado automaticamente também pode ser vinculado a uma ocorrência.
- Recorrência paga no cartão (ex.: assinatura) gera o lançamento na fatura certa.
- **Geração:** do `startMonth` até o mês seguinte (ou `endMonth`, se antes), de forma idempotente, ao abrir o app e ao criar/editar uma conta fixa. Quem fica meses sem abrir o app recupera os meses perdidos. `dayOfMonth` 31 em mês curto vira o último dia.
- **Projeção:** meses além dessa janela mostram as contas fixas ativas em vigor como "previstas", calculadas na hora (sem gravar). Abrir uma delas cria a ocorrência (`ensureOccurrence`), para poder pagar adiantado. Assim uma conta sem fim aparece em qualquer mês futuro.
- **"Atrasada" é derivado** (ocorrência `planned` com `dueDate` no passado), nunca gravado. Ocorrência paga mostra o valor real do lançamento ligado; pulada não conta em nenhum total.
- Editar a conta fixa reaplica valor e dia às ocorrências **ainda não pagas deste mês em diante**; desativar remove essas ocorrências (o que já foi pago fica). O tipo (receita/despesa) não muda depois de criada.
- Excluir o lançamento de uma ocorrência paga (pela lista ou por "Desfazer pagamento") devolve a ocorrência a `planned`.
- Receita não cai em cartão de crédito. O vínculo de um lançamento capturado automaticamente a uma ocorrência é da Fase 7.

### Investimentos
- MVP: contas `investment` com **snapshots de saldo** (`investment_snapshots`: accountId, date, balanceCents) mais aportes e resgates como transferências.
- Rendimento do período = saldo atual − saldo anterior − aportes + resgates.
- Depois: posições por ativo via Pluggy (`/investments`).

### Saldos e visão do mês
- Saldo da conta = initialBalance + soma dos lançamentos `confirmed` ativos (e `pending`, mostrados separadamente). Lançamentos com `deletedAt` não contam.
- **Patrimônio** = contas correntes + carteira + investimentos − faturas em aberto. **Contas `credit_card` ficam fora da soma de saldos** (a dívida já entra pelas faturas; somar os dois conta duas vezes).
- **Visão do mês** (aba Mês, `getMonthOverview`): receitas recebidas e despesas do mês, despesas por categoria (estornos abatem a categoria) e por necessidade, faturas a pagar e **saldo projetado no fim do mês** = saldo líquido de contas correntes e carteira (investimento fora) + receitas fixas que faltam − contas fixas que faltam − faturas não pagas com vencimento até o fim do mês (atrasadas incluídas). O saldo projetado só aparece no mês corrente.
- Compra no cartão conta como despesa na **data da compra** (parcelado: uma parcela por mês); pagar fatura é transferência e não entra, então nada conta duas vezes. A regra pura está em `src/domain/overview.ts`.
- **Patrimônio** aparece no topo da aba Contas. Dívida de cartão = restante das faturas até a aberta hoje; parcelas futuras ainda não são dívida.

## Captura automática
- **Notificações** (tempo real): o serviço nativo grava em `raw_notifications` (packageName, title, text, bigText, postedAt, parsed, parseError) direto no SQLite, sem depender do JS vivo. Pacotes: Nubank `com.nu.production`, Inter `br.com.intermedium`, confirmados no aparelho com `adb shell pm list packages`.
- Parsers reconhecem: compra no cartão (→ fatura), Pix enviado (→ despesa na conta), Pix recebido (→ receita). O resto é ignorado e fica só no bruto.
- **Parsers são escritos a partir de notificações reais capturadas**, com fixtures anonimizadas em `src/capture/parsers/__fixtures__`. Nunca invente o formato do texto.
- Lançamentos capturados entram como `pending` e sem categoria se não houver regra. Uma regra simples de categorização por estabelecimento (`merchant_rules`: pattern → categoryId) é aprendida quando o usuário categoriza.
- **Pluggy** (conector MeuPluggy, gratuito para uso pessoal): sincroniza contas, cartões, transações e investimentos. Não é tempo real. Em cartão, valor positivo na Pluggy = compra (inverter para o nosso sinal). MeuPluggy não suporta `GET /items`, então guarde o `itemId`.
- **Conciliação**: case um lançamento `pending` com uma transação da Pluggy da mesma conta quando o valor for igual e a data estiver dentro de ±2 dias, desempatando pela similaridade do estabelecimento. Ao casar, confirme e atualize o existente em vez de duplicar. Deduplique sempre por `pluggyTransactionId`.

## Regras gerais
- **Dinheiro sempre em centavos inteiros.** Nunca float. Formate com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Datas salvas em ISO; o cálculo de fatura e de mês usa o fuso `America/Sao_Paulo`.
- Excluir é soft delete (`deletedAt`), toda consulta filtra por ele, e apagar uma perna de transferência apaga as duas. Índices únicos (ex.: `pluggyTransactionId`) valem só para linhas não apagadas.
- Editar ou excluir lançamento parcelado pergunta se aplica só nesta parcela ou nas seguintes.
- Credenciais nunca em logs, no repositório ou no código.
- Backup: exportar e importar o banco (arquivo `.db`) pela tela de Backup, já implementado com `expo-file-system`. Importar guarda antes uma cópia (`financeiro-before-import.db`) e recarrega o app. Os dados só existem no aparelho: desinstalar o app ou limpar os dados apaga tudo.
- Uso pessoal: não adicione multiusuário, login ou backend sem pedir.

## Convenções do código
- **Mensagens ao usuário são em português** e vêm de `UserError` (`src/domain/errors.ts`). A UI mostra só a mensagem de `UserError`; qualquer outro erro vira "Algo deu errado" e vai para o log. Mensagens de validação ficam no domínio, não nas telas.
- **Entrada de dinheiro é em centavos**: só dígitos, "10" vira 0,10 e "1023" vira 10,23 (`MoneyField`, `centsFromTyped`). Não existe parser de texto livre.
- **Tema escuro apenas** (`userInterfaceStyle: dark`). Cores em `src/ui/theme.ts`; use o `Text` de `src/ui/form.tsx`, não o do React Native (o padrão dele é preto).
- **Fora de escopo de UX:** acessibilidade para leitor de tela (uso pessoal), haptics e tema claro. O plano de melhorias de UI está em `docs/ux-review.md`.
- Pendências e backlog conhecidos ficam em `docs/backlog.md`; ao deixar algo para depois, registre lá.
- IDs são UUID v4 gerado em JS (`src/db/id.ts`), sem módulo nativo.
- `src/db/schema.ts` é carregado pelo `drizzle-kit` em Node puro: **não importe módulo nativo ou do React Native nele**. Gere migrations com `npx drizzle-kit generate`.
- Telas leem o banco de forma síncrona; consultas que dependem de migration só rodam depois que o layout raiz confirma as migrations (nunca no nível do módulo).
- Serviços (`src/services`) validam contra o banco e inserem; a regra pura vive em `src/domain` com teste. O Jest roda em Node e não carrega o `expo-sqlite`, então serviço se valida no aparelho.
- O Windows/Git Bash tem pegadinhas: não deixe `python -` esperando stdin e evite heredocs com aspas misturadas em comandos longos.

## Fluxo de trabalho
- Passos pequenos, e cada fase rodando no aparelho antes da próxima.
- Antes de dar uma tarefa por pronta: `npx tsc --noEmit`, `npm test` e build Android se mexeu em nativo.
- Toda regra nova em `src/domain` vem com teste.
- Se faltar uma decisão de produto, pergunte em vez de assumir.
