/** An error whose message is Portuguese, user-facing and safe to show as-is. */
export class UserError extends Error {
  // Flag instead of `instanceof`: Error subclasses can lose their prototype under transpilation.
  readonly userFacing = true;
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && (e as { userFacing?: boolean }).userFacing) {
    return (e as Error).message;
  }
  console.warn(e);
  return "Algo deu errado. Tente novamente.";
}
