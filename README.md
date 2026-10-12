# Financeiro

App Android **pessoal** (um único usuário) para controlar toda a vida financeira: receitas, despesas, contas, cartões de crédito com faturas, contas fixas recorrentes e investimentos. Os lançamentos podem ser manuais ou automáticos (notificações dos bancos e Open Finance via Pluggy).

> Em desenvolvimento. Status atual: **Fase 0 (setup)**. O plano completo está em [HANDOFF.md](HANDOFF.md).

## Stack

- React Native + Expo (SDK 57) com **Development Build** (o Expo Go não funciona, há código nativo)
- TypeScript estrito
- expo-sqlite + Drizzle ORM (local-first, sem backend)
- expo-router, Zustand, TanStack Query (só para a Pluggy)
- expo-secure-store para credenciais
- Módulo Expo local em Kotlin (`modules/notification-listener`)
- Jest para testes de domínio e parsers

## Estrutura

```
app/                            # telas (expo-router)
modules/notification-listener/  # Kotlin (NotificationListenerService)
src/
  db/                           # schema Drizzle, migrations, client, seeds
  domain/                       # regras puras e testadas: faturas, parcelas, recorrências, saldos
  services/                     # casos de uso
  capture/parsers/              # notificação -> evento parseado
  sync/pluggy/                  # cliente da API e conciliação
  store/                        # Zustand
  ui/                           # componentes
```

Regra: a lógica financeira fica em `src/domain`, em funções puras. As telas não calculam saldo, fatura nem projeção. Dinheiro é sempre em centavos inteiros.

## Pré-requisitos (Windows)

- Node.js 20+ e npm
- JDK 17 (`JAVA_HOME`)
- Android Studio com SDK instalado (`ANDROID_HOME`; `platform-tools` no `PATH`)
- Aparelho Android com depuração USB ativada (`adb devices` deve listá-lo)

## Como rodar

```bash
npm install
npx expo run:android   # compila e instala o development build no aparelho
npx expo start         # depois, para o servidor de desenvolvimento
```

Rode `npx expo prebuild --clean` após mexer em código nativo ou em config plugin. A pasta `android/` é gerada e não é versionada.

## Verificação

```bash
npx tsc --noEmit
npm test
```

## Documentação do projeto

- [CLAUDE.md](CLAUDE.md): modelo de domínio, regras e convenções
- [HANDOFF.md](HANDOFF.md): contexto e plano por fases
