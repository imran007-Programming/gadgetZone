import Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  // One origin or a comma-separated list (e.g. localhost plus the PC's LAN IP)
  FRONTEND_URL: Joi.string()
    .pattern(/^https?:\/\/[^\s,]+(\s*,\s*https?:\/\/[^\s,]+)*$/)
    .default('http://localhost:3001'),
  PORT: Joi.number().port().default(3000),
  // Optional: without these, image upload endpoints return 503 but the API still runs
  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').optional(),
  CLOUDINARY_API_KEY: Joi.string().allow('').optional(),
  CLOUDINARY_API_SECRET: Joi.string().allow('').optional(),
  // Unconfirmed (PENDING) orders older than this are cancelled and their stock restored;
  // orders with a bKash/Nagad Transaction ID are skipped. 0 turns it off.
  PENDING_ORDER_TTL_HOURS: Joi.number().min(0).default(48),
  // Number of proxies in front of the API (e.g. 1 on Railway/Render); unset when reached directly
  TRUST_PROXY: Joi.string().allow('').optional(),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
});
