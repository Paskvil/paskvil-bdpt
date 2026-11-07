/** immutable linear RGB triple - radiance, reflectance, path throughput */
export class Color {
  constructor(
    readonly r: number,
    readonly g: number,
    readonly b: number,
  ) {}

  static readonly BLACK = new Color(0, 0, 0)
  static readonly WHITE = new Color(1, 1, 1)

  static gray(value: number): Color {
    return new Color(value, value, value)
  }

  add(other: Color): Color {
    return new Color(this.r + other.r, this.g + other.g, this.b + other.b)
  }

  /** component-wise product - e.g. reflectance × incoming light */
  mul(other: Color): Color {
    return new Color(this.r * other.r, this.g * other.g, this.b * other.b)
  }

  scale(factor: number): Color {
    return new Color(this.r * factor, this.g * factor, this.b * factor)
  }

  /** perceived brightness (Rec. 709 weights) */
  luminance(): number {
    return 0.2126 * this.r + 0.7152 * this.g + 0.0722 * this.b
  }

  maxComponent(): number {
    return Math.max(this.r, this.g, this.b)
  }

  isBlack(): boolean {
    return this.r === 0 && this.g === 0 && this.b === 0
  }
}
