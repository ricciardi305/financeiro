import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { newId } from "@/db/id";
import { categories } from "@/db/schema";
import { UserError } from "@/domain/errors";

export type Category = typeof categories.$inferSelect;

/** Adds a user category. Names are unique per kind (ignoring case), so the chips never show two alike. */
export function createCategory(input: {
  name: string;
  kind: "income" | "expense";
  icon: string;
  color: string;
}): string {
  const name = input.name.trim();
  if (!name) throw new UserError("Informe o nome da categoria.");
  const clash = listCategories(input.kind).some((c) => c.name.toLowerCase() === name.toLowerCase());
  if (clash) throw new UserError(`Já existe a categoria "${name}".`);
  const id = newId();
  db.insert(categories).values({ id, name, kind: input.kind, icon: input.icon, color: input.color }).run();
  return id;
}

export function listCategories(kind?: "income" | "expense"): Category[] {
  const q = db.select().from(categories);
  return (kind ? q.where(eq(categories.kind, kind)) : q).orderBy(categories.name).all();
}
