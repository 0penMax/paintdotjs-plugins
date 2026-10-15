import {openEffectDialog, addSelect} from "../../lib/effect-dialog.js";
import {createCanvasEditor} from "../../lib/canvas-editor.js";
import {gridDisplacement, renderDisplacement} from "../../lib/warp.js";

function resetGrid(values, size = 5) {
    values.columns = size;
    values.rows = size;
    values.points = Array.from({length: size * size}, () => [0, 0]);
}

function configure(context) {
    return openEffectDialog(context, ({values, content, requestPreview, sourceCanvas}) => {
        if (!Array.isArray(values.points)) {
            resetGrid(values);
        }
        let toolbar = document.createElement("div");
        toolbar.className = "plugin-effect-toolbar";
        content.appendChild(toolbar);
        values.gridSize ||= String(values.columns);
        addSelect(toolbar, values, "gridSize", "Grid", [
            ["3", "3 × 3"], ["5", "5 × 5"], ["7", "7 × 7"], ["9", "9 × 9"]
        ], () => {
            resetGrid(values, Number(values.gridSize));
            draw();
            requestPreview(true);
        });
        let reset = document.createElement("button");
        reset.type = "button";
        reset.textContent = "Reset";
        reset.onclick = () => {
            resetGrid(values, values.columns);
            draw();
            requestPreview(true);
        };
        toolbar.appendChild(reset);

        let active = -1;
        let editor = createCanvasEditor(content, sourceCanvas(), (phase, point) => {
            if (phase === "start") {
                let closestDistance = Infinity;
                values.points.forEach((offset, index) => {
                    let column = index % values.columns;
                    let row = Math.floor(index / values.columns);
                    let x = column / (values.columns - 1) + offset[0];
                    let y = row / (values.rows - 1) + offset[1];
                    let distance = Math.hypot((x - point.x) * editor.canvas.width,
                        (y - point.y) * editor.canvas.height);
                    if (distance < closestDistance && distance < 18) {
                        active = index;
                        closestDistance = distance;
                    }
                });
            }
            if (active >= 0 && phase !== "end") {
                let column = active % values.columns;
                let row = Math.floor(active / values.columns);
                values.points[active] = [
                    point.x - column / (values.columns - 1),
                    point.y - row / (values.rows - 1)
                ];
                draw();
                requestPreview(false);
            }
            if (phase === "end") {
                active = -1;
                requestPreview(true);
            }
        });
        let draw = () => {
            editor.drawSource();
            let drawing = editor.context;
            drawing.strokeStyle = "rgba(80,190,255,.9)";
            drawing.fillStyle = "#fff";
            drawing.lineWidth = 1;
            for (let row = 0; row < values.rows; ++row) {
                drawing.beginPath();
                for (let column = 0; column < values.columns; ++column) {
                    let offset = values.points[row * values.columns + column];
                    let x = (column / (values.columns - 1) + offset[0]) * editor.canvas.width;
                    let y = (row / (values.rows - 1) + offset[1]) * editor.canvas.height;
                    if (column === 0) {
                        drawing.moveTo(x, y);
                    } else {
                        drawing.lineTo(x, y);
                    }
                }
                drawing.stroke();
            }
            for (let column = 0; column < values.columns; ++column) {
                drawing.beginPath();
                for (let row = 0; row < values.rows; ++row) {
                    let offset = values.points[row * values.columns + column];
                    let x = (column / (values.columns - 1) + offset[0]) * editor.canvas.width;
                    let y = (row / (values.rows - 1) + offset[1]) * editor.canvas.height;
                    if (row === 0) {
                        drawing.moveTo(x, y);
                    } else {
                        drawing.lineTo(x, y);
                    }
                }
                drawing.stroke();
            }
            values.points.forEach((offset, index) => {
                let x = (index % values.columns / (values.columns - 1) + offset[0]) * editor.canvas.width;
                let y = (Math.floor(index / values.columns) / (values.rows - 1) + offset[1]) * editor.canvas.height;
                drawing.beginPath();
                drawing.arc(x, y, 4, 0, Math.PI * 2);
                drawing.fill();
            });
        };
        draw();
    });
}

paintDotJs.registerPlugin({
    effects: [{
        id: "grid-warp",
        name: "Grid Warp",
        category: "Tools",
        icon: paintDotJs.asset("icon.png"),
        controls: [],
        configure,
        render({source, destination, width, height, values}) {
            renderDisplacement(source, destination, width, height,
                gridDisplacement(values, width, height));
        }
    }]
});
