# Trust Mart — Setup Guide
## From zero to live in ~30 minutes

---

## STEP 1 — Create Telegram Bot (2 mins)

1. Open Telegram, search for **@BotFather**
2. Send: `/newbot`
3. Choose a name: `Trust Mart Bot`
4. Choose a username: `trustmart_ammar_bot` (must end in `bot`)
5. Copy the **token** it gives you (looks like `1234567890:ABCdef...`)
   → This is your `TELEGRAM_BOT_TOKEN`

6. Now find YOUR chat ID:
   - Search for **@userinfobot** on Telegram
   - Start it, it will reply with your ID number
   → This is your `TELEGRAM_ALLOWED_CHAT_ID`

---

## STEP 2 — Create Supabase Database (5 mins)

1. Go to **supabase.com** → Sign up (free, no card needed)
2. Click **New Project**
   - Name: `trustmart`
   - Database Password: save this somewhere safe
   - Region: pick nearest (e.g. EU West or Asia)
3. Wait ~2 mins for project to be created

4. Go to **SQL Editor** (left sidebar)
5. Click **New Query**
6. Open the file `sql/schema.sql` from this project
7. Copy ALL the contents and paste into the SQL editor
8. Click **Run** — this creates all tables and loads all 117 historical orders

9. Go to **Settings → API** (left sidebar)
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role key** (scroll down) → `SUPABASE_SERVICE_KEY`

---

## STEP 3 — Get Anthropic API Key (2 mins)

1. Go to **console.anthropic.com**
2. Sign in or create account
3. Go to **API Keys** → Create new key
4. Copy it → `ANTHROPIC_API_KEY`

---

## STEP 4 — Deploy to Vercel (5 mins)

1. Go to **github.com** → Create a new repository called `trustmart-dashboard`
2. Upload all the project files (drag and drop works)
   OR if you have Git installed:
   ```
   cd trustmart
   git init
   git add .
   git commit -m "initial"
   git remote add origin https://github.com/YOUR_USERNAME/trustmart-dashboard.git
   git push -u origin main
   ```

3. Go to **vercel.com** → Log in → **Add New Project**
4. Import your `trustmart-dashboard` repository
5. Click **Environment Variables** and add all 6 variables from `.env.example`:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_KEY
   TELEGRAM_BOT_TOKEN
   TELEGRAM_ALLOWED_CHAT_ID
   ANTHROPIC_API_KEY
   ```
6. Click **Deploy**
7. Wait ~1 min. Vercel will give you a URL like:
   `https://trustmart-dashboard.vercel.app`

---

## STEP 5 — Connect Telegram to Vercel (2 mins)

This tells Telegram where to send messages (your Vercel URL).

Open your browser and go to this URL (replace with your values):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://trustmart-dashboard.vercel.app/api/telegram
```

You should see: `{"ok":true,"result":true}`

That's it — your bot is live!

---

## STEP 6 — Test It

Open Telegram, find your bot, and send:
```
/start
```

You should get the help message back immediately.

Then try:
```
spent 2000 on tiktok today
```

Check your dashboard — it should appear within seconds.

---

## HOW TO USE THE BOT

### Log ad spend:
```
spent 1500 on tiktok today
tiktok ads 4200 pkr yesterday
```

### Log R&S payment:
```
received 8380 from RS today SI-8032
RS paid me 5143 pkr invoice SI-7991
```

### Log order updates (text):
```
15 delivered 3 returned today
LE7530406xxx delivered Karachi today
10 orders delivered from lahore batch
```

### Send screenshots:
- Take screenshot of RS Courier portal
- Send directly to the bot
- Claude reads it and extracts all statuses automatically

### Send PDFs:
- Forward the RS invoice PDF to the bot
- All payment details extracted automatically

### Quick summary:
```
/summary
```

---

## TROUBLESHOOTING

**Bot not responding?**
- Check the webhook is set correctly (Step 5)
- Check your env variables in Vercel → Settings → Environment Variables
- Check Vercel function logs: Vercel Dashboard → your project → Functions

**Dashboard not updating?**
- Check Supabase is connected: go to Supabase → Table Editor → check orders table has data
- Dashboard auto-refreshes every 30 seconds

**"Unauthorised" message from bot?**
- Your `TELEGRAM_ALLOWED_CHAT_ID` is wrong
- Message @userinfobot again to confirm your ID

---

## YOUR DASHBOARD URL
After deployment: `https://trustmart-dashboard.vercel.app`

Bookmark this on your phone and desktop. It shows live data always.
