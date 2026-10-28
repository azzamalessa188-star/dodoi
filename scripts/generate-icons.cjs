'use strict'

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const BUILD_DIR = path.join(__dirname, '..', 'build')
const MASTER_SIZE = 1024

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuffer, data])
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(body), 8 + data.length)
  return chunk
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rowLength = width * 4 + 1
  const raw = Buffer.alloc(rowLength * height)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowLength
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function smoothCoverage(distance, feather = 1) {
  return clamp01(0.5 - distance / feather)
}

function roundedRectSdf(x, y, cx, cy, halfWidth, halfHeight, radius) {
  const qx = Math.abs(x - cx) - halfWidth + radius
  const qy = Math.abs(y - cy) - halfHeight + radius
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

function segmentDistance(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : clamp01(((x - x1) * dx + (y - y1) * dy) / lengthSquared)
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

function blendPixel(buffer, offset, r, g, b, alpha) {
  if (alpha <= 0) return
  const sourceAlpha = clamp01(alpha)
  const destinationAlpha = buffer[offset + 3] / 255
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha)
  if (outputAlpha <= 0) return

  buffer[offset] = Math.round(
    (r * sourceAlpha + buffer[offset] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha,
  )
  buffer[offset + 1] = Math.round(
    (g * sourceAlpha + buffer[offset + 1] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha,
  )
  buffer[offset + 2] = Math.round(
    (b * sourceAlpha + buffer[offset + 2] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha,
  )
  buffer[offset + 3] = Math.round(outputAlpha * 255)
}

function drawLine(buffer, size, x1, y1, x2, y2, width, color) {
  const padding = width
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - padding))
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + padding))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - padding))
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + padding))
  const halfWidth = width / 2

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = segmentDistance(x + 0.5, y + 0.5, x1, y1, x2, y2) - halfWidth
      const coverage = smoothCoverage(distance, 1.15)
      if (coverage > 0) {
        const offset = (y * size + x) * 4
        blendPixel(buffer, offset, color[0], color[1], color[2], coverage)
      }
    }
  }
}

function drawArrows(buffer, size, color) {
  const scale = size / 1024
  const stroke = 54 * scale

  drawLine(buffer, size, 238 * scale, 377 * scale, 748 * scale, 377 * scale, stroke, color)
  drawLine(buffer, size, 642 * scale, 271 * scale, 748 * scale, 377 * scale, stroke, color)
  drawLine(buffer, size, 642 * scale, 483 * scale, 748 * scale, 377 * scale, stroke, color)

  drawLine(buffer, size, 786 * scale, 647 * scale, 276 * scale, 647 * scale, stroke, color)
  drawLine(buffer, size, 382 * scale, 541 * scale, 276 * scale, 647 * scale, stroke, color)
  drawLine(buffer, size, 382 * scale, 753 * scale, 276 * scale, 647 * scale, stroke, color)
}

function renderIcon(size = MASTER_SIZE) {
  const buffer = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      const distance = roundedRectSdf(
        x + 0.5,
        y + 0.5,
        size / 2,
        size / 2,
        size * 0.445,
        size * 0.445,
        size * 0.215,
      )
      const alpha = smoothCoverage(distance, 1.8)
      if (alpha <= 0) continue

      const t = clamp01((x / size) * 0.54 + (y / size) * 0.46)
      const highlight = Math.max(0, 1 - Math.hypot(x / size - 0.25, y / size - 0.1) / 0.65) * 0.08

      const r = Math.round(226 - 57 * t + 255 * highlight)
      const g = Math.round(255 - 18 * t + 255 * highlight)
      const b = Math.round(151 - 61 * t + 255 * highlight)

      buffer[offset] = Math.min(255, r)
      buffer[offset + 1] = Math.min(255, g)
      buffer[offset + 2] = Math.min(255, b)
      buffer[offset + 3] = Math.round(alpha * 255)
    }
  }

  drawArrows(buffer, size, [18, 24, 12])
  return buffer
}

function renderTemplate(size = 512) {
  const buffer = Buffer.alloc(size * size * 4)
  const scale = size / 1024
  const color = [0, 0, 0]
  const stroke = 64 * scale

  drawLine(buffer, size, 200 * scale, 377 * scale, 780 * scale, 377 * scale, stroke, color)
  drawLine(buffer, size, 664 * scale, 261 * scale, 780 * scale, 377 * scale, stroke, color)
  drawLine(buffer, size, 664 * scale, 493 * scale, 780 * scale, 377 * scale, stroke, color)

  drawLine(buffer, size, 824 * scale, 647 * scale, 244 * scale, 647 * scale, stroke, color)
  drawLine(buffer, size, 360 * scale, 531 * scale, 244 * scale, 647 * scale, stroke, color)
  drawLine(buffer, size, 360 * scale, 763 * scale, 244 * scale, 647 * scale, stroke, color)

  return buffer
}

function resizePreMultiplying(source, sourceSize, targetSize) {
  const output = Buffer.alloc(targetSize * targetSize * 4)
  const scale = sourceSize / targetSize

  for (let y = 0; y < targetSize; y += 1) {
    const y0 = Math.floor(y * scale)
    const y1 = Math.min(sourceSize, Math.ceil((y + 1) * scale))
    for (let x = 0; x < targetSize; x += 1) {
      const x0 = Math.floor(x * scale)
      const x1 = Math.min(sourceSize, Math.ceil((x + 1) * scale))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let count = 0

      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const offset = (sy * sourceSize + sx) * 4
          const alpha = source[offset + 3] / 255
          r += source[offset] * alpha
          g += source[offset + 1] * alpha
          b += source[offset + 2] * alpha
          a += alpha
          count += 1
        }
      }

      if (!count || a <= 0) continue
      const offset = (y * targetSize + x) * 4
      output[offset] = Math.round(r / a)
      output[offset + 1] = Math.round(g / a)
      output[offset + 2] = Math.round(b / a)
      output[offset + 3] = Math.round((a / count) * 255)
    }
  }

  return output
}

function writePng(filename, source, sourceSize, targetSize) {
  const pixels = sourceSize === targetSize ? source : resizePreMultiplying(source, sourceSize, targetSize)
  fs.writeFileSync(path.join(BUILD_DIR, filename), encodePng(targetSize, targetSize, pixels))
}

function buildIco(sizes, source, sourceSize) {
  const images = sizes.map((size) => ({
    size,
    png:
      size === sourceSize
        ? encodePng(size, size, source)
        : encodePng(size, size, resizePreMultiplying(source, sourceSize, size)),
  }))

  const headerSize = 6 + images.length * 16
  let offset = headerSize
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  images.forEach((image, index) => {
    const entryOffset = 6 + index * 16
    header[entryOffset] = image.size >= 256 ? 0 : image.size
    header[entryOffset + 1] = image.size >= 256 ? 0 : image.size
    header[entryOffset + 2] = 0
    header[entryOffset + 3] = 0
    header.writeUInt16LE(1, entryOffset + 4)
    header.writeUInt16LE(32, entryOffset + 6)
    header.writeUInt32LE(image.png.length, entryOffset + 8)
    header.writeUInt32LE(offset, entryOffset + 12)
    offset += image.png.length
  })

  return Buffer.concat([header, ...images.map((image) => image.png)])
}

function buildIcns(source, sourceSize) {
  const definitions = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
  ]

  const entries = definitions.map(([type, size]) => {
    const pixels =
      size === sourceSize
        ? source
        : resizePreMultiplying(source, sourceSize, size)
    const png = encodePng(size, size, pixels)
    const entry = Buffer.alloc(8 + png.length)
    entry.write(type, 0, 'ascii')
    entry.writeUInt32BE(8 + png.length, 4)
    png.copy(entry, 8)
    return entry
  })

  const totalLength = 8 + entries.reduce((sum, entry) => sum + entry.length, 0)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 'ascii')
  header.writeUInt32BE(totalLength, 4)
  return Buffer.concat([header, ...entries])
}

function renderDmgBackground(width = 540, height = 380) {
  const buffer = Buffer.alloc(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const t = clamp01((x / width) * 0.35 + (y / height) * 0.65)
      const glow =
        Math.max(0, 1 - Math.hypot(x / width - 0.2, y / height - 0.08) / 0.65) * 0.05
      buffer[offset] = Math.min(255, Math.round(250 - 12 * t + 255 * glow))
      buffer[offset + 1] = Math.min(255, Math.round(253 - 8 * t + 255 * glow))
      buffer[offset + 2] = Math.min(255, Math.round(244 - 24 * t + 255 * glow))
      buffer[offset + 3] = 255
    }
  }

  const arrow = Buffer.alloc(96 * 96 * 4)
  const stroke = 6
  const color = [111, 128, 97]
  drawLine(arrow, 96, 18, 48, 78, 48, stroke, color)
  drawLine(arrow, 96, 62, 32, 78, 48, stroke, color)
  drawLine(arrow, 96, 62, 64, 78, 48, stroke, color)

  const originX = Math.round(width / 2 - 48)
  const originY = 190 - 48
  for (let y = 0; y < 96; y += 1) {
    for (let x = 0; x < 96; x += 1) {
      const sourceOffset = (y * 96 + x) * 4
      const alpha = (arrow[sourceOffset + 3] / 255) * 0.6
      if (alpha <= 0) continue
      const targetX = originX + x
      const targetY = originY + y
      if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue
      blendPixel(
        buffer,
        (targetY * width + targetX) * 4,
        arrow[sourceOffset],
        arrow[sourceOffset + 1],
        arrow[sourceOffset + 2],
        alpha,
      )
    }
  }

  return buffer
}

function main() {
  fs.mkdirSync(BUILD_DIR, { recursive: true })

  const master = renderIcon(MASTER_SIZE)
  const templateMaster = renderTemplate(512)

  writePng('icon.png', master, MASTER_SIZE, 1024)
  writePng('tray.png', master, MASTER_SIZE, 32)
  writePng('trayTemplate.png', templateMaster, 512, 16)
  writePng('trayTemplate@2x.png', templateMaster, 512, 32)

  fs.writeFileSync(
    path.join(BUILD_DIR, 'dmg-background.png'),
    encodePng(540, 380, renderDmgBackground(540, 380)),
  )
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), buildIco([16, 32, 48, 64, 128, 256], master, MASTER_SIZE))
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.icns'), buildIcns(master, MASTER_SIZE))

  console.log('Generated build/icon.png, icon.ico, icon.icns, dmg-background.png and tray icons.')
}

main()
