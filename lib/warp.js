import {sample} from "./pixels.js";

export function renderDisplacement(source, destination, width, height, displacement, bilinear = true) {
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            let offset = displacement(x, y);
            let color = sample(source, width, height, x - offset[0], y - offset[1], bilinear);
            let index = (y * width + x) * 4;
            destination[index] = color[0];
            destination[index + 1] = color[1];
            destination[index + 2] = color[2];
            destination[index + 3] = color[3];
        }
    }
}

export function displacementFromStrokes(strokes, width, height) {
    let field = new Float32Array(width * height * 2);
    let frozen = new Float32Array(width * height);
    for (let stroke of strokes || []) {
        if (stroke.tool === "clearMask") {
            frozen.fill(0);
            continue;
        }
        let radius = Math.max(1, stroke.radius * Math.min(width, height));
        let strength = stroke.strength ?? 0.5;
        let points = stroke.points || [];
        for (let pointIndex = 1; pointIndex < points.length; ++pointIndex) {
            let previous = points[pointIndex - 1];
            let current = points[pointIndex];
            let previousX = previous[0] * width;
            let previousY = previous[1] * height;
            let currentX = current[0] * width;
            let currentY = current[1] * height;
            let dx = currentX - previousX;
            let dy = currentY - previousY;
            let distance = Math.hypot(dx, dy);
            let steps = Math.max(1, Math.ceil(distance / Math.max(1, radius / 4)));
            for (let step = 1; step <= steps; ++step) {
                let amount = step / steps;
                let centerX = previousX + dx * amount;
                let centerY = previousY + dy * amount;
                if (stroke.tool === "freeze" || stroke.tool === "thaw") {
                    applyMask(frozen, width, height, centerX, centerY, radius,
                        strength, stroke.tool === "freeze");
                } else {
                    applyBrush(field, frozen, width, height, centerX, centerY,
                        radius, strength, stroke.tool || "push", dx / steps, dy / steps);
                }
            }
        }
    }
    return field;
}

function applyMask(mask, width, height, centerX, centerY, radius, strength, freeze) {
    let minimumX = Math.max(0, Math.floor(centerX - radius));
    let maximumX = Math.min(width - 1, Math.ceil(centerX + radius));
    let minimumY = Math.max(0, Math.floor(centerY - radius));
    let maximumY = Math.min(height - 1, Math.ceil(centerY + radius));
    for (let y = minimumY; y <= maximumY; ++y) {
        for (let x = minimumX; x <= maximumX; ++x) {
            let distance = Math.hypot(x - centerX, y - centerY);
            if (distance > radius) {
                continue;
            }
            let amount = (1 - distance / radius) * strength;
            let index = y * width + x;
            mask[index] = freeze ? Math.max(mask[index], amount) : Math.max(0, mask[index] - amount);
        }
    }
}

function applyBrush(field, frozen, width, height, centerX, centerY, radius, strength, tool, moveX, moveY) {
    let minimumX = Math.max(0, Math.floor(centerX - radius));
    let maximumX = Math.min(width - 1, Math.ceil(centerX + radius));
    let minimumY = Math.max(0, Math.floor(centerY - radius));
    let maximumY = Math.min(height - 1, Math.ceil(centerY + radius));
    for (let y = minimumY; y <= maximumY; ++y) {
        for (let x = minimumX; x <= maximumX; ++x) {
            let relativeX = x - centerX;
            let relativeY = y - centerY;
            let distance = Math.hypot(relativeX, relativeY);
            if (distance > radius) {
                continue;
            }
            let pixel = y * width + x;
            let falloff = (1 - distance / radius) * strength * (1 - frozen[pixel]);
            let index = pixel * 2;
            if (tool === "push") {
                field[index] += moveX * falloff;
                field[index + 1] += moveY * falloff;
            } else if (tool === "bloat" || tool === "pucker") {
                let sign = tool === "bloat" ? 1 : -1;
                field[index] += relativeX / radius * falloff * sign * 3;
                field[index + 1] += relativeY / radius * falloff * sign * 3;
            } else if (tool === "twistLeft" || tool === "twistRight") {
                let sign = tool === "twistLeft" ? -1 : 1;
                field[index] += -relativeY / radius * falloff * sign * 3;
                field[index + 1] += relativeX / radius * falloff * sign * 3;
            } else if (tool === "reconstruct") {
                field[index] *= 1 - falloff;
                field[index + 1] *= 1 - falloff;
            }
        }
    }
}

export function gridDisplacement(values, width, height) {
    let columns = values.columns;
    let rows = values.rows;
    let points = values.points;
    return (x, y) => {
        let gridX = Math.min(columns - 1, Math.max(0, x / Math.max(1, width - 1) * (columns - 1)));
        let gridY = Math.min(rows - 1, Math.max(0, y / Math.max(1, height - 1) * (rows - 1)));
        let left = Math.min(columns - 2, Math.floor(gridX));
        let top = Math.min(rows - 2, Math.floor(gridY));
        let amountX = gridX - left;
        let amountY = gridY - top;
        let topLeft = points[top * columns + left] || [0, 0];
        let topRight = points[top * columns + left + 1] || [0, 0];
        let bottomLeft = points[(top + 1) * columns + left] || [0, 0];
        let bottomRight = points[(top + 1) * columns + left + 1] || [0, 0];
        let dx = (topLeft[0] * (1 - amountX) + topRight[0] * amountX) * (1 - amountY)
            + (bottomLeft[0] * (1 - amountX) + bottomRight[0] * amountX) * amountY;
        let dy = (topLeft[1] * (1 - amountX) + topRight[1] * amountX) * (1 - amountY)
            + (bottomLeft[1] * (1 - amountX) + bottomRight[1] * amountX) * amountY;
        return [dx * width, dy * height];
    };
}
