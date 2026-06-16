export class Database {
  constructor() {
    throw new Error('bun:sqlite is unavailable in the browser; use IndexedDB storage')
  }
}
