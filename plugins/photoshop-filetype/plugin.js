// Photoshop PSD FileType by Frank Blumenberg and Tao Yue.
// JavaScript implementation powered by ag-psd; see the packaged third-party notices.
import { readPsd, writePsdUint8Array } from "ag-psd";

(() => {
    const psdToPaintBlendMode = Object.freeze({
        normal: "normal",
        multiply: "multiply",
        "linear dodge": "additive",
        "color burn": "colorBurn",
        "color dodge": "colorDodge",
        overlay: "overlay",
        difference: "difference",
        lighten: "lighten",
        darken: "darken",
        screen: "screen"
    });
    const paintToPsdBlendMode = Object.freeze({
        normal: "normal",
        multiply: "multiply",
        additive: "linear dodge",
        colorBurn: "color burn",
        colorDodge: "color dodge",
        overlay: "overlay",
        difference: "difference",
        lighten: "lighten",
        darken: "darken",
        screen: "screen"
    });

    function channelToByte(data, index, colorChannel) {
        const value = data[index];
        if (data instanceof Uint16Array) {
            return Math.round(value / 257);
        }
        if (data instanceof Float32Array) {
            const normalized = Math.max(0, Math.min(1, value));
            return Math.round(255 * (colorChannel ? Math.pow(normalized, 1 / 2.2) : normalized));
        }
        return value;
    }

    function copyIntoDocument(pixelData, left, top, width, height) {
        if (!pixelData || pixelData.data.length !== pixelData.width * pixelData.height * 4) {
            throw new Error("The PSD contains invalid layer pixel data.");
        }

        const output = new Uint8ClampedArray(width * height * 4);
        const source = pixelData.data;
        const startX = Math.max(0, -left);
        const startY = Math.max(0, -top);
        const endX = Math.min(pixelData.width, width - left);
        const endY = Math.min(pixelData.height, height - top);
        if (startX >= endX || startY >= endY) {
            return output;
        }

        const bytePixels = source instanceof Uint8Array || source instanceof Uint8ClampedArray;
        for (let sourceY = startY; sourceY < endY; ++sourceY) {
            const sourceOffset = (sourceY * pixelData.width + startX) * 4;
            const destinationOffset = ((sourceY + top) * width + startX + left) * 4;
            const byteLength = (endX - startX) * 4;
            if (bytePixels) {
                output.set(source.subarray(sourceOffset, sourceOffset + byteLength), destinationOffset);
                continue;
            }
            for (let offset = 0; offset < byteLength; offset += 4) {
                output[destinationOffset + offset] = channelToByte(source, sourceOffset + offset, true);
                output[destinationOffset + offset + 1] = channelToByte(source, sourceOffset + offset + 1, true);
                output[destinationOffset + offset + 2] = channelToByte(source, sourceOffset + offset + 2, true);
                output[destinationOffset + offset + 3] = channelToByte(source, sourceOffset + offset + 3, false);
            }
        }
        return output;
    }

    function applyMask(pixels, mask, layerLeft, layerTop, width, height) {
        if (!mask || mask.disabled || !mask.imageData) {
            return;
        }

        const image = mask.imageData;
        const relative = mask.positionRelativeToLayer === true;
        const left = (mask.left || 0) + (relative ? layerLeft : 0);
        const top = (mask.top || 0) + (relative ? layerTop : 0);
        const outside = mask.defaultColor === undefined ? 255 : mask.defaultColor;
        for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; ++x) {
                const maskX = x - left;
                const maskY = y - top;
                let value = outside;
                if (maskX >= 0 && maskY >= 0 && maskX < image.width && maskY < image.height) {
                    value = channelToByte(image.data, (maskY * image.width + maskX) * 4, false);
                }
                const alpha = (y * width + x) * 4 + 3;
                pixels[alpha] = Math.round((pixels[alpha] * value) / 255);
            }
        }
    }

    function collectLayers(children, state, output, width, height) {
        for (const layer of children || []) {
            const visible = state.visible && layer.hidden !== true;
            const opacity = state.opacity * (layer.opacity === undefined ? 1 : layer.opacity);
            if (Array.isArray(layer.children)) {
                collectLayers(layer.children, { visible, opacity }, output, width, height);
                continue;
            }
            if (!layer.imageData) {
                continue;
            }

            const left = Math.trunc(layer.left || 0);
            const top = Math.trunc(layer.top || 0);
            const pixels = copyIntoDocument(layer.imageData, left, top, width, height);
            applyMask(pixels, layer.mask, left, top, width, height);
            applyMask(pixels, layer.realMask, left, top, width, height);
            output.push({
                name: layer.name || `Layer ${output.length + 1}`,
                visible,
                opacity: Math.round(255 * Math.max(0, Math.min(1, opacity))),
                blendMode: psdToPaintBlendMode[layer.blendMode] || "normal",
                isBackground: layer.nameSource === "bgnd",
                data: pixels
            });
        }
    }

    function getResolution(psd) {
        const info = psd.imageResources && psd.imageResources.resolutionInfo;
        if (!info || !Number.isFinite(info.horizontalResolution)) {
            return 96;
        }
        return info.horizontalResolutionUnit === "PPCM" ? info.horizontalResolution * 2.54 : info.horizontalResolution;
    }

    function decodePsd({ bytes, fileName }) {
        let psd;
        try {
            psd = readPsd(bytes, {
                useImageData: true,
                skipThumbnail: true,
                skipLinkedFilesData: true,
                totalMemoryLimit: 512 * 1024 * 1024
            });
        } catch (error) {
            throw new Error(`${fileName || "PSD file"} could not be read: ${error.message}`);
        }

        const layers = [];
        collectLayers(psd.children, { visible: true, opacity: 1 }, layers, psd.width, psd.height);
        if (layers.length === 0 && psd.imageData) {
            layers.push({
                name: "Background",
                visible: true,
                opacity: 255,
                blendMode: "normal",
                isBackground: true,
                data: copyIntoDocument(psd.imageData, 0, 0, psd.width, psd.height)
            });
        }
        if (layers.length === 0) {
            throw new Error("The PSD does not contain rasterized image data.");
        }

        // Photoshop stores layers top-to-bottom; paint.js stores them bottom-to-top.
        layers.reverse();
        return {
            width: psd.width,
            height: psd.height,
            resolution: getResolution(psd),
            activeLayer: layers.length - 1,
            layers
        };
    }

    function blendChannel(mode, backdrop, source) {
        switch (mode) {
            case "multiply":
                return backdrop * source;
            case "additive":
                return Math.min(1, backdrop + source);
            case "colorBurn":
                return source === 0 ? 0 : Math.max(0, 1 - (1 - backdrop) / source);
            case "colorDodge":
                return source === 1 ? 1 : Math.min(1, backdrop / (1 - source));
            case "overlay":
                return backdrop <= 0.5 ? 2 * backdrop * source : 1 - 2 * (1 - backdrop) * (1 - source);
            case "difference":
                return Math.abs(backdrop - source);
            case "lighten":
                return Math.max(backdrop, source);
            case "darken":
                return Math.min(backdrop, source);
            case "screen":
                return backdrop + source - backdrop * source;
            default:
                return source;
        }
    }

    function composeDocument(document) {
        const output = new Uint8ClampedArray(document.width * document.height * 4);
        for (const layer of document.layers) {
            if (!layer.visible || layer.opacity === 0) {
                continue;
            }
            const layerOpacity = layer.opacity / 255;
            for (let offset = 0; offset < output.length; offset += 4) {
                const sourceAlpha = (layer.data[offset + 3] / 255) * layerOpacity;
                if (sourceAlpha === 0) {
                    continue;
                }
                const backdropAlpha = output[offset + 3] / 255;
                const resultAlpha = sourceAlpha + backdropAlpha * (1 - sourceAlpha);
                for (let channel = 0; channel < 3; ++channel) {
                    const backdrop = output[offset + channel] / 255;
                    const source = layer.data[offset + channel] / 255;
                    const blended = blendChannel(layer.blendMode, backdrop, source);
                    const premultiplied =
                        (1 - sourceAlpha) * backdrop * backdropAlpha +
                        (1 - backdropAlpha) * source * sourceAlpha +
                        sourceAlpha * backdropAlpha * blended;
                    output[offset + channel] = resultAlpha === 0 ? 0 : Math.round((255 * premultiplied) / resultAlpha);
                }
                output[offset + 3] = Math.round(255 * resultAlpha);
            }
        }
        return output;
    }

    function encodePsd({ document }) {
        const resolution = document.resolution || 96;
        const psd = {
            width: document.width,
            height: document.height,
            bitsPerChannel: 8,
            colorMode: 3,
            imageData: {
                width: document.width,
                height: document.height,
                data: composeDocument(document)
            },
            imageResources: {
                resolutionInfo: {
                    horizontalResolution: resolution,
                    horizontalResolutionUnit: "PPI",
                    widthUnit: "Inches",
                    verticalResolution: resolution,
                    verticalResolutionUnit: "PPI",
                    heightUnit: "Inches"
                }
            },
            children: [...document.layers].reverse().map((layer) => ({
                name: layer.name,
                hidden: !layer.visible,
                opacity: layer.opacity / 255,
                blendMode: paintToPsdBlendMode[layer.blendMode] || "normal",
                imageData: {
                    width: document.width,
                    height: document.height,
                    data: new Uint8ClampedArray(layer.data)
                }
            }))
        };
        return writePsdUint8Array(psd, {
            trimImageData: true,
            noBackground: document.layers[0] && !document.layers[0].isBackground
        });
    }

    paintDotJs.registerPlugin({
        fileTypes: [
            {
                id: "photoshop",
                name: "Photoshop",
                extensions: [".psd"],
                mime: "image/vnd.adobe.photoshop",
                supportsLayers: true,
                decode: decodePsd,
                encode: encodePsd
            }
        ]
    });
})();
