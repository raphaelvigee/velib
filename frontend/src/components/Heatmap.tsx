import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import useStations, { Station } from '../hooks/withStations';
import ReactMapboxGl, { Layer, Source } from 'react-mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import styles from './Heatmap.scss?module';

interface DataFile {
    url: string;
    date: string;
}

async function fetchAvailableData(): Promise<DataFile[]> {
    const res = await fetch('/gh/rawdata/index.txt');
    const data = await res.text();

    const files = data.split('\n');

    return files.map((file) => {
        const date = file.replace('.json', '');

        return {
            url: `/gh/rawdata/${file}`,
            date,
        };
    });
}

interface MapProps {
    file: DataFile;
}

interface DataFileStation {
    stationCode: string;
    station_id: number;
    num_bikes_available: number;
    numBikesAvailable: number;
    num_bikes_available_types: [
        {
            mechanical: number;
        },
        {
            ebike: number;
        },
    ];
    num_docks_available: number;
    numDocksAvailable: number;
    is_installed: number;
    is_returning: number;
    is_renting: number;
    last_reported: number;
}

async function fetchDataFileStations(file: DataFile): Promise<DataFileStation[]> {
    const res = await fetch(file.url);
    const data = await res.json();

    return data.data.stations;
}

interface EnhancedDataFileStation extends DataFileStation {
    station: Station | null;
}

const Mapbox = ReactMapboxGl({
    accessToken: 'pk.eyJ1IjoicmFwaGFlbHZpZ2VlIiwiYSI6ImNrYXp4ZWN4bjAxcDEycWw5NmR2eTV3ZnYifQ.w-il_8J9WSbbDsBS9CXTHw',
});

function Map({ file }: MapProps) {
    const [stations, setStations] = useState<EnhancedDataFileStation[]>([]);
    const { findStation } = useStations();

    function enhanceStation(station: DataFileStation): EnhancedDataFileStation {
        return {
            ...station,
            station: findStation(station.station_id),
        };
    }

    async function handleStations() {
        const rawStations = await fetchDataFileStations(file);

        setStations(rawStations.map(enhanceStation));
    }

    useEffect(() => {
        handleStations();
    }, [file]);

    const geojson = useMemo(
        () => ({
            type: 'FeatureCollection',
            features: stations
                .map((s) => {
                    if (!s.station) {
                        return null;
                    }

                    return {
                        type: 'Feature',
                        properties: {
                            station_id: s.station_id,
                            bike_available: s.num_bikes_available,
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [s.station.lon, s.station.lat, 0],
                        },
                    };
                })
                .filter((s) => !!s),
        }),
        [stations],
    );

    const max = useMemo(() => Math.max(...stations.map((s) => s.num_bikes_available)), [stations]);

    return (
        <Mapbox style={'mapbox://styles/mapbox/streets-v9'} className={styles.map} center={[2.3488, 48.8534]}>
            <Source id={'stations'} geoJsonSource={{ type: 'geojson', data: geojson }} />
            <Layer
                type="heatmap"
                id="bike-heatmap"
                sourceId={'stations'}
                paint={{
                    // Increase the heatmap weight based on frequency and property magnitude
                    'heatmap-weight': ['interpolate', ['linear'], ['get', 'bike_available'], 0, 0, max, 1],
                    // Increase the heatmap color weight weight by zoom level
                    // heatmap-intensity is a multiplier on top of heatmap-weight
                    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
                    // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
                    // Begin color ramp at 0-stop with a 0-transparancy color
                    // to create a blur-like effect.
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0,
                        'rgba(33,102,172,0)',
                        0.2,
                        'rgb(103,169,207)',
                        0.4,
                        'rgb(209,229,240)',
                        0.6,
                        'rgb(253,219,199)',
                        0.8,
                        'rgb(239,138,98)',
                        1,
                        'rgb(178,24,43)',
                    ],
                }}
            />
        </Mapbox>
    );
}

export default function Heatmap() {
    const [files, setFiles] = useState<DataFile[]>([]);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        fetchAvailableData().then(setFiles);
    }, []);

    if (files.length === 0) {
        return <>Loading files</>;
    }

    function prev() {
        setIndex((ci) => {
            if (ci === 0) {
                return ci;
            }

            return ci - 1;
        });
    }

    function next() {
        setIndex((ci) => {
            if (ci === files.length - 1) {
                return ci;
            }

            return ci + 1;
        });
    }

    const currentFile = files[index];

    return (
        <div className={styles.view}>
            <header className={styles.header}>
                <div>Map</div>
                <button onClick={prev}>Previous</button>
                <span>
                    ({index}) {currentFile.date}
                </span>
                <button onClick={next}>Next</button>
            </header>

            <Map file={currentFile} />
        </div>
    );
}
