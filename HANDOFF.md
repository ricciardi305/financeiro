# Handoff — App de finanças pessoais

Cole este texto no Claude Code, numa pasta nova com o `CLAUDE.md` já na raiz.

---

## Contexto
Quero um app Android **pessoal** (só eu uso) para controlar toda a minha situação financeira:
- **Lançamentos**: receitas (salário, bônus) e despesas (Pix, débito, dinheiro).
- **Cartões de crédito** (Nubank e Inter) com **faturas**: cada compra cai automaticamente na fatura certa pelo dia de fechamento, com suporte a parcelamento e a pagar a fatura pela conta corrente.
- **Contas fixas e recorrentes** do mês (energia, internet, faculdade, assinaturas, salário), classificadas como **obrigatórias ou opcionais**, com previsto x pago.
- **Investimentos**: saldo das contas de investimento, aportes, resgates e rendimento.
- **Visão do mês e patrimônio**: quanto entrou, quanto saiu, gastos por categoria, o que ainda falta pagar e saldo projetado no fim do mês.
- **Captura automática**: notificações push do Nubank/Inter (compra no cartão e Pix, em tempo real) e Open Finance pela **Pluggy** (conector MeuPluggy, gratuito para uso pessoal) para confirmar e completar os dados.

O modelo de domínio, a stack e as regras estão no `CLAUDE.md`. Eu desenvolvo no Windows (sem WSL) e testo num Android físico.

## Plano por fases
Cada fase precisa rodar no aparelho antes da próxima. O app tem que ser útil com lançamento manual antes de qualquer automação.

**Fase 0 — Setup**
- Projeto Expo com TypeScript, expo-router, Development Build, Drizzle + expo-sqlite com migrations e Jest.
- Me passe o checklist do que instalar no Windows (JDK, Android Studio, SDK, variáveis de ambiente, ADB) e rode `npx expo run:android` no aparelho.

**Fase 1 — Base: contas, categorias e lançamentos manuais**
- Schema de `accounts`, `categories` (com seed), `transactions`.
- CRUD de contas (corrente, cartão, investimento, carteira) e de lançamentos: receita, despesa e transferência (duas linhas ligadas).
- Saldo por conta e lista de lançamentos com filtro por mês, conta e categoria.

**Fase 2 — Cartões e faturas**
- `invoices` e a função pura que decide a fatura pela data da compra e o dia de fechamento (testes com virada de mês/ano e meses curtos).
- Compra parcelada gerando parcelas nas faturas futuras.
- Tela do cartão: fatura atual, próximas, fechadas; pagar fatura (total ou parcial) pela conta corrente.

**Fase 3 — Recorrências**
- `recurrences` + `occurrences` com geração idempotente do mês atual e do próximo.
- Tela de contas do mês: previstas, pagas e atrasadas, separadas por obrigatória/opcional. Marcar como paga com o valor real.

**Fase 4 — Visão do mês e patrimônio**
- Dashboard: receitas x despesas, gastos por categoria, obrigatório x opcional, faturas a vencer, saldo projetado no fim do mês e patrimônio total.

**Fase 5 — Investimentos**
- Snapshots de saldo, aportes/resgates como transferência e rendimento do período.

**Fase 6 — Captura de notificações (bruto)**
- Módulo Kotlin com `NotificationListenerService` via config plugin, tela de permissão, filtro pelos pacotes do Nubank e do Inter, gravação em `raw_notifications` mesmo com o app fechado e tela de debug com exportação em JSON.
- **Pare aqui:** eu faço compras e Pix, exporto as notificações reais e te mando as amostras.

**Fase 7 — Parsers e categorização**
- Parsers do Nubank e do Inter a partir das amostras (compra no cartão, Pix enviado, Pix recebido), com testes.
- Lançamentos `pending` na conta/fatura certa, caixa de entrada para revisar e categorizar, e regras por estabelecimento.

**Fase 8 — Pluggy**
- Configuração de credenciais no SecureStore, cliente da API, vínculo das contas da Pluggy com as do app, sync manual e ao abrir, conciliação e deduplicação conforme o `CLAUDE.md`. Sync de saldos de investimento.

**Depois:** orçamento por categoria, metas, alertas (fatura vencendo, limite, conta atrasada) e backup automático.

## Primeiro passo
Leia o `CLAUDE.md`, confirme o modelo de domínio e aponte riscos ou decisões em aberto antes de começar. Depois inicie a **Fase 0**.
