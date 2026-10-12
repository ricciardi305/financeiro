jest.mock("./client", () => ({ db: {} }));
import { DEFAULT_CATEGORIES } from "./seeds";

test("seed ids are unique and parents exist", () => {
  const ids = DEFAULT_CATEGORIES.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const c of DEFAULT_CATEGORIES) if (c.parentId) expect(ids).toContain(c.parentId);
});
