/**
 * Unit Economics Engine (G012)
 *
 * Implements truthful unit economics:
 * 1. Gross margin and contribution margin factoring AI, infrastructure, support, and marketing costs.
 * 2. Documented CAC: Customer Acquisition Cost calculated exclusively from marketing costs with audit proofs.
 * 3. LTV with strict sample size guard: minimum sample size of 5 shops, returning 'N/A' (never fake zeros or wild estimates).
 * 4. Cohort retention matrix: M0, M1, M2, M3 retention and Net Revenue Retention (NDR/GRR).
 * 5. Triangle Reconciliation: verifies matching totals between payment transactions, ledger, and cost entries.
 */

export class UnitEconomicsEngine {
  static MIN_SAMPLE_SIZE = 5;

  static formatVND(value) {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  static formatPercent(value) {
    if (value == null) return 'N/A';
    return `${Number(value).toFixed(1)}%`;
  }

  /**
   * Calculates comprehensive Unit Economics for a given period.
   */
  static calculateUnitEconomics(params = {}) {
    const revenue = Number(params.revenue) || 0;
    const costs = Array.isArray(params.costs) ? params.costs : [];
    
    // Group costs by category
    let aiCost = Number(params.directAiCost) || 0;
    let infraCost = 0;
    let supportCost = 0;
    let marketingCost = 0;
    let otherCost = 0;
    let documentedAcquisitionCost = 0;

    for (const entry of costs) {
      const type = (entry.costType || entry.cost_type || '').toUpperCase();
      const amount = Number(entry.amount) || 0;

      if (type === 'AI') {
        if (!params.directAiCost) aiCost += amount;
      } else if (type === 'INFRASTRUCTURE') {
        infraCost += amount;
      } else if (type === 'SUPPORT') {
        supportCost += amount;
      } else if (type === 'MARKETING') {
        marketingCost += amount;
        // Documented Acquisition Guard: Must be marked acquisition AND have voucher/receipt
        const isAcq = Boolean(entry.isAcquisition ?? entry.is_acquisition);
        const hasVoucher = Boolean(entry.voucherUrl || entry.voucher_url || entry.externalRef || entry.external_ref);
        if (isAcq && hasVoucher) {
          documentedAcquisitionCost += amount;
        }
      } else {
        otherCost += amount;
      }
    }

    // 1. Margins
    const grossProfit = revenue - aiCost;
    const grossMarginPercent = revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(2)) : null;
    const indirectCostsTotal = infraCost + supportCost + marketingCost + otherCost;
    const netContribution = grossProfit - indirectCostsTotal;
    const netContributionPercent = revenue > 0 ? Number(((netContribution / revenue) * 100).toFixed(2)) : null;

    // 2. CAC with Documentation Invariant
    const newPayingShops = Number(params.newPayingShops) || 0;
    let cac = null;
    let cacStatus = 'NO_PROOF_OR_ZERO_ACQ';
    let cacDisplay = 'N/A (Chưa có chứng từ acquisition hoặc chưa có shop trả phí mới)';

    if (newPayingShops > 0 && documentedAcquisitionCost > 0) {
      cac = Math.round(documentedAcquisitionCost / newPayingShops);
      cacStatus = 'DOCUMENTED';
      cacDisplay = this.formatVND(cac);
    }

    // 3. LTV with Minimum Sample Size Guard (>= 5 shops)
    const totalPayingShops = Number(params.totalPayingShops) || 0;
    const sampleSizeMet = totalPayingShops >= this.MIN_SAMPLE_SIZE;
    const arpu = totalPayingShops > 0 ? Math.round(revenue / totalPayingShops) : null;
    const churnRatePercent = params.churnRatePercent != null ? Number(params.churnRatePercent) : null;
    const ltvFormula = '(ARPU × Gross Margin %) / Churn Rate';

    let ltv = null;
    let ltvDisplay = 'N/A';

    if (!sampleSizeMet) {
      ltvDisplay = `N/A (Cần tối thiểu ${this.MIN_SAMPLE_SIZE} shop trả phí, hiện có: ${totalPayingShops})`;
    } else if (churnRatePercent != null && churnRatePercent > 0 && arpu != null && grossMarginPercent != null) {
      ltv = Math.round(arpu * (grossMarginPercent / 100) / (churnRatePercent / 100));
      ltvDisplay = this.formatVND(ltv);
    } else {
      ltvDisplay = 'N/A (Tỷ lệ churn chưa đủ chu kỳ quan sát)';
    }

    return {
      revenue,
      directAiCost: aiCost,
      infraCost,
      supportCost,
      marketingCost,
      otherCost,
      documentedAcquisitionCost,
      grossProfit,
      grossMarginPercent,
      indirectCostsTotal,
      netContribution,
      netContributionPercent,
      newPayingShops,
      totalPayingShops,
      cac,
      cacStatus,
      cacDisplay,
      arpu,
      churnRatePercent,
      sampleSizeMet,
      ltv,
      ltvDisplay,
      ltvFormula
    };
  }

  /**
   * Calculates M0-M3 cohort retention percentages and Net Dollar Retention (NDR/GRR).
   */
  static calculateCohortRetention(cohorts = []) {
    return cohorts.map(cohort => {
      const size = Number(cohort.cohortSize ?? cohort.cohort_size) || 0;
      const m0Count = cohort.m0Count ?? cohort.m0_count;
      const m1Count = cohort.m1Count ?? cohort.m1_count;
      const m2Count = cohort.m2Count ?? cohort.m2_count;
      const m3Count = cohort.m3Count ?? cohort.m3_count;

      const m0Retention = size > 0 && m0Count != null ? Number(((m0Count / size) * 100).toFixed(1)) : 100.0;
      const m1Retention = size > 0 && m1Count != null ? Number(((m1Count / size) * 100).toFixed(1)) : null;
      const m2Retention = size > 0 && m2Count != null ? Number(((m2Count / size) * 100).toFixed(1)) : null;
      const m3Retention = size > 0 && m3Count != null ? Number(((m3Count / size) * 100).toFixed(1)) : null;

      const m0Revenue = Number(cohort.m0Revenue ?? cohort.m0_revenue) || 0;
      const m1Revenue = cohort.m1Revenue ?? cohort.m1_revenue;
      const m3Revenue = cohort.m3Revenue ?? cohort.m3_revenue;

      let ndr = null;
      if (m0Revenue > 0) {
        if (m3Revenue != null) {
          ndr = Number(((Number(m3Revenue) / m0Revenue) * 100).toFixed(1));
        } else if (m1Revenue != null) {
          ndr = Number(((Number(m1Revenue) / m0Revenue) * 100).toFixed(1));
        }
      }

      const grr = ndr != null ? Math.min(100.0, ndr) : null;

      return {
        cohortMonth: cohort.cohortMonth ?? cohort.cohort_month,
        cohortSize: size,
        m0Count,
        m1Count,
        m2Count,
        m3Count,
        m0Retention,
        m0Display: this.formatPercent(m0Retention),
        m1Retention,
        m1Display: this.formatPercent(m1Retention),
        m2Retention,
        m2Display: this.formatPercent(m2Retention),
        m3Retention,
        m3Display: this.formatPercent(m3Retention),
        ndr,
        ndrDisplay: this.formatPercent(ndr),
        grr,
        grrDisplay: this.formatPercent(grr)
      };
    });
  }

  /**
   * Reconciles Payment Transactions, Ledger, and Recorded Costs.
   */
  static reconcileLedgerAndPayments(params = {}) {
    const paymentRev = Number(params.paymentRevenueTotal) || 0;
    const ledgerRev = Number(params.ledgerRevenueTotal) || 0;
    const totalCosts = Number(params.totalCosts) || 0;
    const recordedCosts = Number(params.recordedCosts) || 0;

    const revDiscrepancy = Math.abs(paymentRev - ledgerRev);
    const costDiscrepancy = Math.abs(totalCosts - recordedCosts);
    const isReconciled = revDiscrepancy === 0 && costDiscrepancy === 0;

    return {
      isReconciled,
      discrepancy: revDiscrepancy + costDiscrepancy,
      status: isReconciled ? 'RECONCILED' : 'DISCREPANCY_DETECTED',
      details: {
        paymentRevenueTotal: paymentRev,
        ledgerRevenueTotal: ledgerRev,
        revDiscrepancy,
        totalCosts,
        recordedCosts,
        costDiscrepancy
      }
    };
  }
}
