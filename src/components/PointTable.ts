import { Point3D } from '../utils/geometry'

export interface PointTableCallbacks {
  onPointsChange: (points: Point3D[]) => void
}

export class PointTable {
  private container: HTMLElement
  private points: Point3D[] = []
  private callbacks: PointTableCallbacks
  private eventsAttached = false

  constructor(container: HTMLElement, callbacks: PointTableCallbacks) {
    this.container = container
    this.callbacks = callbacks
    this.attachEvents()
    this.render()
  }

  setPoints(points: Point3D[]) {
    this.points = [...points]
    this.render()
  }

  getPoints(): Point3D[] {
    return [...this.points]
  }

  private render() {
    this.container.innerHTML = `
      <div class="point-table-wrapper">
        <h3>Points (${this.points.length})</h3>
        <div class="table-scroll">
          <table class="point-table">
            <thead>
              <tr>
                <th>#</th>
                <th>X</th>
                <th>Y</th>
                <th>Z</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${this.points.map((p, i) => this.renderRow(p, i)).join('')}
            </tbody>
          </table>
        </div>
        <button class="btn btn-secondary add-point-btn">+ Add Point</button>
      </div>
    `
  }

  private renderRow(point: Point3D, index: number): string {
    return `
      <tr data-index="${index}">
        <td>${index + 1}</td>
        <td><input type="number" class="coord-x" value="${point.x}" step="0.1" /></td>
        <td><input type="number" class="coord-y" value="${point.y}" step="0.1" /></td>
        <td><input type="number" class="coord-z" value="${point.z}" step="0.1" /></td>
        <td><button class="delete-btn" title="Delete point">&times;</button></td>
      </tr>
    `
  }

  private attachEvents() {
    if (this.eventsAttached) return
    this.eventsAttached = true

    // Use event delegation on container (not replaced elements)
    this.container.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement
      if (!target.classList.contains('coord-x') &&
          !target.classList.contains('coord-y') &&
          !target.classList.contains('coord-z')) return

      const row = target.closest('tr')
      if (!row) return

      const index = parseInt(row.dataset.index || '0')
      const value = parseFloat(target.value) || 0

      if (target.classList.contains('coord-x')) {
        this.points[index].x = value
      } else if (target.classList.contains('coord-y')) {
        this.points[index].y = value
      } else if (target.classList.contains('coord-z')) {
        this.points[index].z = value
      }

      this.callbacks.onPointsChange([...this.points])
    })

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement

      // Delete button
      if (target.classList.contains('delete-btn')) {
        const row = target.closest('tr')
        if (!row) return
        const index = parseInt(row.dataset.index || '0')
        this.points.splice(index, 1)
        this.render()
        this.callbacks.onPointsChange([...this.points])
        return
      }

      // Add button
      if (target.classList.contains('add-point-btn')) {
        this.points.push({ x: 0, y: 0, z: 0 })
        this.render()
        this.callbacks.onPointsChange([...this.points])
      }
    })
  }
}
