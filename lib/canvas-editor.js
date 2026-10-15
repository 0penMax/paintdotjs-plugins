export function createCanvasEditor(parent, sourceCanvas, onPointer) {
    let frame = document.createElement("div");
    frame.style.cssText = "position:relative;display:flex;justify-content:center;align-items:center;min-width:420px;min-height:320px;background:#222;overflow:hidden";
    parent.appendChild(frame);

    let canvas = document.createElement("canvas");
    let scale = Math.min(1, 640 / sourceCanvas.width, 460 / sourceCanvas.height);
    canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    canvas.style.cssText = "max-width:100%;touch-action:none;cursor:crosshair";
    frame.appendChild(canvas);

    let context = canvas.getContext("2d");
    let drawSource = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    };
    let point = event => {
        let bounds = canvas.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
            y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
            pixelX: (event.clientX - bounds.left) * canvas.width / bounds.width,
            pixelY: (event.clientY - bounds.top) * canvas.height / bounds.height
        };
    };
    let active = false;
    canvas.onpointerdown = event => {
        active = true;
        canvas.setPointerCapture(event.pointerId);
        onPointer("start", point(event), event);
    };
    canvas.onpointermove = event => {
        if (active) {
            onPointer("move", point(event), event);
        }
    };
    canvas.onpointerup = event => {
        if (active) {
            active = false;
            onPointer("end", point(event), event);
        }
    };
    canvas.onpointercancel = canvas.onpointerup;
    drawSource();
    return {frame, canvas, context, drawSource, scale};
}
