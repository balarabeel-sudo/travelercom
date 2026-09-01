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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawCheckBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.green
  ctx.fill()

  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 2.8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.42, cy + 1)
  ctx.lineTo(cx - r * 0.1, cy + r * 0.38)
  ctx.lineTo(cx + r * 0.45, cy - r * 0.32)
  ctx.stroke()
}

function drawBedIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 18) {
  ctx.strokeStyle = COLORS.navy
  ctx.fillStyle = COLORS.navy
  ctx.lineWidth = 1.7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // mattress
  roundRect(ctx, x, y + size * 0.42, size, size * 0.38, 3)
  ctx.stroke()

  // headboard
  ctx.beginPath()
  ctx.moveTo(x, y + size * 0.42)
  ctx.lineTo(x, y + size * 0.12)
  ctx.lineTo(x + size * 0.38, y + size * 0.12)
  ctx.stroke()

  // pillow
  ctx.beginPath()
  ctx.ellipse(x + size * 0.22, y + size * 0.3, size * 0.15, size * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawCalendarIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 16) {
  ctx.strokeStyle = COLORS.navy
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'

  roundRect(ctx, x, y + 3, size, size - 3, 2.5)
  ctx.stroke()

  // top bar
  ctx.beginPath()
  ctx.moveTo(x, y + 8)
  ctx.lineTo(x + size, y + 8)
  ctx.stroke()

  // pins
  ctx.beginPath()
  ctx.moveTo(x + 4, y + 1)
  ctx.lineTo(x + 4, y + 6)
  ctx.moveTo(x + size - 4, y + 1)
  ctx.lineTo(x + size - 4, y + 6)
  ctx.stroke()
}

function drawMoonIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 16) {
  ctx.fillStyle = COLORS.navy
  ctx.beginPath()
  ctx.arc(x + size * 0.55, y + size * 0.5, size * 0.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.arc(x + size * 0.72, y + size * 0.38, size * 0.32, 0, Math.PI * 2)
  ctx.fill()
}

function drawPersonIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 16) {
  ctx.fillStyle = COLORS.navy
  // head
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size * 0.28, size * 0.22, 0, Math.PI * 2)
  ctx.fill()
  // body
  ctx.beginPath()
  ctx.ellipse(x + size / 2, y + size * 0.72, size * 0.3, size * 0.26, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawEnvelopeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 16) {
  ctx.strokeStyle = COLORS.navy
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  roundRect(ctx, x, y + 2, size, size - 3, 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x + 1, y + 4)
  ctx.lineTo(x + size / 2, y + size * 0.55)
  ctx.lineTo(x + size - 1, y + 4)
  ctx.stroke()
}

function drawPhoneIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size = 15) {
  ctx.strokeStyle = COLORS.navy
  ctx.lineWidth = 1.7
  ctx.lineCap = 'round'

  roundRect(ctx, x + 2.5, y, size - 5, size, 3.5)
  ctx.stroke()

  // speaker line
  ctx.beginPath()
  ctx.moveTo(x + size * 0.38, y + size - 3.5)
  ctx.lineTo(x + size * 0.62, y + size - 3.5)
  ctx.stroke()
}

export async function downloadReceiptImage(data: ReceiptData) {
  const scale = 2
  const width = 720
  const rowH = 40
  const detailsH = data.rows.length * rowH
  const height = 980 + detailsH

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)

  // ===================== BACKGROUND =====================
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // ===================== TOP HEADER =====================
  // dark navy base
  ctx.fillStyle = COLORS.navy
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(width, 0)
  ctx.lineTo(width, 118)
  ctx.quadraticCurveTo(width * 0.72, 148, width * 0.5, 132)
  ctx.quadraticCurveTo(width * 0.22, 118, 0, 138)
  ctx.closePath()
  ctx.fill()

  // orange accent curves (top right style)
  ctx.strokeStyle = COLORS.secondary
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(width * 0.55, 0)
  ctx.quadraticCurveTo(width * 0.78, 55, width, 38)
  ctx.stroke()

  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(width * 0.62, 0)
  ctx.quadraticCurveTo(width * 0.85, 70, width, 55)
  ctx.stroke()

  // Logo
  const logoImg = await loadImage(logo)
  const logoSize = 52
  if (logoImg) {
    ctx.drawImage(logoImg, 36, 32, logoSize, logoSize)
  }

  // Brand name
  ctx.textAlign = 'left'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 24px Arial, sans-serif'
  const brandX = 100
  ctx.fillText('TRAVELER', brandX, 52)
  const travelerW = ctx.measureText('TRAVELER').width
  ctx.fillStyle = COLORS.secondary
  ctx.fillText('.COM', brandX + travelerW, 52)

  // Tagline
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.font = '12.5px Arial, sans-serif'
  ctx.fillText('Your Journey, One Platform.', brandX, 74)

  // RECEIPT badge (top right)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, width - 188, 26, 158, 62, 12)
  ctx.fill()

  ctx.textAlign = 'right'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 13px Arial, sans-serif'
  ctx.fillText('RECEIPT', width - 48, 48)

  ctx.font = '11px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText('Thank you for choosing', width - 48, 66)
  ctx.fillStyle = COLORS.secondary
  ctx.font = 'bold 11.5px Arial, sans-serif'
  ctx.fillText('Traveler.com', width - 48, 82)

  // ===================== SUCCESS + BOOKING REF =====================
  let y = 168

  // Success
  drawCheckBadge(ctx, 52, y + 12, 17)
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.green
  ctx.font = 'bold 16px Arial, sans-serif'
  ctx.fillText('PAYMENT SUCCESSFUL', 80, y + 8)
  ctx.fillStyle = COLORS.textMuted
  ctx.font = '12.5px Arial, sans-serif'
  ctx.fillText('Your payment has been processed successfully.', 80, y + 28)

  // Booking Reference card
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1.5
  roundRect(ctx, width - 248, y - 8, 218, 74, 14)
  ctx.stroke()

  ctx.fillStyle = COLORS.textMuted
  ctx.font = '10px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('BOOKING REFERENCE', width - 230, y + 10)

  ctx.fillStyle = COLORS.navy
  ctx.font = 'bold 15px Arial, sans-serif'
  ctx.fillText(data.bookingReference, width - 230, y + 32)

  ctx.fillStyle = COLORS.textMuted
  ctx.font = '12px Arial, sans-serif'
  ctx.fillText('📅  ' + (data.paymentDate || '—'), width - 230, y + 52)

  // ===================== AMOUNT + ROOM CARD =====================
  y = 270

  // Amount Paid
  ctx.fillStyle = COLORS.navy
  roundRect(ctx, 32, y, 300, 96, 18)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '11px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('AMOUNT PAID', 54, y + 28)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 34px Arial, sans-serif'
  const amountStr = `₦${data.amountPaid.toLocaleString()}`
  ctx.fillText(amountStr, 54, y + 68)

  const amountW = ctx.measureText(amountStr).width
  ctx.font = '14px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('NGN', 54 + amountW + 10, y + 66)

  // Room card
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1.5
  roundRect(ctx, width - 350, y, 318, 96, 18)
  ctx.stroke()

  // circular icon bg
  ctx.fillStyle = COLORS.lightGray
  ctx.beginPath()
  ctx.arc(width - 300, y + 48, 26, 0, Math.PI * 2)
  ctx.fill()
  drawBedIcon(ctx, width - 309, y + 39, 18)

  ctx.fillStyle = COLORS.navy
  ctx.font = 'bold 16px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(data.serviceName || 'Executive Room', width - 260, y + 40)

  ctx.fillStyle = COLORS.textMuted
  ctx.font = '13px Arial, sans-serif'
  ctx.fillText('📍  ' + (data.subtitle || 'Abuja'), width - 260, y + 62)

  // ===================== BOOKING DETAILS =====================
  y = 400

  // center label
  ctx.fillStyle = COLORS.navy
  roundRect(ctx, width / 2 - 90, y - 14, 180, 30, 15)
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 12.5px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('BOOKING DETAILS', width / 2, y + 5)

  // lines on sides of label
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(32, y + 1)
  ctx.lineTo(width / 2 - 100, y + 1)
  ctx.moveTo(width / 2 + 100, y + 1)
  ctx.lineTo(width - 32, y + 1)
  ctx.stroke()

  y += 48

  const iconFns = [
    drawBedIcon,
    drawCalendarIcon,
    drawCalendarIcon,
    drawMoonIcon,
    drawPersonIcon,
    drawEnvelopeIcon,
    drawPhoneIcon,
  ]

  data.rows.forEach((row, i) => {
    const drawIcon = iconFns[i % iconFns.length]
    drawIcon(ctx, 42, y - 9, 17)

    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.textMuted
    ctx.font = '13.5px Arial, sans-serif'
    ctx.fillText(row.label, 74, y + 4)

    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 13.5px Arial, sans-serif'
    ctx.fillText(row.value, width - 42, y + 4)

    if (i < data.rows.length - 1) {
      ctx.strokeStyle = '#F1F5F9'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(74, y + 20)
      ctx.lineTo(width - 42, y + 20)
      ctx.stroke()
    }

    y += rowH
  })

  // ===================== PAYMENT SUMMARY =====================
  y += 18

  // outer container
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1.5
  roundRect(ctx, 32, y, width - 64, 108, 16)
  ctx.stroke()

  // left content
  ctx.fillStyle = COLORS.navy
  ctx.font = 'bold 12.5px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('PAYMENT SUMMARY', 52, y + 28)

  ctx.fillStyle = COLORS.textMuted
  ctx.font = '13px Arial, sans-serif'
  ctx.fillText('Payment Method', 52, y + 56)
  ctx.fillText('Transaction ID', 52, y + 80)

  ctx.fillStyle = COLORS.text
  ctx.font = '13.5px Arial, sans-serif'
  ctx.fillText('Traveler.com Wallet', 200, y + 56)
  ctx.fillText(
    'TRX-' + (data.paymentDate ? data.paymentDate.replace(/\D/g, '').slice(0, 10) : '202605241045'),
    200,
    y + 80
  )

  // right dark total box
  ctx.fillStyle = COLORS.navy
  roundRect(ctx, width - 248, y + 8, 200, 92, 14)
  ctx.fill()

  // orange right accent
  ctx.fillStyle = COLORS.secondary
  ctx.fillRect(width - 52, y + 18, 6, 72)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '11px Arial, sans-serif'
  ctx.fillText('TOTAL PAID', width - 148, y + 32)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 26px Arial, sans-serif'
  ctx.fillText(`₦${data.amountPaid.toLocaleString()}`, width - 148, y + 62)

  ctx.fillStyle = COLORS.green
  ctx.font = 'bold 11.5px Arial, sans-serif'
  ctx.fillText('PAID IN FULL', width - 148, y + 84)

  // ===================== BOTTOM NOTE =====================
  y += 128

  ctx.fillStyle = '#F1F5F9'
  roundRect(ctx, 32, y, width - 64, 54, 12)
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.textMuted
  ctx.font = '11.5px Arial, sans-serif'
  ctx.fillText('🛡️  This is a system generated receipt and does not require a signature.', 48, y + 22)
  ctx.fillText('For any support, contact us via help@traveler.com', 48, y + 40)

  ctx.textAlign = 'right'
  ctx.fillStyle = COLORS.navy
  ctx.font = 'italic 14px Georgia, serif'
  ctx.fillText('Thank you!', width - 48, y + 24)
  ctx.font = '11.5px Arial, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText('We wish you a pleasant stay.', width - 48, y + 42)

  // ===================== FOOTER =====================
  const footerY = height - 78
  ctx.fillStyle = COLORS.navy
  ctx.fillRect(0, footerY, width, 78)

  // orange top curves
  ctx.strokeStyle = COLORS.secondary
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(0, footerY)
  ctx.quadraticCurveTo(width * 0.28, footerY - 18, width * 0.5, footerY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(width * 0.55, footerY)
  ctx.quadraticCurveTo(width * 0.82, footerY + 22, width, footerY)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.font = '11.5px Arial, sans-serif'
  ctx.textAlign = 'left'

  ctx.fillText('🌐  Website', 36, footerY + 30)
  ctx.fillText('www.traveler.com', 36, footerY + 48)

  ctx.fillText('🎧  Support', 210, footerY + 30)
  ctx.fillText('help@traveler.com', 210, footerY + 48)

  ctx.fillText('📞  Phone', 400, footerY + 30)
  ctx.fillText('+234 806 123 4567', 400, footerY + 48)

  ctx.textAlign = 'right'
  ctx.fillText('Follow us', width - 36, footerY + 30)
  ctx.font = '15px Arial, sans-serif'
  ctx.fillText('f   𝕏   📷   ▶', width - 36, footerY + 50)

  // ===================== DOWNLOAD =====================
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
