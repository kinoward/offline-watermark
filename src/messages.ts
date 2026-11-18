import simplifiedChinese from './locales/zh-CN.ts';
import type { MessageKey, Messages } from './locales/zh-CN.ts';

export interface UiMessage {
  key: MessageKey;
  values?: Record<string, string | number>;
  detail?: string;
}

export function formatMessage(dictionary: Messages, message: UiMessage): string {
  const text = dictionary[message.key].replace(/\{(\w+)\}/g, (token, name: string) =>
    String(message.values?.[name] ?? token));
  return message.detail ? text + ' ' + message.detail : text;
}

// Errors keep a readable default message for non-UI callers. Workers transfer
// the descriptor so the receiving page can render it in its current language.
export function errorFromMessage(uiMessage: UiMessage, options?: ErrorOptions) {
  return Object.assign(new Error(formatMessage(simplifiedChinese, uiMessage), options), { uiMessage });
}

export function messageError(key: MessageKey, values?: UiMessage['values'], options?: ErrorOptions) {
  return errorFromMessage({ key, values }, options);
}

export function describeError(error: unknown, fallback: MessageKey = 'actionFailed'): UiMessage {
  if (error && typeof error === 'object') {
    if ('uiMessage' in error) return error.uiMessage as UiMessage;
    if ('key' in error && typeof error.key === 'string' && Object.hasOwn(simplifiedChinese, error.key)) {
      return error as UiMessage;
    }
  }
  const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
  return detail ? { key: fallback, detail } : { key: fallback };
}
