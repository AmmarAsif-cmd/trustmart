import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const SELL = 999
const AVG_DEL = 212
const ONE_TIME = 1500
const SC = { delivered: '#22c55e', returned: '#ef4444', inTransit: '#3b82f6', pending: '#f59e0b', failed: '#f97316' }
const fmtPKR = n => '₨ ' + Math.round(n || 0).toLocaleString('en-PK')
const mo = d => d?.slice(0, 7) || ''

export default function Dashboard() {
  const [orders, setOrders] = useState([])
  const [ads, setAds] = useState([])
  const [payments, setPayments] = useState([])
  const [tab, setTab] = useState('dashboard')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [search, setSearch] = useState('')

  const fetchAll = useCallback(async () => {
    const [o, a, p] = await Promise.all([
      supabase.from('orders').select('*').order('date', { ascending: false }),
      supabase.from('ad_spend').select('*').order('date', { ascending: false }),
      supabase.from('payments').select('*').order('date', { ascending: false }),
    ])
    if (o.data) setOrders(o.data)
    if (a.data) setAds(a.data)
    if (p.data) setPayments(p.data)
    setLoading(false)
    setLastSync(new Date())
  }, [])

  useEffect(() => {
    fetchAll()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // ── Filter by month ──
  const byMonth = arr => selectedMonth === 'all' ? arr : arr.filter(x => mo(x.date) === selectedMonth)
  const filtOrders = byMonth(orders)
  const filtAds = byMonth(ads)
  const filtPayments = byMonth(payments)

  // ── P&L ──
  const delivered = filtOrders.filter(o => o.status === 'delivered').length
  const returned = filtOrders.filter(o => o.status === 'returned').length
  const inTransit = filtOrders.filter(o => o.status === 'inTransit').length
  const pending = filtOrders.filter(o => o.status === 'pending').length
  const total = filtOrders.length
  const returnRate = delivered + returned > 0 ? ((returned / (delivered + returned)) * 100).toFixed(1) : 0
  const revenue = delivered * SELL
  const prodCostTotal = filtOrders.reduce((s, o) => s + (o.product_cost || 190), 0)
  const delCostTotal = total * AVG_DEL
  const oneTime = selectedMonth === 'all' || selectedMonth === '2026-01' ? ONE_TIME : 0
  const adTotal = filtAds.reduce((s, a) => s + (a.pkr || 0), 0)
  const grossProfit = revenue - prodCostTotal - delCostTotal - oneTime
  const netProfit = grossProfit - adTotal
  const roi = (prodCostTotal + delCostTotal + oneTime + adTotal) > 0
    ? (netProfit / (prodCostTotal + delCostTotal + oneTime + adTotal) * 100).toFixed(1) : 0
  const receivedTotal = filtPayments.reduce((s, p) => s + (p.amount || 0), 0)

  // ── Chart data ──
  const allMonths = ['all', ...[...new Set(orders.map(o => mo(o.date)))].sort().reverse()]

  const pieData = [
    { name: `Delivered (${delivered})`, value: delivered, color: SC.delivered },
    { name: `Returned (${returned})`, value: returned, color: SC.returned },
    { name: `In Transit (${inTransit})`, value: inTransit, color: SC.inTransit },
    { name: `Pending (${pending})`, value: pending, color: SC.pending },
  ].filter(d => d.value > 0)

  const costBreakdown = [
    { name: 'Product', value: Math.round(prodCostTotal) },
    { name: 'Delivery', value: Math.round(delCostTotal) },
    { name: 'Ads', value: Math.round(adTotal) },
  ]

  const monthlyMap = {}
  orders.forEach(o => {
    const m = mo(o.date)
    if (!monthlyMap[m]) monthlyMap[m] = { month: m.slice(5) + "'26", Delivered: 0, Returned: 0, Pending: 0 }
    if (o.status === 'delivered') monthlyMap[m].Delivered++
    else if (o.status === 'returned') monthlyMap[m].Returned++
    else monthlyMap[m].Pending++
  })
  const trendData = Object.values(monthlyMap).sort((a, b) => a.month < b.month ? -1 : 1)

  // ── City analysis ──
  const cityMap = {}
  filtOrders.forEach(o => {
    if (!o.city) return
    if (!cityMap[o.city]) cityMap[o.city] = { orders: 0, delivered: 0, returned: 0 }
    cityMap[o.city].orders++
    if (o.status === 'delivered') cityMap[o.city].delivered++
    if (o.status === 'returned') cityMap[o.city].returned++
  })
  const topCities = Object.entries(cityMap)
    .sort((a, b) => b[1].orders - a[1].orders).slice(0, 15)
    .map(([city, d]) => ({ city, ...d, rr: Math.round(d.returned / d.orders * 100) }))

  const filteredOrdersList = filtOrders.filter(o =>
    !search || o.tracking?.toLowerCase().includes(search.toLowerCase()) ||
    o.city?.toLowerCase().includes(search.toLowerCase()) ||
    o.status?.toLowerCase().includes(search.toLowerCase())
  )

  const TABS = ['dashboard', 'orders', 'cities', 'ads', 'payments']

  if (loading) return (
    <div style={{ background: '#0f0f14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        Loading dashboard...
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#0f0f14', minHeight: '100vh', color: '#e2e8f0' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* NAV */}
      <div style={{ background: '#1a1a24', borderBottom: '1px solid #2d2d3d', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4, height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 16 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#000' }}>T</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#f8fafc' }}>Trust Mart</span>
          <span style={{ fontSize: 10, color: '#64748b', background: '#1e293b', padding: '2px 8px', borderRadius: 4 }}>LIVE</span>
        </div>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? '#f59e0b15' : 'transparent', border: 'none',
            color: tab === t ? '#f59e0b' : '#94a3b8', padding: '6px 14px', borderRadius: 6,
            cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400,
            textTransform: 'capitalize', borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent'
          }}>{t}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: '#2a3050' }}>
          {lastSync ? `Synced ${lastSync.toLocaleTimeString()}` : ''} · auto-refresh 30s
        </div>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ background: '#1a1a24', border: '1px solid #2d2d3d', color: '#e2e8f0', padding: '6px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', marginLeft: 12 }}>
          {allMonths.map(m => <option key={m} value={m}>{m === 'all' ? 'All Time' : m}</option>)}
        </select>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Net Profit / Loss', value: fmtPKR(netProfit), sub: `ROI: ${roi}%`, color: netProfit >= 0 ? '#22c55e' : '#ef4444', big: true },
              { label: 'Gross Revenue', value: fmtPKR(revenue), sub: `${delivered} delivered`, color: '#3b82f6' },
              { label: 'Total Costs', value: fmtPKR(prodCostTotal + delCostTotal + oneTime + adTotal), sub: 'Product + Delivery + Ads', color: '#f97316' },
              { label: 'Received (HBL)', value: fmtPKR(receivedTotal), sub: `${filtPayments.length} payments · ₨13,523 outstanding`, color: '#a855f7' },
            ].map(k => (
              <div key={k.label} style={{ background: '#1a1a24', border: `1px solid ${k.color}30`, borderRadius: 12, padding: 20, borderLeft: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: k.big ? 22 : 20, fontWeight: 700, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Status chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Sent', value: total, color: '#94a3b8' },
              { label: '✓ Delivered', value: delivered, color: SC.delivered },
              { label: '↩ Returned', value: returned, color: SC.returned },
              { label: '🚚 In Transit', value: inTransit, color: SC.inTransit },
              { label: '⏳ Pending', value: pending, color: SC.pending },
              { label: 'Return Rate', value: returnRate + '%', color: Number(returnRate) > 35 ? '#ef4444' : Number(returnRate) > 20 ? '#f97316' : '#22c55e' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1a1a24', borderRadius: 10, padding: '14px 16px', border: '1px solid #2d2d3d', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#1a1a24', borderRadius: 12, padding: 20, border: '1px solid #2d2d3d' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 16 }}>Cost Breakdown</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={costBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={v => '₨' + (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip formatter={v => fmtPKR(v)} contentStyle={{ background: '#0f0f14', border: '1px solid #2d2d3d', borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#1a1a24', borderRadius: 12, padding: 20, border: '1px solid #2d2d3d' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 16 }}>Shipment Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" stroke="none">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v + ' parcels', n]} contentStyle={{ background: '#0f0f14', border: '1px solid #2d2d3d', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>{pieData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{d.name}</span>
                  </div>
                ))}</div>
              </div>
            </div>
          </div>

          {/* Monthly trend */}
          <div style={{ background: '#1a1a24', borderRadius: 12, padding: 20, border: '1px solid #2d2d3d', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 16 }}>Monthly Trend</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trendData} barGap={4} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d3d" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f0f14', border: '1px solid #2d2d3d', borderRadius: 8 }} />
                <Bar dataKey="Delivered" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Returned" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Pending" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* P&L table */}
          <div style={{ background: '#1a1a24', borderRadius: 12, padding: 20, border: '1px solid #2d2d3d' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 16 }}>📊 Full P&L — {selectedMonth === 'all' ? 'All Time' : selectedMonth}</div>
            {[
              { label: 'Gross Revenue', value: revenue, note: `${delivered} × ₨999`, color: '#22c55e' },
              { label: '─ Product Cost', value: -prodCostTotal, note: `${total} sent × avg ₨${total > 0 ? Math.round(prodCostTotal / total) : 190}`, color: '#ef4444' },
              { label: '─ Delivery (R&S)', value: -delCostTotal, note: `${total} × ₨${AVG_DEL} avg`, color: '#ef4444' },
              { label: '─ One-Time', value: -oneTime, note: 'logistics setup', color: '#ef4444' },
              { label: '= Gross Profit', value: grossProfit, note: 'before ads', color: grossProfit >= 0 ? '#22c55e' : '#ef4444', bold: true },
              { label: '─ TikTok Ads', value: -adTotal, note: 'total spend', color: '#ef4444' },
              { label: '= Net Profit / Loss', value: netProfit, note: `${roi}% ROI`, color: netProfit >= 0 ? '#22c55e' : '#ef4444', bold: true },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #2d2d3d' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: row.bold ? 700 : 400, color: row.bold ? '#f8fafc' : '#94a3b8' }}>{row.label}</span>
                  <span style={{ fontSize: 11, color: '#475569', marginLeft: 12 }}>{row.note}</span>
                </div>
                <span style={{ fontSize: row.bold ? 18 : 15, fontWeight: row.bold ? 700 : 600, color: row.color, fontFamily: "'DM Mono', monospace" }}>{fmtPKR(Math.abs(row.value))}</span>
              </div>
            ))}
          </div>
        </>}

        {/* ── ORDERS ── */}
        {tab === 'orders' && (
          <div style={{ background: '#1a1a24', borderRadius: 12, border: '1px solid #2d2d3d', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #2d2d3d', display: 'flex', gap: 12, alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tracking, city, status..." style={{ flex: 1, background: '#0f0f14', border: '1px solid #2d2d3d', color: '#e2e8f0', padding: '7px 12px', borderRadius: 7, fontSize: 12, outline: 'none' }} />
              <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>{filteredOrdersList.length} orders</span>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '70vh' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#1a1a24', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid #2d2d3d' }}>
                    {['Date', 'City', 'Tracking', 'Status', 'Cost', 'COD', 'Source'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrdersList.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                      <td style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>{o.date}</td>
                      <td style={{ padding: '8px 14px', fontSize: 12, color: '#e2e8f0' }}>{o.city || '—'}</td>
                      <td style={{ padding: '8px 14px', fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#64748b' }}>{o.tracking || '—'}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ background: (SC[o.status] || '#666') + '20', color: SC[o.status] || '#666', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{o.status}</span>
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 12, fontFamily: "'DM Mono', monospace", color: '#f97316' }}>₨{o.product_cost}</td>
                      <td style={{ padding: '8px 14px', fontSize: 12, fontFamily: "'DM Mono', monospace", color: o.status === 'delivered' ? '#22c55e' : '#475569' }}>
                        {o.status === 'delivered' ? '₨999' : '—'}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{ background: o.source === 'telegram' ? '#3b82f620' : o.source === 'seed' ? '#22c55e15' : '#f59e0b15', color: o.source === 'telegram' ? '#3b82f6' : o.source === 'seed' ? '#22c55e' : '#f59e0b', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{o.source || 'manual'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CITIES ── */}
        {tab === 'cities' && (
          <div style={{ background: '#1a1a24', borderRadius: 12, border: '1px solid #2d2d3d', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #2d2d3d', fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 1 }}>TOP CITIES</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid #2d2d3d' }}>
                {['City', 'Orders', 'Delivered', 'Returned', 'Return Rate', 'Delivery Rate'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{topCities.map(c => (
                <tr key={c.city} style={{ borderBottom: '1px solid #1e1e2a' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{c.city}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: '#e2e8f0' }}>{c.orders}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: '#22c55e', fontWeight: 600 }}>{c.delivered}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: c.returned > 0 ? '#ef4444' : '#2a3050', fontWeight: c.returned > 0 ? 600 : 400 }}>{c.returned}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: c.rr > 50 ? '#ef4444' : c.rr > 25 ? '#f97316' : '#22c55e' }}>{c.rr}%</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ width: 100, height: 6, background: '#2d2d3d', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: c.rr > 50 ? '#ef4444' : c.rr > 25 ? '#f97316' : '#22c55e', width: `${Math.max(5, (1 - c.rr / 100) * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {/* ── ADS ── */}
        {tab === 'ads' && (
          <div style={{ background: '#1a1a24', borderRadius: 12, border: '1px solid #2d2d3d', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #2d2d3d' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Total: <b style={{ color: '#f59e0b', fontFamily: "'DM Mono', monospace" }}>{fmtPKR(adTotal)}</b></span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid #2d2d3d' }}>
                {['Date', 'PKR', 'GBP', 'Note', 'Source'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{filtAds.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                  <td style={{ padding: '9px 16px', fontSize: 12, color: '#94a3b8' }}>{a.date}</td>
                  <td style={{ padding: '9px 16px', fontSize: 13, fontFamily: "'DM Mono', monospace", color: '#f59e0b', fontWeight: 600 }}>{fmtPKR(a.pkr)}</td>
                  <td style={{ padding: '9px 16px', fontSize: 12, fontFamily: "'DM Mono', monospace", color: '#64748b' }}>{a.gbp > 0 ? `£${a.gbp}` : '—'}</td>
                  <td style={{ padding: '9px 16px', fontSize: 12, color: '#64748b' }}>{a.note}</td>
                  <td style={{ padding: '9px 16px' }}>
                    <span style={{ background: a.source === 'telegram' ? '#3b82f620' : '#22c55e15', color: a.source === 'telegram' ? '#3b82f6' : '#22c55e', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{a.source}</span>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {/* ── PAYMENTS ── */}
        {tab === 'payments' && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { l: 'Total R&S Owes', v: 40607, c: '#3b82f6', sub: 'All 11 invoices' },
              { l: 'Received (HBL)', v: receivedTotal, c: '#22c55e', sub: `${filtPayments.length} payments` },
              { l: 'Outstanding', v: 13523, c: '#f59e0b', sub: 'SI-8032 + SI-7991' },
            ].map(k => (
              <div key={k.l} style={{ background: '#1a1a24', borderRadius: 12, padding: 20, border: `1px solid ${k.c}30`, borderLeft: `3px solid ${k.c}` }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{k.l}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: k.c, fontFamily: "'DM Mono', monospace" }}>{fmtPKR(k.v)}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#1a1a24', borderRadius: 12, border: '1px solid #2d2d3d', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #2d2d3d', fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 1 }}>PAYMENT LEDGER</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid #2d2d3d' }}>
                {['Date', 'Amount', 'Note', 'Source'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtPayments.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1e1e2a' }}>
                    <td style={{ padding: '9px 16px', fontSize: 12, color: '#94a3b8' }}>{p.date}</td>
                    <td style={{ padding: '9px 16px', fontSize: 13, fontFamily: "'DM Mono', monospace", color: '#a855f7', fontWeight: 600 }}>{fmtPKR(p.amount)}</td>
                    <td style={{ padding: '9px 16px', fontSize: 12, color: '#64748b' }}>{p.note}</td>
                    <td style={{ padding: '9px 16px' }}>
                      <span style={{ background: p.source === 'telegram' ? '#3b82f620' : '#22c55e15', color: p.source === 'telegram' ? '#3b82f6' : '#22c55e', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{p.source}</span>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #2d2d3d', background: '#12121a' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>TOTAL RECEIVED</td>
                  <td style={{ padding: '12px 16px', fontSize: 15, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: '#a855f7' }}>{fmtPKR(receivedTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </>}
      </div>
    </div>
  )
}
