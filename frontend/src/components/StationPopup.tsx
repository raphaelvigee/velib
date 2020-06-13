import * as React from 'react';
import { StationFeature } from '../hooks/useStationsGeojson';

interface StationPopupProps {
    feature: StationFeature;
}

export default function StationPopup({ feature }: StationPopupProps) {
    const props = feature.properties;

    if (props.is_functional) {
        return (
            <div>
                <div>
                    <div>Available: {props.bikes_available}</div>
                    <div>Mechanical: {props.bikes_available_mechanical}</div>
                    <div>Mechanical: {props.bikes_available_ebike}</div>
                    <div>Docks: {props.docks_available}</div>
                </div>
            </div>
        );
    } else {
        return <>Station unavailable</>;
    }
}
