import { createInsertSchema } from "drizzle-zod";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

// One row per visitor-submitted dish photo.
export const dishPhotosTable = pgTable("dish_photos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  caption: text("caption").notNull().default(""),
  mimeType: text("mime_type").notNull(),
  imageBase64: text("image_base64").notNull(),
  inspectorNote: text("inspector_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDishPhotoSchema = createInsertSchema(dishPhotosTable).omit({
  id: true,
  createdAt: true,
});

export type DishPhoto = typeof dishPhotosTable.$inferSelect;
export type NewDishPhoto = z.infer<typeof insertDishPhotoSchema>;
