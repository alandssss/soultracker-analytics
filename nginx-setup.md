# Configuración nginx para SoulTracker Analytics

## 🎯 Configuración Completada para Producción

### Stack de Servicios:
- **nginx** (puertos 80/443) → Servidor web con SSL
- **FastAPI Backend** (puerto 8001) → API REST
- **Expo Frontend** (archivos estáticos) → Aplicación React
- **MongoDB** (puerto 27017) → Base de datos
- **Expo Dev Server** (puerto 3000) → Desarrollo/móvil

### 🌐 Dominio Configurado:
**https://analytic.soullatino.mx**

### 📁 Estructura de Archivos:

```
/app/frontend/dist/          # Build estático del frontend
/etc/nginx/sites-available/soultracker  # Configuración nginx
/etc/supervisor/conf.d/nginx.conf       # Supervisor para nginx
/etc/ssl/certs/analytic.soullatino.mx.crt     # Certificado SSL
/etc/ssl/private/analytic.soullatino.mx.key   # Clave SSL
/app/backend/.env            # Variables de entorno backend
/app/build-frontend.sh       # Script para regenerar build
```

### 🔧 Configuración nginx:

#### Rutas Configuradas:
- **HTTP (puerto 80)** → Redirect automático a HTTPS
- **HTTPS (puerto 443)** → Servidor principal
- **/** → Sirve archivos estáticos del frontend (SPA routing)
- **/api/** → Proxy reverso al backend FastAPI (puerto 8001)
- **/health** → Health check del backend
- **/_expo/** → Assets estáticos con cache 1 año
- **/assets/** → Assets estáticos con cache 1 año

#### Funcionalidades SSL/HTTPS:
- ✅ Certificado SSL autofirmado para analytic.soullatino.mx
- ✅ Redirect automático HTTP → HTTPS
- ✅ TLS 1.2 y 1.3 habilitados
- ✅ Cifrados seguros configurados
- ✅ Logs de acceso y errores

### 🚀 Comandos Útiles:

```bash
# Ver estado de servicios
supervisorctl status

# Reiniciar nginx
supervisorctl restart nginx

# Regenerar build frontend
/app/build-frontend.sh

# Ver logs nginx
tail -f /var/log/nginx/analytic_soullatino_access.log
tail -f /var/log/nginx/analytic_soullatino_error.log

# Probar configuración nginx
nginx -t

# Probar endpoints
curl -k https://analytic.soullatino.mx/api/kpis
curl -k https://analytic.soullatino.mx/health
curl http://analytic.soullatino.mx/  # Debe redirigir a HTTPS
```

### 📊 URLs Disponibles:
- **Frontend Principal**: https://analytic.soullatino.mx/
- **Dashboard**: https://analytic.soullatino.mx/dashboard  
- **Upload**: https://analytic.soullatino.mx/upload
- **API Health**: https://analytic.soullatino.mx/health
- **API KPIs**: https://analytic.soullatino.mx/api/kpis

### 📊 Stack Final:
```
nginx (puertos 80/443) → {
  80 → REDIRECT a HTTPS
  443 → SSL/TLS Server {
    / → Frontend estático (Expo build)
    /api/* → Backend FastAPI (puerto 8001)
    /health → Backend health check
  }
}
MongoDB (puerto 27017)
Expo Dev (puerto 3000) - desarrollo móvil
```

### 🔄 Flujo de Actualización:

1. Modificar código frontend en `/app/frontend/app/`
2. Ejecutar `/app/build-frontend.sh`
3. nginx sirve automáticamente el nuevo build

### ⚙️ Variables de Entorno:

**Backend** (`/app/backend/.env`):
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=soultracker
```

### 📝 Notas Importantes:

- El frontend sirve archivos estáticos generados por `expo export`
- Las rutas API mantienen el prefijo `/api/` para el proxy
- SPA routing permite navegación directa a cualquier ruta
- Cache configurado para optimizar rendimiento
- Logs centralizados en `/var/log/nginx/`

## ✅ Estado: COMPLETADO Y FUNCIONANDO