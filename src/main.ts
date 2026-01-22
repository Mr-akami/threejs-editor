import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TinMesh, EditMode } from './core/TinMesh'
import { PointTable } from './components/PointTable'
import { Toolbar } from './components/Toolbar'
import { Point3D } from './utils/geometry'

// Default survey-like points (simulating total station measurements)
const defaultPoints: Point3D[] = [
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 0.5 },
  { x: 10, y: 0, z: 0.3 },
  { x: 0, y: 5, z: 0.2 },
  { x: 5, y: 5, z: 1.2 },
  { x: 10, y: 5, z: 0.8 },
  { x: 0, y: 10, z: 0.1 },
  { x: 5, y: 10, z: 0.6 },
  { x: 10, y: 10, z: 0.4 },
  { x: 2.5, y: 2.5, z: 0.9 },
]

class App {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private tinMesh: TinMesh
  private pointTable: PointTable
  private editMode: EditMode = 'none'
  private raycaster: THREE.Raycaster
  private mouse: THREE.Vector2
  private viewport: HTMLElement
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  constructor() {
    // Scene setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)

    // Cache viewport
    this.viewport = document.getElementById('viewport')!
    const aspect = this.viewport.clientWidth / this.viewport.clientHeight
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000)
    this.camera.position.set(15, 15, 15)
    this.camera.lookAt(5, 0, -5)

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(this.viewport.clientWidth, this.viewport.clientHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.viewport.appendChild(this.renderer.domElement)

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.target.set(5, 0, -5)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 20, 10)
    this.scene.add(directionalLight)

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333)
    this.scene.add(gridHelper)

    // Axes helper
    const axesHelper = new THREE.AxesHelper(5)
    this.scene.add(axesHelper)

    // Raycaster for picking
    this.raycaster = new THREE.Raycaster()
    this.raycaster.params.Points = { threshold: 0.5 }
    this.mouse = new THREE.Vector2()

    // TIN Mesh
    this.tinMesh = new TinMesh()
    this.scene.add(this.tinMesh.meshGroup)

    // UI Components
    new Toolbar(document.getElementById('toolbar')!, {
      onModeChange: (mode) => this.setEditMode(mode),
      onRegenerate: () => this.regenerateTin(),
    })

    this.pointTable = new PointTable(document.getElementById('point-table-container')!, {
      onPointsChange: (points) => this.onPointsChange(points),
    })

    // Initialize with default points
    this.pointTable.setPoints(defaultPoints)
    this.tinMesh.setPoints(defaultPoints)

    // Event listeners
    this.setupEventListeners()

    // Start render loop
    this.animate()
  }

  private setupEventListeners() {
    window.addEventListener('resize', () => this.onResize())
    this.viewport.addEventListener('mousemove', (e) => this.onMouseMove(e))
    this.viewport.addEventListener('click', (e) => this.onClick(e))
  }

  private onResize() {
    this.camera.aspect = this.viewport.clientWidth / this.viewport.clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.viewport.clientWidth, this.viewport.clientHeight)
  }

  private getGroundIntersection(event: MouseEvent): THREE.Vector3 | null {
    const rect = this.viewport.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersectPoint = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint) ? intersectPoint : null
  }

  private onMouseMove(event: MouseEvent) {
    if (this.editMode === 'none') {
      this.tinMesh.highlightEdge(null, this.scene)
      this.tinMesh.highlightPoint(null, this.scene)
      return
    }

    const intersectPoint = this.getGroundIntersection(event)
    if (!intersectPoint) return

    if (this.editMode === 'edge') {
      this.tinMesh.highlightPoint(null, this.scene)
      const edgeKey = this.tinMesh.findNearestEdge(intersectPoint)
      this.tinMesh.highlightEdge(edgeKey, this.scene)
    } else if (this.editMode === 'point') {
      this.tinMesh.highlightEdge(null, this.scene)
      const pointIndex = this.tinMesh.findNearestPoint(intersectPoint)
      this.tinMesh.highlightPoint(pointIndex, this.scene)
    }
  }

  private onClick(event: MouseEvent) {
    if (this.editMode === 'none') return

    const intersectPoint = this.getGroundIntersection(event)
    if (!intersectPoint) return

    if (this.editMode === 'edge') {
      const edgeKey = this.tinMesh.findNearestEdge(intersectPoint)
      if (edgeKey) {
        this.tinMesh.deleteEdge(edgeKey)
        this.tinMesh.highlightEdge(null, this.scene)
      }
    } else if (this.editMode === 'point') {
      const pointIndex = this.tinMesh.findNearestPoint(intersectPoint)
      if (pointIndex !== null) {
        this.tinMesh.deletePointByActiveIndex(pointIndex)
        this.tinMesh.highlightPoint(null, this.scene)
        this.pointTable.setPoints(
          this.tinMesh.points.filter((_, i) => !this.tinMesh.deletedPoints.has(i))
        )
      }
    }
  }

  private setEditMode(mode: EditMode) {
    this.editMode = mode
    this.controls.enabled = mode === 'none'
    this.tinMesh.highlightEdge(null, this.scene)
    this.tinMesh.highlightPoint(null, this.scene)
    this.viewport.style.cursor = mode === 'none' ? 'grab' : 'crosshair'
  }

  private onPointsChange(points: Point3D[]) {
    this.tinMesh.setPoints(points)
  }

  private regenerateTin() {
    const currentPoints = this.pointTable.getPoints()
    this.tinMesh.setPoints(currentPoints)
  }

  private animate() {
    requestAnimationFrame(() => this.animate())
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
}

// Initialize app
new App()
