import * as React from 'react';
import { StationsProvider } from '../hooks/useStations';
import Map from './Map';

export default function App() {
    return (
        <StationsProvider>
            <Map />
        </StationsProvider>
    );
}
