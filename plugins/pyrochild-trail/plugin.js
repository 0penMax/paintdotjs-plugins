import {compositeOver, sample} from "../../lib/pixels.js";

const {range, checkbox} = paintDotJs.controls;

paintDotJs.registerPlugin({
    workerSafe: true,
    effects: [{
        id: "trail",
        name: "Trail",
        category: "Object",
        icon: paintDotJs.asset("icon.png"),
        controls: [
            range("distance", "Distance", 1, 500, 25),
            range("direction", "Direction", 0, 360, 0, 1),
            range("spacing", "Spacing", 1, 100, 1),
            checkbox("fade", "Fade out", true),
            checkbox("bilinear", "High quality", true)
        ],

        render({source, destination, width, height, values}) {
            destination.set(source);
            const radians = values.direction * Math.PI / 180;
            const horizontal = Math.cos(radians);
            const vertical = Math.sin(radians);

            for (let distance = values.spacing; distance <= values.distance; distance += values.spacing) {
                const opacity = values.fade ? 1 - distance / values.distance : 1;
                for (let y = 0; y < height; ++y) {
                    for (let x = 0; x < width; ++x) {
                        const color = sample(
                            source,
                            width,
                            height,
                            x - distance * horizontal,
                            y + distance * vertical,
                            values.bilinear
                        );
                        color[3] *= opacity;
                        compositeOver(destination, (y * width + x) * 4, color);
                    }
                }
            }
        }
    }]
});
