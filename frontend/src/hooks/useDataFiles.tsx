import { useEffect, useState } from 'react';
import useStations, { Station } from './useStations';

export interface DataFile {
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

async function fetchDataFileStations(file: DataFile): Promise<DataFileStation[]> {
    const res = await fetch(file.url);
    const data = await res.json();

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

interface EnhancedDataFileStation extends DataFileStation {
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
