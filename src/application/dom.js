(() => {
  function setInputValue(el, val) {
    if (!el) return;
    try {
      el.focus();
      
      const lastValue = el.value;
      el.value = val;
      
      const tracker = el._valueTracker;
      if (tracker) {
        tracker.setValue(lastValue);
      }
      
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      
      const nativeSetter = Object.getOwnPropertyDescriptor(
        el.tagName === 'TEXTAREA' ? (globalThis.HTMLTextAreaElement ? globalThis.HTMLTextAreaElement.prototype : null) : (globalThis.HTMLInputElement ? globalThis.HTMLInputElement.prototype : null), 
        "value"
      )?.set;
      
      if (nativeSetter) {
        nativeSetter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Hỗ trợ Vue (Element UI) cập nhật v-model trực tiếp bằng cách tìm kiếm Vue component từ DOM lên
      let currentParent = el;
      let vueComponent = null;
      while (currentParent) {
        if (currentParent.__vue__) {
          const compName = currentParent.__vue__.$options?.name || '';
          if (compName.includes('Input') || compName.includes('Textarea') || compName.includes('Select') || compName.includes('Autocomplete')) {
            vueComponent = currentParent.__vue__;
            break;
          }
        }
        currentParent = currentParent.parentElement;
      }
      if (!vueComponent) {
        vueComponent = el.__vue__ || el.closest('.el-input, .el-textarea, .el-select, .el-input-number')?.__vue__;
      }

      if (vueComponent) {
        try {
          if ('currentValue' in vueComponent) {
            vueComponent.currentValue = val;
          }
          if ('value' in vueComponent) {
            vueComponent.value = val;
          }
          if (typeof vueComponent.$emit === 'function') {
            vueComponent.$emit('input', val);
            vueComponent.$emit('change', val);
          }
          if (typeof vueComponent.handleInput === 'function') {
            vueComponent.handleInput({ target: { value: val } });
          }
        } catch (vueErr) {
          console.warn("Vue state update error:", vueErr);
        }
      }
      
      el.blur();
    } catch (e) { console.error("Lỗi điền form: ", e); }
  }

  function findFieldInput(labelPatterns, fallbacks, isTextarea = false) {
    if (typeof document === 'undefined') return null;
    let foundEl = null;
    // 1. Tìm thông qua nhãn chứa từ khóa
    document.querySelectorAll('label, span').forEach(lbl => {
      const text = (lbl.innerText || '').trim();
      if (text && labelPatterns.some(p => p.test(text))) {
        const container = lbl.closest('.ant-form-item, .el-form-item') || lbl.parentElement?.parentElement;
        if (container) {
          foundEl = container.querySelector(isTextarea ? 'textarea' : 'input');
          if (!foundEl && isTextarea) foundEl = container.querySelector('input'); // fallback
          if (!foundEl && !isTextarea) foundEl = container.querySelector('textarea'); // fallback
        }
      }
    });
    if (foundEl) return foundEl;

    // 2. Tìm qua danh sách bộ chọn fallback
    for (const sel of fallbacks) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function simulateFullClick(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: typeof window !== 'undefined' ? window : null, button: 0, buttons: 1, detail: 1 };
    try {
      if (globalThis.PointerEvent) {
        el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, opts, { pointerId: 1, isPrimary: true, pointerType: 'mouse' })));
      }
    } catch (e) {}
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    try {
      if (globalThis.PointerEvent) {
        el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opts, { pointerId: 1, isPrimary: true, pointerType: 'mouse' })));
      }
    } catch (e) {}
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  function invokeReactHandler(dom, handlerNames) {
    if (!dom) return false;
    try {
      const propsKey = Object.keys(dom).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
      let props = propsKey ? dom[propsKey] : null;
      if (!props) {
        const fiberKey = Object.keys(dom).find(k => k.startsWith('__reactFiber$'));
        if (fiberKey) {
          const fiberNode = dom[fiberKey];
          props = fiberNode && (fiberNode.memoizedProps || fiberNode.pendingProps);
        }
      }
      if (!props) return false;
      const fakeEvent = {
        preventDefault: () => {}, stopPropagation: () => {}, persist: () => {},
        target: dom, currentTarget: dom, button: 0, buttons: 1,
        nativeEvent: new MouseEvent('click', { bubbles: true })
      };
      let called = false;
      handlerNames.forEach((name) => {
        if (typeof props[name] === 'function') {
          try { props[name](fakeEvent); called = true; }
          catch (e) { console.warn('Lỗi khi gọi handler React trực tiếp (' + name + '):', e); }
        }
      });
      return called;
    } catch (e) {
      console.warn('Không đọc được props React của phần tử:', e);
      return false;
    }
  }

  function waitFor(checkFn, timeout, interval) {
    timeout = timeout || 3000;
    interval = interval || 100;
    return new Promise(function(resolve) {
      const start = Date.now();
      (function tick() {
        let result;
        try { result = checkFn(); } catch (e) { result = null; }
        if (result) { resolve(result); return; }
        if (Date.now() - start >= timeout) { resolve(null); return; }
        setTimeout(tick, interval);
      })();
    });
  }

  globalThis.setInputValue = setInputValue;
  globalThis.findFieldInput = findFieldInput;
  globalThis.simulateFullClick = simulateFullClick;
  globalThis.invokeReactHandler = invokeReactHandler;
  globalThis.waitFor = waitFor;
})();
