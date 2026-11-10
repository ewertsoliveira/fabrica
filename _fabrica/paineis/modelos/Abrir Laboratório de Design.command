#!/bin/bash
# Abre o Laboratório de Design. Funciona a partir da pasta onde este atalho está.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "O programa Node nao foi encontrado neste computador."
  echo "Peca ao agente para instalar ou conferir o Node e tente de novo."
  exit 1
fi

echo "Abrindo o Laboratorio de Design."
echo "Deixe esta janela aberta enquanto estiver usando. Para encerrar, feche esta janela."
node _fabrica/paineis/servidor.js
