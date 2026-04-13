import { Client } from 'minio';
import { env } from '../../config/env';

function resolveEndpoint(rawEndpoint: string, portOverride?: number) {
  const trimmed = rawEndpoint.trim();
  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  const withProtocol = hasProtocol ? trimmed : `${env.STORAGE_USE_SSL ? 'https' : 'http'}://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (!url.port && portOverride) {
      url.port = String(portOverride);
    }
    const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
    const isLocalMinio = isLocalHost && (url.port === '9000' || portOverride === 9000);
    if (isLocalMinio) {
      url.protocol = 'http:';
      if (!url.port) url.port = '9000';
    }
    return url;
  } catch {
    throw new Error('Invalid STORAGE_ENDPOINT. Include protocol, e.g. http://localhost:9000');
  }
}

const endpoint = resolveEndpoint(env.STORAGE_ENDPOINT, env.STORAGE_PORT);
const useSSL = endpoint.protocol === 'https:';
const port = endpoint.port ? Number(endpoint.port) : (useSSL ? 443 : 80);

const minioClient = new Client({
  endPoint: endpoint.hostname,
  port,
  useSSL,
  accessKey: env.STORAGE_ACCESS_KEY,
  secretKey: env.STORAGE_SECRET_KEY,
  region: env.STORAGE_REGION
});

function rewritePresignedUrl(presignedUrl: string) {
  const publicBase = env.STORAGE_PUBLIC_BASE_URL;
  if (!publicBase) return presignedUrl;
  try {
    const base = new URL(publicBase);
    const url = new URL(presignedUrl);
    url.protocol = base.protocol;
    url.hostname = base.hostname;
    url.port = base.port;
    return url.toString();
  } catch {
    return presignedUrl;
  }
}

export function getStorageKey(consultationId: string, suffix: string) {
  return `voice-notes/${consultationId}/${suffix}`;
}

export async function generateUploadUrl(key: string, contentType: string) {
  const presignedUrl = await minioClient.presignedPutObject(
    env.STORAGE_BUCKET,
    key,
    env.STORAGE_SIGNED_URL_TTL_SECONDS
  );
  return rewritePresignedUrl(presignedUrl);
}

export async function generateDownloadUrl(key: string) {
  const presignedUrl = await minioClient.presignedGetObject(
    env.STORAGE_BUCKET,
    key,
    env.STORAGE_SIGNED_URL_TTL_SECONDS
  );
  return rewritePresignedUrl(presignedUrl);
}
