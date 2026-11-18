import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { browserLanguage } from '../../src/i18n.ts';
import source from '../../src/locales/zh-CN.ts';
import { describeError, formatMessage, messageError } from '../../src/messages.ts';
import english from '../../src/locales/en.ts';

test('language selection respects script, region, preference order and English fallback', () => {
  for (const [tags, expected] of [
    [['zh-Hant-CN'], 'zh-TW'], [['zh-HK'], 'zh-TW'], [['zh-MO'], 'zh-TW'],
    [['zh-Hans-TW'], 'zh-CN'], [['zh-SG'], 'zh-CN'], [['en-GB', 'fr'], 'en'],
    [['de-DE', 'es-MX'], 'es'], [['bad_tag', 'fr-CA'], 'fr'], [['de'], 'en'], [[], 'en'],
  ]) assert.equal(browserLanguage(tags), expected);
});

test('all locale dictionaries preserve interpolation arguments and cover static UI bindings', async () => {
  const args = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const language of ['en', 'es', 'fr', 'ja', 'ko', 'ru', 'zh-TW']) {
    const { default: dictionary } = await import('../../src/locales/' + language + '.ts');
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(source).sort(), language);
    for (const key of Object.keys(source)) {
      assert.ok(dictionary[key].trim(), language + ' ' + key);
      assert.deepEqual(args(dictionary[key]), args(source[key]), language + ' ' + key);
    }
  }
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  for (const [, key] of html.matchAll(/\bdata-i18n(?:-[\w-]+)?="([^"]+)"/g)) {
    assert.ok(Object.hasOwn(source, key), 'Untranslated binding ' + key);
  }
});

test('worker errors can be translated after transfer without interpolating a filename twice', () => {
  const name = '{name}-$&.pdf';
  const descriptor = structuredClone(describeError(messageError('nameTaken', { name })));
  assert.deepEqual(describeError(descriptor), { key: 'nameTaken', values: { name } });
  assert.ok(formatMessage(english, descriptor).includes(name));
  assert.notEqual(formatMessage(source, descriptor), formatMessage(english, descriptor));
});
