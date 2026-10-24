/** Reads a string field from a native form submission. */
export function formField(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}
