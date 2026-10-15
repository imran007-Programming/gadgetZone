import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

export interface UploadedImage {
  url: string;
  publicId: string;
}

/**
 * Thin wrapper over the Cloudinary SDK. Credentials come from the environment;
 * if they are missing the app still boots, and only upload/delete calls fail
 * with a 503 so the rest of the API keeps working.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly configured: boolean;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    this.configured = Boolean(cloudName && apiKey && apiSecret);
    if (this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    } else {
      this.logger.warn('Cloudinary is not configured; image uploads are disabled');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /** Upload an in-memory file (multipart upload from the admin UI). */
  uploadBuffer(buffer: Buffer, folder: string): Promise<UploadedImage> {
    this.ensureConfigured();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (err, result?: UploadApiResponse) => {
          if (err || !result) {
            return reject(err ?? new Error('Cloudinary upload returned no result'));
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  /** Let Cloudinary fetch a remote image URL itself (used by bulk import). */
  async uploadRemote(url: string, folder: string): Promise<UploadedImage> {
    this.ensureConfigured();
    const result = await cloudinary.uploader.upload(url, {
      folder,
      resource_type: 'image',
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  async destroy(publicId: string): Promise<void> {
    this.ensureConfigured();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }

  private ensureConfigured() {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Image upload is not configured (CLOUDINARY_* variables missing)',
      );
    }
  }
}
