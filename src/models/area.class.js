const func = require('../service/util.func');
const turf = require('@turf/turf');

class Area {
    constructor(geojson, fileIdx = 'fileIdx', versionCode = 'tcode') {
        this.isProcessed = false;
        this.rawData = geojson;
        this.fileIdx = fileIdx;
        this.versionCode = versionCode;
        this.rawArea = {};
        this.unionArea = {};
        this.crawleredArea = {};
        this.finalMap = {};
        this.featureCount = 0;
    }


    async processData(hookMap = {}, {outputFolder, doExport}) {
        try {
            this.startTime = Date.now();
            this.currentTime = Date.now();
            this.hookMap = hookMap;

            /*### Start Process Data ###*/
            if (this.hookMap.willStartProcessData) {
                this.hookMap.willStartProcessData(this.rawData);
            }
            const {features: rawFeatures} = this.rawData;
            this.featureCount = rawFeatures.length;
            this.currentTime = Date.now();
            if (this.hookMap.didStartProcessData) {
                this.hookMap.didStartProcessData(this.featureCount, this.getProcessTime());
            }

            /*### Start Separate Areas ###*/
            if (this.hookMap.willStartSeparateAreas) {
                this.hookMap.willStartSeparateAreas(rawFeatures);
            }
            this.rawArea = Area.separateAreas(rawFeatures);
            this.currentTime = Date.now();
            if (this.hookMap.didFinishSeparateAreas) {
                this.hookMap.didFinishSeparateAreas(this.rawArea, Object.keys(this.rawArea).length, this.featureCount, this.getProcessTime());
            }

            /*### Start Union Area ###*/
            if (this.hookMap.willStartUnionMerge) {
                this.hookMap.willStartUnionMerge(this.rawArea, this.featureCount);
            }
            const [unionErrs, unionMap, unionFeatureCount] = Area.unionAllAreaMap(
                this.rawArea,
                this.hookMap.willStartUnionSubArea,
                this.hookMap.didFinishUnionSubArea
            );
            this.unionArea = unionMap;
            this.featureCount = unionFeatureCount;
            this.currentTime = Date.now();
            if (this.hookMap.didFinishUnionMerge) {
                this.hookMap.didFinishUnionMerge(unionErrs, this.unionArea, this.featureCount, this.getProcessTime());
            }


            /*### Start Crawler Merge Area ###*/
            if (this.hookMap.willStartCrawlerMerge) {
                this.hookMap.willStartCrawlerMerge(this.unionArea, this.featureCount);
            }
            const [crawlerErrs, crawleredArea, crawlerFeatureCount] = Area.crawlerMerge(
                this.unionArea,
                this.hookMap.didFinishCrawlerBFSLayer
            );
            this.crawleredArea = crawleredArea;
            this.featureCount = crawlerFeatureCount;
            this.currentTime = Date.now();
            if (this.hookMap.didFinishCrawlerMerge) {
                this.hookMap.didFinishCrawlerMerge(crawlerErrs, this.crawleredArea, this.featureCount, this.getProcessTime());
            }

            /*### Start Final Clean Up ###*/
            if (this.hookMap.willStartFinalCleanUp) {
                this.hookMap.willStartFinalCleanUp(this.crawleredArea, this.featureCount)
            }
            const [finalErrs, finalMap, finalFeatureCount] = Area.finalCleanUp(this.crawleredArea);
            this.finalMap = finalMap;
            this.featureCount = finalFeatureCount;
            this.currentTime = Date.now();
            if (this.hookMap.didFinishFinalCleanUp) {
                this.hookMap.didFinishFinalCleanUp(finalErrs, this.finalMap, this.featureCount, this.getProcessTime());
            }

            /*### Combine back all features ###*/

            const finalFeatures = Object.values(this.finalMap).reduce((acc, curr) => [...acc, ...curr.features], []);
            this.finalFeatures = finalFeatures;

            this.finalGeo = {type: "FeatureCollection", features: this.finalFeatures};
            this.isProcessed = true;
            if (doExport) {
                if (this.hookMap.willStartExportFile) this.hookMap.willStartExportFile(this.getProcessTime());
                await this.exportData(outputFolder, this.hookMap.didExportArea, this.hookMap.didExportCompleteFile);
            }
            this.hookMap.didFinishAllProcess(finalFeatures, rawFeatures.length, finalFeatures.length, this.getProcessTime());


            return this.finalGeo
        } catch (e) {
            throw e;
        }

    }

    getProcessTime() {
        return (this.currentTime - this.startTime) / 1000;
    }

    async exportData(outputFolder, didExportArea, didExportComplete) {
        if (!this.isProcessed) throw new Error('This Area is not processed yet');
        try {
            const keys = Object.keys(this.finalMap);
            for (let i = 0; i < keys.length; i++) {
                const areaKey = keys[i];
                const orgArea = this.rawArea[areaKey];
                let ogeo = {type: 'FeatureCollection', features: []};
                if (orgArea) {
                    ogeo = {type: 'FeatureCollection', features: orgArea.features};
                }
                const mgeo = {type: 'FeatureCollection', features: this.finalMap[areaKey].features};
                const orgPath = func.resolvePath([outputFolder, 'AREAS', `AREA-${i}-${areaKey}`, 'ORIGIN.json']);
                // console.log('will write');
                func.writeJSONToFile(orgPath, ogeo);
                if (didExportArea) didExportArea(orgPath, 'org');

                const finalPath = func.resolvePath([outputFolder, 'AREAS', `AREA-${i}-${areaKey}`, 'FINAL.json']);
                func.writeJSONToFile(finalPath, mgeo);
                if (didExportArea) didExportArea(orgPath, 'final');

            }

            const completePath = func.resolvePath([outputFolder, 'COMPLETE', `${this.fileIdx}-v${this.versionCode}-complete.json`]);
            await func.writeJSONToFile(completePath, this.finalGeo);
            if (didExportComplete) {
                this.currentTime = Date.now();
                didExportComplete(completePath, this.getProcessTime());
            }
        } catch (e) {
            throw e;
        }
    }

    static queueMergeArea(features) {
        // const total = features.length;
        let cloned = features.slice();
        let processed = [];

        while (cloned.length) {
            let next = [];
            let curr = cloned.pop();
            while (cloned.length) {
                const toCompare = cloned.pop();
                if (Area.checkFeatureInterSects(curr, toCompare)) {
                    curr = Area.unionTwoFeatures(curr, toCompare);
                } else {
                    next.push(toCompare);
                }
            }
            cloned = next;
            next = [];
            while (processed.length) {
                const toCompare = processed.pop();
                if (Area.checkFeatureInterSects(curr, toCompare)) {
                    curr = Area.unionTwoFeatures(curr, toCompare);
                } else {
                    next.push(toCompare);
                }
            }
            processed = next;
            if (curr.geometry.type === 'MultiPolygon') {
                curr = Area.unionMultiPolygon(curr);
                if (curr.geometry.type === 'MultiPolygon') {
                    curr = Area.bufferMultiPolygon(curr, 3);
                    curr = Area.bufferMultiPolygon(curr, -3);
                    if (curr.geometry.type === 'MultiPolygon') {
                        const toAdd = Area.convertMultiPolygonToSimplePolygons(curr);
                        processed.push(...toAdd.map(Area.cleanPolygon));
                    } else {
                        processed.push(Area.cleanPolygon(curr));
                    }
                } else {
                    processed.push(Area.cleanPolygon(curr));
                }
            } else {
                processed.push(Area.cleanPolygon(curr));
            }
        }
        return processed;

    };

    static unionTwoFeatures(featureOne, featureTwo) {
        try {
            const {geometry: noNeed, mergedFeatures, ...rest} = featureOne;
            // const extendedOne = Area.bufferMultiPolygon(featureOne, 3);
            // const extendedTwo = Area.bufferMultiPolygon(featureTwo, 3);
            // let toSave = turf.union(extendedOne, featureTwo);
            let toSave = turf.union(featureOne, featureTwo);
            const newMerged = mergedFeatures ? [...mergedFeatures, featureTwo.id] : [featureTwo.id];
            // if(!mergedFeatures)
            // toSave = Area.bufferMultiPolygon(toSave, -3);
            toSave = Area.simplifyFeature(toSave);
            return {...rest, geometry: toSave.geometry, mergedFeatures: newMerged};
        } catch (e) {
            console.log(e);
            return featureOne;

        }

    };

    static separateAreas(features) {
        const map = {};
        features.forEach((feature) => {
            const {type} = feature.geometry;
            let key = '', latKey, lngKey;
            const fraction = 2;
            const [lng, lat] = Area.findLatLngFromFeature(feature);
            if (type === 'MultiPolygon') {

                //28.338273, 12.3888233 => 28.338-12.3889 (key)
                const lat25 = func.round(func.floor(lat, fraction) + 0.0025, fraction + 2);
                const lat50 = func.round(func.floor(lat, fraction) + 0.0050, fraction + 2);
                const lat75 = func.round(func.floor(lat, fraction) + 0.0075, fraction + 2);

                const lng25 = func.round(func.floor(lng, fraction) + 0.0025, fraction + 2);
                const lng50 = func.round(func.floor(lng, fraction) + 0.0050, fraction + 2);
                const lng75 = func.round(func.floor(lng, fraction) + 0.0075, fraction + 2);
                // const lngSep = func.floor(lng, fraction) + 0.005;
                latKey = func.floor(lat, fraction);
                if (lat >= lat25) latKey = lat25;
                if (lat >= lat50) latKey = lat50;
                if (lat >= lat75) latKey = lat75;

                lngKey = func.floor(lng, fraction);
                if (lng >= lng25) lngKey = lng25;
                if (lng >= lng50) lngKey = lng50;
                if (lng >= lng75) lngKey = lng75;

                key = `${latKey}-${lngKey}`;
            } else {
                const lat25 = func.round(func.floor(lat, fraction) + 0.0025, fraction + 2);
                const lat50 = func.round(func.floor(lat, fraction) + 0.0050, fraction + 2);
                const lat75 = func.round(func.floor(lat, fraction) + 0.0075, fraction + 2);

                const lng25 = func.round(func.floor(lng, fraction) + 0.0025, fraction + 2);
                const lng50 = func.round(func.floor(lng, fraction) + 0.0050, fraction + 2);
                const lng75 = func.round(func.floor(lng, fraction) + 0.0075, fraction + 2);
                // const lngSep = func.floor(lng, fraction) + 0.005;
                latKey = func.floor(lat, fraction);
                if (lat >= lat25) latKey = lat25;
                if (lat >= lat50) latKey = lat50;
                if (lat >= lat75) latKey = lat75;

                lngKey = func.floor(lng, fraction);
                if (lng >= lng25) lngKey = lng25;
                if (lng >= lng50) lngKey = lng50;
                if (lng >= lng75) lngKey = lng75;

                key = `${latKey}-${lngKey}`;
            }

            if (map[key]) {
                map[key]['features'].push(feature);
            } else {
                map[key] = {lat: latKey, lng: lngKey, features: [feature], areaKey: key};
            }
        });
        return map;
    }

    static findLatLngFromFeature(feature) {
        try {
            const cloned = func.deepClone(feature);
            const {coordinates, type} = cloned.geometry;

            let cors = [];
            if (type === 'MultiPolygon') {
                cors = coordinates.reduce((firA, firC) => [...firA, ...firC], []).reduce((secA, secC) => [...secA, ...secC], []);
            } else {
                cors = coordinates.reduce((firA, firC) => [...firA, ...firC], [])
            }
            const [lng, lat] = cors.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - a[1])[0];
            return [lng, lat];
        } catch (e) {
            // console.log(feature);
            return [];
        }
    };

    static unionAllAreaMap(areaMap, startHook, finishHook) {
        const errs = [];
        let featureCount = 0;
        const unionedAreas = Object.keys(areaMap).reduce((acc, curr, idx) => {
            const toProcess = areaMap[curr];
            if (startHook) {
                startHook(idx, curr, toProcess.features);
            }

            const [err, mergedArea] = Area.mergeSimpleArea(toProcess);
            acc[curr] = mergedArea;
            featureCount += mergedArea.features.length;
            if (err) {
                errs.push(err);
            }
            if (finishHook) {
                finishHook(err, idx, curr, mergedArea.features, toProcess.features.length, mergedArea.features.length);
            }
            return acc;
        }, {});
        return [errs, unionedAreas, featureCount];
    };

    static mergeSimpleArea(area) {
        try {
            const {features, ...rest} = area;
            const multiProcessed = features
                .reduce((acc, curr) => {
                    try {
                        if (curr.geometry.type === 'MultiPolygon') {
                            return [...acc, Area.unionMultiPolygon(curr)];
                        }
                        return [...acc, curr];
                    } catch (e) {
                        // console.log('nuler');
                        return [...acc, curr];
                    }
                }, [])
                .reduce((acc, curr) => {
                    return [...acc, Area.bufferMultiPolygon(curr, 0.01)];
                }, [])
                .reduce((acc, curr) => {
                    if (curr.geometry.type === 'MultiPolygon') {
                        // console.log('still multi');
                        return [...acc, ...Area.convertMultiPolygonToSimplePolygons(curr)];
                        // return [...acc,convexFeature(curr)];
                    } else {
                        return [...acc, curr];
                    }
                }, [])
                .map(Area.cleanPolygon)
                .map(Area.simplifyFeature);

            const processed = Area.queueMergeArea(multiProcessed);

            const reprocessed = processed
                .reduce((acc, curr) => {
                    if (curr.geometry.type === 'MultiPolygon') {
                        return [...acc, ...Area.convertMultiPolygonToSimplePolygons(curr)];
                    } else {
                        return [...acc, curr];
                    }
                }, [])
                .map(Area.unionSimplePolygons)
                .map(Area.simplifyFeature);


            return [null, {features: reprocessed, ...rest}];
        } catch (e) {
            return [e, area];
        }
    };

    static convertMultiPolygonToSimplePolygons(feature) {
        try {
            const {geometry, id, ...rest} = feature;
            const polys = geometry.coordinates.map((e, idx) => {
                const newGeo = {type: "Polygon", coordinates: e};
                return {...rest, geometry: newGeo, id: `${id}-${idx}`};
            });
            return polys;
        } catch (e) {
            console.log('convert multi error');
            return [feature];
        }
    };

    static checkFeatureInterSects(featureOne, featureTwo) {
        try {
            const extended = turf.buffer(featureOne, 3, {units: "meters"});
            return turf.booleanIntersects(extended, featureTwo)
                ||
                turf.intersect(extended, featureTwo);
        } catch (e) {
            return false;
        }
    };

    static simplifyFeature(feature) {
        try {
            const {geometry: noNeed, ...rest} = feature;
            const sim = turf.simplify(feature, {tolerance: 0.00001, highQuality: false, mutate: true});
            return {...rest, geometry: sim.geometry};
        } catch (e) {
            return feature;
        }
    };

    static unionSimplePolygons(feature) {
        let combinedPolygons;
        const {geometry, ...rest} = feature;

        for (let polygonPoints of geometry.coordinates) {
            // console.log("Polygons = " + polygons.length);
            let ppolygon;
            try {
                ppolygon = turf.polygon([polygonPoints]);
                if (combinedPolygons) {
                    combinedPolygons = turf.union(combinedPolygons, ppolygon);
                } else {
                    combinedPolygons = ppolygon;
                }
            } catch (e) {
                // console.log(combinedPolygons.geometry.coordinates);
                console.log(e);
                return feature;
            }
        }
        // console.log(combinedPolygons);
        try {
            return {geometry: combinedPolygons.geometry, ...rest};
        } catch (e) {
            console.log(feature);
            return feature;
        }
    };

    static unionMultiPolygon(multipolygon) {
        let combinedPolygons;

        const validated = Area.polygonValidator(multipolygon);
        // Iterate over the polygons
        const {geometry, ...rest} = validated;

        for (let polygons of geometry.coordinates) {
            // console.log("Polygons = " + polygons.length);
            for (let polygonPoints of polygons) {
                // console.log("   Poly = " + polygonPoints.length);
                let ppolygon;
                try {
                    ppolygon = turf.polygon(polygonPoints);
                    if (combinedPolygons) {
                        combinedPolygons = turf.union(ppolygon, combinedPolygons);
                    } else {
                        combinedPolygons = ppolygon;
                    }
                } catch (e) {
                    return multipolygon;
                }
            }
        }
        return {geometry: combinedPolygons.geometry, ...rest};
    };

    static polygonValidator(feature) {
        const {geometry, ...rest} = feature;
        const {type, coordinates} = geometry;
        if (type === 'Polygon') {
            const vCords = coordinates.reduce((acc, curr) => {
                if (curr.length >= 4 && curr[0][0] === curr[curr.length - 1][0] && curr[0][1] === curr[curr.length - 1][1]) {
                    return [...acc, curr];
                }
                return acc;
            }, []);

            return {...rest, geometry: {type, coordinates: vCords}};
        }

        if (type === 'MultiPolygon') {
            const vCords = coordinates.reduce((accO, currO) => {
                const vP = currO.reduce((acc, curr) => {
                    if (curr.length >= 4 && curr[0][0] === curr[curr.length - 1][0] && curr[0][1] === curr[curr.length - 1][1]) {
                        return [...acc, curr];
                    }
                    return acc;
                }, []);

                if (vP.length < 1) return accO;
                return [...accO, vP];
            }, []);
            return {...rest, geometry: {type, coordinates: vCords}};
        }
    };

    static bufferMultiPolygon(feature, meter = 0.01) {
        try {
            // console.log(feature.id);
            const {geometry: noNeed, ...rest} = feature;
            const buffered = turf.buffer(feature, meter, {units: 'meters'});
            // console.log(buffered.id);
            return {...rest, geometry: buffered.geometry};
        } catch (e) {
            return null;
        }

    };

    static cleanPolygon(feature) {
        const {geometry, ...rest} = feature;
        const {type, coordinates} = geometry;

        if (type === 'Polygon') {
            const cleaned = [coordinates[0]];
            return {geometry: {type, coordinates: cleaned}, ...rest};
        } else {
            return feature;
        }
    }

    static crawlerMerge(areaMap, didFinishBFSLayer) {
        const crawlered = func.deepClone(areaMap);
        const visited = new Set();
        const errs = [];
        const keys = Object.keys(areaMap);
        try {
            for (let orgAreaKey of keys) {
                if (visited.has(orgAreaKey)) continue;
                let queue = [`${orgAreaKey}`];
                let next;

                while (queue.length) {
                    next = new Set();
                    while (queue.length) {
                        const curr = queue.pop();
                        if (visited.has(curr)) continue;


                        const currArea = crawlered[curr];
                        const nerbors = Area.findNearbyAreas(crawlered, currArea);
                        const [error, mergedNeibors, extra] = Area.mergeAreas([currArea, ...nerbors]);
                        if (extra.length) {
                            extra.forEach(extraArea => {
                                const {areaKey, features: extraFeatures} = extraArea;
                                const targetArea = crawlered[areaKey];
                                if (!targetArea) {
                                    crawlered[areaKey] = extraArea;
                                    return;
                                }
                                const {features: unchangedFeatures, ...rest} = targetArea;
                                const combinedFeatures = [...unchangedFeatures, ...extraFeatures];
                                const reProcessed = Area.queueMergeArea(combinedFeatures);
                                crawlered[areaKey] = {features: reProcessed, ...rest};
                            });
                        }


                        if (error) errs.push(error);
                        mergedNeibors.forEach(ma => {
                            if (!ma) return;
                            crawlered[ma.areaKey] = ma;
                            if (!visited.has(ma.areaKey)) next.add(ma.areaKey);
                        });
                        visited.add(curr);
                    }

                    if (didFinishBFSLayer) {
                        // console.log(keys.length);
                        didFinishBFSLayer(visited.size, keys.length, next.size);
                    }
                    // console.log(visited.size(), keys.length, next.size());
                    queue = [...next];
                }
            }
        } catch (e) {
            errs.push(e);
        }


        const featureCount = Object.values(crawlered).reduce((acc, curr) => acc + curr.features.length, 0);
        return [errs, crawlered, featureCount];
    }

    static findNearbyAreas(areaMap, orgArea) {
        const result = [];
        const rightKey = `${func.round((orgArea.lat + 0.0025), 4)}-${orgArea.lng}`;
        const bottomKey = `${orgArea.lat}-${func.round((orgArea.lng + 0.0025), 4)}`;
        const crossKey = `${func.round((orgArea.lat + 0.0025), 4)}-${func.round((orgArea.lng + 0.0025), 4)}`;
        if (areaMap[rightKey]) {
            // console.log(rightKey,visited.indexOf(rightKey));
            result.push(areaMap[rightKey]);
        }
        if (areaMap[bottomKey]) {
            // console.log(bottomKey,visited.indexOf(bottomKey));
            result.push(areaMap[bottomKey]);
        }
        if (areaMap[crossKey]) {
            result.push(areaMap[crossKey]);
        }
        return result;
    }

    static finalCleanUp(areaMap) {
        const obj = {};
        let area;
        const errs = [];
        let featureCount = 0;
        for (let key in areaMap) {
            try {
                area = areaMap[key];
                const {areaKey, features, ...rest} = area;
                const finalFeatures = features.reduce((acc, fea) => {
                    let toSave = Area.bufferMultiPolygon(fea, 3);
                    toSave = Area.bufferMultiPolygon(toSave, -3);
                    if (!toSave) return acc;
                    toSave = Area.simplifyFeature(toSave);
                    return [...acc, toSave];
                }, []);
                featureCount += finalFeatures.length;
                obj[areaKey] = {features: finalFeatures, areaKey, ...rest};
            } catch (e) {
                errs.push(e);
            }

        }
        return [errs, obj, featureCount];
    }

    static mergeAreas(areas) {
        try {
            const features = areas.reduce((acc, curr) => [...acc, ...curr.features], []);
            const processed = Area.queueMergeArea(features, false);
            const newAreas = Area.separateAreas(processed);
            const result = areas.reduce((acc, curr) => {
                if (newAreas[curr.areaKey]) {
                    return [...acc, newAreas[curr.areaKey]];
                }
                return acc;
            }, []);
            const resultKeys = Object.keys(result);
            const extraKeys = Object.keys(newAreas).filter((areaKey) => resultKeys.indexOf(areaKey) < 0);
            const extra = extraKeys.reduce((acc, curr) => {
                return [...acc, newAreas[curr]];
            }, []);
            return [null, result, extra];
        } catch (e) {
            return [e, areas];
        }
    };
}

module.exports = Area;
