import assert from 'node:assert/strict';
import test from 'node:test';

import { mapApprovalEvidenceRow } from './lot-approval-evidence.service.js';

test('approval evidence uses audit actor snapshot before live user data', () => {
  const evidence = mapApprovalEvidenceRow({
    action: 'approve',
    reason: 'อนุมัติ Lot',
    created_at: '2026-06-19T10:30:00.000Z',
    actor_name_snapshot: 'Snapshot Name',
    actor_position_snapshot: 'Snapshot Position',
    actor_name: 'Live Name',
    actor_position: 'Live Position'
  });

  assert.equal(evidence.actorName, 'Snapshot Name');
  assert.equal(evidence.actorPosition, 'Snapshot Position');
});
