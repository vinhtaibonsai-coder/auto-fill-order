/**
 * Feature Flag & Rollout Evaluation Engine
 * Pure functional deterministic evaluator for SaaS features.
 */

export class FeatureFlagEvaluator {
  /**
   * Deterministic string hashing to 0..99 bucket
   * Ensures the same shop or user always falls into the same percentage rollout bucket
   * @param {string} str 
   * @returns {number} 0..99
   */
  static hashToBucket(str) {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Check if a feature flag is enabled for a given execution context
   * @param {Object} flag - Feature flag record from DB
   * @param {Object} context - Execution context { shopId, planCode, userId }
   * @returns {boolean}
   */
  static isEnabled(flag, context = {}) {
    if (!flag || !flag.is_enabled) {
      return false;
    }

    const scopeType = flag.scope_type || 'global';
    const { shopId, planCode, userId } = context;

    switch (scopeType) {
      case 'user': {
        if (!flag.user_id || !userId) return false;
        return flag.user_id === userId;
      }

      case 'shop': {
        if (!flag.shop_id || !shopId) return false;
        return flag.shop_id === shopId;
      }

      case 'plan': {
        if (!planCode) return false;
        const targetPlan = (flag.plan_code || '').toUpperCase();
        const currentPlan = (planCode || '').toUpperCase();
        if (targetPlan && targetPlan === currentPlan) {
          return true;
        }
        if (Array.isArray(flag.target_plans) && flag.target_plans.length > 0) {
          return flag.target_plans.map(p => String(p).toUpperCase()).includes(currentPlan);
        }
        return false;
      }

      case 'global':
      default: {
        const rollout = Number.isInteger(flag.rollout_percentage) ? flag.rollout_percentage : 100;
        if (rollout >= 100) return true;
        if (rollout <= 0) return false;

        // Deterministic rollout based on shopId, userId, or fallback random-like bucket
        const bucketIdentifier = shopId || userId || 'anonymous';
        const bucket = this.hashToBucket(`${flag.key}:${bucketIdentifier}`);
        return bucket < rollout;
      }
    }
  }

  /**
   * Evaluate a collection of flags into a map of [key]: boolean
   * @param {Array} flags 
   * @param {Object} context 
   * @returns {Object} { [key]: boolean }
   */
  static evaluateAll(flags = [], context = {}) {
    const result = {};
    if (!Array.isArray(flags)) return result;

    for (const flag of flags) {
      if (flag && flag.key) {
        result[flag.key] = this.isEnabled(flag, context);
      }
    }
    return result;
  }
}
