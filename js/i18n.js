const STORAGE_KEY = 'amiigo-lang';
const LEGACY_STORAGE_KEY = 'amiibo-amigo-lang';

const translations = {
  es: {
    'app.subtitle': 'Gestor Bluetooth para simuladores NFC (Pixl.js / Allmiibo)',
    'header.connect': 'Conectar',
    'header.disconnect': 'Desconectar',
    'badge.checking': 'Comprobando Bluetooth…',
    'badge.available': 'Web Bluetooth disponible',
    'badge.unavailable': 'Web Bluetooth no disponible',
    'status.initial': 'Listo. Conecta tu dispositivo en modo transferencia BLE.',
    'status.ready': 'Listo. Puedes subir archivos o carpetas.',
    'status.disconnected': 'Desconectado.',
    'status.deviceDisconnected': 'Dispositivo desconectado.',
    'status.requesting': 'Solicitando dispositivo Bluetooth… (selecciónalo en el diálogo del navegador)',
    'status.readingInfo': 'Conectado. Leyendo información…',
    'status.connectedLoading': 'Conectado. Cargando archivos…',
    'status.uploading': 'Subiendo archivos…',
    'status.checkingPaths': 'Comprobando rutas antes de subir…',
    'status.movePrepared': 'Elemento preparado para mover. Navega al destino y pulsa "Mover aquí".',
    'status.moveCancelled': 'Movimiento cancelado.',
    'status.sameSrcDest': 'El origen y el destino son iguales.',
    'status.noFilesToUpload': 'No hay archivos válidos para subir.',
    'status.noFilesToUploadAfterSkip': 'No hay archivos para subir tras omitir rutas no válidas.',
    'status.selectBinFiles': 'No se seleccionaron archivos .bin.',
    'status.folderNoBin': 'La carpeta no contiene archivos .bin.',
    'status.multiDirUnsupported': 'Tu navegador no soporta selección de varias carpetas. Usa "Subir carpeta".',
    'status.multiDirNone': 'No se seleccionaron carpetas o no contienen archivos .bin.',
    'status.uploadComplete': 'Subida completada: {n} archivo(s) verificados.',
    'status.uploadPartial': 'Subida parcial: {ok} verificados, {fail} con error.',
    'status.uploadFailed': 'La subida ha fallado.',
    'status.uploadInterrupted': 'Subida interrumpida: {msg}',
    'status.listError': 'Error al listar: {msg}',
    'status.connectFailed': 'No se pudo conectar: {msg}',
    'status.dfuReady': 'Dispositivo en modo DFU. Abre la herramienta de actualización para flashear el firmware.',
    'status.dfuError': 'Error al entrar en modo DFU: {msg}',
    'status.dfuErrorShort': 'Error DFU: {msg}',
    'status.checkingFw': 'Comprobando información de firmware…',
    'status.sendingDfu': 'Enviando comando de actualización (DFU)…',
    'device.title': 'Dispositivo',
    'device.status': 'Estado',
    'device.name': 'Nombre',
    'device.fw': 'Versión FW',
    'device.addr': 'Dirección BLE',
    'device.storage': 'Almacenamiento',
    'device.refresh': 'Actualizar',
    'device.updateFw': 'Actualizar firmware',
    'device.updateFwTitle': 'Reiniciar en modo actualización de firmware (DFU)',
    'device.disconnected': 'Desconectado',
    'device.connected': 'Conectado',
    'help.summary': 'Ayuda rápida',
    'help.li1': 'Usa Chrome, Edge u otro navegador compatible con Web Bluetooth.',
    'help.li2': 'En el dispositivo, entra al modo de transferencia de archivos por Bluetooth.',
    'help.li3': 'La verificación tras la subida compara el tamaño reportado por el dispositivo con el archivo local.',
    'help.li4': 'Para mover: pulsa "Mover" (📦) en un elemento, navega a la carpeta destino y usa "Mover aquí".',
    'help.source': 'Fuente de .bin:',
    'help.sourceLink': 'Google Drive (colección)',
    'help.support': 'Si te resulta útil:',
    'help.supportLink': 'Invítame a un café',
    'footer.supportTitle': '¿Te ha sido útil Amiigo?',
    'footer.supportCopy': 'Si esta herramienta te ha ayudado a gestionar tus archivos, puedes invitarme a un café para apoyar su mantenimiento y futuras mejoras.',
    'footer.supportButton': 'Invítame a un café',
    'footer.aiDisclaimer': 'Esta aplicación se ha ido construyendo con el apoyo de herramientas de inteligencia artificial, combinándolo con revisión y ajustes manuales para cuidar el resultado y que todo funcione correctamente.',
    'footer.sourceCode': 'Código fuente',
    'footer.reportIssue': 'Reportar un problema',
    'footer.license': 'Licencia (MIT)',
    'footer.thirdPartyNotices': 'Avisos de terceros',
    'browser.up': '↑ Arriba',
    'browser.upTitle': 'Subir nivel',
    'browser.mkdir': 'Nueva carpeta',
    'browser.uploadFiles': 'Subir archivos (.bin)',
    'browser.uploadDir': 'Subir carpeta',
    'browser.uploadMultiDir': 'Subir varias carpetas',
    'browser.uploadMultiDirTitle': 'Seleccionar varias carpetas y subirlas juntas',
    'browser.moving': 'Moviendo:',
    'browser.moveHere': 'Mover aquí',
    'browser.cancel': 'Cancelar',
    'browser.colName': 'Nombre',
    'browser.colSize': 'Tamaño',
    'browser.colType': 'Tipo',
    'browser.colActions': 'Acciones',
    'browser.emptyConnect': 'Conecta un dispositivo para ver sus archivos.',
    'browser.emptyFolder': 'Carpeta vacía.',
    'browser.loading': 'Cargando…',
    'browser.folder': 'Carpeta',
    'browser.file': 'Archivo',
    'transfers.title': 'Transferencias',
    'transfers.clear': 'Limpiar',
    'transfers.empty': 'No hay transferencias en curso.',
    'log.title': 'Registro',
    'modal.title': 'Ruta o nombre no válido',
    'modal.desc': 'La ruta o algún nombre del elemento seleccionado no cumple los límites del dispositivo.\n\nElemento: {item}',
    'modal.resultPath': 'Ruta resultante en el dispositivo:',
    'modal.skip': 'Omitir este elemento',
    'modal.apply': 'Aplicar cambios',
    'modal.okMsg': 'Todos los segmentos y la ruta completa son válidos.',
    'modal.errMsg': 'Corrige los segmentos marcados en rojo para continuar.',
    'modal.segmentFile': 'Archivo',
    'modal.segmentDir': 'Carpeta {n}',
    'modal.segmentN': 'Segmento {n}',
    'modal.nameInvalid': 'Nombre vacío o con caracteres no permitidos.',
    'modal.nameTooLong': 'Nombre demasiado largo ({n}/{max} bytes UTF-8).',
    'modal.nameOk': 'Correcto ({n} B nombre)',
    'modal.pathTooLong': 'Ruta {kind} demasiado larga ({n}/{max} bytes).',
    'modal.pathKindFile': 'de archivo',
    'modal.pathKindDir': 'de carpeta',
    'transfer.queued': 'En cola…',
    'transfer.uploading': 'Subiendo…',
    'transfer.verifying': 'Verificando…',
    'transfer.verified': 'Verificado',
    'transfer.error': 'Error',
    'transfer.completed': 'Completado y verificado',
    'transfer.partial': 'Parcial: {ok} ok, {fail} fallidos',
    'transfer.failed': 'Fallida',
    'transfer.interrupted': 'Interrumpida',
    'transfer.progressOverall': '{done}/{total} completados · {sent} / {totalBytes}',
    'transfer.progressOverallFail': '{done}/{total} completados · {fail} fallidos · {sent} / {totalBytes}',
    'transfer.verifiedMeta': 'OK · {size} verificado',
    'confirm.addMoreFolders': '¿Añadir otra carpeta a la subida? Pulsa "Aceptar" para elegir otra o "Cancelar" para continuar con las seleccionadas.',
    'confirm.deleteFile': '¿Eliminar el archivo "{name}"?',
    'confirm.deleteFolder': '¿Eliminar la carpeta "{name}"?\n(La carpeta debe estar vacía en el dispositivo.)',
    'prompt.newFolder': 'Nombre de la nueva carpeta:',
    'prompt.newName': 'Nuevo nombre:',
    'alert.invalidName': 'Nombre inválido.',
    'alert.nameTooLong': 'Nombre demasiado largo (máx {max} bytes).',
    'alert.folderPathTooLong': 'Ruta de carpeta demasiado larga (máx {max} bytes).',
    'alert.pathTooLong': 'Ruta demasiado larga (máx {max} bytes).',
    'alert.destPathTooLong': 'La ruta de destino es demasiado larga (máx {max} bytes).',
    'alert.renameFailed': 'No se pudo renombrar: {msg}',
    'alert.moveIntoSelf': 'No puedes mover una carpeta dentro de sí misma.',
    'busy.creatingFolder': 'Creando carpeta "{name}"…',
    'busy.renaming': 'Renombrando "{name}"…',
    'busy.deleting': 'Eliminando "{name}"…',
    'busy.moving': 'Moviendo "{name}"…',
    'busy.checkingFw': 'Comprobando información de firmware…',
    'busy.sendingDfu': 'Enviando comando de actualización (DFU)…',
    'msg.folderCreated': 'Carpeta creada: {name}',
    'msg.deleted': 'Eliminado: {name}',
    'msg.renamedOk': 'Renombrado correctamente: {name}',
    'msg.renamedOkWarn': 'Renombrado correctamente: {name} (el dispositivo reportó un error, pero el cambio se aplicó).',
    'msg.movedOk': 'Movido correctamente: {name}',
    'msg.movedOkWarn': 'Movido correctamente: {name} (el dispositivo reportó un error, pero el cambio se aplicó).',
    'msg.errorCreatingFolder': 'Error creando carpeta: {msg}',
    'msg.errorDeleting': 'Error eliminando: {msg}',
    'msg.errorRenaming': 'Error renombrando: {msg}',
    'msg.errorMoving': 'Error al mover: {msg}',
    'msg.errorSelectingFolders': 'Error seleccionando carpetas: {msg}',
    'log.appStarted': 'Aplicación iniciada. Usa un navegador con Web Bluetooth.',
    'log.preparedMove': 'Preparado para mover: {path}',
    'log.folderCreated': 'Carpeta creada: {path}',
    'log.renamed': 'Renombrado: {old} -> {new}',
    'log.deleted': 'Eliminado: {path}',
    'log.moved': 'Movido: {old} -> {new}',
    'log.uploading': 'Subiendo {rel} -> {remote}',
    'log.verified': 'Verificado {path} ({size} B)',
    'log.failUpload': 'Fallo en {rel}: {msg}',
    'log.uploadInterrupted': 'Subida interrumpida: {msg}',
    'log.errorList': 'Error al listar {path}: {msg}',
    'log.errorListShort': 'Error al listar: {msg}',
    'log.connectionFailed': 'Conexión fallida: {msg}',
    'log.disconnected': 'Desconectado del dispositivo.',
    'log.versionError': 'No se pudo leer la versión: {msg}',
    'log.dfuSent': 'Comando DFU enviado correctamente. Dispositivo reiniciando en modo DFU.',
    'log.errorSelectingFolders': 'Error seleccionando carpetas: {msg}',
    'log.renameVerifiedWarn': 'Renombrado verificado en el dispositivo a pesar del error reportado: {old} -> {new}',
    'log.moveVerifiedWarn': 'Movimiento verificado en el dispositivo a pesar del error reportado: {src} -> {dest}',
    'dfu.confirm1': 'Actualización de firmware del dispositivo\n\nVersión actual detectada: {current}\n{latestLine}\n\nEl proceso consiste en:\n1) Reiniciar el dispositivo en modo DFU (actualización).\n2) Abrir la herramienta web de DFU y seleccionar el paquete de firmware (.zip) adecuado para tu dispositivo.\n   - Releases de Pixl.js: https://github.com/solosky/pixl.js/releases\n\n¿Quieres poner el dispositivo en modo DFU ahora?',
    'dfu.latestKnown': 'Última versión publicada (Pixl.js): {tag}',
    'dfu.latestUnknown': 'No se pudo consultar la última versión automáticamente.',
    'dfu.confirm2': 'El dispositivo debería estar en modo DFU.\n\n¿Abrir ahora la herramienta web de actualización (Nordic Secure DFU)?\nAllí podrás conectar el dispositivo en modo DFU y seleccionar el archivo .zip del firmware.\n\nReleases/firmware: {url}\n\nHerramienta DFU: https://thegecko.github.io/web-bluetooth-dfu/examples/web.html',
    'browser.search': 'Buscar archivos…',
    'browser.noSearchResults': 'No hay resultados para la búsqueda.',
    'browser.download': 'Descargar',
    'browser.dragDropHint': 'Suelta archivos o carpetas .bin para subirlos',
    'browser.lowercaseUpload': 'Minúsculas al subir',
    'browser.lowercaseUploadTitle': 'Convertir nombres de archivos y carpetas a minúsculas al subir',
    'log.clear': 'Limpiar',
    'log.copy': 'Copiar',
    'log.copied': 'Registro copiado.',
    'log.copyFailed': 'No se pudo copiar el registro.',
    'device.format': 'Formatear unidad',
    'device.formatTitle': 'Borrar todos los datos de la unidad seleccionada',
    'confirm.formatDrive': '¿Formatear la unidad {drive}?\n\nEsto borrará TODOS los archivos y carpetas del dispositivo. Esta acción no se puede deshacer.',
    'busy.formatting': 'Formateando unidad…',
    'msg.formatted': 'Unidad formateada correctamente.',
    'msg.errorFormatting': 'Error al formatear: {msg}',
    'log.formatted': 'Unidad formateada.',
    'status.downloading': 'Descargando {name}…',
    'msg.downloaded': 'Descargado: {name}',
    'msg.errorDownloading': 'Error al descargar: {msg}',
    'busy.downloading': 'Descargando "{name}"…',
    'lang.label': 'Idioma',
    'lang.es': 'Español',
    'lang.en': 'English',
  },
  en: {
    'app.subtitle': 'Bluetooth manager for NFC simulators (Pixl.js / Allmiibo)',
    'header.connect': 'Connect',
    'header.disconnect': 'Disconnect',
    'badge.checking': 'Checking Bluetooth…',
    'badge.available': 'Web Bluetooth available',
    'badge.unavailable': 'Web Bluetooth unavailable',
    'status.initial': 'Ready. Connect your device in BLE transfer mode.',
    'status.ready': 'Ready. You can upload files or folders.',
    'status.disconnected': 'Disconnected.',
    'status.deviceDisconnected': 'Device disconnected.',
    'status.requesting': 'Requesting Bluetooth device… (select it in the browser dialog)',
    'status.readingInfo': 'Connected. Reading information…',
    'status.connectedLoading': 'Connected. Loading files…',
    'status.uploading': 'Uploading files…',
    'status.checkingPaths': 'Checking paths before upload…',
    'status.movePrepared': 'Item ready to move. Navigate to destination and press "Move here".',
    'status.moveCancelled': 'Move cancelled.',
    'status.sameSrcDest': 'Source and destination are the same.',
    'status.noFilesToUpload': 'No valid files to upload.',
    'status.noFilesToUploadAfterSkip': 'No files to upload after skipping invalid paths.',
    'status.selectBinFiles': 'No .bin files were selected.',
    'status.folderNoBin': 'The folder contains no .bin files.',
    'status.multiDirUnsupported': 'Your browser does not support selecting multiple folders. Use "Upload folder".',
    'status.multiDirNone': 'No folders selected or they contain no .bin files.',
    'status.uploadComplete': 'Upload complete: {n} file(s) verified.',
    'status.uploadPartial': 'Partial upload: {ok} verified, {fail} failed.',
    'status.uploadFailed': 'Upload failed.',
    'status.uploadInterrupted': 'Upload interrupted: {msg}',
    'status.listError': 'Error listing: {msg}',
    'status.connectFailed': 'Could not connect: {msg}',
    'status.dfuReady': 'Device in DFU mode. Open the update tool to flash firmware.',
    'status.dfuError': 'Error entering DFU mode: {msg}',
    'status.dfuErrorShort': 'DFU error: {msg}',
    'status.checkingFw': 'Checking firmware information…',
    'status.sendingDfu': 'Sending firmware update command (DFU)…',
    'device.title': 'Device',
    'device.status': 'Status',
    'device.name': 'Name',
    'device.fw': 'FW Version',
    'device.addr': 'BLE Address',
    'device.storage': 'Storage',
    'device.refresh': 'Refresh',
    'device.updateFw': 'Update firmware',
    'device.updateFwTitle': 'Reboot into firmware update mode (DFU)',
    'device.disconnected': 'Disconnected',
    'device.connected': 'Connected',
    'help.summary': 'Quick help',
    'help.li1': 'Use Chrome, Edge, or another browser with Web Bluetooth support.',
    'help.li2': 'Put the device into Bluetooth file transfer mode.',
    'help.li3': 'Upload verification compares the device-reported size with the local file size.',
    'help.li4': 'To move: click "Move" (📦) on an item, navigate to the destination, and press "Move here".',
    'help.source': 'Source of .bin files:',
    'help.sourceLink': 'Google Drive (collection)',
    'help.support': 'If you find it useful:',
    'help.supportLink': 'Buy me a coffee',
    'footer.supportTitle': 'Has Amiigo been useful to you?',
    'footer.supportCopy': 'If this tool helped you manage your files, you can buy me a coffee to support its maintenance and future improvements.',
    'footer.supportButton': 'Buy me a coffee',
    'footer.aiDisclaimer': 'This app was built with the help of AI tools, combined with hands-on review and tweaks along the way to make sure everything works as it should.',
    'footer.sourceCode': 'Source code',
    'footer.reportIssue': 'Report an issue',
    'footer.license': 'License (MIT)',
    'footer.thirdPartyNotices': 'Third-party notices',
    'browser.up': '↑ Up',
    'browser.upTitle': 'Go up one level',
    'browser.mkdir': 'New folder',
    'browser.uploadFiles': 'Upload files (.bin)',
    'browser.uploadDir': 'Upload folder',
    'browser.uploadMultiDir': 'Upload multiple folders',
    'browser.uploadMultiDirTitle': 'Select multiple folders and upload them together',
    'browser.moving': 'Moving:',
    'browser.moveHere': 'Move here',
    'browser.cancel': 'Cancel',
    'browser.colName': 'Name',
    'browser.colSize': 'Size',
    'browser.colType': 'Type',
    'browser.colActions': 'Actions',
    'browser.emptyConnect': 'Connect a device to see its files.',
    'browser.emptyFolder': 'Empty folder.',
    'browser.loading': 'Loading…',
    'browser.folder': 'Folder',
    'browser.file': 'File',
    'transfers.title': 'Transfers',
    'transfers.clear': 'Clear',
    'transfers.empty': 'No transfers in progress.',
    'log.title': 'Log',
    'modal.title': 'Invalid path or name',
    'modal.desc': 'The path or a name of the selected item does not meet device limits.\n\nItem: {item}',
    'modal.resultPath': 'Resulting path on device:',
    'modal.skip': 'Skip this item',
    'modal.apply': 'Apply changes',
    'modal.okMsg': 'All segments and the full path are valid.',
    'modal.errMsg': 'Fix the segments marked in red to continue.',
    'modal.segmentFile': 'File',
    'modal.segmentDir': 'Folder {n}',
    'modal.segmentN': 'Segment {n}',
    'modal.nameInvalid': 'Empty name or contains disallowed characters.',
    'modal.nameTooLong': 'Name too long ({n}/{max} UTF-8 bytes).',
    'modal.nameOk': 'OK ({n} B name)',
    'modal.pathTooLong': '{kind} path too long ({n}/{max} bytes).',
    'modal.pathKindFile': 'File',
    'modal.pathKindDir': 'Folder',
    'transfer.queued': 'Queued…',
    'transfer.uploading': 'Uploading…',
    'transfer.verifying': 'Verifying…',
    'transfer.verified': 'Verified',
    'transfer.error': 'Error',
    'transfer.completed': 'Completed and verified',
    'transfer.partial': 'Partial: {ok} ok, {fail} failed',
    'transfer.failed': 'Failed',
    'transfer.interrupted': 'Interrupted',
    'transfer.progressOverall': '{done}/{total} completed · {sent} / {totalBytes}',
    'transfer.progressOverallFail': '{done}/{total} completed · {fail} failed · {sent} / {totalBytes}',
    'transfer.verifiedMeta': 'OK · {size} verified',
    'confirm.addMoreFolders': 'Add another folder to the upload? Press "OK" to choose another or "Cancel" to continue with the selected ones.',
    'confirm.deleteFile': 'Delete file "{name}"?',
    'confirm.deleteFolder': 'Delete folder "{name}"?\n(The folder must be empty on the device.)',
    'prompt.newFolder': 'New folder name:',
    'prompt.newName': 'New name:',
    'alert.invalidName': 'Invalid name.',
    'alert.nameTooLong': 'Name too long (max {max} bytes).',
    'alert.folderPathTooLong': 'Folder path too long (max {max} bytes).',
    'alert.pathTooLong': 'Path too long (max {max} bytes).',
    'alert.destPathTooLong': 'Destination path is too long (max {max} bytes).',
    'alert.renameFailed': 'Could not rename: {msg}',
    'alert.moveIntoSelf': 'You cannot move a folder into itself.',
    'busy.creatingFolder': 'Creating folder "{name}"…',
    'busy.renaming': 'Renaming "{name}"…',
    'busy.deleting': 'Deleting "{name}"…',
    'busy.moving': 'Moving "{name}"…',
    'busy.checkingFw': 'Checking firmware information…',
    'busy.sendingDfu': 'Sending firmware update command (DFU)…',
    'msg.folderCreated': 'Folder created: {name}',
    'msg.deleted': 'Deleted: {name}',
    'msg.renamedOk': 'Renamed successfully: {name}',
    'msg.renamedOkWarn': 'Renamed successfully: {name} (the device reported an error, but the change was applied).',
    'msg.movedOk': 'Moved successfully: {name}',
    'msg.movedOkWarn': 'Moved successfully: {name} (the device reported an error, but the change was applied).',
    'msg.errorCreatingFolder': 'Error creating folder: {msg}',
    'msg.errorDeleting': 'Error deleting: {msg}',
    'msg.errorRenaming': 'Error renaming: {msg}',
    'msg.errorMoving': 'Error moving: {msg}',
    'msg.errorSelectingFolders': 'Error selecting folders: {msg}',
    'log.appStarted': 'Application started. Use a browser with Web Bluetooth.',
    'log.preparedMove': 'Ready to move: {path}',
    'log.folderCreated': 'Folder created: {path}',
    'log.renamed': 'Renamed: {old} -> {new}',
    'log.deleted': 'Deleted: {path}',
    'log.moved': 'Moved: {old} -> {new}',
    'log.uploading': 'Uploading {rel} -> {remote}',
    'log.verified': 'Verified {path} ({size} B)',
    'log.failUpload': 'Failed {rel}: {msg}',
    'log.uploadInterrupted': 'Upload interrupted: {msg}',
    'log.errorList': 'Error listing {path}: {msg}',
    'log.errorListShort': 'Error listing: {msg}',
    'log.connectionFailed': 'Connection failed: {msg}',
    'log.disconnected': 'Disconnected from device.',
    'log.versionError': 'Could not read version: {msg}',
    'log.dfuSent': 'DFU command sent successfully. Device rebooting into DFU mode.',
    'log.errorSelectingFolders': 'Error selecting folders: {msg}',
    'log.renameVerifiedWarn': 'Rename verified on device despite reported error: {old} -> {new}',
    'log.moveVerifiedWarn': 'Move verified on device despite reported error: {src} -> {dest}',
    'dfu.confirm1': 'Device firmware update\n\nDetected current version: {current}\n{latestLine}\n\nThe process is:\n1) Reboot the device into DFU (update) mode.\n2) Open the web DFU tool and select the appropriate firmware package (.zip) for your device.\n   - Pixl.js releases: https://github.com/solosky/pixl.js/releases\n\nDo you want to put the device into DFU mode now?',
    'dfu.latestKnown': 'Latest published version (Pixl.js): {tag}',
    'dfu.latestUnknown': 'Could not check the latest version automatically.',
    'dfu.confirm2': 'The device should now be in DFU mode.\n\nOpen the web update tool (Nordic Secure DFU) now?\nThere you can connect the device in DFU mode and select the firmware .zip file.\n\nReleases/firmware: {url}\n\nDFU tool: https://thegecko.github.io/web-bluetooth-dfu/examples/web.html',
    'browser.search': 'Search files…',
    'browser.noSearchResults': 'No results for this search.',
    'browser.download': 'Download',
    'browser.dragDropHint': 'Drop .bin files or folders to upload',
    'browser.lowercaseUpload': 'Lowercase on upload',
    'browser.lowercaseUploadTitle': 'Convert file and folder names to lowercase when uploading',
    'log.clear': 'Clear',
    'log.copy': 'Copy',
    'log.copied': 'Log copied.',
    'log.copyFailed': 'Could not copy log.',
    'device.format': 'Format drive',
    'device.formatTitle': 'Erase all data on the selected drive',
    'confirm.formatDrive': 'Format drive {drive}?\n\nThis will erase ALL files and folders on the device. This action cannot be undone.',
    'busy.formatting': 'Formatting drive…',
    'msg.formatted': 'Drive formatted successfully.',
    'msg.errorFormatting': 'Error formatting drive: {msg}',
    'log.formatted': 'Drive formatted.',
    'status.downloading': 'Downloading {name}…',
    'msg.downloaded': 'Downloaded: {name}',
    'msg.errorDownloading': 'Error downloading: {msg}',
    'busy.downloading': 'Downloading "{name}"…',
    'lang.label': 'Language',
    'lang.es': 'Español',
    'lang.en': 'English',
  }
};

let currentLang = 'es';

function interpolate(str, params = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? params[k] : `{${k}}`));
}

export function t(key, params) {
  const dict = translations[currentLang] || translations.es;
  const fallback = translations.es || {};
  const val = (dict && dict[key] != null) ? dict[key] : (fallback[key] != null ? fallback[key] : key);
  return interpolate(val, params);
}

export function getLang() { return currentLang; }

export function getLangFromUrl() {
  try {
    const p = new URLSearchParams(location.search).get('lang');
    if (p && translations[p]) return p;
  } catch (_) {}
  return null;
}

export function setLang(lang, { updateUrl = true } = {}) {
  currentLang = translations[lang] ? lang : 'es';
  try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (_) {}
  if (updateUrl) {
    try {
      const url = new URL(location.href);
      url.searchParams.set('lang', currentLang);
      history.replaceState(null, '', url);
    } catch (_) {}
  }
  document.documentElement.lang = currentLang;
  applyTranslations();
  updateMetaTags();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: currentLang } }));
}

export function updateMetaTags() {
  const isEn = currentLang === 'en';
  const title = 'Amiigo';
  const description = isEn
    ? 'Web Bluetooth manager for Pixl.js / compatible NFC simulators. Browse, upload, organize and verify .bin files from your browser.'
    : 'Gestor web por Bluetooth para simuladores NFC Pixl.js / compatibles. Explora, sube, organiza y verifica archivos .bin desde el navegador.';
  document.title = title;
  const setMeta = (selector, attr, value) => {
    let el = document.head.querySelector(selector);
    if (!el) return;
    el.setAttribute(attr, value);
  };
  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[property="og:locale"]', 'content', isEn ? 'en_US' : 'es_ES');
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', description);
  setMeta('html', 'lang', currentLang); // harmless if selector not used; lang set above
}

export function initI18n() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy && translations[legacy]) {
        saved = legacy;
        localStorage.setItem(STORAGE_KEY, legacy);
      }
    }
  } catch (_) {}
  const urlLang = getLangFromUrl();
  if (urlLang) {
    currentLang = urlLang;
    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (_) {}
  } else if (saved && translations[saved]) {
    currentLang = saved;
  } else {
    const nav = (navigator.language || '').toLowerCase();
    currentLang = nav.startsWith('en') ? 'en' : 'es';
  }
  // keep URL in sync with resolved language
  try {
    const url = new URL(location.href);
    if (url.searchParams.get('lang') !== currentLang) {
      // do not force param if user didn't specify? better to set for shareability as requested
      // but avoid changing if not needed; still "cambiar de idioma ponga un param GET" - on init we can reflect
    }
  } catch (_) {}
  document.documentElement.lang = currentLang;
  applyTranslations();
  updateMetaTags();
  return currentLang;
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (key) el.textContent = t(key); // use text for safety unless needed
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.setAttribute('placeholder', t(key));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) el.setAttribute('aria-label', t(key));
  });
}
