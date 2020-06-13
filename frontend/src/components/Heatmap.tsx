import * as ReactDOM from 'react-dom';
import { useEffect, useMemo, useRef } from 'react';
import styles from './Heatmap.scss?module';
import * as mapboxgl from 'mapbox-gl';
import ReactMapboxGl, { Layer, Source } from 'react-mapbox-gl';
import * as React from 'react';
import { DataFile, useStationsData } from '../hooks/useDataFiles';
import { Point } from 'geojson';
import useStationsGeojson, { StationFeature } from '../hooks/useStationsGeojson';
import StationPopup from './StationPopup';

export type NumericalPropType =
    | 'bikes_available'
    | 'bikes_available_mechanical'
    | 'bikes_available_ebike'
    | 'docks_available';

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
    ctx.font = '400 22px Arial';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

function newReactPopup(el: JSX.Element) {
    const placeholder = document.createElement('div');
    ReactDOM.render(el, placeholder);

    return new mapboxgl.Popup().setDOMContent(placeholder);
}

const colors = { mechanical: '#6ba553', ebike: '#16a2a8', dock: '#d468c9' };

const Mapbox = ReactMapboxGl({
    accessToken: 'pk.eyJ1IjoicmFwaGFlbHZpZ2VlIiwiYSI6ImNrYXp4ZWN4bjAxcDEycWw5NmR2eTV3ZnYifQ.w-il_8J9WSbbDsBS9CXTHw',
});

interface HeatmapProps {
    file: DataFile;
    showStations: boolean;
    numericalProp: NumericalPropType;
}

export default function Heatmap({ file, showStations, numericalProp }: HeatmapProps) {
    const stations = useStationsData(file);
    const { geojson, map: mappedFeatures } = useStationsGeojson(stations);

    const max = useMemo(() => Math.max(...geojson.features.map((f) => f.properties[numericalProp])), [
        geojson,
        numericalProp,
    ]);

    // That's a hack to have a constant ref in the mapbox callbacks
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
                canvas.width = 50;
                canvas.height = 50;
                const ctx = canvas.getContext('2d')!;

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

                            const getTextColor = () => {
                                switch (numProp) {
                                    case 'bikes_available':
                                        return '#000';
                                    default:
                                        return '#fff';
                                }
                            };

                            drawText({
                                canvas,
                                text: `${props[numProp]}`,
                                color: getTextColor(),
                            });
                        } else {
                            drawCircle({ canvas, fill: '#fc6262', stroke: { width: 6, color: '#fff' } });

                            ctx.fillStyle = '#fff';

                            const recWidth = 26;
                            const recHeight = 8;
                            const xPos = canvas.width / 2 - recWidth / 2;
                            const yPos = canvas.height / 2 - recHeight / 2;
                            ctx.fillRect(xPos, yPos, recWidth, recHeight);
                        }

                        const im = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        ctx.clearRect(0, 0, canvas.width, canvas.height);

                        map.addImage(id, im);
                        return;
                    }
                });

                map.on('click', 'stations-locations', (e) => {
                    const feature = ((e.features as unknown) as StationFeature[])[0];
                    const coordinates = (feature.geometry as Point).coordinates.slice() as [number, number];

                    // Ensure that if the map is zoomed out such that multiple
                    // copies of the feature are visible, the popup appears
                    // over the copy being pointed to.
                    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                    }

                    newReactPopup(<StationPopup feature={feature} />)
                        .setLngLat(coordinates)
                        .addTo(map);
                });
            }}
        >
            <Source id={'stations'} geoJsonSource={{ type: 'geojson', data: geojson }} />
            {showStations ? (
                <Layer
                    key={'stations-status'}
                    type={'symbol'}
                    id={'stations-locations'}
                    sourceId={'stations'}
                    layout={{
                        'symbol-sort-key': ['interpolate', ['linear'], ['get', numericalProp], 0, max, max, 0],
                        'icon-image': `stationv1::{station_id}::${numericalProp}`,
                        'icon-size': 0.5,
                    }}
                    paint={{}}
                />
            ) : (
                <Layer
                    key={'stations-heatmap'}
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
            )}
        </Mapbox>
    );
}
