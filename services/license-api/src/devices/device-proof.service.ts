import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, randomBytes, verify } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { sha256, verifyDeviceSecret } from './device-auth';

const PURPOSE = 'ELVANOQ-ENTITLEMENT-PROOF-V1';
export function proofPayload(deviceId: string, nonce: string): Buffer {
  return Buffer.from(PURPOSE + '\n' + deviceId + '\n' + nonce, 'utf8');
}

@Injectable()
export class DeviceProofService {
  constructor(private readonly db: PrismaService) {}

  private async authorized(deviceId: string, header: string | undefined) {
    const device = await this.db.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');
    verifyDeviceSecret(header, device.deviceKeyHash);
    return device;
  }

  async registerKey(deviceId: string, authorization: string | undefined, publicKeyPem: string) {
    const device = await this.authorized(deviceId, authorization);
    if (device.proofPublicKey) throw new ConflictException('Key already registered; key replacement requires recovery flow');
    try {
      const key = createPublicKey(publicKeyPem);
      if (key.asymmetricKeyType !== 'ed25519' && !(key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1')) throw new Error('wrong key algorithm');
    } catch { throw new BadRequestException('Ed25519 or P-256 public key required'); }
    const algorithm = createPublicKey(publicKeyPem).asymmetricKeyType === 'ed25519' ? 'Ed25519' : 'ES256';
    const result = await this.db.device.updateMany({
      where: { id: deviceId, proofPublicKey: null },
      data: { proofPublicKey: publicKeyPem, proofAlgorithm: algorithm },
    });
    if (result.count !== 1) throw new ConflictException('Device key already registered');
    return { registered: true };
  }

  async challenge(deviceId: string, authorization: string | undefined) {
    const device = await this.authorized(deviceId, authorization);
    if (!device.proofPublicKey) throw new ConflictException('Proof key not registered');
    const nonce = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 60_000);
    await this.db.deviceProofChallenge.create({
      data: { deviceId, nonceHash: sha256(nonce), expiresAt },
    });
    return { nonce, expiresAt: expiresAt.toISOString() };
  }

  async consume(deviceId: string, authorization: string | undefined, nonce: string, signature: string): Promise<void> {
    const device = await this.authorized(deviceId, authorization);
    if (!device.proofPublicKey) throw new UnauthorizedException('Proof key not registered');
    if (!/^[A-Za-z0-9_-]{43}$/.test(nonce) || !/^[A-Za-z0-9_-]{86,128}$/.test(signature)) {
      throw new UnauthorizedException('Invalid proof');
    }
    let valid = false;
    try {
      const key = createPublicKey(device.proofPublicKey);
      const algorithm = device.proofAlgorithm || (key.asymmetricKeyType === 'ed25519' ? 'Ed25519' : '');
      if (algorithm === 'Ed25519' && key.asymmetricKeyType === 'ed25519') {
        valid = verify(null, proofPayload(deviceId, nonce), key, Buffer.from(signature, 'base64url'));
      } else if (algorithm === 'ES256' && key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1') {
        valid = verify('sha256', proofPayload(deviceId, nonce), key, Buffer.from(signature, 'base64url'));
      }
    } catch { /* fail closed */ }
    if (!valid) throw new UnauthorizedException('Invalid proof');
    const updated = await this.db.deviceProofChallenge.updateMany({
      where: { deviceId, nonceHash: sha256(nonce), consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (updated.count !== 1) throw new UnauthorizedException('Expired or already consumed challenge');
  }
}
