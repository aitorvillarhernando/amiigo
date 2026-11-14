# Amiigo

> **ES:** Este README está disponible en varios idiomas: primero encontrarás la versión en **español** y más abajo la versión en **inglés**.  
> **EN:** This README is available in multiple languages: you will find the **Spanish** version first, followed by the **English** version below.

[Español](#español) | [English](#english)

---

## Español

Aplicación web (HTML + CSS + JavaScript vanilla) para gestionar dispositivos simuladores NFC compatibles con el protocolo Pixl.js / Allmiibo mediante Web Bluetooth.

Inspirada en `bt.allmiibo.com`, pero con una interfaz más clara, subida de archivos y carpetas completas, progreso por archivo y verificación tras la transferencia.

### Características

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
- **Interfaz bilingüe (ES/EN)** con selector de idioma y soporte de parámetro `?lang=` en la URL.

### Requisitos

- Navegador compatible con **Web Bluetooth** (recomendado: Google Chrome o Microsoft Edge en escritorio; Chrome en Android).
  - Safari y Firefox no soportan Web Bluetooth de forma estándar.
- El dispositivo debe estar en **modo de transferencia de archivos por Bluetooth**.
- Servir la app desde `http://localhost` o `https://` (Web Bluetooth no funciona desde `file://` en la mayoría de navegadores).

### Uso

1. Inicia un servidor local en esta carpeta, por ejemplo:
   ```bash
   python3 -m http.server 8080
   ```
2. Abre `http://localhost:8080` en Chrome/Edge.
3. Pon tu simulador NFC en modo transferencia BLE.
4. Pulsa **Conectar** y selecciona el dispositivo.
5. Navega a la carpeta destino y usa **Subir archivos**, **Subir carpeta** o **Subir varias carpetas**. Si alguna ruta/nombre es demasiado larga, corrígela en el cuadro que aparece (se mostrará en verde cuando sea válida).

### Verificación de integridad

Después de transferir cada archivo, la aplicación:
1. Lista el directorio remoto donde se subió.
2. Comprueba que el archivo existe.
3. Compara el tamaño reportado por el dispositivo con el tamaño del archivo local.

Si hay discrepancia o el archivo no aparece, la transferencia se marca como fallida para ese archivo.

> Nota: el protocolo VFS usado no expone hash/checksum del archivo; la verificación se basa en presencia y tamaño. Para una comprobación byte a byte sería necesario soporte de lectura completa y comparación en el dispositivo/protocolo.

### Estructura del proyecto

- `index.html` — interfaz de usuario.
- `css/` — estilos divididos por responsabilidad (`base.css`, `layout.css`, `components.css`, `modal.css`).
- `js/ble/pixl-client.js` — cliente BLE/protocolo Pixl.js (conexión, comandos VFS, chunking, subida).
- `js/constants.js`, `js/state.js`, `js/utils.js` — constantes, estado/DOM y utilidades compartidas.
- `js/ui/` — módulos de interfaz (estado/busy, explorador, transferencias, modal de rutas).
- `js/services/` — lógica de dispositivo y subida/verificación.
- `js/main.js` — punto de entrada y cableado de eventos.

### Limitaciones conocidas

- Web Bluetooth requiere contexto seguro (localhost/HTTPS) y gesto de usuario para conectar.
- "Subir carpeta" usa `webkitdirectory`; "Subir varias carpetas" usa la File System Access API (`showDirectoryPicker`) y requiere un navegador Chromium reciente (Chrome/Edge).
- Límites del protocolo (Pixl.js VFS): nombre máx. 47 bytes, ruta de archivo máx. 63 bytes, ruta de carpeta máx. 55 bytes (UTF-8). La app ayuda a corregirlos antes de transferir.
- La velocidad depende del MTU negociado y de la latencia BLE del dispositivo.
- Operaciones como formateo no están expuestas en la UI (por seguridad), aunque el cliente soporta el comando.
---

## English
Web app (vanilla HTML, CSS, and JavaScript) to manage Pixl.js / Allmiibo-compatible NFC simulator devices over Web Bluetooth.

Inspired by `bt.allmiibo.com`, with a clearer interface, file and folder uploads, per-file progress, and upload verification.

### Features

- **Bluetooth connection (Web Bluetooth / BLE)** to devices exposing the Nordic UART service (Pixl.js / Allmiibo).
- **Device file browser**: navigate folders, view sizes, and refresh the listing.
- **Upload individual or multiple `.bin` files** (only `.bin` files are allowed; others are skipped automatically).
- **Upload complete folders**, preserving subfolder structure and uploading only the `.bin` files they contain.
- **Upload multiple folders at once** in a single batch (only `.bin` files).
- **Interactive path/name fixing** when protocol limits are exceeded: rename invalid segments manually with live validation (shown in green when valid) per file/folder segment. You can skip specific items if needed.
- **Upload verification**: after each file transfer, the app lists the remote directory and checks that the file exists with the expected size.
- **File manager actions on device**: create, **rename**, **move** (cut and paste to another folder), and delete files/folders, with path/name validation and safety checks (e.g. preventing moving a folder into itself).
- **Firmware update (DFU)** flow: sends the DFU command and offers to open the web update tool, with detected/published version references.
- **Progress indicators** per file and overall, busy/spinner state for operations (create/rename/move/delete), activity log, and storage information.
- **Bilingual UI (ES/EN)** with language selection and `?lang=` URL parameter support.

### Requirements

- A browser with **Web Bluetooth** support (recommended: Google Chrome or Microsoft Edge on desktop; Chrome on Android).
  - Safari and Firefox do not support Web Bluetooth in the standard way.
- The device must be in **Bluetooth file transfer mode**.
- Serve the app from `http://localhost` or `https://` (Web Bluetooth usually does not work from `file://`).

### Usage

1. Start a local server in this folder, for example:
   ```bash
   python3 -m http.server 8080
   ```
2. Open `http://localhost:8080` in Chrome/Edge.
3. Put your NFC simulator in BLE transfer mode.
4. Click **Connect** and select the device.
5. Navigate to the destination folder and use **Upload files**, **Upload folder**, or **Upload multiple folders**. If any path/name is too long, fix it in the dialog (it turns green when valid).

### Upload verification

After transferring each file, the app:
1. Lists the remote directory where it was uploaded.
2. Checks that the file exists.
3. Compares the device-reported size with the local file size.

If there is a mismatch or the file does not appear, that file transfer is marked as failed.

> Note: the VFS protocol used does not expose a file hash/checksum; verification is based on presence and size. Byte-for-byte comparison would require full read-back support in the device/protocol.

### Project structure

- `index.html` — user interface.
- `css/` — styles split by responsibility (`base.css`, `layout.css`, `components.css`, `modal.css`).
- `js/ble/pixl-client.js` — BLE/Pixl.js protocol client (connection, VFS commands, chunking, upload).
- `js/constants.js`, `js/state.js`, `js/utils.js` — constants, shared state/DOM, and utilities.
- `js/ui/` — UI modules (status/busy, browser, transfers, path modal).
- `js/services/` — device and upload/verification logic.
- `js/main.js` — entry point and event wiring.

### Known limitations

- Web Bluetooth requires a secure context (localhost/HTTPS) and a user gesture to connect.
- "Upload folder" uses `webkitdirectory`; "Upload multiple folders" uses the File System Access API (`showDirectoryPicker`) and requires a recent Chromium browser (Chrome/Edge).
- Protocol limits (Pixl.js VFS): max name 47 bytes, max file path 63 bytes, max folder path 55 bytes (UTF-8). The app helps fix these before transfer.
- Speed depends on negotiated MTU and BLE device latency.
- Operations like formatting are not exposed in the UI (for safety), although the client supports the command.
