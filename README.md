# GeoJson Simplifier


Install Package
```
npm install geojson-simplifier
```

Construct Object with GeoJson data.
```
const testArea = new Area(geojson);
```

Create Hook Map(Optional)
```
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
```

Process Data
```
//outputFolder: './docs/result'
const simplifiedData = await testArea.processData(hookMap, {outputFolder: outPath, doExport: true});
```

Before
![Before](https://user-images.githubusercontent.com/8865339/134125030-e3202fde-cd98-4dc7-86a9-e5fe3c30483e.png)

After
![After](https://user-images.githubusercontent.com/8865339/134125040-d8c1477b-ecb0-4886-be09-88f7203be794.png)
