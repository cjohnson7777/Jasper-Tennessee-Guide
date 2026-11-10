import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  CreateDishBody,
  CreateDishResponse,
  GetDishImageParams,
  ListDishesResponse,
} from "@workspace/api-zod";
import { db, dishPhotosTable } from "@workspace/db";

const router: IRouter = Router();
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type AllowedImageMime = "image/jpeg" | "image/png" | "image/webp";

type DecodedImage =
  | { ok: true; mimeType: AllowedImageMime; imageBase64: string }
  | { ok: false; status: 400 | 413; error: string };

// Check both the data URL label and the file signature before saving bytes.
function decodeImageDataUrl(dataUrl: string): DecodedImage {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/i.exec(
    dataUrl,
  );

  if (!match || !match[2]) {
    return {
      ok: false,
      status: 400,
      error: "Choose a JPEG, PNG, or WebP image.",
    };
  }

  const mimeType = match[1].toLowerCase() as AllowedImageMime;
  const imageBase64 = match[2];
  const padding = imageBase64.endsWith("==")
    ? 2
    : imageBase64.endsWith("=")
      ? 1
      : 0;
  const decodedSize = (imageBase64.length / 4) * 3 - padding;

  if (decodedSize > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "The image must be 3 MB or smaller.",
    };
  }

  const imageBytes = Buffer.from(imageBase64, "base64");
  if (!imageBytes.length || imageBytes.toString("base64") !== imageBase64) {
    return {
      ok: false,
      status: 400,
      error: "The image data is invalid. Choose a JPEG, PNG, or WebP photo.",
    };
  }

  let detectedMime: AllowedImageMime | null = null;
  if (imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff) {
    detectedMime = "image/jpeg";
  } else if (imageBytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    detectedMime = "image/png";
  } else if (
    imageBytes.toString("ascii", 0, 4) === "RIFF" &&
    imageBytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    detectedMime = "image/webp";
  }

  if (detectedMime !== mimeType) {
    return {
      ok: false,
      status: 400,
      error: "The photo must be a valid JPEG, PNG, or WebP image.",
    };
  }

  return { ok: true, mimeType, imageBase64 };
}

function imageUrl(id: number): string {
  return `/api/dishes/${id}/image`;
}

router.get("/dishes", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: dishPhotosTable.id,
      title: dishPhotosTable.title,
      caption: dishPhotosTable.caption,
      mimeType: dishPhotosTable.mimeType,
      inspectorNote: dishPhotosTable.inspectorNote,
      createdAt: dishPhotosTable.createdAt,
    })
    .from(dishPhotosTable)
    .orderBy(desc(dishPhotosTable.createdAt), desc(dishPhotosTable.id));

  const response = rows.map((row) => ({
    ...row,
    imageUrl: imageUrl(row.id),
  }));

  res.json(ListDishesResponse.parse(response));
});

router.post("/dishes", async (req, res): Promise<void> => {
  const parsed = CreateDishBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ issues: parsed.error.issues }, "Invalid dish photo request");
    res.status(400).json({
      error: "Add a title and choose a JPEG, PNG, or WebP photo.",
    });
    return;
  }

  const title = parsed.data.title.trim();
  if (!title) {
    res.status(400).json({ error: "Enter a title for the photo." });
    return;
  }

  const decodedImage = decodeImageDataUrl(parsed.data.image);
  if (!decodedImage.ok) {
    res.status(decodedImage.status).json({ error: decodedImage.error });
    return;
  }

  const [savedDish] = await db
    .insert(dishPhotosTable)
    .values({
      title,
      caption: parsed.data.caption?.trim() ?? "",
      mimeType: decodedImage.mimeType,
      imageBase64: decodedImage.imageBase64,
    })
    .returning({
      id: dishPhotosTable.id,
      title: dishPhotosTable.title,
      caption: dishPhotosTable.caption,
      mimeType: dishPhotosTable.mimeType,
      inspectorNote: dishPhotosTable.inspectorNote,
      createdAt: dishPhotosTable.createdAt,
    });

  const response = CreateDishResponse.parse({
    ...savedDish,
    imageUrl: imageUrl(savedDish.id),
  });

  res.status(201).json(response);
});

router.get("/dishes/:id/image", async (req, res): Promise<void> => {
  const params = GetDishImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "The photo ID must be a positive number." });
    return;
  }

  const [dish] = await db
    .select({
      mimeType: dishPhotosTable.mimeType,
      imageBase64: dishPhotosTable.imageBase64,
    })
    .from(dishPhotosTable)
    .where(eq(dishPhotosTable.id, params.data.id))
    .limit(1);

  if (!dish) {
    res.status(404).json({ error: "Dish photo not found." });
    return;
  }

  const imageBytes = Buffer.from(dish.imageBase64, "base64");
  res
    .status(200)
    .set("Content-Type", dish.mimeType)
    .set("Content-Length", String(imageBytes.length))
    .set("Cache-Control", "public, max-age=86400")
    .send(imageBytes);
});

export default router;
