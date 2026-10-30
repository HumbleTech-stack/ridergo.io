'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

class ImageUploadError extends Error {}

function saveImage(data) {
  const match = String(data || '').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length % 4 !== 0) {
    throw new ImageUploadError('Upload a PNG, JPG or WebP image');
  }

  const [, mime, encoded] = match;
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length > 3 * 1024 * 1024) {
    throw new ImageUploadError('Image is too large (max 3 MB)');
  }
  if (buffer
    .toString('base64') !== encoded) {
    throw new ImageUploadError('The image file is invalid');
  }

  const valid = mime === 'image/png'
    ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === 'image/jpeg'
      ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
      : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw new ImageUploadError('The image file is invalid');

  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mime];
  const filename = `${crypto.randomBytes(12).toString('hex')}.${extension}`;
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const filepath = path.join(config.uploadsDir, filename);
  fs.writeFileSync(filepath, buffer, { flag: 'wx' });
  return { url: `/uploads/${filename}`, filepath };
}

function removeImage(image) {
  if (image && fs.existsSync(image.filepath)) fs.unlinkSync(image.filepath);
}

module.exports = { ImageUploadError, saveImage, removeImage };
