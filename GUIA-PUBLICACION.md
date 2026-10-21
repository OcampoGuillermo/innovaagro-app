# Guía de publicación

Esta guía deja InnovaAgro-App lista para salir de la computadora. La app
**no se publica como sitio estático**: necesita Node.js, una API y una base
SQLite con disco persistente.

## 1. Antes de tocar el servidor

Revisá estos puntos. No son opcionales si la app va a recibir personas reales.

- [ ] Reemplazar productores, productos, precios, stock, rutas y puntos de
      retiro de ejemplo por datos reales.
- [ ] Configurar el WhatsApp de cada productor desde su panel.
- [ ] Reemplazar las fotos de referencia por fotos propias o verificar la
      atribución de cada licencia.
- [ ] Publicar una política de privacidad con un correo de contacto.
- [ ] Definir quién administra la base, los respaldos y las cuentas.
- [ ] No presentar el catálogo inicial como oferta comercial real.
- [ ] Confirmar que el pago se coordina por WhatsApp y que la app no cobra.
- [ ] Cambiar o eliminar las cuentas demo antes de abrir al público.

## 2. Probar en local

Requisitos: Node.js 24 o superior, npm y un navegador actualizado.

```bash
npm install
npm start
```

Abrí <http://localhost:3000>. La base se crea en `data/innovaagro.db` y las
fotos subidas en `public/uploads/`.

Verificación mínima:

```bash
npm run check
curl http://localhost:3000/api/health
```

La respuesta de salud debe incluir `"ok": true`.

### Cuentas iniciales

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Compradora | `demo@innovaagro.app` | `demo1234` |
| Productor | `finca@innovaagro.app` | `demo1234` |

También existen cuentas para `cooperativa`, `apiario`, `quesos`, `huerta`,
`artesanas`, `frutas`, `ribera` y `verde`, todas `@innovaagro.app` con la misma
contraseña.

## 3. Instalación real sin datos de ejemplo

Para una instalación nueva y limpia, definí las variables **antes del primer
arranque**:

```bash
SEED_CATALOG=false
SEED_DEMO=false
DATA_DIR=/ruta/persistente/innovaagro
UPLOADS_DIR=/ruta/persistente/innovaagro/uploads
```

- `SEED_CATALOG=false` evita cargar los 9 productores y 23 productos de ejemplo.
- `SEED_DEMO=false` evita crear cuentas, pedidos iniciales y contraseñas demo.
- Si ya existe una base, cambiar estas variables no borra nada. Para empezar de
  cero hay que detener el servidor y vaciar `DATA_DIR`.

Con la app vacía, creá una cuenta desde **Crear cuenta → Soy productor**. El
registro crea el perfil y el panel para cargar el primer producto. Las cuentas
de comprador se crean desde la pantalla de registro.

### Rutas, puntos y cursos

Las categorías, localidades, rutas, puntos de retiro y cursos viven en:

- `shared/catalog.json` (categorías, ciudades, rutas, puntos).
- `shared/courses.json` (cápsulas de capacitación).

Editalos antes de publicar y reiniciá el servidor. Los usuarios, productos y
pedidos reales no se guardan en esos JSON: viven en SQLite.

## 4. Variables de entorno

| Variable | Valor recomendado | Efecto |
| --- | --- | --- |
| `PORT` | el que asigne el hosting | Puerto HTTP. |
| `DATA_DIR` | volumen persistente | Base `innovaagro.db`. |
| `UPLOADS_DIR` | volumen persistente | Fotos subidas por productores. |
| `SEED_CATALOG` | `false` en producción | No carga catálogo de ejemplo. |
| `SEED_DEMO` | `false` en producción | No crea cuentas ni pedidos demo. |
| `COOKIE_SECURE` | `true` con HTTPS | Cookie de sesión solo por HTTPS. |
| `TRUST_PROXY` | `true` detrás de proxy | Respeta `X-Forwarded-*`. |
| `NODE_ENV` | `production` | Activa caché de assets. |

Copiá `.env.example` a `.env` y completá los valores. `npm start` y
`npm run dev` cargan `.env` si existe. En hosting también podés cargar las
variables desde el panel del proveedor.

**Nunca subas `.env` al repositorio.**

## 5. Hosting: qué necesitás

La app requiere:

1. Un proceso Node que quede encendido.
2. Un volumen o disco persistente para `DATA_DIR` y `UPLOADS_DIR`.
3. HTTPS en el dominio público.
4. Capacidad de ejecutar `npm start` o el `Dockerfile` incluido.

Opciones razonables:

- **Render / Railway / Fly.io:** simples, pero hay que montar un volumen y
  apuntar `DATA_DIR` y `UPLOADS_DIR` ahí. Sin volumen, cada despliegue borra la
  base y las fotos.
- **VPS (Ubuntu/Debian):** más control. Usá systemd o Docker, Nginx como proxy
  inverso y Certbot para HTTPS.
- **Docker:** el `Dockerfile` del proyecto usa Node 24 y deja dos volúmenes,
  `/app/data` y `/app/uploads`.

No sirven para el backend:

- GitHub Pages.
- Netlify/Vercel en modo estático.
- Floot Storage con archivos `.html`.
- Cualquier hosting serverless con filesystem efímero, salvo que uses una base
  externa y almacenamiento externo (no es el caso de esta versión).

## 6. Publicar con Docker

```bash
docker build -t innovaagro .
docker run -d --name innovaagro \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATA_DIR=/app/data \
  -e UPLOADS_DIR=/app/uploads \
  -v innovaagro-data:/app/data \
  -v innovaagro-uploads:/app/uploads \
  innovaagro
```

Comprobá:

```bash
curl http://localhost:3000/api/health
```

Para una instalación limpia, agregá `-e SEED_CATALOG=false -e SEED_DEMO=false`
**en el primer arranque**. Si el volumen ya tiene datos, esas variables no los
borran.

## 7. HTTPS, cookies y proxy

Con un proxy inverso (Nginx, Caddy, Render, Railway):

```bash
COOKIE_SECURE=true
TRUST_PROXY=true
NODE_ENV=production
```

La cookie de sesión es `HttpOnly`, `SameSite=Lax` y dura 30 días. Con
`COOKIE_SECURE=true` solo viaja por HTTPS. Si probás en `http://localhost` y
activás esa variable, el navegador no enviará la cookie: usala solo con HTTPS.

Ejemplo mínimo de Nginx:

```nginx
server {
  listen 443 ssl;
  server_name mercado.ejemplo.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    client_max_body_size 8m;
  }
}
```

El límite de subida es 6 MB por imagen. El servidor valida el tipo real del
archivo (JPG, PNG o WebP) y lo guarda con un nombre aleatorio.

## 8. Base, respaldos y restauración

La base está en `DATA_DIR/innovaagro.db` y usa WAL (`-wal`, `-shm`). Para una
copia consistente:

1. Detené el proceso, o usá la herramienta de backup de SQLite.
2. Copiá toda la carpeta `DATA_DIR`.
3. Copiá `UPLOADS_DIR`.
4. Guardá las copias fuera del servidor, con fecha.
5. Probá restaurar en una máquina aparte antes de confiar en el respaldo.

Programá una copia diaria como mínimo. Si el hosting no permite detener el
proceso, usá `sqlite3` con `.backup` o un snapshot del volumen.

Para restaurar:

1. Detené la app.
2. Reemplazá `DATA_DIR` y `UPLOADS_DIR` por la copia.
3. Arrancá y verificá `/api/health`, login, catálogo y un pedido.

No edites la base con la app corriendo. No borres `-wal` o `-shm` a mano sin
entender el estado de SQLite.

## 9. GitHub

El proyecto no necesita GitHub para funcionar, pero es útil para versionar y
desplegar. Desde la carpeta del proyecto:

```bash
git init
git add .
git commit -m "InnovaAgro-App: marketplace con backend y PWA"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/innovaagro-app.git
git push -u origin main
```

El `.gitignore` excluye `node_modules/`, `data/`, `public/uploads/`, `.env` y
las capturas de desarrollo. **No subas la base con datos reales.** Si el
proveedor despliega desde GitHub, configurá las variables y el volumen en su
panel, no en el repositorio.

## 10. Floot (Android / iOS)

Floot sirve para envolver la web publicada en una app nativa. No ejecuta Node.
Por eso:

1. Publicá primero el backend con HTTPS.
2. Verificá que la URL pública abra la app y que el login funcione.
3. En Floot, creá una app **Website / WebView**.
4. Pegá la URL, por ejemplo `https://mercado.ejemplo.com`.
5. Nombre: **InnovaAgro-App**.
6. Icono: el medallón del proyecto (`public/assets/icon-512.png`).
7. Color de tema: `#132c2a`.
8. Generá el APK/AAB de Android y el proyecto iOS.

La app nativa solo abre el sitio. Las cuentas, pedidos, fotos y stock viven en
el servidor. Si el servidor se cae, la app muestra la última copia offline del
catálogo, pero no puede registrar pedidos nuevos.

También podés evitar Floot y usar la PWA: en Android, **Instalar app** desde el
perfil; en iPhone, **Compartir → Agregar a pantalla de inicio**.

## 11. Seguridad y límites actuales

Implementado:

- Contraseñas con `scrypt` y salt.
- Sesiones con cookie `HttpOnly`, `SameSite=Lax` y expiración.
- Validación de origen en escrituras.
- Rate limit de login (20 intentos por IP cada 15 minutos).
- CSP y cabeceras básicas.
- Validación de stock y precios en el servidor.
- Pedidos en transacción; el stock se descuenta al confirmar y se repone si el
  productor cancela un pedido real.
- Exportación de datos de la cuenta.

No incluido en esta versión:

- Cobros online, pasarela de pago o split de pagos.
- Recuperación de contraseña por correo.
- Verificación de email o teléfono.
- Panel de administración global.
- Notificaciones push.
- Seguimiento logístico en tiempo real.
- Facturación electrónica.
- Borrado automático de cuentas inactivas.

Para una operación real, definí una política de retención de datos y un canal de
soporte. El servidor no envía correos: si necesitás recuperación de contraseña,
hay que agregar un proveedor de email y un flujo con token.

## 12. Prueba final antes de abrir

- [ ] `/api/health` responde.
- [ ] HTTPS válido y cookie `Secure` funcionando.
- [ ] Registro de comprador y de productor.
- [ ] Login y logout en móvil y escritorio.
- [ ] Recuperar la app después de cerrar el navegador.
- [ ] Catálogo con datos reales y stock correcto.
- [ ] Pedido de prueba con retiro y con envío.
- [ ] Pedido visible en el panel del productor.
- [ ] Cambio de estado `nuevo → preparando → en_ruta → entregado`.
- [ ] Cancelación con reposición de stock.
- [ ] WhatsApp abre con el mensaje correcto.
- [ ] Offline: última copia visible; pedido nuevo bloqueado con aviso.
- [ ] Instalación PWA y botón atrás de Android.
- [ ] Respaldos automáticos y restauración probada.
- [ ] Cuentas demo desactivadas o contraseñas cambiadas.

## 13. Problemas frecuentes

**La app funciona pero no guarda usuarios ni pedidos.** El hosting no tiene
disco persistente o `DATA_DIR` apunta a una carpeta efímera.

**Las fotos desaparecen después de un despliegue.** `UPLOADS_DIR` no está en un
volumen persistente o se está usando la carpeta dentro de la imagen.

**El login no persiste detrás de HTTPS.** Falta `COOKIE_SECURE=true` o
`TRUST_PROXY=true`, o el proxy no envía `X-Forwarded-Proto`.

**La app se ve vieja después de actualizar.** Subí la versión de `public/sw.js`
(cambiar `VERSION`), recargá y verificá que el service worker nuevo tome el
control. Los assets se cachean; el HTML y el manifest van sin caché.

**El pedido dice que no hay stock.** Otro comprador confirmó antes o el
productor cambió el stock. La validación se hace al confirmar, no solo al abrir
la ficha.

**Quiero empezar de cero.** Detené el servidor, hacé un respaldo y vaciá
`DATA_DIR` y `UPLOADS_DIR`. Al arrancar se crea una base nueva según
`SEED_CATALOG` y `SEED_DEMO`.
