const SCROLL_ANIMATION_TRIGGER_CLASSNAME = 'scroll-trigger';
const SCROLL_ANIMATION_OFFSCREEN_CLASSNAME = 'scroll-trigger--offscreen';
const SCROLL_ZOOM_IN_TRIGGER_CLASSNAME = 'animate--zoom-in';
const SCROLL_ANIMATION_CANCEL_CLASSNAME = 'scroll-trigger--cancel';

// Scroll in animation logic
function onIntersection(elements, observer) {
  elements.forEach((element, index) => {
    if (element.isIntersecting) {
      const elementTarget = element.target;
      if (elementTarget.classList.contains(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME)) {
        elementTarget.classList.remove(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME);
        // Preserve existing inline styles by setting only the CSS variable,
        // instead of replacing the whole style attribute (which could wipe
        // padding-bottom for media or any inline animation-delay we apply).
        if (elementTarget.hasAttribute('data-cascade')) {
          try {
            elementTarget.style.setProperty('--animation-order', String(index));
          } catch (e) {
            // As a defensive fallback, append to the style attribute without overriding existing rules
            const prev = elementTarget.getAttribute('style') || '';
            elementTarget.setAttribute('style', `${prev}; --animation-order: ${index};`);
          }
        }
      }
      observer.unobserve(elementTarget);
    } else {
      element.target.classList.add(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME);
      element.target.classList.remove(SCROLL_ANIMATION_CANCEL_CLASSNAME);
    }
  });
}

function initializeScrollAnimationTrigger(rootEl = document, isDesignModeEvent = false) {
  const animationTriggerElements = Array.from(rootEl.getElementsByClassName(SCROLL_ANIMATION_TRIGGER_CLASSNAME));
  if (animationTriggerElements.length === 0) return;

  const isInViewport = (el) => {
    const r = el.getBoundingClientRect();
    return (
      r.bottom > 0 &&
      r.right > 0 &&
      r.left < (window.innerWidth || document.documentElement.clientWidth) &&
      r.top < (window.innerHeight || document.documentElement.clientHeight)
    );
  };

  const revealVisible = (elements) => {
    elements.forEach((el) => {
      if (el.classList && el.classList.contains(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME) && isInViewport(el)) {
        el.classList.remove(SCROLL_ANIMATION_OFFSCREEN_CLASSNAME);
      }
    });
  };

  if (isDesignModeEvent) {
    const allowed = [];
    animationTriggerElements.forEach((element) => {
      const allowInEditor = element.closest('[data-allow-animations-in-editor="true"]');
      if (!allowInEditor) {
        element.classList.add('scroll-trigger--design-mode');
      } else {
        element.classList.remove('scroll-trigger--design-mode');
        allowed.push(element);
      }
    });
    if (allowed.length === 0) return;
    const observer = new IntersectionObserver(onIntersection, {
      rootMargin: '0px 0px -50px 0px',
    });
    allowed.forEach((element) => observer.observe(element));

    // Fallback: if observer doesn't fire quickly in editor, reveal in-viewport items
    setTimeout(() => {
      revealVisible(allowed);
    }, 800);

    // Re-check on resize in the editor (e.g., switching to mobile viewport)
    const onResize = throttle(() => revealVisible(allowed), 150);
    window.addEventListener('resize', onResize, { passive: true });
    return;
  }

  const observer = new IntersectionObserver(onIntersection, {
    rootMargin: '0px 0px -50px 0px',
  });
  animationTriggerElements.forEach((element) => observer.observe(element));

  // Fallback for cases where the observer doesn't fire due to nested scroll/iframes
  setTimeout(() => {
    revealVisible(animationTriggerElements);
  }, 800);

  // Also retry reveal on window resize for live previews
  const onResize = throttle(() => revealVisible(animationTriggerElements), 150);
  window.addEventListener('resize', onResize, { passive: true });
}

// Zoom in animation logic
function initializeScrollZoomAnimationTrigger() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const animationTriggerElements = Array.from(document.getElementsByClassName(SCROLL_ZOOM_IN_TRIGGER_CLASSNAME));

  if (animationTriggerElements.length === 0) return;

  const scaleAmount = 0.2 / 100;

  animationTriggerElements.forEach((element) => {
    let elementIsVisible = false;
    const observer = new IntersectionObserver((elements) => {
      elements.forEach((entry) => {
        elementIsVisible = entry.isIntersecting;
      });
    });
    observer.observe(element);

    element.style.setProperty('--zoom-in-ratio', 1 + scaleAmount * percentageSeen(element));

    window.addEventListener(
      'scroll',
      throttle(() => {
        if (!elementIsVisible) return;

        element.style.setProperty('--zoom-in-ratio', 1 + scaleAmount * percentageSeen(element));
      }),
      { passive: true }
    );
  });
}

function percentageSeen(element) {
  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY;
  const elementPositionY = element.getBoundingClientRect().top + scrollY;
  const elementHeight = element.offsetHeight;

  if (elementPositionY > scrollY + viewportHeight) {
    // If we haven't reached the image yet
    return 0;
  } else if (elementPositionY + elementHeight < scrollY) {
    // If we've completely scrolled past the image
    return 100;
  }

  // When the image is in the viewport
  const distance = scrollY + viewportHeight - elementPositionY;
  let percentage = distance / ((viewportHeight + elementHeight) / 100);
  return Math.round(percentage);
}

window.addEventListener('DOMContentLoaded', () => {
  initializeScrollAnimationTrigger();
  initializeScrollZoomAnimationTrigger();
});

if (Shopify.designMode) {
  document.addEventListener('shopify:section:load', (event) => initializeScrollAnimationTrigger(event.target, true));
  document.addEventListener('shopify:section:reorder', () => initializeScrollAnimationTrigger(document, true));
  document.addEventListener('shopify:section:select', (event) => initializeScrollAnimationTrigger(event.target, true));
  document.addEventListener('shopify:section:deselect', (event) =>
    initializeScrollAnimationTrigger(event.target, true)
  );
  document.addEventListener('shopify:section:unload', () => initializeScrollAnimationTrigger(document, true));
}
