import { useMemo } from 'react';
import { DataFileStation, EnhancedDataFileStation } from './useDataFiles';

function findBikesType<S extends DataFileStation, P extends 'mechanical' | 'ebike'>(s: S, prop: P): number {
    const bikeType = s.num_bikes_available_types.find((t) => prop in t);

    if (bikeType) {
        const typedType = (bikeType as unknown) as { [k in P]: number };

        return typedType[prop];
    }

    return 0;
}

function fromEntries<T>(iterable: Array<[string, T]>): { [key: string]: T } {
    return [...iterable].reduce<{ [key: string]: T }>((obj, [key, val]) => {
        obj[key] = val;
        return obj;
    }, {});
}

export interface StationFeature {
    type: 'Feature';
    properties: {
        station_id: number;
        station_name: string;

        bikes_available: number;
        bikes_available_mechanical: number;
        bikes_available_ebike: number;
        docks_available: number;

        is_functional: boolean;
    };
    geometry: {
        type: 'Point';
        coordinates: [number, number, number];
    };
}

export default function useStationsGeojson(stations: EnhancedDataFileStation[]) {
    const mappedFeatures = useMemo(() => {
        const pairs = stations
            .filter((s) => !!s.station)
            .map((s) => {
                const stationData = s.station!;

                const feature: StationFeature = {
                    type: 'Feature',
                    properties: {
                        station_id: s.station_id,
                        station_name: stationData.name,

                        bikes_available: s.num_bikes_available,
                        bikes_available_mechanical: findBikesType(s, 'mechanical'),
                        bikes_available_ebike: findBikesType(s, 'ebike'),
                        docks_available: s.num_docks_available,

                        is_functional: !!(s.is_installed && s.is_renting && s.is_returning),
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

    const features = useMemo(() => Object.values(mappedFeatures), [mappedFeatures]);

    const geojson = useMemo(
        () => ({
            type: 'FeatureCollection',
            features: features,
        }),
        [features],
    );

    return { geojson, map: mappedFeatures };
}
