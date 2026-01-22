import { EditMode } from '../core/TinMesh'

export interface ToolbarCallbacks {
  onModeChange: (mode: EditMode) => void
  onRegenerate: () => void
}

export class Toolbar {
  private container: HTMLElement
  private callbacks: ToolbarCallbacks
  private currentMode: EditMode = 'none'

  constructor(container: HTMLElement, callbacks: ToolbarCallbacks) {
    this.container = container
    this.callbacks = callbacks
    this.render()
  }

  setMode(mode: EditMode) {
    this.currentMode = mode
    this.updateActiveState()
  }

  private render() {
    this.container.innerHTML = `
      <button class="btn btn-secondary" data-mode="none">View</button>
      <button class="btn btn-secondary" data-mode="edge">Delete Edge</button>
      <button class="btn btn-secondary" data-mode="point">Delete Point</button>
      <button class="btn btn-primary regenerate-btn">Regenerate</button>
      <div class="mode-indicator" id="mode-indicator">Mode: View</div>
      <div class="help-text" id="help-text">
        Click and drag to rotate. Scroll to zoom.
      </div>
    `

    this.attachEvents()
    this.updateActiveState()
  }

  private attachEvents() {
    // Mode buttons
    this.container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode as EditMode
        this.currentMode = mode
        this.updateActiveState()
        this.callbacks.onModeChange(mode)
      })
    })

    // Regenerate button
    const regenBtn = this.container.querySelector('.regenerate-btn')
    regenBtn?.addEventListener('click', () => {
      this.callbacks.onRegenerate()
    })
  }

  private updateActiveState() {
    // Update button states
    this.container.querySelectorAll('[data-mode]').forEach(btn => {
      const mode = (btn as HTMLElement).dataset.mode as EditMode
      btn.classList.toggle('active', mode === this.currentMode)
    })

    // Update mode indicator
    const indicator = this.container.querySelector('#mode-indicator') as HTMLElement
    if (indicator) {
      indicator.className = 'mode-indicator'
      let modeText = 'Mode: View'

      switch (this.currentMode) {
        case 'edge':
          indicator.classList.add('edit-edge')
          modeText = 'Mode: Delete Edge'
          break
        case 'point':
          indicator.classList.add('edit-point')
          modeText = 'Mode: Delete Point'
          break
      }
      indicator.textContent = modeText
    }

    // Update help text
    const helpText = this.container.querySelector('#help-text') as HTMLElement
    if (helpText) {
      switch (this.currentMode) {
        case 'none':
          helpText.textContent = 'Click and drag to rotate. Scroll to zoom.'
          break
        case 'edge':
          helpText.textContent = 'Click on an edge to delete it and its adjacent triangles.'
          break
        case 'point':
          helpText.textContent = 'Click on a point to delete it. TIN will regenerate.'
          break
      }
    }
  }
}
