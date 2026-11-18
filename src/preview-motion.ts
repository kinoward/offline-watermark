import './preview-motion.css';

// Move the existing dialog between its thumbnail and centered position.
// The image and the current PDF page stay in the same canvas throughout.
export function createPreviewMotion(surface: HTMLDialogElement) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let thumbnail: DOMRect | undefined;
  let animation: Animation | undefined;
  let afterClose: (() => void) | undefined;

  function finish() {
    animation?.cancel();
    animation = undefined;
    delete surface.dataset.previewMotion;
    const complete = afterClose;
    afterClose = undefined;
    complete?.();
  }

  function interrupt() {
    thumbnail = undefined;
    finish();
  }

  window.addEventListener('resize', interrupt);
  reduced.addEventListener('change', interrupt);
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });

  return {
    rememberThumbnail(trigger: HTMLElement) { thumbnail = trigger.getBoundingClientRect(); },
    play(enter: boolean, complete?: () => void) {
      if (afterClose) { finish(); return; }
      const current = animation ? getComputedStyle(surface).transform : undefined;
      finish();
      afterClose = complete;
      if (!thumbnail || reduced.matches || !surface.animate || !surface.matches(':modal') || document.hidden) {
        finish();
        return;
      }

      const panel = surface.getBoundingClientRect();
      const scale = Math.min(1, thumbnail.width / panel.width, thumbnail.height / panel.height);
      const x = thumbnail.left + thumbnail.width / 2 - panel.left - panel.width / 2;
      const y = thumbnail.top + thumbnail.height / 2 - panel.top - panel.height / 2;
      const small = `translate(${x}px, ${y}px) scale(${scale})`;
      surface.dataset.previewMotion = enter ? 'enter' : 'exit';
      const moving = surface.animate([
        { transform: current ?? (enter ? small : 'none') },
        { transform: enter ? 'none' : small },
      ], {
        duration: enter ? 220 : 165,
        easing: enter ? 'cubic-bezier(.2,.75,.25,1)' : 'cubic-bezier(.4,0,.4,1)',
        fill: 'both',
      });
      animation = moving;
      moving.onfinish = () => { if (animation === moving) finish(); };
    },
    interrupt,
  };
}
