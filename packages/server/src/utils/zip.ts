type ZipEntryInput = {
  name: string
  data: ArrayBuffer | Uint8Array | string
  modifiedAt?: Date
}

type PreparedZipEntry = {
  name: Uint8Array
  data: Uint8Array
  crc: number
  compressedSize: number
  uncompressedSize: number
  modTime: number
  modDate: number
  offset: number
}

const encoder = new TextEncoder()
const crcTable = makeCrcTable()

function makeCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1
    }
    return value >>> 0
  })
}

function crc32(data: Uint8Array) {
  let value = 0xFFFFFFFF
  for (const byte of data) {
    value = crcTable[(value ^ byte) & 0xFF] ^ (value >>> 8)
  }
  return (value ^ 0xFFFFFFFF) >>> 0
}

function toUint8Array(data: ArrayBuffer | Uint8Array | string) {
  if (typeof data === 'string')
    return encoder.encode(data)
  if (data instanceof Uint8Array)
    return data
  return new Uint8Array(data)
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980)
  const modTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const modDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { modTime, modDate }
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function makeLocalHeader(entry: PreparedZipEntry) {
  const header = new Uint8Array(30)
  const view = new DataView(header.buffer)
  writeUint32(view, 0, 0x04034B50)
  writeUint16(view, 4, 20)
  writeUint16(view, 6, 0x0800)
  writeUint16(view, 8, 0)
  writeUint16(view, 10, entry.modTime)
  writeUint16(view, 12, entry.modDate)
  writeUint32(view, 14, entry.crc)
  writeUint32(view, 18, entry.compressedSize)
  writeUint32(view, 22, entry.uncompressedSize)
  writeUint16(view, 26, entry.name.length)
  writeUint16(view, 28, 0)
  return concat([header, entry.name, entry.data])
}

function makeCentralDirectoryHeader(entry: PreparedZipEntry) {
  const header = new Uint8Array(46)
  const view = new DataView(header.buffer)
  writeUint32(view, 0, 0x02014B50)
  writeUint16(view, 4, 20)
  writeUint16(view, 6, 20)
  writeUint16(view, 8, 0x0800)
  writeUint16(view, 10, 0)
  writeUint16(view, 12, entry.modTime)
  writeUint16(view, 14, entry.modDate)
  writeUint32(view, 16, entry.crc)
  writeUint32(view, 20, entry.compressedSize)
  writeUint32(view, 24, entry.uncompressedSize)
  writeUint16(view, 28, entry.name.length)
  writeUint16(view, 30, 0)
  writeUint16(view, 32, 0)
  writeUint16(view, 34, 0)
  writeUint16(view, 36, 0)
  writeUint32(view, 38, 0)
  writeUint32(view, 42, entry.offset)
  return concat([header, entry.name])
}

function makeEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  const header = new Uint8Array(22)
  const view = new DataView(header.buffer)
  writeUint32(view, 0, 0x06054B50)
  writeUint16(view, 4, 0)
  writeUint16(view, 6, 0)
  writeUint16(view, 8, entryCount)
  writeUint16(view, 10, entryCount)
  writeUint32(view, 12, centralDirectorySize)
  writeUint32(view, 16, centralDirectoryOffset)
  writeUint16(view, 20, 0)
  return header
}

function createZip(entries: ZipEntryInput[]) {
  let offset = 0
  const preparedEntries = entries.map((entry) => {
    const data = toUint8Array(entry.data)
    const { modTime, modDate } = dosDateTime(entry.modifiedAt)
    const preparedEntry = {
      name: encoder.encode(entry.name),
      data,
      crc: crc32(data),
      compressedSize: data.length,
      uncompressedSize: data.length,
      modTime,
      modDate,
      offset,
    }
    offset += 30 + preparedEntry.name.length + data.length
    return preparedEntry
  })

  const localParts = preparedEntries.map(makeLocalHeader)
  const centralDirectoryParts = preparedEntries.map(makeCentralDirectoryHeader)
  const centralDirectory = concat(centralDirectoryParts)
  const endOfCentralDirectory = makeEndOfCentralDirectory(
    preparedEntries.length,
    centralDirectory.length,
    offset,
  )

  return concat([...localParts, centralDirectory, endOfCentralDirectory])
}

export { createZip }
