function clone(value) {
    return typeof structuredClone === "function"
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value));
}

export function sourceCanvas(context) {
    const canvas = document.createElement("canvas");
    canvas.width = context.width;
    canvas.height = context.height;
    canvas.getContext("2d").putImageData(
        new ImageData(new Uint8ClampedArray(context.source), context.width, context.height),
        0,
        0
    );
    return canvas;
}

export function openEffectDialog(context, build) {
    return new Promise(resolve => {
        const values = clone(context.values || {});
        const backdrop = document.createElement("div");
        backdrop.className = "app-dialog-backdrop";

        const dialog = document.createElement("form");
        dialog.className = "app-dialog effect-config-dialog plugin-custom-effect-dialog";
        backdrop.appendChild(dialog);

        const titleBar = document.createElement("header");
        titleBar.className = "app-dialog-title-bar";
        dialog.appendChild(titleBar);
        {
            const title = document.createElement("div");
            title.className = "app-dialog-title";
            titleBar.appendChild(title);

            const icon = document.createElement("img");
            icon.src = context.icon;
            icon.alt = "";
            title.appendChild(icon);

            const text = document.createElement("strong");
            text.textContent = context.title;
            title.appendChild(text);

            const close = document.createElement("button");
            close.type = "button";
            close.className = "app-dialog-close";
            close.textContent = "×";
            titleBar.appendChild(close);
            close.onclick = () => finish(null);
        }

        const content = document.createElement("div");
        content.className = "effect-config-content plugin-custom-effect-content";
        dialog.appendChild(content);

        let previewEnabled = true;
        let previewFrame = null;
        const requestPreview = immediate => {
            if (previewFrame !== null) {
                cancelAnimationFrame(previewFrame);
                previewFrame = null;
            }
            if (immediate) {
                void context.preview(previewEnabled ? values : null);
            } else {
                previewFrame = requestAnimationFrame(() => {
                    previewFrame = null;
                    void context.preview(previewEnabled ? values : null);
                });
            }
        };

        const custom = build({
            context,
            values,
            content,
            requestPreview,
            sourceCanvas: () => sourceCanvas(context)
        }) || {};

        const footer = document.createElement("footer");
        footer.className = "app-dialog-footer effect-config-footer";
        dialog.appendChild(footer);
        {
            const left = document.createElement("div");
            footer.appendChild(left);

            const preview = document.createElement("label");
            preview.className = "effect-config-checkbox";
            left.appendChild(preview);
            {
                const input = document.createElement("input");
                input.type = "checkbox";
                input.checked = true;
                input.onchange = () => {
                    previewEnabled = input.checked;
                    if (previewEnabled) {
                        requestPreview(true);
                    } else {
                        void context.showOriginal();
                    }
                };
                preview.append(input, document.createTextNode("Preview"));
            }

            if (Array.isArray(custom.buttons)) {
                for (const button of custom.buttons) {
                    left.appendChild(button);
                }
            }

            const actions = document.createElement("div");
            footer.appendChild(actions);

            const okay = document.createElement("button");
            okay.type = "submit";
            okay.textContent = "OK";
            actions.appendChild(okay);

            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.textContent = "Cancel";
            cancel.onclick = () => finish(null);
            actions.appendChild(cancel);
        }

        let finished = false;
        const finish = result => {
            if (finished) {
                return;
            }
            finished = true;
            if (previewFrame !== null) {
                cancelAnimationFrame(previewFrame);
            }
            document.removeEventListener("keydown", onKeyDown, true);
            backdrop.remove();
            if (result === null) {
                void context.showOriginal();
            }
            resolve(result);
        };
        const onKeyDown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                finish(null);
            }
        };
        dialog.onsubmit = event => {
            event.preventDefault();
            finish(values);
        };
        backdrop.onclick = event => {
            if (event.target === backdrop) {
                finish(null);
            }
        };
        document.addEventListener("keydown", onKeyDown, true);
        document.body.appendChild(backdrop);
        requestPreview(true);
    });
}

export function addRange(parent, values, key, labelText, minimum, maximum, step, onChange) {
    const row = document.createElement("label");
    row.className = "effect-config-row";
    parent.appendChild(row);

    const label = document.createElement("span");
    label.textContent = labelText;
    row.appendChild(label);

    const controls = document.createElement("div");
    row.appendChild(controls);

    const range = document.createElement("input");
    range.type = "range";
    range.min = minimum;
    range.max = maximum;
    range.step = step;
    controls.appendChild(range);

    const number = document.createElement("input");
    number.type = "number";
    number.min = minimum;
    number.max = maximum;
    number.step = step;
    controls.appendChild(number);

    const set = value => {
        const numeric = Math.max(minimum, Math.min(maximum, Number(value)));
        values[key] = numeric;
        range.value = numeric;
        number.value = numeric;
    };
    range.oninput = () => {
        set(range.value);
        onChange(false);
    };
    range.onchange = () => onChange(true);
    number.oninput = () => {
        set(number.value);
        onChange(false);
    };
    number.onchange = () => onChange(true);
    set(values[key]);
    return {row, range, number, set};
}

export function addCheckbox(parent, values, key, labelText, onChange) {
    const label = document.createElement("label");
    label.className = "effect-config-checkbox";
    parent.appendChild(label);

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(values[key]);
    input.onchange = () => {
        values[key] = input.checked;
        onChange(true);
    };
    label.append(input, document.createTextNode(labelText));
    return input;
}

export function addSelect(parent, values, key, labelText, choices, onChange) {
    const row = document.createElement("label");
    row.className = "effect-config-row effect-config-select-row";
    parent.appendChild(row);
    row.appendChild(document.createTextNode(labelText));

    const select = document.createElement("select");
    row.appendChild(select);
    for (const [value, label] of choices) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    }
    select.value = values[key];
    select.onchange = () => {
        values[key] = select.value;
        onChange(true);
    };
    return select;
}

export function addColor(parent, values, key, labelText, onChange) {
    const row = document.createElement("label");
    row.className = "effect-config-row";
    parent.appendChild(row);
    row.appendChild(document.createTextNode(labelText));

    const input = document.createElement("input");
    input.type = "color";
    input.value = values[key];
    input.oninput = () => {
        values[key] = input.value;
        onChange(false);
    };
    input.onchange = () => onChange(true);
    row.appendChild(input);
    return input;
}
