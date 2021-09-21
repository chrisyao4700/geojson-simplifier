const Area = require('./src/models/area.class');
const func = require('./src/service/util.func');
const main = (async () => {
    const data = await func.readJSONFile(func.resolvePath([__dirname, `docs/raw/testarea.json`]));

    const testArea = new Area(data);

    const outPath = func.resolvePath([__dirname, 'docs/test']);
    // const outPath = func.resolvePath([__dirname, 'docs', `${fileIdx}-${testCode}`]);

    const hookMap = {
        willStartProcessData: (geojson) => {
            console.log('Will start process');
        },
        didStartProcessData: (featureCount) => {
            console.log(`Did start process data:  ${featureCount} features`);
        },
        willStartSeparateAreas: (features) => {
            console.log('Will Start Separate Areas');
        },
        didFinishSeparateAreas: (featureMap, areaCount, featureCount, processTime) => {
            console.log(`Did Separate Areas: ${areaCount} areas, ${featureCount} features. Process Time: ${processTime}`);
        },
        willStartUnionMerge: (featureMap) => {
            console.log(`Will start Union Merge`);
        },
        willStartUnionSubArea: (idx, areaKey, features) => {
            console.log(`Processing Union Merge ${idx} ${areaKey}`);
        },
        didFinishUnionSubArea: (err, idx, areaKey, features, fromCount, toCount) => {
            console.log(`Finished ${idx} ${areaKey} with ${fromCount}=>${toCount} features`);
            if (err) {
                console.log(err);
            }
        },
        didFinishUnionMerge: (errs, featureMap, featureCount, processTime) => {
            console.log(`Did finish Union Merge with current feature: ${featureCount}. \nProcess Time: ${processTime} sec`);
        },
        willStartCrawlerMerge: (featureMap, featureCount) => {
            console.log('Will start crawler merge');
        },
        didFinishCrawlerBFSLayer: (visited, total, next) => {
            console.log(`Did finish BFS Layer ${visited}/${total}, next layer: ${next}`);
        },
        didFinishCrawlerMerge: (errs, featureMap, featureCount, processTime) => {
            console.log(`Did finish Crawler Merge with current feature: ${featureCount}. \nProcess Time: ${processTime} sec`);
        },
        willStartFinalCleanUp: (featureMap, featureCount) => {
            console.log('Will start Final Cleanup')
        },
        didFinishFinalCleanUp: (errs, featureMap, featureCount, processTime) => {
            console.log(`Did finish Final Cleanup with current feature: ${featureCount}. \nProcess Time: ${processTime} sec`);
        },
        didFinishAllProcess: (features, rawCount, finalCount, processTime) => {
            console.log(`Did finish all process of this area feature processed: ${rawCount} => ${finalCount}.\nProcess time: ${processTime} sec`);
        },
        willStartExportFile: (processTime) => {
            console.log(`Will start Export Files. Process Time: ${processTime} sec`);
        },
        didExportArea: (path, type) => {
            console.log(`Export Area: ${path} - (${type})`);
        },
        didExportCompleteFile: (path, processTime) => {
            console.log(`Export Complete File: ${path}, Process Time: ${processTime} sec`);
        }
    };

    const simplifiedData = await testArea.processData(hookMap, {outputFolder: outPath, doExport: true});
    console.log(simplifiedData);

})();
