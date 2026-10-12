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
- Rode `npx expo prebuild --clean` após mexer em nativo ou em config plugin.

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
Cartão também tem: closingDay, dueDay, limitCents?, paymentAccountId (conta que paga a fatura).

### Lançamentos (`transactions`)
Campos: id, accountId, **amountCents assinado** (negativo = saída da conta, positivo = entrada), kind (`income` | `expense` | `transfer` | `adjustment`), description, merchantRaw?, categoryId?, necessity? (`essential` | `optional`), occurredAt, status (`pending` | `confirmed`), source (`manual` | `notification` | `pluggy` | `recurrence`), invoiceId?, installmentGroupId?, installmentNumber?, installmentTotal?, transferGroupId?, occurrenceId?, pluggyTransactionId?, rawNotificationId?, notes?.

- **Receita** (salário, bônus): `income`, positivo, numa conta corrente.
- **Despesa Pix/débito**: `expense`, negativo, na conta corrente.
- **Compra no cartão**: `expense`, negativo, na conta do cartão, **sempre vinculada a uma fatura** (`invoiceId`).
- **Transferência** (pagar fatura, aplicar em investimento, resgatar, mover entre contas): duas linhas com o mesmo `transferGroupId`, uma negativa na origem e uma positiva no destino. **Transferência não conta como receita nem despesa** nos relatórios.
- **Parcelado**: gera N lançamentos, um por fatura futura, com o mesmo `installmentGroupId`. Divida o total em centavos e jogue a diferença de arredondamento na primeira parcela.

### Faturas (`invoices`)
Campos: id, cardAccountId, referenceMonth (`YYYY-MM`), closingDate, dueDate, status (`open` | `closed` | `paid` | `partially_paid`).
- A fatura de uma compra é definida pela data da compra versus o dia de fechamento: compra **no dia do fechamento ou depois** vai para a fatura seguinte. Isso fica numa função pura testada, incluindo virada de ano e meses curtos (dia 31 → último dia do mês).
- Total da fatura = soma dos lançamentos dela. Pagar fatura = transferência da conta pagadora para o cartão, vinculada à fatura. Pagamento parcial é permitido.

### Categorias (`categories`)
id, name, kind (`income` | `expense`), icon, color, parentId?, defaultNecessity?. Seed com categorias padrão brasileiras (Moradia, Energia, Internet, Educação, Mercado, Transporte, Saúde, Lazer, Assinaturas, Salário, Bônus, Rendimentos...).

### Recorrências (`recurrences`) e ocorrências (`occurrences`)
- `recurrences`: id, description, kind (`income` | `expense`), accountId, categoryId, necessity (`essential` | `optional`), amountCents (valor esperado), isVariableAmount (conta de luz varia; internet não), dayOfMonth, startMonth, endMonth?, active.
  Exemplos: salário, energia, internet, faculdade, aluguel, assinaturas.
- `occurrences`: id, recurrenceId, month (`YYYY-MM`), dueDate, expectedAmountCents, status (`planned` | `paid` | `skipped`), transactionId?.
- As ocorrências do mês corrente e do próximo são geradas de forma **idempotente** (unique em recurrenceId + month) ao abrir o app.
- Marcar como paga cria o lançamento real (com o valor real, que pode diferir do esperado) e vincula `transactionId`. Um lançamento capturado automaticamente também pode ser vinculado a uma ocorrência.
- Recorrência paga no cartão (ex.: assinatura) gera o lançamento na fatura certa.

### Investimentos
- MVP: contas `investment` com **snapshots de saldo** (`investment_snapshots`: accountId, date, balanceCents) mais aportes e resgates como transferências.
- Rendimento do período = saldo atual − saldo anterior − aportes + resgates.
- Depois: posições por ativo via Pluggy (`/investments`).

### Saldos e visão do mês
- Saldo da conta = initialBalance + soma dos lançamentos `confirmed` (e `pending`, mostrados separadamente).
- **Patrimônio** = contas correntes + carteira + investimentos − faturas em aberto.
- **Visão do mês**: receitas (realizadas e previstas), despesas por categoria e por necessidade (obrigatória x opcional), faturas a vencer, ocorrências pendentes e **saldo projetado no fim do mês** = saldo atual + receitas previstas − despesas previstas − faturas a vencer no mês.

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
- Excluir é soft delete, e editar lançamento parcelado pergunta se aplica só nesta parcela ou nas seguintes.
- Credenciais nunca em logs, no repositório ou no código.
- Backup: exportar e importar o banco (arquivo `.db` ou JSON) a partir das configurações. Os dados só existem no aparelho.
- Uso pessoal: não adicione multiusuário, login ou backend sem pedir.

## Fluxo de trabalho
- Passos pequenos, e cada fase rodando no aparelho antes da próxima.
- Antes de dar uma tarefa por pronta: `npx tsc --noEmit`, `npm test` e build Android se mexeu em nativo.
- Toda regra nova em `src/domain` vem com teste.
- Se faltar uma decisão de produto, pergunte em vez de assumir.
