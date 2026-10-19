/** Data requests can be retried without the browser retaining a failed module import. */
export async function loadJsonData<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load data (${response.status}).`)
  return response.json() as Promise<T>
}
