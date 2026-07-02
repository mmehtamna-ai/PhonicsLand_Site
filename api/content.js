const { kv } = require('@vercel/kv');

const DEFAULTS = {
  title: 'Recent Updates',
  content:
    'Check back here for the latest notices from Phonics Land — new batches, holiday schedules, and classroom highlights, posted live from Ruchi\'s phone.',
  updatedAt: null,
  updatedBy: null,
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const site = (await kv.get('site')) || DEFAULTS;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(site);
  } catch (err) {
    console.error('content.js error:', err);
    return res.status(200).json(DEFAULTS);
  }
};
