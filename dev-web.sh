#!/bin/bash
# Script para iniciar o servidor de desenvolvimento web (sem Electron)
echo "Iniciando servidor de desenvolvimento web..."
npx vite --config vite.config.web.ts --host 0.0.0.0 --port 3000
