import * as THREE from 'three'
import {
  Point3D,
  Triangle,
  computeDelaunay,
  getTriangleEdges,
  trianglesWithEdge,
} from '../utils/geometry'

export type EditMode = 'none' | 'edge' | 'point'

export class TinMesh {
  points: Point3D[] = []
  triangles: Triangle[] = []
  deletedPoints: Set<number> = new Set()

  meshGroup: THREE.Group
  surfaceMesh: THREE.Mesh | null = null
  wireframeMesh: THREE.LineSegments | null = null
  pointsMesh: THREE.Points | null = null

  private highlightedEdge: THREE.Line | null = null
  private highlightedPoint: THREE.Mesh | null = null

  onChange: (() => void) | null = null

  constructor() {
    this.meshGroup = new THREE.Group()
  }

  setPoints(points: Point3D[]) {
    this.points = [...points]
    this.deletedPoints.clear()
    this.regenerate()
  }

  regenerate() {
    // Filter out deleted points and remap indices
    const activePoints = this.points.filter((_, i) => !this.deletedPoints.has(i))
    this.triangles = computeDelaunay(activePoints)
    this.updateMesh()
    this.onChange?.()
  }

  private getActivePoints(): Point3D[] {
    return this.points.filter((_, i) => !this.deletedPoints.has(i))
  }

  updateMesh() {
    // Dispose old geometries/materials to prevent memory leaks
    if (this.surfaceMesh) {
      this.surfaceMesh.geometry.dispose()
      ;(this.surfaceMesh.material as THREE.Material).dispose()
    }
    if (this.wireframeMesh) {
      this.wireframeMesh.geometry.dispose()
      ;(this.wireframeMesh.material as THREE.Material).dispose()
    }
    if (this.pointsMesh) {
      this.pointsMesh.geometry.dispose()
      ;(this.pointsMesh.material as THREE.Material).dispose()
    }

    this.meshGroup.clear()
    this.surfaceMesh = null
    this.wireframeMesh = null
    this.pointsMesh = null

    const activePoints = this.getActivePoints()
    if (activePoints.length < 3) {
      this.createPointsOnly(activePoints)
      return
    }

    const activeTriangles = this.triangles.filter(t => !t.deleted)
    if (activeTriangles.length === 0) {
      this.createPointsOnly(activePoints)
      return
    }

    // Build geometry
    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const indices: number[] = []

    activePoints.forEach(p => {
      vertices.push(p.x, p.z, -p.y) // Y-up coordinate system
    })

    activeTriangles.forEach(tri => {
      indices.push(...tri.indices)
    })

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    // Surface mesh
    const surfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a90d9,
      side: THREE.DoubleSide,
      flatShading: true,
    })
    this.surfaceMesh = new THREE.Mesh(geometry, surfaceMaterial)
    this.meshGroup.add(this.surfaceMesh)

    // Wireframe
    const wireGeo = new THREE.WireframeGeometry(geometry)
    const wireMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 })
    this.wireframeMesh = new THREE.LineSegments(wireGeo, wireMat)
    this.meshGroup.add(this.wireframeMesh)

    // Points
    this.createPointsOnly(activePoints)
  }

  private createPointsOnly(points: Point3D[]) {
    const pointsGeo = new THREE.BufferGeometry()
    const positions = points.flatMap(p => [p.x, p.z, -p.y])
    pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

    const pointsMat = new THREE.PointsMaterial({
      color: 0xff6b6b,
      size: 8,
      sizeAttenuation: false,
    })
    this.pointsMesh = new THREE.Points(pointsGeo, pointsMat)
    this.meshGroup.add(this.pointsMesh)
  }

  deleteEdge(edgeKey: string) {
    const triIndices = trianglesWithEdge(this.triangles, edgeKey)
    triIndices.forEach(i => {
      this.triangles[i].deleted = true
    })
    this.updateMesh()
    this.onChange?.()
  }

  deletePointByActiveIndex(activeIndex: number) {
    // Map active index back to original index
    const activePoints = this.getActivePoints()
    if (activeIndex < 0 || activeIndex >= activePoints.length) return

    let count = 0
    for (let i = 0; i < this.points.length; i++) {
      if (!this.deletedPoints.has(i)) {
        if (count === activeIndex) {
          this.deletedPoints.add(i)
          break
        }
        count++
      }
    }
    this.regenerate()
  }

  highlightEdge(edgeKey: string | null, scene: THREE.Scene) {
    if (this.highlightedEdge) {
      scene.remove(this.highlightedEdge)
      this.highlightedEdge.geometry.dispose()
      ;(this.highlightedEdge.material as THREE.Material).dispose()
      this.highlightedEdge = null
    }

    if (!edgeKey) return

    const [aStr, bStr] = edgeKey.split('-')
    const a = parseInt(aStr)
    const b = parseInt(bStr)

    const activePoints = this.getActivePoints()
    if (a >= activePoints.length || b >= activePoints.length) return

    const pa = activePoints[a]
    const pb = activePoints[b]

    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pa.x, pa.z, -pa.y),
      new THREE.Vector3(pb.x, pb.z, -pb.y),
    ])
    const mat = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 3 })
    this.highlightedEdge = new THREE.Line(geo, mat)
    scene.add(this.highlightedEdge)
  }

  highlightPoint(activeIndex: number | null, scene: THREE.Scene) {
    if (this.highlightedPoint) {
      scene.remove(this.highlightedPoint)
      this.highlightedPoint.geometry.dispose()
      ;(this.highlightedPoint.material as THREE.Material).dispose()
      this.highlightedPoint = null
    }

    if (activeIndex === null) return

    const activePoints = this.getActivePoints()
    if (activeIndex >= activePoints.length) return

    const p = activePoints[activeIndex]
    const geo = new THREE.SphereGeometry(0.3, 16, 16)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 })
    this.highlightedPoint = new THREE.Mesh(geo, mat)
    this.highlightedPoint.position.set(p.x, p.z, -p.y)
    scene.add(this.highlightedPoint)
  }

  findNearestEdge(point: THREE.Vector3): string | null {
    const activePoints = this.getActivePoints()
    const activeTriangles = this.triangles.filter(t => !t.deleted)

    let minDist = Infinity
    let nearestEdge: string | null = null

    const edgesSeen = new Set<string>()

    for (const tri of activeTriangles) {
      const edges = getTriangleEdges(tri)
      for (const edge of edges) {
        if (edgesSeen.has(edge.key)) continue
        edgesSeen.add(edge.key)

        const pa = activePoints[edge.a]
        const pb = activePoints[edge.b]
        const va = new THREE.Vector3(pa.x, pa.z, -pa.y)
        const vb = new THREE.Vector3(pb.x, pb.z, -pb.y)

        const dist = this.distanceToLineSegment(point, va, vb)
        if (dist < minDist) {
          minDist = dist
          nearestEdge = edge.key
        }
      }
    }

    return minDist < 2 ? nearestEdge : null
  }

  findNearestPoint(point: THREE.Vector3): number | null {
    const activePoints = this.getActivePoints()
    let minDist = Infinity
    let nearestIndex: number | null = null

    for (let i = 0; i < activePoints.length; i++) {
      const p = activePoints[i]
      const v = new THREE.Vector3(p.x, p.z, -p.y)
      const dist = point.distanceTo(v)
      if (dist < minDist) {
        minDist = dist
        nearestIndex = i
      }
    }

    return minDist < 1.5 ? nearestIndex : null
  }

  private distanceToLineSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    const ab = new THREE.Vector3().subVectors(b, a)
    const abDotAb = ab.dot(ab)
    if (abDotAb === 0) return p.distanceTo(a)
    const ap = new THREE.Vector3().subVectors(p, a)
    const t = Math.max(0, Math.min(1, ap.dot(ab) / abDotAb))
    const closest = new THREE.Vector3().addVectors(a, ab.multiplyScalar(t))
    return p.distanceTo(closest)
  }
}
