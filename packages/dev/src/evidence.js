export const EVIDENCE_SCHEMA = 'dsh-evidence/1'

export function makeEvidence({ kind, subject, host, command, status, startedAt, finishedAt, artifacts = [], limitations = [] }) {
  return {
    schema: EVIDENCE_SCHEMA,
    kind,
    subject,
    host,
    command,
    status,
    startedAt,
    finishedAt,
    artifacts,
    limitations,
    notClaimed: ['certification', 'ranking', 'security audit', 'official endorsement'],
  }
}

export function hostEvidenceFromEvidence(evidence) {
  const status = evidence?.status === 'pass-with-warnings' ? 'pass' : evidence?.status
  return {
    status: ['pass', 'fail', 'blocked', 'not-run', 'not-applicable'].includes(status) ? status : 'blocked',
    command: evidence?.command ?? 'unknown',
    host: evidence?.host ?? 'unknown',
    evidence: evidence?.artifacts?.[0]?.command ?? evidence?.subject?.repo ?? 'evidence',
    generatedAt: (evidence?.finishedAt ?? new Date().toISOString()).slice(0, 10),
  }
}
