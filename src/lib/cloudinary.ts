import { v2 as cloudinary } from "cloudinary";

function getCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary configuration is incomplete");
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export async function deleteRawBook(publicId: string) {
  return getCloudinary().uploader.destroy(publicId, {
    resource_type: "raw",
    type: "private",
  });
}

export async function deleteCoverImage(publicId: string) {
  return getCloudinary().uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}

export async function uploadCoverImage(
  buffer: Buffer,
  publicId: string,
  contentType: string,
) {
  return getCloudinary().uploader.upload(
    `data:${contentType};base64,${buffer.toString("base64")}`,
    {
      public_id: publicId,
      resource_type: "image",
      overwrite: true,
      type: "upload",
    },
  );
}

export function rawAssetUrl(publicId: string) {
  return getCloudinary().utils.private_download_url(publicId, "epub", {
    resource_type: "raw",
    type: "private",
    attachment: false,
  });
}

export function imageAssetUrl(publicId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) throw new Error("CLOUDINARY_CLOUD_NAME is required");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${encodeURIComponent(publicId)}`;
}
