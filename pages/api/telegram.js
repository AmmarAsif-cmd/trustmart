import { getServiceClient } from '../../lib/supabase'

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`
const ALLOWED_CHAT_ID = process.env.TELEGRAM_ALLOWED_CHAT_ID // your personal chat ID
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

// ─── Send a Telegram message back ────────────────────────────────────────────
async function sendMessage(chatId, text, parseMode = 'Markdown') {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode })
  })
}

// ─── Get file URL from Telegram ──────────────────────────────────────────────
async function getFileUrl(fileId) {
  const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`)
  const data = await res.json()
  return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${data.result.file_path}`
}

// ─── Convert URL to base64 ───────────────────────────────────────────────────
async function urlToBase64(url) {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

// ─── Call Claude to parse message / image / PDF ──────────────────────────────
async function parseWithClaude(userMessage, imageBase64 = null, imageType = null) {
  const today = new Date().toISOString().split('T')[0]

  const systemPrompt = `You are a smart data entry assistant for Trust Mart, a Pakistani e-commerce business selling Umrah Saving Boxes at ₨999 each via COD (cash on delivery). The courier is R&S (RS Courier).

You understand natural language in English, Urdu, and mixed (Roman Urdu). You extract structured data and return ONLY valid JSON.

Today's date: ${today}

═══ OUTPUT FORMAT ═══

Return JSON with ONLY the relevant fields (omit empty arrays/objects):

{
  "type": "mixed",
  "summary": "Brief human-readable summary of what you did",
  "orders": [...],
  "update_orders": [...],
  "bulk_update": {...},
  "ad_spend": [...],
  "payments": [...]
}

═══ FIELD SCHEMAS ═══

orders (NEW inserts — first time seeing these tracking numbers, or bulk counts without tracking):
{ "tracking": "LE7530406123", "date": "2026-03-10", "status": "pending", "city": "Karachi", "product_cost": 135 }
— tracking is optional for count-based entries (e.g. "booked 10 orders today")
— generate N separate entries when user gives a count without tracking numbers

update_orders (UPDATE existing rows by tracking number):
{ "tracking": "LE7530406123", "status": "delivered", "city": "Lahore", "date": "2026-03-10" }
— only include fields that are changing

bulk_update (UPDATE all rows matching a status filter):
{ "filter_status": "pending", "set_status": "inTransit" }

ad_spend:
{ "date": "2026-03-10", "pkr": 1500, "gbp": 0, "note": "TikTok" }

payments:
{ "date": "2026-03-10", "amount": 5143, "note": "SI-7991" }

═══ STATUS MAPPINGS ═══
delivered → delivered
returned / wapas / RTS / "Return In Process" / "Ready for Return" → returned
"In Transit" / "Out for Delivery" / transit / rawan → inTransit
pending / booked / "New Booked" / book → pending
failed / cancel / cancelled → failed

═══ DECISION RULES ═══

Use "orders" when:
- User mentions NEW shipments/bookings never entered before
- User gives counts without tracking ("booked 15 orders today", "10 delivered 3 returned from Karachi")
- Screenshot/PDF shows order list (extract each row)

Use "update_orders" when:
- User mentions a specific tracking number and wants to change its status/city
- "LE123 delivered", "mark LE456 as returned", "LE789 city change to Lahore"
- Multiple specific trackings: "LE123 and LE456 are delivered"

Use "bulk_update" when:
- User says "all [status] orders → [new status]"
- "mark all pending as inTransit", "sab pending ko inTransit kar do"
- "all transit delivered", "change returned to failed"
- No specific tracking mentioned, affects a whole status group

Use "ad_spend" when:
- User mentions spending money on ads/TikTok/Facebook/marketing
- "1500 tiktok", "spent 3000 on ads yesterday", "ads 4200"

Use "payments" when:
- User mentions receiving money from R&S/RS courier
- "received 8380 RS SI-8032", "RS ne 5143 diya", "payment from courier"

═══ DATE PARSING ═══
- "today" / "aaj" → ${today}
- "yesterday" / "kal" → ${new Date(Date.now() - 86400000).toISOString().split('T')[0]}
- "Monday", "last week" → calculate from today
- No date mentioned → use ${today}

═══ EXAMPLES ═══

Input: "LE7530406123 delivered Karachi"
→ { "type": "update", "summary": "Updated LE7530406123 to delivered in Karachi", "update_orders": [{"tracking":"LE7530406123","status":"delivered","city":"Karachi"}] }

Input: "LE123 aur LE456 wapas agaye"
→ { "type": "update", "summary": "Marked LE123 and LE456 as returned", "update_orders": [{"tracking":"LE123","status":"returned"},{"tracking":"LE456","status":"returned"}] }

Input: "mark all pending as inTransit"
→ { "type": "bulk_update", "summary": "Bulk updated all pending orders to inTransit", "bulk_update": {"filter_status":"pending","set_status":"inTransit"} }

Input: "sab inTransit orders delivered kar do"
→ { "type": "bulk_update", "summary": "Bulk updated all inTransit orders to delivered", "bulk_update": {"filter_status":"inTransit","set_status":"delivered"} }

Input: "10 delivered 3 returned today Karachi"
→ { "type": "orders", "summary": "Logged 10 delivered and 3 returned from Karachi", "orders": [ ...10 entries status:delivered city:Karachi..., ...3 entries status:returned city:Karachi... ] }

Input: "booked 5 new orders today"
→ { "type": "orders", "summary": "Logged 5 new pending orders", "orders": [ ...5 entries status:pending... ] }

Input: "spent 2000 on tiktok yesterday"
→ { "type": "ad_spend", "summary": "Logged ₨2000 TikTok ad spend", "ad_spend": [{"date":"YESTERDAY","pkr":2000,"gbp":0,"note":"TikTok"}] }

Input: "RS ne 8380 diya SI-8032"
→ { "type": "payments", "summary": "Logged ₨8380 payment from R&S invoice SI-8032", "payments": [{"date":"${today}","amount":8380,"note":"SI-8032"}] }

Input: "spent 1500 ads and received 5143 from RS SI-7991"
→ { "type": "mixed", "summary": "Logged ad spend and payment", "ad_spend": [...], "payments": [...] }

Input: "LE123 city change to Lahore"
→ { "type": "update", "summary": "Updated city of LE123 to Lahore", "update_orders": [{"tracking":"LE123","city":"Lahore"}] }

═══ IMPORTANT ═══
- Each tracking number = ONE row in DB. Never create duplicate entries for the same tracking.
- product_cost default = 135
- For count-based entries (no tracking), generate that exact number of order objects
- If message is completely unclear: {"type":"unclear","summary":"I didn't understand. Can you clarify? E.g. 'LE123 delivered' or 'spent 1500 on ads'"}
- ONLY return JSON. No explanation text. ALWAYS valid JSON.`

  const messages = []

  if (imageBase64 && imageType) {
    const mediaType = imageType === 'pdf' ? 'application/pdf' : `image/${imageType}`
    messages.push({
      role: 'user',
      content: [
        {
          type: imageType === 'pdf' ? 'document' : 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 }
        },
        { type: 'text', text: userMessage || 'Please extract all data from this file.' }
      ]
    })
  } else {
    messages.push({ role: 'user', content: userMessage })
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages
    })
  })

  const data = await res.json()
  const text = data.content?.[0]?.text || '{}'

  // Strip markdown code fences if present
  const clean = text.replace(/```json\n?|\n?```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch (e) {
    // Claude returned plain text instead of JSON — wrap it
    return {
      type: 'unclear',
      summary: clean.slice(0, 200),
      orders: [],
      ad_spend: [],
      payments: []
    }
  }
}

// ─── Save parsed data to Supabase ────────────────────────────────────────────
async function saveToDb(parsed) {
  const db = getServiceClient()
  const results = { orders: 0, updated: 0, bulk_updated: 0, ad_spend: 0, payments: 0, errors: [] }

  // Insert/upsert new orders (one row per tracking)
  if (parsed.orders?.length) {
    for (const order of parsed.orders) {
      const id = order.tracking || `tg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const { error } = await db.from('orders').upsert({
        id,
        date: order.date,
        status: order.status,
        tracking: order.tracking || null,
        city: order.city || null,
        product_cost: order.product_cost || 135,
        source: 'telegram'
      })
      if (error) results.errors.push(`Order ${id}: ${error.message}`)
      else results.orders++
    }
  }

  // Update specific orders by tracking ID
  if (parsed.update_orders?.length) {
    for (const order of parsed.update_orders) {
      if (!order.tracking) continue
      const patch = {}
      if (order.status) patch.status = order.status
      if (order.city) patch.city = order.city
      if (order.date) patch.date = order.date
      const { error } = await db.from('orders').update(patch).eq('tracking', order.tracking)
      if (error) results.errors.push(`Update ${order.tracking}: ${error.message}`)
      else results.updated++
    }
  }

  // Bulk update orders by status filter
  if (parsed.bulk_update?.filter_status && parsed.bulk_update?.set_status) {
    const { filter_status, set_status } = parsed.bulk_update
    const { error, count } = await db.from('orders')
      .update({ status: set_status })
      .eq('status', filter_status)
    if (error) results.errors.push(`Bulk update: ${error.message}`)
    else results.bulk_updated = count || 0
  }

  // Save ad spend
  if (parsed.ad_spend?.length) {
    for (const ad of parsed.ad_spend) {
      const id = `tg_ad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const { error } = await db.from('ad_spend').insert({
        id,
        date: ad.date,
        pkr: ad.pkr,
        gbp: ad.gbp || 0,
        note: ad.note || 'TikTok Ads',
        source: 'telegram'
      })
      if (error) results.errors.push(`Ad: ${error.message}`)
      else results.ad_spend++
    }
  }

  // Save payments
  if (parsed.payments?.length) {
    for (const payment of parsed.payments) {
      const id = `tg_pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const { error } = await db.from('payments').insert({
        id,
        date: payment.date,
        amount: payment.amount,
        note: payment.note || 'R&S Transfer',
        source: 'telegram'
      })
      if (error) results.errors.push(`Payment: ${error.message}`)
      else results.payments++
    }
  }

  return results
}

// ─── Format confirmation message ─────────────────────────────────────────────
function formatConfirmation(parsed, saved) {
  // If Claude couldn't understand, just echo the question back
  if (parsed.type === 'unclear') {
    return `🤔 ${parsed.summary}`
  }

  const total = saved.orders + saved.updated + saved.bulk_updated + saved.ad_spend + saved.payments
  if (total === 0 && saved.errors.length === 0) {
    return `ℹ️ Nothing to save — I understood your message but found no data to record.\n\n_${parsed.summary}_`
  }

  let msg = `✅ *Saved to dashboard*\n\n${parsed.summary}\n\n`
  if (saved.orders > 0) msg += `📦 ${saved.orders} order(s) inserted\n`
  if (saved.updated > 0) msg += `✏️ ${saved.updated} order(s) updated\n`
  if (saved.bulk_updated > 0) msg += `🔄 ${saved.bulk_updated} order(s) bulk updated\n`
  if (saved.ad_spend > 0) msg += `📢 ${saved.ad_spend} ad spend entry saved\n`
  if (saved.payments > 0) msg += `💰 ${saved.payments} payment(s) logged\n`
  if (saved.errors.length > 0) msg += `\n⚠️ Errors: ${saved.errors.join(', ')}`
  msg += `\n\n_Dashboard auto-refreshes every 30s_`
  return msg
}

// ─── MAIN WEBHOOK HANDLER ────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const { message } = req.body
    if (!message) return res.status(200).json({ ok: true })

    const chatId = message.chat.id.toString()
    const text = message.text || message.caption || ''

    // Security: only respond to your chat
    if (ALLOWED_CHAT_ID && chatId !== ALLOWED_CHAT_ID) {
      await sendMessage(chatId, '❌ Unauthorised')
      return res.status(200).json({ ok: true })
    }

    // Help command
    if (text === '/start' || text === '/help') {
      const help = `🏪 *Trust Mart Bot*

I understand natural language. Just tell me what happened:

*Ad Spend:*
"spent 1500 on tiktok today"
"tiktok ads 4200 pkr yesterday"

*Payments from R&S:*
"received 8380 from RS invoice SI-8032"
"RS paid 5143 today SI-7991"

*Order Updates:*
"15 delivered 3 returned today from Karachi"
"LE7530406xxx delivered Lahore"

*Screenshots/PDFs:*
Just send a screenshot of the RS portal or an invoice PDF — I'll extract everything automatically.

*Commands:*
/summary — today's P&L snapshot
/recent — last 5 entries from orders, ad spend & payments
/delete <id> — delete a specific entry by ID
/deleteall — delete all Telegram-sourced entries
/help — this message`
      await sendMessage(chatId, help)
      return res.status(200).json({ ok: true })
    }

    // Summary command
    if (text === '/summary') {
      const db = getServiceClient()
      const [ordersRes, adsRes, paymentsRes] = await Promise.all([
        db.from('orders').select('status, product_cost'),
        db.from('ad_spend').select('pkr'),
        db.from('payments').select('amount')
      ])

      const orders = ordersRes.data || []
      const delivered = orders.filter(o => o.status === 'delivered').length
      const returned = orders.filter(o => o.status === 'returned').length
      const revenue = delivered * 999
      const prodCost = orders.reduce((s, o) => s + (o.product_cost || 135), 0)
      const delCost = orders.length * 212
      const ads = (adsRes.data || []).reduce((s, a) => s + a.pkr, 0)
      const received = (paymentsRes.data || []).reduce((s, p) => s + p.amount, 0)
      // One-time cost of ₨1500 applied once (Jan 2026 setup)
      const net = revenue - prodCost - delCost - 1500 - ads

      const msg = `📊 *Trust Mart Summary (All Time)*

📦 ${orders.length} sent · ${delivered} delivered · ${returned} returned
📈 Revenue: ₨${revenue.toLocaleString()}
💸 Costs: ₨${(prodCost + delCost + 1500).toLocaleString()}
📢 Ads: ₨${ads.toLocaleString()}
${net >= 0 ? '✅' : '🔴'} Net: ₨${net.toLocaleString()}
💰 Received from R&S: ₨${received.toLocaleString()}`

      await sendMessage(chatId, msg)
      return res.status(200).json({ ok: true })
    }

    // /recent command
    if (text === '/recent') {
      const db = getServiceClient()
      const [ordersRes, adsRes, paymentsRes] = await Promise.all([
        db.from('orders').select('id, date, status, city').eq('source', 'telegram').order('created_at', { ascending: false }).limit(5),
        db.from('ad_spend').select('id, date, pkr, note').eq('source', 'telegram').order('created_at', { ascending: false }).limit(5),
        db.from('payments').select('id, date, amount, note').eq('source', 'telegram').order('created_at', { ascending: false }).limit(5)
      ])

      let msg = `🕐 *Recent Telegram Entries*\n\n`

      const orders = ordersRes.data || []
      if (orders.length) {
        msg += `📦 *Orders:*\n`
        orders.forEach(o => { msg += `• \`${o.id}\` | ${o.date} | ${o.status} | ${o.city || '-'}\n` })
        msg += '\n'
      }

      const ads = adsRes.data || []
      if (ads.length) {
        msg += `📢 *Ad Spend:*\n`
        ads.forEach(a => { msg += `• \`${a.id}\` | ${a.date} | ₨${a.pkr} | ${a.note || '-'}\n` })
        msg += '\n'
      }

      const payments = paymentsRes.data || []
      if (payments.length) {
        msg += `💰 *Payments:*\n`
        payments.forEach(p => { msg += `• \`${p.id}\` | ${p.date} | ₨${p.amount} | ${p.note || '-'}\n` })
        msg += '\n'
      }

      if (!orders.length && !ads.length && !payments.length) {
        msg += '_No Telegram entries found._'
      } else {
        msg += `To delete: /delete <id>`
      }

      await sendMessage(chatId, msg)
      return res.status(200).json({ ok: true })
    }

    // /delete <id> command
    if (text.startsWith('/delete ')) {
      const id = text.slice(8).trim()
      const db = getServiceClient()
      await Promise.all([
        db.from('orders').delete().eq('id', id),
        db.from('ad_spend').delete().eq('id', id),
        db.from('payments').delete().eq('id', id)
      ])
      await sendMessage(chatId, `🗑️ Deleted entry \`${id}\` from all tables (if it existed).`)
      return res.status(200).json({ ok: true })
    }

    // /deleteall command
    if (text === '/deleteall') {
      const db = getServiceClient()
      await Promise.all([
        db.from('orders').delete().eq('source', 'telegram'),
        db.from('ad_spend').delete().eq('source', 'telegram'),
        db.from('payments').delete().eq('source', 'telegram')
      ])
      await sendMessage(chatId, `🗑️ All Telegram-sourced entries deleted. Historical seed data is untouched.`)
      return res.status(200).json({ ok: true })
    }

    // Handle photo
    if (message.photo) {
      await sendMessage(chatId, '🔍 Reading screenshot...')
      const fileId = message.photo[message.photo.length - 1].file_id
      const fileUrl = await getFileUrl(fileId)
      const base64 = await urlToBase64(fileUrl)
      const parsed = await parseWithClaude(text, base64, 'jpeg')
      const saved = await saveToDb(parsed)
      await sendMessage(chatId, formatConfirmation(parsed, saved))
      return res.status(200).json({ ok: true })
    }

    // Handle document (PDF)
    if (message.document) {
      const doc = message.document
      const isPdf = doc.mime_type === 'application/pdf'
      await sendMessage(chatId, isPdf ? '📄 Reading PDF...' : '📎 Reading file...')
      const fileUrl = await getFileUrl(doc.file_id)
      const base64 = await urlToBase64(fileUrl)
      const fileType = isPdf ? 'pdf' : 'jpeg'
      const parsed = await parseWithClaude(text, base64, fileType)
      const saved = await saveToDb(parsed)
      await sendMessage(chatId, formatConfirmation(parsed, saved))
      return res.status(200).json({ ok: true })
    }

    // Handle plain text
    if (text) {
      await sendMessage(chatId, '⏳ Processing...')
      const parsed = await parseWithClaude(text)
      const saved = await saveToDb(parsed)
      await sendMessage(chatId, formatConfirmation(parsed, saved))
      return res.status(200).json({ ok: true })
    }

  } catch (err) {
    console.error('Bot error:', err)
    try {
      const chatId = req.body?.message?.chat?.id
      if (chatId) await sendMessage(chatId, `❌ Error: ${err.message}`)
    } catch {}
  }

  return res.status(200).json({ ok: true })
}
