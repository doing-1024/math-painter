export class Selection {
  private ids = new Set<string>();

  has(id: string): boolean {
    return this.ids.has(id);
  }

  list(): string[] {
    return [...this.ids];
  }

  set(ids: string[]): void {
    this.ids = new Set(ids);
  }

  add(id: string): void {
    this.ids.add(id);
  }

  toggle(id: string): void {
    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);
  }

  clear(): void {
    this.ids.clear();
  }
}
