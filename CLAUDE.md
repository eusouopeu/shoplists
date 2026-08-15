# Instruções para o Claude neste repositório

## Agentes em segundo plano

Para tarefas independentes entre si e simples (ex.: pesquisas pontuais,
verificações isoladas, buscas no código que não bloqueiam o próximo passo),
pode usar agentes em segundo plano (background) em vez de executar tudo
sequencialmente na conversa principal. Reserve isso para tarefas de fato
simples e desacopladas — não usar para trabalho que dependa do resultado
imediato de outro passo, nem para o fluxo principal de implementação.

## Commit, push e build do APK após alterações de código

Toda vez que uma resposta gerar uma modificação no código do app (qualquer
arquivo em `src/`, `android/`, ou configuração que afete o build), ao final
da resposta deve ser feito, nesta ordem:

1. `git add` dos arquivos relevantes e `git commit` com mensagem descritiva.
2. `git push` para o repositório remoto (`origin`, GitHub).
3. Gerar um APK atualizado via `npm run cap:sync` seguido do build Gradle
   (`./gradlew assembleDebug` em `android/`, com o `JAVA_HOME` do JDK 21 —
   ver seção "Empacotando como APK" no README).

Isso não se aplica a mudanças que não sejam de código do app (ex.: apenas
conversas, planejamento, ou arquivos fora do repositório).
