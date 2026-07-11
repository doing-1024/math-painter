export function cloneShape<T>(shape: T): T {
  return structuredClone(shape);
}
