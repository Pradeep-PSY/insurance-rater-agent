import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AppConfig } from "./config.js";

export interface PrivateObjectStore {
  put(key: string, bytes: Buffer, sha256: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  signedReadUrl(key: string): Promise<string>;
}

export function createPrivateObjectStore(config: AppConfig): PrivateObjectStore {
  const client = new S3Client({
    region: config.S3_REGION,
    ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
    forcePathStyle: config.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });
  return {
    async put(key, bytes, sha256) {
      await client.send(new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentLength: bytes.byteLength,
        ContentType: "application/pdf",
        Metadata: { sha256 },
        ServerSideEncryption: "AES256",
      }));
    },
    async get(key) {
      const result = await client.send(new GetObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
      }));
      if (!result.Body) throw new Error("OBJECT_BODY_MISSING");
      return Buffer.from(await result.Body.transformToByteArray());
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
      }));
    },
    async signedReadUrl(key) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
        { expiresIn: config.SIGNED_URL_TTL_SECONDS },
      );
    },
  };
}
