import test from 'node:test';
import assert from 'node:assert/strict';

import { hasDimensionFailResult } from './dimension-inspection.service.js';
import { hasPackingFailResult } from './packing-inspection.service.js';
import {
  buildApprovalQueueLimitClause,
  getApprovalWorkflowTransition,
  isApprovalQueueStatus,
  requireNoDuplicateConfirmNg,
  validateApprovalQueueTab
} from './lot.service.js';

test('approval queue contains only waiting approval and NG work', () => {
  assert.equal(isApprovalQueueStatus('waiting_approve'), true);
  assert.equal(isApprovalQueueStatus('ng'), true);
  assert.equal(isApprovalQueueStatus('approved'), false);
  assert.equal(isApprovalQueueStatus('need_fix'), false);
});

test('approval queue tab defaults to waiting approval', () => {
  assert.equal(validateApprovalQueueTab('waiting_approve'), 'waiting_approve');
  assert.equal(validateApprovalQueueTab('ng'), 'ng');
  assert.equal(validateApprovalQueueTab(''), 'waiting_approve');
  assert.throws(() => validateApprovalQueueTab('approved'), /แท็บคิวตรวจและอนุมัติไม่ถูกต้อง/);
});

test('approval queue limit clause uses validated numbers for mysql compatibility', () => {
  assert.equal(buildApprovalQueueLimitClause(50, 0), 'LIMIT 50 OFFSET 0');
  assert.equal(buildApprovalQueueLimitClause(50, 100), 'LIMIT 50 OFFSET 100');
  assert.equal(buildApprovalQueueLimitClause('all', 0), '');
  assert.doesNotMatch(buildApprovalQueueLimitClause(50, 0), /\?/);
});

test('approval workflow uses shared inspection fail helpers', () => {
  assert.equal(hasDimensionFailResult({
    topics: [{ rows: [{ values: ['pass', 'fail'] }] }]
  }), true);
  assert.equal(hasPackingFailResult({
    topics: [{ value: 'fail' }]
  }), true);
});

test('approval workflow actions move only from allowed statuses', () => {
  assert.deepEqual(getApprovalWorkflowTransition('approve', 'waiting_approve'), {
    action: 'approve',
    nextStatus: 'approved',
    requiresReason: false,
    defaultReason: 'อนุมัติ Lot'
  });
  assert.deepEqual(getApprovalWorkflowTransition('cancel_approve', 'approved'), {
    action: 'cancel_approve',
    nextStatus: 'waiting_approve',
    requiresReason: true,
    defaultReason: ''
  });
  assert.deepEqual(getApprovalWorkflowTransition('send_back', 'waiting_approve'), {
    action: 'send_back',
    nextStatus: 'need_fix',
    requiresReason: true,
    defaultReason: ''
  });
  assert.deepEqual(getApprovalWorkflowTransition('review_ng', 'ng'), {
    action: 'review_ng',
    nextStatus: 'need_fix',
    requiresReason: true,
    defaultReason: ''
  });

  assert.throws(() => getApprovalWorkflowTransition('approve', 'ng'), /สถานะ NG/);
  assert.throws(() => getApprovalWorkflowTransition('send_back', 'approved'), /ต้องยกเลิกอนุมัติก่อน/);
});

test('confirm NG keeps NG status and records acknowledgement action', () => {
  assert.deepEqual(getApprovalWorkflowTransition('confirm_ng', 'ng'), {
    action: 'confirm_ng',
    nextStatus: 'ng',
    requiresReason: false,
    defaultReason: 'รับทราบ NG'
  });

  assert.throws(
    () => getApprovalWorkflowTransition('confirm_ng', 'waiting_approve'),
    /รออนุมัติ/
  );
});

test('confirm NG rejects duplicate acknowledgement audit', () => {
  assert.doesNotThrow(() => requireNoDuplicateConfirmNg('confirm_ng', 0));
  assert.doesNotThrow(() => requireNoDuplicateConfirmNg('approve', 1));
  assert.throws(
    () => requireNoDuplicateConfirmNg('confirm_ng', 1),
    /รับทราบ NG แล้ว/
  );
});
