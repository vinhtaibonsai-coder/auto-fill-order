import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateFieldConfidence, canSubmitWithFieldReviews } from '../../src/application/ai/field-confidence.evaluator.js';

const root = process.cwd();

test('E01: Migration v128 - order_image_assets & field_extractions schema and RLS', () => {
  const migrationPath = path.join(root, 'database/migrations/v128_image_order_field_confidence.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration v128 must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Verify order_image_assets
  assert.ok(sql.includes('TABLE IF NOT EXISTS public.order_image_assets'), 'Must create order_image_assets');
  assert.ok(sql.includes('storage_path'), 'Must have storage_path');
  assert.ok(sql.includes('sha256'), 'Must have sha256 for dedup');
  assert.ok(sql.includes('retention_until'), 'Must have retention_until');

  // Verify field_extractions
  assert.ok(sql.includes('TABLE IF NOT EXISTS public.field_extractions'), 'Must create field_extractions');
  assert.ok(sql.includes('confidence NUMERIC'), 'Must store field confidence');
  assert.ok(sql.includes('review_status'), 'Must store review_status');

  // Authorization helper
  assert.ok(sql.includes('has_shop_permission'), 'Must enforce has_shop_permission for updates');
});

test('E02: Field Confidence Evaluator - Returns individual field confidence and sources', () => {
  const sampleOrder = {
    name: 'Nguyễn Văn An',
    phone: '0912345678',
    address: 'Số 15 Lê Duẩn, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh',
    ward: 'Phường Bến Nghé',
    province: 'TP Hồ Chí Minh',
    codAmount: 250000,
    productItem: 'Cây mai vàng Bonsai mini',
    orderCode: 'DH-IMG-001'
  };

  const ocrContext = {
    ocrConfidence: 0.88,
    fullText: 'Nguyễn Văn An 0912345678 Số 15 Lê Duẩn, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh Tiền COD 250k',
    isNormalizedAddress: true
  };

  const result = evaluateFieldConfidence(sampleOrder, ocrContext);
  assert.ok(result.fieldConfidence, 'Must contain fieldConfidence');
  assert.ok(typeof result.fieldConfidence.name.confidence === 'number');
  assert.ok(typeof result.fieldConfidence.phone.confidence === 'number');
  assert.ok(typeof result.fieldConfidence.address.confidence === 'number');
  assert.ok(typeof result.fieldConfidence.cod.confidence === 'number');

  // Phone should have high confidence because it matches exact standard format
  assert.ok(result.fieldConfidence.phone.confidence >= 0.90, 'Valid VN phone should have high confidence');
  assert.equal(result.fieldConfidence.phone.source, 'PARSER');
});

test('E02: Field Gate - Blocks submission if any low-confidence field is unconfirmed', () => {
  const fieldConfidence = {
    name: { confidence: 0.95, value: 'Nguyễn Văn An' },
    phone: { confidence: 0.98, value: '0912345678' },
    address: { confidence: 0.65, value: 'Ấp 3 Xã Gì Đó' }, // Low confidence < 0.85
    cod: { confidence: 0.70, value: 50000 },              // Low confidence < 0.85
    order_code: { confidence: 0.95, value: 'DH-001' }
  };

  // Case 1: No fields reviewed
  const review1 = canSubmitWithFieldReviews(fieldConfidence, [], 0.85);
  assert.equal(review1.canSubmit, false);
  assert.deepEqual(review1.unconfirmedFields, ['address', 'cod']);

  // Case 2: Only address confirmed, COD still unconfirmed
  const review2 = canSubmitWithFieldReviews(fieldConfidence, ['address'], 0.85);
  assert.equal(review2.canSubmit, false);
  assert.deepEqual(review2.unconfirmedFields, ['cod']);

  // Case 3: Both address and COD confirmed individually
  const review3 = canSubmitWithFieldReviews(fieldConfidence, ['address', 'cod'], 0.85);
  assert.equal(review3.canSubmit, true);
  assert.deepEqual(review3.unconfirmedFields, []);
});

test('E03: Safe Learning Invariant - Prevents learning phone/name/cod as address aliases', () => {
  import('../../src/application/ai/field-confidence.evaluator.js').then(({ validateKnowledgeCandidate }) => {
    // Attempting to learn a customer phone or cod as an address alias must be rejected
    const invalidPhoneCandidate = {
      alias: '0988776655',
      resolvedAddress: 'Hà Nội',
      type: 'phone'
    };
    const check1 = validateKnowledgeCandidate(invalidPhoneCandidate);
    assert.equal(check1.allowed, false, 'Must reject phone as address alias');

    const invalidCodCandidate = {
      alias: 'COD 500000',
      resolvedAddress: 'Hồ Chí Minh',
      type: 'cod'
    };
    const check2 = validateKnowledgeCandidate(invalidCodCandidate);
    assert.equal(check2.allowed, false, 'Must reject COD as address alias');

    const validCandidate = {
      alias: 'Chung cư Masteri An Phú',
      resolvedAddress: '179 Xa Lộ Hà Nội, Phường Thảo Điền, TP Thủ Đức, TP Hồ Chí Minh',
      type: 'address'
    };
    const check3 = validateKnowledgeCandidate(validCandidate);
    assert.equal(check3.allowed, true, 'Must accept genuine address landmark alias');
  });
});
