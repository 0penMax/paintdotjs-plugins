function findVisibleBounds(source, width, height) {
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; ++y) {
        let offset = y * width * 4;
        for (let x = 0; x < width; ++x, offset += 4) {
            if (source[offset + 3] === 0) {
                continue;
            }
            if (x < left) {
                left = x;
            }
            if (x > right) {
                right = x;
            }
            if (y < top) {
                top = y;
            }
            if (y > bottom) {
                bottom = y;
            }
        }
    }
    if (right === -1) {
        return null;
    }
    return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

function findTargetPosition(alignment, bounds, width, height) {
    let x = bounds.x;
    let y = bounds.y;
    switch (alignment) {
        case "center":
            x = Math.round((width - bounds.width) / 2);
            y = Math.round((height - bounds.height) / 2);
            break;
        case "horizontalCenter":
            x = Math.round((width - bounds.width) / 2);
            break;
        case "verticalCenter":
            y = Math.round((height - bounds.height) / 2);
            break;
        case "left":
            x = 0;
            break;
        case "right":
            x = width - bounds.width;
            break;
        case "top":
            y = 0;
            break;
        case "bottom":
            y = height - bounds.height;
            break;
    }
    // Keep the object inside the canvas even when it is larger than it.
    x = Math.max(0, Math.min(x, Math.max(width - bounds.width, 0)));
    y = Math.max(0, Math.min(y, Math.max(height - bounds.height, 0)));
    return { x, y };
}

function showMessage(context, title, message) {
    const window = paintDotJs.dialogs.create({
        title: title,
        icon: context.icon,
        className: "object-align-message-dialog"
    });
    const text = document.createElement("p");
    text.textContent = message;
    text.style.padding = "14px 12px";
    window.content.appendChild(text);
    const footer = document.createElement("div");
    footer.className = "app-dialog-footer";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = "OK";
    footer.appendChild(ok);
    window.dialog.appendChild(footer);
    return new Promise((resolve) => {
        const finish = () => {
            window.destroy();
            resolve(null);
        };
        ok.addEventListener("click", finish);
        window.closeButton.addEventListener("click", finish);
    });
}

const ALIGNMENTS = [
    { id: "center", name: "Center", icon: paintDotJs.asset("center.png"), alignment: "center" },
    {
        id: "horizontal-center",
        name: "Horizontal Center",
        icon: paintDotJs.asset("center-h.png"),
        alignment: "horizontalCenter"
    },
    {
        id: "vertical-center",
        name: "Vertical Center",
        icon: paintDotJs.asset("center-v.png"),
        alignment: "verticalCenter"
    },
    { id: "left", name: "Left", icon: paintDotJs.asset("left.png"), alignment: "left" },
    { id: "right", name: "Right", icon: paintDotJs.asset("right.png"), alignment: "right" },
    { id: "top", name: "Top", icon: paintDotJs.asset("top.png"), alignment: "top" },
    { id: "bottom", name: "Bottom", icon: paintDotJs.asset("bottom.png"), alignment: "bottom" }
];

const submenuIcon = paintDotJs.asset("icon.png");

// Hosts with the category-icon fix (paintdotjs issue #16) accept a category
// object; older hosts require a plain string (their optionalText() throws on
// an object).
const supportsCategoryIcons =
    typeof PluginManager !== "undefined" && typeof PluginManager.normalizeEffectCategory === "function";
const category = supportsCategoryIcons ? { name: "Object Align", icon: submenuIcon } : "Object Align";

paintDotJs.registerPlugin({
    effects: ALIGNMENTS.map((spec) => ({
        id: spec.id,
        name: spec.name,
        category: category,
        icon: spec.icon,

        // Runs on the main thread, receives a copy of the source bytes.
        // Return null to cancel (no undo step).
        configure(context) {
            const bounds = findVisibleBounds(context.source, context.width, context.height);
            if (bounds === null) {
                return showMessage(
                    context,
                    "No Object to Align",
                    "The active layer has no visible pixels, so there is nothing to align."
                );
            }
            const target = findTargetPosition(spec.alignment, bounds, context.width, context.height);
            if (target.x === bounds.x && target.y === bounds.y) {
                return null; // already aligned — no undo step
            }
            return {};
        },

        // Whole-image render. destination starts as a copy of source; overwrite every pixel.
        render({ source, destination, width, height }) {
            const bounds = findVisibleBounds(source, width, height);
            if (bounds === null) {
                return;
            }
            const target = findTargetPosition(spec.alignment, bounds, width, height);
            const dx = target.x - bounds.x;
            const dy = target.y - bounds.y;
            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    const sx = x - dx;
                    const sy = y - dy;
                    const to = (y * width + x) * 4;
                    if (sx < 0 || sx >= width || sy < 0 || sy >= height) {
                        destination[to] = 0;
                        destination[to + 1] = 0;
                        destination[to + 2] = 0;
                        destination[to + 3] = 0;
                    } else {
                        const from = (sy * width + sx) * 4;
                        destination[to] = source[from];
                        destination[to + 1] = source[from + 1];
                        destination[to + 2] = source[from + 2];
                        destination[to + 3] = source[from + 3];
                    }
                }
            }
        }
    }))
});

// The host sorts plugin-only submenu entries alphabetically. The core Object
// Align submenu keeps its declaration order instead — re-sort to match it
// (center, horizontal center, vertical center, left, right, top, bottom).
if (typeof EffectsMenu !== "undefined" && typeof EffectsMenu.createPluginOnlyCategory === "function") {
    const order = new Map(ALIGNMENTS.map((spec, index) => [spec.id, index]));
    const rank = (id) => order.get(id.split(".").pop()) ?? 99;
    const createPluginOnlyCategory = EffectsMenu.createPluginOnlyCategory;
    EffectsMenu.createPluginOnlyCategory = (key, label, effects) => {
        const entry = createPluginOnlyCategory(key, label, effects);
        if (label === "Object Align") {
            entry.entries.sort((a, b) => rank(a.definition.id) - rank(b.definition.id));
            // Hosts without the category-icon fix create the submenu with no
            // icon — apply ours. Fixed hosts already set getIconSrc().
            if (entry.hasIconImage === false) {
                entry.hasIconImage = true;
                entry.getIconSrc = () => submenuIcon;
            }
        }
        return entry;
    };
}
