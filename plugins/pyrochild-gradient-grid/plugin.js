import {interpolateColor, parseColor} from "../../lib/pixels.js";

const {range, checkbox, select, color} = paintDotJs.controls;

paintDotJs.registerPlugin({
    workerSafe: true,
    effects: [{
        id: "gradient-grid",
        name: "Gradient Grid",
        category: "Render",
        icon: paintDotJs.asset("icon.png"),
        controls: [
            range("size", "Size", 2, 1000, 100),
            select("type", "Gradient type", "radial", [
                ["radial", "Radial"],
                ["diagonal1", "Diagonal 1"],
                ["diagonal2", "Diagonal 2"],
                ["conical", "Conical"],
                ["square", "Square"],
                ["horizontal", "Horizontal"],
                ["vertical", "Vertical"]
            ]),
            range("start", "Range start", 0, 1, 0, 0.01),
            range("end", "Range end", 0, 1, 1, 0.01),
            checkbox("reflected", "Reflected", false),
            color("color1", "First color", "#000000"),
            color("color2", "Second color", "#ffffff"),
            range("alpha1", "First color alpha", 0, 255, 255),
            range("alpha2", "Second color alpha", 0, 255, 255),
            checkbox("gamma_adjusted", "Gamma-adjusted color blend", false),
            range("offset_x", "Horizontal offset", -1, 1, 0, 0.01),
            range("offset_y", "Vertical offset", -1, 1, 0, 0.01),
            checkbox("lines", "Lines", false),
            color("line_color", "Line color", "#000000")
        ],

        render({destination, width, height, values}) {
            const first = parseColor(values.color1, values.alpha1);
            const second = parseColor(values.color2, values.alpha2);
            const line = parseColor(values.line_color);
            const size = values.size;
            const radius = Math.hypot(size / 2, size / 2);
            const offsetX = Math.trunc(values.offset_x * size);
            const offsetY = Math.trunc(values.offset_y * size);

            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    let cellX = x % size;
                    let cellY = y % size;
                    let output;
                    if (values.lines && (cellX === 0 || cellY === 0)) {
                        output = line;
                    } else {
                        cellX -= offsetX;
                        cellY -= offsetY;
                        const centerX = x - Math.trunc(x / size) * size - size / 2 - offsetX;
                        const centerY = y - Math.trunc(y / size) * size - size / 2 - offsetY;
                        let amount;
                        switch (values.type) {
                            case "horizontal": amount = cellX / size; break;
                            case "vertical": amount = cellY / size; break;
                            case "diagonal1": amount = (cellX + cellY) / size / 2; break;
                            case "diagonal2": amount = (cellX - cellY + size) / size / 2; break;
                            case "conical": amount = Math.atan2(Math.abs(centerY), centerX) / Math.PI; break;
                            case "square":
                                amount = 1 - 2 * Math.min(
                                    1 - Math.max(cellX, cellY) / size,
                                    Math.min(cellX, cellY) / size
                                );
                                break;
                            default: amount = Math.hypot(centerX, centerY) / radius;
                        }
                        amount = values.start === values.end
                            ? (amount < values.start ? 0 : 1)
                            : (amount - values.start) / (values.end - values.start);
                        amount = Math.max(0, Math.min(1, amount));
                        if (values.reflected) {
                            amount = Math.abs(1 - 2 * amount);
                        }
                        output = interpolateColor(first, second, amount, values.gamma_adjusted);
                    }
                    const offset = (y * width + x) * 4;
                    for (let channel = 0; channel < 4; ++channel) {
                        destination[offset + channel] = output[channel];
                    }
                }
            }
        }
    }]
});
