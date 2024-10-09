type NestedObject = { [key: string]: any }

export function getNestedProperty<T>(obj: NestedObject, path: string): T {
  const result = path
    .split('.')
    .reduce<any>((acc: NestedObject | undefined, part: string) => {
      return acc && typeof acc === 'object' ? acc[part] : undefined
    }, obj)

  return result !== undefined ? result : null
}
