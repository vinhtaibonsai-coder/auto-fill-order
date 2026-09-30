// =========================================================================
// FIELD CONFIDENCE EVALUATOR & SAFE LEARNING GUARD (EPIC E)
// =========================================================================

const PHONE_REGEX = /^(?:0|\+84|84)(?:3|5|7|8|9|2)\d{8}$/;
const RAW_PHONE_CLEAN = /\D/g;

/**
 * Đánh giá độ tin cậy độc lập của từng trường dữ liệu bóc tách được từ ảnh
 * @param {Object} orderData Dữ liệu đơn bóc tách
 * @param {Object} ocrContext Ngữ cảnh nhận diện OCR/Vision
 * @returns {Object} { fieldConfidence, overallConfidence, needsFieldReview }
 */
export function evaluateFieldConfidence(orderData = {}, ocrContext = {}) {
  const ocrBaseConfidence = typeof ocrContext.ocrConfidence === 'number' 
    ? Math.min(1, Math.max(0, ocrContext.ocrConfidence))
    : 0.85;

  const fullText = String(ocrContext.fullText || '').toLowerCase();
  const fieldConfidence = {};

  // 1. Phone evaluation
  const cleanPhone = String(orderData.phone || '').replace(RAW_PHONE_CLEAN, '');
  let phoneScore = 0.50;
  let phoneSource = 'PARSER';

  if (PHONE_REGEX.test(cleanPhone)) {
    phoneScore = 0.98;
  } else if (cleanPhone.length >= 9 && cleanPhone.length <= 11) {
    phoneScore = 0.88;
  } else if (!cleanPhone) {
    phoneScore = 0.10;
  }
  fieldConfidence.phone = {
    value: orderData.phone || '',
    confidence: Number(phoneScore.toFixed(3)),
    source: phoneSource,
    needsReview: phoneScore < 0.85
  };

  // 2. Name evaluation
  const name = String(orderData.name || '').trim();
  let nameScore = ocrBaseConfidence * 0.9;
  if (name.length >= 3 && name.split(/\s+/).length >= 2) {
    nameScore = Math.min(0.96, Math.max(0.85, ocrBaseConfidence));
  } else if (name.length < 2) {
    nameScore = 0.40;
  }
  fieldConfidence.name = {
    value: name,
    confidence: Number(nameScore.toFixed(3)),
    source: ocrContext.source === 'gemini_vision' ? 'GEMINI_VISION' : 'OCR',
    needsReview: nameScore < 0.85
  };

  // 3. Address evaluation
  const address = String(orderData.address || '').trim();
  let addressScore = 0.60;
  let addressSource = 'PARSER';

  if (ocrContext.isNormalizedAddress || (orderData.ward && orderData.province)) {
    addressScore = 0.95;
    addressSource = 'ADDRESS_DB';
  } else if (address.length > 20 && (address.includes(',') || address.includes('-'))) {
    addressScore = Math.min(0.90, ocrBaseConfidence);
  } else if (address.length < 10) {
    addressScore = 0.50;
  }
  fieldConfidence.address = {
    value: address,
    confidence: Number(addressScore.toFixed(3)),
    source: addressSource,
    needsReview: addressScore < 0.85
  };

  // 4. Ward & Province
  fieldConfidence.ward = {
    value: orderData.ward || '',
    confidence: orderData.ward ? 0.92 : 0.60,
    source: orderData.ward ? 'ADDRESS_DB' : 'PARSER',
    needsReview: !orderData.ward
  };

  fieldConfidence.province = {
    value: orderData.province || '',
    confidence: orderData.province ? 0.95 : 0.60,
    source: orderData.province ? 'ADDRESS_DB' : 'PARSER',
    needsReview: !orderData.province
  };

  // 5. COD amount
  const cod = orderData.codAmount !== undefined && orderData.codAmount !== null 
    ? Number(orderData.codAmount) 
    : 0;
  let codScore = 0.90;
  if (!Number.isNaN(cod) && cod >= 0) {
    // If explicitly mentioned in raw text, boost confidence
    if (fullText.includes('cod') || fullText.includes('thu hộ') || cod === 0) {
      codScore = 0.96;
    }
  } else {
    codScore = 0.55;
  }
  fieldConfidence.cod = {
    value: cod,
    confidence: Number(codScore.toFixed(3)),
    source: 'PARSER',
    needsReview: codScore < 0.85
  };

  // 6. Product Item
  const product = String(orderData.productItem || '').trim();
  fieldConfidence.product = {
    value: product,
    confidence: product ? 0.90 : 0.75,
    source: 'OCR',
    needsReview: !product
  };

  // 7. Order Code
  const orderCode = String(orderData.orderCode || '').trim();
  fieldConfidence.order_code = {
    value: orderCode,
    confidence: orderCode ? 0.95 : 0.85,
    source: 'PARSER',
    needsReview: false
  };

  // Overall confidence
  const scores = Object.values(fieldConfidence).map(f => f.confidence);
  const overallConfidence = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
  const needsFieldReview = Object.values(fieldConfidence).some(f => f.needsReview);

  return {
    fieldConfidence,
    overallConfidence,
    needsFieldReview
  };
}

/**
 * Kiểm tra xem đơn hàng có đủ điều kiện submit hay bị khóa bởi các trường chưa xác nhận
 * @param {Object} fieldConfidence Bản đồ độ tin cậy từng trường
 * @param {Array<string>} confirmedFieldNames Danh sách các trường người dùng đã xác nhận riêng
 * @param {number} threshold Ngưỡng tin cậy (mặc định 0.85)
 * @returns {Object} { canSubmit, unconfirmedFields }
 */
export function canSubmitWithFieldReviews(fieldConfidence = {}, confirmedFieldNames = [], threshold = 0.85) {
  const unconfirmedFields = [];

  for (const [fieldName, fieldObj] of Object.entries(fieldConfidence)) {
    const conf = typeof fieldObj === 'number' ? fieldObj : fieldObj?.confidence;
    if (typeof conf === 'number' && conf < threshold) {
      if (!confirmedFieldNames.includes(fieldName)) {
        unconfirmedFields.push(fieldName);
      }
    }
  }

  return {
    canSubmit: unconfirmedFields.length === 0,
    unconfirmedFields
  };
}

/**
 * E03 Safe Learning Invariant:
 * Tuyệt đối không cho phép học SĐT, Tên khách hàng, hay Tiền COD thành Alias địa chỉ
 * @param {Object} candidate
 * @returns {Object} { allowed: boolean, reason?: string }
 */
export function validateKnowledgeCandidate(candidate = {}) {
  const alias = String(candidate.alias || '').trim();
  const type = String(candidate.type || '').toLowerCase();

  if (type === 'phone' || /^(?:0|\+84|84)\d{8,10}$/.test(alias.replace(/\s+/g, ''))) {
    return {
      allowed: false,
      reason: 'PHONE_CANNOT_BE_ADDRESS_ALIAS'
    };
  }

  if (type === 'cod' || /^(?:cod|thu\s*hộ|\d+k|\d{4,9})$/i.test(alias)) {
    return {
      allowed: false,
      reason: 'COD_CANNOT_BE_ADDRESS_ALIAS'
    };
  }

  if (type === 'name') {
    return {
      allowed: false,
      reason: 'NAME_CANNOT_BE_ADDRESS_ALIAS'
    };
  }

  return {
    allowed: true
  };
}
