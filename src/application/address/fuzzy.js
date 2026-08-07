(() => {
  const AddressFuzzy = {
    /**
     * Tính khoảng cách Levenshtein giữa 2 chuỗi
     */
    levenshtein(s1, s2) {
      if (!s1 || !s2) return 999;
      s1 = s1.toLowerCase().trim();
      s2 = s2.toLowerCase().trim();
      if (s1 === s2) return 0;
      
      const costs = [];
      for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
          if (i === 0) {
            costs[j] = j;
          } else if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i-1) !== s2.charAt(j-1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
        if (i > 0) {
          costs[s2.length] = lastValue;
        }
      }
      return costs[s2.length];
    },

    /**
     * Tìm ứng viên khớp tốt nhất dựa trên khoảng cách Levenshtein không dấu
     */
    findBestMatch(query, candidates, threshold = 0.7) {
      if (!query || !candidates || candidates.length === 0) return { match: null, score: 0 };
      
      let bestMatch = null;
      let bestScore = 0;
      
      // Tận dụng hàm removeVietnameseAccents từ core/config.js hoặc globalThis
      const removeAccentsFn = typeof removeVietnameseAccents === 'function' 
        ? removeVietnameseAccents 
        : (typeof globalThis.removeVietnameseAccents === 'function'
            ? globalThis.removeVietnameseAccents
            : (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'));

      const queryClean = removeAccentsFn(query.trim().toLowerCase());
      
      for (const cand of candidates) {
        const candClean = removeAccentsFn(cand.trim().toLowerCase());
        if (candClean === queryClean) {
          return { match: cand, score: 1.0 };
        }
        
        const maxLen = Math.max(queryClean.length, candClean.length);
        if (maxLen === 0) continue;
        
        const dist = this.levenshtein(queryClean, candClean);
        const score = (maxLen - dist) / maxLen;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = cand;
        }
      }
      
      if (bestScore >= threshold) {
        return { match: bestMatch, score: bestScore };
      }
      return { match: null, score: 0 };
    }
  };

  globalThis.AddressFuzzy = AddressFuzzy;
})();
