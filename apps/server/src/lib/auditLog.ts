export enum AuditEvent {
  // Authentication events
  LOGIN_SUCCESS = "auth.login.success",
  LOGIN_FAILED = "auth.login.failed",
  LOGOUT = "auth.logout",

  // Passkey events
  PASSKEY_REGISTERED = "passkey.registered",
  PASSKEY_UPDATED = "passkey.updated",
  PASSKEY_AUTH_SUCCESS = "passkey.auth.success",
  PASSKEY_AUTH_FAILED = "passkey.auth.failed",
  PASSKEY_DELETED = "passkey.deleted",

  // Recovery events
  RECOVERY_REQUESTED = "recovery.requested",
  RECOVERY_SUCCESS = "recovery.success",
  RECOVERY_FAILED = "recovery.failed",

  // Security events
  RATE_LIMIT_EXCEEDED = "security.rate_limit",
  INVALID_CHALLENGE = "security.invalid_challenge",
  REPLAY_ATTACK_DETECTED = "security.replay_attack",
}

interface AuditLogEntry {
  event: AuditEvent;
  userId?: number;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export function auditLog(entry: AuditLogEntry): void {
  // In production, this should write to a dedicated audit log table or service
  // For now, we use structured logging
  const logData = {
    audit: true,
    event: entry.event,
    userId: entry.userId,
    ip: entry.ip,
    userAgent: entry.userAgent,
    ...entry.metadata,
    timestamp: new Date().toISOString(),
  };

  // Use console for audit logs (will be picked up by log aggregation)
  console.log(JSON.stringify(logData));
}
