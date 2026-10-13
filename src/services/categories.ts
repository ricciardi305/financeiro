import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories } from "@/db/schema";

export type Category = typeof categories.$inferSelect;

export function listCategories(kind?: "income" | "expense"): Category[] {
  const q = db.select().from(categories);
  return (kind ? q.where(eq(categories.kind, kind)) : q).orderBy(categories.name).all();
}
