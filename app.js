/**
 * Map Trace Editor
 * Data structure and interactive canvas for road networks.
 */

// --- Data Models ---
const RoadType = Object.freeze({
  STREET: 'STREET',
  AVENUE: 'AVENUE',
  HIGHWAY: 'HIGHWAY'
});

class Point {
  constructor(x = 0, y = 0) {
    this.x = Number(x);
    this.y = Number(y);
  }

  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.hypot(dx, dy);
  }
}

class Trace {
  constructor({
    id,
    name = 'Unnamed Road',
    width = 8.0,
    start = new Point(0, 0),
    end = new Point(100, 100),
    radius = 0.0,
    type = RoadType.STREET,
    cost = 10,
    open = true
  }) {
    this.id = Number(id);
    this.name = String(name);
    this.width = Number(width);
    this.start = start instanceof Point ? start : new Point(start.x, start.y);
    this.end = end instanceof Point ? end : new Point(end.x, end.y);
    this.radius = Number(radius);
    this.type = (type || RoadType.STREET).toString().toUpperCase();
    if (!RoadType[this.type]) {
      this.type = RoadType.STREET;
    }
    this.cost = parseInt(cost, 10) || 0;
    this.open = open === true || open === 'true' || open === 1 || open === '1';
  }

  getLength() {
    return this.start.distanceTo(this.end);
  }
}

// --- CSV Manager ---
class CSVManager {
  /**
   * Export traces to CSV format
   * Columns: id,name,width,start_x,start_y,end_x,end_y,radius,type,cost,open
   */
  static exportToCSV(traces, filename = 'map.csv') {
    const headers = ['id', 'name', 'width', 'start_x', 'start_y', 'end_x', 'end_y', 'radius', 'type', 'cost', 'open'];
    const rows = traces.map(t => {
      // Escape name if needed (contains commas, quotes, or newlines)
      let safeName = t.name;
      if (safeName.includes(',') || safeName.includes('"') || safeName.includes('\n')) {
        safeName = `"${safeName.replace(/"/g, '""')}"`;
      }
      return [
        t.id,
        safeName,
        t.width.toFixed(1),
        Math.round(t.start.x * 100) / 100,
        Math.round(t.start.y * 100) / 100,
        Math.round(t.end.x * 100) / 100,
        Math.round(t.end.y * 100) / 100,
        Math.round(t.radius * 100) / 100,
        t.type,
        t.cost,
        t.open ? 'true' : 'false'
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Parse CSV string into an array of Trace objects
   */
  static parseCSV(csvText) {
    if (!csvText || !csvText.trim()) {
      throw new Error('CSV file is empty');
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one trace row');
    }

    // Parse CSV line taking quotes into account
    function parseCSVLine(line) {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    }

    const headerTokens = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    // Map column names to indexes
    const colIndex = {
      id: headerTokens.indexOf('id'),
      name: headerTokens.indexOf('name'),
      width: headerTokens.indexOf('width'),
      start_x: headerTokens.indexOf('start_x'),
      start_y: headerTokens.indexOf('start_y'),
      end_x: headerTokens.indexOf('end_x'),
      end_y: headerTokens.indexOf('end_y'),
      radius: headerTokens.indexOf('radius'),
      type: headerTokens.findIndex(h => h === 'type' || h === 'roadtype' || h === 'road_type'),
      cost: headerTokens.indexOf('cost'),
      open: headerTokens.findIndex(h => h === 'open' || h === 'is_open' || h === 'status')
    };

    // Verify required point coordinate columns exist
    const requiredCols = ['start_x', 'start_y', 'end_x', 'end_y'];
    for (const req of requiredCols) {
      if (colIndex[req] === -1) {
        throw new Error(`Missing required CSV column: '${req}'`);
      }
    }

    const traces = [];
    for (let i = 1; i < lines.length; i++) {
      const tokens = parseCSVLine(lines[i]);
      if (tokens.length <= 1 && tokens[0] === '') continue;

      const id = colIndex.id !== -1 && tokens[colIndex.id] !== undefined
        ? parseInt(tokens[colIndex.id], 10) || i
        : i;

      const name = colIndex.name !== -1 && tokens[colIndex.name] !== undefined
        ? tokens[colIndex.name]
        : `Trace ${id}`;

      const width = colIndex.width !== -1 && tokens[colIndex.width] !== undefined
        ? parseFloat(tokens[colIndex.width]) || 8.0
        : 8.0;

      const start_x = parseFloat(tokens[colIndex.start_x]) || 0;
      const start_y = parseFloat(tokens[colIndex.start_y]) || 0;
      const end_x = parseFloat(tokens[colIndex.end_x]) || 0;
      const end_y = parseFloat(tokens[colIndex.end_y]) || 0;

      const radius = colIndex.radius !== -1 && tokens[colIndex.radius] !== undefined
        ? parseFloat(tokens[colIndex.radius]) || 0.0
        : 0.0;

      let typeStr = colIndex.type !== -1 && tokens[colIndex.type] !== undefined
        ? tokens[colIndex.type].toUpperCase()
        : 'STREET';
      if (!RoadType[typeStr]) typeStr = RoadType.STREET;

      const cost = colIndex.cost !== -1 && tokens[colIndex.cost] !== undefined
        ? parseInt(tokens[colIndex.cost], 10) || 10
        : 10;

      let openVal = true;
      if (colIndex.open !== -1 && tokens[colIndex.open] !== undefined) {
        const val = tokens[colIndex.open].toLowerCase();
        openVal = val === 'true' || val === '1' || val === 'yes' || val === 'open';
      }

      traces.push(new Trace({
        id,
        name,
        width,
        start: new Point(start_x, start_y),
        end: new Point(end_x, end_y),
        radius,
        type: typeStr,
        cost,
        open: openVal
      }));
    }

    return traces;
  }
}

// --- Main Application Controller ---
class App {
  constructor() {
    this.traces = [];
    this.selectedTrace = null;
    this.selectedHandle = null; // 'start' | 'end' | 'body'
    this.nextTraceId = 1;

    // Viewport camera (pan & zoom)
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.0,
      minZoom: 0.2,
      maxZoom: 5.0
    };

    // Interaction modes: 'SELECT' | 'DRAW' | 'PAN'
    this.mode = 'SELECT';

    // Drawing state
    this.drawStartPoint = null;
    this.currentMouseWorld = { x: 0, y: 0 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.isDraggingHandle = false;
    this.dragOffset = { x: 0, y: 0 };

    // Snapping options
    this.snapGrid = true;
    this.gridSize = 20;
    this.snapPoints = true;
    this.snapRadius = 15; // screen pixels
    this.showLabels = true;

    this.initDOM();
    this.initCanvas();
    this.initEvents();
    this.loadSampleData();
    this.render();
  }

  initDOM() {
    // Canvas elements
    this.canvas = document.getElementById('mapCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvasWrapper = document.getElementById('canvasWrapper');

    // Controls
    this.btnModeSelect = document.getElementById('btnModeSelect');
    this.btnModeDraw = document.getElementById('btnModeDraw');
    this.btnModePan = document.getElementById('btnModePan');
    this.btnFitView = document.getElementById('btnFitView');
    this.btnLoadSample = document.getElementById('btnLoadSample');
    this.btnImportCSV = document.getElementById('btnImportCSV');
    this.btnExportCSV = document.getElementById('btnExportCSV');
    this.csvFileInput = document.getElementById('csvFileInput');

    // Inspector form
    this.traceForm = document.getElementById('traceForm');
    this.inspectorTitle = document.getElementById('inspectorTitle');
    this.selectedIdBadge = document.getElementById('selectedIdBadge');
    this.fieldId = document.getElementById('fieldId');
    this.fieldName = document.getElementById('fieldName');
    this.fieldType = document.getElementById('fieldType');
    this.fieldWidth = document.getElementById('fieldWidth');
    this.fieldStartX = document.getElementById('fieldStartX');
    this.fieldStartY = document.getElementById('fieldStartY');
    this.fieldEndX = document.getElementById('fieldEndX');
    this.fieldEndY = document.getElementById('fieldEndY');
    this.fieldRadius = document.getElementById('fieldRadius');
    this.fieldCost = document.getElementById('fieldCost');
    this.fieldOpen = document.getElementById('fieldOpen');
    this.btnSaveTrace = document.getElementById('btnSaveTrace');
    this.btnCancelEdit = document.getElementById('btnCancelEdit');
    this.btnDeleteTrace = document.getElementById('btnDeleteTrace');

    // Options
    this.chkSnapGrid = document.getElementById('chkSnapGrid');
    this.chkSnapPoints = document.getElementById('chkSnapPoints');
    this.chkShowLabels = document.getElementById('chkShowLabels');

    // Stats
    this.statCount = document.getElementById('statCount');
    this.statOpen = document.getElementById('statOpen');
    this.statCost = document.getElementById('statCost');
    this.statClosed = document.getElementById('statClosed');

    // Overlays
    this.cursorCoords = document.getElementById('cursorCoords');
    this.zoomLevel = document.getElementById('zoomLevel');
    this.activeModeText = document.getElementById('activeModeText');
    this.drawingHint = document.getElementById('drawingHint');
    this.btnZoomIn = document.getElementById('btnZoomIn');
    this.btnZoomReset = document.getElementById('btnZoomReset');
    this.btnZoomOut = document.getElementById('btnZoomOut');
    this.dropZoneOverlay = document.getElementById('dropZoneOverlay');

    // Drawer / Table
    this.dataDrawer = document.getElementById('dataDrawer');
    this.drawerToggle = document.getElementById('drawerToggle');
    this.tracesTableBody = document.getElementById('tracesTableBody');
    this.tableCountBadge = document.getElementById('tableCountBadge');
    this.tableSearch = document.getElementById('tableSearch');
    this.btnClearMap = document.getElementById('btnClearMap');

    // Toast
    this.toastEl = document.getElementById('toast');
  }

  initCanvas() {
    const resize = () => {
      const rect = this.canvasWrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
      this.render();
    };

    window.addEventListener('resize', resize);
    resize();
  }

  initEvents() {
    // Mode buttons
    this.btnModeSelect.addEventListener('click', () => this.setMode('SELECT'));
    this.btnModeDraw.addEventListener('click', () => this.setMode('DRAW'));
    this.btnModePan.addEventListener('click', () => this.setMode('PAN'));

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.key === 'v' || e.key === 'V') this.setMode('SELECT');
      else if (e.key === 'd' || e.key === 'D') this.setMode('DRAW');
      else if (e.key === 'h' || e.key === 'H') this.setMode('PAN');
      else if (e.key === 'Escape') {
        if (this.drawStartPoint) {
          this.drawStartPoint = null;
          this.drawingHint.textContent = 'Click canvas to place Start Point. (Press ESC to cancel)';
          this.render();
        } else if (this.selectedTrace) {
          this.deselectTrace();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedTrace) {
          this.deleteTrace(this.selectedTrace.id);
        }
      }
    });

    // Zoom controls
    this.btnZoomIn.addEventListener('click', () => this.zoomAroundCenter(1.2));
    this.btnZoomOut.addEventListener('click', () => this.zoomAroundCenter(1 / 1.2));
    this.btnZoomReset.addEventListener('click', () => {
      this.camera.zoom = 1.0;
      this.render();
    });
    this.btnFitView.addEventListener('click', () => this.fitView());

    // Canvas Mouse Events
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));

    // Options toggles
    this.chkSnapGrid.addEventListener('change', (e) => { this.snapGrid = e.target.checked; });
    this.chkSnapPoints.addEventListener('change', (e) => { this.snapPoints = e.target.checked; });
    this.chkShowLabels.addEventListener('change', (e) => {
      this.showLabels = e.target.checked;
      this.render();
    });

    // Inspector Form
    this.traceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveTraceFromForm();
    });

    this.btnCancelEdit.addEventListener('click', () => this.deselectTrace());
    this.btnDeleteTrace.addEventListener('click', () => {
      if (this.selectedTrace) this.deleteTrace(this.selectedTrace.id);
    });

    // Form inputs live sync if editing
    ['fieldName', 'fieldType', 'fieldWidth', 'fieldStartX', 'fieldStartY', 'fieldEndX', 'fieldEndY', 'fieldRadius', 'fieldCost', 'fieldOpen'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        if (this.selectedTrace) {
          this.applyFormToSelectedTrace();
          this.render();
          this.updateTable();
        }
      });
    });

    // Import / Export
    this.btnExportCSV.addEventListener('click', () => {
      if (this.traces.length === 0) {
        this.showToast('No traces to export', 'error');
        return;
      }
      CSVManager.exportToCSV(this.traces, 'map.csv');
      this.showToast(`Exported ${this.traces.length} traces to map.csv`, 'success');
    });

    this.btnImportCSV.addEventListener('click', () => this.csvFileInput.click());
    this.csvFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      this.loadCSVFromFile(file);
      this.csvFileInput.value = '';
    });

    this.btnLoadSample.addEventListener('click', () => this.loadSampleData());
    this.btnClearMap.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all traces from the map?')) {
        this.traces = [];
        this.deselectTrace();
        this.updateStats();
        this.updateTable();
        this.render();
        this.showToast('Map cleared', 'info');
      }
    });

    // Drag & Drop CSV onto canvas
    ['dragenter', 'dragover'].forEach(eventName => {
      this.canvasWrapper.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropZoneOverlay.classList.add('active');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.canvasWrapper.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropZoneOverlay.classList.remove('active');
      });
    });

    this.canvasWrapper.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      if (file && (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text'))) {
        this.loadCSVFromFile(file);
      } else {
        this.showToast('Please drop a valid .csv file', 'error');
      }
    });

    // Drawer collapse toggle
    this.drawerToggle.addEventListener('click', () => {
      this.dataDrawer.classList.toggle('collapsed');
    });

    this.tableSearch.addEventListener('input', () => this.updateTable());
  }

  setMode(mode) {
    this.mode = mode;
    this.btnModeSelect.classList.toggle('active', mode === 'SELECT');
    this.btnModeDraw.classList.toggle('active', mode === 'DRAW');
    this.btnModePan.classList.toggle('active', mode === 'PAN');

    this.canvasWrapper.className = 'canvas-wrapper';
    if (mode === 'SELECT') this.canvasWrapper.classList.add('mode-select');
    else if (mode === 'PAN') this.canvasWrapper.classList.add('mode-pan');

    this.activeModeText.textContent = mode === 'SELECT' ? 'Select Mode' : mode === 'DRAW' ? 'Draw Mode' : 'Pan Mode';

    if (mode === 'DRAW') {
      this.drawingHint.style.display = 'block';
      this.drawingHint.textContent = 'Click canvas to place Start Point. (Press ESC to cancel)';
    } else {
      this.drawingHint.style.display = 'none';
      this.drawStartPoint = null;
    }

    this.render();
  }

  // --- Coordinate Transformations ---
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.camera.x) / this.camera.zoom,
      y: (sy - this.camera.y) / this.camera.zoom
    };
  }

  worldToScreen(wx, wy) {
    return {
      x: wx * this.camera.zoom + this.camera.x,
      y: wy * this.camera.zoom + this.camera.y
    };
  }

  applySnapping(worldPos) {
    let result = { x: worldPos.x, y: worldPos.y };

    // 1. Point snapping (snap to existing endpoints)
    if (this.snapPoints) {
      let nearestDist = Infinity;
      let nearestPoint = null;

      for (const t of this.traces) {
        // Skip current selected trace handles if we're dragging them
        const distStart = Math.hypot(t.start.x - worldPos.x, t.start.y - worldPos.y);
        const distEnd = Math.hypot(t.end.x - worldPos.x, t.end.y - worldPos.y);

        if (distStart < nearestDist) {
          nearestDist = distStart;
          nearestPoint = t.start;
        }
        if (distEnd < nearestDist) {
          nearestDist = distEnd;
          nearestPoint = t.end;
        }
      }

      // Check if within snap threshold in screen pixels
      if (nearestPoint && nearestDist * this.camera.zoom <= this.snapRadius) {
        return { x: nearestPoint.x, y: nearestPoint.y, snapped: 'point' };
      }
    }

    // 2. Grid snapping
    if (this.snapGrid) {
      result.x = Math.round(result.x / this.gridSize) * this.gridSize;
      result.y = Math.round(result.y / this.gridSize) * this.gridSize;
    }

    return result;
  }

  // --- Mouse / Touch Handlers ---
  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, this.camera.zoom * zoomFactor));

    // Zoom centered on cursor
    this.camera.x = mouseX - (mouseX - this.camera.x) * (newZoom / this.camera.zoom);
    this.camera.y = mouseY - (mouseY - this.camera.y) * (newZoom / this.camera.zoom);
    this.camera.zoom = newZoom;

    this.render();
  }

  zoomAroundCenter(factor) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, this.camera.zoom * factor));

    this.camera.x = cx - (cx - this.camera.x) * (newZoom / this.camera.zoom);
    this.camera.y = cy - (cy - this.camera.y) * (newZoom / this.camera.zoom);
    this.camera.zoom = newZoom;
    this.render();
  }

  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const rawWorld = this.screenToWorld(mouseX, mouseY);
    const snappedWorld = this.applySnapping(rawWorld);

    // Pan with middle mouse button or if space pressed or in PAN mode
    if (e.button === 1 || this.mode === 'PAN' || e.spaceKey) {
      this.isPanning = true;
      this.panStart = { x: mouseX - this.camera.x, y: mouseY - this.camera.y };
      return;
    }

    if (e.button !== 0) return; // Only left-click from here

    if (this.mode === 'DRAW') {
      if (!this.drawStartPoint) {
        // Place start point
        this.drawStartPoint = snappedWorld;
        this.drawingHint.textContent = 'Click to place End Point. (Press ESC to cancel)';
      } else {
        // Place end point and create trace
        const endPoint = snappedWorld;
        if (Math.hypot(endPoint.x - this.drawStartPoint.x, endPoint.y - this.drawStartPoint.y) > 5) {
          this.createTraceFromDraw(this.drawStartPoint, endPoint);
        }
        this.drawStartPoint = null;
        this.drawingHint.textContent = 'Click canvas to place Start Point. (Press ESC to cancel)';
      }
      this.render();
    } else if (this.mode === 'SELECT') {
      // Check handles of selected trace first
      if (this.selectedTrace) {
        const handleStartScreen = this.worldToScreen(this.selectedTrace.start.x, this.selectedTrace.start.y);
        const handleEndScreen = this.worldToScreen(this.selectedTrace.end.x, this.selectedTrace.end.y);

        if (Math.hypot(mouseX - handleStartScreen.x, mouseY - handleStartScreen.y) <= 12) {
          this.isDraggingHandle = true;
          this.selectedHandle = 'start';
          return;
        }
        if (Math.hypot(mouseX - handleEndScreen.x, mouseY - handleEndScreen.y) <= 12) {
          this.isDraggingHandle = true;
          this.selectedHandle = 'end';
          return;
        }
      }

      // Hit-test traces
      const hit = this.hitTestTrace(rawWorld.x, rawWorld.y);
      if (hit) {
        this.selectTrace(hit);
        this.isDraggingHandle = true;
        this.selectedHandle = 'body';
        this.dragOffset = {
          x: rawWorld.x,
          y: rawWorld.y
        };
      } else {
        this.deselectTrace();
      }
      this.render();
    }
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const rawWorld = this.screenToWorld(mouseX, mouseY);
    const snappedWorld = this.applySnapping(rawWorld);

    this.currentMouseWorld = snappedWorld;

    // Update bottom overlay
    this.cursorCoords.textContent = `X: ${Math.round(snappedWorld.x)}, Y: ${Math.round(snappedWorld.y)}`;
    this.zoomLevel.textContent = `${Math.round(this.camera.zoom * 100)}%`;

    if (this.isPanning) {
      this.camera.x = mouseX - this.panStart.x;
      this.camera.y = mouseY - this.panStart.y;
      this.render();
      return;
    }

    if (this.isDraggingHandle && this.selectedTrace) {
      if (this.selectedHandle === 'start') {
        this.selectedTrace.start.x = snappedWorld.x;
        this.selectedTrace.start.y = snappedWorld.y;
      } else if (this.selectedHandle === 'end') {
        this.selectedTrace.end.x = snappedWorld.x;
        this.selectedTrace.end.y = snappedWorld.y;
      } else if (this.selectedHandle === 'body') {
        const dx = rawWorld.x - this.dragOffset.x;
        const dy = rawWorld.y - this.dragOffset.y;
        this.selectedTrace.start.x += dx;
        this.selectedTrace.start.y += dy;
        this.selectedTrace.end.x += dx;
        this.selectedTrace.end.y += dy;
        this.dragOffset = { x: rawWorld.x, y: rawWorld.y };
      }
      this.populateForm(this.selectedTrace);
      this.updateTable();
      this.render();
      return;
    }

    if (this.mode === 'DRAW' && this.drawStartPoint) {
      this.render();
    }
  }

  onMouseUp() {
    this.isPanning = false;
    this.isDraggingHandle = false;
    this.selectedHandle = null;
  }

  // --- Hit Testing ---
  hitTestTrace(wx, wy) {
    // Check in reverse order so topmost trace gets selected first
    for (let i = this.traces.length - 1; i >= 0; i--) {
      const t = this.traces[i];
      const dist = this.distancePointToTrace(wx, wy, t);
      // Tolerance in screen pixels converted to world units
      const tolerance = (t.width / 2 + 10) / this.camera.zoom;
      if (dist <= tolerance) {
        return t;
      }
    }
    return null;
  }

  distancePointToTrace(px, py, trace) {
    const x1 = trace.start.x;
    const y1 = trace.start.y;
    const x2 = trace.end.x;
    const y2 = trace.end.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) return Math.hypot(px - x1, py - y1);

    // If curved (radius != 0), approximate using control point
    if (Math.abs(trace.radius) > 0.1) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const angle = Math.atan2(dy, dx);
      const cpX = midX + Math.sin(angle) * trace.radius;
      const cpY = midY - Math.cos(angle) * trace.radius;

      // Sample along quadratic bezier
      let minDist = Infinity;
      for (let t = 0; t <= 1; t += 0.05) {
        const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpX + t * t * x2;
        const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpY + t * t * y2;
        const d = Math.hypot(px - bx, py - by);
        if (d < minDist) minDist = d;
      }
      return minDist;
    }

    // Straight segment projection
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  // --- Trace Operations ---
  createTraceFromDraw(start, end) {
    // Determine road type and defaults from form or sequence
    const type = this.fieldType.value;
    const width = parseFloat(this.fieldWidth.value) || (type === RoadType.HIGHWAY ? 16 : type === RoadType.AVENUE ? 12 : 8);
    const cost = parseInt(this.fieldCost.value, 10) || 10;
    const radius = parseFloat(this.fieldRadius.value) || 0.0;
    const open = this.fieldOpen.checked;

    const trace = new Trace({
      id: this.getNextAvailableId(),
      name: `${this.formatRoadTypeName(type)} ${this.traces.length + 1}`,
      width,
      start: new Point(start.x, start.y),
      end: new Point(end.x, end.y),
      radius,
      type,
      cost,
      open
    });

    this.traces.push(trace);
    this.selectTrace(trace);
    this.updateStats();
    this.updateTable();
    this.showToast(`Created ${trace.name}`, 'info');
  }

  formatRoadTypeName(type) {
    switch (type) {
      case RoadType.HIGHWAY: return 'Highway';
      case RoadType.AVENUE: return 'Avenue';
      default: return 'Street';
    }
  }

  getNextAvailableId() {
    const existingIds = new Set(this.traces.map(t => t.id));
    let id = 1;
    while (existingIds.has(id)) {
      id++;
    }
    return id;
  }

  selectTrace(trace) {
    this.selectedTrace = trace;
    this.populateForm(trace);
    this.inspectorTitle.textContent = 'Edit Trace';
    this.selectedIdBadge.textContent = `ID #${trace.id}`;
    this.selectedIdBadge.className = 'tag tag-editing';
    this.btnSaveTrace.textContent = 'Update Trace';
    this.btnCancelEdit.style.display = 'inline-block';
    this.btnDeleteTrace.style.display = 'inline-block';
    this.highlightTableRow(trace.id);
  }

  deselectTrace() {
    this.selectedTrace = null;
    this.resetForm();
    this.inspectorTitle.textContent = 'Trace Properties';
    this.selectedIdBadge.textContent = 'New Trace';
    this.selectedIdBadge.className = 'tag tag-new';
    this.btnSaveTrace.textContent = 'Add Trace';
    this.btnCancelEdit.style.display = 'none';
    this.btnDeleteTrace.style.display = 'none';
    this.highlightTableRow(null);
    this.render();
  }

  populateForm(t) {
    this.fieldId.value = t.id;
    this.fieldName.value = t.name;
    this.fieldType.value = t.type;
    this.fieldWidth.value = t.width;
    this.fieldStartX.value = Math.round(t.start.x);
    this.fieldStartY.value = Math.round(t.start.y);
    this.fieldEndX.value = Math.round(t.end.x);
    this.fieldEndY.value = Math.round(t.end.y);
    this.fieldRadius.value = t.radius;
    this.fieldCost.value = t.cost;
    this.fieldOpen.checked = t.open;
  }

  resetForm() {
    this.fieldId.value = '';
    this.fieldName.value = `Road ${this.traces.length + 1}`;
    this.fieldType.value = RoadType.STREET;
    this.fieldWidth.value = 8.0;
    this.fieldStartX.value = 100;
    this.fieldStartY.value = 100;
    this.fieldEndX.value = 300;
    this.fieldEndY.value = 100;
    this.fieldRadius.value = 0.0;
    this.fieldCost.value = 10;
    this.fieldOpen.checked = true;
  }

  applyFormToSelectedTrace() {
    if (!this.selectedTrace) return;
    this.selectedTrace.name = this.fieldName.value || 'Unnamed';
    this.selectedTrace.type = this.fieldType.value;
    this.selectedTrace.width = parseFloat(this.fieldWidth.value) || 8.0;
    this.selectedTrace.start.x = parseFloat(this.fieldStartX.value) || 0;
    this.selectedTrace.start.y = parseFloat(this.fieldStartY.value) || 0;
    this.selectedTrace.end.x = parseFloat(this.fieldEndX.value) || 0;
    this.selectedTrace.end.y = parseFloat(this.fieldEndY.value) || 0;
    this.selectedTrace.radius = parseFloat(this.fieldRadius.value) || 0;
    this.selectedTrace.cost = parseInt(this.fieldCost.value, 10) || 0;
    this.selectedTrace.open = this.fieldOpen.checked;
    this.updateStats();
  }

  saveTraceFromForm() {
    if (this.selectedTrace) {
      this.applyFormToSelectedTrace();
      this.showToast(`Updated ${this.selectedTrace.name}`, 'success');
      this.deselectTrace();
    } else {
      const trace = new Trace({
        id: this.getNextAvailableId(),
        name: this.fieldName.value || `Road ${this.traces.length + 1}`,
        type: this.fieldType.value,
        width: parseFloat(this.fieldWidth.value) || 8.0,
        start: new Point(parseFloat(this.fieldStartX.value) || 0, parseFloat(this.fieldStartY.value) || 0),
        end: new Point(parseFloat(this.fieldEndX.value) || 100, parseFloat(this.fieldEndY.value) || 100),
        radius: parseFloat(this.fieldRadius.value) || 0,
        cost: parseInt(this.fieldCost.value, 10) || 10,
        open: this.fieldOpen.checked
      });
      this.traces.push(trace);
      this.showToast(`Added ${trace.name}`, 'success');
      this.resetForm();
    }
    this.updateStats();
    this.updateTable();
    this.render();
  }

  deleteTrace(id) {
    const idx = this.traces.findIndex(t => t.id === id);
    if (idx !== -1) {
      const name = this.traces[idx].name;
      this.traces.splice(idx, 1);
      if (this.selectedTrace && this.selectedTrace.id === id) {
        this.deselectTrace();
      }
      this.updateStats();
      this.updateTable();
      this.render();
      this.showToast(`Deleted ${name}`, 'info');
    }
  }

  toggleTraceOpen(id) {
    const t = this.traces.find(tr => tr.id === id);
    if (t) {
      t.open = !t.open;
      if (this.selectedTrace && this.selectedTrace.id === id) {
        this.fieldOpen.checked = t.open;
      }
      this.updateStats();
      this.updateTable();
      this.render();
    }
  }

  // --- Rendering ---
  render() {
    const ctx = this.ctx;
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Clear background
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Apply camera pan & zoom
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // Draw coordinate grid
    this.renderGrid(ctx, width, height);

    // Draw traces
    for (const trace of this.traces) {
      const isSelected = this.selectedTrace && this.selectedTrace.id === trace.id;
      this.renderTrace(ctx, trace, isSelected);
    }

    // Draw preview line while drawing
    if (this.mode === 'DRAW' && this.drawStartPoint) {
      this.renderDrawPreview(ctx);
    }

    ctx.restore();
  }

  renderGrid(ctx, screenW, screenH) {
    // Calculate world bounding box visible on screen
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(screenW, screenH);

    const step = this.gridSize;
    const startX = Math.floor(tl.x / step) * step;
    const endX = Math.ceil(br.x / step) * step;
    const startY = Math.floor(tl.y / step) * step;
    const endY = Math.ceil(br.y / step) * step;

    // Grid lines
    ctx.lineWidth = 1 / this.camera.zoom;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += step) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Primary Axis (0,0)
    ctx.lineWidth = 2 / this.camera.zoom;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(endX, 0);
    ctx.moveTo(0, startY);
    ctx.lineTo(0, endY);
    ctx.stroke();

    // Origin marker
    ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, 4 / this.camera.zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  renderTrace(ctx, trace, isSelected) {
    const x1 = trace.start.x;
    const y1 = trace.start.y;
    const x2 = trace.end.x;
    const y2 = trace.end.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const hasRadius = Math.abs(trace.radius) > 0.1;
    const cpX = midX + Math.sin(angle) * trace.radius;
    const cpY = midY - Math.cos(angle) * trace.radius;

    // Determine colors based on RoadType and Open status
    let casingColor = '#334155';
    let roadColor = '#1e293b';
    let centerLineColor = 'rgba(255, 255, 255, 0.4)';

    if (trace.type === RoadType.HIGHWAY) {
      casingColor = '#78350f';
      roadColor = trace.open ? '#d97706' : '#7f1d1d';
      centerLineColor = '#fef08a';
    } else if (trace.type === RoadType.AVENUE) {
      casingColor = '#0e7490';
      roadColor = trace.open ? '#0891b2' : '#7f1d1d';
      centerLineColor = '#cffafe';
    } else {
      // STREET
      casingColor = '#475569';
      roadColor = trace.open ? '#64748b' : '#7f1d1d';
      centerLineColor = 'rgba(255, 255, 255, 0.3)';
    }

    ctx.save();

    // Selection Glow
    if (isSelected) {
      ctx.lineWidth = trace.width + 12 / this.camera.zoom;
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (hasRadius) {
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      } else {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }

    // Road Casing (Border)
    ctx.lineWidth = trace.width + 4;
    ctx.strokeStyle = casingColor;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (hasRadius) {
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
    } else {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // Road Pavement
    ctx.lineWidth = trace.width;
    ctx.strokeStyle = roadColor;
    ctx.lineCap = 'round';

    if (!trace.open) {
      ctx.setLineDash([8 / this.camera.zoom, 6 / this.camera.zoom]);
    }

    ctx.beginPath();
    if (hasRadius) {
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
    } else {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Road Center Line (for Avenues and Highways)
    if (trace.width >= 10 && trace.open) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = centerLineColor;
      ctx.setLineDash([6 / this.camera.zoom, 6 / this.camera.zoom]);
      ctx.beginPath();
      if (hasRadius) {
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      } else {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Endpoints & Handles
    this.renderEndpointHandle(ctx, x1, y1, '#10b981', 'S', isSelected);
    this.renderEndpointHandle(ctx, x2, y2, '#3b82f6', 'E', isSelected);

    // Road Label (Name & Cost / Closed)
    if (this.showLabels) {
      this.renderTraceLabel(ctx, trace, midX, midY, cpX, cpY, hasRadius);
    }

    ctx.restore();
  }

  renderEndpointHandle(ctx, x, y, color, label, isSelected) {
    const radius = isSelected ? 7 / this.camera.zoom : 5 / this.camera.zoom;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2 / this.camera.zoom;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  renderTraceLabel(ctx, trace, midX, midY, cpX, cpY, hasRadius) {
    const posX = hasRadius ? (midX + cpX) / 2 : midX;
    const posY = (hasRadius ? (midY + cpY) / 2 : midY) - 10 / this.camera.zoom;

    ctx.font = `600 ${Math.max(10, 11 / this.camera.zoom)}px Inter, sans-serif`;
    const labelText = `${trace.name} ($${trace.cost})`;
    const textMetrics = ctx.measureText(labelText);
    const bgWidth = textMetrics.width + 10 / this.camera.zoom;
    const bgHeight = 16 / this.camera.zoom;

    // Badge background
    ctx.fillStyle = trace.open ? 'rgba(15, 23, 42, 0.85)' : 'rgba(185, 28, 28, 0.9)';
    ctx.beginPath();
    ctx.roundRect(
      posX - bgWidth / 2,
      posY - bgHeight / 2,
      bgWidth,
      bgHeight,
      3 / this.camera.zoom
    );
    ctx.fill();

    // Badge border
    ctx.lineWidth = 1 / this.camera.zoom;
    ctx.strokeStyle = trace.open ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.5)';
    ctx.stroke();

    // Badge text
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, posX, posY);

    if (!trace.open) {
      // Extra closed tag
      ctx.fillStyle = '#fca5a5';
      ctx.font = `700 ${Math.max(8, 9 / this.camera.zoom)}px Inter, sans-serif`;
      ctx.fillText('CLOSED', posX, posY - 14 / this.camera.zoom);
    }
  }

  renderDrawPreview(ctx) {
    const x1 = this.drawStartPoint.x;
    const y1 = this.drawStartPoint.y;
    const x2 = this.currentMouseWorld.x;
    const y2 = this.currentMouseWorld.y;

    // Draw elastic line
    ctx.lineWidth = 3 / this.camera.zoom;
    ctx.strokeStyle = '#3b82f6';
    ctx.setLineDash([5 / this.camera.zoom, 5 / this.camera.zoom]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start point marker
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(x1, y1, 6 / this.camera.zoom, 0, Math.PI * 2);
    ctx.fill();

    // End point marker
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(x2, y2, 6 / this.camera.zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  fitView() {
    if (this.traces.length === 0) {
      this.camera = { x: 50, y: 50, zoom: 1.0, minZoom: 0.2, maxZoom: 5.0 };
      this.render();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const t of this.traces) {
      minX = Math.min(minX, t.start.x, t.end.x);
      minY = Math.min(minY, t.start.y, t.end.y);
      maxX = Math.max(maxX, t.start.x, t.end.x);
      maxY = Math.max(maxY, t.start.y, t.end.y);
    }

    const padding = 80;
    const bboxW = maxX - minX || 200;
    const bboxH = maxY - minY || 200;

    const screenW = this.canvas.width / (window.devicePixelRatio || 1);
    const screenH = this.canvas.height / (window.devicePixelRatio || 1);

    const zoomX = (screenW - padding * 2) / bboxW;
    const zoomY = (screenH - padding * 2) / bboxH;
    const zoom = Math.max(this.camera.minZoom, Math.min(2.0, Math.min(zoomX, zoomY)));

    this.camera.zoom = zoom;
    this.camera.x = screenW / 2 - ((minX + maxX) / 2) * zoom;
    this.camera.y = screenH / 2 - ((minY + maxY) / 2) * zoom;

    this.render();
  }

  // --- Statistics & Table ---
  updateStats() {
    this.statCount.textContent = this.traces.length;
    const openCount = this.traces.filter(t => t.open).length;
    this.statOpen.textContent = openCount;
    this.statClosed.textContent = this.traces.length - openCount;
    const totalCost = this.traces.reduce((sum, t) => sum + (t.cost || 0), 0);
    this.statCost.textContent = `$${totalCost}`;
    this.tableCountBadge.textContent = this.traces.length;
  }

  updateTable() {
    const query = (this.tableSearch.value || '').toLowerCase().trim();
    const filtered = this.traces.filter(t => {
      if (!query) return true;
      return t.name.toLowerCase().includes(query) ||
             t.type.toLowerCase().includes(query) ||
             String(t.id).includes(query);
    });

    this.tracesTableBody.innerHTML = '';

    for (const t of filtered) {
      const tr = document.createElement('tr');
      if (this.selectedTrace && this.selectedTrace.id === t.id) {
        tr.className = 'selected';
      }

      const typeBadgeClass = t.type === RoadType.HIGHWAY ? 'badge-highway' : t.type === RoadType.AVENUE ? 'badge-avenue' : 'badge-street';
      const statusBadge = t.open ? '<span class="badge-open">● Open</span>' : '<span class="badge-closed">● Closed</span>';

      tr.innerHTML = `
        <td><strong>#${t.id}</strong></td>
        <td>${this.escapeHTML(t.name)}</td>
        <td><span class="badge-type ${typeBadgeClass}">${t.type}</span></td>
        <td>${t.width}px</td>
        <td>(${Math.round(t.start.x)}, ${Math.round(t.start.y)})</td>
        <td>(${Math.round(t.end.x)}, ${Math.round(t.end.y)})</td>
        <td>${t.radius}</td>
        <td>$${t.cost}</td>
        <td>
          <button class="btn btn-xs ${t.open ? 'btn-secondary' : 'btn-danger'}" onclick="app.toggleTraceOpen(${t.id})">
            ${statusBadge}
          </button>
        </td>
        <td>
          <div class="cell-actions">
            <button class="btn btn-secondary btn-xs" title="Focus" onclick="app.focusTrace(${t.id})">
              Focus
            </button>
            <button class="btn btn-danger btn-xs" title="Delete" onclick="app.deleteTrace(${t.id})">
              ✕
            </button>
          </div>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
          this.selectTrace(t);
          this.render();
        }
      });

      this.tracesTableBody.appendChild(tr);
    }
  }

  highlightTableRow(id) {
    const rows = this.tracesTableBody.querySelectorAll('tr');
    rows.forEach(r => r.classList.remove('selected'));
    if (id !== null) {
      this.updateTable();
    }
  }

  focusTrace(id) {
    const trace = this.traces.find(t => t.id === id);
    if (!trace) return;

    this.selectTrace(trace);

    // Center camera on trace midpoint
    const midX = (trace.start.x + trace.end.x) / 2;
    const midY = (trace.start.y + trace.end.y) / 2;
    const screenW = this.canvas.width / (window.devicePixelRatio || 1);
    const screenH = this.canvas.height / (window.devicePixelRatio || 1);

    this.camera.x = screenW / 2 - midX * this.camera.zoom;
    this.camera.y = screenH / 2 - midY * this.camera.zoom;

    this.render();
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // --- CSV Loading ---
  loadCSVFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const newTraces = CSVManager.parseCSV(text);
        this.traces = newTraces;
        this.deselectTrace();
        this.updateStats();
        this.updateTable();
        this.fitView();
        this.showToast(`Loaded ${newTraces.length} traces from ${file.name}`, 'success');
      } catch (err) {
        this.showToast(`Failed to parse CSV: ${err.message}`, 'error');
      }
    };
    reader.onerror = () => {
      this.showToast('Error reading CSV file', 'error');
    };
    reader.readAsText(file);
  }

  loadSampleData() {
    this.traces = [
      new Trace({
        id: 1,
        name: 'Sunset Boulevard',
        width: 12.0,
        start: new Point(100, 200),
        end: new Point(500, 200),
        radius: 0.0,
        type: RoadType.AVENUE,
        cost: 15,
        open: true
      }),
      new Trace({
        id: 2,
        name: 'Main Street',
        width: 8.0,
        start: new Point(250, 50),
        end: new Point(250, 450),
        radius: 0.0,
        type: RoadType.STREET,
        cost: 8,
        open: true
      }),
      new Trace({
        id: 3,
        name: 'Grand Highway North',
        width: 18.0,
        start: new Point(50, 50),
        end: new Point(600, 100),
        radius: 25.0,
        type: RoadType.HIGHWAY,
        cost: 30,
        open: true
      }),
      new Trace({
        id: 4,
        name: 'Oak Avenue',
        width: 10.0,
        start: new Point(100, 350),
        end: new Point(500, 350),
        radius: 0.0,
        type: RoadType.AVENUE,
        cost: 12,
        open: true
      }),
      new Trace({
        id: 5,
        name: 'Pine Lane',
        width: 6.0,
        start: new Point(150, 200),
        end: new Point(150, 350),
        radius: 0.0,
        type: RoadType.STREET,
        cost: 5,
        open: true
      }),
      new Trace({
        id: 6,
        name: 'Elm Court',
        width: 6.0,
        start: new Point(380, 200),
        end: new Point(380, 350),
        radius: 0.0,
        type: RoadType.STREET,
        cost: 6,
        open: true
      }),
      new Trace({
        id: 7,
        name: 'Industrial Bypass',
        width: 16.0,
        start: new Point(500, 200),
        end: new Point(650, 450),
        radius: 40.0,
        type: RoadType.HIGHWAY,
        cost: 25,
        open: false
      }),
      new Trace({
        id: 8,
        name: 'River Walkway',
        width: 6.0,
        start: new Point(250, 450),
        end: new Point(450, 500),
        radius: 15.0,
        type: RoadType.STREET,
        cost: 4,
        open: true
      })
    ];

    this.deselectTrace();
    this.updateStats();
    this.updateTable();
    this.fitView();
    this.showToast('Loaded sample city map', 'info');
  }

  showToast(message, type = 'info') {
    this.toastEl.textContent = message;
    this.toastEl.className = `toast ${type} show`;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 3000);
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
