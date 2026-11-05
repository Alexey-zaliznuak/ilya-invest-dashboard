import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTgSyncSettingsInput } from './validation.js';

const settings = { enabled: true, cron: '0 * * * *', chatId: '-100123', rescanAll: true };

test('accepts two topics and preserves legacy single-topic input', () => {
  const parsed = parseTgSyncSettingsInput({ ...settings, topicId: 5, secondTopicId: '12' });
  assert.equal(parsed.topicId, 5);
  assert.equal(parsed.secondTopicId, 12);
  assert.equal(parseTgSyncSettingsInput({ ...settings, topicId: 5 }).secondTopicId, null);
  assert.equal(parseTgSyncSettingsInput({ ...settings, secondTopicId: '' }).secondTopicId, null);
  assert.equal(parseTgSyncSettingsInput({ ...settings, secondTopicId: 12 }).topicId, null);
});

test('rejects invalid IDs for either topic before database writes', () => {
  for (const field of ['topicId', 'secondTopicId']) {
    for (const value of [0, -1, 1.5, 'bad', true, [], 2147483648]) {
      assert.throws(() => parseTgSyncSettingsInput({ ...settings, [field]: value }), new RegExp(field));
    }
  }
});
