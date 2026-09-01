import logo from './assets/logo.png'

const COLORS = {
  primary: '#0EA5E9',
  secondary: '#F97316',
  navy: '#0B1E3D',
  navyDark: '#071428',
  text: '#1A1A1A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  green: '#16A34A',
  bg: '#FFFFFF',
  lightGray: '#F8FAFC',
  cardBg: '#F1F5F9',
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

function drawBedIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 16) {
  ctx.strokeStyle = COLORS.navy
  ctx.fillStyle = COLORS.navy
  ctx.lineWidth = 1.6
  // bed frame
  ctx.beginPath()
  ctx.roundRect(x, y + size * 0.45, size, size * 0.35, 2)
  ctx.stroke()
  // headboard
  ctx.beginPath()
  ctx.moveTo(x, y + size * 0.45)
  ctx.lineTo(x, y + size * 0.15)
  ctx.lineTo(x + size * 0.35, y + size * 0.15)
  ctx.stroke()
  // pillow
  ctx.beginPath()
  ctx.ellipse(x + size * 0.22, y + size * 0.32, size * 0.14, size * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawCalendarIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 15) {
  ctx.strokeStyle = COLORS.navy
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y + 2, size, size - 2, 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y + 6)
  ctx.lineTo(x + size, y + 6)
  ctx.stroke()
  // top pins
  ctx.beginPath()
  ctx.moveTo(x + 4, y)
  ctx.lineTo(x + 4, y + 4)
  ctx.moveTo(x + size - 4, y)
  ctx.lineTo(x + size - 4, y + 4)
  ctx.stroke()
}

function drawMoonIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 14) {
  ctx.fillStyle = COLORS.navy
  ctx.beginPath()
  ctx.arc(x + size * 0.55, y + size * 0.5, size * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(x + size * 0.75, y + size * 0.4, size * 0.35, 0, Math.PI * 2)
  ctx.fill()
}

function drawPersonIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 15) {
  ctx.fillStyle = COLORS.navy
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size * 0.28, size * 0.22, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + size / 2, y + size * 0.75, size * 0.32, size * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawEnvelopeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 15) {
  ctx.strokeStyle = COLORS.navy
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y + 2, size, size - 3, 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y + 4)
  ctx.lineTo(x + size / 2, y + size * 0.55)
  ctx.lineTo(x + size, y + 4)
  ctx.stroke()
}

function drawPhoneIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 14) {
  ctx.strokeStyle = COLORS.navy
  ctx.lineWidth = 1.6
  roundRect(ctx, x + 2, y, size - 4, size, 3)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.35, y + size - 3)
  ctx.lineTo(x + size * 0.65, y + size - 3)
  ctx.stroke()
}

// Renders a branded booking receipt matching the provided design
export async function downloadReceiptImage(data: ReceiptData) {
  const scale = 2
  const width = 700
  const rowHeight = 38
  const detailsHeight = data.rows.length * rowHeight
  const height = 920 + detailsHeight

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)

  // ========== BACKGROUND ==========
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // ========== TOP HEADER (dark navy with orange accents) ==========
  ctx.fillStyle = COLORS.navy
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(width, 0)
  ctx.lineTo(width, 110)
  ctx.quadraticCurveTo(width * 0.7, 135, width * 0.5, 125)
  ctx.quadraticCurveTo(width * 0.25, 115, 0, 130)
  ctx.closePath()
  ctx.fill()

  // orange accent curves on top
  ctx.strokeStyle = COLORS.secondary
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(width * 0.3, 40, width * 0.55, 20)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(width * 0.6, 0)
  ctx.quadraticCurveTo(width * 0.85, 50, width, 30)
  ctx.stroke()

  // Logo + Brand name (left)
  const logoImg = await loadImage(logo)
  const logoSize = 48
  if (logoImg) {
    ctx.drawImage(logoImg, 32, 28, logoSize, logoSize)
  }

  ctx.textAlign = 'left'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 22px Arial, sans-serif'
  ctx.fillText('TRAVELER', 92, 48)
  ctx.fillStyle = COLORS.secondary
  ctx.fillText('.COM', 92 + ctx.measureText('TRAVELER').width, 48)

  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '12px Arial, sans-serif'
  ctx.fillText('Your Journey, One Platform.', 92, 68)

  // RECEIPT badge (top right)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, width - 175, 22, 150, 58, 10)
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 13px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('🧾  RECEIPT', width - 40, 42)

  ctx.font = '11px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText('Thank you for choosing', width - 40, 58)
  ctx.fillStyle = COLORS.secondary
  ctx.font = 'bold 11px Arial, sans-serif'
  ctx.fillText('Traveler.com', width - 40, 72)

  // ========== PAYMENT SUCCESS + BOOKING REF ==========
  let y = 155

  // Green check + text
  drawCheckBadge(ctx, 48, y + 10, 16)
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.green
  ctx.font = 'bold 16px Arial, sans-serif'
  ctx.fillText('PAYMENT SUCCESSFUL', 76, y + 8)
  ctx.fillStyle = COLORS.textMuted
  ctx.font = '12px Arial, sans-serif'
  ctx.fillText('Your payment has been processed successfully.', 76, y + 26)

  // Booking Reference box (right)
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1.5
  roundRect(ctx, width - 240, y - 10, 210, 70, 12)
  ctx.stroke()

  ctx.fillStyle = COLORS.textMuted
  ctx.font = '10px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('BOOKING REFERENCE', width - 225, y + 8)
  ctx.fillStyle = COLORS.navy
  ctx.font = 'bold 15px Arial, sans-serif'
  ctx.fillText(data.bookingReference, width - 225, y + 28)

  ctx.fillStyle = COLORS.textMuted
  ctx.font = '11px Arial, sans-serif'
  ctx.fillText('📅  ' + (data.paymentDate || '—'), width - 225, y + 48)

  // ========== AMOUNT PAID + ROOM CARD ==========
  y = 250

  // Amount Paid box (left)
  ctx.fillStyle = COLORS.navy
  roundRect(ctx, 30, y, 280, 90, 16)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '11px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('AMOUNT PAID', 50, y + 28)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 32px Arial, sans-serif'
  ctx.fillText(`₦${data.amountPaid.toLocaleString()}`, 50, y + 62)
  ctx.font = '13px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText('NGN', 50 + ctx.measureText(`₦${data.amountPaid.toLocaleString()}`).width + 8, y + 60)

  // Room card (right)
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1.5
  roundRect(ctx, width - 340, y, 310, 90, 16)
  ctx.stroke()

  // bed icon circle
  ctx.fillStyle = COLORS.lightGray
  ctx.beginPath()
  ctx.arc(width - 300, y + 45, 22, 0, Math.PI * 2)
  ctx.fill()
  drawBedIcon(ctx, width - 308, y + 37, 16)

  ctx.fillStyle = COLORS.navy
  ctx.font = 'bold 15px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(data.serviceName || 'Executive Room', width - 265, y + 38)

  ctx.fillStyle = COLORS.textMuted
  ctx.font = '12px Arial, sans-serif'
  ctx.fillText('📍  ' + (data.subtitle || 'Abuja'), width - 265, y + 58)

  // ========== BOOKING DETAILS SECTION ==========
  y = 370

  // section label
  ctx.fillStyle = COLORS.navy
  roundRect(ctx, width / 2 - 80, y - 14, 160, 28, 14)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 12px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('BOOKING DETAILS', width / 2, y + 4)

  // horizontal line
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(30, y + 20)
  ctx.lineTo(width - 30, y + 20)
  ctx.stroke()

  y += 50

  // Detail rows
  const iconDrawers = [
    drawBedIcon,
    drawCalendarIcon,
    drawCalendarIcon,
    drawMoonIcon,
    drawPersonIcon,
    drawEnvelopeIcon,
    drawPhoneIcon,
  ]

  data.rows.forEach((row, i) => {
    const iconFn = iconDrawers[i % iconDrawers.length]
    iconFn(ctx, 40, y - 10, 16)

    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '13px Arial, sans-serif'
    ctx.fillText(row.label, 70, y + 2)

    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 13px Arial, sans-serif'
    ctx.fillText(row.value, width - 40, y + 2)

    // separator line
    if (i < data.rows.length - 1) {
      ctx.strokeStyle = '#F1F5F9'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(70, y + 18)
      ctx.lineTo(width - 40, y + 18)
      ctx.stroke()
    }

    y += rowHeight
  })

  // ========== PAYMENT SUMMARY ==========
  y += 20

  // left white box
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1.5
  roundRect(ctx, 30, y, width - 60, 100, 14)
  ctx.fill()
  ctx.stroke()

  // right dark total box
  ctx.fillStyle = COLORS.navy
  roundRect(ctx, width - 230, y, 200, 100, 14)
  ctx.fill()

  // orange accent on right edge
  ctx.fillStyle = COLORS.secondary
  ctx.fillRect(width - 36, y + 10, 6, 80)

  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.navy
  ctx.font = 'bold 12px Arial, sans-serif'
  ctx.fillText('PAYMENT SUMMARY', 50, y + 28)

  ctx.fillStyle = COLORS.textMuted
  ctx.font = '12px Arial, sans-serif'
  ctx.fillText('Payment Method', 50, y + 52)
  ctx.fillText('Transaction ID', 50, y + 74)

  ctx.fillStyle = COLORS.text
  ctx.font = '13px Arial, sans-serif'
  ctx.fillText('Traveler.com Wallet', 180, y + 52)
  ctx.fillText('TRX-' + (data.paymentDate ? data.paymentDate.replace(/\D/g, '').slice(0, 10) : '202605241045'), 180, y + 74)

  // Total on dark side
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '11px Arial, sans-serif'
  ctx.fillText('TOTAL PAID', width - 130, y + 30)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 24px Arial, sans-serif'
  ctx.fillText(`₦${data.amountPaid.toLocaleString()}`, width - 130, y + 58)

  ctx.fillStyle = COLORS.green
  ctx.font = 'bold 11px Arial, sans-serif'
  ctx.fillText('PAID IN FULL', width - 130, y + 78)

  // ========== BOTTOM NOTE ==========
  y += 120

  ctx.fillStyle = '#F1F5F9'
  roundRect(ctx, 30, y, width - 60, 50, 10)
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.textMuted
  ctx.font = '11px Arial, sans-serif'
  ctx.fillText('🛡️  This is a system generated receipt and does not require a signature.', 45, y + 20)
  ctx.fillText('For any support, contact us via help@traveler.com', 45, y + 36)

  ctx.textAlign = 'right'
  ctx.fillStyle = COLORS.navy
  ctx.font = 'italic 13px Georgia, serif'
  ctx.fillText('Thank you!', width - 45, y + 22)
  ctx.font = '11px Arial, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText('We wish you a pleasant stay.', width - 45, y + 38)

  // ========== FOOTER BAR ==========
  const footerY = height - 70
  ctx.fillStyle = COLORS.navy
  ctx.fillRect(0, footerY, width, 70)

  // orange top accent lines
  ctx.strokeStyle = COLORS.secondary
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(0, footerY)
  ctx.quadraticCurveTo(width * 0.3, footerY - 15, width * 0.5, footerY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(width * 0.55, footerY)
  ctx.quadraticCurveTo(width * 0.8, footerY + 20, width, footerY)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '11px Arial, sans-serif'
  ctx.textAlign = 'left'

  ctx.fillText('🌐  Website', 30, footerY + 28)
  ctx.fillText('www.traveler.com', 30, footerY + 44)

  ctx.fillText('🎧  Support', 200, footerY + 28)
  ctx.fillText('help@traveler.com', 200, footerY + 44)

  ctx.fillText('📞  Phone', 380, footerY + 28)
  ctx.fillText('+234 806 123 4567', 380, footerY + 44)

  ctx.textAlign = 'right'
  ctx.fillText('Follow us', width - 30, footerY + 28)
  ctx.font = '16px Arial, sans-serif'
  ctx.fillText('f   𝕏   📷   ▶', width - 30, footerY + 48)

  // ========== DOWNLOAD ==========
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `TravelerCom-\( {data.filenamePrefix || 'Receipt'}- \){data.bookingReference}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}
