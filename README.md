# 觉·对话

公开的每日觉察工具。记录和历史对话仅存于访客当前浏览器的 `localStorage`，不会上传到服务端。

## 本地运行

```bash
npm install
npm run dev
```

## 国内上线：腾讯云 CloudBase

1. 在 `cloudbaserc.json` 填入 CloudBase 环境 ID。
2. 在腾讯云函数 `chat` 的环境变量中设置 `DEEPSEEK_API_KEY`。不要把密钥写入前端、提交 Git 或放进 `.env` 后上传。
3. 部署函数，并把 HTTP 路径 `/api/chat` 路由到函数 `chat`。
4. `npm run build` 后部署 `dist` 到静态网站托管。
5. 为正式访问绑定已备案的自定义域名，并对 `/api/chat` 开启限频。

前端将对话请求发到同域 `/api/chat`；DeepSeek API Key 仅在云函数环境中使用。
