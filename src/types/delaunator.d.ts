declare module 'delaunator' {
  export default class Delaunator {
    constructor(coords: ArrayLike<number>)
    triangles: Uint32Array
    halfedges: Int32Array
    hull: Uint32Array
    static from(
      points: ArrayLike<{ x: number; y: number }>,
      getX?: (p: { x: number; y: number }) => number,
      getY?: (p: { x: number; y: number }) => number
    ): Delaunator
  }
}
