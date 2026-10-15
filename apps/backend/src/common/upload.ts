import { BadRequestException } from '@nestjs/common';

/** Largest image accepted by any upload endpoint. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Multer file filter: only raster images reach Cloudinary; everything else is rejected up front. */
export function imageOnlyFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new BadRequestException(`"${file.originalname}" is not an image`), false);
  }
  cb(null, true);
}
