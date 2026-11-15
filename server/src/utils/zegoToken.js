import { createCipheriv, randomInt } from 'node:crypto';

const IV_CHARACTERS = '0123456789abcdefghijklmnopqrstuvwxyz';

function createInitializationVector() {
    return Array.from(
        { length: 16 },
        () => IV_CHARACTERS[randomInt(IV_CHARACTERS.length)]
    ).join('');
}

export function generateZegoToken(appId, userId, serverSecret, lifetimeSeconds = 3600) {
    if (!Number.isSafeInteger(appId) || appId < 1) {
        throw new Error('ZEGO_APP_ID must be a positive safe integer');
    }
    if (typeof userId !== 'string' || !userId) {
        throw new Error('A valid ZEGO user ID is required');
    }
    if (typeof serverSecret !== 'string' || Buffer.byteLength(serverSecret) !== 32) {
        throw new Error('ZEGO_SERVER_SECRET must contain exactly 32 bytes');
    }

    const createdAt = Math.floor(Date.now() / 1000);
    const tokenInfo = {
        app_id: appId,
        user_id: userId,
        nonce: randomInt(-2147483648, 2147483648),
        ctime: createdAt,
        expire: createdAt + lifetimeSeconds,
        payload: ''
    };
    const iv = createInitializationVector();
    const cipher = createCipheriv('aes-256-cbc', Buffer.from(serverSecret), Buffer.from(iv));
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(tokenInfo), 'utf8'),
        cipher.final()
    ]);

    const expireBytes = Buffer.alloc(8);
    expireBytes.writeBigInt64BE(BigInt(tokenInfo.expire));
    const ivLength = Buffer.alloc(2);
    ivLength.writeUInt16BE(Buffer.byteLength(iv));
    const encryptedLength = Buffer.alloc(2);
    encryptedLength.writeUInt16BE(encrypted.length);

    return `04${Buffer.concat([
        expireBytes,
        ivLength,
        Buffer.from(iv),
        encryptedLength,
        encrypted
    ]).toString('base64')}`;
}
