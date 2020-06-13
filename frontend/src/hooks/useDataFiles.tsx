import { useEffect, useState } from 'react';
import useStations, { Station } from './useStations';
import { STATIONS_AGGREGATE_FOLDER_URL, STATIONS_STATUS_FOLDER_URL } from '../config';
import { DateTime } from 'luxon';

export interface DataFile {
    url: string;
    date: DateTime;
    live?: boolean;
}

async function fetchJson<R>(url: string): Promise<R> {
    const res = await fetch(url);
    const data = await res.json();

    return data;
}

async function fetchLines<R>(url: string): Promise<string[]> {
    const res = await fetch(url);
    const data = await res.text();

    return data.split('\n').filter((l) => l.length > 0);
}

async function fetchAvailableData(): Promise<DataFile[]> {
    const files = await fetchLines(`${STATIONS_STATUS_FOLDER_URL}/index.txt`);

    const datafiles = files.map((file) => {
        const dateStr = file.replace('.json', '');

        const date = DateTime.fromFormat(`${dateStr} UTC`, 'yyyy-MM-dd_HH:mm z');

        return {
            url: `${STATIONS_STATUS_FOLDER_URL}/${file}`,
            date,
        };
    });

    const liveUrl = 'https://velib-metropole-opendata.smoove.pro/opendata/Velib_Metropole/station_status.json';

    return [
        ...datafiles,
        {
            url: `https://cors-anywhere.herokuapp.com/${liveUrl}`,
            date: DateTime.local(),
            live: true,
        },
    ];
}

async function fetchDataFileStations(file: DataFile): Promise<DataFileStation[]> {
    const data = await fetchJson<any>(file.url);

    return data.data.stations;
}

export function useDataFiles() {
    const [files, setFiles] = useState<DataFile[] | null>(null);

    useEffect(() => {
        fetchAvailableData().then(setFiles);
    }, []);

    return files;
}

export interface DataFileStation {
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

export interface EnhancedDataFileStation extends DataFileStation {
    station: Station | null;
}

export function useStationsData(file: DataFile) {
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

    return stations;
}

export function useStationHistoricalData(stationId: number) {
    const [data, setData] = useState<DataFileStation[] | null>(null);

    useEffect(() => {
        fetchJson(`${STATIONS_AGGREGATE_FOLDER_URL}/${stationId}.json`).then(setData);
    }, [stationId]);

    return data;
}
