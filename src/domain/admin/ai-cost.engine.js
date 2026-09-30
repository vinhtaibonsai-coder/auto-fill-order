/**
 * AI Cost Calculation Engine
 * Chuẩn hóa tính giá vốn thực tế từ ai_model_cost_rates.
 * Bất biến: Không bao giờ trả về số 0 giả khi chưa có cấu hình rate; phải trả về N/A và null.
 */

export function calculateAiCost({ model, inputTokens = 0, outputTokens = 0, status = 'success', ratesMap = {} }) {
  if (!model) {
    return { cost: null, costDisplay: 'N/A', hasRate: false };
  }

  const rate = ratesMap[model] || ratesMap[String(model).trim()];
  if (!rate || rate.input_cost_per_million == null || rate.output_cost_per_million == null) {
    return { cost: null, costDisplay: 'N/A', hasRate: false };
  }

  const inTok = Number(inputTokens) || 0;
  const outTok = Number(outputTokens) || 0;
  if (status !== 'success' && inTok === 0 && outTok === 0) {
    return { cost: 0, costDisplay: '0 đ', hasRate: true, currency: rate.currency || 'VND' };
  }

  const inRate = Number(rate.input_cost_per_million) || 0;
  const outRate = Number(rate.output_cost_per_million) || 0;

  const rawCost = (inTok / 1_000_000 * inRate) + (outTok / 1_000_000 * outRate);
  const cost = Math.round(rawCost * 1000) / 1000;

  const costDisplay = cost < 1 && cost > 0
    ? `${cost} đ`
    : `${new Intl.NumberFormat('vi-VN').format(Math.round(cost))} đ`;

  return {
    cost,
    costDisplay,
    hasRate: true,
    currency: rate.currency || 'VND'
  };
}

export function calculateTotalAiCost(logs = [], ratesMap = {}) {
  let totalCost = 0;
  let ratedCount = 0;
  let unratedCount = 0;

  for (const log of logs) {
    const inTok = Number(log.input_tokens || log.prompt_tokens || 0);
    const outTok = Number(log.output_tokens || log.completion_tokens || 0);
    const res = calculateAiCost({
      model: log.model,
      inputTokens: inTok,
      outputTokens: outTok,
      status: log.status,
      ratesMap
    });

    if (res.hasRate) {
      ratedCount++;
      totalCost += res.cost || 0;
    } else {
      unratedCount++;
    }
  }

  totalCost = Math.round(totalCost * 1000) / 1000;

  return {
    totalCost,
    totalCostDisplay: `${new Intl.NumberFormat('vi-VN').format(Math.round(totalCost))} đ`,
    ratedCount,
    unratedCount,
    hasUnrated: unratedCount > 0,
    measuredAt: new Date().toISOString()
  };
}
