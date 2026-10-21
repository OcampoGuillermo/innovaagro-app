# InnovaAgro-App

Mercado directo entre productores de Formosa y consumidores. La app incluye
catálogo de temporada, cuentas verificadas por correo, pedidos persistentes,
panel de productor, stock, perfiles públicos, favoritos, capacitación,
notificaciones push, comprobantes internos y un panel de administración.

Es una aplicación web con servidor propio: Node.js + Express + SQLite. Los
pagos online son reales cuando se configuran las credenciales de Mercado Pago;
sin credenciales la opción queda deshabilitada y la app lo informa.

## Requisitos

- Node.js **24 o superior** (usa `node:sqlite`).
- npm.
- Un navegador moderno.

## Arrancar en tu computadora

```bash
npm install
npm start
```

Abrí <http://localhost:3000>.

Para desarrollo con recarga del servidor:

```bash
npm run dev
```

La primera ejecución crea `data/innovaagro.db` y carga el catálogo inicial.
No hace falta configurar nada más.

## Cuentas de demostración

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Compradora | `demo@innovaagro.app` | `demo1234` |
| Productor | `finca@innovaagro.app` | `demo1234` |
| Administración | `admin@innovaagro.app` | `demo1234` |

Los nueve productores iniciales tienen cuenta con la misma contraseña:
`cooperativa@`, `apiario@`, `quesos@`, `huerta@`, `artesanas@`, `frutas@`,
`ribera@` y `verde@innovaagro.app`.

Estas cuentas y el catálogo inicial son contenido de demostración. Cambiá las
contraseñas o no las crees en una instalación real.

## Qué es real y qué es de ejemplo

- **Real en este servidor:** cuentas nuevas, verificación de correo,
  recuperación de contraseña, pedidos, stock, favoritos, perfiles, avance de
  capacitación, canasta, preferencias, suscripciones push y comprobantes
  internos en PDF.
- **Pago online real:** Checkout Pro de Mercado Pago. Se habilita solo con
  `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `PUBLIC_URL` HTTPS. El webhook
  confirma el pago y el stock ya quedó reservado al crear el pedido.
- **De ejemplo:** los nueve productores iniciales, los 23 productos, sus
  precios, las rutas, los puntos de retiro, los siete pedidos iniciales y las
  fotografías de referencia.
- **No incluido:** logística automática, facturación fiscal AFIP/ARCA y
  transferencias bancarias automáticas. Efectivo y transferencia se coordinan
  por WhatsApp y el administrador puede marcar el pago como verificado.
- **Comprobantes:** son documentos internos de venta. Dicen expresamente que
  no son factura fiscal. Para emitir facturas hace falta integrar AFIP/ARCA con
  certificados y datos del contribuyente.

Antes de abrirla al público, reemplazá los datos de ejemplo, cambiá la cuenta
administradora, configurá SMTP y Mercado Pago reales, revisá los créditos de las
fotos y publicá una política de privacidad con un contacto real.

## Funciones principales

**Comprador:** catálogo con búsqueda, filtros y orden; detalle con sello de
origen y lote; historias de productores; favoritos; canasta; retiro o envío;
pedidos divididos por productor; pago online o coordinado; comprobantes
internos; WhatsApp; rutas; capacitación; notificaciones push.

**Productor:** panel con métricas; alta y edición de productos; stock; pausa;
foto; pedidos y cambios de estado; perfil público y WhatsApp; comprobantes por
su parte del pedido; capacitación; constructor de pitch.

**Administración:** cuentas y permisos, verificación, suspensión, pedidos,
pagos manuales auditados, emisión de comprobantes, avisos push y auditoría.
Solo aparece para cuentas con `is_admin`.

**PWA:** se puede instalar en Android/iOS. El catálogo y la última copia de los
datos quedan disponibles sin conexión. Las acciones de cuenta, pedidos, stock y
pagos requieren conexión. El service worker maneja notificaciones push. Si
cambiás JavaScript, CSS o HTML, subí `VERSION` en `public/sw.js` para que los
dispositivos instalados descarguen el shell nuevo.

## Estructura

```text
public/            Frontend (SPA vanilla, CSS, PWA, imágenes)
server/            Express, SQLite, autenticación y API
shared/            Catálogo, rutas, cursos y pedidos iniciales (JSON)
data/              Base SQLite (se crea sola; no se versiona)
public/uploads/    Fotos subidas por productores (no se versionan)
tools/             Utilidades de desarrollo y pruebas; no es parte de la app
PRODUCT.md         Brief de producto y criterios de diseño
GUIA-PUBLICACION.md Guía de despliegue, respaldo y límites
```

## Variables de entorno

| Variable | Para qué sirve |
| --- | --- |
| `PORT` | Puerto HTTP. Por defecto `3000`. |
| `DATA_DIR` | Carpeta persistente de la base. Por defecto `data/`. |
| `UPLOADS_DIR` | Carpeta persistente de fotos subidas. Por defecto `public/uploads/`. |
| `SEED_CATALOG` | `false` evita cargar el catálogo de ejemplo en el primer arranque. |
| `SEED_DEMO` | `false` evita crear cuentas y pedidos de ejemplo. |
| `COOKIE_SECURE` | `true` agrega `Secure` a la cookie de sesión. Obligatorio con HTTPS. |
| `TRUST_PROXY` | `true` si hay un proxy inverso delante de Node. |
| `NODE_ENV` | `production` activa caché de assets estáticos. |
| `PUBLIC_URL` | URL pública HTTPS; se usa en correos y en la vuelta de Mercado Pago. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Crea o habilita una cuenta administradora al arrancar (contraseña de 10+ caracteres). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Envío real de verificación y recuperación. Sin `SMTP_HOST` los correos van a `DATA_DIR/mail-outbox.jsonl`. |
| `MAIL_FROM`, `MAIL_REPLY_TO` | Remitente y respuesta de los correos. |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Credenciales de Mercado Pago. Sin ambas, el pago online no se muestra. |
| `MP_SANDBOX` | `true` usa la inicialización de prueba de Mercado Pago. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Push. Si faltan, se genera un par y se guarda en `DATA_DIR/vapid.json`. |
| `STORE_*`, `INVOICE_PREFIX` | Datos del emisor y prefijo de los comprobantes internos. |

Copiá `.env.example` a `.env` para usarlas localmente. `.env` no se versiona.
Nunca subas tokens, contraseñas SMTP ni claves VAPID al repositorio.

### Correo en desarrollo

Sin SMTP configurado, cada enlace se agrega como una línea JSON en
`DATA_DIR/mail-outbox.jsonl`. Abrí ese archivo para copiar el enlace de
verificación o recuperación. La interfaz no afirma que el correo se haya
entregado: solo informa que quedó en la cola local.

### Mercado Pago

1. Creá una aplicación en Mercado Pago Developers y obtené el access token.
2. Configurá la URL de webhook `https://tu-dominio/api/payments/webhook`
   para el evento `payment`.
3. Definí `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `PUBLIC_URL` HTTPS.
4. Probá primero en sandbox con una cuenta de prueba compradora.

La app no inventa pagos: si falta una credencial, el método online queda
deshabilitado. El webhook valida la firma y actualiza el pedido; además el
comprador puede reintentar el pago desde el detalle.

## Verificación rápida

```bash
npm run check
curl http://localhost:3000/api/health
```

## Publicación

Seguí [GUIA-PUBLICACION.md](GUIA-PUBLICACION.md). Necesitás un hosting que
ejecute Node de forma continua y ofrezca disco persistente. GitHub Pages,
Netlify estático o cualquier hosting solo-estático **no** sirven para esta app,
porque la API y SQLite necesitan un proceso y un disco.

## Privacidad y seguridad

- Contraseñas con `scrypt`; sesiones con cookie `HttpOnly` y `SameSite=Lax`.
- Validación de origen para escrituras, CSP y límite de intentos de login,
  recuperación y envío de correos.
- Verificación de correo con tokens de un solo uso, hash en base y vencimiento.
- Los pedidos se validan contra stock y precios del servidor dentro de una
  transacción.
- Administración protegida por rol; suspensiones y pagos manuales quedan en la
  tabla de auditoría.
- Webhook de Mercado Pago con validación de firma y token del pago consultado
  contra la API.
- No se usan analítica, publicidad ni cookies de terceros.
- Hacé respaldos de `DATA_DIR` y de `UPLOADS_DIR` (por defecto `public/uploads/`).

Las fotografías provienen de Wikimedia Commons con licencias abiertas. Los
créditos están en `public/js/data.js` y en la pantalla **Acerca de**.
