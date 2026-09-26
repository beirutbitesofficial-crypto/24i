// Browser-side "fast start" for MP4/MOV uploads.
//
// Most cameras and editors write the `moov` box (the index a player needs before it can
// start) at the END of the file, so a player must fetch the tail of the file before
// playback can begin. This moves `moov` in front of the media data and shifts the chunk
// offsets it contains, exactly like `ffmpeg -movflags +faststart`, without re-encoding.
//
// Only box headers and the `moov` box itself are read into memory; the (large) media
// data is re-assembled from Blob slices, so this is cheap even for big files on phones.
// Any file it does not fully understand is returned unchanged.

type Box = { type: string; start: number; size: number; headerSize: number };

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl"]);
const MAX_MOOV_BYTES = 64 * 1024 * 1024;

const fourcc = (view: DataView, at: number) =>
  String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));

async function topLevelBoxes(file: Blob): Promise<Box[] | null> {
  const boxes: Box[] = [];
  let pos = 0;
  while (pos < file.size) {
    if (file.size - pos < 8 || boxes.length > 10_000) return null;
    const header = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
    let size = header.getUint32(0);
    let headerSize = 8;
    if (size === 1) {
      if (header.byteLength < 16) return null;
      size = Number(header.getBigUint64(8));
      headerSize = 16;
    } else if (size === 0) {
      size = file.size - pos;
    }
    if (size < headerSize || pos + size > file.size) return null;
    boxes.push({ type: fourcc(header, 4), start: pos, size, headerSize });
    pos += size;
  }
  return boxes;
}

// Shifts every chunk offset that points into [from, to) by `shift`. Returns false if the
// structure is unexpected or a 32-bit offset would overflow.
function patchChunkOffsets(view: DataView, start: number, end: number, from: number, to: number, shift: number): boolean {
  let pos = start;
  while (pos + 8 <= end) {
    let size = view.getUint32(pos);
    const type = fourcc(view, pos + 4);
    let headerSize = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(pos + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < headerSize || pos + size > end) return false;
    const body = pos + headerSize;

    if (type === "cmov") return false; // compressed movie header: leave the file alone
    if (CONTAINERS.has(type)) {
      if (!patchChunkOffsets(view, body, pos + size, from, to, shift)) return false;
    } else if (type === "stco" || type === "co64") {
      const wide = type === "co64";
      const count = view.getUint32(body + 4);
      if (body + 8 + count * (wide ? 8 : 4) > pos + size) return false;
      for (let i = 0; i < count; i++) {
        const at = body + 8 + i * (wide ? 8 : 4);
        const offset = wide ? Number(view.getBigUint64(at)) : view.getUint32(at);
        if (offset < from || offset >= to) continue;
        const next = offset + shift;
        if (wide) view.setBigUint64(at, BigInt(next));
        else if (next > 0xffffffff) return false;
        else view.setUint32(at, next);
      }
    }
    pos += size;
  }
  return pos === end;
}

export function isVideoForFastStart(file: File) {
  return /^video\/(mp4|quicktime|x-m4v)$/.test(file.type) || /\.(mp4|mov|m4v)$/i.test(file.name);
}

export async function fastStart(file: File): Promise<File> {
  if (!isVideoForFastStart(file)) return file;
  try {
    const boxes = await topLevelBoxes(file);
    if (!boxes || boxes.some((box) => box.type === "moof")) return file; // fragmented MP4s already stream
    const moov = boxes.find((box) => box.type === "moov");
    const firstMdat = boxes.find((box) => box.type === "mdat");
    if (!moov || !firstMdat || moov.start < firstMdat.start) return file; // already fast start
    if (moov.size > MAX_MOOV_BYTES) return file;

    const moovBytes = new Uint8Array(await file.slice(moov.start, moov.start + moov.size).arrayBuffer());
    const view = new DataView(moovBytes.buffer);
    // Media stored between the first mdat and the old moov position moves forward by moov's size.
    if (!patchChunkOffsets(view, moov.headerSize, moov.size, firstMdat.start, moov.start, moov.size)) return file;

    const parts: BlobPart[] = [];
    for (const box of boxes) {
      if (box === firstMdat) parts.push(moovBytes);
      if (box !== moov) parts.push(file.slice(box.start, box.start + box.size));
    }
    const result = new File(parts, file.name, { type: file.type, lastModified: file.lastModified });
    return result.size === file.size ? result : file;
  } catch {
    return file;
  }
}
