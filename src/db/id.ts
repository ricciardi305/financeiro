// UUID v4 from Math.random: ids only need to be unique inside this single-user local DB, and it
// keeps schema.ts loadable by drizzle-kit (plain Node) without a native module.
export const newId = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
