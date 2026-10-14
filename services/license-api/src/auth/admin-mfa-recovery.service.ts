import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

@Injectable()
export class AdminMfaRecoveryService {
  constructor(private readonly db: PrismaService, private readonly auth: AuthService) {}

  async request(header: string | undefined, targetUserId: string, evidenceReference: string) {
    const initiator = await this.auth.authenticateAdmin(header);
    if (initiator === targetUserId) throw new ForbiddenException('Self-approval is forbidden');
    if (!/^[A-Za-z0-9_-]{12,100}$/.test(evidenceReference)) throw new ConflictException('Invalid evidence reference');
    const target = await this.db.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
    if (target?.role !== 'ADMIN') throw new ForbiddenException('Target administrator required');
    const existing = await this.db.adminMfaRecoveryRequest.findFirst({ where: { targetUserId, status: 'PENDING', expiresAt: { gt: new Date() } } });
    if (existing) throw new ConflictException('A recovery request is already pending');
    return this.db.$transaction(async tx => {
      const recovery = await tx.adminMfaRecoveryRequest.create({
        data: { targetUserId, initiatedById: initiator, evidenceReference, expiresAt: new Date(Date.now() + 3600_000) },
        select: { id: true, status: true, expiresAt: true },
      });
      await tx.auditLog.create({ data: { actorId: initiator, action: 'admin.mfa.recovery_requested', subjectType: 'admin_mfa_recovery', subjectId: recovery.id, metadata: { targetUserId } } });
      return recovery;
    });
  }

  async approve(header: string | undefined, recoveryId: string) {
    const approver = await this.auth.authenticateAdmin(header);
    return this.db.$transaction(async tx => {
      const recovery = await tx.adminMfaRecoveryRequest.findUnique({ where: { id: recoveryId } });
      if (!recovery || recovery.status !== 'PENDING' || recovery.expiresAt <= new Date()) throw new ConflictException('Recovery request is not pending');
      if (approver === recovery.initiatedById || approver === recovery.targetUserId) throw new ForbiddenException('Independent approver required');
      const updated = await tx.adminMfaRecoveryRequest.updateMany({ where: { id: recoveryId, status: 'PENDING', approvedById: null }, data: { status: 'APPROVED', approvedById: approver, approvedAt: new Date() } });
      if (updated.count !== 1) throw new ConflictException('Recovery already processed');
      await tx.auditLog.create({ data: { actorId: approver, action: 'admin.mfa.recovery_approved', subjectType: 'admin_mfa_recovery', subjectId: recoveryId } });
      return { id: recoveryId, status: 'APPROVED', resetEnabled: false };
    });
  }
}
