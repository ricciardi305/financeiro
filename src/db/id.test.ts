import { newId } from "./id";

test("newId returns distinct v4-shaped uuids", () => {
  const ids = Array.from({ length: 1000 }, newId);
  expect(new Set(ids).size).toBe(1000);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
