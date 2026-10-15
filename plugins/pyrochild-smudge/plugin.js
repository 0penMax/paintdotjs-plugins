import {openEffectDialog, addRange} from "../../lib/effect-dialog.js";
import {createCanvasEditor} from "../../lib/canvas-editor.js";

function configure(context) {
    return openEffectDialog(context, ({values, content, requestPreview, sourceCanvas}) => {
        values.size ??= 0.06;
        values.pressure ??= 0.65;
        values.strokes ||= [];
        let toolbar = document.createElement("div");
        toolbar.className = "plugin-effect-toolbar plugin-effect-toolbar-three";
        content.appendChild(toolbar);
        addRange(toolbar, values, "size", "Brush size", 0.005, 0.25, 0.005, () => {});
        addRange(toolbar, values, "pressure", "Pressure", 0.05, 1, 0.05, () => {});
        let current = null;
        let editor = createCanvasEditor(content, sourceCanvas(), (phase, point) => {
            if (phase === "start") {
                current = {size: values.size, pressure: values.pressure, points: [[point.x, point.y]]};
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
                editor.context.strokeStyle = "white";
                editor.context.beginPath();
                editor.context.arc(point.pixelX, point.pixelY,
                    values.size * Math.min(editor.canvas.width, editor.canvas.height), 0, Math.PI * 2);
                editor.context.stroke();
            }
        };
        let reset = document.createElement("button");
        reset.type = "button";
        reset.textContent = "Reset";
        reset.onclick = () => {
            values.strokes = [];
            draw();
            requestPreview(true);
        };
        toolbar.appendChild(reset);
        draw();
    });
}

function smudgeStroke(destination, width, height, stroke) {
    let radius = Math.max(1, stroke.size * Math.min(width, height));
    let points = stroke.points || [];
    if (points.length === 0) {
        return;
    }
    let firstX = Math.round(points[0][0] * width);
    let firstY = Math.round(points[0][1] * height);
    let firstIndex = (Math.max(0, Math.min(height - 1, firstY)) * width
        + Math.max(0, Math.min(width - 1, firstX))) * 4;
    let carried = Array.from(destination.subarray(firstIndex, firstIndex + 4));
    for (let pointIndex = 1; pointIndex < points.length; ++pointIndex) {
        let previous = points[pointIndex - 1];
        let current = points[pointIndex];
        let startX = previous[0] * width;
        let startY = previous[1] * height;
        let dx = current[0] * width - startX;
        let dy = current[1] * height - startY;
        let steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(1, radius / 3)));
        for (let step = 1; step <= steps; ++step) {
            let centerX = startX + dx * step / steps;
            let centerY = startY + dy * step / steps;
            let minimumX = Math.max(0, Math.floor(centerX - radius));
            let maximumX = Math.min(width - 1, Math.ceil(centerX + radius));
            let minimumY = Math.max(0, Math.floor(centerY - radius));
            let maximumY = Math.min(height - 1, Math.ceil(centerY + radius));
            let sampled = [0, 0, 0, 0];
            let sampleWeight = 0;
            for (let y = minimumY; y <= maximumY; ++y) {
                for (let x = minimumX; x <= maximumX; ++x) {
                    let distance = Math.hypot(x - centerX, y - centerY);
                    if (distance > radius) {
                        continue;
                    }
                    let weight = (1 - distance / radius) * stroke.pressure;
                    let index = (y * width + x) * 4;
                    for (let channel = 0; channel < 4; ++channel) {
                        sampled[channel] += destination[index + channel] * weight;
                        destination[index + channel] += (carried[channel] - destination[index + channel]) * weight;
                    }
                    sampleWeight += weight;
                }
            }
            if (sampleWeight > 0) {
                for (let channel = 0; channel < 4; ++channel) {
                    carried[channel] = sampled[channel] / sampleWeight;
                }
            }
        }
    }
}

paintDotJs.registerPlugin({
    effects: [{
        id: "smudge",
        name: "Smudge",
        category: "Tools",
        icon: paintDotJs.asset("icon.png"),
        controls: [],
        configure,
        render({source, destination, width, height, values}) {
            destination.set(source);
            for (let stroke of values.strokes || []) {
                smudgeStroke(destination, width, height, stroke);
            }
        }
    }]
});
