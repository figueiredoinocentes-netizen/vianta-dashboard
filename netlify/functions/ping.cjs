exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ ok: true, url: process.env.SUPABASE_URL ? 'set' : 'not-set', key: process.env.SUPABASE_SERVICE_KEY ? 'set' : 'not-set' })
  };
};