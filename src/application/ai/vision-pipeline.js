// =========================================================================
// VISION TO ORDER PIPELINE (GOOGLE VISION OCR + GEMINI VISION FALLBACK)
// =========================================================================

import { evaluateOcrResult } from './ocr-evaluator.js';
import { OrderProcessor } from '../order-parser/parser.esm.js';
import { parseCache } from '../cache/parse-cache.js';

/**
 * Xử lý hình ảnh đơn hàng theo mô hình phân nhánh thông minh:
 * 1. Chạy Google Vision OCR
 * 2. Đánh giá OCR Confidence
 * 3. Phân nhánh:
 *    - GOOD: Dùng Order Parser + AI Text Normalizer
 *    - BAD: Dùng Gemini Vision Multimodal
 * 4. Trả về cấu trúc Order JSON chuẩn hóa
 */
export async function processImageToOrder(imageBase64, options = {}) {
  const {
    threshold = 0.80,
    session = null,
    onProgress = () => {},
    customVisionKey = '',
    customGeminiKey = ''
  } = options;

  if (!imageBase64) {
    throw new Error('Dữ liệu hình ảnh không hợp lệ.');
  }

  // Chuẩn hóa định dạng base64 (loại bỏ tiền tố data:image/...;base64, nếu có khi gửi lên API)
  let cleanBase64 = imageBase64;
  if (imageBase64.includes(',')) {
    cleanBase64 = imageBase64.split(',')[1];
  }

  const shopId = session?.active_shop_id || 'default';

  // 0. KIỂM TRA CACHE ẢNH / OCR TRƯỚC (Latency < 2ms)
  try {
    const cachedResult = await parseCache.getImage(cleanBase64, shopId);
    if (cachedResult && cachedResult.orderData) {
      onProgress({
        step: 'OCR_CACHE_HIT',
        message: '⚡ Nhận diện tức thì từ Cache ảnh (tiết kiệm quota Vision/Gemini)',
        confidence: cachedResult.confidence || 95,
        isGood: true
      });
      return {
        ...cachedResult,
        imageThumbnail: imageBase64,
        fromCache: true
      };
    }
  } catch (cacheErr) {
    console.warn('[VisionPipeline] Lỗi đọc cache ảnh:', cacheErr);
  }

  onProgress({
    step: 'OCR_SCANNING',
    message: '🔍 Đang quét nhận diện chữ bằng Google Vision OCR...'
  });

  let ocrResponse = null;
  let ocrError = null;

  // 1. GỌI GOOGLE VISION OCR
  try {
    ocrResponse = await callVisionOcrService({
      imageBase64: cleanBase64,
      session,
      apiKey: customVisionKey
    });
  } catch (err) {
    console.warn('[VisionPipeline] Google Vision OCR lỗi hoặc không khả dụng:', err);
    ocrError = err;
  }

  // 2. ĐÁNH GIÁ ĐỘ TIN CẬY OCR
  let evaluation = { isGood: false, confidence: 0, fullText: '', reasons: ['OCR không phản hồi'] };
  if (ocrResponse && !ocrError) {
    evaluation = evaluateOcrResult(ocrResponse, { threshold });
  }

  onProgress({
    step: 'EVALUATING',
    confidence: evaluation.confidence,
    isGood: evaluation.isGood,
    reasons: evaluation.reasons,
    message: `📊 Độ tin cậy OCR: ${evaluation.confidence}% - ${evaluation.isGood ? 'Rõ nét' : 'Cần hỗ trợ AI Vision'}`
  });

  // 3. PHÂN NHÁNH XỬ LÝ

  // ── NHÁNH A: GOOD (Ảnh rõ nét, OCR tin cậy cao) ───────────────────────────
  if (evaluation.isGood && evaluation.fullText) {
    onProgress({
      step: 'PARSING_LOCAL',
      message: '⚡ Đang bóc tách thông tin qua Order Parser...'
    });

    let localParsed = null;
    try {
      const parser = (typeof window !== 'undefined' && (window.OrderProcessor || globalThis.OrderProcessor)) || OrderProcessor;
      if (parser && typeof parser.parse === 'function') {
        localParsed = parser.parse(evaluation.fullText);
      }
    } catch (e) {
      console.warn('[VisionPipeline] Local parse error:', e);
    }

    if (!localParsed) {
      localParsed = {
        name: '',
        phone: '',
        address: 'không tìm thấy',
        orderCode: '',
        productItem: '',
        codAmount: 0,
        collectFee: false,
        extraPhones: [],
        extraNote: ''
      };
    }

    const goodResult = {
      success: true,
      branch: 'GOOD',
      source: 'google_vision',
      confidence: evaluation.confidence,
      score: evaluation.score,
      rawText: evaluation.fullText,
      imageThumbnail: imageBase64,
      evaluation,
      orderData: {
        ...localParsed,
        rawAddress: localParsed.address || '',
        normalizedAddress: localParsed.address || '',
        addressSource: 'google_vision_ocr'
      }
    };
    try {
      await parseCache.setImage(cleanBase64, shopId, goodResult);
    } catch (_) {}
    return goodResult;
  }

  // ── NHÁNH B: BAD (Ảnh mờ / Chữ viết tay / Bố cục phức tạp / OCR lỗi) ──────
  onProgress({
    step: 'GEMINI_VISION',
    message: '🤖 Kích hoạt Gemini Vision Multimodal đọc trực tiếp từ ảnh...'
  });

  try {
    const geminiResult = await callGeminiVisionService({
      imageBase64: cleanBase64,
      rawOcrText: evaluation.fullText || '',
      session,
      apiKey: customGeminiKey
    });

    if (!geminiResult || !geminiResult.ok) {
      throw new Error(geminiResult?.error || 'Gemini Vision không trích xuất được dữ liệu');
    }

    const data = geminiResult.result || {};
    const normalizedOrder = normalizeVisionOrderResult(data, evaluation.fullText);

    const badResult = {
      success: true,
      branch: 'BAD',
      source: 'gemini_vision',
      confidence: geminiResult.confidence || Math.max(90, evaluation.confidence),
      rawText: evaluation.fullText || (normalizedOrder.name + ' - ' + normalizedOrder.phone + ' - ' + normalizedOrder.address),
      imageThumbnail: imageBase64,
      evaluation,
      orderData: {
        ...normalizedOrder,
        rawAddress: normalizedOrder.address || '',
        normalizedAddress: normalizedOrder.address || '',
        addressSource: 'gemini_vision'
      }
    };
    try {
      await parseCache.setImage(cleanBase64, shopId, badResult);
    } catch (_) {}
    return badResult;
  } catch (geminiErr) {
    console.warn('[VisionPipeline] Gemini Vision thất bại hoặc quá tải:', geminiErr?.message || geminiErr);

    // Fallback khẩn cấp: nếu Gemini cũng lỗi, nhưng OCR có chữ thì dùng tạm text OCR + local parser
    if (evaluation && evaluation.fullText && evaluation.fullText.trim().length > 0) {
      const fallbackParsed = (typeof OrderProcessor !== 'undefined' && OrderProcessor.parse)
        ? OrderProcessor.parse(evaluation.fullText)
        : { name: '', phone: '', address: evaluation.fullText, codAmount: 0, orderCode: '', productItem: '', collectFee: false, extraPhones: [], extraNote: '' };

      return {
        success: true,
        branch: 'FALLBACK_OCR',
        source: 'google_vision_fallback',
        confidence: Math.max(50, evaluation.confidence || 50),
        rawText: evaluation.fullText,
        imageThumbnail: imageBase64,
        evaluation,
        orderData: fallbackParsed,
        warning: 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.'
      };
    }

    // Nếu không có cả OCR text, trả về safe empty order data kèm warning thay vì throw làm fail trắng màn hình:
    const emptyOrder = {
      name: '',
      phone: '',
      address: '',
      codAmount: 0,
      orderCode: '',
      productItem: '',
      collectFee: false,
      extraPhones: [],
      extraNote: ''
    };

    return {
      success: true,
      branch: 'FALLBACK_LOCAL_EMPTY',
      source: 'local_fallback',
      confidence: 0,
      rawText: '',
      imageThumbnail: imageBase64,
      evaluation,
      orderData: emptyOrder,
      warning: 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.'
    };
  }
}

/**
 * Gửi yêu cầu OCR tới Service Worker / AI Gateway
 */
async function callVisionOcrService({ imageBase64, session, apiKey }) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'runVisionOcr',
        imageBase64,
        token: session?.access_token || session?.shop_access_key,
        shopKey: session?.shop_access_key,
        shopId: session?.active_shop_id,
        deviceId: session?.device_id,
        customApiKey: apiKey
      }, response => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!response || !response.ok) {
          return reject(new Error(response?.error || 'Lỗi quét ảnh Google Vision OCR'));
        }
        resolve(response.result || response.data);
      });
    } else {
      reject(new Error('Extension runtime không khả dụng.'));
    }
  });
}

/**
 * Gửi yêu cầu Gemini Vision tới Service Worker / AI Gateway
 */
async function callGeminiVisionService({ imageBase64, rawOcrText, session, apiKey }) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'runGeminiVision',
        imageBase64,
        rawOcrText,
        token: session?.access_token || session?.shop_access_key,
        shopKey: session?.shop_access_key,
        shopId: session?.active_shop_id,
        deviceId: session?.device_id,
        customApiKey: apiKey
      }, response => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!response || !response.ok) {
          return reject(new Error(response?.error || 'Lỗi bóc tách ảnh Gemini Vision'));
        }
        resolve(response);
      });
    } else {
      reject(new Error('Extension runtime không khả dụng.'));
    }
  });
}

/**
 * Chuẩn hóa output từ Gemini Vision thành format đơn hàng
 */
function normalizeVisionOrderResult(aiRes, rawOcrText = '') {
  const safe = {};

  let rawName = aiRes.name ? String(aiRes.name).trim() : '';
  let extraNote = aiRes.extraNote || aiRes.note || aiRes.ghiChu || '';
  if (typeof extraNote === 'string') extraNote = extraNote.trim();
  else extraNote = '';

  const parenMatch = rawName.match(/(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    rawName = parenMatch[1].trim();
    const noteInside = parenMatch[2].trim();
    extraNote = extraNote ? `${noteInside} | ${extraNote}` : noteInside;
  }

  safe.name = rawName;
  safe.extraNote = extraNote;

  const phoneClean = aiRes.phone ? String(aiRes.phone).replace(/\D/g, '') : '';
  const isValidPhone = phoneClean.length === 10 || phoneClean.length === 11;
  safe.phone = isValidPhone ? phoneClean : (aiRes.phone ? String(aiRes.phone).trim() : '');

  safe.orderCode = aiRes.orderCode ? String(aiRes.orderCode).trim() : '';
  safe.productItem = aiRes.productItem || aiRes.product || aiRes.hangHoa || '';

  // Parse COD Amount
  let codVal = 0;
  if (aiRes.codAmount !== undefined && aiRes.codAmount !== null) {
    if (typeof aiRes.codAmount === 'number') {
      codVal = Number.isFinite(aiRes.codAmount) ? aiRes.codAmount : 0;
    } else {
      const parsedCod = (typeof OrderProcessor !== 'undefined' && OrderProcessor.parseCOD)
        ? OrderProcessor.parseCOD(String(aiRes.codAmount))
        : parseInt(String(aiRes.codAmount).replace(/\D/g, ''), 10) || 0;
      codVal = parsedCod;
    }
  }
  safe.codAmount = codVal;
  safe.collectFee = !!aiRes.collectFee;
  safe.extraPhones = Array.isArray(aiRes.extraPhones) ? aiRes.extraPhones : [];

  const addr = aiRes.correctAddress || aiRes.address || '';
  safe.address = String(addr).trim() || 'không tìm thấy';
  safe.correctAddress = safe.address;

  return safe;
}

if (typeof globalThis !== 'undefined') {
  globalThis.processImageToOrder = processImageToOrder;
}
