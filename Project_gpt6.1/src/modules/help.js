import { download, escapeHTML, icon, notify } from '../components/ui.js';
import '../styles/help.css';

const chapters = [
  ['quickstart', '01', '跟着做一次实验'],
  ['workspace', '02', '看懂界面与按钮'],
  ['modes', '03', '原理 / 实验模式'],
  ['modules', '04', '六个模块怎么用'],
  ['data', '05', '导入自己的数据'],
  ['notebook', '06', '保存、导出与重放'],
  ['workflow', '07', '把模块串起来'],
  ['faq', '08', '常见问题与边界'],
  ['datasets', '09', '案例 / 数据集实验'],
  ['diagnosis', '10', '模型错误诊断'],
  ['learning', '11', '可跳转学习路线'],
];

const sampleCSV = `text,label,split,group
故事精彩，值得推荐,正向,train,a
体验糟糕，令人失望,负向,train,b
讲解清楚，内容有趣,正向,validation,c
功能复杂，使用麻烦,负向,validation,d
产品实用，操作方便,正向,validation,e
画面模糊，声音刺耳,负向,validation,f
画面漂亮，音乐动听,正向,test,g
服务敷衍，态度很差,负向,test,h
`;

function figure(id, label, content, caption) {
  return `<figure class="guide-figure"><svg viewBox="0 0 720 270" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${label}</title><desc id="${id}-desc">${caption}</desc>${content}</svg><figcaption>${caption}</figcaption></figure>`;
}

function attentionPicture() {
  const columns = ['我', '喜欢', '自然', '语言', '处理'];
  const rows = ['理解', '语言', '的', '关系'];
  const cells = rows.flatMap((word, row) => columns.map((_, col) => {
    const selected = row === 0 && col === 3;
    return `<rect x="${116 + col * 53}" y="${83 + row * 34}" width="45" height="26" rx="5" fill="${selected ? '#fff2e1' : '#dcece6'}" stroke="${selected ? '#a86a2f' : '#c2d9d1'}" stroke-width="${selected ? 2 : 1}"/>${selected ? '<circle cx="297" cy="96" r="5" fill="#a86a2f"/>' : ''}`;
  })).join('');
  return figure('guide-attention-picture', '点击注意力格子，查看计算来源', `
    <rect x="20" y="22" width="394" height="222" rx="14" fill="#fff" stroke="#d1e1dc"/>
    <text x="42" y="51" class="guide-svg-heading">注意力权重 · 点击一条连接</text>
    ${columns.map((word, i) => `<text x="${138 + i * 53}" y="73" text-anchor="middle">${word}</text>`).join('')}
    ${rows.map((word, i) => `<text x="86" y="${101 + i * 34}" text-anchor="end">${word}</text>`).join('')}
    ${cells}
    <text x="42" y="231" class="guide-svg-muted">行：目标 Query　列：源 Key</text>
    <path d="M305 96H436l-7-5m7 5-7 5" fill="none" stroke="#a86a2f" stroke-width="2"/>
    <rect x="449" y="22" width="250" height="222" rx="14" fill="#f0f7f4" stroke="#bed6cb"/>
    <text x="469" y="52" class="guide-svg-heading">计算显微镜</text>
    <text x="469" y="87">理解 → 语言</text>
    <rect x="466" y="102" width="216" height="34" rx="6" fill="#fff"/>
    <text x="478" y="124">打分 → Softmax → 权重</text>
    <text x="469" y="163">查看 q、k、原始 score</text>
    <text x="469" y="190">核对同一行的权重和</text>
    <text x="469" y="220" class="guide-svg-muted">锁定后可保留此计算</text>
  `, '操作示意，非结果截图：先点第 1 行「理解」、第 4 列「语言」的格子，再看右侧的真实数值与公式。');
}

function workspacePicture() {
  return figure('guide-workspace-picture', '实验页面的三个操作区域', `
    <rect x="18" y="18" width="684" height="234" rx="14" fill="#fff" stroke="#d1e1dc"/>
    <rect x="32" y="32" width="656" height="36" rx="7" fill="#edf5f1"/>
    <text x="46" y="55" class="guide-svg-heading">实验标题</text>
    <text x="370" y="55">固定为 A　保存实验　导出</text>
    <rect x="32" y="80" width="159" height="157" rx="8" fill="#f5f8f7" stroke="#d8e5df"/>
    <text x="48" y="107" class="guide-svg-heading">① 输入与参数</text>
    <rect x="47" y="123" width="129" height="37" rx="5" fill="#fff" stroke="#d8e5df"/>
    <text x="58" y="146">文本 / 维度 / 种子</text>
    <rect x="47" y="184" width="129" height="30" rx="5" fill="#147b72"/>
    <text x="112" y="204" text-anchor="middle" fill="#fff">计算 / 训练</text>
    <rect x="203" y="80" width="297" height="157" rx="8" fill="#fff" stroke="#d8e5df"/>
    <text x="220" y="107" class="guide-svg-heading">② 实际结果</text>
    <path d="M225 126v87h249M235 141l47 43 48-23 47 35 82-9" fill="none" stroke="#6c9e8c" stroke-width="2"/>
    <circle cx="330" cy="161" r="6" fill="#fff2e1" stroke="#a86a2f" stroke-width="2"/>
    <rect x="512" y="80" width="176" height="157" rx="8" fill="#f0f7f4" stroke="#d8e5df"/>
    <text x="528" y="107" class="guide-svg-heading">③ 计算检查器</text>
    <text x="528" y="141">输入数值</text><text x="528" y="170">公式 / 形状</text>
    <text x="528" y="199">权重与上游来源</text>
  `, '布局示意，非计算结果：左侧改输入，中间看图，点击可检查的数字后在右侧追踪来源；手机上部分区域会纵向排列。');
}

function workflowPicture() {
  const items = [
    [25, 35, '01', '导入数据', '预览 → 确认'],
    [265, 35, '02', '训练词向量', '送入 RNN / CNN'],
    [505, 35, '03', '训练并评测', '同一划分 / 同一模型'],
    [505, 165, '04', '筛选错误', '点击 RNN / CNN 解释'],
    [265, 165, '05', '回到模型内部', '同权重 / 同 Token'],
    [25, 165, '06', '保存实验笔记', '导出 JSON → 重放'],
  ];
  return figure('guide-workflow-picture', '从数据到实验笔记的完整路径', `
    <path d="M215 78h43m-6-5 6 5-6 5M455 78h43m-6-5 6 5-6 5M600 118v39m-5-6 5 6 5-6M505 208h-43m6-5-6 5 6 5M265 208h-43m6-5-6 5 6 5" fill="none" stroke="#7eaa98" stroke-width="2"/>
    ${items.map(([x, y, num, title, sub]) => `<rect x="${x}" y="${y}" width="190" height="83" rx="12" fill="#f0f7f4" stroke="#c7ded2"/><text x="${x + 15}" y="${y + 25}" class="guide-svg-muted">${num}</text><text x="${x + 15}" y="${y + 47}" class="guide-svg-heading">${title}</text><text x="${x + 15}" y="${y + 68}" class="guide-svg-muted">${sub}</text>`).join('')}
  `, '建议学习路径：评测中的「解释」会保留参与预测的模型与 Token，不会偷偷换成随机权重。');
}

function chapter(id, num, title, content) {
  return `<section id="help-${id}" class="guide-section panel" tabindex="-1" aria-labelledby="help-${id}-title"><header class="guide-section-heading"><span class="guide-section-number">${num}</span><h2 id="help-${id}-title">${title}</h2><a href="#help/top" class="guide-top-link" aria-label="${title}：返回目录">返回目录 ↑</a></header><div class="guide-section-body">${content}</div></section>`;
}

function moduleCard(id, num, title, principle, operation, caution) {
  return `<article class="guide-module"><span class="eyebrow">LAB ${num}</span><h3>${title}</h3><p><strong>理解什么：</strong>${principle}</p><p><strong>怎么操作：</strong>${operation}</p><p class="guide-caution">${caution}</p><a class="guide-link" href="#${id}">打开${title} ${icon('arrow', 16)}</a></article>`;
}

export function mountHelp(root) {
  root.innerHTML = `<div class="guide">
    <section id="help-top" class="guide-hero" tabindex="-1" aria-labelledby="guide-title">
      <div><span class="eyebrow">FIELD GUIDE / 本地实验指南</span><h2 id="guide-title">从一次操作，读懂一个算法。</h2><p>先跑一个小例子，再追踪数字、改变参数、保存发现。<br>不必先读代码；下面的入口都可以直接点击。</p><div class="guide-hero-actions"><a class="btn primary" href="#help/quickstart">跟着做一次实验 ${icon('arrow', 17)}</a><a class="btn" href="#help/data">我想导入数据</a><a class="btn" href="#help/notebook">我想保存笔记</a><a class="btn" href="#help/learning">按学习路线开始</a></div></div>
      <div class="guide-hero-note">${icon('scope', 34)}<strong>输入 → 计算 → 检查 → 对照 → 保存</strong><span>全部在本地完成 · 不上传文件 · 无需 API</span></div>
    </section>
    <div class="guide-layout">
      <nav class="guide-toc panel" aria-label="使用说明目录"><span class="eyebrow">ON THIS PAGE</span><h2>按需阅读</h2>${chapters.map(([id, num, title]) => `<a href="#help/${id}"><span>${num}</span>${title}</a>`).join('')}<div class="guide-toc-footer">想直接开始？<a href="#attention">打开注意力实验 →</a><a href="#data">打开数据集管理 →</a><a href="#notebook">打开实验笔记 →</a></div></nav>
      <div class="guide-chapters">
        ${chapter('quickstart', '01', '跟着做一次实验', `
          <p class="guide-lead">例子：屏蔽一条注意力连接，看看同一行的权重怎样变化。约 3 分钟，不需要准备数据。</p>
          <div class="guide-example-input"><div><span>源序列 · Key / Value</span><code>我 喜欢 自然 语言 处理</code></div><div><span>目标序列 · Query</span><code>理解 语言 的 关系</code></div><p>使用空格分词；打分方式选「缩放点积」，教学向量维度选 4。若之前改过参数，请先恢复以上输入，清空掩码和显式 Q/K/V，再点击「计算注意力」。</p></div>
          ${attentionPicture()}
          <ol class="guide-steps">
            <li><strong>打开并计算。</strong>进入<a href="#attention">注意力机制</a>，等待「结果已更新」。这是 4 个 Query × 5 个 Key 的小矩阵。</li>
            <li><strong>先查一个数字。</strong>点击第 1 行「理解」、第 4 列「语言」。右侧显示 q、k、score 和 Softmax；同一行权重和应约为 1。看完关闭检查器。</li>
            <li><strong>留住原结果。</strong>点击页面顶部「固定为 A」。保持序列、维度和打分方式不变。</li>
            <li><strong>只屏蔽一条连接。</strong>点击「编辑掩码」，再点击刚才的格子。该连接权重变为 0，其余未屏蔽连接重新归一化；注意不要把整行都屏蔽。</li>
            <li><strong>观察变化。</strong>向下查看「A / B · 受控对照」和「Δ · B − A」。先退出掩码编辑，再点格子检查新权重；Δ 为正表示 B 比 A 大，为负表示变小。</li>
            <li><strong>记录发现。</strong>点击「保存实验」，命名为「注意力掩码对照」，写下观察；或者点击「导出 → 实验 JSON」，之后到<a href="#notebook">实验笔记</a>导入并重新运行。</li>
          </ol>
          <div class="guide-callout"><strong>这个例子说明什么？</strong><p>注意力是一整行的竞争分配，屏蔽一格会影响其他连接。向量是教学映射，不是翻译模型权重；热力图不证明真实语义或翻译对齐。固定 A 用于当前会话对照；注意力、CNN、序列模块保存或导出 B 时，会一并打包现有 A 基线和结果分析，重放时双方重新计算。</p></div>
          <a href="#attention" class="btn primary">打开注意力，照着做 ${icon('arrow', 17)}</a>
        `)}
        ${chapter('workspace', '02', '看懂界面与按钮', `
          ${workspacePicture()}
          <dl class="guide-definitions"><div><dt>本次计算链与分析</dt><dd>注意力、CNN、序列模块在图形上方列出真实计算步骤。先选连接、窗口或时间步，再点步骤查看公式和完整代入值；可选择输出维度、状态维度及解释类别。LSTM 展示四门激活前值、细胞/隐藏状态和最终损失梯度。下方分析列出实测指标；固定 A 后重算 B，口径匹配时列出 B−A，不能只凭数值变化判断模型更优。</dd></div><div><dt>计算 / 训练</dt><dd>修改输入后点对应按钮。多数页面会自动运行默认小样例；参数改变后旧结果会标为过期，请重新运行后再保存。</dd></div><div><dt>计算显微镜</dt><dd>点击可检查的热力格子、隐状态、卷积激活、池化值或损失点，查看公式、输入和来源。「锁定此计算」可保留内容，检查其他数字前先解除锁定。Tab 定位按钮，Enter 选择。显微镜标题旁的「Aa」可独立调字号、宽高；也可拖左上角，或聚焦该角用方向键调大小（左/上增大，右/下缩小，Shift加速）。小屏自动限幅，长内容在框内滚动，锁定不妨碍调整显示。</dd></div><div><dt>固定为 A</dt><dd>把这次有效结果设为基线，再改一个因素运行 B。页面标明单因素或多因素变化；结构不兼容时不会强行相减。更多操作见<a href="#help/quickstart">上面的例子</a>。</dd></div><div><dt>暂停 / 继续 / 取消</dt><dd>后台任务运行时出现进度条，可暂停或取消。暂停仅保留当前内存状态，不支持关闭浏览器后续训。</dd></div><div><dt>字号与窗口</dt><dd>右上角「Aa」打开显示设置，页面字号90%–150%，显微镜独立90%–180%；拖滑块立即生效，可一键恢复默认。仅保存本机显示偏好，不改输入、权重、成绩或结果有效状态。浏览器禁用存储时仍可在本次会话调节。</dd></div><div><dt>演示视图</dt><dd>右上角播放图标放大画布、收起部分导航和参数，适合投屏；不是录制动画，仍可进行真实交互。</dd></div></dl>
        `)}
        ${chapter('modes', '03', '原理 / 实验模式', `
          <div class="guide-two-col"><article class="guide-mode"><span class="eyebrow">理解一个数字</span><h3>原理模式</h3><p>建议短文本、小矩阵和低维向量。先看公式，再点中间值，核对每一步输入如何得到输出。</p><p class="guide-mode-example">试一试：到<a href="#cnn">文本卷积</a>点击一个池化值，追溯产生它的窗口。</p></article><article class="guide-mode"><span class="eyebrow">比较一次改变</span><h3>实验模式</h3><p>建议改变一个参数，重新训练或批量评测，用 A/B、曲线和错误样本解释结果差异。</p><p class="guide-mode-example">试一试：到<a href="#optimization">损失与优化</a>固定正常学习率为 A，再运行大步长案例。</p></article></div>
          <p>当前切换主要标记工作模式、提示使用方式，并写入保存记录；不会自动换参数、权重或重新计算。两种模式共用数学核心和预算；逐项检查、Worker 与分块展示由各模块提供。</p><div class="guide-callout"><strong>「实验」不是「软件测试」。</strong><p>网页实验用于学习算法。Vitest / Playwright 用于开发验证，不需要普通使用者运行，也不会因为切换模式而启动。</p></div>
        `)}
        ${chapter('modules', '04', '六个模块怎么用', `
          <div class="guide-module-grid">
            ${moduleCard('embeddings', '01', '词向量空间', 'Skip-gram 用中心词预测上下文；CBOW 方向相反；GloVe 拟合共现统计。', '每行一句语料 → 选择分词、窗口和维度 → 训练 → 搜词、查邻居、检索 b − a + c 类比。图上可拖拽、缩放、Shift 框选；支持 A/B。', '余弦相似度在原空间计算，PCA 图只用于观察；小语料类比不保证符合常识。')}
            ${moduleCard('sequence', '02', '序列与记忆', 'RNN 的递推、LSTM 的细胞状态与门、GRU 的门控，以及最终 CE 的真实反向梯度。', '选择来源与结构 → 计算完整轨迹 → 前进一步、回退或播放 → 点击状态与门值。长序列案例可观察早期梯度。', '教学初始化不是训练好的分类器。已训练/传入模型使用原权重；固定四模型工作台只接收 RNN，不把 LSTM/GRU 冒充 RNN。')}
            ${moduleCard('cnn', '03', '文本卷积', 'Embedding → 卷积逐项乘加 → ReLU → max-over-time → 分类。', '输入文本 → 计算 → 选择核、移动窗口 → 点击池化值回到 argmax 窗口。可显式改一个核权重并重新计算。', '改权重会产生新模型版本，旧成绩不代表新模型；需要送回工作台重新评测。')}
            ${moduleCard('attention', '04', '注意力机制', 'Query / Key 打分，经掩码与 Softmax 得到权重，再对 Value 加权。', '输入空格分词序列 → 选择点积、缩放点积或加性打分 → 计算 → 点格子 → 固定 A、修改 mask。也可提供 Q/K/V JSON。', '教学向量未经过翻译训练；整行 mask 会被拒绝。完整操作见本页第 01 节。')}
            ${moduleCard('comparison', '05', '多模型对照', '在同一数据上对比 NB、SVM、RNN、Text-CNN 的真实预测与错误。', '并排预测新文本；批量评测现有权重，或训练四模型再评测。查看 Accuracy/F1、混淆矩阵，筛选错误、OOV 和否定转折，再点解释。', 'OOV 是词表外 Token。NB/RNN/CNN 的概率默认未校准；SVM margin 不是概率，校准只用独立验证集。')}
            ${moduleCard('optimization', '06', '损失与优化', '两个自由参数的 Logistic 分类器如何计算 CE、梯度并执行 SGD 更新。', '设置学习率、步数和初值 → 运行 → 点损失曲线查看参数、梯度和下一步权重。正常学习率固定 A，再试慢收敛或大步长。', '全数据评估损失与当步训练批损失分开记录；二维等高线确实来自此两参数模型。')}
          </div>
        `)}
        ${chapter('data', '05', '导入自己的数据', `
          <p class="guide-lead">数据集导入提供训练与预测用的样本；恢复以前的实验，请使用<a href="#help/notebook">实验 JSON 导入</a>，不要混用。</p>
          <ol class="guide-steps"><li>打开<a href="#data">数据集管理</a>，选择 UTF-8 的 TXT / CSV / JSONL / JSON 文件。CSV 第一行需要字段名；可选择逗号、Tab 或分号。</li><li>映射文本、可选标签和划分字段，选择分词方式。中文字符模式按汉字与英文词切分；空格模式要求你提前分词。</li><li>检查预览中的数量、标签、重复、长度及 train / validation / test 划分，点击「确认使用数据」。只选择文件而不确认，不会切换当前数据。</li><li>进入<a href="#comparison">多模型对照</a>。分词或类别与原模型不兼容时，在当前数据上重新训练；不会自动替换模型。要训练词向量，到<a href="#embeddings">词向量空间</a>点击「使用已导入数据」。</li></ol>
          <div class="guide-code-heading"><h3>可直接试用的 CSV · 8 条样本</h3><button class="btn compact" id="help-download-csv">${icon('download', 16)} 下载示例 CSV</button></div><pre class="guide-code"><code>${escapeHTML(sampleCSV.trim())}</code></pre><p class="small">这个小文件只演示导入、字段映射和划分，不用于证明准确率或泛化能力。</p>
          <dl class="guide-definitions"><div><dt>text / label</dt><dd>text 必须是非空文本；label 可以省略。当前分类工作台支持二分类，无标签只能预测，不能产生 Accuracy / F1。训练需要两类带标签样本。</dd></div><div><dt>split / group</dt><dd>split 可为 train / validation / test；缺省时按固定哈希分组，约 70/10/20，小样本不保证精确比例。group 为可选同模板分组；同组或完全重复 Token 跨划分会报错，近重复仍需你合理分组。</dd></div></dl>
          <details class="guide-details"><summary>我用 TXT / JSONL / JSON，怎么组织？</summary><p>TXT 每个非空行一条文本，无标签；JSONL 每行一个包含 text、可选 label / split / group 的对象；JSON 使用样本数组或含 samples 数组的对象。JSONL/JSON 也可提供明确的 tokens 数组。</p><pre class="guide-code"><code>{"text":"故事精彩","label":"正向","split":"train","group":"a"}</code></pre></details>
        `)}
        ${chapter('notebook', '06', '保存、导出与重放', `
          <ol class="guide-steps"><li><strong>保存。</strong>实验结果有效后点「保存实验」，填名称与备注。例如「注意力掩码对照」：屏蔽理解→语言，检查剩余权重和。</li><li><strong>带走。</strong>模块顶部「导出」可选择下列三种格式。笔记中的「导出完整 JSON」还包含保存时的名称与备注。</li><li><strong>恢复。</strong>打开<a href="#notebook">实验笔记</a>，选择导出的实验 JSON，校验后点「重新运行」。恢复输入、配置和适用权重，重新执行计算，不直接认可导入文件里写的成绩。</li><li><strong>继续对照。</strong>导入记录先重算，再在模块页面固定为 A，改变一个因素运行 B。</li></ol>
          <div class="guide-export-grid"><article><strong>JSON</strong><span>用于重新计算</span><p>包含输入、参数、适用权重、版本和实际结果；注意力、CNN、序列还包含分析和已固定的 A 基线。</p></article><article><strong>CSV</strong><span>用于分析数值</span><p>以 path / value 导出结果，可放入表格工具。</p></article><article><strong>Markdown</strong><span>用于撰写报告</span><p>包含配置与计算结果；注意力、CNN、序列增加可读的指标分析与 A/B 差值表，方便说明实验过程。</p></article></div>
          <div class="guide-callout"><strong>重要记录请主动导出。</strong><p>普通保存保留最近 20 条记录。浏览器本地存储不可用或满时退回内存会话；未保存的数据集、参数和模型不保证刷新后保留。CSV / Markdown 不能用于重放；实验 JSON 导入最多 10 MiB，要求匹配算法版本。</p></div>
          <p>多模型笔记可导出「仅引用原数据」，减小文件体积。酒店/微博的引用记录会校验内置清洗数据的SHA-256与样本指纹，再离线重新训练，不需要重复导入CSV。其他用户数据仍需重新导入预处理与样本指纹匹配的原文件，仅文件名相同不够。固定 A 单独仍不是永久备份；注意力、CNN、序列模块在保存或导出 B 时，会同时保存 A 的输入、权重、结果和分析，重放双方均重新计算。其余模块请分别保存 A 和 B。</p><a class="guide-link" href="#notebook">打开实验笔记 ${icon('arrow', 16)}</a>
        `)}
        ${chapter('workflow', '07', '把模块串起来', `
          ${workflowPicture()}
          <p>在<a href="#embeddings">词向量空间</a>训练后点「送入 RNN / CNN」。<a href="#comparison">多模型工作台</a>会显示向量维度、训练词表覆盖率与分词方式；不同分词需要显式确认 Token 交集重映射，未覆盖词用相同种子初始化。</p><p>训练并评测后，在预测表中点 RNN / CNN「解释」，进入<a href="#sequence">序列</a>或<a href="#cnn">卷积</a>页面。解释携带原样本、原 Token 和当时模型；不会换成新的教学权重。修改权重后可送回评测，但必须重新计算指标。</p>
        `)}
        ${chapter('faq', '08', '常见问题与边界', `
          <details class="guide-details" open><summary>按钮灰了，或者提示「结果过期」怎么办？</summary><p>输入修改后旧结果不再对应当前配置；重新点击计算或训练。任务正在运行时部分按钮会暂时禁用，可等待、暂停或取消。</p></details>
          <details class="guide-details"><summary>为什么导入数据后不能直接评测？</summary><p>模型的分词方式或类别顺序可能不兼容。确认数据后到多模型工作台重新训练；检查训练划分是否有两类标签。超长样本须主动分段，不会偷偷截断。</p></details>
          <details class="guide-details"><summary>概率很高，或者深度模型分数很低，意味着什么？</summary><p>默认概率未经可靠性校准，SVM margin 不是概率。内置 56 条 AI 辅助原创句子仅作教学，固定 32/8/16 划分；真实低分会如实显示，不代表大规模 NLP 能力。</p></details>
          <details class="guide-details"><summary>离线怎么打开？有哪些规模限制？</summary><p>整体保留 release 下 index.html、app.js、style.css，双击 index.html，不需要 Node / Vite / 网络。配图内嵌在页面，无外部图片加载。</p><ul><li>导入最多 50 MiB / 50,000 条；词向量最多 1,000,000 Token / 20,000 词 / 64 维。</li><li>注意力最多 1024×1024；序列解释最多 256 Token；CNN、神经训练和批量推理最多 128 Token。</li><li>这是输入预算，不是全部档位的性能保证；超限会拒绝。已有 WSL Chromium 验证，Windows Chrome/Edge 仍需人工验收。</li></ul></details>
          <a href="#help/top" class="guide-link">返回目录，选择下一个实验 ↑</a>
        `)}
        ${chapter('datasets', '09', '案例 / 数据集实验', `
          <p class="guide-lead">先用案例看清一个预测，再用真实数据检查一批预测。入口在<a href="#comparison">多模型对照</a>顶部的「实验范围」；这不是顶部「原理 / 实验」的视图标记。</p>
          <div class="guide-two-col"><article class="guide-mode"><h3>案例模式</h3><p>保留原有并排预测、四模型训练和教学数据。适合输入一条句子、核对分数，然后进入 RNN / CNN 的原权重解释。</p><a href="#comparison" class="guide-link">打开案例模式 →</a></article><article class="guide-mode"><h3>数据集模式</h3><p>真实内置数据暂不接入，等待你提供文件。已确认的用户数据可按种子采样、重新训练所选模型，只用留出的测试集报告成绩。此模式的模型不会替换案例工作台模型。</p><a href="#comparison/dataset" class="guide-link">打开数据集模式 →</a></article></div>
          <div class="table-wrap"><table class="data-table"><thead><tr><th>内置真实数据</th><th>正负样本</th><th>训练 / 验证 / 测试</th></tr></thead><tbody><tr><td>ChnSentiCorp 酒店评论</td><td>2,944条：各1,472条</td><td>2060 / 294 / 590</td></tr><tr><td>微博情感评论</td><td>5,000条：各2,500条</td><td>3500 / 500 / 1000</td></tr></tbody></table></div>
          <ol class="guide-steps"><li><strong>选择数据。</strong>在<a href="#comparison/dataset">数据集模式</a>选酒店或微博。酒店用于观察评论文本，微博保留emoji、话题和口语。两者来自用户提供的原始CSV，不是生成句子。已有其他文件可先到数据集管理确认，再选「已确认的用户数据」。</li><li><strong>从100条开始。</strong>默认100是总数：70训练 / 10验证 / 20测试，各类等量。先只勾NB，再加入SVM / RNN / CNN。数量为20到数据容量之间的偶数；每类训练取floor(70%)、验证floor(10%)、余量测试，所以其他数量不一定恰为70/10/20比例。「使用完整数据集」只填写数量，仍需点击运行。</li><li><strong>运行真实训练。</strong>内置数据按种子42预先划定训练 / 验证 / 测试，不是官方划分。运行种子只改变各池中的选样顺序，不把测试文本借给训练。词表只看训练集。NB闭式估计，SVM优化hinge+L2，RNN/CNN做反向传播；全量神经训练较慢，可暂停或取消。</li><li><strong>核对成绩。</strong>看Accuracy、Macro-F1、类别₁ Precision/Recall/F1与测试分母。100条实验分母20，错一条改变5个百分点；全量酒店分母590，微博1000。验证集本轮不参与调参或挑选最优轮数。成绩反映本次短文本平衡子集，不能当成原始全量基准排名。</li><li><strong>诊断与解释。</strong>选择诊断模型，查看错分方向、未知词占比和重叠切片。点击混淆格子或只看错误；打开RNN/CNN解释时携带实际训练权重，不会换成随机教学权重。</li><li><strong>对照并保存。</strong>固定A，保持数据、数量和种子不变，只改轮数运行B。顶部可保存笔记、导出JSON/CSV/Markdown；JSON重放重新计算，不信任导入成绩。A/B分别保存。更换酒店/微博是领域观察，不是同一测试集上的受控比较。</li></ol>
          <div class="guide-callout"><strong>清洗与使用边界</strong><p>先合并空白，按本项目local-v1 Token规则（汉字逐字、英文数字按词、符号保留）排除空文和超过128 Token的整条样本，不截断。按规范化Token序列去重；标签冲突整组删除，最后各类等量抽样。酒店保留全部1,472条合格负样本并抽取等量正样本；微博从原始119,988条中清洗后抽取5,000条。近重复与作者/话题组泄漏未自动排除，不能据此声称完全无泄漏。原始语料不适用项目代码许可，使用和再分发需确认数据权利。运行无需网络，来源链接只在主动点击时联网。</p></div>
          <p>用户数据先到<a href="#data">数据集管理</a>确认。当前模式要求二分类、各类足够原train/test样本、无重复Token序列、无跨划分组、每条≤128 Token。样本不足或超限会拒绝，不自动补样本或截断。</p>
        `)}
        ${chapter('diagnosis', '10', '模型错误诊断', `
          <p class="guide-lead">准确率告诉你错了多少；诊断帮助找到要检查哪些样本。<a href="#comparison/diagnosis">案例工作台的诊断</a>与<a href="#comparison/dataset">数据集模式的诊断</a>都来自实际预测。</p>
          <dl class="guide-definitions"><div><dt>错分方向</dt><dd>分别统计类别₀→类别₁和类别₁→类别₀。混淆矩阵行是真实类别，列是预测类别；点击一格可筛选对应样本。</dd></div><div><dt>OOV和长度切片</dt><dd>查看无OOV / 含OOV、长度≤64 / &gt;64，以及含否定转折词形的样本数、错误数和错误率。切片可能重叠，各自有分母；没有样本显示「无样本」，不会算成0%错误。</dd></div><div><dt>错误案例</dt><dd>最多展开前10条：真实/预测标签、Token长度、OOV、模型分歧和概率或margin。归一化概率高不代表可靠，SVM margin不是概率。没有错误时仍提示小样本全对不等于解决任务。</dd></div><div><dt>回到计算内部</dt><dd>NB/SVM点「检查词项贡献」，看每项词计数、分数贡献和先验/偏置。RNN/CNN点「查看原模型计算」，进入逐步解释。同一个样本、Token与模型版本才构成一致的溯源。</dd></div><div><dt>如何记录分析</dt><dd>先写事实，例如「含OOV的8条中错5条」。再提出待验证假设，例如「词表覆盖可能影响预测」。保持其他因素不变后再改输入或训练参数，重新运行并记录；诊断线索不是因果结论。</dd></div></dl>
        `)}
        ${chapter('learning', '11', '可跳转学习路线', `
          <p class="guide-lead">每一步都有操作入口和检查目标。完成一项再继续；路线不自动记录完成状态，也不自动启动下一项训练。</p>
          <ol class="learning-roadmap">
            <li><h3>分词与表示</h3><p>用短语料训练词向量，检查一个词的邻居与余弦相似度。目标：区分原空间数值和PCA投影。</p><div class="inline-actions"><a class="btn" href="#embeddings">打开词向量</a><a href="#help/data">了解数据输入</a></div></li>
            <li><h3>局部模式与序列记忆</h3><p>CNN查窗口→ReLU→池化；RNN/LSTM查前态→四门→细胞/隐藏状态。目标：核对一次真实乘加和状态更新。</p><div class="inline-actions"><a class="btn" href="#cnn">打开CNN</a><a class="btn" href="#sequence">打开RNN / LSTM</a></div></li>
            <li><h3>注意力与归一化</h3><p>跟着掩码例子，检查打分、Softmax、Value加权。目标：一行和为1，mask后未屏蔽位置重新归一化。</p><div class="inline-actions"><a class="btn" href="#attention">打开Attention</a><a href="#help/quickstart">掩码对照步骤</a></div></li>
            <li><h3>损失与训练</h3><p>固定正常学习率为A，改变学习率运行B。目标：区分当步批损失与全数据损失，检查梯度和下一步参数。</p><div class="inline-actions"><a class="btn" href="#optimization">打开损失与优化</a></div></li>
            <li><h3>从案例走向真实数据</h3><p>先并排预测一条文本，再分别运行酒店和微博100条实验，比较NB/SVM/RNN/CNN。目标：核对70/10/20划分、训练词表与测试分母，理解小样本波动。</p><div class="inline-actions"><a class="btn" href="#comparison">打开案例</a><a class="btn primary" href="#comparison/dataset">运行数据集实验</a><a href="#help/datasets">阅读实验说明</a></div></li>
            <li><h3>错误诊断与可复现报告</h3><p>找一个错分，记录事实与假设，检查原模型，再保存JSON并重放。目标：重放重新计算而非信任外部成绩；为A和B分别留存记录。</p><div class="inline-actions"><a class="btn" href="#comparison/diagnosis">打开错误诊断</a><a class="btn" href="#notebook">打开实验笔记</a><a href="#help/notebook">导出与重放说明</a></div></li>
          </ol>
        `)}
      </div>
    </div>
  </div>`;

  root.querySelector('#help-download-csv').onclick = () => {
    download('TensorScope-导入示例.csv', sampleCSV, 'text/csv');
    notify('示例已下载；到数据集管理选择此 CSV，预览后确认');
  };

  const requestedSection = location.hash.split('/')[1];
  const section = chapters.some(([id]) => id === requestedSection) ? requestedSection : 'top';
  const target = root.querySelector(`#help-${section}`);
  root.querySelector(`.guide-toc a[href="#help/${section}"]`)?.setAttribute('aria-current', 'location');
  const frame = requestAnimationFrame(() => {
    if (!root.contains(target)) return;
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (section !== 'top') target.focus({ preventScroll: true });
  });
  return () => cancelAnimationFrame(frame);
}
