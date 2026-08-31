import logo from './assets/logo.png'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  navy: '#0B1E3D',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16A34A',
  bg: '#F8FAFC',
}

export type ReceiptRow = { label: string; value: string }

export type ReceiptData = {
  serviceName: string
  subtitle?: string
  bookingReference: string
  rows: ReceiptRow[]
  amountPaid: number
  paymentDate?: string
  filenamePrefix?: string
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
  ctx.save()
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
  ctx.restore()
}

function drawCheckBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.green
  ctx.fill()
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.45, cy)
  ctx.lineTo(cx - r * 0.12, cy + r * 0.35)
  ctx.lineTo(cx + r * 0.45, cy - r * 0.35)
  ctx.stroke()
}

// Renders a branded, Opay-style booking receipt to a PNG and triggers a download.
// Nothing here is invented — every value comes from the real, already-confirmed booking.
export async function downloadReceiptImage(data: ReceiptData) {
  const scale = 2
  const width = 760
  const rowHeight = 32
  const topSectionHeight = 300
  const bottomPadding = 90
  const height = topSectionHeight + data.rows.length * rowHeight + bottomPadding

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)

  // page background
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, width, height)

  // card
  const cardX = 20, cardY = 20, cardW = width - 40, cardH = height - 40
  ctx.save()
  ctx.shadowColor = 'rgba(15,23,42,0.10)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  roundRect(ctx, cardX, cardY, cardW, cardH, 22)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.restore()

  // logo
  const logoImg = await loadImage(logo)
  const logoSize = 60
  let cursorY = cardY + 34
  if (logoImg) {
    ctx.drawImage(logoImg, width / 2 - logoSize / 2, cursorY, logoSize, logoSize)
  }
  cursorY += logoSize + 20

  // wordmark
  ctx.textAlign = 'center'
  ctx.fillStyle = COLORS.navy
  ctx.font = 'bold 19px Arial, sans-serif'
  ctx.fillText('TRAVELER.COM', width / 2, cursorY)

  // gradient accent bar
  cursorY += 22
  const grad = ctx.createLinearGradient(cardX + 60, 0, cardX + cardW - 60, 0)
  grad.addColorStop(0, COLORS.primary)
  grad.addColorStop(1, COLORS.secondary)
  ctx.fillStyle = grad
  roundRect(ctx, cardX + 60, cursorY, cardW - 120, 4, 2)
  ctx.fill()

  // payment success badge
  cursorY += 34
  drawCheckBadge(ctx, width / 2, cursorY + 12, 14)
  cursorY += 40
  ctx.fillStyle = COLORS.green
  ctx.font = 'bold 12px Arial, sans-serif'
  ctx.fillText('PAYMENT SUCCESSFUL', width / 2, cursorY)

  // amount
  cursorY += 40
  ctx.fillStyle = COLORS.text
  ctx.font = 'bold 32px Arial, sans-serif'
  ctx.fillText(`\u20A6${data.amountPaid.toLocaleString()}`, width / 2, cursorY)

  // service name / subtitle
  cursorY += 26
  ctx.fillStyle = COLORS.textMuted
  ctx.font = '13px Arial, sans-serif'
  ctx.fillText(data.serviceName, width / 2, cursorY)
  if (data.subtitle) {
    cursorY += 18
    ctx.fillText(data.subtitle, width / 2, cursorY)
  }

  // reference
  cursorY += 24
  ctx.font = '12px Arial, sans-serif'
  ctx.fillText(`Ref: ${data.bookingReference}`, width / 2, cursorY)

  // divider
  cursorY += 22
  drawDashedLine(ctx, cardX + 40, cursorY, cardX + cardW - 40)

  // detail rows
  cursorY += 28
  ctx.font = '13px Arial, sans-serif'
  for (const row of data.rows) {
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '13px Arial, sans-serif'
    ctx.fillText(row.label, cardX + 40, cursorY)
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 13px Arial, sans-serif'
    ctx.fillText(row.value, cardX + cardW - 40, cursorY)
    cursorY += rowHeight
  }

  // divider
  drawDashedLine(ctx, cardX + 40, cursorY, cardX + cardW - 40)
  cursorY += 28

  // footer
  ctx.textAlign = 'center'
  ctx.fillStyle = COLORS.textMuted
  ctx.font = '11.5px Arial, sans-serif'
  ctx.fillText('Traveler.com \u2014 Your Journey, One Platform.', width / 2, cursorY)
  if (data.paymentDate) {
    cursorY += 16
    ctx.fillText(data.paymentDate, width / 2, cursorY)
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `TravelerCom-${data.filenamePrefix || 'Receipt'}-${data.bookingReference}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}
