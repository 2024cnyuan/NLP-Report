export const EMBEDDING_VERSION = 'embeddings-1.0.0';

export function seededRandom(seed = 42) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function tokenizeCorpus(text) {
  if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('语料必须是小于 2 MB 的文本');
  const sentences = text.split(/\r?\n/u).map(line => line.trim().split(/\s+/u).filter(Boolean)).filter(row => row.length);
  if (!sentences.length) throw new Error('语料为空；请用空格分隔 Token，用换行分隔句子');
  const tokenCount = sentences.reduce((sum, row) => sum + row.length, 0);
  if (tokenCount > 100_000) throw new Error('当前浏览器训练最多处理 100,000 个 Token');
  return sentences;
}

export function buildVocabulary(sentences, minCount = 1) {
  if (!Number.isInteger(minCount) || minCount < 1) throw new Error('最小词频必须为正整数');
  const counts = new Map();
  for (const sentence of sentences) for (const token of sentence) counts.set(token, (counts.get(token) || 0) + 1);
  const words = [...counts].filter(([, count]) => count >= minCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')).map(([word]) => word);
  if (words.length < 2) throw new Error('过滤后词表至少需要两个词');
  const index = new Map(words.map((word, i) => [word, i]));
  return { words, counts: words.map(word => counts.get(word)), index };
}

export function encodeCorpus(sentences, vocabulary) {
  const encoded = sentences.map(row => row.map(token => vocabulary.index.get(token)).filter(index => index !== undefined)).filter(row => row.length);
  if (!encoded.length) throw new Error('没有 Token 通过词频筛选');
  return encoded;
}

export function buildWindowPairs(encoded, windowSize) {
  if (!Number.isInteger(windowSize) || windowSize < 1 || windowSize > 10) throw new Error('窗口大小需为 1–10');
  const pairs = [];
  encoded.forEach((sentence, sentenceIndex) => sentence.forEach((center, position) => {
    for (let offset = -windowSize; offset <= windowSize; offset++) {
      if (!offset || position + offset < 0 || position + offset >= sentence.length) continue;
      pairs.push({ center, context: sentence[position + offset], sentenceIndex, position, contextPosition: position + offset, distance: Math.abs(offset) });
    }
  }));
  if (!pairs.length) throw new Error('语料中没有可用上下文窗口');
  return pairs;
}

export function buildCbowExamples(encoded, windowSize) {
  const examples = [];
  encoded.forEach((sentence, sentenceIndex) => sentence.forEach((target, position) => {
    const context = [];
    for (let offset = -windowSize; offset <= windowSize; offset++) if (offset && sentence[position + offset] !== undefined) context.push(sentence[position + offset]);
    if (context.length) examples.push({ target, context, sentenceIndex, position });
  }));
  if (!examples.length) throw new Error('语料中没有可用 CBOW 样本');
  return examples;
}

export function sigmoidStable(value) {
  return value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));
}

export function negativeLogSigmoid(value) {
  return Math.max(-value, 0) + Math.log1p(Math.exp(-Math.abs(value)));
}

function dotRow(matrix, rowA, other, rowB, dimensions) {
  let sum = 0;
  const a = rowA * dimensions;
  const b = rowB * dimensions;
  for (let d = 0; d < dimensions; d++) sum += matrix[a + d] * other[b + d];
  return sum;
}

function initMatrix(rows, dimensions, random) {
  const values = new Float64Array(rows * dimensions);
  const scale = 0.5 / dimensions;
  for (let i = 0; i < values.length; i++) values[i] = (random() * 2 - 1) * scale;
  return values;
}

function negativeSampler(counts, random) {
  const weights = counts.map(count => count ** 0.75);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const cumulative = [];
  weights.reduce((sum, value, index) => cumulative[index] = sum + value, 0);
  return excluded => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const value = random() * total;
      let low = 0, high = cumulative.length - 1;
      while (low < high) { const mid = (low + high) >> 1; if (value < cumulative[mid]) high = mid; else low = mid + 1; }
      if (low !== excluded) return low;
    }
    return (excluded + 1) % counts.length;
  };
}

function updatePair(input, output, inputIndex, outputIndex, label, dimensions, learningRate) {
  const score = dotRow(input, inputIndex, output, outputIndex, dimensions);
  const probability = sigmoidStable(score);
  const coefficient = probability - label;
  const inputOffset = inputIndex * dimensions;
  const outputOffset = outputIndex * dimensions;
  for (let d = 0; d < dimensions; d++) {
    const inputValue = input[inputOffset + d];
    const outputValue = output[outputOffset + d];
    input[inputOffset + d] -= learningRate * coefficient * outputValue;
    output[outputOffset + d] -= learningRate * coefficient * inputValue;
  }
  return negativeLogSigmoid(label ? score : -score);
}

export function trainSkipGram({ encoded, vocabulary, dimensions = 8, windowSize = 2, negativeSamples = 3, epochs = 20, learningRate = 0.05, seed = 42 }) {
  validateTrainingParams({ dimensions, windowSize, negativeSamples, epochs, learningRate });
  const random = seededRandom(seed);
  const input = initMatrix(vocabulary.words.length, dimensions, random);
  const output = initMatrix(vocabulary.words.length, dimensions, random);
  const pairs = buildWindowPairs(encoded, windowSize);
  const sampleNegative = negativeSampler(vocabulary.counts, random);
  const losses = [];
  for (let epoch = 0; epoch < epochs; epoch++) {
    let loss = 0, terms = 0;
    for (const pair of pairs) {
      loss += updatePair(input, output, pair.center, pair.context, 1, dimensions, learningRate); terms++;
      for (let n = 0; n < negativeSamples; n++) { loss += updatePair(input, output, pair.center, sampleNegative(pair.context), 0, dimensions, learningRate); terms++; }
    }
    losses.push(loss / terms);
  }
  return finishModel('skipgram', vocabulary, dimensions, input, output, losses, { windowSize, negativeSamples, epochs, learningRate, seed }, pairs);
}

export function trainCbow({ encoded, vocabulary, dimensions = 8, windowSize = 2, negativeSamples = 3, epochs = 20, learningRate = 0.05, seed = 42 }) {
  validateTrainingParams({ dimensions, windowSize, negativeSamples, epochs, learningRate });
  const random = seededRandom(seed);
  const input = initMatrix(vocabulary.words.length, dimensions, random);
  const output = initMatrix(vocabulary.words.length, dimensions, random);
  const examples = buildCbowExamples(encoded, windowSize);
  const sampleNegative = negativeSampler(vocabulary.counts, random);
  const losses = [];
  for (let epoch = 0; epoch < epochs; epoch++) {
    let loss = 0, terms = 0;
    for (const example of examples) {
      const hidden = new Float64Array(dimensions);
      for (const word of example.context) for (let d = 0; d < dimensions; d++) hidden[d] += input[word * dimensions + d] / example.context.length;
      const targets = [{ word: example.target, label: 1 }];
      for (let n = 0; n < negativeSamples; n++) targets.push({ word: sampleNegative(example.target), label: 0 });
      const hiddenGradient = new Float64Array(dimensions);
      for (const target of targets) {
        const offset = target.word * dimensions;
        let score = 0;
        for (let d = 0; d < dimensions; d++) score += hidden[d] * output[offset + d];
        const coefficient = sigmoidStable(score) - target.label;
        for (let d = 0; d < dimensions; d++) { hiddenGradient[d] += coefficient * output[offset + d]; output[offset + d] -= learningRate * coefficient * hidden[d]; }
        loss += negativeLogSigmoid(target.label ? score : -score); terms++;
      }
      for (const word of example.context) for (let d = 0; d < dimensions; d++) input[word * dimensions + d] -= learningRate * hiddenGradient[d] / example.context.length;
    }
    losses.push(loss / terms);
  }
  return finishModel('cbow', vocabulary, dimensions, input, output, losses, { windowSize, negativeSamples, epochs, learningRate, seed }, examples);
}

export function buildCooccurrence(encoded, windowSize) {
  const pairs = buildWindowPairs(encoded, windowSize);
  const values = new Map();
  for (const pair of pairs) {
    const key = `${pair.center},${pair.context}`;
    values.set(key, (values.get(key) || 0) + 1 / pair.distance);
  }
  return [...values].map(([key, value]) => { const [i, j] = key.split(',').map(Number); return { i, j, value }; });
}

export function gloveWeight(value, xMax = 10, alpha = 0.75) { return value < xMax ? (value / xMax) ** alpha : 1; }

export function trainGlove({ encoded, vocabulary, dimensions = 8, windowSize = 2, epochs = 30, learningRate = 0.05, seed = 42, xMax = 10, alpha = 0.75 }) {
  validateTrainingParams({ dimensions, windowSize, negativeSamples: 0, epochs, learningRate });
  const random = seededRandom(seed);
  const main = initMatrix(vocabulary.words.length, dimensions, random);
  const context = initMatrix(vocabulary.words.length, dimensions, random);
  const mainBias = new Float64Array(vocabulary.words.length);
  const contextBias = new Float64Array(vocabulary.words.length);
  const gradMain = new Float64Array(main.length).fill(1);
  const gradContext = new Float64Array(context.length).fill(1);
  const gradMainBias = new Float64Array(vocabulary.words.length).fill(1);
  const gradContextBias = new Float64Array(vocabulary.words.length).fill(1);
  const entries = buildCooccurrence(encoded, windowSize);
  const losses = [];
  for (let epoch = 0; epoch < epochs; epoch++) {
    let loss = 0;
    for (const entry of entries) {
      const weight = gloveWeight(entry.value, xMax, alpha);
      const prediction = dotRow(main, entry.i, context, entry.j, dimensions) + mainBias[entry.i] + contextBias[entry.j];
      const error = prediction - Math.log(entry.value);
      loss += weight * error * error;
      const coefficient = 2 * weight * error;
      const a = entry.i * dimensions, b = entry.j * dimensions;
      for (let d = 0; d < dimensions; d++) {
        const mainValue = main[a + d], contextValue = context[b + d];
        const gm = coefficient * contextValue, gc = coefficient * mainValue;
        main[a + d] -= learningRate * gm / Math.sqrt(gradMain[a + d]);
        context[b + d] -= learningRate * gc / Math.sqrt(gradContext[b + d]);
        gradMain[a + d] += gm * gm; gradContext[b + d] += gc * gc;
      }
      mainBias[entry.i] -= learningRate * coefficient / Math.sqrt(gradMainBias[entry.i]);
      contextBias[entry.j] -= learningRate * coefficient / Math.sqrt(gradContextBias[entry.j]);
      gradMainBias[entry.i] += coefficient * coefficient; gradContextBias[entry.j] += coefficient * coefficient;
    }
    losses.push(loss / entries.length);
  }
  const model = finishModel('glove', vocabulary, dimensions, main, context, losses, { windowSize, epochs, learningRate, seed, xMax, alpha }, entries);
  model.cooccurrence = entries;
  model.biases = { main: [...mainBias], context: [...contextBias] };
  return model;
}

function validateTrainingParams({ dimensions, windowSize, negativeSamples, epochs, learningRate }) {
  if (!Number.isInteger(dimensions) || dimensions < 2 || dimensions > 64) throw new Error('向量维度需为 2–64');
  if (!Number.isInteger(windowSize) || windowSize < 1 || windowSize > 10) throw new Error('窗口大小需为 1–10');
  if (!Number.isInteger(negativeSamples) || negativeSamples < 0 || negativeSamples > 20) throw new Error('负采样数需为 0–20');
  if (!Number.isInteger(epochs) || epochs < 1 || epochs > 500) throw new Error('训练轮数需为 1–500');
  if (!Number.isFinite(learningRate) || learningRate <= 0 || learningRate > 1) throw new Error('学习率需在 (0, 1]');
}

function finishModel(algorithm, vocabulary, dimensions, input, output, losses, parameters, traceSource) {
  const vectors = vocabulary.words.map((_, row) => Array.from({ length: dimensions }, (_, d) => input[row * dimensions + d] + output[row * dimensions + d]));
  return { algorithm, words: vocabulary.words, counts: vocabulary.counts, dimensions, vectors, input: [...input], output: [...output], losses, parameters, traceSource: traceSource.slice(0, 200), version: EMBEDDING_VERSION };
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) throw new Error('余弦输入维度不一致');
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

export function nearest(model, word, topK = 5) {
  const index = model.words.indexOf(word);
  if (index < 0) throw new Error(`词表中没有“${word}”`);
  return model.words.map((candidate, i) => ({ word: candidate, similarity: cosine(model.vectors[index], model.vectors[i]), index: i })).filter(item => item.index !== index).sort((a, b) => b.similarity - a.similarity || a.word.localeCompare(b.word, 'zh-CN')).slice(0, topK);
}

export function analogy(model, positiveA, negative, positiveB, topK = 5) {
  const ids = [positiveA, negative, positiveB].map(word => model.words.indexOf(word));
  if (ids.some(id => id < 0)) throw new Error('类比词必须都在词表中');
  const target = model.vectors[0].map((_, d) => model.vectors[ids[0]][d] - model.vectors[ids[1]][d] + model.vectors[ids[2]][d]);
  return model.words.map((word, i) => ({ word, similarity: cosine(target, model.vectors[i]), index: i })).filter(item => !ids.includes(item.index)).sort((a, b) => b.similarity - a.similarity).slice(0, topK);
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return length ? vector.map(value => value / length) : vector.map(() => 0);
}

function multiply(matrix, vector) { return matrix.map(row => row.reduce((sum, value, j) => sum + value * vector[j], 0)); }

export function pca2d(vectors) {
  if (!vectors.length || vectors[0].length < 2) throw new Error('PCA 至少需要二维向量');
  const dimensions = vectors[0].length;
  const means = Array(dimensions).fill(0);
  vectors.forEach(row => row.forEach((value, d) => means[d] += value / vectors.length));
  const centered = vectors.map(row => row.map((value, d) => value - means[d]));
  const covariance = Array.from({ length: dimensions }, () => Array(dimensions).fill(0));
  centered.forEach(row => { for (let i = 0; i < dimensions; i++) for (let j = 0; j < dimensions; j++) covariance[i][j] += row[i] * row[j] / Math.max(1, vectors.length - 1); });
  let first = normalize(Array.from({ length: dimensions }, (_, i) => i === 0 ? 1 : 1 / dimensions));
  for (let iteration = 0; iteration < 100; iteration++) first = normalize(multiply(covariance, first));
  let second = normalize(Array.from({ length: dimensions }, (_, i) => i === 1 ? 1 : 0.5 / dimensions));
  for (let iteration = 0; iteration < 100; iteration++) {
    const next = multiply(covariance, second);
    const projection = next.reduce((sum, value, i) => sum + value * first[i], 0);
    second = normalize(next.map((value, i) => value - projection * first[i]));
  }
  return { points: centered.map(row => [row.reduce((sum, value, d) => sum + value * first[d], 0), row.reduce((sum, value, d) => sum + value * second[d], 0)]), components: [first, second], means };
}

export function trainEmbeddings(config) {
  const sentences = tokenizeCorpus(config.corpus);
  const vocabulary = buildVocabulary(sentences, config.minCount || 1);
  const encoded = encodeCorpus(sentences, vocabulary);
  const shared = { ...config, encoded, vocabulary };
  if (config.algorithm === 'skipgram') return trainSkipGram(shared);
  if (config.algorithm === 'cbow') return trainCbow(shared);
  if (config.algorithm === 'glove') return trainGlove(shared);
  throw new Error('未知词向量算法');
}
