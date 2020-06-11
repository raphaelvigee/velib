const fs = require('fs');

const args = process.argv.slice(2);

const stationsFolder = args[0] || '';
const aggregateFolder = args[1] || '';

if (stationsFolder === '') {
    console.log('Stations folder required')
    process.exit(1);
}

if (aggregateFolder === '') {
    console.log('Aggregate folder required')
    process.exit(1);
}

const aggregate = {};

const files = fs.readFileSync(`${stationsFolder}/index.txt`).toString().split("\n").filter(l => l.length > 0);

for(const file of files) {
    const date = file.replace('.json', '');
    const path = `${stationsFolder}/${file}`;
    console.log(path);

    const data = JSON.parse(fs.readFileSync(path).toString());

    const stations = data.data.stations;

    for (const station of stations) {
        const stationId = station.station_id;

        if (!(stationId in aggregate)) {
            aggregate[stationId] = {};
        }

        aggregate[stationId][date] = station;
    }
}

if (fs.existsSync(aggregateFolder)) {
    fs.rmdirSync(aggregateFolder, {recursive: true});
}
fs.mkdirSync(aggregateFolder, {recursive: true})

for (const [stationId, data] of Object.entries(aggregate)) {
    fs.writeFileSync(`${aggregateFolder}/${stationId}.json`, JSON.stringify(data))
}
