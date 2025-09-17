#!/bin/bash
# Script de verificación para SoulTracker Analytics en HTTPS

echo "🔍 VERIFICACIÓN DE SOULTRACKER ANALYTICS"
echo "========================================"
echo ""

# Verificar servicios
echo "📊 SERVICIOS:"
supervisorctl status | grep -E "(nginx|backend|mongodb|expo)"
echo ""

# Verificar puertos
echo "🌐 PUERTOS NGINX:"
netstat -tlnp | grep nginx
echo ""

# Verificar certificados SSL
echo "🔒 CERTIFICADOS SSL:"
if [[ -f "/etc/ssl/certs/analytic.soullatino.mx.crt" ]]; then
    echo "✅ Certificado: OK"
    openssl x509 -in /etc/ssl/certs/analytic.soullatino.mx.crt -noout -dates
else
    echo "❌ Certificado: No encontrado"
fi
echo ""

# Pruebas de conectividad
echo "🌐 CONECTIVIDAD:"
echo "Testing https://analytic.soullatino.mx..."

# HTTP → HTTPS redirect
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://analytic.soullatino.mx/ 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "301" ]]; then
    echo "✅ HTTP→HTTPS Redirect: OK ($HTTP_CODE)"
else
    echo "❌ HTTP→HTTPS Redirect: FAIL ($HTTP_CODE)"
fi

# HTTPS Frontend
HTTPS_CODE=$(curl -s -k -o /dev/null -w "%{http_code}" https://analytic.soullatino.mx/ 2>/dev/null || echo "000")
if [[ "$HTTPS_CODE" == "200" ]]; then
    echo "✅ HTTPS Frontend: OK ($HTTPS_CODE)"
else
    echo "❌ HTTPS Frontend: FAIL ($HTTPS_CODE)"
fi

# HTTPS API
API_CODE=$(curl -s -k -o /dev/null -w "%{http_code}" https://analytic.soullatino.mx/api/ 2>/dev/null || echo "000")
if [[ "$API_CODE" == "200" ]]; then
    echo "✅ HTTPS API: OK ($API_CODE)"
else
    echo "❌ HTTPS API: FAIL ($API_CODE)"
fi

# HTTPS KPIs
KPI_CODE=$(curl -s -k -o /dev/null -w "%{http_code}" https://analytic.soullatino.mx/api/kpis 2>/dev/null || echo "000")
if [[ "$KPI_CODE" == "200" ]]; then
    echo "✅ HTTPS KPIs: OK ($KPI_CODE)"
else
    echo "❌ HTTPS KPIs: FAIL ($KPI_CODE)"
fi

echo ""
echo "🎯 URL PRINCIPAL: https://analytic.soullatino.mx/"
echo "📊 DASHBOARD: https://analytic.soullatino.mx/dashboard"
echo "📤 UPLOAD: https://analytic.soullatino.mx/upload"

# Verificar logs recientes
echo ""
echo "📝 LOGS RECIENTES (últimas 5 líneas):"
if [[ -f "/var/log/nginx/analytic_soullatino_access.log" ]]; then
    echo "--- Access Log ---"
    tail -5 /var/log/nginx/analytic_soullatino_access.log 2>/dev/null || echo "No hay logs de acceso"
fi

if [[ -f "/var/log/nginx/analytic_soullatino_error.log" ]]; then
    echo "--- Error Log ---"
    tail -5 /var/log/nginx/analytic_soullatino_error.log 2>/dev/null || echo "No hay logs de error"
fi

echo ""
echo "✅ Verificación completada"