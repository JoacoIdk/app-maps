# Map Trace Editor

An interactive web application for designing and editing road network maps with support for exporting and loading traces in CSV format.

---

## 🚀 Quick Start

You can run this application without installing any dependencies or package managers:

### Option 1: Direct in Browser
Simply open [index.html](file:///Users/jdelg/Library/CloudStorage/OneDrive-udd.cl/Classes/Second%20Semester/Bootcamp%20de%20Programacio%CC%81n/app-maps/index.html) in any modern browser (Chrome, Safari, Firefox, Edge).

### Option 2: Local HTTP Server (Python)
Run the built-in Python web server from this directory:
```bash
python3 -m http.server 8080
```
Then navigate to: `http://localhost:8080`

---

## 📋 Data Structure & CSV Specification

Each road line on the map is represented as a `Trace`:

```
public class Trace {
    private int id;
    private String name;
    private double width;
    private Point start;
    private Point end;
    private double radius;
    private RoadType type;
    private int cost;
    private boolean open;
}
```

Where:
```
public enum RoadType {
    STREET,
    AVENUE,
    HIGHWAY
}
```

### CSV Format
The CSV file uses the following header:
```csv
id,name,width,start_x,start_y,end_x,end_y,radius,type,cost,open
```

| Column | Type | Description |
|---|---|---|
| `id` | Integer | Unique identifier of the trace |
| `name` | String | Name of the road (e.g., "Sunset Boulevard") |
| `width` | Double | Rendered width of the road in pixels |
| `start_x` | Double | X coordinate of the starting point |
| `start_y` | Double | Y coordinate of the starting point |
| `end_x` | Double | X coordinate of the ending point |
| `end_y` | Double | Y coordinate of the ending point |
| `radius` | Double | Radius / curvature offset (0.0 for straight roads, non-zero for curves) |
| `type` | String | `STREET`, `AVENUE`, or `HIGHWAY` |
| `cost` | Integer | Transit or construction cost value |
| `open` | Boolean | `true` (open to traffic) or `false` (closed/maintenance) |

---

## ✨ Features

1. **Interactive Canvas**:
   - **Pan & Zoom**: Scroll wheel to zoom centered on cursor, drag canvas in Pan mode (or with middle-mouse button or Spacebar).
   - **Origin & Coordinate Grid**: Visual 20px grid with primary axes and coordinates readout.
   - **Snapping Support**:
     - *Snap to Grid*: Align coordinates neatly.
     - *Snap to Endpoints*: Snaps cursor to nearby road endpoints, making it easy to create connected road networks and intersections.

2. **Road Visualization**:
   - **Road Types**:
     - `STREET`: Standard asphalt with slate styling.
     - `AVENUE`: Cyan-accented boulevard with center lane marking.
     - `HIGHWAY`: Broad arterial road with gold/amber highway asphalt and dividers.
   - **Status (`open` / `closed`)**:
     - Open roads render solid and vibrant.
     - Closed roads render with dashed caution lines and a `CLOSED` tag.
   - **Curves**: Smooth quadratic curves when `radius != 0`.
   - **Labels**: Shows road name and cost on the canvas.

3. **Drawing & Editing Tools**:
   - **Draw Mode (D)**: Click once to set Start Point, move mouse to preview rubberband, click again to set End Point.
   - **Select Mode (V)**:
     - Click any road to inspect and edit its properties in the left sidebar.
     - Drag the green handle (Start) or blue handle (End) to reshape the road live.
     - Drag the road body to reposition the entire trace.
     - Press `Delete` or `Backspace` to remove the selected trace.
   - **Pan Mode (H)**: Drag to navigate the map.
   - **Fit View**: Automatically frames and centers all traces on screen.

4. **CSV Import & Export**:
   - **Load CSV**: Click "Load CSV" or drag and drop any `.csv` file directly onto the map canvas.
   - **Export CSV**: Click "Export CSV" to instantly generate and download `map.csv`.
   - **Sample Map**: Built-in "Sample Map" button to quickly load a demonstration road network.

5. **Traces Table Drawer**:
   - Collapsible table at the bottom with quick search filtering by name or road type.
   - Focus button to center the viewport on any road.
   - One-click toggle for open/closed status.
