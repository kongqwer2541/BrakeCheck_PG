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

export async function getLotApprovalEvidence(lotId, connection) {
  const [rows] = await connection.execute(
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
     WHERE a.lot_id = ?
       AND a.action IN ('approve', 'confirm_ng')
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
