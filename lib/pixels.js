export function parseColor(value, alpha = 255) {
    const integer = Number.parseInt(String(value).replace("#", ""), 16);
    return [(integer >> 16) & 255, (integer >> 8) & 255, integer & 255, alpha];
}

export function interpolateColor(first, second, amount, gammaAdjusted = false) {
    const factor = Math.max(0, Math.min(1, amount));
    const result = new Array(4);
    for (let channel = 0; channel < 3; ++channel) {
        if (gammaAdjusted) {
            const start = Math.pow(first[channel] / 255, 2.2);
            const end = Math.pow(second[channel] / 255, 2.2);
            result[channel] = Math.pow(start + (end - start) * factor, 1 / 2.2) * 255;
        } else {
            result[channel] = first[channel] + (second[channel] - first[channel]) * factor;
        }
    }
    result[3] = first[3] + (second[3] - first[3]) * factor;
    return result;
}

export function compositeOver(destination, offset, source) {
    const sourceAlpha = source[3] / 255;
    const destinationAlpha = destination[offset + 3] / 255;
    const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
    if (outputAlpha <= 0) {
        destination.fill(0, offset, offset + 4);
        return;
    }
    for (let channel = 0; channel < 3; ++channel) {
        destination[offset + channel] = (
            source[channel] * sourceAlpha
            + destination[offset + channel] * destinationAlpha * (1 - sourceAlpha)
        ) / outputAlpha;
    }
    destination[offset + 3] = outputAlpha * 255;
}

export function sample(source, width, height, x, y, bilinear = true) {
    if (!bilinear) {
        const nearestX = Math.round(x);
        const nearestY = Math.round(y);
        if (nearestX < 0 || nearestY < 0 || nearestX >= width || nearestY >= height) {
            return [0, 0, 0, 0];
        }
        const offset = (nearestY * width + nearestX) * 4;
        return Array.from(source.subarray(offset, offset + 4));
    }

    const left = Math.floor(x);
    const top = Math.floor(y);
    const fractionX = x - left;
    const fractionY = y - top;
    const result = [0, 0, 0, 0];
    for (let row = 0; row < 2; ++row) {
        for (let column = 0; column < 2; ++column) {
            const sampleX = left + column;
            const sampleY = top + row;
            if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) {
                continue;
            }
            const weight = (column ? fractionX : 1 - fractionX)
                * (row ? fractionY : 1 - fractionY);
            const offset = (sampleY * width + sampleX) * 4;
            for (let channel = 0; channel < 4; ++channel) {
                result[channel] += source[offset + channel] * weight;
            }
        }
    }
    return result;
}

export function createRandom(seed) {
    let state = (Number(seed) >>> 0) || 1;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}
