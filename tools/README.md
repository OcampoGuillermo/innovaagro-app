# Herramientas de desarrollo

No forman parte de la aplicación y no se sirven desde el servidor.

- `shot.cjs`: capturas con Chrome headless. Requiere Chrome en Windows.
  `node tools/shot.cjs <nombre> '#/ruta' <ancho> <alto> <buyer|producer|guest> [viewport]`
- `e2e.cjs`: prueba de interfaz real con Chrome headless (login, canasta,
  checkout, historial, temporizador y modo offline). Crea un pedido de prueba;
  conviene ejecutarla sobre una base descartable y reiniciar los datos después.
- `api-smoke.cjs`: prueba destructiva de la API. Crea productos y pedidos y
  modifica stock. No ejecutar contra una base con datos reales.

Las capturas se guardan en `tools/shots/` y los perfiles temporales de Chrome
en `tools/chrome-profile*/`; ambas carpetas están ignoradas por Git.
