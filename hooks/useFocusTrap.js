import { useEffect } from 'react';

/**
 * useFocusTrap
 * Keeps keyboard focus trapped inside a container while `active` is true.
 * - containerRef: React ref of the container element
 * - active: boolean to enable/disable trap
 * - options: { initialFocus: boolean } defaults to true
 */
export default function useFocusTrap(containerRef, active, options = {}){
  const { initialFocus = true } = options || {};

  useEffect(()=>{
    if(!active) return;
    const container = containerRef?.current;
    if(!container) return;

    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const nodes = Array.from(container.querySelectorAll(selector)).filter(el => el.offsetParent !== null);

    if(nodes.length && initialFocus){
      try{ nodes[0].focus(); }catch(e){}
    }

    function onKey(e){
      if(e.key !== 'Tab') return;
      const idx = nodes.indexOf(document.activeElement);
      if(e.shiftKey){
        // shift + tab: move backward
        if(idx === 0 || document.activeElement === container){
          e.preventDefault();
          nodes[nodes.length - 1]?.focus();
        }
      } else {
        // tab: move forward
        if(idx === nodes.length - 1){
          e.preventDefault();
          nodes[0]?.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    return ()=> document.removeEventListener('keydown', onKey);
  },[containerRef, active, initialFocus]);
}
