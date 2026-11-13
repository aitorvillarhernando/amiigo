// Pixl.js / Allmiibo BLE VFS client (Web Bluetooth)
// Protocol based on Pixl.js BLE protocol (NUS + VFS commands).

import { t } from '../i18n.js';

const NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_CHAR_TX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // write
const NUS_CHAR_RX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify

const FRAME_HEADER_SIZE = 4;
const COMMAND_TIMEOUT_MS = 15000;
const FORMAT_TIMEOUT_MS = 60000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

const PROBE_CMD = 0x70;
const PROBE_TIMEOUT_MS = 3000;
const CHUNK_SIZE_LADDER = [242, 177, 15];

const MAX_FILE_NAME_BYTES = 47;
const MAX_FILE_PATH_BYTES = 63;
const MAX_FOLDER_PATH_BYTES = 55;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const VFS_ERRORS = {
  0: "OK",
  1: "Command failed",
  [-1]: "Device error",
  [-2]: "Out of memory",
  [-3]: "End of file",
  [-4]: "Already exists",
  [-5]: "Name too long",
  [-6]: "Drive not found",
  [-7]: "Storage corrupted",
  [-90]: "Not found",
  [-91]: "No space left",
  [-99]: "Unsupported",
};

const CMD_NAMES = {
  0x01: "VERSION_INFO",
  0x02: "ENTER_DFU",
  0x10: "DRIVE_LIST",
  0x11: "DRIVE_FORMAT",
  0x12: "FILE_OPEN",
  0x13: "FILE_CLOSE",
  0x14: "FILE_READ",
  0x15: "FILE_WRITE",
  0x16: "DIR_READ",
  0x17: "DIR_CREATE",
  0x18: "REMOVE",
  0x19: "RENAME",
};

function encodeString(value) {
  const bytes = encoder.encode(value);
  const output = new Uint8Array(2 + bytes.length);
  output[0] = bytes.length & 0xff;
  output[1] = (bytes.length >> 8) & 0xff;
  output.set(bytes, 2);
  return output;
}

function concatBytes(...chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export function utf8Length(value) {
  return encoder.encode(value).length;
}

export function getBaseName(path) {
  const parts = path.split("/").filter(Boolean);
  return parts.length === 0 ? "" : parts[parts.length - 1];
}

export function getParentPath(path) {
  const i = path.lastIndexOf("/");
  return i <= 2 ? path.slice(0, 3) : path.slice(0, i);
}

export function validateRemotePath(path, kind) {
  if (!path || path.length < 3) throw new Error(`Ruta ${kind} inválida: "${path}"`);
  const limit = kind === "folder" ? MAX_FOLDER_PATH_BYTES : MAX_FILE_PATH_BYTES;
  const len = utf8Length(path);
  if (len > limit) {
    throw new Error(
      `${kind === "folder" ? "Carpeta" : "Archivo"}: ruta de ${len} bytes supera el máximo (${limit}): ${path}`
    );
  }
  const base = getBaseName(path);
  if (base && utf8Length(base) > MAX_FILE_NAME_BYTES) {
    throw new Error(`El nombre supera ${MAX_FILE_NAME_BYTES} bytes: ${base}`);
  }
}

export function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const aDir = a.type === "DIR" ? 0 : 1;
    const bDir = b.type === "DIR" ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

class Cursor {
  constructor(bytes) {
    this.bytes = bytes;
    this.offset = 0;
    this._view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  remaining() { return this.bytes.length - this.offset; }
  u8() { return this.bytes[this.offset++]; }
  u16() { const v = this.bytes[this.offset] | (this.bytes[this.offset + 1] << 8); this.offset += 2; return v; }
  u32() { const v = this._view.getUint32(this.offset, true); this.offset += 4; return v; }
  take(n) { const v = this.bytes.slice(this.offset, this.offset + n); this.offset += n; return v; }
  string() { return decoder.decode(this.take(this.u16())); }
}

export class PixlClient {
  constructor(options = () => {}) {
    const logFn = typeof options === 'function' ? options : (options && typeof options.log === 'function' ? options.log : () => {});
    this._log = logFn;
    this.device = null;
    this.txChar = null;
    this.rxChar = null;
    this.queue = Promise.resolve();
    this.pending = null;
    this.chunking = false;
    this.rxParts = [];
    this.rxBytes = 0;
    this.rxSeq = -1;
    this.maxChunkSize = CHUNK_SIZE_LADDER[0];
    this._expectErrorResponses = false;
    this.createdFolders = new Set();
    this._pendingTimer = null;
    this._intentionalDisconnect = false;
    this.onDisconnect = null;
    this._onNotification = this._onNotification.bind(this);
    this._onDisconnect = this._onDisconnect.bind(this);
  }

  get connected() {
    return !!(this.device && this.device.gatt && this.device.gatt.connected && this.txChar);
  }

  async connect() {
    if (!navigator.bluetooth) throw new Error(document.documentElement.lang === 'en' ? 'Web Bluetooth is not available in this browser.' : 'Web Bluetooth no está disponible en este navegador.');
    this._log(document.documentElement.lang === 'en' ? 'Requesting BLE device...' : 'Solicitando dispositivo BLE...');
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [NUS_SERVICE_UUID] }],
      optionalServices: [NUS_SERVICE_UUID],
    });
    await this._setupGatt(device);
  }

  async _setupGatt(device) {
    if (this.device && this.device !== device) {
      this.device.removeEventListener("gattserverdisconnected", this._onDisconnect);
    }
    device.removeEventListener("gattserverdisconnected", this._onDisconnect);
    if (this.rxChar) {
      this.rxChar.removeEventListener("characteristicvaluechanged", this._onNotification);
    }
    const server = await device.gatt.connect();
    device.addEventListener("gattserverdisconnected", this._onDisconnect);
    try {
      const service = await server.getPrimaryService(NUS_SERVICE_UUID);
      this.txChar = await service.getCharacteristic(NUS_CHAR_TX_UUID);
      this.rxChar = await service.getCharacteristic(NUS_CHAR_RX_UUID);
      this.device = device;
      await this.rxChar.startNotifications();
      this.rxChar.addEventListener("characteristicvaluechanged", this._onNotification);
    } catch (err) {
      device.removeEventListener("gattserverdisconnected", this._onDisconnect);
      this.txChar = null; this.rxChar = null; this.device = null;
      if (server.connected) server.disconnect();
      throw err;
    }
    this.createdFolders.clear();
    this._log(document.documentElement.lang === 'en' ? `Connected to ${device.name || "BLE device"}.` : `Conectado a ${device.name || "dispositivo BLE"}.`);

    const savedLog = this._log;
    this._log = () => {};
    this._expectErrorResponses = true;
    try {
      await this._sendCommand(0x13, Uint8Array.of(0)); // close stale handle
      await this._negotiateChunkSize();
    } finally {
      this._log = savedLog;
      this._expectErrorResponses = false;
    }
    this._log(document.documentElement.lang === 'en' ? `Write chunk size: ${this.maxChunkSize} B` : `Tamaño de bloque de escritura: ${this.maxChunkSize} B`);
  }

  async _negotiateChunkSize() {
    for (const chunk of CHUNK_SIZE_LADDER) {
      try {
        await this._sendCommand(PROBE_CMD, new Uint8Array(chunk + 1), PROBE_TIMEOUT_MS);
        this.maxChunkSize = chunk;
        return;
      } catch (err) {
        if (!this.txChar) throw err;
      }
    }
    this.maxChunkSize = CHUNK_SIZE_LADDER[CHUNK_SIZE_LADDER.length - 1];
  }

  disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this._intentionalDisconnect = true;
      this.device.gatt.disconnect();
      return;
    }
    this._resetTransport("Desconectado.");
  }

  _resetTransport(reason) {
    if (this.rxChar) this.rxChar.removeEventListener("characteristicvaluechanged", this._onNotification);
    if (this.device) this.device.removeEventListener("gattserverdisconnected", this._onDisconnect);
    clearTimeout(this._pendingTimer);
    this._pendingTimer = null;
    if (this.pending) { this.pending.reject(new Error(reason)); this.pending = null; }
    this.device = null; this.txChar = null; this.rxChar = null;
    this.queue = Promise.resolve();
    this.chunking = false; this.rxParts = []; this.rxBytes = 0; this.rxSeq = -1;
    this.createdFolders.clear();
  }

  _onDisconnect() {
    const intentional = this._intentionalDisconnect;
    this._intentionalDisconnect = false;
    this._resetTransport(intentional ? "Desconectado." : "Dispositivo desconectado.");
    if (this.onDisconnect) this.onDisconnect({ intentional });
  }

  _vfsError(status) {
    const signed = status > 127 ? status - 256 : status;
    return VFS_ERRORS[signed] || `Error desconocido (estado ${signed})`;
  }

  _sendCommand(cmd, payload = new Uint8Array(), timeoutMs = COMMAND_TIMEOUT_MS) {
    const cmdName = CMD_NAMES[cmd] || `0x${cmd.toString(16)}`;
    const run = () => this._performCommand(cmd, payload, cmdName, timeoutMs);
    const result = this.queue.then(run);
    this.queue = result.catch(() => {});
    return result;
  }

  _writeFrame(frame) {
    const c = this.txChar;
    if (c.properties && c.properties.writeWithoutResponse && typeof c.writeValueWithoutResponse === "function") {
      return c.writeValueWithoutResponse(frame);
    }
    if (typeof c.writeValueWithResponse === "function") return c.writeValueWithResponse(frame);
    return c.writeValue(frame);
  }

  _performCommand(cmd, payload, cmdName, timeoutMs) {
    if (!this.txChar) return Promise.reject(new Error("No conectado."));
    return new Promise((resolve, reject) => {
      const pendingRef = { resolve, reject, cmd };
      pendingRef.onTimeout = () => {
        if (this.pending !== pendingRef) return;
        this.pending = null; this._pendingTimer = null;
        this.chunking = false; this.rxParts = []; this.rxBytes = 0; this.rxSeq = -1;
        reject(new Error(`Tiempo de espera agotado: ${cmdName}`));
      };
      pendingRef.armTimer = () => {
        clearTimeout(this._pendingTimer);
        this._pendingTimer = setTimeout(pendingRef.onTimeout, timeoutMs);
      };
      this.pending = pendingRef;
      const frame = new Uint8Array(FRAME_HEADER_SIZE + payload.length);
      frame[0] = cmd; frame[1] = 0; frame[2] = 0; frame[3] = 0;
      frame.set(payload, FRAME_HEADER_SIZE);
      this._writeFrame(frame).then(() => {
        if (this.pending !== pendingRef) return;
        pendingRef.armTimer();
      }).catch((err) => {
        if (this.pending === pendingRef) this.pending = null;
        reject(err);
      });
    });
  }

  _onNotification(event) {
    if (!this.pending) return;
    try {
      const dv = event.target.value;
      const incoming = new Uint8Array(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
      const chunk = incoming[2] | (incoming[3] << 8);
      const hasMore = (chunk & 0x8000) !== 0;
      const seq = chunk & 0x7fff;
      if (hasMore) {
        if (!this.chunking) {
          if (seq !== 0) return;
          this.rxParts = [incoming]; this.rxBytes = incoming.length; this.rxSeq = 0; this.chunking = true;
        } else {
          if (seq !== this.rxSeq + 1) { this._failReassembly(`Secuencia RX inesperada`); return; }
          if (this.rxBytes + incoming.length > MAX_RESPONSE_BYTES) { this._failReassembly(`Respuesta RX demasiado grande`); return; }
          this.rxParts.push(incoming.slice(FRAME_HEADER_SIZE));
          this.rxBytes += incoming.length - FRAME_HEADER_SIZE;
          this.rxSeq = seq;
        }
        if (this.pending && this.pending.armTimer) this.pending.armTimer();
        return;
      }
      let frame = incoming;
      if (this.chunking) {
        if (seq !== this.rxSeq + 1) { this._failReassembly(`Secuencia RX final inesperada`); return; }
        this.rxParts.push(incoming.slice(FRAME_HEADER_SIZE));
        frame = concatBytes(...this.rxParts);
        this.rxParts = []; this.chunking = false; this.rxBytes = 0; this.rxSeq = -1;
      }
      const response = { cmd: frame[0], status: frame[1], payload: frame.slice(FRAME_HEADER_SIZE) };
      const p = this.pending;
      if (response.cmd === PROBE_CMD && p.cmd !== PROBE_CMD) return; // stale probe echo
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
      this.pending = null;
      if (response.cmd !== p.cmd) {
        p.reject(new Error(`Respuesta inesperada 0x${response.cmd.toString(16)} para 0x${p.cmd.toString(16)}`));
        return;
      }
      p.resolve(response);
    } catch (err) {
      this._failReassembly(err.message);
    }
  }

  _failReassembly(message) {
    this.chunking = false; this.rxParts = []; this.rxBytes = 0; this.rxSeq = -1;
    clearTimeout(this._pendingTimer); this._pendingTimer = null;
    if (this.pending) { this.pending.reject(new Error(message)); this.pending = null; }
  }

  // --- High-level commands ---

  async getVersion() {
    const r = await this._sendCommand(0x01);
    if (r.status !== 0) return { ok: false, error: this._vfsError(r.status), data: null };
    const c = new Cursor(r.payload);
    const version = c.string();
    const bleAddress = c.remaining() > 0 ? c.string() : "";
    return { ok: true, error: null, data: { version, bleAddress } };
  }

  async listDrives() {
    const r = await this._sendCommand(0x10);
    if (r.status !== 0) return { ok: false, error: this._vfsError(r.status), data: null };
    const c = new Cursor(r.payload);
    const count = c.u8();
    const drives = [];
    for (let i = 0; i < count; i++) {
      drives.push({
        status: c.u8(),
        label: String.fromCharCode(c.u8()),
        name: c.string(),
        totalBytes: c.u32(),
        freeBytes: c.u32(),
      });
    }
    return { ok: true, error: null, data: drives };
  }

  async formatDrive(label) {
    const r = await this._sendCommand(0x11, Uint8Array.of(label.charCodeAt(0)), FORMAT_TIMEOUT_MS);
    if (r.status !== 0) return { ok: false, error: this._vfsError(r.status) };
    return { ok: true, error: null };
  }

  async readFolder(path) {
    const r = await this._sendCommand(0x16, encodeString(path), 30000);
    if (r.status !== 0) return { ok: false, error: this._vfsError(r.status), data: null };
    const c = new Cursor(r.payload);
    const entries = [];
    while (c.remaining() >= 8) {
      const nameLen = c.bytes[c.offset] | (c.bytes[c.offset + 1] << 8);
      if (c.remaining() < 2 + nameLen + 4 + 1 + 1) break;
      const name = c.string();
      const size = c.u32();
      const type = c.u8() === 1 ? "DIR" : "FILE";
      const metaSize = c.u8();
      if (c.remaining() < metaSize) break;
      c.take(metaSize); // skip meta for now
      entries.push({ name, size, type });
    }
    return { ok: true, error: null, data: sortEntries(entries) };
  }

  async createFolder(path) {
    validateRemotePath(path, "folder");
    const r = await this._sendCommand(0x17, encodeString(path), 60000);
    if (r.status !== 0) return { ok: false, error: this._vfsError(r.status) };
    return { ok: true, error: null };
  }

  async removePath(path) {
    // Removing directories/items can be slow on some devices
    const r = await this._sendCommand(0x18, encodeString(path), 60000);
    if (r.status !== 0) return { ok: false, error: this._vfsError(r.status) };
    return { ok: true, error: null };
  }

  async renamePath(oldPath, newPath) {
    // Renaming/moving directories on device storage can take longer on some firmwares/devices
    const r = await this._sendCommand(0x19, concatBytes(encodeString(oldPath), encodeString(newPath)), 90000);
    if (r.status !== 0) return { ok: false, error: this._vfsError(r.status) };
    return { ok: true, error: null };
  }

  async openFile(path, mode) {
    const modeMap = { r: 0x08, w: 0x16 };
    if (!(mode in modeMap)) throw new Error(`Modo desconocido "${mode}"`);
    const payload = concatBytes(encodeString(path), Uint8Array.of(modeMap[mode]));
    const r = await this._sendCommand(0x12, payload, 30000);
    if (r.status !== 0) return { ok: false, error: this._vfsError(r.status), data: null };
    const c = new Cursor(r.payload);
    return { ok: true, error: null, data: c.u8() };
  }

  async writeFileChunk(fileId, chunk) {
    const r = await this._sendCommand(0x15, concatBytes(Uint8Array.of(fileId), chunk), 60000);
    if (r.status !== 0) return { ok: false, error: this._vfsError(r.status) };
    return { ok: true, error: null };
  }

  async closeFile(fileId) {
    const r = await this._sendCommand(0x13, Uint8Array.of(fileId), 30000);
    if (r.status !== 0) return { ok: false, error: this._vfsError(r.status) };
    return { ok: true, error: null };
  }

  async readFileData(path) {
    const openRes = await this.openFile(path, "r");
    if (!openRes.ok) return { ok: false, error: openRes.error, data: null };
    const fileId = openRes.data;
    try {
      const r = await this._sendCommand(0x14, Uint8Array.of(fileId));
      if (r.status !== 0) return { ok: false, error: this._vfsError(r.status), data: null };
      return { ok: true, error: null, data: r.payload };
    } finally {
      await this.closeFile(fileId).catch(() => {});
    }
  }

  async enterDfu() {
    this._intentionalDisconnect = true;
    try {
      await this._sendCommand(0x02);
      return { ok: true };
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("desconect") || msg.includes("disconnected") || msg.includes("agotado") || msg.includes("timed out") || msg.includes("No conectado")) {
        return { ok: true };
      }
      this._intentionalDisconnect = false;
      return { ok: false, error: msg };
    }
  }

  async ensureFolder(remotePath) {
    const root = remotePath.slice(0, 3); // e.g. E:/
    if (remotePath === root) return;
    const segments = remotePath.slice(3).split("/").filter(Boolean);
    let current = root;
    for (const seg of segments) {
      current = current === root ? `${root}${seg}` : `${current}/${seg}`;
      validateRemotePath(current, "folder");
      if (this.createdFolders.has(current)) continue;
      const res = await this.createFolder(current);
      if (!res.ok) {
        // tolerate "already exists" by checking listing
        const parent = getParentPath(current);
        const listing = await this.readFolder(parent);
        if (!listing.ok) throw new Error(res.error);
        const exists = listing.data.some((e) => e.type === "DIR" && e.name === getBaseName(current));
        if (!exists) throw new Error(res.error);
      }
      this.createdFolders.add(current);
    }
  }

  async uploadFile(remotePath, file, onProgress, abortSignal) {
    validateRemotePath(remotePath, "file");
    const openRes = await this.openFile(remotePath, "w");
    if (!openRes.ok) throw new Error(openRes.error);
    const fileId = openRes.data;
    try {
      if (file.size === 0) { onProgress(0, 0); return; }
      let offset = 0;
      // start conservatively for large transfers; very large files are prone to mid-stream device errors
      let chunkSize = Math.max(15, Math.min(this.maxChunkSize || CHUNK_SIZE_LADDER[0], 177));
      if (file.size > 200 * 1024) chunkSize = 15;
      if (this.maxChunkSize && this.maxChunkSize < chunkSize) chunkSize = this.maxChunkSize;
      const maxRetries = 5;
      let chunksSinceYield = 0;
      while (offset < file.size) {
        if (abortSignal && abortSignal.aborted) throw new Error("Subida cancelada por el usuario.");
        const end = Math.min(offset + chunkSize, file.size);
        const chunk = new Uint8Array(await file.slice(offset, end).arrayBuffer());
        let lastErr = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          if (abortSignal && abortSignal.aborted) throw new Error("Subida cancelada por el usuario.");
          try {
            const res = await this.writeFileChunk(fileId, chunk);
            if (res.ok) { lastErr = null; break; }
            lastErr = new Error(res.error);
          } catch (e) {
            lastErr = e;
          }
          if (attempt < maxRetries) {
            const msg = (lastErr && lastErr.message) || '';
            const isTimeout = /Tiempo de espera agotado|timeout|agotado/i.test(msg);
            const isCmdFail = /Command failed|Device error/i.test(msg);
            // On timeout/protocol hiccups or device errors, reduce chunk size and slow down
            if (chunkSize > 15 && (isTimeout || isCmdFail || /Out of memory|No space/i.test(msg))) {
              const smaller = CHUNK_SIZE_LADDER.filter(s => s < chunkSize).sort((a,b) => b-a)[0] || 15;
              if (smaller < chunkSize) {
                chunkSize = smaller;
                this.maxChunkSize = Math.min(this.maxChunkSize || chunkSize, chunkSize);
                this._log(document.documentElement.lang === 'en'
                  ? `Reducing chunk size to ${chunkSize} B to improve stability for ${remotePath}...`
                  : `Reduciendo tamaño de bloque a ${chunkSize} B para mejorar estabilidad en ${remotePath}...`);
                lastErr = new Error(`${msg} (reintentando con bloque de ${chunkSize} B)`);
                break; // rebuild chunk with new size in outer loop
              }
            }
            const backoff = (isTimeout || isCmdFail ? 1200 : 700) * attempt;
            this._log(document.documentElement.lang === 'en'
              ? `Retrying chunk in ${remotePath} (offset ${offset}, attempt ${attempt}/${maxRetries})...`
              : `Reintentando chunk en ${remotePath} (offset ${offset}, intento ${attempt}/${maxRetries})...`);
            await new Promise(r => setTimeout(r, backoff));
          }
        }
        if (lastErr) {
          // If we broke early due to chunk size reduction, retry same offset with new chunkSize
          if (/reintentando con bloque de \d+ B\)?$/.test(lastErr.message || '')) {
            continue;
          }
          throw new Error(`${lastErr.message || lastErr} (offset ${offset} de ${file.size})`);
        }
        offset = end;
        chunksSinceYield++;
        onProgress(offset, file.size);
        // pacing: give the device time to commit flash writes during sustained transfers
        const paceMs = chunkSize <= 15 ? 25 : (chunkSize <= 177 ? 12 : 8);
        await new Promise(r => setTimeout(r, paceMs));
        // extra periodic yield
        if (chunksSinceYield >= 20) {
          chunksSinceYield = 0;
          await new Promise(r => setTimeout(r, 30));
        }
      }
    } finally {
      await this.closeFile(fileId).catch(() => {});
    }
  }
}

export function isWebBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}
