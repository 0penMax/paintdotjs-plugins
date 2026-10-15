import {openEffectDialog, addRange, addSelect} from "../../lib/effect-dialog.js";
import {createCanvasEditor} from "../../lib/canvas-editor.js";
import {displacementFromStrokes, renderDisplacement} from "../../lib/warp.js";

function configure(context) {
    return openEffectDialog(context, ({values, content, requestPreview, sourceCanvas}) => {
        values.tool ||= "push";
        values.radius ??= 0.08;
        values.strength ??= 0.6;
        values.strokes ||= [];
        let toolbar = document.createElement("div");
        toolbar.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px";
        content.appendChild(toolbar);
        addSelect(toolbar, values, "tool", "Tool", [
            ["push", "Push"], ["twistLeft", "Twist Left"], ["twistRight", "Twist Right"],
            ["bloat", "Bloat"], ["pucker", "Pucker"], ["reconstruct", "Reconstruct"],
            ["freeze", "Freeze Mask"], ["thaw", "Thaw Mask"]
        ], () => {});
        addRange(toolbar, values, "radius", "Brush size", 0.01, 0.3, 0.01, () => draw());
        addRange(toolbar, values, "strength", "Pressure", 0.05, 1, 0.05, () => {});

        let current = null;
        let editor = createCanvasEditor(content, sourceCanvas(), (phase, point) => {
            if (phase === "start") {
                current = {
                    tool: values.tool,
                    radius: values.radius,
                    strength: values.strength,
                    points: [[point.x, point.y]]
                };
                values.strokes.push(current);
            } else if (phase === "move" && current !== null) {
                current.points.push([point.x, point.y]);
                requestPreview(false);
            } else if (phase === "end") {
                current = null;
                requestPreview(true);
            }
            draw(point);
        });
        let draw = point => {
            editor.drawSource();
            if (point !== undefined) {
                editor.context.strokeStyle = "rgba(255,255,255,.9)";
                editor.context.beginPath();
                editor.context.arc(point.pixelX, point.pixelY,
                    values.radius * Math.min(editor.canvas.width, editor.canvas.height), 0, Math.PI * 2);
                editor.context.stroke();
            }
        };
        let reset = document.createElement("button");
        reset.type = "button";
        reset.textContent = "Reset all";
        reset.onclick = () => {
            values.strokes = [];
            draw();
            requestPreview(true);
        };
        toolbar.appendChild(reset);
        let clearMask = document.createElement("button");
        clearMask.type = "button";
        clearMask.textContent = "Clear mask";
        clearMask.onclick = () => {
            values.strokes.push({tool: "clearMask", points: []});
            requestPreview(true);
        };
        toolbar.appendChild(clearMask);
        draw();
    });
}

paintDotJs.registerPlugin({
    effects: [{
        id: "liquify",
        name: "Liquify",
        category: "Tools",
        icon: paintDotJs.asset("icon.png"),
        controls: [],
        configure,
        render({source, destination, width, height, values}) {
            let field = displacementFromStrokes(values.strokes, width, height);
            renderDisplacement(source, destination, width, height, (x, y) => {
                let index = (y * width + x) * 2;
                return [field[index], field[index + 1]];
            });
        }
    }]
});
