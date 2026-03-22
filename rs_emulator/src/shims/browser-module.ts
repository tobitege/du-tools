export function createRequire(): (id: string) => never {
  return (id: string) => {
    throw new Error(`Node module loading is not available in the browser: ${id}`);
  };
}
