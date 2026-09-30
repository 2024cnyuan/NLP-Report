import { describe, it, expect } from 'vitest';
import { tokenizeCorpus, buildVocabulary, encodeCorpus, buildWindowPairs, buildCooccurrence, trainEmbeddings, cosine, nearest, analogy, pca2d, gloveWeight } from '../src/core/embeddings.js';

const corpus = '国王 王后 男人 女人\n国王 男人 王室\n王后 女人 王室\n猫 喜欢 鱼\n狗 喜欢 肉\n猫 狗 宠物';

describe('M01 词向量', () => {
  it('窗口方向与距离正确', () => {
    const sentences = tokenizeCorpus('甲 乙 丙');
    const vocabulary = buildVocabulary(sentences);
    const pairs = buildWindowPairs(encodeCorpus(sentences, vocabulary), 1);
    const decode = pairs.map(pair => `${vocabulary.words[pair.center]}→${vocabulary.words[pair.context]}`);
    expect(decode).toEqual(['甲→乙', '乙→甲', '乙→丙', '丙→乙']);
  });
  it('稀疏共现按距离加权且 GloVe 权重正确', () => {
    const sentences = tokenizeCorpus('甲 乙 丙');
    const vocabulary = buildVocabulary(sentences);
    const entries = buildCooccurrence(encodeCorpus(sentences, vocabulary), 2);
    const id = token => vocabulary.index.get(token);
    expect(entries.find(e => e.i === id('甲') && e.j === id('乙')).value).toBe(1);
    expect(entries.find(e => e.i === id('甲') && e.j === id('丙')).value).toBe(0.5);
    expect(gloveWeight(10)).toBe(1);
    expect(gloveWeight(1)).toBeCloseTo(0.1 ** 0.75, 12);
  });
  it.each(['skipgram', 'cbow', 'glove'])('%s 真实更新、损失有限且固定种子可复现', algorithm => {
    const config = { algorithm, corpus, dimensions: 4, windowSize: 2, negativeSamples: 2, epochs: 4, learningRate: 0.03, seed: 7, minCount: 1 };
    const first = trainEmbeddings(config);
    const second = trainEmbeddings(config);
    expect(first.vectors).toEqual(second.vectors);
    expect(first.losses.every(Number.isFinite)).toBe(true);
    expect(first.vectors.flat().some(value => Math.abs(value) > 1e-5)).toBe(true);
  });
  it('余弦、邻居、类比与 PCA 使用实际向量', () => {
    expect(cosine([1, 0], [1, 0])).toBe(1);
    expect(cosine([0, 0], [1, 0])).toBe(0);
    const model = { words: ['王', '男', '女', '后'], vectors: [[1, 1], [1, 0], [0, 1], [0, 2]] };
    expect(nearest(model, '男', 1)[0].word).toBe('王');
    expect(analogy(model, '王', '男', '女', 1)[0].word).toBe('后');
    const projection = pca2d(model.vectors);
    expect(projection.points).toHaveLength(4);
    expect(projection.points.flat().every(Number.isFinite)).toBe(true);
  });
});
