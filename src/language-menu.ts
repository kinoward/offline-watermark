// Focus stays on the combobox. Navigation previews an option until it is committed.
export function bindLanguageMenu(initial: string, onChange: (value: string) => void) {
  const button = document.querySelector<HTMLButtonElement>('#language-select')!;
  const picker = button.parentElement!;
  const label = document.getElementById('language-value')!;
  const list = document.getElementById('language-list')!;
  const options = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
  let selected = options.findIndex(option => option.dataset.value === initial);
  let active = selected;
  let open = false;
  let prefix = '';
  let lastTyped = 0;

  function showSelection() {
    const choice = options[selected];
    button.value = choice.dataset.value!;
    label.textContent = choice.textContent!.trim();
    label.lang = choice.lang;
    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === selected)));
  }

  function highlight(index: number, scroll = true) {
    options[active].classList.remove('active');
    active = index;
    const option = options[active];
    option.classList.add('active');
    button.setAttribute('aria-activedescendant', option.id);
    if (scroll) {
      const top = option.offsetTop, bottom = top + option.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }
  }

  function setOpen(next: boolean) {
    if (open === next) return;
    open = next;
    picker.dataset.open = String(open);
    button.setAttribute('aria-expanded', String(open));
    list.inert = !open;
    list.setAttribute('aria-hidden', String(!open));
    prefix = '';
    if (open) highlight(selected);
    else button.removeAttribute('aria-activedescendant');
  }

  function choose(index: number) {
    setOpen(false);
    if (selected === index) return;
    selected = index;
    showSelection();
    onChange(button.value);
  }

  button.addEventListener('click', event => {
    button.focus({ preventScroll: true });
    // A native button sends one click for Enter or Space, including on touch laptops.
    if (open && event.detail === 0) choose(active);
    else setOpen(!open);
  });

  list.addEventListener('pointerdown', event => {
    // A mouse click keeps the trigger focused. Touch needs the native scrolling gesture.
    if (event.pointerType === 'mouse' && event.button === 0) event.preventDefault();
  });
  list.addEventListener('pointermove', event => {
    const option = (event.target as Element).closest<HTMLElement>('[role="option"]');
    if (open && event.pointerType === 'mouse' && option && option !== options[active]) {
      highlight(options.indexOf(option), false);
    }
  });
  list.addEventListener('click', event => {
    const option = (event.target as Element).closest<HTMLElement>('[role="option"]');
    if (open && option) {
      choose(options.indexOf(option));
      button.focus({ preventScroll: true });
    }
  });

  function dismissOutside(event: Event) {
    if (open && !picker.contains(event.target as Node)) setOpen(false);
  }
  document.addEventListener('pointerdown', dismissOutside, true);
  document.addEventListener('focusin', dismissOutside);
  window.addEventListener('blur', () => setOpen(false));

  const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  button.addEventListener('keydown', event => {
    const { key } = event;
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (key === 'Tab') {
      if (open) choose(active);
      return;
    }
    if (key === 'Escape') {
      if (open) { event.preventDefault(); setOpen(false); }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      if (event.repeat) event.preventDefault();
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
      event.preventDefault();
      const wasOpen = open;
      setOpen(true);
      prefix = '';
      if (key === 'Home') highlight(0);
      else if (key === 'End') highlight(options.length - 1);
      else if (wasOpen) highlight(Math.max(0, Math.min(options.length - 1, active + (key === 'ArrowDown' ? 1 : -1))));
      return;
    }
    if (key.length !== 1) return;
    event.preventDefault();
    const letter = fold(key);
    const now = performance.now();
    prefix = now - lastTyped > 650 || prefix === letter ? letter : prefix + letter;
    lastTyped = now;
    const start = open ? active : selected;
    for (let step = 1; step <= options.length; step++) {
      const index = (start + step) % options.length;
      if (fold(options[index].textContent!.trim()).startsWith(prefix)) {
        if (open) highlight(index);
        else choose(index);
        break;
      }
    }
  });
  showSelection();
}
