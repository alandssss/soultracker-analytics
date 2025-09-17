#!/bin/bash
# Script para regenerar el build estático del frontend y recargar nginx

echo "🔄 Regenerando build estático del frontend..."
cd /app/frontend

# Generar build estático
npx expo export -p web

echo "✅ Build estático generado en /app/frontend/dist/"

# Recargar nginx para servir el nuevo build
echo "🔄 Recargando nginx..."
supervisorctl restart nginx

echo "✅ nginx recargado con el nuevo build"
echo "🌐 Aplicación disponible en https://analytic.soullatino.mx/"
echo ""
echo "📊 Servicios activos:"
supervisorctl status