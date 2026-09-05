# 腾讯云 SCF 深入对话代理

1. 在腾讯云 SCF 上海地域创建函数，运行环境选 Node.js 20.19，入口为 `index.main_handler`。
2. 上传此目录内容，或用 Serverless Cloud Framework 部署 `serverless.yml`。
3. 在函数环境变量设置 `DEEPSEEK_API_KEY`，不要写入前端、GitHub 或 `.env`。
4. 启用函数 URL，并允许匿名调用。函数 URL 为固定 HTTPS 地址，不需要自有备案域名。
5. 将函数 URL 填入 GitHub 仓库 Variables 的 `CHAT_API_URL`；随后推送 `main`，GitHub Pages 会重新构建。

函数只允许 GitHub Pages 和本地开发地址跨域读取。如果 GitHub 用户名、仓库或本地端口变化，请同步修改 `ALLOWED_ORIGINS`。
