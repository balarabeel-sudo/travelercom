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

// Real, on-file contact info only — never the placeholder domain/email/phone from a template.
const SUPPORT_EMAIL = 'travelercom12@gmail.com'
const WEBSITE = 'travelercom.vercel.app'

export type ReceiptRow = { label: string; value: string; icon?: string }

export type ReceiptData = {
  category: 'hotel' | 'tour' | 'event_center' | 'bus' | 'train' | 'flight'
  serviceName: string
  serviceTypeLabel: string
  location: string
  bookingReference: string
  paymentDate?: string
  rows: ReceiptRow[]
  amountPaid: number
  transactionId?: string
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

function dottedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, color = COLORS.border) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.2
  ctx.setLineDash([2, 3])
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
  ctx.restore()
}

// ---------- hand-drawn line icons (Canvas can't render Icons.tsx's SVGs, so these mirror its style) ----------

type IconFn = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) => void

function withStroke(ctx: CanvasRenderingContext2D, color: string, width: number, fn: () => void) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  fn()
  ctx.restore()
}

const drawPerson: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.09, () => {
  ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.28, s * 0.18, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.95, s * 0.38, Math.PI, 0); ctx.stroke()
})

const drawMail: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.08, () => {
  roundRect(ctx, x, y + s * 0.15, s, s * 0.7, s * 0.08); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + s * 0.06, y + s * 0.2); ctx.lineTo(x + s / 2, y + s * 0.55); ctx.lineTo(x + s * 0.94, y + s * 0.2); ctx.stroke()
})

const drawPhone: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.09, () => {
  ctx.beginPath()
  ctx.moveTo(x + s * 0.25, y + s * 0.08)
  ctx.bezierCurveTo(x + s * 0.05, y + s * 0.25, x + s * 0.15, y + s * 0.55, x + s * 0.35, y + s * 0.75)
  ctx.bezierCurveTo(x + s * 0.55, y + s * 0.95, x + s * 0.8, y + s, x + s * 0.92, y + s * 0.8)
  ctx.stroke()
})

const drawBed: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.09, () => {
  ctx.beginPath(); ctx.moveTo(x + s * 0.08, y + s); ctx.lineTo(x + s * 0.08, y + s * 0.35); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + s * 0.92, y + s); ctx.lineTo(x + s * 0.92, y + s * 0.55); ctx.stroke()
  roundRect(ctx, x + s * 0.08, y + s * 0.35, s * 0.84, s * 0.2, s * 0.05); ctx.stroke()
  roundRect(ctx, x + s * 0.08, y + s * 0.55, s * 0.84, s * 0.22, s * 0.05); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + s * 0.08, y + s * 0.77); ctx.lineTo(x + s * 0.92, y + s * 0.77); ctx.stroke()
})

const drawCalendar: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.08, () => {
  roundRect(ctx, x + s * 0.05, y + s * 0.15, s * 0.9, s * 0.8, s * 0.08); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + s * 0.05, y + s * 0.4); ctx.lineTo(x + s * 0.95, y + s * 0.4); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + s * 0.28, y); ctx.lineTo(x + s * 0.28, y + s * 0.25); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + s * 0.72, y); ctx.lineTo(x + s * 0.72, y + s * 0.25); ctx.stroke()
})

const drawMoon: IconFn = (ctx, x, y, s, c) => {
  ctx.save()
  ctx.fillStyle = c
  ctx.beginPath(); ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.42, 0, Math.PI * 2); ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath(); ctx.arc(x + s * 0.68, y + s * 0.4, s * 0.36, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

const drawShieldCheck: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.08, () => {
  ctx.beginPath()
  ctx.moveTo(x + s * 0.5, y)
  ctx.lineTo(x + s * 0.95, y + s * 0.18)
  ctx.lineTo(x + s * 0.95, y + s * 0.5)
  ctx.bezierCurveTo(x + s * 0.95, y + s * 0.85, x + s * 0.72, y + s * 1.02, x + s * 0.5, y + s)
  ctx.bezierCurveTo(x + s * 0.28, y + s * 1.02, x + s * 0.05, y + s * 0.85, x + s * 0.05, y + s * 0.5)
  ctx.lineTo(x + s * 0.05, y + s * 0.18)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + s * 0.32, y + s * 0.5)
  ctx.lineTo(x + s * 0.45, y + s * 0.63)
  ctx.lineTo(x + s * 0.7, y + s * 0.35)
  ctx.stroke()
})

const drawDocument: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.08, () => {
  roundRect(ctx, x + s * 0.1, y, s * 0.8, s, s * 0.08); ctx.stroke()
  for (const f of [0.28, 0.48, 0.68]) {
    ctx.beginPath(); ctx.moveTo(x + s * 0.25, y + s * f); ctx.lineTo(x + s * 0.75, y + s * f); ctx.stroke()
  }
})

const drawMapPin: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.09, () => {
  ctx.beginPath()
  ctx.arc(x + s * 0.5, y + s * 0.38, s * 0.38, Math.PI * 0.15, Math.PI * 0.85, true)
  ctx.lineTo(x + s * 0.5, y + s)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath(); ctx.arc(x + s * 0.5, y + s * 0.38, s * 0.14, 0, Math.PI * 2); ctx.stroke()
})

const drawGlobe: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.07, () => {
  ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.46, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(x + s / 2, y + s / 2, s * 0.2, s * 0.46, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + s * 0.06, y + s / 2); ctx.lineTo(x + s * 0.94, y + s / 2); ctx.stroke()
})

const drawHeadset: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.09, () => {
  ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.55, s * 0.4, Math.PI, 0); ctx.stroke()
  roundRect(ctx, x + s * 0.06, y + s * 0.5, s * 0.16, s * 0.32, s * 0.05); ctx.stroke()
  roundRect(ctx, x + s * 0.78, y + s * 0.5, s * 0.16, s * 0.32, s * 0.05); ctx.stroke()
})

const drawTent: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.08, () => {
  ctx.beginPath(); ctx.moveTo(x + s * 0.5, y); ctx.lineTo(x + s * 0.95, y + s); ctx.lineTo(x + s * 0.05, y + s); ctx.closePath(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + s * 0.5, y + s * 0.4); ctx.lineTo(x + s * 0.38, y + s); ctx.moveTo(x + s * 0.5, y + s * 0.4); ctx.lineTo(x + s * 0.62, y + s); ctx.stroke()
})

const drawCompass: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.08, () => {
  ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.46, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + s * 0.65, y + s * 0.32); ctx.lineTo(x + s * 0.42, y + s * 0.45); ctx.lineTo(x + s * 0.35, y + s * 0.68); ctx.lineTo(x + s * 0.58, y + s * 0.55); ctx.closePath()
  ctx.stroke()
})

const drawBus: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.08, () => {
  roundRect(ctx, x + s * 0.06, y + s * 0.1, s * 0.88, s * 0.6, s * 0.12); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + s * 0.06, y + s * 0.4); ctx.lineTo(x + s * 0.94, y + s * 0.4); ctx.stroke()
  ctx.beginPath(); ctx.arc(x + s * 0.26, y + s * 0.82, s * 0.1, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(x + s * 0.74, y + s * 0.82, s * 0.1, 0, Math.PI * 2); ctx.stroke()
})

const drawPlane: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.08, () => {
  ctx.beginPath()
  ctx.moveTo(x + s * 0.05, y + s * 0.75)
  ctx.lineTo(x + s * 0.95, y + s * 0.3)
  ctx.lineTo(x + s * 0.6, y + s * 0.55)
  ctx.lineTo(x + s * 0.62, y + s)
  ctx.lineTo(x + s * 0.45, y + s * 0.68)
  ctx.closePath()
  ctx.stroke()
})

const drawTrain: IconFn = (ctx, x, y, s, c) => withStroke(ctx, c, s * 0.08, () => {
  roundRect(ctx, x + s * 0.16, y, s * 0.68, s * 0.7, s * 0.14); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + s * 0.16, y + s * 0.32); ctx.lineTo(x + s * 0.84, y + s * 0.32); ctx.stroke()
  ctx.beginPath(); ctx.arc(x + s * 0.34, y + s * 0.85, s * 0.09, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(x + s * 0.66, y + s * 0.85, s * 0.09, 0, Math.PI * 2); ctx.stroke()
})

const ICON_MAP: Record<string, IconFn> = {
  person: drawPerson, mail: drawMail, phone: drawPhone, bed: drawBed, calendar: drawCalendar,
  moon: drawMoon, shield: drawShieldCheck, document: drawDocument, mapPin: drawMapPin,
  globe: drawGlobe, headset: drawHeadset, tent: drawTent, compass: drawCompass,
  bus: drawBus, plane: drawPlane, train: drawTrain,
}

const CATEGORY_ICON: Record<ReceiptData['category'], string> = {
  hotel: 'bed', tour: 'compass', event_center: 'tent', bus: 'bus', train: 'train', flight: 'plane',
}

// Best-effort icon per row label — purely cosmetic, falls back to a generic document icon if unmatched.
function iconForLabel(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('room') || l.includes('hall')) return 'bed'
  if (l.includes('check-in') || l.includes('check-out') || l.includes('date') || l.includes('start') || l.includes('end')) return 'calendar'
  if (l.includes('night')) return 'moon'
  if (l.includes('name') || l.includes('guest') || l.includes('customer')) return 'person'
  if (l.includes('email')) return 'mail'
  if (l.includes('phone')) return 'phone'
  if (l.includes('duration') || l.includes('participant')) return 'compass'
  return 'document'
}

function drawIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, s: number, color: string) {
  const fn = ICON_MAP[name] || drawDocument
  fn(ctx, x, y, s, color)
}

// Renders a branded, template-matched booking receipt to a PNG and triggers a download.
// Every value comes from the real, already-confirmed booking — nothing here is invented.
export async function downloadReceiptImage(data: ReceiptData) {
  const scale = 2
  const width = 1000
  const rowH = 46
  const headerH = 220
  const successRowH = 150
  const boxesRowH = 140
  const detailsHeaderH = 60
  const rowsH = data.rows.length * rowH
  const summaryH = 150
  const disclaimerH = 90
  const footerH = 110
  const gaps = 120
  const height = headerH + successRowH + boxesRowH + detailsHeaderH + rowsH + summaryH + disclaimerH + footerH + gaps

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)

  // page bg
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

  const pad = 44

  // ---------- header ----------
  const logoImg = await loadImage(logo)
  const logoSize = 74
  if (logoImg) ctx.drawImage(logoImg, pad, 28, logoSize, logoSize)

  ctx.textAlign = 'left'
  ctx.font = 'bold 30px Arial, sans-serif'
  ctx.fillStyle = COLORS.navy
  const wordX = pad + logoSize + 16
  ctx.fillText('TRAVELER', wordX, 62)
  const w1 = ctx.measureText('TRAVELER').width
  ctx.fillStyle = COLORS.secondary
  ctx.fillText('.COM', wordX + w1, 62)
  ctx.font = '14px Arial, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText('Your Journey, One Platform.', wordX, 86)

  // navy diagonal panel top-right
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(width * 0.62, 0)
  ctx.lineTo(width, 0)
  ctx.lineTo(width, headerH - 20)
  ctx.quadraticCurveTo(width * 0.7, headerH - 20, width * 0.55, headerH - 40)
  ctx.closePath()
  ctx.fillStyle = COLORS.navy
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = COLORS.secondary
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(width * 0.58, 0)
  ctx.quadraticCurveTo(width * 0.68, headerH * 0.45, width * 0.5, headerH - 34)
  ctx.stroke()
  ctx.restore()

  drawIcon(ctx, 'document', width * 0.72, 34, 26, '#FFFFFF')
  ctx.textAlign = 'left'
  ctx.font = 'bold 22px Arial, sans-serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText('RECEIPT', width * 0.72 + 34, 55)
  ctx.font = '13px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('Thank you for choosing', width * 0.72, 82)
  ctx.font = 'bold 13px Arial, sans-serif'
  ctx.fillStyle = COLORS.secondary
  ctx.fillText('Traveler.com', width * 0.72, 100)

  let y = headerH

  // ---------- payment success + booking reference ----------
  const checkR = 32
  ctx.beginPath()
  ctx.arc(pad + checkR, y + checkR, checkR, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.green
  ctx.fill()
  ctx.save()
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pad + checkR - 13, y + checkR)
  ctx.lineTo(pad + checkR - 3, y + checkR + 10)
  ctx.lineTo(pad + checkR + 14, y + checkR - 12)
  ctx.stroke()
  ctx.restore()

  ctx.textAlign = 'left'
  ctx.font = 'bold 19px Arial, sans-serif'
  ctx.fillStyle = COLORS.green
  ctx.fillText('PAYMENT SUCCESSFUL', pad + checkR * 2 + 16, y + 24)
  ctx.font = '13px Arial, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText('Your payment has been processed successfully.', pad + checkR * 2 + 16, y + 44)

  const refBoxW = 300, refBoxX = width - pad - refBoxW, refBoxY = y
  roundRect(ctx, refBoxX, refBoxY, refBoxW, 108, 10)
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.font = '11px Arial, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText('BOOKING REFERENCE', refBoxX + 18, refBoxY + 24)
  ctx.font = 'bold 19px Arial, sans-serif'
  ctx.fillStyle = COLORS.navy
  ctx.fillText(data.bookingReference, refBoxX + 18, refBoxY + 50)
  if (data.paymentDate) {
    drawIcon(ctx, 'calendar', refBoxX + 18, refBoxY + 62, 15, COLORS.textMuted)
    ctx.font = '11px Arial, sans-serif'
    ctx.fillStyle = COLORS.textMuted
    ctx.fillText('Payment Date', refBoxX + 40, refBoxY + 74)
    ctx.font = 'bold 13px Arial, sans-serif'
    ctx.fillStyle = COLORS.navy
    ctx.fillText(data.paymentDate, refBoxX + 40, refBoxY + 92)
  }

  y += successRowH

  // ---------- amount box + service info box ----------
  const amtBoxW = width - pad * 2 - 260 - 16
  roundRect(ctx, pad, y, amtBoxW, 100, 12)
  ctx.fillStyle = COLORS.navy
  ctx.fill()
  ctx.font = '12px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('AMOUNT PAID', pad + 24, y + 28)
  ctx.font = 'bold 40px Arial, sans-serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(`\u20A6${data.amountPaid.toLocaleString()}`, pad + 24, y + 72)
  const amtW = ctx.measureText(`\u20A6${data.amountPaid.toLocaleString()}`).width
  ctx.font = '13px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('NGN', pad + 24 + amtW + 10, y + 72)

  const infoBoxX = pad + amtBoxW + 16, infoBoxW = 260
  roundRect(ctx, infoBoxX, y, infoBoxW, 100, 12)
  ctx.strokeStyle = COLORS.border
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(infoBoxX + 40, y + 50, 24, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.bg
  ctx.fill()
  drawIcon(ctx, CATEGORY_ICON[data.category], infoBoxX + 28, y + 38, 24, COLORS.navy)
  ctx.font = 'bold 15px Arial, sans-serif'
  ctx.fillStyle = COLORS.navy
  ctx.fillText(data.serviceTypeLabel, infoBoxX + 76, y + 44)
  drawIcon(ctx, 'mapPin', infoBoxX + 76, y + 54, 13, COLORS.secondary)
  ctx.font = '12px Arial, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText(data.location, infoBoxX + 94, y + 66)

  y += boxesRowH

  // ---------- BOOKING DETAILS divider ----------
  ctx.beginPath()
  ctx.moveTo(pad, y + 18)
  ctx.lineTo(width - pad, y + 18)
  ctx.strokeStyle = COLORS.navy
  ctx.lineWidth = 1
  ctx.stroke()
  const pillText = 'BOOKING DETAILS'
  ctx.font = 'bold 12px Arial, sans-serif'
  const pillW = ctx.measureText(pillText).width + 36
  roundRect(ctx, width / 2 - pillW / 2, y, pillW, 28, 14)
  ctx.fillStyle = COLORS.navy
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.fillText(pillText, width / 2, y + 18)
  ctx.textAlign = 'left'

  y += detailsHeaderH

  // ---------- detail rows ----------
  for (const row of data.rows) {
    drawIcon(ctx, row.icon || iconForLabel(row.label), pad, y - 15, 18, COLORS.navy)
    ctx.font = '14px Arial, sans-serif'
    ctx.fillStyle = COLORS.text
    ctx.fillText(row.label, pad + 30, y)
    ctx.textAlign = 'right'
    ctx.font = 'bold 14px Arial, sans-serif'
    ctx.fillText(row.value, width - pad, y)
    ctx.textAlign = 'left'
    dottedLine(ctx, pad, y + 14, width - pad)
    y += rowH
  }

  y += 10

  // ---------- payment summary split box ----------
  const sumH = summaryH - 20
  const sumSplit = width * 0.68
  roundRect(ctx, pad, y, width - pad * 2, sumH, 12)
  ctx.strokeStyle = COLORS.border
  ctx.stroke()

  ctx.save()
  roundRect(ctx, pad, y, sumSplit - pad, sumH, 12)
  ctx.clip()
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(pad, y, sumSplit - pad, sumH)
  ctx.restore()

  ctx.font = 'bold 12px Arial, sans-serif'
  ctx.fillStyle = COLORS.navy
  ctx.fillText('PAYMENT SUMMARY', pad + 20, y + 26)
  ctx.font = '12px Arial, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText('Payment Method', pad + 20, y + 58)
  ctx.font = 'bold 13px Arial, sans-serif'
  ctx.fillStyle = COLORS.text
  ctx.fillText('Traveler.com Wallet', pad + 20, y + 76)
  if (data.transactionId) {
    ctx.font = '12px Arial, sans-serif'
    ctx.fillStyle = COLORS.textMuted
    ctx.fillText('Transaction ID', pad + 20, y + 104)
    ctx.font = 'bold 13px Arial, sans-serif'
    ctx.fillStyle = COLORS.text
    ctx.fillText(data.transactionId, pad + 20, y + 122)
  }

  const totalX = sumSplit
  ctx.save()
  roundRect(ctx, totalX, y, width - pad - totalX, sumH, 12)
  ctx.clip()
  ctx.fillStyle = COLORS.navy
  ctx.fillRect(totalX, y, width - pad - totalX, sumH)
  ctx.fillStyle = COLORS.secondary
  ctx.fillRect(totalX, y, 5, sumH)
  ctx.restore()
  ctx.font = '11px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('TOTAL PAID', totalX + 24, y + 30)
  ctx.font = 'bold 26px Arial, sans-serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(`\u20A6${data.amountPaid.toLocaleString()}`, totalX + 24, y + 66)
  ctx.font = 'bold 12px Arial, sans-serif'
  ctx.fillStyle = '#4ADE80'
  ctx.fillText('PAID IN FULL', totalX + 24, y + 90)

  y += summaryH

  // ---------- disclaimer bar ----------
  roundRect(ctx, pad, y, width - pad * 2, disclaimerH - 20, 10)
  ctx.fillStyle = COLORS.bg
  ctx.fill()
  drawIcon(ctx, 'shield', pad + 20, y + 16, 22, COLORS.navy)
  ctx.font = '11.5px Arial, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText('This is a system generated receipt and does not require a signature.', pad + 56, y + 26)
  ctx.fillText(`For any support, contact us via ${SUPPORT_EMAIL}`, pad + 56, y + 44)
  ctx.textAlign = 'right'
  ctx.font = 'italic bold 15px Georgia, serif'
  ctx.fillStyle = COLORS.navy
  ctx.fillText('Thank you!', width - pad - 20, y + 26)
  ctx.font = '11.5px Arial, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText('We wish you a pleasant journey.', width - pad - 20, y + 44)
  ctx.textAlign = 'left'

  y += disclaimerH

  // ---------- footer ----------
  roundRect(ctx, 0, y, width, footerH, 0)
  ctx.fillStyle = COLORS.navy
  ctx.fill()
  const footerCenterY = y + footerH / 2

  drawIcon(ctx, 'globe', pad, footerCenterY - 11, 20, '#FFFFFF')
  ctx.font = '10.5px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('Website', pad + 28, footerCenterY - 3)
  ctx.font = 'bold 11.5px Arial, sans-serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(WEBSITE, pad + 28, footerCenterY + 13)

  const supportX = pad + 230
  drawIcon(ctx, 'headset', supportX, footerCenterY - 11, 20, '#FFFFFF')
  ctx.font = '10.5px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('Support', supportX + 28, footerCenterY - 3)
  ctx.font = 'bold 11.5px Arial, sans-serif'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(SUPPORT_EMAIL, supportX + 28, footerCenterY + 13)

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
