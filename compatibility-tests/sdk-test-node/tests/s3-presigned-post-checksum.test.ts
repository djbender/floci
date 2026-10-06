/**
 * S3 presigned POST checksum form fields, built with the AWS SDK's createPresignedPost.
 * A matching x-amz-checksum-* field is stored and returned by HeadObject; a mismatching body is
 * rejected with BadDigest and nothing is stored.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import {
  S3Client,
  CreateBucketCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  ChecksumMode,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { makeClient, uniqueName } from './setup';

const CONTENT_TYPE = 'text/plain';
const BODY = Buffer.from('presigned post checksum body');
const OTHER_BODY = Buffer.from('some other bytes');

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('base64');
}

function crc32(data: Buffer): string {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  const out = Buffer.alloc(4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return out.toString('base64');
}

describe('S3 presigned POST checksum fields', () => {
  let s3: S3Client;
  let bucketName: string;
  const keys: string[] = [];

  async function post(key: string, field: string, claimed: string, body: Buffer) {
    keys.push(key);
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: bucketName,
      Key: key,
      Conditions: [{ 'Content-Type': CONTENT_TYPE }, { [field]: claimed }],
      Fields: { 'Content-Type': CONTENT_TYPE, [field]: claimed },
      Expires: 600,
    });
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) {
      form.append(name, value);
    }
    form.append('file', new Blob([new Uint8Array(body)], { type: CONTENT_TYPE }), 'upload.txt');
    return fetch(url, { method: 'POST', body: form });
  }

  async function head(key: string) {
    return s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key, ChecksumMode: ChecksumMode.ENABLED }));
  }

  beforeAll(async () => {
    s3 = makeClient(S3Client, { forcePathStyle: true });
    bucketName = `presigned-post-checksum-${uniqueName()}`;
    await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
  });

  afterAll(async () => {
    for (const key of keys) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
      } catch {
        // ignore: rejected uploads never created the object
      }
    }
    await s3.send(new DeleteBucketCommand({ Bucket: bucketName }));
  });

  it('stores x-amz-checksum-sha256 on a matching body', async () => {
    const claimed = sha256(BODY);
    const resp = await post('sha256-match.txt', 'x-amz-checksum-sha256', claimed, BODY);
    expect(resp.status).toBe(204);

    const result = await head('sha256-match.txt');
    expect(result.ChecksumSHA256).toBe(claimed);
    expect(result.ChecksumType).toBe('FULL_OBJECT');
  });

  it('stores x-amz-checksum-crc32 on a matching body', async () => {
    const claimed = crc32(BODY);
    const resp = await post('crc32-match.txt', 'x-amz-checksum-crc32', claimed, BODY);
    expect(resp.status).toBe(204);

    const result = await head('crc32-match.txt');
    expect(result.ChecksumCRC32).toBe(claimed);
    expect(result.ChecksumType).toBe('FULL_OBJECT');
  });

  it('rejects a body that does not match x-amz-checksum-sha256 and stores nothing', async () => {
    const resp = await post('sha256-mismatch.txt', 'x-amz-checksum-sha256', sha256(BODY), OTHER_BODY);
    expect(resp.status).toBe(400);
    const text = await resp.text();
    expect(text).toContain('<Code>BadDigest</Code>');
    expect(text).toContain('The SHA256 you specified did not match the calculated checksum.');

    await expect(head('sha256-mismatch.txt')).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
  });

  it('rejects a body that does not match x-amz-checksum-crc32 and stores nothing', async () => {
    const resp = await post('crc32-mismatch.txt', 'x-amz-checksum-crc32', crc32(BODY), OTHER_BODY);
    expect(resp.status).toBe(400);
    const text = await resp.text();
    expect(text).toContain('<Code>BadDigest</Code>');
    expect(text).toContain('The CRC32 you specified did not match the calculated checksum.');

    await expect(head('crc32-mismatch.txt')).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
  });
});
