const fs = require("fs");
const path = require('path');
const readJSONFile = (path) => {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, jsonString) => {
            if (err) reject(err);
            const result = JSON.parse(jsonString);
            resolve(result);

        })
    });
};

const resolvePath = (components) => {
    return path.resolve(...components.map(par => `${par}`));
};

const isFloat = (n) => {
    return n === +n && n !== (n | 0);
};

const floor = (number, fraction) => {
    const factor = Math.pow(10, fraction);
    return Math.floor(number * factor) / factor;

};
const round = (number, fraction) => {
    const factor = Math.pow(10, fraction);
    return Math.round(number * factor) / factor;
};
const geoRewind = (geo) => {
    const rewind = require('geojson-rewind');
    return rewind(geo);
};

const deepClone = (obj) => {
    let newObj = Array.isArray(obj) ? [] : {};
    if (obj && typeof obj === "object") {
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                newObj[key] = (obj && typeof obj[key] === 'object') ? deepClone(obj[key]) : obj[key];
            }
        }
    }
    return newObj
};

const writeJSONToFile = (path, json) => {
    makeDirectory(path);
    fs.writeFileSync(path, JSON.stringify(json));
};

const makeDirectory = (p) => {


    if (!fs.existsSync(p)) {
        p
            .split(path.sep)
            .reduce((prevPath, folder, i, a) => {
                const currentPath = path.join(prevPath, folder, path.sep);
                if (i === a.length - 1) return currentPath;
                if (!fs.existsSync(currentPath)) {
                    fs.mkdirSync(currentPath);
                }
                return currentPath;
            }, '');
    }
};
module.exports = {
    writeJSONToFile,
    isFloat,
    floor,
    readJSONFile,
    round,
    makeDirectory,
    deepClone,
    geoRewind,
    resolvePath
};
