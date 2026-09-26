export class SelectionHistory {
  private entries: string[]
  private index: number
  private readonly limit: number

  constructor(initialId: string, limit = 20) {
    this.entries = [initialId]
    this.index = 0
    this.limit = limit
  }

  record(id: string): void {
    if (this.entries[this.index] === id) return
    this.entries.splice(this.index + 1)
    this.entries.push(id)
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit)
    this.index = this.entries.length - 1
  }

  canGoBack(available: (id: string) => boolean): boolean {
    return this.find(-1, available) !== -1
  }

  canGoForward(available: (id: string) => boolean): boolean {
    return this.find(1, available) !== -1
  }

  back(available: (id: string) => boolean): string | null {
    return this.move(-1, available)
  }

  forward(available: (id: string) => boolean): string | null {
    return this.move(1, available)
  }

  private find(direction: -1 | 1, available: (id: string) => boolean): number {
    for (let candidate = this.index + direction; candidate >= 0 && candidate < this.entries.length; candidate += direction) {
      if (available(this.entries[candidate]!)) return candidate
    }
    return -1
  }

  private move(direction: -1 | 1, available: (id: string) => boolean): string | null {
    const destination = this.find(direction, available)
    if (destination === -1) return null
    this.index = destination
    return this.entries[destination]!
  }
}
