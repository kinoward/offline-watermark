import zhCN from './locales/zh-CN.ts';
import zhTW from './locales/zh-TW.ts';
import en from './locales/en.ts';
import ja from './locales/ja.ts';
import ko from './locales/ko.ts';
import es from './locales/es.ts';
import fr from './locales/fr.ts';
import ru from './locales/ru.ts';
import type { MessageKey } from './locales/zh-CN.ts';
import { formatMessage as translateMessage } from './messages.ts';
import type { UiMessage } from './messages.ts';
export { describeError } from './messages.ts';

const dictionaries = { 'zh-CN': zhCN, 'zh-TW': zhTW, en, ja, ko, es, fr, ru };
type Language = keyof typeof dictionaries;
let language: Language = 'en';

function supported(value: string): value is Language {
  return Object.hasOwn(dictionaries, value);
}

export function browserLanguage(preferences: readonly string[]): Language {
  for (const tag of preferences) {
    try {
      const locale = new Intl.Locale(tag);
      if (locale.language === 'zh') return locale.maximize().script === 'Hant' ? 'zh-TW' : 'zh-CN';
      if (supported(locale.language)) return locale.language;
    } catch {
      // Continue with the next browser preference if this tag is malformed.
    }
  }
  return 'en';
}

export function t(key: MessageKey, values?: UiMessage['values']): string {
  return translateMessage(dictionaries[language], { key, values });
}

export function formatMessage(message: UiMessage): string {
  return translateMessage(dictionaries[language], message);
}

export function applyLanguage(value: string) {
  if (!supported(value)) return;
  language = value;
  document.documentElement.lang = language;
  const bindings = [
    ['data-i18n', ''], ['data-i18n-title', 'title'], ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-placeholder', 'placeholder'], ['data-i18n-content', 'content'],
  ] as const;
  for (const [binding, attribute] of bindings) {
    for (const element of document.querySelectorAll('[' + binding + ']')) {
      const key = element.getAttribute(binding) as MessageKey;
      if (attribute) element.setAttribute(attribute, t(key));
      else element.textContent = t(key);
    }
  }
}
