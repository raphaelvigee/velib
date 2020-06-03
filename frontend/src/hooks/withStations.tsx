import * as React from 'react';
import { ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export interface Station {
    station_id: number;
    name: string;
    lat: number;
    lon: number;
    capacity: number;
    stationCode: string;
    rental_methods?: string[];
}

const Context = React.createContext<Station[] | null>(null);

export function StationsProvider({ children }: { children: ReactNode }) {
    const [stations, setStations] = useState<Station[] | null>(null);

    async function fetchStations() {
        const res = await fetch('/stations');

        const data = await res.json();

        setStations(data.data.stations as Station[]);
    }

    useEffect(() => {
        fetchStations();
    }, []);

    if (stations === null) {
        return <>Loading stations...</>;
    }

    return <Context.Provider value={stations}>{children}</Context.Provider>;
}

export default function useStations() {
    const stations = useContext(Context);

    const findStation = useCallback(
        (id: number) => {
            if (stations === null) {
                return null;
            }

            for (const s of stations) {
                if (s.station_id === id) {
                    return s;
                }
            }

            return null;
        },
        [stations],
    );

    return { stations, findStation };
}
