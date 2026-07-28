export function mapApprovalEvidenceRow(row) {
  if (!row) {
    return null;
  }

  return {
    action: row.action,
    reason: row.reason || '',
    actorName: row.actor_name_snapshot || row.actor_name || '-',
    actorPosition: row.actor_position_snapshot || row.actor_position || '-',
    createdAt: row.created_at
  };
}

export function createCurrentNgConfirmationExistsSql({
  lotIdExpression = 'lots.id',
  confirmationAlias = 'confirmed_ng',
  actionExpression = "'confirm_ng'"
} = {}) {
  return `EXISTS (
    SELECT 1
    FROM lot_audit_logs ${confirmationAlias}
    WHERE ${confirmationAlias}.lot_id = ${lotIdExpression}
      AND ${confirmationAlias}.action = ${actionExpression}
      AND NOT EXISTS (
        SELECT 1
        FROM lot_audit_logs reviewed_ng
        WHERE reviewed_ng.lot_id = ${confirmationAlias}.lot_id
          AND reviewed_ng.action = 'review_ng'
          AND reviewed_ng.id > ${confirmationAlias}.id
      )
  )`;
}

export async function getLotApprovalEvidence(lotId, connection) {
  const { rows } = await connection.query(
    `SELECT
       a.action,
       a.reason,
       a.created_at,
       a.actor_name_snapshot,
       a.actor_position_snapshot,
       u.full_name AS actor_name,
       u.position AS actor_position
     FROM lot_audit_logs a
     LEFT JOIN users u ON u.id = a.changed_by
     WHERE a.lot_id = $1
       AND a.action IN ('approve', 'confirm_ng')
       AND (
         a.action = 'approve'
         OR NOT EXISTS (
           SELECT 1
           FROM lot_audit_logs reviewed_ng
           WHERE reviewed_ng.lot_id = a.lot_id
             AND reviewed_ng.action = 'review_ng'
             AND reviewed_ng.id > a.id
         )
       )
     ORDER BY a.created_at DESC, a.id DESC`,
    [lotId]
  );

  const evidence = {
    approved: null,
    ngConfirmed: null
  };

  rows.forEach((row) => {
    if (row.action === 'approve' && !evidence.approved) {
      evidence.approved = mapApprovalEvidenceRow(row);
    }

    if (row.action === 'confirm_ng' && !evidence.ngConfirmed) {
      evidence.ngConfirmed = mapApprovalEvidenceRow(row);
    }
  });

  return evidence;
}
