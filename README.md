# Phonics Land Website

A one-page website for Phonics Land (Ruchi's English phonics program, Ahmedabad), with a
**Recent Updates** section you control entirely from Telegram. The page checks for new
updates every 5 seconds, so whatever you send shows up almost instantly.

```
public/index.html   → the website
api/webhook.js        → Telegram webhook: reads your commands, calls Claude, saves updates
api/content.js          → endpoint the website polls every 5 seconds for the current update
vercel.json               → tells Vercel how to run the static site + the two API files
package.json                → the one dependency needed (Vercel KV, for storing the update)
```

You don't need to touch any of the code. Everything below is just clicking through Vercel,
GitHub, and Telegram in your browser.

---

## Part 1 — Put the code on GitHub

1. Go to [github.com](https://github.com) and log in (or create a free account).
2. Click the **+** in the top-right corner → **New repository**.
3. Name it something like `phonics-land-site`, leave it Public or Private (either is fine), don't check any of the "initialize with" boxes, click **Create repository**.
4. On the next page, click **uploading an existing file**.
5. Drag in every file and folder from this project (keep the `public` and `api` folders intact — GitHub will preserve the folder structure).
6. Scroll down, click **Commit changes**.

## Part 2 — Deploy it on Vercel

1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account (this also connects the two automatically).
2. Click **Add New → Project**.
3. Find your `phonics-land-site` repo in the list and click **Import**.
4. Framework Preset: leave it as **Other**. Don't change any build settings.
5. Click **Deploy**. Wait about a minute — you'll get a live URL like `phonics-land-site.vercel.app`.

You'll see the website already, just showing the default placeholder update — that's expected, since we haven't connected the database or Telegram yet.

## Part 3 — Add the database (Vercel KV)

This is what lets the "Recent Updates" section remember what you last sent from Telegram.

1. In your Vercel project, click the **Storage** tab.
2. Click **Create Database**.
3. Choose **KV** (you may see it labeled "Upstash for Redis" — same thing).
4. Give it a name, click **Create**, then click **Connect** to link it to this project.
5. Vercel automatically adds the two environment variables this needs — you don't type anything here.

## Part 4 — Create your Telegram bot

1. Open Telegram, search for **@BotFather**, start a chat.
2. Send `/newbot`.
3. Give it a name (anything, e.g. "Phonics Land Bot") and a username ending in `bot` (e.g. `phonicslandbot`).
4. BotFather replies with a long token that looks like `8922680300:AAHuU7aME2AisftvhOcPfiB...` — **copy this, you'll need it in a moment.**
5. Now search for **@userinfobot**, start a chat, send any message. It replies with your numeric Telegram ID (e.g. `1234567890`) — **copy this too.**

## Part 5 — Get a Claude API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and log in or sign up.
2. Go to **API Keys** (left sidebar), click **Create Key**.
3. Copy the key — it starts with `sk-ant-`. **You won't be able to see it again after this, so copy it now.**

## Part 6 — Add your environment variables to Vercel

Environment variables are just the private settings (tokens, keys) your code needs — you set them once in Vercel, and the code reads them automatically. Nothing sensitive ever appears in your public GitHub repo.

1. In your Vercel project: **Settings → Environment Variables**.
2. Add each of these one at a time — type the name exactly, paste the value, leave all three environment boxes (Production, Preview, Development) checked, click **Save**:

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | the token from BotFather |
| `CLAUDE_API_KEY` | your Anthropic key (starts `sk-ant-`) |
| `ALLOWED_CHAT_ID` | your numeric ID from @userinfobot — just the number, nothing else |

3. Once all three are added, go to the **Deployments** tab, click the **⋯** on the latest deployment, and click **Redeploy**. This is required — environment variables only take effect after a fresh deploy.

## Part 7 — Connect Telegram to your website

Once redeployed, find your site's real URL: **Settings → Domains** (it'll look like `phonics-land-site.vercel.app`, with no random letters/numbers in it — that's important, see the troubleshooting note below).

In your browser's address bar, visit this exact URL, filling in your own token and domain:
```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR-DOMAIN>.vercel.app/api/webhook
```

For example:
```
https://api.telegram.org/bot8922680300:AAHuU7aME2AisftvhOcPfiB/setWebhook?url=https://phonics-land-site.vercel.app/api/webhook
```

You should see:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## Part 8 — Try it

Message your bot on Telegram:

| Command | What it does |
|---|---|
| `/start` or `/help` | Lists all commands |
| `/update <text>` | Posts a new update directly |
| `/title <text>` | Changes the "Recent Updates" heading |
| `/ask <question>` | Claude writes an update and publishes it |
| `/improve <instructions>` | Claude rewrites the current update |
| `/clear` | Resets to the default message |
| `/status` | Shows the current update, its length, and when it was posted |

Open your website and watch — within 5 seconds of sending a command, the Recent Updates section should change.

---

## Troubleshooting

**Nothing happens when I message the bot.**
Visit `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo` in your browser. Check:
- `"url"` — is it your real domain, not a placeholder or an old preview URL (the ones with random letters like `phonics-land-site-a8x92k.vercel.app`)? Preview URLs change on every push and can be blocked by Vercel's login protection. Always use the stable domain from **Settings → Domains**.
- `"last_error_message"` — if present, it tells you exactly what failed.

**The webhook URL says OK, but my bot still won't reply.**
Double check `ALLOWED_CHAT_ID` in Vercel exactly matches the number @userinfobot gave you — no extra text, spaces, or the word "ID" included. If you edit it, redeploy again afterward.

**I want to see what's actually happening.**
Vercel project → **Deployments** → click the latest one → **Logs** (or **Functions**). Send a Telegram command and watch this in real time — any crash or error will appear here immediately.

## Notes

- The Claude model used is `claude-sonnet-5`. If Anthropic renames or retires it later, update `CLAUDE_MODEL` near the top of `api/webhook.js`.
- The site refreshes every 5 seconds — fine for a trial with light traffic. If this ever gets real visitor traffic, consider slowing it down (change `REFRESH_MS` in `public/index.html`) to stay comfortably within Vercel's free-tier function usage.
- Contact details on the page are placeholders — send me the phone/WhatsApp number whenever you're ready and I'll add them in permanently (or you can just `/update` them into the Recent Updates section for now).
