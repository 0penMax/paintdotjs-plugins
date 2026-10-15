const {range, checkbox, select, color} = paintDotJs.controls;

function dashPattern(name, width, spacing) {
    const space = Math.max(Number.EPSILON, spacing) * width;
    const patterns = {
        dotted: [1, space / width],
        dashed: [3, space / width],
        "dash-dot": [3, space / width, 1, space / width],
        "dash-dot-dot": [3, space / width, 1, space / width, 1, space / width],
        "dash-dash-dot": [3, space / width, 3, space / width, 1, space / width],
        "dash-dash-dot-dot": [3, space / width, 3, space / width, 1, space / width, 1, space / width]
    };
    return (patterns[name] || []).map(value => value * width);
}

function lineCap(value) {
    if (value === "round" || value === "round-anchor") {
        return "round";
    }
    if (value === "square" || value === "square-anchor") {
        return "square";
    }
    return "butt";
}

paintDotJs.registerPlugin({
    effects: [{
        id: "borders-n-shapes",
        name: "Borders N' Shapes",
        category: "Render",
        icon: paintDotJs.asset("icon.png"),
        controls: [
            select("shape", "Shape", "rectangle", [
                ["rectangle", "Rectangle"], ["ellipse", "Ellipse"],
                ["arc", "Arc"], ["pie", "Pie"]
            ]),
            range("width", "Width", 1, 100, 2),
            color("color", "Color", "#000000"),
            checkbox("anti_alias", "Anti-alias", true),
            select("pattern", "Pattern", "solid", [
                ["solid", "Solid"], ["dotted", "Dotted"], ["dashed", "Dashed"],
                ["dash-dot", "Dash Dot"], ["dash-dot-dot", "Dash Dot Dot"],
                ["dash-dash-dot", "Dash Dash Dot"],
                ["dash-dash-dot-dot", "Dash Dash Dot Dot"]
            ]),
            select("dash_caps", "Pattern caps", "flat", [
                ["flat", "Flat"], ["round", "Round"], ["triangle", "Triangle"]
            ]),
            range("spacing", "Spacing", 0, 10, 1, 0.1),
            range("start_sweep", "Sweep start", 0, 360, 0, 1),
            range("end_sweep", "Sweep end", 0, 360, 90, 1),
            select("end_caps", "Line caps", "none", [
                ["none", "No Anchor"], ["flat", "Flat"], ["round", "Round"],
                ["triangle", "Triangle"], ["square-anchor", "Square Anchor"],
                ["round-anchor", "Round Anchor"], ["diamond", "Diamond Anchor"],
                ["arrow", "Arrow Anchor"]
            ])
        ],

        render({source, destination, width, height, values, selectionBounds}) {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            context.putImageData(new ImageData(new Uint8ClampedArray(source), width, height), 0, 0);

            const bounds = selectionBounds;
            const inset = values.width / 2
                + (["square-anchor", "round-anchor", "diamond", "arrow"].includes(values.end_caps)
                    ? values.width / 2 : 0);
            const left = bounds.x + inset;
            const top = bounds.y + inset;
            const drawWidth = Math.max(0, bounds.width - inset * 2);
            const drawHeight = Math.max(0, bounds.height - inset * 2);
            const centerX = left + drawWidth / 2;
            const centerY = top + drawHeight / 2;

            context.save();
            context.beginPath();
            context.rect(bounds.x, bounds.y, bounds.width, bounds.height);
            context.clip();
            context.strokeStyle = values.color;
            context.lineWidth = values.width;
            context.lineJoin = "miter";
            context.lineCap = lineCap(values.shape === "arc" ? values.end_caps : values.dash_caps);
            context.setLineDash(dashPattern(values.pattern, values.width, values.spacing));
            context.beginPath();

            let start = Math.min(values.start_sweep, values.end_sweep) * Math.PI / 180;
            let end = Math.max(values.start_sweep, values.end_sweep) * Math.PI / 180;
            if (values.shape === "rectangle") {
                context.rect(left, top, drawWidth, drawHeight);
            } else if (values.shape === "ellipse") {
                context.ellipse(centerX, centerY, drawWidth / 2, drawHeight / 2, 0, 0, Math.PI * 2);
            } else if (values.shape === "pie") {
                context.moveTo(centerX, centerY);
                context.ellipse(centerX, centerY, drawWidth / 2, drawHeight / 2, 0, -start, -end, true);
                context.closePath();
            } else {
                context.ellipse(centerX, centerY, drawWidth / 2, drawHeight / 2, 0, -start, -end, true);
            }
            context.stroke();
            context.restore();
            destination.set(context.getImageData(0, 0, width, height).data);
        }
    }]
});
