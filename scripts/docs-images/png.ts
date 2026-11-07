import { crc32, deflateSync } from 'node:zlib'

/** minimal PNG encoder - 8-bit RGB, no filtering; enough for renders */
export function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  // every row starts with a filter-type byte, 0 = none
  const rows = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    rows[y * (1 + width * 3)] = 0
    rows.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (1 + width * 3) + 1)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bits per channel
  header[9] = 2 // colour type: RGB

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}
