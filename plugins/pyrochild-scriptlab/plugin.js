import {openEffectDialog} from "../../lib/effect-dialog.js";

function controlEditor(parent, control, values, changed) {
    let row = document.createElement("label");
    row.style.cssText = "display:grid;grid-template-columns:150px 1fr 70px;gap:6px;align-items:center";
    parent.appendChild(row);
    let label = document.createElement("span");
    label.textContent = control.label || control.key;
    row.appendChild(label);
    let input;
    if (control.type === "select") {
        input = document.createElement("select");
        for (let choice of control.choices) {
            let option = document.createElement("option");
            option.value = choice.value;
            option.textContent = choice.label;
            input.appendChild(option);
        }
        input.value = values[control.key];
    } else if (control.type === "checkbox") {
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Boolean(values[control.key]);
    } else {
        input = document.createElement("input");
        input.type = control.type === "range" ? "range" : control.type;
        if (control.type === "range") {
            input.min = control.min;
            input.max = control.max;
            input.step = control.step;
        }
        input.value = values[control.key];
    }
    input.oninput = () => {
        values[control.key] = control.type === "checkbox" ? input.checked
            : control.type === "range" ? Number(input.value) : input.value;
        changed(false);
    };
    input.onchange = () => changed(true);
    row.appendChild(input);
    if (control.type === "range") {
        let output = document.createElement("output");
        output.value = values[control.key];
        input.addEventListener("input", () => output.value = input.value);
        row.appendChild(output);
    }
}

function configure(context) {
    return openEffectDialog(context, ({values, content, requestPreview}) => {
        values.chain ||= [];
        let available = paintDotJs.effects.list().filter(effect =>
            !effect.id.includes("pyrochild.scriptlab"));
        let sourceBefore = index => {
            let result = new Uint8ClampedArray(context.source);
            for (let stageIndex = 0; stageIndex < index; ++stageIndex) {
                let stage = values.chain[stageIndex];
                result = paintDotJs.effects.apply(stage.id, result, context.width, context.height,
                    stage.values, context.selection);
            }
            return result;
        };
        let configureStage = async (effect, stageValues, index) => {
            let configured = await paintDotJs.effects.configure(effect.id, {
                source: sourceBefore(index),
                width: context.width,
                height: context.height,
                selection: context.selection,
                values: stageValues,
                preview: previewValues => {
                    if (previewValues === null) {
                        return context.preview(values);
                    }
                    let temporary = structuredClone(values);
                    let stage = {id: effect.id, values: previewValues};
                    if (index < temporary.chain.length) {
                        temporary.chain[index] = stage;
                    } else {
                        temporary.chain.push(stage);
                    }
                    return context.preview(temporary);
                }
            });
            void context.preview(values);
            return configured;
        };
        let addRow = document.createElement("div");
        addRow.style.cssText = "display:flex;gap:8px;margin-bottom:10px";
        content.appendChild(addRow);
        let picker = document.createElement("select");
        for (let effect of available) {
            let option = document.createElement("option");
            option.value = effect.id;
            option.textContent = effect.category ? `${effect.category} → ${effect.name}` : effect.name;
            picker.appendChild(option);
        }
        addRow.appendChild(picker);
        let add = document.createElement("button");
        add.type = "button";
        add.textContent = "Add effect";
        addRow.appendChild(add);
        let list = document.createElement("div");
        list.style.cssText = "display:grid;width:100%;min-width:0;max-height:430px;gap:8px;overflow:auto";
        content.appendChild(list);
        let draw = () => {
            list.replaceChildren();
            values.chain.forEach((stage, index) => {
                let effect = available.find(candidate => candidate.id === stage.id);
                if (effect === undefined) {
                    return;
                }
                let card = document.createElement("section");
                card.style.cssText = "border:1px solid #777;padding:8px;display:grid;gap:6px";
                list.appendChild(card);
                let header = document.createElement("div");
                header.style.cssText = "display:flex;align-items:center;gap:6px";
                card.appendChild(header);
                let title = document.createElement("strong");
                title.textContent = `${index + 1}. ${effect.name}`;
                title.style.marginRight = "auto";
                header.appendChild(title);
                for (let [label, offset] of [["↑", -1], ["↓", 1]]) {
                    let move = document.createElement("button");
                    move.type = "button";
                    move.textContent = label;
                    move.disabled = index + offset < 0 || index + offset >= values.chain.length;
                    move.onclick = () => {
                        let replacement = index + offset;
                        [values.chain[index], values.chain[replacement]] =
                            [values.chain[replacement], values.chain[index]];
                        draw();
                        requestPreview(true);
                    };
                    header.appendChild(move);
                }
                let remove = document.createElement("button");
                remove.type = "button";
                remove.textContent = "Remove";
                remove.onclick = () => {
                    values.chain.splice(index, 1);
                    draw();
                    requestPreview(true);
                };
                header.appendChild(remove);
                let configureButton = document.createElement("button");
                configureButton.type = "button";
                configureButton.textContent = "Configure…";
                configureButton.onclick = async () => {
                    let configured = await configureStage(effect, stage.values, index);
                    if (configured !== null) {
                        stage.values = configured;
                        draw();
                        requestPreview(true);
                    }
                };
                header.appendChild(configureButton);
                for (let control of effect.controls) {
                    controlEditor(card, control, stage.values, requestPreview);
                }
                if (effect.controls.length === 0) {
                    let note = document.createElement("span");
                    note.textContent = "This effect has no standard controls.";
                    card.appendChild(note);
                }
            });
        };
        add.onclick = async () => {
            let effect = available.find(candidate => candidate.id === picker.value);
            if (effect !== undefined) {
                let configured = await configureStage(effect, effect.values, values.chain.length);
                if (configured !== null) {
                    values.chain.push({id: effect.id, values: configured});
                    draw();
                    requestPreview(true);
                }
            }
        };
        draw();
    });
}

paintDotJs.registerPlugin({
    effects: [{
        id: "scriptlab",
        name: "ScriptLab",
        category: "Advanced",
        icon: paintDotJs.asset("icon.png"),
        controls: [],
        configure,
        render({source, destination, width, height, selection, values}) {
            let result = new Uint8ClampedArray(source);
            for (let stage of values.chain || []) {
                result = paintDotJs.effects.apply(
                    stage.id, result, width, height, stage.values, selection);
            }
            destination.set(result);
        }
    }]
});
