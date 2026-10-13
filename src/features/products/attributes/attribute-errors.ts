export class AttributeReferenceError extends Error {
  constructor(public field: string, message: string) { super(message); }
}

export async function assertUniqueAttributeName(
  label: string, name: string | undefined, id: string | undefined,
  find: (name: string, excludeId?: string) => Promise<unknown>,
) {
  if (name !== undefined && await find(name.trim(), id)) throw new Error(`${label} name already exists`);
}
