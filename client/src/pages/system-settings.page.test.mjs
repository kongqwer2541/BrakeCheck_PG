import assert from 'node:assert/strict';
import test from 'node:test';

import { renderSystemSettingsPage } from './system-settings.page.js';

test('dimension and packing topic panels use the polished management layout', () => {
  const html = renderSystemSettingsPage({
    settings: {
      formTopics: {
        dimension: [],
        packing: []
      },
      draftCounts: {
        dimensionDraftCount: 0,
        packingDraftCount: 0
      }
    }
  });

  assert.equal((html.match(/settings-topic-toolbar/g) || []).length, 2);
  assert.equal((html.match(/settings-topic-table-wrap/g) || []).length, 2);
  assert.equal((html.match(/settings-topic-form-actions/g) || []).length, 2);
});
