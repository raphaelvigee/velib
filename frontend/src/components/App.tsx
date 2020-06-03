import * as React from 'react';
import { StationsProvider } from '../hooks/withStations';
import Heatmap from './Heatmap';

export default function App() {
    return (
        <StationsProvider>
            <Heatmap />
        </StationsProvider>
    );
}
