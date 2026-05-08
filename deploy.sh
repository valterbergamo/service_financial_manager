#!/bin/bash

set -e

TARGET=$1
MSG=$2

if [ -z "$TARGET" ]; then
  echo "❌ Informe a branch: dev | qas | main"
  exit 1
fi

echo "🎯 Branch alvo: $TARGET"

git fetch origin

# =========================
# 🔧 DEV = só commit
# =========================
if [ "$TARGET" == "dev" ]; then
  echo "🔧 Commitando na dev..."

  git checkout dev
  git pull origin dev

  git add -A
  git commit -m "$MSG" || echo "⚠️ Nada para commitar"

  git push origin dev

  echo "✅ Dev atualizado"
fi

# =========================
# 🧪 QAS = merge dev → qas
# =========================
if [ "$TARGET" == "qas" ]; then
  echo "🧪 Atualizando QAS com DEV..."

  git checkout qas
  git merge dev

  git push origin qas
  git checkout dev

  echo "✅ QAS atualizado"
fi

# =========================
# 🚀 MAIN = merge dev → main (com validação)
# =========================
if [ "$TARGET" == "main" ]; then
  echo "🚀 Validando antes de atualizar MAIN..."

  git fetch origin

  echo "🔎 Comparando DEV vs QAS..."

  if ! git diff --quiet origin/dev origin/qas; then
    echo "❌ Bloqueado: DEV e QAS estão diferentes"
    echo "👉 Rode primeiro: ./deploy.sh qas"
    exit 1
  fi

  echo "✅ DEV e QAS estão sincronizadas"

  echo "🔀 Atualizando MAIN com DEV..."

  git checkout main
  git merge dev
  git push origin main
  git checkout dev

  echo "✅ MAIN atualizada com sucesso"
fi

echo "🏁 Processo finalizado!"