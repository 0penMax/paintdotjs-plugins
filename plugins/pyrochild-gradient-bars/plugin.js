import {createRandom, interpolateColor, parseColor} from "../../lib/pixels.js";

const {range, checkbox, select, color} = paintDotJs.controls;

function blendFactor(values, lengths, maximumDistance, distance, barIndex) {
    const period = values.width + values.spacing;
    const wrapLength = Math.max(period, Math.floor(lengths.length / 2 / period) * period);
    let index = barIndex;
    while (index < 0) {
        index += wrapLength;
    }
    index %= lengths.length;
    const barLength = maximumDistance * lengths[index];
    let adjusted = distance - values.alignment * (maximumDistance - barLength);
    if (barLength <= 0) {
        return adjusted > 0 ? 1 : 0;
    }

    if (values.repetition === "repeat") {
        adjusted = ((adjusted % barLength) + barLength) % barLength;
        let factor = adjusted / barLength;
        if (values.antiAlias) {
            const edge = barLength - adjusted;
            if (edge > 0 && edge < 1) {
                factor = edge;
            }
        }
        return factor;
    }
    if (values.repetition === "mirror") {
        let factor = Math.abs(adjusted / barLength) % 2;
        return factor > 1 ? 2 - factor : factor;
    }
    return Math.max(0, Math.min(1, adjusted / barLength));
}

paintDotJs.registerPlugin({
    workerSafe: true,
    effects: [{
        id: "gradient-bars",
        name: "Gradient Bars",
        category: "Render",
        icon: paintDotJs.asset("icon.png"),
        controls: [
            color("color1", "First color", "#000000"),
            range("alpha1", "First color alpha", 0, 255, 255),
            color("color2", "Second color", "#ffffff"),
            range("alpha2", "Second color alpha", 0, 255, 255),
            checkbox("gammaAdjusted", "Gamma-adjusted color blend", false),
            range("width", "Bar width", 1, 100, 1),
            range("spacing", "Spacing", 0, 100, 0),
            range("angle", "Angle", 0, 360, 90, 1),
            range("skew", "Skew", -45, 45, 0, 0.1),
            range("scale", "Scale", 0.01, 10, 1, 0.01),
            range("alignment", "Alignment", 0, 1, 0, 0.01),
            select("repetition", "Repetition", "none", [
                ["none", "None"], ["repeat", "Repeat"], ["mirror", "Mirror"]
            ]),
            checkbox("antiAlias", "Anti-alias", true),
            range("seed", "Seed", 0, 255, 0)
        ],

        render({destination, width, height, values, selectionBounds}) {
            const first = parseColor(values.color1, values.alpha1);
            const second = parseColor(values.color2, values.alpha2);
            const bounds = selectionBounds;
            const angle = values.angle * Math.PI / 180;
            const skew = values.skew * Math.PI / 180;
            const sine = Math.sin(angle);
            const cosine = Math.cos(angle);
            const maximumDistance = Math.min(
                Math.abs(bounds.width / cosine),
                Math.abs(bounds.height / sine)
            );
            const lengths = new Float64Array(Math.max(bounds.width, bounds.height) * 2 + 1);
            const random = createRandom(values.seed + 1);
            const period = values.width + values.spacing;
            for (let index = 0; index < lengths.length; index += period) {
                const length = random() * values.scale;
                for (let offset = 0; offset < values.width && index + offset < lengths.length; ++offset) {
                    lengths[index + offset] = length;
                }
            }

            let quadrant = 4;
            if (angle < Math.PI / 2) {
                quadrant = 1;
            } else if (angle < Math.PI) {
                quadrant = 2;
            } else if (angle < Math.PI * 1.5) {
                quadrant = 3;
            }

            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    let distance;
                    if (quadrant === 1) {
                        distance = (bounds.height - y + bounds.y) * sine + (x - bounds.x) * cosine;
                    } else if (quadrant === 2) {
                        distance = (bounds.height - y + bounds.y) * sine
                            - (bounds.width - x + bounds.x) * cosine;
                    } else if (quadrant === 3) {
                        distance = (bounds.y - y) * sine
                            - (bounds.width - x + bounds.x) * cosine;
                    } else {
                        distance = (bounds.y - y) * sine + (x - bounds.x) * cosine;
                    }
                    const bar = (x - bounds.x) * Math.sin(angle + skew)
                        + (y - bounds.y) * Math.cos(angle + skew);
                    let factor;
                    if (values.antiAlias) {
                        const lower = blendFactor(values, lengths, maximumDistance, distance, Math.floor(bar));
                        const upper = blendFactor(values, lengths, maximumDistance, distance, Math.ceil(bar));
                        const fraction = bar - Math.floor(bar);
                        factor = lower * (1 - fraction) + upper * fraction;
                    } else {
                        factor = blendFactor(values, lengths, maximumDistance, distance, Math.floor(bar + 0.5));
                    }
                    const output = interpolateColor(first, second, factor, values.gammaAdjusted);
                    const pixel = (y * width + x) * 4;
                    for (let channel = 0; channel < 4; ++channel) {
                        destination[pixel + channel] = output[channel];
                    }
                }
            }
        }
    }]
});
