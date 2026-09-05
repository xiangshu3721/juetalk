'use strict';

const DEFAULT_ORIGIN = 'https://xiangshu3721.github.io';
const json = (statusCode, body, origin) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  },
  body: JSON.stringify(body),
});
const safeText = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const parseBody = (event) => {
  const raw = event?.body || '{}';
  return typeof raw === 'string' ? JSON.parse(event?.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw) : raw;
};
const originFor = (event) => {
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  const allowed = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGIN).split(',').map((item) => item.trim());
  return allowed.includes(origin) ? origin : allowed[0];
};
const hasCrisis = (text) => /自杀|自残|不想活|结束生命|伤害自己|伤害他人/.test(text);

exports.main_handler = async (event) => {
  const origin = originFor(event);
  if (event?.httpMethod === 'OPTIONS') return json(204, {}, origin);
  if (event?.httpMethod !== 'POST') return json(405, { error: '仅支持 POST 请求。' }, origin);
  try {
    if (!process.env.DEEPSEEK_API_KEY) return json(500, { error: '深入对话服务尚未配置。' }, origin);
    const input = parseBody(event);
    const message = safeText(input.message, 1200);
    const record = input.record || {};
    if (!message) return json(400, { error: '请先写下想说的话。' }, origin);
    if (JSON.stringify(input).length > 60000) return json(413, { error: '本次对话内容过多，请精简后再试。' }, origin);

    const reflection = Object.entries(record.answers || {}).map(([key, answer]) => `${key}：${safeText(answer, 1000)}`).join('\n');
    const history = Array.isArray(record.chat) ? record.chat.slice(-12).map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user', content: safeText(item?.content, 1200),
    })).filter((item) => item.content) : [];
    const crisis = hasCrisis(`${reflection}\n${message}`);
    const response = await fetch(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        temperature: 0.7,
        messages: [
          { role: 'system', content: '你是温和、清晰的中文自我觉察伙伴。请基于用户当天的记录，用开放问题与简短回应帮助其看见自己。不要诊断、评判或替用户做决定；避免长篇说教。若出现自伤或立即危险，请鼓励联系当地紧急服务、可信赖的人或专业心理支持。' },
          { role: 'system', content: `当天觉察记录：\n${reflection}` },
          ...history,
          { role: 'user', content: message },
        ],
      }),
    });
    if (!response.ok) return json(502, { error: '深入对话暂时无法响应，请稍后再试。' }, origin);
    const reply = (await response.json())?.choices?.[0]?.message?.content?.trim();
    if (!reply) return json(502, { error: '深入对话未返回有效内容，请稍后再试。' }, origin);
    return json(200, { reply, crisis }, origin);
  } catch {
    return json(400, { error: '请求格式不正确，请稍后再试。' }, origin);
  }
};
