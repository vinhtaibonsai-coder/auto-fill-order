import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOcrResult } from '../../src/application/ai/ocr-evaluator.js';

test('Vision OCR Evaluator: identifies high-quality printed order as GOOD', () => {
  const highQualityVisionResponse = {
    fullTextAnnotation: {
      text: 'Anh Tuấn\n0987654321\n123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP. Hồ Chí Minh\nTiền thu hộ COD: 250.000đ\nÁo thun nam',
      pages: [
        {
          blocks: [
            {
              paragraphs: [
                {
                  words: [
                    { confidence: 0.98, symbols: [] },
                    { confidence: 0.96, symbols: [] },
                    { confidence: 0.99, symbols: [] },
                    { confidence: 0.94, symbols: [] },
                    { confidence: 0.97, symbols: [] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  };

  const evalResult = evaluateOcrResult(highQualityVisionResponse, { threshold: 0.80 });

  assert.equal(evalResult.isGood, true, 'High confidence clear order should be classified as GOOD');
  assert.ok(evalResult.confidence >= 90, 'Confidence should be >= 90%');
  assert.equal(evalResult.hasPhone, true, 'Phone number should be detected');
  assert.equal(evalResult.hasAddress, true, 'Address keyword should be detected');
  assert.ok(evalResult.fullText.includes('0987654321'));
});

test('Vision OCR Evaluator: classifies blurry or low-confidence scan as BAD for Gemini Vision fallback', () => {
  const lowQualityVisionResponse = {
    fullTextAnnotation: {
      text: 'a..h T..n\n098?65..21\nđườ..g ng..y..n tr..i',
      pages: [
        {
          blocks: [
            {
              paragraphs: [
                {
                  words: [
                    { confidence: 0.42, symbols: [] },
                    { confidence: 0.38, symbols: [] },
                    { confidence: 0.55, symbols: [] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  };

  const evalResult = evaluateOcrResult(lowQualityVisionResponse, { threshold: 0.80 });

  assert.equal(evalResult.isGood, false, 'Low confidence scan should be classified as BAD');
  assert.ok(evalResult.confidence < 80, 'Confidence should be below threshold');
  assert.ok(evalResult.reasons.length > 0, 'Reasons should be documented');
});

test('Vision OCR Evaluator: classifies scan missing phone/address entities as BAD', () => {
  const missingEntitiesResponse = {
    fullTextAnnotation: {
      text: 'Chào mừng quý khách đã ghé thăm gian hàng của chúng tôi tại hội chợ triển lãm',
      pages: [
        {
          blocks: [
            {
              paragraphs: [
                {
                  words: [
                    { confidence: 0.95, symbols: [] },
                    { confidence: 0.94, symbols: [] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  };

  const evalResult = evaluateOcrResult(missingEntitiesResponse, { threshold: 0.80 });

  assert.equal(evalResult.isGood, false, 'Text lacking order phone/address should trigger fallback');
  assert.equal(evalResult.hasPhone, false);
});

test('Vision OCR Evaluator: handles empty or null responses safely', () => {
  const nullResult = evaluateOcrResult(null);
  assert.equal(nullResult.isGood, false);
  assert.equal(nullResult.confidence, 0);

  const emptyResult = evaluateOcrResult({ fullTextAnnotation: { text: '' } });
  assert.equal(emptyResult.isGood, false);
  assert.equal(emptyResult.fullText, '');
});
