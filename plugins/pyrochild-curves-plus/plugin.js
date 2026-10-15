import {openEffectDialog, addSelect} from "../../lib/effect-dialog.js";

function tableFromPoints(points, curveMode) {
    let sorted = [...points].sort((left, right) => left[0] - right[0]);
    let table = new Uint8ClampedArray(256);
    for (let value = 0; value < 256; ++value) {
        let position = value / 255;
        let right = sorted.findIndex(point => point[0] >= position);
        if (right <= 0) {
            table[value] = sorted[0][1] * 255;
            continue;
        }
        let first = sorted[right - 1];
        let second = sorted[right];
        let amount = (position - first[0]) / Math.max(0.0001, second[0] - first[0]);
        let blend = curveMode === "linear" ? amount : amount * amount * (3 - 2 * amount);
        table[value] = (first[1] + (second[1] - first[1]) * blend) * 255;
    }
    return table;
}

function configure(context) {
    return openEffectDialog(context, ({values, content, requestPreview, sourceCanvas}) => {
        values.channel ||= "rgb";
        values.curveMode ||= "spline";
        values.points ||= [[0, 0], [1, 1]];
        values.points.sort((left, right) => left[0] - right[0]);
        let toolbar = document.createElement("div");
        toolbar.className = "plugin-effect-toolbar";
        content.appendChild(toolbar);
        addSelect(toolbar, values, "channel", "Channel", [
            ["rgb", "RGB"], ["luminosity", "Luminosity"], ["red", "Red"],
            ["green", "Green"], ["blue", "Blue"], ["hue", "Hue"],
            ["saturation", "Saturation"], ["value", "Value"], ["cyan", "Cyan"],
            ["magenta", "Magenta"], ["yellow", "Yellow"], ["black", "Black"],
            ["alpha", "Alpha"]
        ], () => requestPreview(true));
        addSelect(toolbar, values, "curveMode", "Curve", [
            ["spline", "Spline"], ["linear", "Linear"]
        ], () => requestPreview(true));

        let canvas = document.createElement("canvas");
        canvas.width = 420;
        canvas.height = 300;
        canvas.style.cssText = "display:block;max-width:100%;height:auto;background:#202020;border:1px solid #777;touch-action:none;cursor:crosshair";
        content.appendChild(canvas);
        let drawing = canvas.getContext("2d");
        let image = sourceCanvas().getContext("2d").getImageData(0, 0, context.width, context.height).data;
        let active = null;

        let draw = () => {
            drawing.clearRect(0, 0, canvas.width, canvas.height);
            drawing.strokeStyle = "#444";
            drawing.lineWidth = 1;
            for (let part = 1; part < 4; ++part) {
                drawing.beginPath();
                drawing.moveTo(part * canvas.width / 4, 0);
                drawing.lineTo(part * canvas.width / 4, canvas.height);
                drawing.moveTo(0, part * canvas.height / 4);
                drawing.lineTo(canvas.width, part * canvas.height / 4);
                drawing.stroke();
            }
            let histogram = new Uint32Array(256);
            for (let index = 0; index < image.length; index += 4) {
                let lightness = Math.round(image[index] * 0.299 + image[index + 1] * 0.587 + image[index + 2] * 0.114);
                ++histogram[lightness];
            }
            let maximum = Math.max(...histogram, 1);
            drawing.fillStyle = "rgba(190,190,190,.35)";
            for (let value = 0; value < 256; ++value) {
                let bar = Math.sqrt(histogram[value] / maximum) * canvas.height;
                drawing.fillRect(value / 255 * canvas.width, canvas.height - bar, 2, bar);
            }
            let points = [...values.points].sort((left, right) => left[0] - right[0]);
            drawing.strokeStyle = "#f6d94b";
            drawing.lineWidth = 2;
            drawing.beginPath();
            points.forEach((point, index) => {
                let x = point[0] * canvas.width;
                let y = (1 - point[1]) * canvas.height;
                if (index === 0) {
                    drawing.moveTo(x, y);
                } else {
                    drawing.lineTo(x, y);
                }
            });
            drawing.stroke();
            for (let point of values.points) {
                drawing.fillStyle = "#fff";
                drawing.beginPath();
                drawing.arc(point[0] * canvas.width, (1 - point[1]) * canvas.height, 5, 0, Math.PI * 2);
                drawing.fill();
            }
        };
        let position = event => {
            let bounds = canvas.getBoundingClientRect();
            return [
                Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
                1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
            ];
        };
        canvas.onpointerdown = event => {
            let point = position(event);
            active = values.points.find(candidate =>
                Math.hypot((candidate[0] - point[0]) * canvas.width,
                    (candidate[1] - point[1]) * canvas.height) < 12) || null;
            if (active === null) {
                values.points.push(point);
                active = point;
            }
            canvas.setPointerCapture(event.pointerId);
            draw();
            requestPreview(false);
        };
        canvas.onpointermove = event => {
            if (active === null) {
                return;
            }
            let point = position(event);
            if (active[0] === 0) {
                point[0] = 0;
            } else if (active[0] === 1) {
                point[0] = 1;
            }
            active[0] = point[0];
            active[1] = point[1];
            draw();
            requestPreview(false);
        };
        canvas.onpointerup = () => {
            values.points.sort((left, right) => left[0] - right[0]);
            active = null;
            requestPreview(true);
        };
        canvas.oncontextmenu = event => {
            event.preventDefault();
            let point = position(event);
            let index = values.points.findIndex(candidate => candidate[0] > 0 && candidate[0] < 1
                && Math.hypot((candidate[0] - point[0]) * canvas.width,
                    (candidate[1] - point[1]) * canvas.height) < 12);
            if (index >= 0) {
                values.points.splice(index, 1);
                draw();
                requestPreview(true);
            }
        };
        draw();
    });
}

paintDotJs.registerPlugin({
    effects: [{
        id: "curves-plus",
        name: "Curves+",
        menu: "Adjustments",
        category: "",
        icon: paintDotJs.asset("icon.png"),
        dialogTitle: "Curves+ by pyrochild",
        controls: [],
        configure,
        render({source, destination, values}) {
            let table = tableFromPoints(values.points, values.curveMode);
            for (let index = 0; index < source.length; index += 4) {
                destination[index] = source[index];
                destination[index + 1] = source[index + 1];
                destination[index + 2] = source[index + 2];
                destination[index + 3] = source[index + 3];
                if (values.channel === "rgb") {
                    destination[index] = table[source[index]];
                    destination[index + 1] = table[source[index + 1]];
                    destination[index + 2] = table[source[index + 2]];
                } else if (["red", "green", "blue", "alpha"].includes(values.channel)) {
                    let channel = {red: 0, green: 1, blue: 2, alpha: 3}[values.channel];
                    destination[index + channel] = table[source[index + channel]];
                } else if (["hue", "saturation", "value"].includes(values.channel)) {
                    let red = source[index] / 255;
                    let green = source[index + 1] / 255;
                    let blue = source[index + 2] / 255;
                    let maximum = Math.max(red, green, blue);
                    let minimum = Math.min(red, green, blue);
                    let delta = maximum - minimum;
                    let hue = 0;
                    if (delta !== 0) {
                        hue = maximum === red ? ((green - blue) / delta) % 6
                            : maximum === green ? (blue - red) / delta + 2
                                : (red - green) / delta + 4;
                        hue = ((hue / 6) + 1) % 1;
                    }
                    let saturation = maximum === 0 ? 0 : delta / maximum;
                    if (values.channel === "hue") {
                        hue = table[Math.round(hue * 255)] / 255;
                    } else if (values.channel === "saturation") {
                        saturation = table[Math.round(saturation * 255)] / 255;
                    } else {
                        maximum = table[Math.round(maximum * 255)] / 255;
                    }
                    let chroma = maximum * saturation;
                    let part = hue * 6;
                    let intermediate = chroma * (1 - Math.abs(part % 2 - 1));
                    let rgb = part < 1 ? [chroma, intermediate, 0]
                        : part < 2 ? [intermediate, chroma, 0]
                            : part < 3 ? [0, chroma, intermediate]
                                : part < 4 ? [0, intermediate, chroma]
                                    : part < 5 ? [intermediate, 0, chroma]
                                        : [chroma, 0, intermediate];
                    let match = maximum - chroma;
                    destination[index] = (rgb[0] + match) * 255;
                    destination[index + 1] = (rgb[1] + match) * 255;
                    destination[index + 2] = (rgb[2] + match) * 255;
                } else if (["cyan", "magenta", "yellow", "black"].includes(values.channel)) {
                    let red = source[index] / 255;
                    let green = source[index + 1] / 255;
                    let blue = source[index + 2] / 255;
                    let black = 1 - Math.max(red, green, blue);
                    let divisor = Math.max(0.0001, 1 - black);
                    let components = {
                        cyan: (1 - red - black) / divisor,
                        magenta: (1 - green - black) / divisor,
                        yellow: (1 - blue - black) / divisor,
                        black
                    };
                    components[values.channel] = table[Math.round(components[values.channel] * 255)] / 255;
                    destination[index] = (1 - components.cyan) * (1 - components.black) * 255;
                    destination[index + 1] = (1 - components.magenta) * (1 - components.black) * 255;
                    destination[index + 2] = (1 - components.yellow) * (1 - components.black) * 255;
                } else {
                    let oldLightness = source[index] * 0.299 + source[index + 1] * 0.587 + source[index + 2] * 0.114;
                    let newLightness = table[Math.round(oldLightness)];
                    let scale = oldLightness <= 0 ? 0 : newLightness / oldLightness;
                    destination[index] = source[index] * scale;
                    destination[index + 1] = source[index + 1] * scale;
                    destination[index + 2] = source[index + 2] * scale;
                }
            }
        }
    }]
});
