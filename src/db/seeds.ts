import { db } from "./client";
import { categories } from "./schema";

type Seed = typeof categories.$inferInsert;

const e = (id: string, name: string, icon: string, color: string, defaultNecessity?: Seed["defaultNecessity"]): Seed =>
  ({ id, name, kind: "expense", icon, color, defaultNecessity });
const i = (id: string, name: string, icon: string, color: string): Seed =>
  ({ id, name, kind: "income", icon, color });

export const DEFAULT_CATEGORIES: Seed[] = [
  e("moradia", "Moradia", "home", "#6366f1", "essential"),
  e("energia", "Energia", "zap", "#f59e0b", "essential"),
  e("internet", "Internet", "wifi", "#06b6d4", "essential"),
  e("educacao", "Educação", "book-open", "#8b5cf6", "essential"),
  e("mercado", "Mercado", "shopping-cart", "#22c55e", "essential"),
  e("transporte", "Transporte", "bus", "#3b82f6", "essential"),
  e("saude", "Saúde", "heart", "#ef4444", "essential"),
  e("lazer", "Lazer", "smile", "#ec4899", "optional"),
  e("assinaturas", "Assinaturas", "repeat", "#a855f7", "optional"),
  e("outros", "Outros", "more-horizontal", "#64748b"),
  i("salario", "Salário", "briefcase", "#16a34a"),
  i("bonus", "Bônus", "gift", "#84cc16"),
  i("rendimentos", "Rendimentos", "trending-up", "#14b8a6"),
  i("outras-receitas", "Outras receitas", "plus-circle", "#64748b"),
];

export function seedCategories(): void {
  db.insert(categories).values(DEFAULT_CATEGORIES).onConflictDoNothing().run();
}
