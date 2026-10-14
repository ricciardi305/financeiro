# Revisão de UX/UI

Revisão das telas da Fase 1 (contas, lançamentos, lista, backup), feita em 2026-10-13. Os lotes A, B e C foram aplicados em 2026-10-13.

## Escopo e decisões
- **Só Android**, aparelho pessoal. Regras de iOS ficam de fora.
- **Só tema escuro** (decisão já registrada no `CLAUDE.md`).
- **Sem acessibilidade para leitor de tela.** O app é de uso pessoal e o usuário não usa leitor de tela, então papéis, rótulos e estados de acessibilidade (`accessibilityRole`, `accessibilityLabel`, `accessibilityState`) **não** entram no plano. Legibilidade e conforto de toque (contraste e tamanho dos alvos) continuam, porque afetam o uso normal.
- **Sem haptics.** Exigiria o módulo nativo `expo-haptics` e recompilar o app; o ganho não compensa agora.
- Tudo é JavaScript e recarrega pelo Metro, sem rebuild.
- Gravidade na escala de Nielsen: 1 cosmético, 2 menor, 3 maior, 4 impede a tarefa.

## Problemas encontrados

| # | Gravidade | Problema | Princípio | Lote |
|---|---|---|---|---|
| 1 | 3 | O botão **Salvar** fica no fim do formulário. Em telas longas (cartão, lançamento com categorias) cai abaixo da dobra e atrás do teclado. | Visibilidade; Fitts | C |
| 2 | 3 | A **lista de lançamentos abre com um muro de chips**: 14 categorias mais as contas ocupam a tela antes do primeiro lançamento. | Hick; Miller | C |
| 3 | 3 | A **navegação principal é uma fileira de botões** na tela inicial. No Android o padrão é uma barra de abas. | Jakob | B |
| 4 | 2 | **Alvos de toque pequenos**: os chips têm cerca de 36 dp; o recomendado é 44 a 48 dp. | Fitts | A |
| 5 | 2 | **Contraste do placeholder** (`#64748b` sobre a superfície) em torno de 3,6:1; o mínimo de legibilidade é 4,5:1. | Legibilidade | A |
| 6 | 2 | **Estados vazios sem ação.** "Nenhuma conta ainda." e "Nenhum lançamento neste filtro." não oferecem o próximo passo. | Padrão de estado vazio | A |
| 7 | 2 | **Sem confirmação ao salvar.** A tela só fecha, sem aviso. | Visibilidade do status | A |
| 8 | 1 | Sem **ondulação (ripple)** do Android ao tocar. | Feedback nativo | A |
| 9 | 1 | **Saldo negativo** com a mesma cor do positivo. | Hierarquia visual | A |
| 10 | 1 | **Espaçamentos soltos** (10, 12, 14, 16) sem uma escala. | Consistência | A |

Observação: excluir segurando o item na lista é invisível, mas já existe o botão **Excluir** na tela de edição, então não é um problema aberto.

## Plano em três lotes

Ordem sugerida: A, B, C. Em cada lote rodar `npx tsc --noEmit` e `npm test`, e validar no aparelho antes do próximo.

### Lote A: ajustes rápidos (baixo risco)
- **Alvos de toque:** chips e botões com altura mínima de 48 dp; botões de mês (‹ ›) com área de toque maior.
- **Contraste:** subir `colors.placeholder` em `src/ui/theme.ts` para pelo menos 4,5:1 sobre `colors.surface`.
- **Estados vazios:** "Nenhuma conta ainda" com botão **Criar conta**; lista vazia com botão **Novo lançamento**.
- **Aviso ao salvar:** `ToastAndroid` (já vem no React Native, sem módulo novo), por exemplo "Lançamento salvo".
- **Ripple:** `android_ripple` nos `Pressable` de `src/ui/form.tsx` e das listas.
- **Saldo negativo** em `colors.expense` na lista de contas.
- **Escala de espaçamento** (`spacing.xs/sm/md/lg/xl`, grade de 4/8) em `src/ui/theme.ts`, usada no lugar dos números soltos.

Pronto quando: nenhum alvo de toque abaixo de 48 dp, placeholder legível, salvar mostra o aviso, e telas vazias levam à ação.

### Lote B: navegação por abas
- Trocar a pilha atual por **abas** (expo-router): **Contas | Lançamentos | Backup**.
- Ações no cabeçalho de cada aba: **+** em Contas (nova conta) e **+** em Lançamentos (novo lançamento). Some a fileira de botões da tela inicial.
- Telas de formulário continuam abrindo por cima das abas, com o botão de voltar.

Pronto quando: dá para chegar a qualquer tela principal em um toque e a tela inicial não tem mais botões de navegação.

### Lote C: formulários e filtros
- **Salvar fixo** na parte de baixo da tela, sempre visível.
- **Teclado:** o campo em foco não pode ficar coberto (`KeyboardAvoidingView` com comportamento por plataforma, ou `ScrollView` com ajuste).
- **Foco inicial** no campo de valor ao abrir "Novo lançamento".
- **Filtros recolhidos:** um controle único "Filtros" (conta e categoria) em vez de duas fileiras de chips; mostrar só o resumo do filtro ativo. Opção: chips numa única linha com rolagem horizontal.

Pronto quando: o Salvar nunca fica atrás do teclado, e o primeiro lançamento aparece sem rolar a tela.

## Fora de escopo (por decisão)
- Leitor de tela e rótulos de acessibilidade.
- Haptics (`expo-haptics`).
- Tema claro ou automático.
- Regras específicas de iOS.

## Referências usadas
Heurísticas de Nielsen e leis de UX (Hick, Miller, Fitts, Jakob), aplicadas com as skills `design-critique` e `native-feel`. Onde elas conflitaram com o `CLAUDE.md`, valeu o `CLAUDE.md`.

## Notas da implementação
- O `KeyboardAvoidingView` não funcionou neste aparelho (Android com tela cheia não encolhe a janela). O rodapé fixo usa `src/ui/useKeyboardLift.ts`, que mede a sobreposição com o teclado e sobe a tela só o necessário.
- As abas usam `@expo/vector-icons` (só JavaScript, sem rebuild).
- Os filtros da lista ficam em `src/ui/FilterSheet.tsx`.
