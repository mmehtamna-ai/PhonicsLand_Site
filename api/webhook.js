const { kv } = require('@vercel/kv');

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-5';

const DEFAULTS = {
  title: 'Recent Updates',
  content:
    'Check back here for the latest notices from Phonics Land — new batches, holiday schedules, and classroom highlights, posted live from Ruchi\'s phone.',
  updatedAt: null,
  updatedBy: null,
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }

  const update = req.body;
  const msg = update && update.message;

  if (!msg || !msg.text) {
    return res.status(200).send('OK');
  }

  const chatId = msg.chat.id;
  const isAllowed = String(chatId) === String(process.env.ALLOWED_CHAT_ID);

  if (!isAllowed) {
    console.warn(`Blocked message from unauthorized chat ID: ${chatId}`);
    return res.status(200).send('OK');
  }

  const text = msg.text.trim();

  try {
    if (text === '/start' || text === '/help') {
      await reply(chatId, helpText());
    } else if (text === '/update' || text.startsWith('/update ')) {
      await handleUpdate(chatId, text);
    } else if (text === '/title' || text.startsWith('/title ')) {
      await handleTitle(chatId, text);
    } else if (text === '/ask' || text.startsWith('/ask ')) {
      await handleAsk(chatId, text);
    } else if (text === '/improve' || text.startsWith('/improve ')) {
      await handleImprove(chatId, text);
    } else if (text === '/clear') {
      await handleClear(chatId);
    } else if (text === '/status') {
      await handleStatus(chatId);
    } else {
      await reply(chatId, 'Unknown command. Send /help to see what I understand.');
    }
  } catch (err) {
    console.error('webhook error:', err);
    await reply(chatId, `⚠️ Something went wrong: ${err.message}`);
  }

  return res.status(200).send('OK');
};

// ---------- Command handlers ----------

async function handleUpdate(chatId, text) {
  const newContent = text.slice('/update'.length).trim();
  if (!newContent) {
    return reply(chatId, 'Usage: /update <text>\nExample: /update New batch starting Monday, 4pm — 2 seats left!');
  }
  const site = await getSite();
  site.content = newContent;
  site.updatedAt = new Date().toISOString();
  site.updatedBy = 'manual';
  await saveSite(site);
  await reply(chatId, `✅ Update posted:\n\n"${newContent}"`);
}

async function handleTitle(chatId, text) {
  const newTitle = text.slice('/title'.length).trim();
  if (!newTitle) {
    return reply(chatId, 'Usage: /title <text>\nExample: /title Holiday Notice');
  }
  const site = await getSite();
  site.title = newTitle;
  site.updatedAt = new Date().toISOString();
  site.updatedBy = 'manual';
  await saveSite(site);
  await reply(chatId, `✅ Section heading updated to:\n\n"${newTitle}"`);
}

async function handleAsk(chatId, text) {
  const question = text.slice('/ask'.length).trim();
  if (!question) {
    return reply(chatId, 'Usage: /ask <question>\nExample: /ask Write a short note welcoming new families to Phonics Land');
  }
  await reply(chatId, '🤖 Thinking…');

  const answer = await callClaude(
    [{ role: 'user', content: question }],
    'You are writing a short notice for the "Recent Updates" section of a language school\'s website (Phonics Land, an English phonics program for young children run by Ruchi). Respond with only the finished notice text — no preamble, no meta-commentary, no surrounding quotation marks. Keep it warm and parent-friendly, a few sentences at most.'
  );

  const site = await getSite();
  site.content = answer;
  site.updatedAt = new Date().toISOString();
  site.updatedBy = 'claude';
  await saveSite(site);
  await reply(chatId, `✅ Published Claude's answer:\n\n${answer}`);
}

async function handleImprove(chatId, text) {
  const instructions = text.slice('/improve'.length).trim();
  if (!instructions) {
    return reply(chatId, 'Usage: /improve <instructions>\nExample: /improve make it shorter and friendlier');
  }
  await reply(chatId, '🤖 Improving current update…');

  const site = await getSite();
  const answer = await callClaude(
    [
      {
        role: 'user',
        content: `Current "Recent Updates" text:\n"${site.content}"\n\nInstructions: ${instructions}`,
      },
    ],
    'You are editing a short notice for the "Recent Updates" section of a language school\'s website (Phonics Land, an English phonics program for young children run by Ruchi). Respond with only the finished, improved notice text — no preamble, no meta-commentary, no surrounding quotation marks.'
  );

  site.content = answer;
  site.updatedAt = new Date().toISOString();
  site.updatedBy = 'claude';
  await saveSite(site);
  await reply(chatId, `✅ Improved update:\n\n${answer}`);
}

async function handleClear(chatId) {
  await saveSite({ ...DEFAULTS, updatedAt: new Date().toISOString(), updatedBy: 'manual' });
  await reply(chatId, '✅ Recent Updates reset to default.');
}

async function handleStatus(chatId) {
  const site = await getSite();
  const updated = site.updatedAt ? new Date(site.updatedAt).toLocaleString() : 'never';
  await reply(
    chatId,
    `📊 Status\n\nHeading: ${site.title}\nUpdate length: ${site.content.length} characters\nLast updated: ${updated}\nUpdated by: ${site.updatedBy || 'n/a'}`
  );
}

// ---------- Helpers ----------

async function getSite() {
  const site = await kv.get('site');
  return site || { ...DEFAULTS };
}

async function saveSite(site) {
  await kv.set('site', site);
}

async function reply(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function callClaude(messages, systemPrompt) {
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function helpText() {
  return (
    '👋 I control the "Recent Updates" section of the Phonics Land website. Commands:\n\n' +
    '/update <text> — post a new update\n' +
    '/title <text> — change the section heading\n' +
    '/ask <question> — Claude writes an update and publishes it\n' +
    '/improve <instructions> — Claude rewrites the current update\n' +
    '/clear — reset to the default message\n' +
    '/status — show current update info'
  );
}
