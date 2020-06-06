/*
DISCLAIMER: Yeah this is a bit dirty, but it works ¯\_(ツ)_/¯
I promise I will clean this up.
*/

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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

interface DrawPiechartProps {
    canvas: HTMLCanvasElement;
    data: number[];
    colors: string[];
    doughnutHoleSize: number;
}

function drawPiechart({ canvas, data, doughnutHoleSize, colors }: DrawPiechartProps) {
    const ctx = canvas.getContext('2d')!;

    let total_value = 0;
    let color_index = 0;
    for (const val of data) {
        total_value += val;
    }

    function drawPieSlice(centerX, centerY, radius, startAngle, endAngle, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
    }

    let start_angle = 0;
    for (const val of data) {
        const slice_angle = (2 * Math.PI * val) / total_value;

        drawPieSlice(
            canvas.width / 2,
            canvas.height / 2,
            Math.min(canvas.width / 2, canvas.height / 2),
            start_angle,
            start_angle + slice_angle,
            colors[color_index % colors.length],
        );

        start_angle += slice_angle;
        color_index++;
    }

    if (doughnutHoleSize) {
        drawPieSlice(
            canvas.width / 2,
            canvas.height / 2,
            doughnutHoleSize * Math.min(canvas.width / 2, canvas.height / 2),
            0,
            2 * Math.PI,
            '#fff',
        );
    }
}

interface DrawUnavailableProps {
    canvas: HTMLCanvasElement;
    fill?: string;
    stroke?: {
        width: number;
        color: string;
    };
}

function drawCircle({ canvas, fill, stroke }: DrawUnavailableProps) {
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    let radius = Math.min(canvas.width / 2, canvas.height / 2);

    if (stroke) {
        radius -= stroke.width;
    }

    ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, 2 * Math.PI);
    ctx.closePath();

    if (stroke) {
        ctx.lineWidth = stroke.width;
        ctx.strokeStyle = stroke.color;
        ctx.stroke();
    }

    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
}

interface DrawTextProps {
    canvas: HTMLCanvasElement;
    text: string;
    color: string;
}

function drawText({ canvas, text, color }: DrawTextProps) {
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = color;
    ctx.font = '300 11px Arial';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

function fromEntries<T>(iterable: Array<[string, T]>): { [key: string]: T } {
    return [...iterable].reduce<{ [key: string]: T }>((obj, [key, val]) => {
        obj[key] = val;
        return obj;
    }, {});
}

const colors = { mechanical: '#80c664', ebike: '#16a2a8', dock: '#d468c9' };

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

    const mappedFeatures = useMemo(() => {
        const pairs = stations
            .filter((s) => !!s.station)
            .map((s) => {
                const stationData = s.station!;

                const feature = {
                    type: 'Feature',
                    properties: {
                        station_id: s.station_id,
                        station_name: stationData.name,

                        bikes_available: s.num_bikes_available,
                        bikes_available_mechanical: findBikesType(s, 'mechanical'),
                        bikes_available_ebike: findBikesType(s, 'ebike'),
                        docks_available: s.num_docks_available,
                        is_installed: s.is_installed,

                        is_functional: s.is_installed && s.is_renting && s.is_returning,
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [stationData.lon, stationData.lat, 0],
                    },
                };

                return [`${s.station_id}`, feature] as [string, typeof feature];
            });

        return fromEntries(pairs);
    }, [stations]);

    const geojson = useMemo(
        () => ({
            type: 'FeatureCollection',
            features: Object.values(mappedFeatures),
        }),
        [mappedFeatures],
    );

    const max = useMemo(() => Math.max(...geojson.features.map((f) => f.properties[numericalProp])), [
        geojson,
        numericalProp,
    ]);

    const store = useRef({
        mappedFeatures,
    });
    useEffect(() => {
        store.current = {
            mappedFeatures,
        };
    }, [mappedFeatures]);

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

                const canvas = document.createElement('canvas');
                canvas.width = 25;
                canvas.height = 25;

                map.on('styleimagemissing', (e) => {
                    const id = e.id; // id of the missing image

                    const [genId, ...dataStr] = id.split('::');

                    if (genId === 'stationv1') {
                        const [stationId, numProp]: [string, NumericalPropType] = dataStr;
                        const feature = store.current.mappedFeatures[stationId];

                        if (!feature) {
                            return;
                        }

                        const props = feature.properties;

                        if (props.is_functional) {
                            switch (numProp) {
                                case 'bikes_available':
                                    drawPiechart({
                                        canvas,
                                        data: [
                                            props.bikes_available_mechanical,
                                            props.bikes_available_ebike,
                                            props.docks_available,
                                        ],
                                        colors: [colors.mechanical, colors.ebike, colors.dock],
                                        doughnutHoleSize: 0.7,
                                    });
                                    break;
                                case 'bikes_available_mechanical':
                                    drawCircle({
                                        canvas,
                                        fill: colors.mechanical,
                                    });
                                    break;
                                case 'bikes_available_ebike':
                                    drawCircle({ canvas, fill: colors.ebike });
                                    break;
                                case 'docks_available':
                                    drawCircle({ canvas, fill: colors.dock });
                                    break;
                            }
                        } else {
                            drawCircle({ canvas, fill: '#fc6262' });
                        }

                        const getTextColor = () => {
                            if (props.is_functional) {
                                switch (numProp) {
                                    case 'bikes_available':
                                        return '#000';
                                    default:
                                        return '#fff';
                                }
                            } else {
                                return '#fff';
                            }
                        };

                        drawText({
                            canvas,
                            text: `${props[numProp]}`,
                            color: getTextColor(),
                        });

                        const ctx = canvas.getContext('2d')!;
                        const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        ctx.clearRect(0, 0, canvas.width, canvas.height);

                        map.addImage(id, im);
                        return;
                    }
                });
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
                        'symbol-sort-key': ['interpolate', ['linear'], ['get', numericalProp], 0, max, max, 0],
                        'icon-image': `stationv1::{station_id}::${numericalProp}`,
                    }}
                    paint={{}}
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
