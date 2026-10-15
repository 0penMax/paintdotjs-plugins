const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { buildSync } = require("esbuild");
const { strToU8, zipSync } = require("fflate");

const root = path.resolve(__dirname, "..");
const outputDirectory = path.join(root, "dist");
const archiveDate = new Date("1980-01-01T00:00:00.000Z");
let plugins = [];
let ids = new Set();

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

function archiveEntry(data) {
    return [data, { mtime: archiveDate }];
}

function buildPackage(directory, metadataText) {
    let pluginDirectory = path.join(root, "plugins", directory);
    let sourcePath = path.join(pluginDirectory, "plugin.js");
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`${directory} requires plugin.js.`);
    }

    let result = buildSync({
        entryPoints: [sourcePath],
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        target: ["es2020"],
        minify: true,
        legalComments: "none",
        banner: {
            js: "/*! Third-party license texts are packaged in assets/THIRD-PARTY-NOTICES.txt. */"
        }
    });
    let source = Buffer.from(result.outputFiles[0].contents);

    let files = {
        "plugin.json": archiveEntry(strToU8(metadataText)),
        "plugin.js": archiveEntry(new Uint8Array(source))
    };
    let assetsDirectory = path.join(pluginDirectory, "assets");
    if (fs.existsSync(assetsDirectory)) {
        for (let assetName of fs.readdirSync(assetsDirectory).sort()) {
            let assetPath = path.join(assetsDirectory, assetName);
            if (!fs.statSync(assetPath).isFile() || !/^[A-Za-z0-9_.-]+$/.test(assetName)) {
                throw new Error(`${directory} contains an invalid asset: ${assetName}`);
            }
            files[`assets/${assetName}`] = archiveEntry(new Uint8Array(fs.readFileSync(assetPath)));
        }
    }

    let output = Buffer.from(zipSync(files, { level: 9 }));
    fs.writeFileSync(path.join(outputDirectory, `${directory}.paintjs`), output);
    return output;
}

for (let directory of fs.readdirSync(path.join(root, "plugins")).sort()) {
    let metadataPath = path.join(root, "plugins", directory, "plugin.json");
    let metadataText = fs.readFileSync(metadataPath, "utf8");
    let metadata = JSON.parse(metadataText);
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(metadata.id) || ids.has(metadata.id) || metadata.apiVersion !== 1) {
        throw new Error(`Invalid or duplicate package ID / API version: ${directory}`);
    }
    ids.add(metadata.id);
    for (let key of ["name", "version", "author", "description", "category", "license", "website"]) {
        if (typeof metadata[key] !== "string" || !metadata[key].trim()) {
            throw new Error(`${directory} requires ${key}; preserve original creator credits.`);
        }
    }
    if (new URL(metadata.website).protocol !== "https:") {
        throw new Error(`${directory} requires an HTTPS original creator link.`);
    }

    let packageBytes = buildPackage(directory, metadataText);
    let file = `${directory}.paintjs`;
    let sha256 = crypto.createHash("sha256").update(packageBytes).digest("hex");
    let source = `https://github.com/LabyStudio/paintdotjs-plugins/tree/main/plugins/${directory}`;
    plugins.push({ ...metadata, file, source, sha256 });
}

let output = JSON.stringify({ schemaVersion: 1, plugins }, null, 2) + "\n";
fs.writeFileSync(path.join(outputDirectory, "catalog.json"), output);
console.log(`Validated catalog with ${plugins.length} plugins.`);
