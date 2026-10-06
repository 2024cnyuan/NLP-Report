# GitHub Pages 部署

`pages/index.html` 是项目入口，链接到原目录中的两个页面。`pages/` 内不保存这两个项目的副本。

```text
pages/
├── index.html             # 两个项目的选择入口
└── README.md              # 部署说明
```

原页面及其依赖保留在：

- `Project_gpt6.1/release/`：`index.html`、`app.js`、`style.css`。
- `game/`：`index.html`、`three.min.js`。

首次部署：在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。

网站地址：

- 项目入口：<https://2024cnyuan.github.io/NLP-Report/>
- TensorScope：<https://2024cnyuan.github.io/NLP-Report/Project_gpt6.1/release/index.html>
- 游戏：<https://2024cnyuan.github.io/NLP-Report/game/>

更新 `pages/`、两个原页面目录或 workflow 后，推送到 `main` 会触发 `.github/workflows/pages.yml`。也可在 Actions 中手动运行 **Deploy GitHub Pages**，分支选择 `main`。

workflow 使用 `pages/index.html` 作为发布根目录的首页，并将两个原目录及其静态依赖一起打包上传，再通过 GitHub Pages 官方 Action 部署。仅上传首页会导致项目链接无法访问，因此部署包需要包含这些原文件。工作流不提交代码，也不创建或推送发布分支。

部署后的目录结构：

```text
index.html                 # 来自 pages/index.html
.nojekyll
Project_gpt6.1/release/
├── index.html
├── app.js
└── style.css
game/
├── index.html
└── three.min.js
```

本地更新与预览：

```bash
python3 -m http.server 8000
```

在仓库根目录运行上面的命令，然后打开 <http://localhost:8000/pages/index.html>。入口会自动调整本地相对路径，访问原目录的页面；部署后同样适配 `/NLP-Report/` 项目路径。
