"use strict";

const https = require("https");

function requestDeepSeek(body) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: "api.deepseek.com",
      path: "/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
    }, (response) => {
      let raw = "";
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => {
        try { resolve({ status: response.statusCode || 500, data: JSON.parse(raw) }); }
        catch { reject(new Error("DeepSeek 返回了无法识别的结果。")); }
      });
    });
    request.on("error", reject);
    request.write(JSON.stringify(body));
    request.end();
  });
}

exports.main = async (event) => {
  try {
    if (!process.env.DEEPSEEK_API_KEY) throw new Error("服务端尚未配置 DeepSeek API Key。");
    const payload = typeof event.body === "string" ? JSON.parse(event.body) : event;
    const record = payload.record;
    const message = String(payload.message || "").trim();
    if (!record || !message) return { statusCode: 400, body: { error: "缺少对话内容。" } };
    const reflection = Object.entries(record.answers || {}).map(([key, answer]) => `${key}：${answer}`).join("\n");
    const conversation = (record.chat || []).slice(-12).map((item) => ({ role: item.role, content: item.content }));
    const result = await requestDeepSeek({
      model: "deepseek-chat",
      temperature: 0.7,
      messages: [
        { role: "system", content: "你是温和、清晰的中文自我觉察伙伴。请基于用户当天的记录，用开放问题与简短回应帮助其看见自己。不要诊断、评判或替用户做决定；避免长篇说教。若出现自伤或立即危险，请鼓励联系当地紧急服务、可信赖的人或专业心理支持。" },
        { role: "system", content: `当天觉察记录：\n${reflection}` },
        ...conversation,
        { role: "user", content: message },
      ],
    });
    if (result.status >= 400) throw new Error(result.data?.error?.message || "DeepSeek 暂时无法响应。");
    return { statusCode: 200, body: { reply: result.data.choices?.[0]?.message?.content || "我在。你愿意再多说一点吗？" } };
  } catch (error) {
    return { statusCode: 500, body: { error: error instanceof Error ? error.message : "服务暂时不可用。" } };
  }
};
