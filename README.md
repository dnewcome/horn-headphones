# Horn Lab

Open **[index.html](index.html)** in a browser. No installation, server, network connection, or build step is needed. Drag the preview to orbit; scroll to zoom.

Start with **Swept goat**, **Ram curl**, or **Twisted ibex**. Save settings as JSON to keep a design; load that file to resume. Ready-made STL, OBJ, and settings files for all three presets are in `examples/`.

## Shape controls

| Control | Effect |
| --- | --- |
| Mesh faces | Quads, split-quad triangles, triangular lattice, or decimated triangles. Changes the actual mesh used by the preview and exports. Saved with settings. |
| Centerline length | Length along the horn in millimeters, rather than its vertical height. The default goat is approximately 121 mm tall. |
| Base diameter | Diameter across the cross-section's circumcircle before oval scaling. With odd side counts, measured width differs slightly. |
| Curl | Total change in the centerline's bending angle. Larger values hook back toward the base. |
| 3D sweep | Rotates the bending direction along the horn, making the curl three-dimensional. |
| Bend distribution | Values above 1 delay the bend toward the tip; values below 1 bend earlier. |
| Taper exponent | Higher values narrow faster; lower values retain bulk longer. |
| Tip diameter | Small closed end face instead of an infinitely sharp point. |
| Lengthwise segments | Number of polygon strips from root to tip. |
| Cross-section sides | Number of facets around each ring. |
| Cross-section twist | Rotates the polygon rings along the horn. Most apparent with fewer sides or an oval section. |
| Oval ratio | Width along the second cross-section axis relative to the first. |
| Lean from base normal | Adds an angle above the mounting face. Lean eases through a curved root, keeping the base flat; it is not a mechanical hinge. |
| Swivel around base | Turns the curve's direction around the base's vertical axis. |

The mirrored pair preview uses a fixed display spacing. It is a shape study, not a fitted headband assembly. Each download contains **one horn**; check **Export mirrored horn** for its mate. The mirror reverses face winding to retain outward normals.

## Triangle styles

- **Quads:** the original ring strips, with polygon end caps. STL necessarily splits these faces into triangles.
- **Split-quad triangles:** the same vertices and silhouette, with a diagonal across each quad.
- **Triangular lattice:** alternating rings are offset by half a side, with triangles connecting staggered vertices. This changes the surface sampling instead of simply adding diagonals.
- **Decimated triangles:** starts with a denser triangular lattice, then uses quadric-error edge collapses to simplify the surface. Vertices move and connectivity changes, producing irregular, larger planar facets. **Retained mesh detail** controls the percentage of source triangles to aim for; lower values give a chunkier look.

Decimation doubles the lengthwise and cross-section sampling up to 64 segments and 24 sides. The existing segment and side controls therefore also affect the source resolution. Base and tip perimeters are locked; topology and face-flip checks can prevent the requested target from being reached. The result is deterministic, with no randomized vertex jitter. Strong reductions can change the silhouette and dimensions. Decimation is computed locally and may briefly pause the preview at high resolution.

## Printing and mounting

STL exports are closed, triangulated surfaces with coordinates in **millimeters**. Check the imported dimensions in your slicer. These are solid envelopes: choose walls and infill in the slicer to control weight. No hollow cavity, strap holes, mounting adapter, or mask shell is modeled yet.

The base lies in the XY plane at Z = 0. Use lean and swivel to explore the silhouette relative to that face. A curved headband or headphone shell will still need a fitted saddle, wedge, or padded interface between it and the flat horn base. That adapter should be designed against the actual band width, curvature, and fastening method.

Changing curl or lean can bring parts below the base or cause intersections. The editor flags some aggressive combinations but does **not** detect all self-intersections, check support requirements, or guarantee printability. Inspect the entire model in a slicer before printing. The tip is capped but can still be delicate.

## Blender and paper patterns

OBJ normally retains polygon strips and end caps, which makes the rings easier to select and edit. OBJ does not declare physical units; preserve the numeric coordinates and explicitly account for millimeters in the destination application's scale settings.

For paper patterns, choose one of the triangle modes. Curled and twisted quad faces are generally nonplanar, so a single flat paper quad cannot exactly reproduce them. Triangles define flat panels matching the STL surface. The preview shows the actual triangle edges.

A practical seam layout to try is one lengthwise seam down the least visible side, with the base and tip caps separated. Tight curls may need additional cuts and separate islands. Use the imported mesh with your preferred unfolding workflow, then check pattern scale using a known edge length. Ordinary UV unwrap output is not automatically a dimensionally accurate papercraft net. This editor does not yet generate seams, glue tabs, numbered panels, or printable layouts.

## Development and checks

`horn.js` contains the dependency-free geometry generator and STL/OBJ serializers. `decimate.js` implements quadric-error mesh simplification. `app.js` contains controls and a Canvas preview. Both files are plain JavaScript; the geometry module can also be loaded with Node's `require()`.

Run `node tests/mesh.test.js` for geometry checks. They cover finite coordinates, non-degenerate triangles, closed manifold edges, consistent outward winding, flat bases, mirrored geometry, density-independent centerline endpoints, orientation controls, parameter validation, and export counts. They do not establish absence of self-intersection.

Open `tests/browser.html` for a browser smoke test of controls and downloads.
