# Amiigo

Aplicación web (HTML + CSS + JavaScript vanilla) para gestionar dispositivos simuladores NFC compatibles con el protocolo Pixl.js / Allmiibo mediante Web Bluetooth.

Inspirada en `bt.allmiibo.com`, pero con una interfaz más clara, subida de archivos y carpetas completas, progreso por archivo y verificación tras la transferencia.

## Características

- **Conexión Bluetooth (Web Bluetooth / BLE)** con dispositivos que exponen el servicio Nordic UART (Pixl.js / Allmiibo).
- **Explorador de archivos** del dispositivo: navegar carpetas, ver tamaños y actualizar listado.
- **Subida de archivos .bin** individuales o múltiples (solo se permiten archivos con extensión `.bin`; el resto se omite automáticamente).
- **Subida de carpetas completas**, conservando la estructura de subcarpetas y subiendo únicamente los archivos `.bin` que contengan.
- **Subida de varias carpetas a la vez** (en una sola tanda): selecciona múltiples carpetas de tu equipo y súbelas juntas en la misma operación (solo `.bin`).
- **Corrección interactiva de rutas/nombres demasiado largos**: si algún archivo o carpeta supera los límites del protocolo, la app muestra un aviso para que lo renombres manualmente, indicando en **verde** cuando la ruta queda correcta antes de aplicar el cambio (archivo/carpeta por archivo/carpeta). Puedes omitir elementos concretos si lo prefieres.
- **Verificación de subida**: tras cada archivo se vuelve a listar la carpeta remota y se comprueba que el archivo existe con el tamaño esperado.
- **Gestión tipo gestor de archivos**: crear, **renombrar**, **mover** (cortar y pegar en otra carpeta) y eliminar archivos/carpetas directamente en el dispositivo, con validaciones de ruta/nombre y comprobaciones de seguridad (p. ej. no mover una carpeta dentro de sí misma).
- **Actualización de firmware (DFU)**: envía el comando DFU al dispositivo y ofrece abrir la herramienta web de actualización con referencia a la versión detectada/publicada.
- **Indicadores de progreso** por archivo y global, spinner/estado de ocupado en operaciones (crear/renombrar/mover/eliminar), registro de actividad e información de almacenamiento.

## Requisitos

- Navegador compatible con **Web Bluetooth** (recomendado: Google Chrome o Microsoft Edge en escritorio; Chrome en Android).
  - Safari y Firefox no soportan Web Bluetooth de forma estándar.
- El dispositivo debe estar en **modo de transferencia de archivos por Bluetooth**.
- Servir la app desde `http://localhost` o `https://` (Web Bluetooth no funciona desde `file://` en la mayoría de navegadores).

## Uso

1. Inicia un servidor local en esta carpeta, por ejemplo:
   ```bash
   cd /Users/aitorvillarhernando/code-aitor/amiibo-amigo
   python3 -m http.server 8080
   ```
2. Abre `http://localhost:8080` en Chrome/Edge.
3. Pon tu simulador NFC en modo transferencia BLE.
4. Pulsa **Conectar** y selecciona el dispositivo.
5. Navega a la carpeta destino y usa **Subir archivos**, **Subir carpeta** o **Subir varias carpetas**. Si alguna ruta/nombre es demasiado larga, corrígela en el cuadro que aparece (se mostrará en verde cuando sea válida).

## Verificación de integridad

Después de transferir cada archivo, la aplicación:
1. Lista el directorio remoto donde se subió.
2. Comprueba que el archivo existe.
3. Compara el tamaño reportado por el dispositivo con el tamaño del archivo local.

Si hay discrepancia o el archivo no aparece, la transferencia se marca como fallida para ese archivo.

> Nota: el protocolo VFS usado no expone hash/checksum del archivo; la verificación se basa en presencia y tamaño. Para una comprobación byte a byte sería necesario soporte de lectura completa y comparación en el dispositivo/protocolo.

## Estructura del proyecto

- `index.html` — interfaz de usuario.
- `css/` — estilos divididos por responsabilidad (`base.css`, `layout.css`, `components.css`, `modal.css`).
- `js/ble/pixl-client.js` — cliente BLE/protocolo Pixl.js (conexión, comandos VFS, chunking, subida).
- `js/constants.js`, `js/state.js`, `js/utils.js` — constantes, estado/DOM y utilidades compartidas.
- `js/ui/` — módulos de interfaz (estado/busy, explorador, transferencias, modal de rutas).
- `js/services/` — lógica de dispositivo y subida/verificación.
- `js/main.js` — punto de entrada y cableado de eventos.

## Limitaciones conocidas

- Web Bluetooth requiere contexto seguro (localhost/HTTPS) y gesto de usuario para conectar.
- "Subir carpeta" usa `webkitdirectory`; "Subir varias carpetas" usa la File System Access API (`showDirectoryPicker`) y requiere un navegador Chromium reciente (Chrome/Edge).
- Límites del protocolo (Pixl.js VFS): nombre máx. 47 bytes, ruta de archivo máx. 63 bytes, ruta de carpeta máx. 55 bytes (UTF-8). La app ayuda a corregirlos antes de transferir.
- La velocidad depende del MTU negociado y de la latencia BLE del dispositivo.
- Operaciones como formateo no están expuestas en la UI (por seguridad), aunque el cliente soporta el comando.
