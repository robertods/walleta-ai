# Walleta

PWA para administrar efectivo y gastos de un viaje a Japón. Los datos se guardan en el navegador.

## Desarrollo local

Requiere Node.js 24. Ejecutá `npm ci`. Si todavía no hay un código configurado, ejecutá
`npm run invite` para generar el código compartido y su verificador local. Después ejecutá
`npm run dev`.

## Código de invitación

Compartí de forma privada el código de `CODIGO-WALLETA.txt` con los viajeros. Cada teléfono
lo pide la primera vez y recuerda la activación en el almacenamiento del navegador.
El código y `.env.local` están ignorados por Git. Conservá una copia privada del código.

El sitio público contiene el verificador SHA-256. Esta barrera evita el acceso casual y una
persona con conocimientos técnicos puede eludirla. El navegador puede ofrecer instalar la PWA
antes de la activación. Las activaciones se guardan localmente, sin registro central.

Para probar la instalación y el modo offline, ejecutá `npm run build` y `npm run preview`.
Abrí la app en localhost, dejá que cargue por primera vez y probá volver a abrirla sin conexión.
En teléfonos, la instalación y el service worker requieren servir la app por HTTPS.

## Publicación

En los secretos de GitHub Actions, configurá `WALLETA_INVITE_SHA256` con el valor que aparece
después de `VITE_WALLETA_INVITE_SHA256=` en `.env.local`. En GitHub Pages, seleccioná
**GitHub Actions** como origen. El workflow publica el contenido de
`dist` al actualizar `main` o al ejecutarlo manualmente.

El escáner de tickets figura como próximo y la carga manual funciona offline.
