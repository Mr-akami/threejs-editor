import Delaunator from 'delaunator'

export interface Point3D {
  x: number
  y: number
  z: number
}

export interface Triangle {
  indices: [number, number, number]
  deleted: boolean
}

export interface Edge {
  a: number
  b: number
  key: string
}

export function computeDelaunay(points: Point3D[]): Triangle[] {
  if (points.length < 3) return []

  // Delaunator uses x,y for triangulation (2D projection)
  const coords = points.flatMap(p => [p.x, p.y])
  const delaunay = new Delaunator(coords)
  const triangles: Triangle[] = []

  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    triangles.push({
      indices: [
        delaunay.triangles[i],
        delaunay.triangles[i + 1],
        delaunay.triangles[i + 2],
      ],
      deleted: false,
    })
  }

  return triangles
}

export function getEdgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

export function getTriangleEdges(tri: Triangle): Edge[] {
  const [i0, i1, i2] = tri.indices
  return [
    { a: i0, b: i1, key: getEdgeKey(i0, i1) },
    { a: i1, b: i2, key: getEdgeKey(i1, i2) },
    { a: i2, b: i0, key: getEdgeKey(i2, i0) },
  ]
}

export function trianglesUsingPoint(triangles: Triangle[], pointIndex: number): number[] {
  return triangles
    .map((t, i) => (t.indices.includes(pointIndex) && !t.deleted ? i : -1))
    .filter(i => i >= 0)
}

export function trianglesWithEdge(triangles: Triangle[], edgeKey: string): number[] {
  return triangles
    .map((t, i) => {
      if (t.deleted) return -1
      const edges = getTriangleEdges(t)
      return edges.some(e => e.key === edgeKey) ? i : -1
    })
    .filter(i => i >= 0)
}
