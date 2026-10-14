# Pendências e backlog

Itens conhecidos que ficaram para depois, com o motivo e quando fazem sentido. Atualize ao fechar ou adicionar.

## Fase 2 (cartões e faturas): pendências

| Item | Situação atual | Quando fazer |
|---|---|---|
| **Confirmar a regra de fechamento do Nubank** | A regra "compra no dia do fechamento vai para a fatura seguinte" está confirmada só para o **Inter**. No Nubank a fatura é ajustável à mão (‹ › na tela de nova compra). | Na primeira fatura real do Nubank: conferir 2 ou 3 compras perto do corte e, se a regra for diferente, tornar a regra configurável por cartão. |
| **Alerta de fatura vencendo** | A tela mostra "Vencida", sem notificação. | Está em "Depois" no plano (alertas). Exige notificação local. |
| **Fatura em aberto no patrimônio** | A lista de Contas mostra o cartão como saldo negativo. | Fase 4 (visão do mês e patrimônio). |
| **Mudar a data de uma compra no cartão** | Bloqueado: a data define a fatura. | Se virar incômodo, permitir e recalcular a fatura (respeitando o ajuste manual). |

## Fase 3 (contas fixas): pendências

| Item | Situação atual | Quando fazer |
|---|---|---|
| **Vincular lançamento capturado a uma ocorrência** | Só se marca como paga pela tela da conta do mês. | Fase 7 (captura por notificação): ao chegar um Pix/compra, sugerir a ocorrência com mesmo valor e data próxima. |
| **Alerta de conta vencendo ou atrasada** | A tela destaca "Atrasada", sem notificação. | "Depois" do plano (alertas). |
| **Reajuste de valor com histórico** | Editar a conta fixa muda o valor das ocorrências futuras não pagas; não guarda histórico de reajustes. | Se virar necessário acompanhar variação (ex.: aluguel). |
| **Ocorrências retroativas** | Criar uma conta fixa com início no passado gera todas as ocorrências desde lá como previstas/atrasadas. | Se incomodar, perguntar "marcar meses passados como pulados". |

## Geral

| Item | Situação atual | Quando fazer |
|---|---|---|
| **Backup automático** | Só manual (exportar e importar o `.db`). Os dados existem apenas no aparelho. | "Depois" do plano. Avaliar lembrete periódico de backup. |
| **Aviso de dev do expo-router** | Ao abrir o app por link a frio no modo dev aparece "state update on a component that hasn't mounted yet". Vem do `useLinking` do próprio expo-router. | Ignorar; reavaliar ao atualizar o Expo. |
| **Ícones das abas** | Usam `@expo/vector-icons`. | Se algum ícone falhar em outro aparelho, trocar por texto. |
| **Regra de fatura por data de vencimento** | O vencimento usa "primeiro `dueDay` depois do fechamento". | Conferir com faturas reais dos dois bancos junto do item do Nubank. |
