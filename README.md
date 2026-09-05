# 觉·对话

公开的每日觉察工具。记录和历史对话仅存于访客当前浏览器的 `localStorage`，不会上传到服务端。

## 本地运行

```bash
npm install
npm run dev
```

## 上线结构：GitHub Pages + 腾讯云 SCF

1. 先部署 `tencent-scf/chat-proxy`，并在函数环境变量设置 `DEEPSEEK_API_KEY`。不要把密钥写入前端、提交 Git 或放进 `.env` 后上传。
2. 启用函数 URL 并允许匿名调用。该地址可直接被 GitHub Pages 使用，不需要备案域名。
3. 在 GitHub 仓库 Variables 设置 `CHAT_API_URL` 为函数 URL。
4. 在 GitHub 仓库 Settings → Pages 中选择 **GitHub Actions** 作为发布源，推送 `main` 后自动发布。
5. 为控制公共接口成本，建议在腾讯云函数 URL 上配置限频与告警。

前端将对话请求发给 `CHAT_API_URL`；DeepSeek API Key 仅在腾讯云函数环境中使用。
