import katex from 'katex';

// Presentation-only equivalents of the existing inspector formulas.
// The original formula text remains available beside the rendered math.
export const formulaTypesetting = new Map([
  ['cos(a,b) = (a·b) / (‖a‖‖b‖)；PCA 基于中心化向量', [String.raw`\cos(a,b)=\frac{a\cdot b}{\lVert a\rVert\lVert b\rVert}`]],
  ['J=f(Xᵢⱼ)(wᵢ·wⱼ+bᵢ+bⱼ−log Xᵢⱼ)²', [String.raw`J=f(X_{ij})(w_i\cdot w_j+b_i+b_j-\log X_{ij})^2`]],
  ['J=−log σ(u·v₊)−Σ log σ(−u·v₋)；∂J/∂u=Σ(σ(s)−y)v', [String.raw`J=-\log\sigma(u\cdot v_+)-\sum_{v_-}\log\sigma(-u\cdot v_-)`, String.raw`\frac{\partial J}{\partial u}=\sum(\sigma(s)-y)v`]],
  ['hₜ = tanh(Wxₜ + Uhₜ₋₁ + b)', [String.raw`h_t=\tanh(Wx_t+Uh_{t-1}+b)`]],
  ['i,f,o = σ(Wx+Uh+b)；g = tanh(Wg x+Ug h+bg)；cₜ=f⊙cₜ₋₁+i⊙g；hₜ=o⊙tanh(cₜ)', [String.raw`i,f,o=\sigma(Wx+Uh+b)`, String.raw`g=\tanh(W_gx+U_gh+b_g)`, String.raw`c_t=f\odot c_{t-1}+i\odot g`, String.raw`h_t=o\odot\tanh(c_t)`]],
  ['z,r = σ(Wx+Uh+b)；n = tanh(Wn x+Un(r⊙h)+bn)；hₜ=z⊙hₜ₋₁+(1−z)⊙n（reset-before）', [String.raw`z,r=\sigma(Wx+Uh+b)`, String.raw`n=\tanh(W_nx+U_n(r\odot h)+b_n)`, String.raw`h_t=z\odot h_{t-1}+(1-z)\odot n`]],
  ['h₀=0；c₀=0', [String.raw`h_0=0,\quad c_0=0`]],
  ['cₜ=f⊙cₜ₋₁+i⊙g', [String.raw`c_t=f\odot c_{t-1}+i\odot g`]],
  ['zₜ = ΣᵢΣd Kᵢd Eₜ₊ᵢ,d + b；aₜ = max(0,zₜ)；p = maxₜ aₜ', [String.raw`z_t=\sum_i\sum_d K_{id}E_{t+i,d}+b`, String.raw`a_t=\max(0,z_t)`, String.raw`p=\max_t a_t`]],
  ['卷积窗口内 Kᵢd × Eₜ₊ᵢ,d', [String.raw`K_{id}\times E_{t+i,d}`]],
  ['logits=C·concat(pool)+b；p=softmax(logits)', [String.raw`\mathrm{logits}=C\cdot\operatorname{concat}(\mathrm{pool})+b`, String.raw`p=\operatorname{softmax}(\mathrm{logits})`]],
  ['score=w·count(tokens)+b；类别=sign(score)', [String.raw`\mathrm{score}=w\cdot\operatorname{count}(\mathrm{tokens})+b`, String.raw`\mathrm{class}=\operatorname{sign}(\mathrm{score})`]],
  ['log P(c,x)=log P(c)+Σ count(w)log P(w|c)；P=softmax(logscores)', [String.raw`\log P(c,x)=\log P(c)+\sum_w\operatorname{count}(w)\log P(w\mid c)`, String.raw`P=\operatorname{softmax}(\mathrm{logscores})`]],
  ['Cᵢⱼ = count(y_true=i AND y_pred=j)', [String.raw`C_{ij}=\operatorname{count}(y_{\mathrm{true}}=i\;\land\;y_{\mathrm{pred}}=j)`]],
  ['sᵢⱼ = qᵢ·kⱼ；Aᵢⱼ = exp(sᵢⱼ − logΣexp(sᵢ))', [String.raw`s_{ij}=q_i\cdot k_j`, String.raw`A_{ij}=\exp\!\left(s_{ij}-\log\sum_\ell\exp(s_{i\ell})\right)`]],
  ['sᵢⱼ = qᵢ·kⱼ / √d；Aᵢⱼ = exp(sᵢⱼ − logΣexp(sᵢ))', [String.raw`s_{ij}=\frac{q_i\cdot k_j}{\sqrt d}`, String.raw`A_{ij}=\exp\!\left(s_{ij}-\log\sum_\ell\exp(s_{i\ell})\right)`]],
  ['sᵢⱼ = vₐᵀ tanh(Wq qᵢ + Wk kⱼ + b)；Aᵢⱼ = exp(sᵢⱼ − logΣexp(sᵢ))', [String.raw`s_{ij}=v_a^{\mathsf T}\tanh(W_qq_i+W_kk_j+b)`, String.raw`A_{ij}=\exp\!\left(s_{ij}-\log\sum_\ell\exp(s_{i\ell})\right)`]],
  ['Oᵢd = Σⱼ Aᵢⱼ Vⱼd', [String.raw`O_{id}=\sum_j A_{ij}V_{jd}`]],
  ['L = mean(softplus(z) − y·z)；∇L = mean((σ(z)−y)x)；w ← w−η∇L', [String.raw`L=\operatorname{mean}(\operatorname{softplus}(z)-yz)`, String.raw`\nabla L=\operatorname{mean}((\sigma(z)-y)x)`, String.raw`w\leftarrow w-\eta\nabla L`]],
  ['z=w·x；p=σ(z)；CE=softplus(z)−y·z', [String.raw`z=w\cdot x,\quad p=\sigma(z)`, String.raw`\mathrm{CE}=\operatorname{softplus}(z)-yz`]],
]);

export function renderFormula(source) {
  const equations = formulaTypesetting.get(source);
  if (!equations) return null;
  try {
    return equations.map(tex => `<div class="math-equation">${katex.renderToString(tex, {
      throwOnError: true, trust: false, strict: 'error',
      output: 'htmlAndMathml', displayMode: false, maxExpand: 1000,
    })}</div>`).join('');
  } catch {
    // A typesetting failure must never prevent numerical inspection.
    return null;
  }
}
