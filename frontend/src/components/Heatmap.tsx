/*
DISCLAIMER: Yeah this is a bit dirty, but it works ¯\_(ツ)_/¯
I promise I will clean this up.
*/

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import useStations, { Station } from '../hooks/withStations';
import ReactMapboxGl, { Layer, Source } from 'react-mapbox-gl';
import * as mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import styles from './Heatmap.scss?module';

interface DataFile {
    url: string;
    date: string;
}

async function fetchAvailableData(): Promise<DataFile[]> {
    const res = await fetch('/rawdata/index.txt');
    const data = await res.text();

    const files = data.split('\n').filter((l) => l.length > 0);

    return files.map((file) => {
        const date = file.replace('.json', '');

        return {
            url: `/rawdata/${file}`,
            date,
        };
    });
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

interface MapProps {
    file: DataFile;
    showStations: boolean;
    numericalProp: NumericalPropType;
}

type NumericalPropType = 'bikes_available' | 'bikes_available_mechanical' | 'bikes_available_ebike' | 'docks_available';

function findBikesType<S extends DataFileStation, P extends 'mechanical' | 'ebike'>(s: S, prop: P): number {
    const bikeType = s.num_bikes_available_types.find((t) => prop in t);

    if (bikeType) {
        const typedType = (bikeType as unknown) as { [k in P]: number };

        return typedType[prop];
    }

    return 0;
}

function Map({ file, showStations, numericalProp }: MapProps) {
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
                .filter((s) => !!s.station)
                .map((s) => {
                    const stationData = s.station!;

                    return {
                        type: 'Feature',
                        properties: {
                            station_id: s.station_id,
                            station_name: stationData.name,

                            bikes_available: s.num_bikes_available,
                            bikes_available_mechanical: findBikesType(s, 'mechanical'),
                            bikes_available_ebike: findBikesType(s, 'ebike'),
                            docks_available: s.num_docks_available,
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [stationData.lon, stationData.lat, 0],
                        },
                    };
                }),
        }),
        [stations],
    );

    const max = useMemo(() => Math.max(...geojson.features.map((f) => f.properties[numericalProp])), [
        stations,
        numericalProp,
    ]);

    const center = useMemo(() => [2.3488, 48.8534] as [number, number], []);

    return (
        <Mapbox
            style={'mapbox://styles/mapbox/streets-v11?optimize=true'}
            className={styles.map}
            center={center}
            onStyleLoad={(map) => {
                map.addControl(
                    new mapboxgl.GeolocateControl({
                        positionOptions: {
                            enableHighAccuracy: true,
                        },
                        trackUserLocation: true,
                    }),
                );
            }}
        >
            <Source id={'stations'} geoJsonSource={{ type: 'geojson', data: geojson }} />
            <Layer
                type="heatmap"
                id="bike-heatmap"
                sourceId={'stations'}
                paint={{
                    // Increase the heatmap weight based on frequency and property magnitude
                    'heatmap-weight': ['interpolate', ['linear'], ['get', numericalProp], 0, 0, max, 1],
                    // Increase the heatmap color weight weight by zoom level
                    // heatmap-intensity is a multiplier on top of heatmap-weight
                    'heatmap-intensity': 3,
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
                    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 5, 12, 30],
                    'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.9, 14, 0],
                }}
            />
            {showStations ? (
                <Layer
                    type={'symbol'}
                    id={'stations-locations'}
                    sourceId={'stations'}
                    layout={{
                        'text-field': ['get', numericalProp],
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                        'text-letter-spacing': 0.05,
                        'text-size': 11,
                        'symbol-sort-key': ['interpolate', ['linear'], ['get', numericalProp], 0, max, max, 0],
                    }}
                    paint={{
                        'text-color': '#fff',
                        'text-halo-color': '#4e4e4e',
                        'text-halo-width': 1,
                    }}
                />
            ) : (
                <></>
            )}
        </Mapbox>
    );
}

export default function Heatmap() {
    const [files, setFiles] = useState<DataFile[] | null>(null);
    const [index, setIndex] = useState<number | null>(null);
    const [showStations, setShowStations] = useState(true);
    const [numericalProp, setNumProp] = useState<NumericalPropType>('bikes_available');
    const maxIndex = files ? files.length - 1 : 0;

    useEffect(() => {
        fetchAvailableData().then(setFiles);
    }, []);

    useEffect(() => {
        setIndex(maxIndex);
    }, [files]);

    if (files === null || index === null) {
        return <>Loading files</>;
    }

    const currentFile = files[index];

    function filterButton(prop: NumericalPropType, name: string) {
        return (
            <button onClick={() => setNumProp(prop)}>
                {numericalProp === prop && '* '} {name}
            </button>
        );
    }

    return (
        <div className={styles.view}>
            <header className={styles.header}>
                <button disabled={index === 0} onClick={() => setIndex(index - 1)}>
                    Previous
                </button>
                <span>
                    ({index}) {currentFile.date}
                </span>
                <button disabled={index === maxIndex} onClick={() => setIndex(index + 1)}>
                    Next
                </button>
                <button onClick={() => setShowStations(!showStations)}>
                    {showStations ? 'Hide' : 'Show'} stations
                </button>
            </header>
            <header className={styles.header}>
                {filterButton('bikes_available', 'All bikes')}
                {filterButton('bikes_available_mechanical', 'Mechanical')}
                {filterButton('bikes_available_ebike', 'Ebike')}
                {filterButton('docks_available', 'Docks')}
            </header>

            <Map file={currentFile} showStations={showStations} numericalProp={numericalProp} />
        </div>
    );
}
