import {openEffectDialog, addRange, addCheckbox, addSelect} from "../../lib/effect-dialog.js";
import {parseColor, interpolateColor} from "../../lib/pixels.js";

function configure(context) {
    return openEffectDialog(context, ({values, content, requestPreview}) => {
        values.stops ||= [{position: 0, color: "#000000"}, {position: 1, color: "#ffffff"}];
        values.channel ||= "l";
        values.offset ??= 0;
        values.wrap ??= true;
        values.preserveAlpha ??= false;

        let gradient = document.createElement("div");
        gradient.style.cssText = "height:42px;border:1px solid #777;margin-bottom:8px";
        content.appendChild(gradient);
        let stops = document.createElement("div");
        stops.style.cssText = "display:grid;gap:5px;margin-bottom:10px";
        content.appendChild(stops);
        let draw = () => {
            let ordered = [...values.stops].sort((left, right) => left.position - right.position);
            gradient.style.background = `linear-gradient(to right, ${ordered.map(stop =>
                `${stop.color} ${stop.position * 100}%`).join(",")})`;
            stops.replaceChildren();
            ordered.forEach(stop => {
                let row = document.createElement("div");
                row.style.cssText = "display:grid;grid-template-columns:1fr 80px 32px;gap:6px";
                stops.appendChild(row);
                let color = document.createElement("input");
                color.type = "color";
                color.value = stop.color;
                color.oninput = () => {
                    stop.color = color.value;
                    draw();
                    requestPreview(false);
                };
                row.appendChild(color);
                let position = document.createElement("input");
                position.type = "number";
                position.min = 0;
                position.max = 100;
                position.value = Math.round(stop.position * 100);
                position.onchange = () => {
                    stop.position = Math.max(0, Math.min(1, Number(position.value) / 100));
                    draw();
                    requestPreview(true);
                };
                row.appendChild(position);
                let remove = document.createElement("button");
                remove.type = "button";
                remove.textContent = "−";
                remove.disabled = values.stops.length <= 2;
                remove.onclick = () => {
                    values.stops.splice(values.stops.indexOf(stop), 1);
                    draw();
                    requestPreview(true);
                };
                row.appendChild(remove);
            });
        };
        let add = document.createElement("button");
        add.type = "button";
        add.textContent = "Add color stop";
        add.onclick = () => {
            values.stops.push({position: 0.5, color: "#808080"});
            draw();
            requestPreview(true);
        };
        content.appendChild(add);
        addSelect(content, values, "channel", "Input channel", [
            ["l", "Luminosity"], ["r", "Red"], ["g", "Green"], ["b", "Blue"],
            ["a", "Alpha"], ["h", "Hue"], ["s", "Saturation"], ["v", "Value"],
            ["c", "Cyan"], ["m", "Magenta"], ["y", "Yellow"], ["k", "Black"]
        ], () => requestPreview(true));
        addRange(content, values, "offset", "Offset", -255, 255, 1, requestPreview);
        addCheckbox(content, values, "wrap", "Wrap offset", requestPreview);
        addCheckbox(content, values, "preserveAlpha", "Preserve alpha", requestPreview);
        draw();
    });
}

function inputValue(red, green, blue, alpha, channel) {
    let maximum = Math.max(red, green, blue);
    let minimum = Math.min(red, green, blue);
    let delta = maximum - minimum;
    if (channel === "r" || channel === "g" || channel === "b" || channel === "a") {
        return {r: red, g: green, b: blue, a: alpha}[channel];
    }
    if (channel === "c" || channel === "m" || channel === "y" || channel === "k") {
        return {c: maximum - red, m: maximum - green, y: maximum - blue, k: 255 - maximum}[channel];
    }
    if (channel === "s") {
        return maximum === 0 ? 0 : 255 * delta / maximum;
    }
    if (channel === "v") {
        return maximum;
    }
    if (channel === "h") {
        if (delta === 0) {
            return 0;
        }
        let hue = maximum === red ? (green - blue) / delta
            : maximum === green ? 2 + (blue - red) / delta : 4 + (red - green) / delta;
        return ((hue / 6 + 1) % 1) * 255;
    }
    return red * 0.299 + green * 0.587 + blue * 0.114;
}

function gradientColor(stops, position) {
    let ordered = [...stops].sort((left, right) => left.position - right.position);
    if (position <= ordered[0].position) {
        return parseColor(ordered[0].color);
    }
    for (let index = 1; index < ordered.length; ++index) {
        if (position <= ordered[index].position) {
            let left = ordered[index - 1];
            let right = ordered[index];
            return interpolateColor(parseColor(left.color), parseColor(right.color),
                (position - left.position) / Math.max(0.0001, right.position - left.position));
        }
    }
    return parseColor(ordered[ordered.length - 1].color);
}

paintDotJs.registerPlugin({
    effects: [{
        id: "gradient-mapping",
        name: "Gradient Mapping",
        menu: "Adjustments",
        category: "",
        icon: paintDotJs.asset("icon.png"),
        controls: [],
        configure,
        render({source, destination, values}) {
            for (let index = 0; index < source.length; index += 4) {
                let value = inputValue(source[index], source[index + 1], source[index + 2],
                    source[index + 3], values.channel) + values.offset;
                value = values.wrap ? ((value % 256) + 256) % 256 : Math.max(0, Math.min(255, value));
                let color = gradientColor(values.stops, value / 255);
                destination[index] = color[0];
                destination[index + 1] = color[1];
                destination[index + 2] = color[2];
                destination[index + 3] = values.preserveAlpha ? source[index + 3] : color[3];
            }
        }
    }]
});
