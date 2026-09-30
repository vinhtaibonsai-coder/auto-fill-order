// =========================================================================
// GOOGLE VISION OCR CONFIDENCE & QUALITY EVALUATOR
// =========================================================================

/**
 * Đánh giá độ tin cậy và chất lượng văn bản trả về từ Google Cloud Vision OCR
 * để quyết định phân nhánh:
 * - GOOD: Độ nét cao, đầy đủ thông tin -> Chuyển sang Order Parser & AI Text Normalizer
 * - BAD: Độ nét thấp, chữ viết tay, mờ -> Kích hoạt Gemini Vision Multimodal
 */

export function evaluateOcrResult(visionResponse, options = {}) {
  const threshold = options.threshold !== undefined ? options.threshold : 0.80; // Ngưỡng mặc định 80%

  if (!visionResponse) {
    return {
      isGood: false,
      score: 0,
      confidence: 0,
      fullText: '',
      wordCount: 0,
      hasPhone: false,
      hasAddress: false,
      reasons: ['Không có dữ liệu phản hồi từ Google Vision OCR']
    };
  }

  // 1. Trích xuất toàn bộ văn bản (full text)
  let fullText = '';
  if (visionResponse.fullTextAnnotation && visionResponse.fullTextAnnotation.text) {
    fullText = visionResponse.fullTextAnnotation.text;
  } else if (Array.isArray(visionResponse.textAnnotations) && visionResponse.textAnnotations.length > 0) {
    fullText = visionResponse.textAnnotations[0].description || '';
  }

  fullText = String(fullText || '').trim();

  if (!fullText) {
    return {
      isGood: false,
      score: 0,
      confidence: 0,
      fullText: '',
      wordCount: 0,
      hasPhone: false,
      hasAddress: false,
      reasons: ['Google Vision OCR không phát hiện bất kỳ văn bản nào trong ảnh']
    };
  }

  // 2. Tính điểm độ tin cậy trung bình của các từ (Word Confidence)
  let totalConfidence = 0;
  let wordCount = 0;
  const wordConfidenceList = [];

  if (visionResponse.fullTextAnnotation && Array.isArray(visionResponse.fullTextAnnotation.pages)) {
    visionResponse.fullTextAnnotation.pages.forEach(page => {
      if (Array.isArray(page.blocks)) {
        page.blocks.forEach(block => {
          if (Array.isArray(block.paragraphs)) {
            block.paragraphs.forEach(para => {
              if (Array.isArray(para.words)) {
                para.words.forEach(word => {
                  wordCount++;
                  let conf = typeof word.confidence === 'number' ? word.confidence : null;
                  
                  // Nếu word.confidence không có, tính từ symbol.confidence
                  if (conf === null && Array.isArray(word.symbols) && word.symbols.length > 0) {
                    const sumSym = word.symbols.reduce((acc, s) => acc + (typeof s.confidence === 'number' ? s.confidence : 0.8), 0);
                    conf = sumSym / word.symbols.length;
                  }
                  
                  if (conf === null) conf = 0.85; // Mặc định nếu Vision không trả confidence chi tiết
                  totalConfidence += conf;
                  wordConfidenceList.push(conf);
                });
              }
            });
          }
        });
      }
    });
  }

  const avgConfidence = wordCount > 0 ? (totalConfidence / wordCount) : 0.85;
  const reasons = [];

  // 3. Phân tích thực thể trong văn bản (Entity Pattern Matching)
  // Check số điện thoại Việt Nam
  const phoneRegex = /(?:0|\+84|84)(?:[\s\.\-]?\d){9,10}\b/;
  const hasPhone = phoneRegex.test(fullText);

  // Check từ khóa địa chỉ hành chính Việt Nam
  const addressRegex = /(?<!\p{L})(?:tỉnh|thành\s*phố|tp\.?|quận|huyện|thị\s*xã|tx\.?|phường|xã|thị\s*trấn|tt\.?|đường|phố|ngõ|ngách|hẻm|số\s*nhà|ấp|thôn|xóm|bản|tổ|khu\s*phố|kp|chung\s*cư|tòa\s*nhà|kđt|vinhomes)(?!\p{L})/iu;
  const hasAddress = addressRegex.test(fullText);

  // Check độ dài và cấu trúc
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const isTooShort = fullText.length < 15;
  const isSingleLineGarbled = lines.length <= 1 && fullText.length < 25 && !hasPhone;

  // 4. Quyết định phân nhánh (GOOD vs BAD)
  let isGood = true;

  if (avgConfidence < threshold) {
    isGood = false;
    reasons.push(`Độ tin cậy OCR thấp (${Math.round(avgConfidence * 100)}% < ${Math.round(threshold * 100)}%)`);
  }

  if (isTooShort || isSingleLineGarbled) {
    isGood = false;
    reasons.push('Văn bản OCR quá ngắn hoặc bị phân mảnh');
  }

  if (!hasPhone && !hasAddress) {
    isGood = false;
    reasons.push('Không nhận diện được số điện thoại hoặc địa chỉ nhận hàng trong văn bản OCR');
  }

  // Bonus/Penalties: Kiểm tra tỷ lệ ký tự rác (ký tự không phải tiếng Việt hoặc số)
  const readableChars = (fullText.match(/[a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ\s,.\-:/()#]/gi) || []).length;
  const readabilityRatio = fullText.length > 0 ? (readableChars / fullText.length) : 0;
  
  if (readabilityRatio < 0.7) {
    isGood = false;
    reasons.push(`Văn bản chứa nhiều ký tự lỗi / rác (Độ sạch: ${Math.round(readabilityRatio * 100)}%)`);
  }

  if (isGood) {
    reasons.push(`Văn bản rõ nét (Độ tin cậy ${Math.round(avgConfidence * 100)}%), nhận diện tốt thực thể`);
  }

  const finalScore = Math.min(1, Math.max(0, avgConfidence * (hasPhone ? 1.05 : 0.9) * (hasAddress ? 1.05 : 0.9)));

  return {
    isGood,
    score: Number(finalScore.toFixed(3)),
    confidence: Math.round(avgConfidence * 100),
    fullText,
    wordCount,
    hasPhone,
    hasAddress,
    readabilityRatio: Number(readabilityRatio.toFixed(2)),
    reasons
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.evaluateOcrResult = evaluateOcrResult;
}
